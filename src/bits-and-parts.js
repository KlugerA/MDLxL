import { ensureDummyBone } from './forge.js';
import { recalculateExtents } from './editor-document.js';
import { sampleTrack } from './animation.js';
import { rgbToWarcraftColor, warcraftColorToRgb } from './warcraft-color.js';

const TEXTURE_SLOTS = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
export const partPathKey = value => String(value || '').replaceAll('/', '\\').toLowerCase();
const canonical = value => Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value, canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const fingerprint = value => JSON.stringify(canonical(value));
export const partTextureKey = texture => fingerprint({ ...texture, Image: partPathKey(texture.Image), ReplaceableId: texture.ReplaceableId || 0, Flags: texture.Flags || 0 });

export function partTextureIndices(model) {
  const indices = new Set();
  for (const geoset of model.Geosets || []) {
    const material = model.Materials?.[geoset.MaterialID];
    if (!material) throw Error('The part references a missing material.');
    for (const layer of material.Layers || []) for (const slot of TEXTURE_SLOTS) {
      const value = layer[slot];
      if (typeof value === 'number' && value >= 0) indices.add(value);
      else for (const key of value?.Keys || []) for (const field of ['Vector', 'InTan', 'OutTan']) for (const id of key[field] || []) if (id >= 0) indices.add(id);
      if (typeof layer._MdxDefaults?.[slot] === 'number' && layer._MdxDefaults[slot] >= 0) indices.add(layer._MdxDefaults[slot]);
    }
  }
  for (const index of indices) if (!model.Textures?.[index]) throw Error(`The part references missing texture ${index}.`);
  return [...indices];
}

/** Every offered sample identifies a real color channel. A frame/geoset choice
 * is explicit even when one sequence has several colors or changes over time. */
export function partColorSources(model, sequenceIndex) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) return [];
  return (model.GeosetAnims || []).flatMap((animation, recordIndex) => {
    if (!(animation.Flags & 2) || !model.Geosets?.[animation.GeosetId] || animation.Color == null) return [];
    const color = animation.Color;
    const global = Number.isInteger(color.GlobalSeqId) && color.GlobalSeqId >= 0;
    if (color.Keys && !color.Keys.some(key => global || (key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]))) return [];
    return [{ recordIndex, geosetIndex: animation.GeosetId, global, animated: !!color.Keys }];
  });
}

export function resolvePartColor(model, { sequenceIndex, recordIndex, frame }) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence || !partColorSources(model, sequenceIndex).some(item => item.recordIndex === recordIndex)) throw Error('Choose an available source animation and geoset color.');
  if (!Number.isFinite(frame) || frame < sequence.Interval[0] || frame > sequence.Interval[1]) throw Error('Choose a sample frame inside the source animation.');
  const color = sampleTrack(model.GeosetAnims[recordIndex].Color, frame, { interval: sequence.Interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback: [NaN, NaN, NaN] });
  const rgb = Array.from(warcraftColorToRgb(color));
  if (rgb.length !== 3 || rgb.some(value => !Number.isFinite(value))) throw Error('This source sample has no usable RGB value.');
  return rgb.map(value => Math.max(0, Math.min(1, value)));
}

/** Enumerate explicitly selectable color-key samples; manual frame sampling
 * remains available between keys. Global keys are placed in this sequence. */
export function partColorSamples(model, sequenceIndex) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) return [];
  const [start, end] = sequence.Interval;
  return partColorSources(model, sequenceIndex).flatMap(source => {
    const color = model.GeosetAnims[source.recordIndex].Color, duration = model.GlobalSequences?.[color.GlobalSeqId];
    const frames = color.Keys ? color.Keys.map(key => source.global && duration > 0 ? key.Frame + Math.ceil((start - key.Frame) / duration) * duration : key.Frame).filter(frame => frame >= start && frame <= end) : [start];
    return [...new Set(frames)].flatMap(frame => {
      try { return [{ ...source, frame, rgb: resolvePartColor(model, { sequenceIndex, recordIndex: source.recordIndex, frame }) }]; } catch { return []; }
    });
  });
}

export function applyPartColor(model, geosetIndices, rgb) {
  if (rgb == null) return;
  if ((!Array.isArray(rgb) && !ArrayBuffer.isView(rgb)) || rgb.length !== 3 || Array.from(rgb).some(value => !Number.isFinite(value) || value < 0 || value > 1)) throw Error('The chosen RGB must have three values from 0 to 1.');
  const indices = new Set(geosetIndices), seen = new Set();
  model.GeosetAnims ||= [];
  for (const animation of model.GeosetAnims) if (indices.has(animation.GeosetId)) {
    // Replacing only Color removes source color keys while preserving alpha,
    // flags unrelated to color, and all unrelated channels.
    animation.Color = rgbToWarcraftColor(rgb); animation.Flags = (animation.Flags || 0) | 2; seen.add(animation.GeosetId);
  }
  for (const index of indices) if (!seen.has(index)) model.GeosetAnims.push({ GeosetId: index, Flags: 2, Alpha: 1, Color: rgbToWarcraftColor(rgb) });
}

