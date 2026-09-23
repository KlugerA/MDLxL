import { allNodes, sampleTrack, sampleGeosetAnimation } from './animation.js';
import { createVisibilityGeosetAnimation } from './geoset-animation-defaults.js';

// EditorDocument normalizes MDL and MDX animated colors into RGB order.
// This editor's text fields deliberately use the same RGB order as its controls.
const NODE_CHANNELS = {
  Attachments: ['Visibility'], ParticleEmitters: ['Visibility'], ParticleEmitters2: ['Visibility'],
  ParticleEmitterPopcorns: ['Visibility', 'Color', 'Alpha'],
  // Ribbon RGB and Particle2 lifecycle RGB remain in Node Manager: the current
  // codec only supports their static colors, so exposing keyframes loses data.
  Lights: ['Visibility', 'Color', 'AmbColor'], RibbonEmitters: ['Visibility', 'Alpha'],
};
const isTrack = value => value && Array.isArray(value.Keys);
const clone = value => structuredClone(value);
const dimensions = property => property === 'Color' || property === 'AmbColor' ? 3 : 1;
const fallback = property => dimensions(property) === 3 ? [1, 1, 1] : 1;
const lineDefault = property => dimensions(property) === 3 ? 1 : 0;
const keyId = target => `${target.kind}:${target.id}:${target.property}`;
export const animationTrackId = keyId;

