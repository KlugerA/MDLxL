import { directlyBoundBoneIds } from './binding-inspection.js';
import { recalculateExtents } from './editor-document.js';

const track = value => value && Array.isArray(value.Keys);
const signature = value => JSON.stringify(value, (_, item) => ArrayBuffer.isView(item) ? Array.from(item) : item);
const alphaCount = animation => track(animation.Alpha) ? animation.Alpha.Keys.length : 0;
const constantOne = value => !track(value) && (value == null || Number(value) === 1);
const hasTint = animation => !!(animation.Flags & 2) && animation.Color != null;
const white = value => !track(value) && Array.from(value || []).length === 3 && Array.from(value).every(n => n === 1);
export const describeGeosetTint = value => track(value)
  ? `${value.Keys.length} RGB keys, ${['step', 'linear', 'Hermite', 'Bezier'][value.LineType] || 'unknown'}${value.GlobalSeqId != null ? `, global sequence ${value.GlobalSeqId + 1}` : ''}`
  : `static RGB (${Array.from(value || []).map(n => Number(n.toFixed(3))).join(', ')})`;

/** Suggestions, not proof of corruption. Always present the selected owners before committing. */
export function scanGeosetAnimationDuplicates(model) {
  const groups = new Map();
  (model.GeosetAnims || []).forEach((animation, index) => {
    if (!Number.isInteger(animation.GeosetId) || !model.Geosets?.[animation.GeosetId]) return;
    if (!groups.has(animation.GeosetId)) groups.set(animation.GeosetId, []);
    groups.get(animation.GeosetId).push(index);
  });
  return [...groups].filter(([, indices]) => indices.length > 1).map(([geosetId, indices]) => {
    const ranked = [...indices].sort((a, b) => alphaCount(model.GeosetAnims[b]) - alphaCount(model.GeosetAnims[a]) ||
      Number(constantOne(model.GeosetAnims[a].Alpha)) - Number(constantOne(model.GeosetAnims[b].Alpha)) || a - b);
    const colored = indices.filter(index => hasTint(model.GeosetAnims[index]) && !white(model.GeosetAnims[index].Color));
    const candidates = colored.length ? colored : indices.filter(index => hasTint(model.GeosetAnims[index]));
    const distinct = [...new Map(candidates.map(index => [signature(model.GeosetAnims[index].Color), index])).values()];
    return { geosetId, indices, suggestedOwner: ranked[0], colorSources: candidates,
      suggestedColor: distinct.length === 1 ? distinct[0] : null, colorConflict: distinct.length > 1,
      records: indices.map(index => ({ index, animatedAlpha: !!track(model.GeosetAnims[index].Alpha), alphaKeys: alphaCount(model.GeosetAnims[index]),
        staticAlpha: track(model.GeosetAnims[index].Alpha) ? null : Number(model.GeosetAnims[index].Alpha ?? 1),
        colorKeys: track(model.GeosetAnims[index].Color) ? model.GeosetAnims[index].Color.Keys.length : 0,
        hasTint: hasTint(model.GeosetAnims[index]) })) };
  });
}

export function classifyVisibilityGeoset(model, geosetId) {
  const geoset = model.Geosets[geosetId], material = model.Materials?.[geoset.MaterialID];
  if (!material?.Layers?.length) throw Error(`Geoset ${geosetId + 1}: cannot classify a missing material. Use duplicate-only repair.`);
  const types = material.Layers.map(layer => {
    if (track(layer.TextureID)) throw Error(`Geoset ${geosetId + 1}: animated texture selection needs manual review. Use duplicate-only repair.`);
    const texture = model.Textures?.[layer.TextureID];
    if (!texture) throw Error(`Geoset ${geosetId + 1}: texture is missing. Use duplicate-only repair.`);
    if (String(texture.Image || '').replaceAll('/', '\\').toLowerCase() === 'textures\\gutz.blp') return 'guts';
    if (texture.ReplaceableId === 2) return [3, 4].includes(layer.FilterMode) ? 'additive-glow' : 'team-glow';
    return 'body';
  });
  const family = new Set(types.map(type => type.includes('glow') ? 'team-glow' : type));
  if (family.size !== 1) throw Error(`Geoset ${geosetId + 1}: mixed body/guts/team-glow layers need manual review. Use duplicate-only repair.`);
  const count = Math.floor((geoset.Vertices?.length || 0) / 3);
  const bound = new Set(directlyBoundBoneIds(model, { [geosetId]: Array.from({ length: count }, (_, i) => i) }));
  const boneNames = (model.Bones || []).filter(bone => bound.has(bone.ObjectId)).map(bone => String(bone.Name || ''));
  if (family.has('team-glow')) {
    // A glow-named *direct influence*, not an unrelated bone or ancestor, is the user's override.
    if (boneNames.some(name => /glow/i.test(name))) return { role: 'body-glow', boneNames };
    if (types.every(type => type === 'additive-glow')) return { role: 'unchanged-additive', boneNames };
    return { role: 'portrait-background', boneNames };
  }
  return { role: types[0], boneNames };
}

