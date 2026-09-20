import { generateCompatibleMdx as generateMDX } from './mdx-compatibility.js';
import { EditorDocument, openDocument, validateModel } from './editor-document.js';
import { parseMdx } from './mdx-container.js';
import { sampleTrack } from './animation.js';
import { writeMdxEventGlobalSequences } from './event-object-codec.js';
import { convertMdxGeosetColorTracks } from './geoset-color-codec.js';
import { Buffer } from 'buffer';

export const OPTIMIZER_SECTIONS = ['Geosets', 'Bones', 'Helpers', 'Materials', 'Textures', 'ParticleEmitters2', 'RibbonEmitters'];
const slots = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
const tags = { Geosets: 'GEOS', Bones: 'BONE', Helpers: 'HELP', Materials: 'MTLS', Textures: 'TEXS', ParticleEmitters2: 'PRE2', RibbonEmitters: 'RIBB' };
const results = new WeakMap();
const clone = value => structuredClone(value);
const sentinel = id => id == null || id === -1 || id === 0xffffffff;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function canonical(value, key = '') {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : Number.isFinite(value) ? Number.isInteger(value) ? value : Math.fround(value) : String(value);
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, item => canonical(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined && k !== 'Nodes' && k !== 'PivotPoint' && !(key === 'Info' && /^Num/.test(k))).map(k => [k, canonical(value[k], k)]));
}
function requireSame(a, b, message) { if (!equal(a, b)) throw Error(message); }
function bytesEqual(a, b) { return a.length === b.length && a.every((byte, i) => byte === b[i]); }
function record(g, index) {
  return [Array.from(g.Vertices.slice(index * 3, index * 3 + 3)), Array.from(g.Normals.slice(index * 3, index * 3 + 3)), g.TVertices.map(uv => Array.from(uv.slice(index * 2, index * 2 + 2))), g.VertexGroup[index]];
}
function validateArrays(model) {
  // Pre-existing unrelated diagnostics can remain. Malformed streams/references
  // are never used as input to a compaction operation.
  const structural = /COUNT|REFERENCE|FACE_INDEX_LIMIT|NODE_ID|DUPLICATE_NODE_ID|HIERARCHY_CYCLE/;
  const errors = validateModel(model).filter(d => d.severity === 'error' && (structural.test(d.code) || d.code === 'NON_FINITE_NUMBER' && /Geosets.*(?:Vertices|Normals|VertexGroup|Faces)/.test(d.path)));
  if (errors.length) throw Error(`Optimization cannot safely read this model: ${errors[0].message}`);
}

function vertices(model, counts, skipped) {
  for (const [gi, g] of model.Geosets.entries()) {
    const count = g.Vertices.length / 3;
    if (!g.Faces.length) { skipped.add(`Geoset ${gi + 1}: loose-point geoset retained so it stays editable.`); continue; }
    const used = new Set(g.Faces), adjacent = Array.from({ length: count }, () => new Set());
    for (let i = 0; i < g.Faces.length; i += 3) {
      const face = [...new Set(g.Faces.slice(i, i + 3))];
      for (const a of face) for (const b of face) if (a !== b) adjacent[a].add(b);
    }
    const buckets = new Map(), representatives = [], map = new Map();
    for (let i = 0; i < count; i++) {
      if (!used.has(i)) continue;
      const key = JSON.stringify(canonical(record(g, i))), bucket = buckets.get(key) || [];
      // Two original indices on one triangle may never become one index.
      let group = bucket.find(entry => !entry.members.some(member => adjacent[i].has(member)));
      if (!group) { group = { target: representatives.length, members: [] }; bucket.push(group); buckets.set(key, bucket); representatives.push(i); }
      group.members.push(i); map.set(i, group.target);
    }
    counts.unusedVertices += count - used.size;
    counts.duplicateVertices += used.size - representatives.length;
    if (representatives.length === count) continue;
    const compact = (values, width) => { const data = representatives.flatMap(i => Array.from(values.slice(i * width, (i + 1) * width))); return ArrayBuffer.isView(values) ? new values.constructor(data) : data; };
    g.Vertices = compact(g.Vertices, 3); g.Normals = compact(g.Normals, 3);
    g.TVertices = g.TVertices.map(uv => compact(uv, 2)); g.VertexGroup = compact(g.VertexGroup, 1);
    g.Faces = new g.Faces.constructor(Array.from(g.Faces, index => map.get(index)));
  }
}