function validFrame(frame) {
  if (!Number.isInteger(frame) || frame < -2147483648 || frame > 0x7fffffff) throw new Error('Keyframe time must be a signed 32-bit whole number.');
  return frame;
}
function vectorValue(value, property) {
  const array = typeof value === 'number' ? [value] : Array.from(value || []);
  if (array.length !== dimensions(property) || array.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new Error(`${property === 'Alpha' || property === 'Visibility' ? 'Visibility / alpha' : 'RGB'} values must be between 0 and 1.`);
  return new Float32Array(array);
}
function channelAllowed(model, target) {
  if (target.kind === 'geoset') return !!model.Geosets?.[target.id] && ['Alpha', 'Color'].includes(target.property);
  if (target.kind !== 'node') return false;
  return Object.entries(NODE_CHANNELS).some(([name, channels]) => channels.includes(target.property) && model[name]?.some(n => n.ObjectId === target.id));
}
function resolveTarget(model, target, create = false) {
  if (!channelAllowed(model, target)) throw new Error('This animation target or property is no longer available.');
  if (target.kind === 'node') return allNodes(model).find(n => n.ObjectId === target.id);
  const existing = (model.GeosetAnims || []).filter(a => a.GeosetId === target.id);
  if (existing.length > 1) throw new Error(`Geoset ${target.id + 1} has multiple geoset animations. Resolve the duplicate before editing its tracks.`);
  if (existing.length) return existing[0];
  if (!create) return null;
  const anim = createVisibilityGeosetAnimation(target.id);
  (model.GeosetAnims ||= []).push(anim);
  if (model.Info) model.Info.NumGeosetAnims = model.GeosetAnims.length;
  return anim;
}
export function createGeosetAnimations(model, geosetIds = []) {
  const ids = [...new Set(geosetIds)].filter(id => Number.isInteger(id) && model.Geosets?.[id]);
  if (!ids.length) throw new Error('Check the geosets that need visibility controls.');
  let created = 0;
  for (const id of ids) {
    const existing = (model.GeosetAnims || []).filter(animation => animation.GeosetId === id);
    if (existing.length > 1) throw new Error(`Geoset ${id + 1} has multiple geoset animations. Resolve the duplicate before editing its visibility.`);
    if (!existing.length) { resolveTarget(model, { kind: 'geoset', id, property: 'Alpha' }, true); created++; }
  }
  return created;
}
export function animationTargets(model, { geosetIds = [], nodeIds = [] } = {}) {
  const targets = [];
  for (const id of new Set(geosetIds)) if (model.Geosets?.[id]) {
    for (const property of ['Alpha', 'Color']) targets.push({ kind: 'geoset', id, property, label: `Geoset ${id + 1}`, channel: property === 'Alpha' ? 'Visibility' : 'RGB' });
  }
  const nodes = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  for (const id of new Set(nodeIds)) {
    const node = nodes.get(id);
    if (!node) continue;
    const channels = Object.entries(NODE_CHANNELS).find(([name]) => model[name]?.some(n => n.ObjectId === id))?.[1] || [];
    for (const property of channels) targets.push({ kind: 'node', id, property, label: node.Name || `Node ${id}`, authoredName: !!node.Name, channel: ({ Visibility: 'Visibility', Alpha: 'Opacity', Color: 'RGB', AmbColor: 'Ambient RGB' })[property] });
  }
  return targets;
}
export function readAnimationTrack(model, target) {
  return resolveTarget(model, target)?.[target.property] ?? fallback(target.property);
}
export function sampleAnimationProperty(model, target, frame, sequenceIndex) {
  if (target.kind === 'geoset') {
    resolveTarget(model, target);
    const evaluated = sampleGeosetAnimation(model, target.id, frame, sequenceIndex);
    return target.property === 'Color' ? evaluated.color : evaluated.alpha;
  }
  return sampleTrack(readAnimationTrack(model, target), frame, { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, fallback: fallback(target.property) });
}
function makeKey(Frame, Vector, lineType) {
  const key = { Frame, Vector: new Float32Array(Vector) };
  if (lineType >= 2) {
    key.InTan = lineType === 2 ? new Float32Array(Vector.length) : new Float32Array(Vector);
    key.OutTan = new Float32Array(key.InTan);
  }
  return key;
}
function putKey(track, frame, value) {
  const index = track.Keys.findIndex(k => k.Frame === frame);
  const old = track.Keys[index];
  const key = old ? { ...old, Vector: new Float32Array(value) } : makeKey(frame, value, track.LineType);
  if (index >= 0) track.Keys[index] = key; else track.Keys.push(key);
  track.Keys.sort((a, b) => a.Frame - b.Frame);
}
function trackForEdit(model, target) {
  // Enabling a previously disabled tint must start from the visible white tint,
  // rather than activating stale cached color values in every other sequence.
  const colorDisabled = target.kind === 'geoset' && target.property === 'Color' && !(resolveTarget(model, target)?.Flags & 2);
  const original = colorDisabled ? [1, 1, 1] : readAnimationTrack(model, target);
  if (isTrack(original)) return clone(original);
  const value = vectorValue(original, target.property);
  const track = { LineType: lineDefault(target.property), GlobalSeqId: null, Keys: [] };
  // Converting a static property must preserve its value in every other sequence.
  for (const seq of model.Sequences || []) if (seq.Interval) putKey(track, validFrame(seq.Interval[0]), value);
  return track;
}
function commitTrack(model, target, track) {
  const owner = resolveTarget(model, target, true);
  if (track === undefined) delete owner[target.property]; else owner[target.property] = track;
  if (target.kind === 'geoset' && target.property === 'Color') owner.Flags = (owner.Flags || 0) | 2;
}
function applyPrepared(model, prepared) {
  // All parsing/validation happens before the first model mutation, including
  // resolving every target. EditorDocument then makes the whole edit undoable.
  for (const { target } of prepared) resolveTarget(model, target);
  for (const { target, track } of prepared) commitTrack(model, target, track);
  return prepared.length;
}
function editFrame(model, track, frame, sequenceIndex) {
  validFrame(frame);
  if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) {
    const duration = model.GlobalSequences?.[track.GlobalSeqId];
    if (!(duration > 0)) throw new Error('The track references an invalid global sequence.');
    return frame % duration;
  }
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  if (!interval) throw new Error('Select an animation before editing its keyframes.');
  if (frame < interval[0] || frame > interval[1]) throw new Error('The playhead must be inside the selected animation.');
  return frame;
}
export function setAnimationKey(model, targets, frame, value, sequenceIndex) {
  return applyPrepared(model, targets.map(target => {
    const vector = vectorValue(value, target.property), track = trackForEdit(model, target);
    putKey(track, editFrame(model, track, frame, sequenceIndex), vector);
    return { target, track };
  }));
}

