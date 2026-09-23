import { Euler, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from './animation.js';
import { movementProperties, sampleMovement } from './movement.js';
import { animationTrackId } from './animation-tracks.js';
import { timelineDomain, setTimelineKeys } from './keyframe-timeline.js';

export const motionChannels = Object.values(movementProperties);
const defaults = { Translation: [0, 0, 0], Rotation: [0, 0, 0, 1], Scaling: [1, 1, 1] };
const label = node => node.Name || `Node ${node.ObjectId}`;
const round = value => Number(value.toFixed(2));
const globalTrack = track => Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0;
export const rotationDistance = (a, b) => new Quaternion().fromArray(a).normalize().angleTo(new Quaternion().fromArray(b).normalize()) * 180 / Math.PI;
const distance = (a, b, property) => property === 'Rotation' ? rotationDistance(a, b) : Math.hypot(...a.map((v, i) => v - b[i]));

export function motionParentChain(model, id) {
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), chain = [], seen = new Set();
  while (byId.has(id) && !seen.has(id)) { seen.add(id); const node = byId.get(id); chain.push(node); id = node.Parent; }
  return chain;
}

/** Only animation inputs cross the worker boundary; never clone mesh/texture data. */
export function motionSnapshot(model) {
  return {
    Nodes: allNodes(model).map(node => ({ ObjectId: node.ObjectId, Name: node.Name, Parent: node.Parent, Flags: node.Flags,
      PivotPoint: node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0],
      ...Object.fromEntries(motionChannels.filter(property => node[property] !== undefined).map(property => [property, node[property]])) })),
    Sequences: model.Sequences, GlobalSequences: model.GlobalSequences,
    Info: { BoundsRadius: model.Info?.BoundsRadius },
  };
}

export function motionPose(model, id, property, time, sequenceIndex) {
  const node = allNodes(model).find(node => node.ObjectId === id), interval = model.Sequences?.[sequenceIndex]?.Interval;
  if (!node || !interval || !motionChannels.includes(property)) return null;
  const frame = Math.round(Math.max(interval[0], Math.min(interval[1], time))), track = node[property];
  const shared = globalTrack(track), duration = shared ? model.GlobalSequences?.[track.GlobalSeqId] : null;
  const keyTime = duration > 0 ? frame % duration : frame;
  const keys = (track?.Keys || []).filter(key => shared || key.Frame >= interval[0] && key.Frame <= interval[1]);
  const value = sampleMovement(model, node, property, frame, sequenceIndex);
  const degrees = property === 'Rotation' ? new Euler().setFromQuaternion(new Quaternion().fromArray(value).normalize(), 'XYZ').toArray().slice(0, 3).map(v => v * 180 / Math.PI) : value;
  return { node, property, frame, keyTime, shared, keys, value, display: degrees, lineType: track?.LineType ?? 1,
    key: keys.find(key => key.Frame === keyTime), previous: keys.findLast(key => key.Frame < keyTime), next: keys.find(key => key.Frame > keyTime) };
}

/** Absolute local values, through the same sparse timeline writer and document transaction as other keys. */
export function setMotionPose(model, id, property, time, sequenceIndex, display) {
  const pose = motionPose(model, id, property, time, sequenceIndex);
  if (!pose || pose.shared) throw Error('Select a local animation track to edit its pose here. Shared global tracks are inspection only.');
  if (display.length !== 3 || display.some(value => !Number.isFinite(value))) throw Error('Enter three finite values.');
  if (property === 'Scaling' && display.some(value => Math.abs(value) < 1e-6)) throw Error('Scale must not be zero.');
  const value = property === 'Rotation' ? new Quaternion().setFromEuler(new Euler(...display.map(v => v * Math.PI / 180), 'XYZ')).toArray() : display;
  const target = { kind: 'node', id, property }, trackId = animationTrackId(target);
  return setTimelineKeys(model, [target], pose.frame, timelineDomain(model, sequenceIndex), { [trackId]: value });
}

function support(track, interval, start, end, property, globals) {
  if (!track?.Keys) return track ?? defaults[property];
  const shared = globalTrack(track);
  const keys = track.Keys.filter(key => shared || key.Frame >= interval[0] && key.Frame <= interval[1]);
  let first = keys.findIndex(key => key.Frame >= start), last = keys.findLastIndex(key => key.Frame <= end);
  if (first < 0) first = keys.length;
  const from = keys[first]?.Frame === start ? first : Math.max(0, first - 1);
  const to = keys[last]?.Frame === end ? last + 1 : Math.min(keys.length, last + 2);
  const relevant = shared ? keys : keys.slice(from, to);
  return { LineType: track.LineType, GlobalSeqId: track.GlobalSeqId ?? null, duration: shared ? globals?.[track.GlobalSeqId] : undefined, Keys: relevant };
}

