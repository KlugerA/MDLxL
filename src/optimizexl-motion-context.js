import { Quaternion } from 'three';
import { allNodes, sampleTrack, sampleGeosetAnimation } from './animation.js';
import { scanIrregularMotion, applyMotionCorrection } from './optimizexl-motion.js';
import { scanSuspiciousSnaps } from './optimizexl-snaps.js';

const properties = ['Translation', 'Rotation', 'Scaling'];
const quantile = (values, q) => values.length ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)] : 0;
const length = a => Math.hypot(...a);
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const keyValue = k => Array.from(k.Vector);
const distance = (a, b, property) => property === 'Rotation'
  ? new Quaternion().fromArray(a).normalize().angleTo(new Quaternion().fromArray(b).normalize()) * 180 / Math.PI
  : length(subtract(a, b));
const blend = (a, b, t, property) => property === 'Rotation'
  ? new Quaternion().fromArray(a).normalize().slerp(new Quaternion().fromArray(b).normalize(), t).toArray()
  : a.map((v, i) => v + (b[i] - v) * t);
const signature = r => JSON.stringify([r.track.LineType, r.track.GlobalSeqId ?? null, r.keys.map(k => [k.Frame, ...['Vector', 'InTan', 'OutTan'].map(p => k[p] && Array.from(k[p]))])]);

// Vertex influence and hierarchy distinguish a body from a separate mechanism.
// Geoset count alone is insufficient: a complete character may be one geoset.
function geometryContext(model, nodes) {
  const byId = new Map(nodes.map(n => [n.ObjectId, n])), influence = new Map(), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  model.Geosets.forEach((g, geoset) => {
    const groups = new Map();
    for (let i = 0; i < g.Vertices.length / 3; i++) {
      groups.set(g.VertexGroup[i], (groups.get(g.VertexGroup[i]) || 0) + 1);
      for (let axis = 0; axis < 3; axis++) { lo[axis] = Math.min(lo[axis], g.Vertices[i * 3 + axis]); hi[axis] = Math.max(hi[axis], g.Vertices[i * 3 + axis]); }
    }
    for (const [group, count] of groups) {
      const ids = g.Groups[group] || [];
      for (const id of ids) for (const [p, property] of properties.entries()) {
        let n = byId.get(id); const seen = new Set();
        while (n && !seen.has(n.ObjectId)) {
          seen.add(n.ObjectId); const key = `${n.ObjectId}:${property}`;
          if (!influence.has(key)) influence.set(key, new Map());
          const weights = influence.get(key); weights.set(geoset, (weights.get(geoset) || 0) + count / ids.length);
          if (n.Flags & (1 << p)) break;
          n = byId.get(n.Parent);
        }
      }
    }
  });
  const size = Math.max(1, lo.every(Number.isFinite) ? length(subtract(hi, lo)) / 2 : 1);
  return { influence, size };
}

function profile(record, start, end) {
  const { track, property } = record, a = sampleTrack(track, start, { quaternion: property === 'Rotation', fallback: property === 'Rotation' ? [0, 0, 0, 1] : [0, 0, 0] });
  const b = sampleTrack(track, end, { quaternion: property === 'Rotation', fallback: a });
  const directions = [], shape = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8, actual = sampleTrack(track, start + (end - start) * t, { quaternion: property === 'Rotation', fallback: a });
    const expected = blend(a, b, t, property);
    if (property === 'Rotation') {
      const q = new Quaternion().fromArray(expected).invert().multiply(new Quaternion().fromArray(actual));
      directions.push([q.x, q.y, q.z].map(v => v * (q.w < 0 ? -1 : 1)));
    } else directions.push(subtract(actual, expected));
    return distance(actual, expected, property);
  });
  const amplitude = Math.max(...shape), direction = directions[shape.indexOf(amplitude)], norm = length(direction);
  return { start, end, sequence: record.sequence, duration: end - start, amplitude, direction: direction.map(v => norm > 0 ? v / norm : 0), shape: shape.map(v => amplitude > 0 ? v / amplitude : 0) };
}