function disjointIntervals(model) {
  return model.Sequences.map((seq, i, all) => {
    const [start, end] = seq.Interval || [];
    return seq.Name && Number.isInteger(start) && Number.isInteger(end) && start < end && !all.some((other, j) => j !== i && other.Interval?.[0] <= end && other.Interval?.[1] >= start) ? [start, end] : null;
  }).filter(Boolean);
}
function safeTrack(track, property) {
  if (!track?.Keys || ![0, 1].includes(track.LineType) || !sentinel(track.GlobalSeqId)) return false;
  const width = property === 'Rotation' ? 4 : 3;
  return track.Keys.every((key, i, all) => Number.isInteger(key.Frame) && key.Frame >= 0 && (!i || all[i - 1].Frame < key.Frame) && key.Vector?.length === width && Array.from(key.Vector).every(Number.isFinite) && !key.InTan && !key.OutTan &&
    // The evaluator normalizes interpolation but returns authored endpoint
    // quaternions directly. Only exact unit-axis quaternions prove equality
    // without changing those endpoint values or introducing rounding drift.
    (property !== 'Rotation' || Array.from(key.Vector).filter(v => Math.abs(v) === 1).length === 1 && Array.from(key.Vector).every(v => v === 0 || Math.abs(v) === 1)));
}
function transforms(model, counts, skipped) {
  const intervals = disjointIntervals(model);
  for (const collection of ['Bones', 'Helpers']) for (const node of model[collection]) for (const property of ['Translation', 'Rotation', 'Scaling']) {
    const track = node[property]; if (!track?.Keys || track.Keys.length < 3) continue;
    if (!safeTrack(track, property)) { skipped.add('Global, spline, duplicate-time, invalid or unproven quaternion transform tracks retained.'); continue; }
    const original = track.Keys;
    track.Keys = original.filter((key, i) => {
      if (i === 0 || i === original.length - 1 || key.Frame === 0) return true;
      const prev = original[i - 1], next = original[i + 1];
      const inside = intervals.some(([start, end]) => prev.Frame >= start && next.Frame <= end && key.Frame > start && key.Frame < end);
      const remove = inside && equal(prev.Vector, key.Vector) && equal(key.Vector, next.Vector);
      if (remove) counts.transformKeys++;
      return !remove;
    });
  }
  if (model.Sequences.length && intervals.length !== model.Sequences.length) skipped.add('Overlapping or invalid sequence intervals retained.');
}

