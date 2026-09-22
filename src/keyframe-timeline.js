import { allNodes, sampleTrack } from './animation.js';
import { createVisibilityGeosetAnimation } from './geoset-animation-defaults.js';
import { animationTargets, animationTrackId, readAnimationTrack } from './animation-tracks.js';

const transforms = ['Translation', 'Rotation', 'Scaling'];
const clone = value => structuredClone(value);
const isTrack = value => value && Array.isArray(value.Keys);
const globalId = track => Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0 ? track.GlobalSeqId : null;
const vector = value => typeof value === 'number' ? [value] : Array.from(value || []);
const defaults = property => ({ Translation: [0, 0, 0], Rotation: [0, 0, 0, 1], Scaling: [1, 1, 1], Color: [1, 1, 1], AmbColor: [1, 1, 1] })[property] || 1;
const labels = { Translation: 'Translation', Rotation: 'Rotation', Scaling: 'Scaling', Color: 'RGB', AmbColor: 'Ambient RGB', Alpha: 'Alpha', Visibility: 'Visibility' };
export const timelineSections = ['Nodes', 'GeosetAnims', 'Info'];
export const timelineKeyId = (track, frame) => `${typeof track === 'string' ? track : animationTrackId(track)}@${frame}`;

/** Only codec-supported channels are editable. Unhandled authored tracks remain visible context. */
export function timelineTracks(model) {
  const nodes = allNodes(model), targets = animationTargets(model, { nodeIds: nodes.map(node => node.ObjectId), geosetIds: (model.Geosets || []).map((_, i) => i) });
  for (const node of nodes) for (const property of transforms) targets.push({ kind: 'node', id: node.ObjectId, property, label: node.Name || `Node ${node.ObjectId}`, authoredName: !!node.Name, channel: labels[property] });
  const supported = new Set(targets.map(animationTrackId));
  for (const node of nodes) for (const [property, value] of Object.entries(node)) {
    const target = { kind: 'node', id: node.ObjectId, property, label: node.Name || `Node ${node.ObjectId}`, authoredName: !!node.Name, channel: property, readOnly: true };
    if (isTrack(value) && !supported.has(animationTrackId(target))) targets.push(target);
  }
  // Material, texture and camera controllers are context only in the first batch.
  const addContext = (owner, path, label) => {
    for (const [property, value] of Object.entries(owner || {})) if (isTrack(value)) targets.push({ kind: 'context', id: path, path, property, label, channel: property, readOnly: true });
  };
  (model.Materials || []).forEach((material, id) => (material.Layers || []).forEach((layer, i) => addContext(layer, ['Materials', id, 'Layers', i], `Material ${id + 1} · Layer ${i + 1}`)));
  (model.TextureAnims || []).forEach((owner, id) => addContext(owner, ['TextureAnims', id], `Texture animation ${id + 1}`));
  (model.Cameras || []).forEach((owner, id) => addContext(owner, ['Cameras', id], `Camera ${id + 1}`));
  return targets.map(target => ({ ...target, trackId: animationTrackId(target), globalSeqId: globalId(timelineReadTrack(model, target)) }));
}

export function timelineReadTrack(model, target) {
  if (target.kind === 'context') return target.path.reduce((value, part) => value?.[part], model)?.[target.property];
  if (target.kind === 'node' && (transforms.includes(target.property) || target.readOnly)) {
    const indexed = model.Nodes?.[target.id];
    const owner = indexed?.ObjectId === target.id ? indexed : allNodes(model).find(node => node.ObjectId === target.id);
    if (!owner) throw new Error('The selected animation object no longer exists.');
    return owner[target.property] ?? defaults(target.property);
  }
  return readAnimationTrack(model, target);
}

export function timelineDomain(model, sequenceIndex = -1, globalSeqId = null) {
  if (globalSeqId !== null) {
    const end = model.GlobalSequences?.[globalSeqId];
    if (!Number.isInteger(globalSeqId) || globalSeqId < 0 || !Number.isInteger(end) || end <= 0) throw new Error('Select an existing global sequence with a positive duration.');
    return { kind: 'global', globalSeqId, start: 0, end, label: `Global ${globalSeqId + 1} · ${end} ms · shared across animations` };
  }
  const sequence = model.Sequences?.[sequenceIndex], interval = sequence?.Interval;
  if (!interval || !Number.isInteger(interval[0]) || !Number.isInteger(interval[1]) || interval[1] < interval[0]) throw new Error('Select an animation to edit local keyframes.');
  return { kind: 'local', globalSeqId: null, sequenceIndex, start: interval[0], end: interval[1], label: sequence.Name };
}

