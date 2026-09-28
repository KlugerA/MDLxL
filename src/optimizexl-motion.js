import { Quaternion } from 'three';
import { allNodes } from './animation.js';
import { scanCurveMotion } from './motion-inspector.js';

const properties = ['Translation', 'Rotation', 'Scaling'];
const local = track => track?.Keys?.length && track.LineType !== 0 && !(Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0);
const quantile = (values, q) => values.length ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)] : 0;
const angle = (a, b) => new Quaternion().fromArray(a).normalize().angleTo(new Quaternion().fromArray(b).normalize()) * 180 / Math.PI;
const value = (key, axis) => axis === null ? Array.from(key.Vector) : key.Vector[axis];
const distance = (a, b, axis) => axis === null ? angle(a, b) : Math.abs(a - b);
const blend = (a, b, t, axis) => axis === null
  ? new Quaternion().fromArray(a).normalize().slerp(new Quaternion().fromArray(b).normalize(), t).toArray()
  : a + (b - a) * t;
const speed = (a, b, axis) => a && b && a.Frame !== b.Frame ? distance(value(a, axis), value(b, axis), axis) * 1000 / Math.abs(a.Frame - b.Frame) : 0;
const inInterval = (track, interval) => track.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]);
const signature = (track, interval, p) => JSON.stringify({ line: track.LineType, global: track.GlobalSeqId ?? null,
  keys: inInterval(track, interval).map(k => [k.Frame, ...['Vector', 'InTan', 'OutTan'].map(name => k[name] && Array.from(k[name], Math.fround))]),
  segments: p.segments, bridges: p.bridges });

function mergeSpans(spans) {
  const result = [];
  for (const span of spans.sort((a, b) => a.start - b.start)) {
    const previous = result.at(-1);
    // A shared endpoint is a retained pose, not permission to flatten both sides.
    if (previous && span.start < previous.end) previous.end = Math.max(previous.end, span.end);
    else result.push({ ...span });
  }
  return result;
}

/** Review proposals only. Every baseline includes the model's other animations;
 * an ordinary fast attack is not an outlier merely because an idle is slower.
 * Vector channels are inspected separately so an odd Z dip cannot erase a
 * deliberate X/Y movement at the same key. Rotations use quaternion distance.
 */