function textureRefs(model) {
  const refs = [];
  for (const material of model.Materials) for (const layer of material.Layers || []) for (const slot of slots) {
    if (layer[slot] !== undefined) refs.push([layer, slot]);
    if (layer._MdxDefaults?.[slot] !== undefined) refs.push([layer._MdxDefaults, slot]);
  }
  for (const emitter of model.ParticleEmitters2) refs.push([emitter, 'TextureID']);
  return refs;
}
function visitIds(value, visit) {
  if (typeof value === 'number' || value == null) return visit(value);
  if (!Array.isArray(value.Keys)) throw Error('Unsupported texture reference data.');
  for (const key of value.Keys) for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) for (let i = 0; i < key[field].length; i++) key[field][i] = visit(key[field][i]);
  return value;
}
function resources(model, counts, skipped) {
  const usedMaterials = new Set([...model.Geosets, ...model.RibbonEmitters].map(consumer => consumer.MaterialID).filter(id => !sentinel(id)));
  const materialMap = new Map(); model.Materials = model.Materials.filter((material, i) => { if (!usedMaterials.has(i)) return false; materialMap.set(i, materialMap.size); return true; });
  counts.materials += counts.originalMaterials - model.Materials.length;
  for (const consumer of [...model.Geosets, ...model.RibbonEmitters]) if (!sentinel(consumer.MaterialID)) consumer.MaterialID = materialMap.get(consumer.MaterialID);
  const refs = textureRefs(model);
  if (refs.some(([owner, field]) => owner[field]?.Keys && (owner[field].LineType !== 0 || owner[field].Keys.some(key => key.InTan || key.OutTan)))) {
    skipped.add('Texture cleanup skipped: interpolated texture-ID tracks cannot be safely reindexed.'); return;
  }
  const live = new Set();
  for (const [owner, field] of refs) visitIds(owner[field], id => { if (!sentinel(id)) { if (!Number.isInteger(id) || !model.Textures[id]) throw Error(`Missing animated/effect texture ${id}.`); live.add(id); } return id; });
  const kept = [], byRecord = new Map(), textureMap = new Map();
  for (const [id, texture] of model.Textures.entries()) {
    if (!live.has(id)) continue;
    const key = JSON.stringify(canonical(texture));
    if (!byRecord.has(key)) { byRecord.set(key, kept.length); kept.push(texture); }
    textureMap.set(id, byRecord.get(key));
  }
  counts.textures += model.Textures.length - kept.length; model.Textures = kept;
  for (const [owner, field] of refs) owner[field] = visitIds(owner[field], id => sentinel(id) ? id : textureMap.get(id));
}

/** Independent preservation predicate: this deliberately does not consult the
 * optimizer's key-removal count or list of removed keys. */
export function verifyTransformReduction(before, after, sequences) {
  const intervals = disjointIntervals({ Sequences: sequences });
  for (const collection of ['Bones', 'Helpers']) for (let ni = 0; ni < before[collection].length; ni++) for (const property of ['Translation', 'Rotation', 'Scaling']) {
    const old = before[collection][ni][property], next = after[collection][ni][property];
    if (equal(old, next)) continue;
    if (!safeTrack(old, property) || !next?.Keys) throw Error(`Protected ${property} track changed.`);
    requireSame({ ...old, Keys: [] }, { ...next, Keys: [] }, 'Transform interpolation or global sequence changed.');
    let cursor = 0;
    for (let i = 0; i < old.Keys.length; i++) {
      const key = old.Keys[i];
      if (equal(key, next.Keys[cursor])) { cursor++; continue; }
      const left = old.Keys[i - 1], right = old.Keys[i + 1];
      const interval = intervals.find(([start, end]) => left?.Frame >= start && right?.Frame <= end && key.Frame > start && key.Frame < end);
      if (!left || !right || !key.Frame || !interval || !equal(left.Vector, key.Vector) || !equal(right.Vector, key.Vector)) throw Error('A removed transform key is not independently proven redundant.');
      const options = { interval, fallback: property === 'Rotation' ? [0, 0, 0, 1] : property === 'Scaling' ? [1, 1, 1] : [0, 0, 0], quaternion: property === 'Rotation' };
      for (const frame of [left.Frame, (left.Frame + key.Frame) / 2, key.Frame, (key.Frame + right.Frame) / 2, right.Frame]) requireSame(sampleTrack(old, frame, options), sampleTrack(next, frame, options), 'Transform evaluation changed.');
    }
    if (cursor !== next.Keys.length) throw Error('Transform keys were added or reordered.');
  }
}

