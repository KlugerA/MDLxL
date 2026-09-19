import { animationTrackId } from './animation-tracks.js';
import { timelineDomain, timelineTracks, timelineReadTrack, pasteTimelineKeys, pasteTimelinePose } from './keyframe-timeline.js';

const transforms = { move: 'Translation', rotate: 'Rotation', scale: 'Scaling' };
const appearance = new Set(['Alpha', 'Color', 'AmbColor', 'Visibility']);
const globalId = track => Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0 ? track.GlobalSeqId : null;

/** Preserve visible/copyable tracks while excluding locked rig edit channels. */
export function unrestrictedTimelineTargets(targets, restrictions = {}) {
  const properties = new Set(Object.values(transforms));
  return targets.filter(target => target.kind !== 'node' || !properties.has(target.property) || !(restrictions[target.property.toLowerCase()] || restrictions[target.property]));
}

/** The classic All line covers authored local time, including context channels. */
export function classicTimelineDomain(model, sequenceIndex = -1, globalSeqId = null) {
  if (globalSeqId !== null || sequenceIndex !== -1) return timelineDomain(model, sequenceIndex, globalSeqId);
  let end = null;
  const include = frame => { if (Number.isInteger(frame) && frame >= 0) end = Math.max(end ?? 0, frame); };
  for (const sequence of model.Sequences || []) for (const frame of sequence.Interval || []) include(frame);
  // Avoid traversing large vertex arrays and the repeated Nodes/Bones references.
  const visited = new WeakSet();
  function visit(value) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value.Keys)) {
      if (globalId(value) === null) for (const key of value.Keys) include(key.Frame);
      return;
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(model);
  return { kind: 'local', globalSeqId: null, sequenceIndex: -1, start: 0, end: end ?? 1000, label: 'All' };
}

/** Highlight restricts controller ownership; turning it off exposes authored
 * controllers without creating a key on every static/default model property. */
export function classicTimelineTargets(model, { tracks = null, nodeIds = [], geosetIds = [], activeController = 'rotate', highlightKeyframes = true, domain = null } = {}) {
  const ownDomain = domain || classicTimelineDomain(model), available = timelineTracks(model);
  const editable = new Map(available.filter(target => !target.readOnly).map(target => [target.trackId, target]));
  const nodes = new Set(nodeIds), geosets = new Set(geosetIds), seen = new Set(), result = [];
  for (const candidate of tracks || available) {
    const target = editable.get(animationTrackId(candidate));
    if (!target || candidate.readOnly || seen.has(target.trackId) || target.globalSeqId !== ownDomain.globalSeqId) continue;
    let included;
    if (!highlightKeyframes) included = !!timelineReadTrack(model, target)?.Keys?.length;
    else if (activeController === 'animations') included = target.kind === 'geoset' ? geosets.has(target.id) && ['Alpha', 'Color'].includes(target.property) : target.kind === 'node' && nodes.has(target.id) && appearance.has(target.property);
    else included = target.kind === 'node' && nodes.has(target.id) && target.property === transforms[activeController];
    if (included) { seen.add(target.trackId); result.push(target); }
  }
  return result;
}

/** Ctrl+V preserves the clipboard's type; both classic paste actions replace
 * matching destination timestamps through the same atomic core operations. */
export function classicPaste(model, targets, clipboard, time, domain) {
  if (clipboard?.kind === 'keys') return pasteTimelineKeys(model, targets, clipboard, time, domain, 'replace');
  if (clipboard?.kind === 'pose') return pasteTimelinePose(model, targets, clipboard, time, domain, 'replace');
  throw new Error('Copy keys or a pose before pasting.');
}