/** Decision signatures use only contributing tracks/intervals, not a whole-model revision. */
export function motionEvidence(model, finding, sequenceIndex) {
  const interval = model.Sequences[sequenceIndex].Interval;
  const chain = motionParentChain(model, finding.nodeId);
  return { version: 1, kind: finding.kind, property: finding.property, space: finding.space, animation: model.Sequences[sequenceIndex].Name || '', interval: Array.from(interval),
    start: finding.start, end: finding.end, nodes: chain.map((node, i) => ({ id: node.ObjectId, parent: node.Parent, flags: node.Flags || 0,
      pivot: node.PivotPoint || model.PivotPoints?.[node.ObjectId],
      tracks: Object.fromEntries((finding.space === 'local' && i === 0 ? [finding.property] : motionChannels)
        .map(property => [property, support(node[property], interval, finding.start, finding.end, property, model.GlobalSequences)])) })) };
}

function modelSize(model, nodes) {
  const extent = Math.max(1, ...nodes.map(node => Math.hypot(...(node.PivotPoint || [0, 0, 0]))));
  return Math.max(1, model.Info?.BoundsRadius || extent);
}

/** Heuristics report candidates, never repair data. All interpolation/hierarchy comes from animation.js. */
export function scanMotion(model, { sequenceIndex = 0, nodeIds = null, maxWorldSamples = 24000, maxFindings = 500, onProgress = () => {} } = {}) {
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  if (!interval) throw Error('Choose an animation before scanning motion.');
  const nodes = allNodes(model), scope = nodeIds ? new Set(nodeIds.flatMap(id => motionParentChain(model, id).map(n => n.ObjectId))) : null;
  const selected = nodes.filter(node => !scope || scope.has(node.ObjectId)), size = modelSize(model, nodes);
  // Default warnings require a major change in a short *millisecond* interval,
  // or strong structural evidence of one stray pose in an otherwise held track.
  // A speed ratio alone is not evidence: starting/stopping and attacks do that.
  const findings = [], notes = new Set(), minimum = property => property === 'Rotation' ? 60 : Math.max(.01, size * .2);
  const snapMinimum = property => property === 'Rotation' ? 90 : Math.max(.01, size * .25);
  let localIntervals = 0, worldSamples = 0, capped = false;
  const add = (node, property, kind, space, start, end, time, explanation, evidence, keyTimes) => {
    if (findings.length >= maxFindings) { capped = true; return; }
    const finding = { nodeId: node.ObjectId, nodeName: label(node), property, kind, space, start, end, time, explanation, evidence, keyTimes,
      trackId: animationTrackId({ kind: 'node', id: node.ObjectId, property }),
      chain: motionParentChain(model, node.ObjectId).map(n => ({ id: n.ObjectId, name: label(n) })) };
    finding.state = motionEvidence(model, finding, sequenceIndex);
    findings.push(finding);
  };
  for (const node of selected) for (const property of ['Rotation', 'Translation']) {
    const track = node[property];
    if (!track?.Keys) continue;
    if (globalTrack(track)) { notes.add('Shared global tracks contribute to model-space sampling; their local key patterns are not classified.'); continue; }
    const keys = track.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]);
    const unit = property === 'Rotation' ? '°' : ' model units', min = minimum(property), tolerance = property === 'Rotation' ? .25 : Math.max(.0001, size * .001);
    const sample = time => Array.from(sampleTrack(track, time, { interval, quaternion: property === 'Rotation', fallback: defaults[property] }));
    const segments = keys.slice(1).map((key, i) => {
      const left = keys[i], dt = key.Frame - left.Frame;
      const poses = Array.from({ length: 5 }, (_, step) => sample(left.Frame + dt * step / 4));
      const travel = poses.slice(1).reduce((sum, pose, j) => sum + distance(poses[j], pose, property), 0);
      localIntervals++;
      return { dt, change: distance(poses[0], poses[4], property), travel, speed: dt > 0 ? travel * 1000 / dt : 0, poses };
    });
    let holdStart = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i], left = keys[i], right = keys[i + 1];
      if (!(segment.dt > 0)) continue;
      if (i > 0 && (segments[i - 1].travel > tolerance || distance(segments[holdStart].poses[0], segment.poses[0], property) > tolerance)) holdStart = i;
      const measurement = `${round(segment.change)}${unit} from ${left.Frame} to ${right.Frame} ms (${segment.dt} ms; ${round(segment.speed)}${unit}/s sampled average).`;
      if (track.LineType === 0 && segment.change >= min) {
        add(node, property, 'step', 'local', left.Frame, right.Frame, right.Frame,
          `${label(node)} switches pose at ${right.Frame} ms. This track uses stepped interpolation: it holds the earlier value until the next key. This may be an intentional snap.`, measurement, [left.Frame, right.Frame]);
        continue;
      }
      const held = left.Frame - (keys[holdStart]?.Frame ?? left.Frame);
      const compressed = i - holdStart >= 2 && held >= Math.max(400, segment.dt * 6) && segment.change >= min && segment.dt <= 80;
      if (compressed) add(node, property, 'holding-keys', 'local', keys[holdStart].Frame, right.Frame, left.Frame,
        `${label(node)} changes pose sharply after a hold. ${i - holdStart} intermediate keys repeat almost the same pose from ${keys[holdStart].Frame} to ${left.Frame} ms. They may compress the transition into the final ${segment.dt} ms. Interpolation still operates between keys. Inspect or manually remove unwanted intermediate keys to spread the movement; a deliberate hold is valid.`, measurement, keys.slice(holdStart, i + 2).map(k => k.Frame));
      const adjacent = [segments[i - 1]?.speed, segments[i + 1]?.speed].filter(Number.isFinite);
      const baseline = adjacent.length ? Math.max(...adjacent, min) : min;
      if (!compressed && segment.change >= snapMinimum(property) && segment.dt <= 50 && segment.speed >= baseline * 8)
        add(node, property, 'abrupt-change', 'local', left.Frame, right.Frame, right.Frame,
          `${label(node)} moves much faster in this short interval than in neighboring intervals. Closely spaced poses may explain a snap; intent is uncertain.`, measurement, [left.Frame, right.Frame]);
      const returns = i + 1 < segments.length && distance(segment.poses[0], segments[i + 1].poses[4], property) <= tolerance;
      const isolated = i > 0 && i + 2 < segments.length && returns
        && segments[i - 1].travel <= tolerance && segments[i + 2].travel <= tolerance
        && distance(segments[i - 1].poses[0], segments[i + 2].poses[4], property) <= tolerance;
      const spikeMinimum = isolated ? (property === 'Rotation' ? 6 : Math.max(.01, size * .04)) : snapMinimum(property);
      if (returns && segment.change >= spikeMinimum && segments[i + 1].change >= spikeMinimum && segment.dt + segments[i + 1].dt <= (isolated ? 300 : 100))
        add(node, property, 'pose-spike', 'local', isolated ? keys[i - 1].Frame : left.Frame, isolated ? keys[i + 3].Frame : keys[i + 2].Frame, right.Frame,
          `${label(node)} briefly leaves its pose at ${right.Frame} ms and returns near it by ${keys[i + 2].Frame} ms. ${isolated ? 'The surrounding intervals hold the same pose, making this single different key stand out. ' : ''}Inspect the middle key; this can also be an intentional impact.`, measurement, keys.slice(isolated ? i - 1 : i, isolated ? i + 4 : i + 3).map(k => k.Frame));
      if (track.LineType >= 2) {
        const overshoot = property === 'Rotation'
          ? Math.max(...segment.poses.map(p => (distance(segment.poses[0], p, property) + distance(p, segment.poses[4], property) - segment.change) / 2))
          : Math.max(0, ...segment.poses.flatMap(p => p.map((v, j) => Math.max(Math.min(segment.poses[0][j], segment.poses[4][j]) - v, v - Math.max(segment.poses[0][j], segment.poses[4][j])))));
        if (overshoot >= min && segment.dt <= 100) add(node, property, 'curve-overshoot', 'local', left.Frame, right.Frame, Math.round((left.Frame + right.Frame) / 2),
          `${label(node)} travels beyond the endpoint poses between ${left.Frame} and ${right.Frame} ms. The ${track.LineType === 2 ? 'Hermite' : 'Bezier'} curve controls may explain this extra movement. Inspect the curve and replay it.`, `Sampled excess: ${round(overshoot)}${unit}. ${measurement}`, [left.Frame, right.Frame]);
      }
    }
  }
  // Model-space pivots and orientations use the same hierarchy evaluator as editing.
  // An inherited observation is never labelled as a defective child track.
  const cache = new Map();
  const matricesAt = time => {
    if (cache.has(time)) return cache.get(time);
    if (worldSamples >= maxWorldSamples) return null;
    worldSamples++;
    const matrices = sampleNodeMatrices(model, time, sequenceIndex, time);
    if (cache.size >= 128) cache.delete(cache.keys().next().value);
    cache.set(time, matrices); return matrices;
  };
  for (let index = 0; index < selected.length; index++) {
    const node = selected[index], chain = motionParentChain(model, node.ObjectId);
    if (chain.some(n => n.Flags & 120)) notes.add('Camera-facing billboard rotations are not included in model-space diagnostics.');
    const times = new Set(Array.from(interval));
    for (const ancestor of chain) for (const property of motionChannels) {
      const track = ancestor[property];
      for (const key of track?.Keys || []) {
        if (!globalTrack(track)) {
          if (key.Frame >= interval[0] && key.Frame <= interval[1]) {
            times.add(key.Frame);
            if (track.LineType === 0 && key.Frame > interval[0]) times.add(Math.max(interval[0], key.Frame - .01));
          }
        }
        else {
          const duration = model.GlobalSequences?.[track.GlobalSeqId];
          if (!(duration > 0)) continue;
          for (let t = key.Frame + Math.ceil((interval[0] - key.Frame) / duration) * duration, count = 0; t <= interval[1] && count < 4000; t += duration, count++) times.add(t);
          if ((interval[1] - interval[0]) / duration > 4000) notes.add('Very short global loops were sampled with a 4000-cycle limit.');
          // Global wrap is a real potential discontinuity, even without an endpoint key.
          for (let t = Math.ceil(interval[0] / duration) * duration, count = 0; t <= interval[1] && count < 4000; t += duration, count++) { times.add(t); if (t > interval[0]) times.add(t - Math.min(1, duration / 100)); }
        }
      }
    }
    const sorted = [...times].sort((a, b) => a - b), segments = [];
    for (let i = 1; i < sorted.length; i++) {
      const start = sorted[i - 1], end = sorted[i], poses = [];
      for (let step = 0; step <= 4; step++) {
        const matrices = matricesAt(start + (end - start) * step / 4);
        if (!matrices) break;
        const matrix = matrices.get(node.ObjectId), rotation = new Quaternion();
        matrix.decompose(new Vector3(), rotation, new Vector3());
        poses.push({ Translation: new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]).applyMatrix4(matrix).toArray(), Rotation: rotation.toArray() });
      }
      if (poses.length < 5) { notes.add(`Model-space sampling stopped at ${maxWorldSamples} evaluations. Focus on a selected bone to inspect more detail.`); break; }
      segments.push({ start, end, poses });
    }
    for (const property of ['Translation', 'Rotation']) {
      if (property === 'Rotation' && chain.some(n => n.Flags & 120)) continue;
      const min = minimum(property), unit = property === 'Rotation' ? '°' : ' model units';
      const stats = segments.map(s => {
        const travel = s.poses.slice(1).reduce((sum, p, i) => sum + distance(s.poses[i][property], p[property], property), 0);
        return { ...s, travel, speed: travel * 1000 / (s.end - s.start) };
      });
      stats.forEach((s, i) => {
        const neighbors = [stats[i - 1]?.speed, stats[i + 1]?.speed].filter(Number.isFinite);
        if (s.travel < snapMinimum(property) || s.end - s.start > 50 || s.speed < Math.max(min, ...neighbors) * 8) return;
        const own = findings.some(f => f.space === 'local' && f.nodeId === node.ObjectId && f.property === property && f.start <= s.end && f.end >= s.start);
        if (own) return;
        const parentEvidence = findings.filter(f => f.space === 'local' && chain.slice(1).some(n => n.ObjectId === f.nodeId) && f.start < s.end && f.end >= s.end);
        const candidates = [...new Set(parentEvidence.map(f => f.nodeName))];
        const localChange = distance(sampleMovement(model, node, property, s.start, sequenceIndex), sampleMovement(model, node, property, s.end, sequenceIndex), property);
        add(node, property, 'model-space-change', 'model', s.start, s.end, s.end,
          `${label(node)} moves sharply in model space from ${s.start} to ${s.end} ms. ${localChange < min / 10 ? 'Its own channel changes very little; inherited motion can move it.' : 'Local and inherited movement combine here.'} ${candidates.length ? `Overlapping local warnings on ${candidates.join(', ')} are clues to inspect, not proof that one parent key caused this motion.` : 'The responsible key is uncertain. Inspect the parent chain.'}`,
          `Sampled travel: ${round(s.travel)}${unit} in ${round(s.end - s.start)} ms (${round(s.speed)}${unit}/s). Own channel endpoint change: ${round(localChange)}${unit}.`, [s.start, s.end]);
      });
    }
    onProgress({ completed: index + 1, total: selected.length });
    if (worldSamples >= maxWorldSamples) {
      if (index + 1 < selected.length) notes.add(`Model-space sampling stopped at ${maxWorldSamples} evaluations. Focus on a selected bone to inspect more detail.`);
      break;
    }
  }
  if (capped) notes.add(`Results limited to ${maxFindings} hints. Focus on a selected bone for a smaller scan.`);
  return { findings: findings.sort((a, b) => a.time - b.time || a.nodeId - b.nodeId || a.kind.localeCompare(b.kind)), notes: [...notes], stats: { localIntervals, worldSamples, nodes: selected.length } };
}