function resolvedTexture(value, model) {
  if (typeof value === 'number' || value == null) return sentinel(value) ? value : model.Textures[value];
  return { ...value, Keys: value.Keys.map(key => ({ ...key, ...Object.fromEntries(['Vector', 'InTan', 'OutTan'].filter(field => key[field]).map(field => [field, Array.from(key[field], id => sentinel(id) ? id : model.Textures[id])])) })) };
}
function resolvedMaterial(id, model) {
  const material = model.Materials[id]; if (!material) return id;
  return { ...material, Layers: material.Layers.map(layer => ({ ...layer, ...Object.fromEntries(slots.filter(slot => layer[slot] !== undefined).map(slot => [slot, resolvedTexture(layer[slot], model)])), ...(layer._MdxDefaults ? { _MdxDefaults: { ...layer._MdxDefaults, ...Object.fromEntries(slots.filter(slot => layer._MdxDefaults[slot] !== undefined).map(slot => [slot, resolvedTexture(layer._MdxDefaults[slot], model)])) } } : {}) })) };
}
function preservationView(model, original) {
  const view = clone(model); delete view.Materials; delete view.Textures; delete view.Nodes;
  view.Geosets = model.Geosets.map(g => {
    const { Vertices, Normals, TVertices, VertexGroup, Faces, ...rest } = g;
    return { ...rest, MaterialID: resolvedMaterial(g.MaterialID, model), Corners: Array.from(Faces, index => record(g, index)),
      // Keep the original pattern of repeated indices on each triangle.
      Repeats: Array.from({ length: Faces.length / 3 }, (_, i) => [Faces[i * 3] === Faces[i * 3 + 1], Faces[i * 3 + 1] === Faces[i * 3 + 2], Faces[i * 3] === Faces[i * 3 + 2]]) };
  });
  view.ParticleEmitters2 = model.ParticleEmitters2.map(node => ({ ...node, TextureID: resolvedTexture(node.TextureID, model) }));
  view.RibbonEmitters = model.RibbonEmitters.map(node => ({ ...node, MaterialID: resolvedMaterial(node.MaterialID, model) }));
  for (const collection of ['Bones', 'Helpers']) for (let i = 0; i < view[collection].length; i++) for (const property of ['Translation', 'Rotation', 'Scaling']) {
    if (original[collection][i][property] === undefined) delete view[collection][i][property];
    else view[collection][i][property] = original[collection][i][property];
  }
  return view;
}
export function verifyOptimization(before, after) {
  validateArrays(after);
  if (before.Geosets.length !== after.Geosets.length || before.Bones.length !== after.Bones.length || before.Helpers.length !== after.Helpers.length) throw Error('Geoset or transform-node count changed.');
  verifyTransformReduction(before, after, before.Sequences);
  requireSame(preservationView(before, before), preservationView(after, before), 'Preservation check failed: triangle corners, resources, hierarchy, bounds or excluded data changed.');
}

function assertRoundTripFields(source, reopened, path = '') {
  if (source === undefined || path === 'Nodes' || /\.PivotPoint$/.test(path) || /^Info\.Num/.test(path)) return;
  // MDL omits default layer alpha; its decoder represents that as null while
  // MDX stores the same fully opaque value explicitly.
  if (source == null && reopened === 1 && /^Materials\.\d+\.Layers\.\d+\.Alpha$/.test(path)) return;
  if (source == null || typeof source !== 'object' || ArrayBuffer.isView(source)) { requireSame(source, reopened, `MDX writer cannot preserve ${path}.`); return; }
  if (Array.isArray(source)) {
    if (source.length !== reopened?.length) throw Error(`MDX writer cannot preserve ${path}.`);
    source.forEach((value, i) => assertRoundTripFields(value, reopened[i], `${path}.${i}`)); return;
  }
  for (const key of Object.keys(source)) assertRoundTripFields(source[key], reopened?.[key], path ? `${path}.${key}` : key);
}
function assertSupported(doc) {
  if (doc.readOnly || doc.model.Version !== 800) throw Error('Optimize Model supports editable Classic/SD version 800 only.');
  const unknown = doc._unknownSections();
  if (unknown.length) throw Error(`Optimization refused: unknown source sections (${unknown.join(', ')}) may contain references the writer cannot safely remap.`);
  if (doc.model.BindPoses?.length || doc.model.FaceFX?.length || doc.model.ParticleEmitterPopcorns?.length || doc.model.Geosets.some(g => g.Tangents?.length || g.SkinWeights?.length || g.LevelOfDetail !== undefined || g.Name !== undefined)) throw Error('Optimization refused: unsupported HD or additional vertex data in a Classic model.');
  if (doc.format === 'mdx' && (doc._container.trailingBytes.length || doc._container.chunks.some((chunk, i, all) => all.findIndex(other => other.tag === chunk.tag) !== i))) throw Error('Optimization refused: trailing or repeated MDX chunks cannot be safely regenerated.');
}
function verifyChangedChunkCoverage(doc, beforeBytes, before, after) {
  if (doc.format !== 'mdx') return;
  const generated = Buffer.from(generateMDX({ ...before, BindPoses: undefined, GeosetAnims: convertMdxGeosetColorTracks(before.GeosetAnims) }));
  const canonicalChunks = parseMdx(writeMdxEventGlobalSequences(generated, before)).chunks;
  const sourceChunks = parseMdx(beforeBytes).chunks;
  for (const key of OPTIMIZER_SECTIONS) {
    if (equal(before[key], after[key])) continue;
    const source = sourceChunks.find(chunk => chunk.tag === tags[key]), generatedChunk = canonicalChunks.find(chunk => chunk.tag === tags[key]);
    if (source && (!generatedChunk || !bytesEqual(source.data, generatedChunk.data))) throw Error(`Optimization refused: ${tags[key]} contains source records this writer cannot reproduce exactly. Unsupported data was retained.`);
  }
}