/** Update authored inline values without converting them into keyframe tracks. */
export function setAnimationInlineValues(model, targets, value) {
  return applyPrepared(model, targets.map(target => {
    const original = readAnimationTrack(model, target);
    if (isTrack(original)) throw new Error('This animation channel has keyframes. Edit it at the current frame or use Set Sequence / Set All.');
    const vector = vectorValue(value, target.property);
    return { target, track: dimensions(target.property) === 1 ? vector[0] : vector };
  }));
}
export function deleteAnimationKey(model, targets, frame, sequenceIndex) {
  const prepared = [];
  for (const target of targets) {
    const original = readAnimationTrack(model, target);
    if (!isTrack(original)) continue;
    const track = clone(original), localFrame = editFrame(model, track, frame, sequenceIndex);
    track.Keys = track.Keys.filter(k => k.Frame !== localFrame);
    if (track.Keys.length === original.Keys.length) continue;
    prepared.push({ target, track: track.Keys.length ? track : dimensions(target.property) === 3 ? new Float32Array(fallback(target.property)) : target.property === 'Visibility' ? undefined : 1 });
  }
  return applyPrepared(model, prepared);
}

/** Direct key editing preserves cubic tangents and rejects accidental overwrites. */
export function updateAnimationKey(model, target, frame, nextFrame, value, sequenceIndex) {
  const original = readAnimationTrack(model, target);
  if (!isTrack(original)) throw new Error('Select an existing keyframe to edit.');
  const track = clone(original), source = editFrame(model, track, frame, sequenceIndex), destination = editFrame(model, track, nextFrame, sequenceIndex);
  const key = track.Keys.find(item => item.Frame === source);
  if (!key) throw new Error('The selected keyframe no longer exists.');
  if (source !== destination && track.Keys.some(item => item.Frame === destination)) throw new Error('Another key already exists at that time. Choose an empty frame.');
  const vector = vectorValue(value, target.property);
  key.Frame = destination; key.Vector = vector;
  track.Keys.sort((a, b) => a.Frame - b.Frame);
  return applyPrepared(model, [{ target, track }]);
}
function prepareSequenceTracks(model, targets, value, sequenceIndices) {
  const intervals = (sequenceIndices == null ? model.Sequences || [] : sequenceIndices.map(i => model.Sequences?.[i])).map(seq => seq?.Interval);
  if (!intervals.length || intervals.some(interval => !interval)) throw new Error('Select an animation before setting sequence values.');
  for (const interval of intervals) { validFrame(interval[0]); validFrame(interval[1]); if (interval[1] < interval[0]) throw new Error('The animation interval is invalid.'); }
  return targets.map(target => {
    const vector = vectorValue(value, target.property), track = trackForEdit(model, target);
    if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) throw new Error('This track uses a global sequence. Change it to Model sequences in Text tracks before using Set Sequence or Set All.');
    track.Keys = track.Keys.filter(k => !intervals.some(([start, end]) => k.Frame >= start && k.Frame <= end));
    for (const [start, end] of intervals) { putKey(track, start, vector); putKey(track, end, vector); }
    return { target, track };
  });
}
export function setAnimationSequences(model, targets, value, sequenceIndices = null) {
  return applyPrepared(model, prepareSequenceTracks(model, targets, value, sequenceIndices));
}

// BAKE and ALL combine the visible Alpha/RGB controls, restricted to checked
// geosets. Prepare both channels before committing either one.
export function bakeGeosetAnimationSettings(model, { geosetIds = [], alpha, color, sequenceIndices = null, drafts = {} } = {}) {
  const ids = [...new Set(geosetIds)];
  if (!ids.length) throw new Error('Check the geosets you want to bake.');
  if (Object.values(drafts).some(draft => draft.target?.kind === 'geoset' && ids.includes(draft.target.id) && ['Alpha', 'Color'].includes(draft.target.property)))
    throw new Error('Checked geosets have pending text edits. Use Bake Text or Discard text before BAKE or ALL.');
  const targets = property => ids.map(id => ({ kind: 'geoset', id, property }));
  const prepared = [
    ...prepareSequenceTracks(model, targets('Alpha'), alpha, sequenceIndices),
    ...prepareSequenceTracks(model, targets('Color'), color, sequenceIndices),
  ];
  return applyPrepared(model, prepared);
}