export function timelineScope(model, { scope = 'controller', nodeIds = [], geosetIds = [], activeController = 'rotate', activeTarget = null, domain = null, tracks = null } = {}) {
  const property = ({ move: 'Translation', rotate: 'Rotation', scale: 'Scaling' })[activeController] || activeController;
  const nodes = new Set(nodeIds), geosets = new Set(geosetIds);
  return (tracks || timelineTracks(model)).filter(target => {
    if (domain && target.globalSeqId !== domain.globalSeqId) return false;
    if (scope === 'all') return true;
    if (scope === 'controller' && activeTarget) return target.trackId === activeTarget;
    const selected = target.kind === 'node' ? nodes.has(target.id) : target.kind === 'geoset' && geosets.has(target.id);
    return selected && (scope === 'selected' || target.property === property);
  });
}

function checkedTargets(model, targets, domain) {
  if (!targets?.length) throw new Error('Select an object or choose All supported tracks explicitly.');
  const supported = new Map(timelineTracks(model).filter(target => !target.readOnly).map(target => [target.trackId, target]));
  return targets.map(target => {
    const current = supported.get(animationTrackId(target));
    if (!current) throw new Error('This track is read-only or is no longer available.');
    if (!domain || current.globalSeqId !== domain.globalSeqId) throw new Error('Open the track’s own local or global timeline before editing it.');
    timelineReadTrack(model, current); // Validate duplicate geoset owners before any write.
    return current;
  });
}
function checkedTime(time, domain) {
  if (!Number.isInteger(time) || time < domain.start || time > domain.end) throw new Error(`Keyframe time must be a whole number inside ${domain.start}–${domain.end} ms.`);
  return time;
}
function checkedVector(value, property) {
  const values = vector(value), expected = vector(defaults(property)).length;
  if (values.length !== expected || values.some(number => !Number.isFinite(number) || Math.abs(number) > 3.4028234663852886e38)) throw new Error(`Enter ${expected} finite values for ${labels[property] || property}.`);
  if (!transforms.includes(property) && values.some(number => number < 0 || number > 1)) throw new Error('Visibility, alpha and RGB values must be between 0 and 1.');
  if (property === 'Rotation') {
    const length = Math.hypot(...values);
    if (length < 1e-12) throw new Error('Rotation quaternion must not be zero.');
    return new Float32Array(values.map(number => number / length));
  }
  return new Float32Array(values);
}
function makeKey(time, value, track, property) {
  const key = { Frame: time, Vector: new Float32Array(value) };
  if (track.LineType >= 2) {
    key.InTan = track.LineType === 2 && property !== 'Rotation' ? new Float32Array(value.length) : new Float32Array(value);
    key.OutTan = new Float32Array(key.InTan);
  }
  return key;
}
function visibleSource(model, target) {
  if (target.kind === 'geoset' && target.property === 'Color') {
    const owner = model.GeosetAnims?.find(item => item.GeosetId === target.id);
    if (!(owner?.Flags & 2)) return [1, 1, 1];
  }
  return timelineReadTrack(model, target);
}