export function analyzeOptimization(doc, { vertexOnly = false } = {}) {
  assertSupported(doc); validateArrays(doc.model);
  const beforeBytes = doc.serialize('mdx'), baseline = openDocument(beforeBytes, 'optimization-before.mdx');
  if (baseline.readOnly) throw Error('Cannot reopen the current-model MDX baseline.');
  assertRoundTripFields(doc.model, baseline.model);
  const temporary = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ includeHistory: false }));
  const counts = { unusedVertices: 0, duplicateVertices: 0, transformKeys: 0, materials: 0, textures: 0, originalMaterials: doc.model.Materials.length };
  const skipped = new Set();
  temporary.apply('Analyze optimization', OPTIMIZER_SECTIONS, model => { vertices(model, counts, skipped); if (!vertexOnly) { transforms(model, counts, skipped); resources(model, counts, skipped); } });
  verifyOptimization(doc.model, temporary.model);
  verifyChangedChunkCoverage(doc, beforeBytes, baseline.model, temporary.model);
  const afterBytes = temporary.serialize('mdx'), reopened = openDocument(afterBytes, 'optimization-after.mdx');
  if (reopened.readOnly || reopened.version !== 800) throw Error('The optimized MDX could not be reopened without changing version.');
  assertRoundTripFields(temporary.model, reopened.model);
  verifyOptimization(baseline.model, reopened.model);
  const before = beforeBytes.byteLength, after = afterBytes.byteLength, saved = before - after;
  const result = { before, after, saved, reduction: before > 0 ? saved / before * 100 : 0, canApply: saved > 0,
    counts: { ...counts, vertices: counts.unusedVertices + counts.duplicateVertices }, skipped: [...skipped],
    originalBytes: doc.originalBytes.byteLength, originalFormat: doc.format,
    message: saved > 0 ? 'Preservation checks passed. Ready to apply.' : 'No safe size reduction found.' };
  results.set(result, { doc, revision: doc.revision, fingerprint: canonical(doc.model), candidate: clone(temporary.model), bytes: new Uint8Array(afterBytes) });
  return result;
}

/** Called inside the application's existing edit() wrapper: one Apply is one
 * undo step, and the normal Save/Save As path remains responsible for disk I/O. */
export function commitOptimization(model, result, doc) {
  const state = results.get(result);
  if (!state || !result.canApply || state.doc !== doc || state.revision !== doc.revision || !equal(state.fingerprint, model)) throw Error('The model changed after analysis. Reopen Optimize Model and analyze again.');
  verifyOptimization(model, state.candidate);
  for (const section of OPTIMIZER_SECTIONS) model[section] = clone(state.candidate[section]);
  return result;
}
export function applyOptimization(doc, result) {
  return doc.apply('Optimize Model', OPTIMIZER_SECTIONS, model => commitOptimization(model, result, doc));
}
export const formatOptimizerBytes = bytes => `${bytes.toLocaleString('en-US')} bytes (${(bytes / 1024).toFixed(2)} KiB)`;