// Text uses one key per line: time: value or time: R, G, B.
// Cubic keys may be followed by InTan:/OutTan: lines. Values are normalized 0–1.
export function parseAnimationTrackText(text, { property = 'Alpha', lineType = lineDefault(property), globalSeqId = null, globalSequences = [] } = {}) {
  if (![0, 1, 2, 3].includes(Number(lineType))) throw new Error('Select a valid interpolation.');
  lineType = Number(lineType);
  if (globalSeqId != null && (!Number.isInteger(globalSeqId) || globalSeqId < 0 || !(globalSequences[globalSeqId] > 0))) throw new Error('Select an existing global sequence.');
  const track = { LineType: lineType, GlobalSeqId: globalSeqId, Keys: [] }, seen = new Set();
  const parseVector = (source, tangent = false) => {
    const input = source.trim().replace(/,\s*$/, '').replace(/^\{\s*([\s\S]*?)\s*\}$/, '$1');
    const values = input.split(/[\s,]+/).filter(Boolean).map(Number);
    if (values.length !== dimensions(property) || values.some(v => !Number.isFinite(v) || (!tangent && (v < 0 || v > 1)))) throw new Error(`Enter ${dimensions(property)} ${tangent ? 'finite tangent' : 'numeric 0–1'} value${dimensions(property) > 1 ? 's' : ''}.`);
    return new Float32Array(values);
  };
  for (const [index, raw] of String(text).split(/\r?\n/).entries()) {
    const line = raw.replace(/\/\/.*$/, '').replace(/#.*$/, '').trim();
    if (!line) continue;
    try {
      const tangent = line.match(/^(InTan|OutTan)\s*:?\s*(.+)$/i);
      if (tangent) {
        if (lineType < 2 || !track.Keys.length) throw new Error('Tangents must follow a Hermite or Bezier keyframe.');
        const key = track.Keys.at(-1), name = tangent[1].toLowerCase() === 'intan' ? 'InTan' : 'OutTan';
        if (key[name]) throw new Error(`Duplicate ${name}.`);
        key[name] = parseVector(tangent[2], true); continue;
      }
      const match = line.match(/^([+-]?\d+)\s*:\s*(.+)$/);
      if (!match) throw new Error('Use time: value, or time: R, G, B.');
      const Frame = validFrame(Number(match[1]));
      if (seen.has(Frame)) throw new Error(`Duplicate keyframe ${Frame}.`);
      if (globalSeqId != null && Frame > globalSequences[globalSeqId]) throw new Error('The keyframe exceeds the global sequence duration.');
      seen.add(Frame); track.Keys.push({ Frame, Vector: parseVector(match[2]) });
    } catch (error) { throw new Error(`Line ${index + 1}: ${error.message}`); }
  }
  if (!track.Keys.length) throw new Error('Enter at least one keyframe before baking.');
  if (lineType >= 2) for (const key of track.Keys) {
    const defaults = makeKey(key.Frame, key.Vector, lineType);
    key.InTan ||= defaults.InTan; key.OutTan ||= defaults.OutTan;
  }
  track.Keys.sort((a, b) => a.Frame - b.Frame);
  return track;
}
export function formatAnimationTrackText(track, { property = 'Alpha', frame = 0 } = {}) {
  const fmt = vector => Array.from(vector, n => Number(n.toFixed(6))).join(', ');
  if (!isTrack(track)) return `${Math.round(frame)}: ${fmt(typeof track === 'number' ? [track] : track || fallback(property))}`;
  return track.Keys.map(key => `${key.Frame}: ${fmt(key.Vector)}${track.LineType >= 2 ? `\n  InTan: ${fmt(key.InTan || key.Vector)}\n  OutTan: ${fmt(key.OutTan || key.Vector)}` : ''}`).join('\n');
}
export function bakeAnimationTracks(model, drafts) {
  const seen = new Set();
  const prepared = drafts.map(draft => {
    const { target } = draft, id = keyId(target);
    if (seen.has(id)) throw new Error('Each target track can only appear once in a bake.');
    seen.add(id); resolveTarget(model, target);
    const track = parseAnimationTrackText(draft.text, { property: target.property, lineType: draft.lineType, globalSeqId: draft.globalSeqId ?? null, globalSequences: model.GlobalSequences });
    return { target, track };
  });
  return applyPrepared(model, prepared);
}
export function collectAnimationKeyframes(model, { geosetIds = [], nodeIds = [], sequenceIndex = -1 } = {}) {
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  const times = new Set();
  for (const target of animationTargets(model, { geosetIds, nodeIds })) {
    const track = readAnimationTrack(model, target);
    if (!isTrack(track) || (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0)) continue;
    for (const key of track.Keys) if (!interval || key.Frame >= interval[0] && key.Frame <= interval[1]) times.add(key.Frame);
  }
  return [...times].sort((a, b) => a - b);
}