/** Global time is deliberately sampled in 0..duration, including the stored endpoint. */
export function timelineSample(model, target, time, domain) {
  checkedTime(time, domain);
  let source = visibleSource(model, target);
  if (isTrack(source) && domain.kind === 'global') source = { ...source, GlobalSeqId: null };
  return vector(sampleTrack(source, time, { interval: [domain.start, domain.end], fallback: defaults(target.property), quaternion: target.property === 'Rotation' }));
}
export function timelineTrackState(model, target, time, domain) {
  const track = timelineReadTrack(model, target);
  if (track?.Keys?.some(key => key.Frame === time)) return 'Key exists';
  return track?.Keys?.some(key => key.Frame >= domain.start && key.Frame <= domain.end) ? 'Interpolated' : 'Static/default';
}
function editableTrack(model, target, domain, template) {
  const source = visibleSource(model, target);
  if (isTrack(source)) return clone(source);
  const track = template ? { ...clone(template), Keys: [] } : { LineType: ['Alpha', 'Visibility'].includes(target.property) ? 0 : 1, GlobalSeqId: domain.globalSeqId, Keys: [] };
  // Preserve authored non-default static values in other animations when converting.
  // Default tracks stay sparse; no implicit start/end keys are inserted in this interval.
  const old = vector(source), fallback = vector(defaults(target.property));
  if (domain.kind === 'local' && old.some((value, index) => value !== fallback[index])) {
    for (const sequence of model.Sequences || []) if (sequence.Interval && (sequence.Interval[0] < domain.start || sequence.Interval[0] > domain.end)) track.Keys.push(makeKey(sequence.Interval[0], old, track, target.property));
  }
  return track;
}
function commit(model, prepared) {
  for (const { target, track, enableColor = true } of prepared) {
    let owner;
    if (target.kind === 'node') owner = allNodes(model).find(node => node.ObjectId === target.id);
    else {
      owner = model.GeosetAnims?.find(item => item.GeosetId === target.id);
      if (!owner) { owner = createVisibilityGeosetAnimation(target.id); (model.GeosetAnims ||= []).push(owner); }
      if (target.property === 'Color' && enableColor) owner.Flags = (owner.Flags || 0) | 2;
    }
    track.Keys.sort((a, b) => a.Frame - b.Frame);
    owner[target.property] = track;
  }
  if (prepared.some(item => item.target.kind === 'geoset') && model.Info) model.Info.NumGeosetAnims = model.GeosetAnims.length;
  return prepared.reduce((sum, item) => sum + (item.count ?? 1), 0);
}
function selectionSet(selection) { return new Set((selection || []).map(item => typeof item === 'string' ? item : timelineKeyId(item.trackId, item.frame))); }
export function timelineKeys(model, targets, domain) {
  return targets.flatMap(target => (timelineReadTrack(model, target)?.Keys || []).filter(key => key.Frame >= domain.start && key.Frame <= domain.end).map(key => ({ trackId: animationTrackId(target), frame: key.Frame })));
}
export function selectTimelineRange(model, targets, domain, from, to) {
  checkedTime(from, domain); checkedTime(to, domain);
  const low = Math.min(from, to), high = Math.max(from, to);
  return timelineKeys(model, targets.filter(target => !target.readOnly), domain).filter(key => key.frame >= low && key.frame <= high);
}
function selectedKeys(model, targets, selection, domain) {
  const ids = selectionSet(selection);
  return checkedTargets(model, targets, domain).map(target => ({ target, keys: (timelineReadTrack(model, target)?.Keys || []).filter(key => key.Frame >= domain.start && key.Frame <= domain.end && ids.has(timelineKeyId(target, key.Frame))) })).filter(item => item.keys.length);
}