function pattern(events) {
  if (events.length < 3) return { erratic: false, repeated: false };
  const durations = events.map(e => e.duration), amplitudes = events.map(e => e.amplitude).filter(a => a > 1e-8);
  const variability = values => quantile(values, .9) / Math.max(quantile(values, .1), 1e-8);
  const typicalShape = Array.from({ length: 9 }, (_, i) => quantile(events.map(e => e.shape[i]), .5));
  const shapeError = quantile(events.map(e => length(subtract(e.shape, typicalShape)) / 3), .5);
  const ordered = [...events].sort((a, b) => a.start - b.start), gaps = ordered.slice(1).flatMap((e, i) => e.sequence === ordered[i].sequence && e.start > ordered[i].start ? [e.start - ordered[i].start] : []);
  const directionEvents = ordered.filter(e => length(e.direction) > .5);
  let bestRepeat = 1;
  if (directionEvents.length >= 6) {
    bestRepeat = 0;
    for (let lag = 1; lag <= Math.min(8, Math.floor(directionEvents.length / 2)); lag++) {
      const matches = directionEvents.slice(lag).filter((e, i) => dot(e.direction, directionEvents[i].direction) > .8).length;
      bestRepeat = Math.max(bestRepeat, matches / (directionEvents.length - lag));
    }
  }
  const erratic = variability(durations) > 2.5 || variability(amplitudes) > 3 || gaps.length >= 4 && variability(gaps) > 3 || shapeError > .3 || bestRepeat < .8;
  return { erratic, repeated: !erratic && shapeError < .18 };
}

function mergeBridges(events, property) {
  const axes = property === 'Rotation' ? [null] : [0, 1, 2], result = [];
  for (const axis of axes) {
    const spans = events.filter(e => e.axes.includes(axis)).sort((a, b) => a.start - b.start); let previous;
    for (const span of spans) {
      if (previous && span.start < previous.end) previous.end = Math.max(previous.end, span.end);
      else { previous = { start: span.start, end: span.end, axis }; result.push(previous); }
    }
  }
  return result;
}

/** Model-only contextual evidence. Existing findings are annotated, never
 * removed or given different repair plans. New warnings require spatial and
 * cross-animation/burst evidence, not an animation name or a reference file. */