function visibilityTrack(sequences, role) {
  if (!sequences?.length) throw Error('Visibility rebuilding needs animation sequences. Use duplicate-only repair.');
  const frames = new Map();
  for (const sequence of sequences) {
    const [start, end] = sequence.Interval || [];
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) throw Error('A sequence has an invalid interval. Use duplicate-only repair.');
    const name = String(sequence.Name || ''), flesh = /decay[\s_-]*flesh/i.test(name), bone = /decay[\s_-]*bones?/i.test(name);
    let values;
    if (role === 'portrait-background') values = /portrait/i.test(name) ? [1, 1] : [0, 0];
    else if (role === 'guts') values = flesh ? [1, 1] : bone ? [1, 0] : [0, 0];
    else values = flesh ? [1, 0] : bone ? [0, 0] : [1, 1];
    for (const [frame, value] of [[start, values[0]], [end, values[1]]]) {
      if (frames.has(frame) && frames.get(frame) !== value) throw Error(`Sequence boundaries disagree at frame ${frame}. Use duplicate-only repair or fix the intervals first.`);
      frames.set(frame, value);
    }
  }
  return { LineType: 1, GlobalSeqId: null, Keys: [...frames].sort(([a], [b]) => a - b).map(([Frame, value]) => ({ Frame, Vector: new Float32Array([value]) })) };
}

/** Called in EditorDocument.apply on a staging document, never on the live document. */
export function repairGeosetAnimations(model, { tint = 'preserve', owners = {}, colors = {}, rebuildVisibility = false } = {}) {
  if (!['preserve', 'fresh'].includes(tint)) throw Error('Choose preserve tinting or start fresh.');
  const groups = scanGeosetAnimationDuplicates(model);
  if (!groups.length) throw Error('No duplicate geoset animations were found.');
  const original = model.GeosetAnims, removed = new Set(), ownerFor = new Map(), replacements = new Map(), report = [];
  for (const group of groups) {
    const owner = owners[group.geosetId] ?? group.suggestedOwner;
    if (!group.indices.includes(owner)) throw Error(`Choose a visibility owner for geoset ${group.geosetId + 1}.`);
    const survivor = structuredClone(original[owner]);
    if (tint === 'preserve') {
      const color = colors[group.geosetId] ?? group.suggestedColor;
      if (group.colorConflict && color == null) throw Error(`Geoset ${group.geosetId + 1} has conflicting tint tracks. Choose the tint source to keep.`);
      if (color != null) {
        if (!group.colorSources.includes(color)) throw Error(`Invalid tint source for geoset ${group.geosetId + 1}.`);
        survivor.Color = structuredClone(original[color].Color); survivor.Flags |= 2;
      }
    }
    // Preserve non-color flags (including DropShadow) from consolidated records.
    survivor.Flags |= group.indices.reduce((flags, index) => flags | (original[index].Flags & ~2), 0);
    replacements.set(owner, survivor);
    for (const index of group.indices) { ownerFor.set(index, owner); if (index !== owner) removed.add(index); }
    report.push({ geosetId: group.geosetId, kept: owner, removed: group.indices.filter(index => index !== owner),
      colorSource: tint === 'preserve' ? colors[group.geosetId] ?? group.suggestedColor : null });
  }
  const next = [], indexMap = new Map();
  original.forEach((animation, index) => { if (!removed.has(index)) { indexMap.set(index, next.length); next.push(replacements.get(index) || structuredClone(animation)); } });
  const visibility = [];
  if (rebuildVisibility) for (let id = 0; id < model.Geosets.length; id++) {
    const classification = classifyVisibilityGeoset(model, id);
    visibility.push({ geosetId: id, ...classification });
    if (classification.role === 'unchanged-additive') continue;
    let animation = next.find(item => item.GeosetId === id);
    if (!animation) { animation = { GeosetId: id, Flags: 0, Color: null, Alpha: 1 }; next.push(animation); }
    animation.Alpha = visibilityTrack(model.Sequences, classification.role);
  }
  let clearedTints = 0;
  if (tint === 'fresh') for (const animation of next) { if (hasTint(animation)) clearedTints++; animation.Color = null; animation.Flags &= ~2; }
  // Only commit after every ambiguity/interval/material check has passed.
  model.GeosetAnims = next;
  for (const bone of model.Bones || []) {
    const old = bone.GeosetAnimId;
    if (indexMap.has(ownerFor.get(old) ?? old)) bone.GeosetAnimId = indexMap.get(ownerFor.get(old) ?? old);
  }
  model.Info.NumGeosetAnims = next.length;
  recalculateExtents(model);
  return { groups: report, removedCount: removed.size, clearedTints, visibility, tint, rebuildVisibility };
}