export function copyTimelineKeys(model, targets, selection, domain, origin) {
  const entries = selectedKeys(model, targets, selection, domain);
  const times = entries.flatMap(entry => entry.keys.map(key => key.Frame));
  if (origin !== undefined) checkedTime(origin, domain);
  return { kind: 'keys', domain: clone(domain), origin: origin ?? (times.length ? Math.min(...times) : domain.start), count: times.length,
    entries: entries.map(({ target, keys }) => ({ target: clone(target), track: { ...clone(timelineReadTrack(model, target)), Keys: clone(keys) } })) };
}
export function copyTimelinePose(model, targets, time, domain) {
  return { kind: 'pose', domain: clone(domain), origin: checkedTime(time, domain), entries: checkedTargets(model, targets, domain).map(target => ({ target: clone(target), value: timelineSample(model, target, time, domain) })) };
}
function collision(track, key, policy) {
  if (!['reject', 'replace', 'merge'].includes(policy)) throw new Error('Choose Reject, Replace or Merge for time collisions.');
  const index = track.Keys.findIndex(item => item.Frame === key.Frame);
  if (index < 0) { track.Keys.push(key); return true; }
  if (policy === 'reject') throw new Error(`A key already exists at ${key.Frame} ms. Choose Replace to overwrite or Merge to keep existing keys.`);
  if (policy === 'merge') return false;
  track.Keys[index] = key; return true;
}
function clipboardEntries(model, targets, clipboard, domain, kind) {
  const chosen = new Map(checkedTargets(model, targets, domain).map(target => [target.trackId, target]));
  if (clipboard?.kind !== kind) throw new Error(kind === 'keys' ? 'Copy stored keys first.' : 'Copy a sampled pose first.');
  if (clipboard.domain.globalSeqId !== domain.globalSeqId) throw new Error('Clipboard timing differs from this local/global timeline. Open the matching timeline.');
  const entries = clipboard.entries.filter(entry => chosen.has(animationTrackId(entry.target))).map(entry => ({ ...entry, target: chosen.get(animationTrackId(entry.target)) }));
  if (!entries.length) throw new Error('The clipboard has no matching tracks in the visible edit scope.');
  return entries;
}
export function pasteTimelineKeys(model, targets, clipboard, time, domain, policy = 'reject') {
  checkedTime(time, domain);
  const prepared = clipboardEntries(model, targets, clipboard, domain, 'keys').map(entry => {
    const original = timelineReadTrack(model, entry.target);
    if (isTrack(original) && (original.LineType !== entry.track.LineType || globalId(original) !== globalId(entry.track))) throw new Error('Track interpolation or global association changed since copying. Restore the matching track metadata before pasting.');
    const track = editableTrack(model, entry.target, domain, entry.track); let count = 0;
    for (const source of entry.track.Keys) {
      const key = clone(source); key.Frame = checkedTime(time + source.Frame - clipboard.origin, domain);
      if (collision(track, key, policy)) count++;
    }
    return { target: entry.target, track, count };
  });
  return commit(model, prepared);
}
export function setTimelineKeys(model, targets, time, domain, values = null) {
  checkedTime(time, domain);
  const prepared = checkedTargets(model, targets, domain).map(target => {
    const track = editableTrack(model, target, domain), value = checkedVector(values?.[target.trackId] ?? timelineSample(model, target, time, domain), target.property);
    const existing = track.Keys.find(key => key.Frame === time);
    const key = existing ? { ...existing, Vector: value } : makeKey(time, value, track, target.property);
    collision(track, key, 'replace'); return { target, track };
  });
  return commit(model, prepared);
}
export function pasteTimelinePose(model, targets, clipboard, time, domain, policy = 'reject') {
  checkedTime(time, domain);
  const entries = clipboardEntries(model, targets, clipboard, domain, 'pose');
  const prepared = entries.map(({ target, value }) => {
    const track = editableTrack(model, target, domain), old = track.Keys.find(key => key.Frame === time), next = checkedVector(value, target.property);
    const key = old ? { ...old, Vector: next } : makeKey(time, next, track, target.property);
    return { target, track, count: collision(track, key, policy) ? 1 : 0 };
  });
  return commit(model, prepared);
}
export function clearTimelineKeys(model, targets, selection, domain) {
  return commit(model, selectedKeys(model, targets, selection, domain).map(({ target, keys }) => {
    const removed = new Set(keys.map(key => key.Frame)), track = clone(timelineReadTrack(model, target));
    track.Keys = track.Keys.filter(key => !removed.has(key.Frame));
    return { target, track, count: keys.length, enableColor: false }; // Keep interpolation and global metadata even when empty.
  }));
}
export function moveTimelineKeys(model, targets, selection, offset, domain, policy = 'reject') {
  if (!Number.isInteger(offset)) throw new Error('The time offset must be a whole number of milliseconds.');
  if (!offset) return 0;
  if (policy === 'merge') throw new Error('Moving keys supports Reject or Replace; Merge is available when copying keys.');
  const prepared = selectedKeys(model, targets, selection, domain).map(({ target, keys }) => {
    const moved = new Set(keys.map(key => key.Frame)), track = clone(timelineReadTrack(model, target));
    track.Keys = track.Keys.filter(key => !moved.has(key.Frame));
    for (const source of keys) {
      const key = clone(source); key.Frame = checkedTime(source.Frame + offset, domain); collision(track, key, policy);
    }
    return { target, track, count: keys.length, enableColor: false };
  });
  return commit(model, prepared);
}
export function duplicateTimelineKeys(model, targets, selection, offset, domain, policy = 'reject') {
  const copied = copyTimelineKeys(model, targets, selection, domain);
  if (!copied.count) throw new Error('Select stored keys to duplicate.');
  return pasteTimelineKeys(model, targets, copied, checkedTime(copied.origin + offset, domain), domain, policy);
}
export function timelineMissingEndpoints(model, targets, domain) {
  return targets.filter(target => !target.readOnly).map(target => {
    const keys = timelineReadTrack(model, target)?.Keys || [];
    return { target, start: !keys.some(key => key.Frame === domain.start), end: !keys.some(key => key.Frame === domain.end) };
  }).filter(item => item.start || item.end);
}
export function setTimelineBoundary(model, targets, domain, action) {
  if (!['start', 'end', 'match'].includes(action)) throw new Error('Choose a start, end or loop endpoint action.');
  const at = action === 'start' ? domain.start : domain.end;
  const values = action === 'match' ? Object.fromEntries(checkedTargets(model, targets, domain).map(target => [target.trackId, timelineSample(model, target, domain.start, domain)])) : null;
  return setTimelineKeys(model, targets, at, domain, values);
}