export function scanIrregularMotion(model) {
  const nodes = allNodes(model), sequences = model.Sequences || [];
  const size = Math.max(1, model.Info?.BoundsRadius || 0, ...nodes.map(n => Math.hypot(...(n.PivotPoint || model.PivotPoints?.[n.ObjectId] || [0, 0, 0]))));
  const minimum = { Translation: size * .003, Rotation: 3, Scaling: .04 };
  const records = [], curves = new Map();
  for (let sequence = 0; sequence < sequences.length; sequence++) {
    const interval = sequences[sequence].Interval;
    if (sequences.some((s, i) => i !== sequence && s.Interval[0] < interval[1] && s.Interval[1] > interval[0])) continue;
    for (const f of scanCurveMotion(model, { sequenceIndex: sequence })) curves.set(`${sequence}:${f.nodeId}`, f);
    for (const node of nodes) for (const property of properties) {
      const track = node[property];
      if (!local(track)) continue;
      const keys = inInterval(track, sequences[sequence].Interval);
      if (keys.length < 2) continue;
      for (const axis of property === 'Rotation' ? [null] : [0, 1, 2]) records.push({ sequence, node, property, axis, track, keys,
        speeds: keys.slice(1).map((k, i) => speed(keys[i], k, axis)) });
    }
  }
  const bodyNodes = new Set(nodes.filter(n => {
    let count = 0;
    for (const other of nodes) {
      let current = other; const visited = new Set();
      while (current && !visited.has(current.ObjectId)) {
        if (current.ObjectId === n.ObjectId) { count++; break; }
        visited.add(current.ObjectId); current = model.Nodes?.[current.Parent] || nodes.find(p => p.ObjectId === current.Parent);
      }
    }
    return count >= Math.max(1, nodes.length / 2);
  }).map(n => n.ObjectId));
  const proposals = new Map();
  const proposal = record => {
    const { sequence, node, property } = record, id = `motion:${sequence}:${node.ObjectId}:${property}`;
    if (!proposals.has(id)) proposals.set(id, { id, sequence, nodeId: node.ObjectId, nodeName: node.Name || `Node ${node.ObjectId}`,
      property, kind: 'motion', wholeBody: bodyNodes.has(node.ObjectId), segments: [], bridges: [], reasons: [] });
    return proposals.get(id);
  };
  for (const r of records) {
    const { sequence, node, property, axis, keys } = r, interval = sequences[sequence].Interval;
    const duration = interval[1] - interval[0], min = minimum[property], floor = min * 1000 / Math.max(250, duration);
    const curve = property === 'Translation' ? curves.get(`${sequence}:${node.ObjectId}`) : null;
    if (curve) {
      const p = proposal(r);
      if (!p.segments.length) { p.segments = curve.segments; p.reasons.push('curve bouncing'); }
    }
    const peers = records.filter(other => other.property === property && other.sequence !== sequence);
    const ownSpeeds = records.filter(other => other.property === property && other.node === node && other.axis === axis).flatMap(other => other.speeds);
    // Ignore stationary axes when establishing the scale of active movement.
    // With one animation, surrounding segments supply the comparison below.
    const modelSpeed = quantile(peers.flatMap(other => other.speeds).filter(s => s > floor), .95);
    const ownSpeed = quantile(ownSpeeds.filter(s => s > floor), .75);
    const ownBackground = quantile(peers.filter(other => other.node === node && other.axis === axis).flatMap(other => other.speeds).filter(s => s > floor), .75);
    // Evidence survives approval of an earlier tangent-only correction: other
    // intervals still expose the copied-position control corruption.
    const copiedControls = property === 'Translation' && r.track.LineType === 2 && r.track.Keys.filter(k =>
      Math.abs(k.Vector[axis]) > min && k.InTan?.[axis] === k.Vector[axis] && k.OutTan?.[axis] === k.Vector[axis]).length >= 3;
    const copiedSlow = copiedControls && quantile(r.speeds, .5) < ownSpeed * .25;
    const work = [...keys], spans = [];
    for (let pass = 0; pass < keys.length; pass++) {
      let best = null;
      for (let i = 2; i < work.length - 2; i++) {
        const a = work[i - 1], b = work[i], c = work[i + 1], dt = c.Frame - a.Frame;
        if (!(dt > 0 && dt <= Math.min(copiedSlow ? 400 : 180, duration * .25))) continue;
        const av = value(a, axis), bv = value(b, axis), cv = value(c, axis);
        const expected = blend(av, cv, (b.Frame - a.Frame) / dt, axis);
        const error = distance(bv, expected, axis), excess = distance(av, bv, axis) + distance(bv, cv, axis) - distance(av, cv, axis);
        if (error < min || excess < min) continue;
        const peak = Math.max(speed(a, b, axis), speed(b, c, axis));
        const context = Math.max(speed(work[i - 2], a, axis), speed(c, work[i + 2], axis), speed(a, c, axis), floor);
        const ratio = peak / context;
        // Copied position tangents can bake extra excursions away from the
        // origin into new keys. Protect genuine turning poses toward it.
        const copiedExcursion = copiedSlow && Math.abs(bv) > Math.max(Math.abs(av), Math.abs(cv)) + min / 2;
        if (copiedExcursion ? ratio < 2.5 : ratio < 6 || peak < Math.max(modelSpeed * 4, ownBackground * 8, floor * 8)) continue;
        if (!best || ratio > best.ratio) best = { i, ratio, start: a.Frame, end: c.Frame };
      }
      if (!best) break;
      spans.push({ start: best.start, end: best.end }); work.splice(best.i, 1);
    }
    // A copied-control track can also contain a small *monotonic* hitch: it
    // briefly slows down without reversing, so displacement alone misses it.
    // Require independent support for the replacement rate from an exterior
    // segment. This is not general smoothing of slow or uneven movement.
    if (copiedSlow) for (let i = 1; i < work.length - 1; i++) {
      const a = work[i - 1], b = work[i], c = work[i + 1];
      const left = b.Frame - a.Frame, right = c.Frame - b.Frame, dt = left + right;
      if (left <= 0 || right <= 0 || Math.min(left, right) > 100 || Math.max(left, right) < Math.min(left, right) * 3 || dt > Math.min(500, duration * .4)) continue;
      const av = value(a, axis), bv = value(b, axis), cv = value(c, axis);
      const v1 = (bv - av) / left, v2 = (cv - bv) / right, rate = (cv - av) / dt;
      if (v1 * v2 <= 0 || Math.max(Math.abs(v1), Math.abs(v2)) < Math.min(Math.abs(v1), Math.abs(v2)) * 1.5) continue;
      if (Math.abs(bv - blend(av, cv, left / dt, axis)) < size * .00001) continue;
      const exterior = [[work[i - 2], a], [c, work[i + 2]]].filter(([x, y]) => x && y);
      if (!exterior.some(([x, y]) => {
        const reference = (value(y, axis) - value(x, axis)) / (y.Frame - x.Frame);
        return reference * rate > 0 && Math.abs(reference - rate) <= Math.abs(rate) * .01;
      })) continue;
      spans.push({ start: a.Frame, end: c.Frame }); work.splice(i--, 1);
    }
    // Repeated rapid out-and-back movement is strong evidence even when the
    // individual amplitudes are too small to be a model-wide speed outlier.
    // Restrict it to body motion or scale distortion; normal limb cycles and
    // isolated attack anticipation poses are not repeated whole-body jitter.
    if (bodyNodes.has(node.ObjectId) || property === 'Scaling') {
      let run = [];
      const finish = () => {
        if (run.length >= 6) {
          const first = run[0], last = run.at(-1) + 1;
          // Use the return to ordinary movement as the far anchor, not the
          // final displaced jitter pose (which would leave a residual offset).
          const end = keys[last + 1] && keys[last + 1].Frame - keys[last].Frame <= 500 ? last + 1 : last;
          spans.push({ start: keys[first].Frame, end: keys[end].Frame });
        }
        run = [];
      };
      for (let i = 0; i < keys.length - 1; i++) {
        const dt = keys[i + 1].Frame - keys[i].Frame, a = value(keys[i], axis), b = value(keys[i + 1], axis);
        const delta = distance(a, b, axis), previous = i ? value(keys[i - 1], axis) : a;
        const reverses = axis === null ? distance(previous, b, axis) < (distance(previous, a, axis) + delta) * .5 : (b - a) * (a - previous) < 0;
        if (dt > 100 || dt <= 0 || delta < min || run.length && !reverses) finish();
        if (dt > 0 && dt <= 100 && delta >= min) run.push(i);
      }
      finish();
    }
    if (spans.length) {
      const p = proposal(r);
      p.bridges.push(...mergeSpans(spans).map(s => ({ ...s, axis })));
      const reason = property === 'Scaling' ? 'scale distortion' : 'keyed jitter';
      if (!p.reasons.includes(reason)) p.reasons.push(reason);
    }
    // A very short, one-way yank has no return key. Reconnect the two outer
    // poses across its immediate stable neighbors rather than merely lowering
    // the bad key a little. Reject a bridge that would still be an outlier.
    for (let i = 2; i < keys.length - 2; i++) {
      const a = keys[i - 1], b = keys[i], dt = b.Frame - a.Frame;
      const peak = speed(a, b, axis), context = Math.max(speed(keys[i - 2], a, axis), speed(b, keys[i + 1], axis), floor);
      const baseline = Math.max(modelSpeed, quantile(r.speeds.filter((_, j) => j !== i - 1), .75), floor);
      if (!(dt > 0 && dt <= 50 && peak > baseline * 8 && peak > context * 8 && distance(value(a, axis), value(b, axis), axis) >= min * 2)) continue;
      const start = keys[i - 2], end = keys[i + 1];
      if (speed(start, end, axis) > baseline * 4) continue;
      const p = proposal(r); p.bridges.push({ start: start.Frame, end: end.Frame, axis });
      if (!p.reasons.includes('sudden yank')) p.reasons.push('sudden yank');
    }
  }
  return [...proposals.values()].map(p => {
    // Merge independently by component, never across unrelated motion axes.
    p.bridges = (p.property === 'Rotation' ? [null] : [0, 1, 2]).flatMap(axis => mergeSpans(p.bridges.filter(b => b.axis === axis)).map(b => ({ ...b, axis })));
    const track = nodes.find(n => n.ObjectId === p.nodeId)[p.property], interval = sequences[p.sequence].Interval;
    const ranges = [...p.segments, ...p.bridges]; p.start = Math.min(...ranges.map(s => s.start)); p.end = Math.max(...ranges.map(s => s.end));
    p.frame = p.start; p.keyTimes = inInterval(track, interval).filter(k => k.Frame >= p.start && k.Frame <= p.end).map(k => k.Frame);
    p.signature = signature(track, interval, p);
    p.label = `${sequences[p.sequence].Name}: irregular movement (${p.nodeName})`;
    p.detail = `Remove ${p.reasons.join(' and ')} from ${sequences[p.sequence].Name}${p.wholeBody ? ' (whole body)' : ''}. Replace the affected ${p.property.toLowerCase()} only; keep surrounding poses and other motion. Approve or skip after previewing.`;
    return p;
  });
}