export function scanModelMotionContext(model, existing = []) {
  const nodes = allNodes(model), sequences = model.Sequences || [], { influence, size } = geometryContext(model, nodes);
  const minimum = { Translation: size * .002, Rotation: 1.5, Scaling: .025 }, records = [];
  for (let sequence = 0; sequence < sequences.length; sequence++) {
    const interval = sequences[sequence].Interval;
    if (interval[1] <= interval[0] || sequences.some((s, i) => i !== sequence && s.Interval[0] < interval[1] && s.Interval[1] > interval[0])) continue;
    const visible = new Set(model.Geosets.map((_, i) => i).filter(i => [0, .5, 1].some(t => sampleGeosetAnimation(model, i, interval[0] + (interval[1] - interval[0]) * t, sequence).alpha > .01)));
    const total = model.Geosets.reduce((n, g, i) => n + (visible.has(i) ? g.Vertices.length / 3 : 0), 0);
    for (const node of nodes) for (const property of properties) {
      const source = node[property], weights = influence.get(`${node.ObjectId}:${property}`);
      if (!source?.Keys || source.LineType === 0 || Number.isInteger(source.GlobalSeqId) && source.GlobalSeqId >= 0 || !weights) continue;
      const keys = source.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]); if (keys.length < 2) continue;
      const geosets = [...weights.keys()].filter(i => visible.has(i)), coverage = total ? geosets.reduce((n, i) => n + weights.get(i), 0) / total : 0;
      if (!coverage) continue;
      const r = { node, property, sequence, keys, track: { ...source, Keys: keys }, coverage, geosets, events: [], candidates: [], speeds: [] };
      for (let i = 1; i < keys.length; i++) {
        const dt = keys[i].Frame - keys[i - 1].Frame;
        if (dt > 0) r.speeds.push(distance(keyValue(keys[i]), keyValue(keys[i - 1]), property) * 1000 / dt);
      }
      for (let i = 2; i < keys.length - 2; i++) {
        const a = keys[i - 1], b = keys[i], c = keys[i + 1], left = b.Frame - a.Frame, right = c.Frame - b.Frame;
        if (left <= 0 || right <= 0 || left + right > 300) continue;
        const av = keyValue(a), bv = keyValue(b), cv = keyValue(c), expected = blend(av, cv, left / (left + right), property);
        const error = distance(bv, expected, property), excess = distance(av, bv, property) + distance(bv, cv, property) - distance(av, cv, property);
        if (error < minimum[property] || excess < minimum[property]) continue;
        const peak = Math.max(r.speeds[i - 1], r.speeds[i]), floor = minimum[property] * 4;
        const context = Math.max(r.speeds[i - 2], r.speeds[i + 1], distance(av, cv, property) * 1000 / (left + right), floor);
        const reversal = property === 'Rotation' ? distance(av, cv, property) < (distance(av, bv, property) + distance(bv, cv, property)) * .5
          : dot(subtract(bv, av), subtract(cv, bv)) < -.5 * distance(bv, av, property) * distance(cv, bv, property);
        const rapid = left <= 90 && right <= 90 && reversal;
        if (peak < context * 2.5 && !rapid || Math.min(left, right) > 90) continue;
        const axes = property === 'Rotation' ? [null] : [0, 1, 2].filter(axis => Math.abs(bv[axis] - expected[axis]) >= minimum[property] * .25);
        const heldAnchors = distance(av, cv, property) < minimum[property] * .05
          && distance(keyValue(keys[i - 2]), av, property) < minimum[property] * .05
          && distance(keyValue(keys[i + 2]), cv, property) < minimum[property] * .05;
        const e = { ...profile(r, a.Frame, c.Frame), frame: b.Frame, axes, peak, contrast: peak / context, rapid, heldAnchors };
        r.events.push(e);
        const uncoveredAxes = axes.filter(axis => !existing.some(f => f.nodeId === node.ObjectId && f.sequence === sequence && (f.property || 'Translation') === property &&
          (f.bridges?.some(s => s.axis === axis && e.frame > s.start && e.frame < s.end) || f.spans?.some(s => s.axes.includes(axis) && e.frame > s.start && e.frame < s.end))));
        if (uncoveredAxes.length) r.candidates.push({ ...e, axes: uncoveredAxes });
      }
      // Include between-key faults already found by the established scanner in
      // the context summary. This does not replace their correction plans.
      for (const fix of existing.filter(f => f.nodeId === node.ObjectId && f.sequence === sequence && (f.property || 'Translation') === property))
        for (const span of fix.segments || []) if (!r.events.some(e => e.start === span.start && e.end === span.end)) r.events.push(profile(r, span.start, span.end));
      records.push(r);
    }
  }
  const review = new Map(), findings = [];
  for (const r of records) {
    const peers = records.filter(p => p.node === r.node && p.property === r.property), active = peers.filter(p => p.events.length), sequenceCount = new Set(active.map(p => p.sequence)).size;
    const events = active.flatMap(p => p.events), shape = pattern(events), wholeBody = r.coverage >= .7, localized = r.coverage < .2 && r.geosets.length <= 1;
    // Different branches moving at the same time is normal coordinated motion.
    // Escalate unrelated parts only for repeated, irregular, poorly synchronized
    // excursions, not one shared attack/death pose.
    const otherParts = r.candidates.length >= 3 && pattern(r.candidates).erratic ? records.filter(p => p.sequence === r.sequence && p.node !== r.node && p.coverage >= .1 && p.coverage < .7
      && p.candidates.length >= 3 && pattern(p.candidates).erratic && !isRelated(p.node, r.node, nodes)
      && r.candidates.filter(e => p.candidates.some(f => Math.abs(e.frame - f.frame) <= 25)).length / r.candidates.length < .35) : [];
    const disconnected = otherParts.length > 0 && r.coverage + otherParts.reduce((s, p) => s + p.coverage, 0) >= .35;
    const broad = wholeBody || r.coverage >= .2 || disconnected;
    const recurring = sequenceCount >= 2 && sequenceCount >= sequences.length / 2;
    const burst = r.candidates.filter(e => e.rapid).some(e => r.candidates.filter(other => other.rapid && Math.abs(other.frame - e.frame) <= 350).length >= 4);
    const erratic = broad && (shape.erratic || disconnected), level = erratic ? 'red' : 'orange';
    const scope = wholeBody ? 'Whole body' : disconnected ? 'Independent body parts' : localized ? 'Localized part' : 'Body part';
    const reason = disconnected ? 'Parts jerk with unrelated timing.' : shape.erratic ? 'Timing, size or direction varies irregularly.' : shape.repeated ? 'A similar abrupt pattern repeats.' : 'Abrupt movement needs inspection.';
    const context = { level, scope, sequenceCount, totalSequences: sequences.length, geosets: r.geosets, coverage: r.coverage,
      repeated: shape.repeated, erratic, disconnected, summary: `${scope} · ${sequenceCount}/${sequences.length} animations. ${reason}` };
    for (const f of existing.filter(f => f.nodeId === r.node.ObjectId && f.sequence === r.sequence && (f.property || 'Translation') === r.property)) review.set(f.id, context);
    if (localized && !disconnected || !broad || !recurring && !burst && !disconnected) continue;
    const modelSpeeds = records.filter(p => p.property === r.property && p.sequence !== r.sequence).flatMap(p => p.speeds).filter(v => v > minimum[r.property] * 4);
    const typicalSpeed = quantile(modelSpeeds, .5);
    const selected = r.candidates.filter(e => (e.contrast >= 2.5 || burst || disconnected) && (e.peak > typicalSpeed * 2 || recurring || disconnected));
    if (!selected.length) continue;
    const bridges = mergeBridges(selected, r.property), start = Math.min(...bridges.map(s => s.start)), end = Math.max(...bridges.map(s => s.end));
    const inspectionOnly = selected.some(e => !e.heldAnchors);
    findings.push({ id: `context:${r.sequence}:${r.node.ObjectId}:${r.property}`, kind: 'motionContext', nodeId: r.node.ObjectId, property: r.property, inspectionOnly,
      sequence: r.sequence, frame: start, bridges, segments: [], signature: signature(r), motionContext: context,
      label: `${sequences[r.sequence].Name}: body motion to inspect (${r.node.Name || r.node.ObjectId})`,
      detail: inspectionOnly ? 'Inspect this movement. The correct surrounding pose is uncertain, so no automatic correction is proposed.'
        : `Preview removes the marked ${r.property.toLowerCase()} excursions between supported holding poses. Other channels and animations stay unchanged.`, start, end });
  }
  return { findings, review };
}

function isRelated(a, b, nodes) {
  const byId = new Map(nodes.map(n => [n.ObjectId, n]));
  const ancestor = (node, id) => { const seen = new Set(); while (node && !seen.has(node.ObjectId)) { if (node.ObjectId === id) return true; seen.add(node.ObjectId); node = byId.get(node.Parent); } return false; };
  return ancestor(a, b.ObjectId) || ancestor(b, a.ObjectId);
}

export function repairContextMotion(model, fix, evidenceModel = model) {
  const motion = scanIrregularMotion(evidenceModel), existing = [...motion, ...scanSuspiciousSnaps(evidenceModel, motion)];
  const proposal = scanModelMotionContext(evidenceModel, existing).findings.find(f => f.id === fix.id);
  if (!proposal || proposal.signature !== fix.signature || JSON.stringify(proposal.bridges) !== JSON.stringify(fix.bridges)) throw Error('This movement finding changed. Select it again.');
  if (proposal.inspectionOnly) throw Error('This finding needs inspection; its surrounding poses do not support an automatic correction.');
  applyMotionCorrection(model, proposal);
}