/** Isolated bind-pose geometry preview. No destination role is created. */
export function previewPart(source, rgb = null) {
  const model = structuredClone(source);
  // The imported part keeps file-space coordinates and is rebound as one rigid
  // part. Source rig movement must not imply it will be copied into the target.
  model.Nodes = []; model.Bones = []; model.Helpers = []; model.PivotPoints = [];
  for (const key of ['Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'EventObjects', 'CollisionShapes']) model[key] = [];
  for (const geoset of model.Geosets) { geoset.Groups = [[]]; geoset.VertexGroup = new Uint8Array(geoset.Vertices.length / 3); delete geoset.SkinWeights; }
  applyPartColor(model, model.Geosets.map((_, index) => index), rgb);
  return model;
}

/** Whole-part import. Prepare on a clone so even callers outside EditorDocument
 * get all-or-nothing data changes; the UI wraps this in one undoable edit. */
export function commitPart(target, source, { rgb = null, texturePaths = {} } = {}) {
  if (!source?.Geosets?.length) throw Error('This model has no geosets to import.');
  if (source.Version !== target.Version) throw Error('BitsAndParts requires matching model formats. Convert a copy to the destination format first.');
  if (source.BindPoses?.length || target.BindPoses?.length) throw Error('Parts with bind-pose matrices require baking before import.');
  const next = structuredClone(target), staged = structuredClone(source);
  for (const key of ['Textures', 'Materials', 'TextureAnims', 'GlobalSequences', 'Geosets', 'GeosetAnims']) next[key] ||= [];
  const maps = { textures: new Map(), materials: new Map(), textureAnims: new Map(), globals: new Map() };
  const reuse = (collection, item) => { const key = fingerprint(item), index = collection.findIndex(existing => fingerprint(existing) === key); return index < 0 ? collection.push(item) - 1 : index; };
  const remapGlobals = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (Number.isInteger(value.GlobalSeqId) && value.GlobalSeqId >= 0) {
      const id = value.GlobalSeqId, duration = staged.GlobalSequences?.[id];
      if (!Number.isFinite(duration) || duration <= 0) throw Error('The part references a missing global sequence.');
      if (!maps.globals.has(id)) maps.globals.set(id, reuse(next.GlobalSequences, duration));
      value.GlobalSeqId = maps.globals.get(id);
    }
    for (const child of Object.values(value)) remapGlobals(child);
  };
  const textureRef = id => {
    if (id == null || id === -1) return id;
    if (!staged.Textures?.[id]) throw Error(`The part references missing texture ${id}.`);
    if (!maps.textures.has(id)) {
      const texture = { ...staged.Textures[id], ...(texturePaths[id] ? { Image: texturePaths[id] } : {}) };
      const index = next.Textures.findIndex(existing => partTextureKey(existing) === partTextureKey(texture));
      maps.textures.set(id, index < 0 ? next.Textures.push(texture) - 1 : index);
    }
    return maps.textures.get(id);
  };
  const materialRef = id => {
    if (!staged.Materials?.[id]) throw Error(`The part references missing material ${id}.`);
    if (maps.materials.has(id)) return maps.materials.get(id);
    const material = structuredClone(staged.Materials[id]);
    for (const layer of material.Layers || []) {
      for (const slot of TEXTURE_SLOTS) {
        if (typeof layer[slot] === 'number') layer[slot] = textureRef(layer[slot]);
        else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) key[field] = new Int32Array(Array.from(key[field], textureRef));
        if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = textureRef(layer._MdxDefaults[slot]);
      }
      const animationId = layer.TVertexAnimId;
      if (animationId != null && animationId !== -1) {
        if (!staged.TextureAnims?.[animationId]) throw Error('The part references a missing texture animation.');
        if (!maps.textureAnims.has(animationId)) { const animation = structuredClone(staged.TextureAnims[animationId]); remapGlobals(animation); maps.textureAnims.set(animationId, reuse(next.TextureAnims, animation)); }
        layer.TVertexAnimId = maps.textureAnims.get(animationId);
      }
    }
    remapGlobals(material); maps.materials.set(id, reuse(next.Materials, material)); return maps.materials.get(id);
  };
  applyPartColor(staged, staged.Geosets.map((_, index) => index), rgb);
  for (const geoset of staged.Geosets) {
    if (!geoset.Vertices?.length || geoset.Vertices.length % 3 || !geoset.Faces?.length || Array.from(geoset.Faces).some(index => index >= geoset.Vertices.length / 3)) throw Error('The part contains invalid geometry.');
    geoset.MaterialID = materialRef(geoset.MaterialID);
  }
  const bone = ensureDummyBone(next, { weighted: staged.Geosets.some(geoset => geoset.SkinWeights?.length) });
  const start = next.Geosets.length, geosetIndices = [];
  for (const geoset of staged.Geosets) {
    const count = geoset.Vertices.length / 3;
    geoset.Groups = [[bone.ObjectId]]; geoset.TotalGroupsCount = 1; geoset.VertexGroup = new Uint8Array(count);
    if (geoset.SkinWeights?.length) { geoset.SkinWeights = new (next.Version >= 1400 ? Uint16Array : Uint8Array)(count * 8); for (let index = 0; index < count; index++) geoset.SkinWeights.set([bone.ObjectId, 0, 0, 0, 255, 0, 0, 0], index * 8); }
    geosetIndices.push(next.Geosets.push(geoset) - 1);
  }
  for (const animation of staged.GeosetAnims || []) if (Number.isInteger(animation.GeosetId) && staged.Geosets[animation.GeosetId]) { animation.GeosetId += start; remapGlobals(animation); next.GeosetAnims.push(animation); }
  recalculateExtents(next);
  for (const index of geosetIndices) { const geoset = next.Geosets[index]; geoset.Anims = (next.Sequences || []).map(() => ({ MinimumExtent: geoset.MinimumExtent.slice(), MaximumExtent: geoset.MaximumExtent.slice(), BoundsRadius: geoset.BoundsRadius })); }
  if (next.Info) Object.assign(next.Info, { NumGeosets: next.Geosets.length, NumGeosetAnims: next.GeosetAnims.length, NumBones: next.Bones.length });
  Object.assign(target, next);
  return { geosetIndices, boneId: bone.ObjectId, materialMap: Object.fromEntries(maps.materials), textureMap: Object.fromEntries(maps.textures) };
}