/** Fully replace the proposed excursion, with no blend/strength attenuation.
 * Stored frames remain available to unrelated axes. Exterior control handles,
 * other animation intervals, and unrelated transform channels stay untouched.
 */
export function repairMotionIrregularity(model, fix) {
  const warning = scanIrregularMotion(model).find(f => f.id === fix.id);
  if (!warning) throw Error('This motion finding no longer matches the current model.');
  if (warning.signature !== fix.signature || JSON.stringify(warning.segments) !== JSON.stringify(fix.segments) || JSON.stringify(warning.bridges) !== JSON.stringify(fix.bridges))
    throw Error('The affected curve segments changed. Select the finding again.');
  const track = allNodes(model).find(n => n.ObjectId === fix.nodeId)[fix.property];
  const keys = inInterval(track, model.Sequences[fix.sequence].Interval), rotation = fix.property === 'Rotation';
  for (const { start, end, axis } of warning.bridges) {
    const a = keys.find(k => k.Frame === start), b = keys.find(k => k.Frame === end), av = value(a, axis), bv = value(b, axis);
    for (const k of keys) if (k.Frame > start && k.Frame < end) {
      const v = blend(av, bv, (k.Frame - start) / (end - start), axis);
      if (axis === null) k.Vector = new Float32Array(v); else k.Vector[axis] = v;
    }
  }
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    const curves = warning.segments.some(s => a.Frame >= s.start && b.Frame <= s.end);
    const axes = rotation ? [null] : [0, 1, 2];
    for (const axis of axes) {
      const bridge = warning.bridges.some(s => s.axis === axis && a.Frame >= s.start && b.Frame <= s.end);
      if (!curves && !bridge || track.LineType < 2) continue;
      if (rotation) { a.OutTan = new Float32Array(a.Vector); b.InTan = new Float32Array(b.Vector); }
      else if (track.LineType === 2) { a.OutTan[axis] = b.InTan[axis] = b.Vector[axis] - a.Vector[axis]; }
      else { a.OutTan[axis] = a.Vector[axis] + (b.Vector[axis] - a.Vector[axis]) / 3; b.InTan[axis] = b.Vector[axis] - (b.Vector[axis] - a.Vector[axis]) / 3; }
    }
  }
}
