import { allNodes } from './animation.js';

const dist = (a, b) => Math.hypot(...Array.from(a, (v, i) => v - b[i]));
const lerp = (a, b, t) => Array.from(a, (v, i) => v + (b[i] - v) * t);
const local = t => t?.Keys?.length && t.LineType > 0 && !(Number.isInteger(t.GlobalSeqId) && t.GlobalSeqId >= 0);
const fingerprint = (t, interval) => JSON.stringify({ type: t.LineType, global: t.GlobalSeqId ?? null,
  keys: t.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]).map(k => [k.Frame, ...['Vector', 'InTan', 'OutTan'].map(p => k[p] && Array.from(k[p], Math.fround))]) });

// Count skinned geometry ownership rather than unrelated particles/attachments.
function bodyOwners(model, nodes) {
  const byId = new Map(nodes.map(n => [n.ObjectId, n])), counts = new Map(); let total = 0;
  for (const g of model.Geosets) {
    const groups = new Map();
    for (const group of g.VertexGroup) groups.set(group, (groups.get(group) || 0) + 1);
    for (const [group, count] of groups) {
      const owners = new Set();
      for (const id of g.Groups[group] || []) {
        let n = byId.get(id); const visited = new Set();
        while (n && !visited.has(n.ObjectId)) { visited.add(n.ObjectId); owners.add(n.ObjectId); n = byId.get(n.Parent); }
      }
      if (owners.size) { total += count; for (const id of owners) counts.set(id, (counts.get(id) || 0) + count); }
    }
  }
  return nodes.filter(n => total > 0 && (counts.get(n.ObjectId) || 0) >= total * .8);
}

/** Additive suspicion tier. Existing repair plans and reduction tolerances are
 * untouched. Repeated radial offsets expose baked copied-position corruption;
 * isolated fast out-and-back body moves between holds warrant review too.
 * These are proposals, never automatic edits or animation-name exceptions. */
export function scanSuspiciousSnaps(model, existing = []) {
  const nodes = allNodes(model), size = Math.max(1, model.Info?.BoundsRadius || 0, ...nodes.map(n => Math.hypot(...(n.PivotPoint || [0, 0, 0]))));
  const epsilon = Math.max(.00001, size * 1e-7), minimum = size * .003, findings = [];
  for (const node of bodyOwners(model, nodes)) {
    const track = node.Translation;
    if (!local(track)) continue;
    const copied = track.LineType === 2 && track.Keys.filter(k => Math.hypot(...k.Vector) > minimum && dist(k.Vector, k.InTan || []) === 0 && dist(k.Vector, k.OutTan || []) === 0).length >= 3;
    for (let sequence = 0; sequence < model.Sequences.length; sequence++) {
      const interval = model.Sequences[sequence].Interval;
      if (model.Sequences.some((s, i) => i !== sequence && s.Interval[0] < interval[1] && s.Interval[1] > interval[0])) continue;
      const keys = track.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]), holds = [], spans = [];
      if (copied) for (let i = 0; i < keys.length - 2; i++) {
        const a = keys[i], norm = Math.hypot(...a.Vector);
        if (norm <= minimum) continue;
        for (let j = i + 2; j < keys.length && keys[j].Frame - a.Frame <= 1800; j++) {
          const b = keys[j]; if (dist(a.Vector, b.Vector) > epsilon) continue;
          const inside = keys.slice(i + 1, j); let peak = 0;
          const radial = inside.every(k => {
            const factor = k.Vector.reduce((sum, v, axis) => sum + v * a.Vector[axis], 0) / (norm * norm);
            peak = Math.max(peak, dist(k.Vector, a.Vector));
            return factor >= 1 - 1e-5 && dist(k.Vector, Array.from(a.Vector, v => v * factor)) <= epsilon * 4;
          });
          const returning = dist(inside.at(-1).Vector, b.Vector) * 1000 / (b.Frame - inside.at(-1).Frame);
          if (radial && peak >= minimum && returning >= Math.max(size * .15, peak * 1500 / (b.Frame - a.Frame))) {
            holds.push({ start: a.Frame, end: b.Frame, axes: [0, 1, 2], reason: 'repeated displacement from a held pose' }); i = j - 1;
          }
          break;
        }
      }
      // A single deliberate bob is not evidence of a broken holding pose.
      if (holds.length >= 2) spans.push(...holds);
      for (let i = 1; i < keys.length - 1; i++) {
        const a = keys[i - 1], b = keys[i], c = keys[i + 1], dt = c.Frame - a.Frame;
        if (!(b.Frame > a.Frame && c.Frame > b.Frame && dt <= 400)) continue;
        if (spans.some(s => b.Frame > s.start && b.Frame < s.end)) continue;
        const expected = lerp(a.Vector, c.Vector, (b.Frame - a.Frame) / dt), error = dist(expected, b.Vector);
        const peak = Math.max(dist(a.Vector, b.Vector) * 1000 / (b.Frame - a.Frame), dist(b.Vector, c.Vector) * 1000 / (c.Frame - b.Frame));
        const outward = Math.hypot(...b.Vector) > Math.max(Math.hypot(...a.Vector), Math.hypot(...c.Vector)) + minimum;
        const copiedSpike = copied && outward && peak > Math.max(dist(a.Vector, c.Vector) * 2500 / dt, size * .1);
        const heldSpike = dt <= 150 && error >= size * .015 && dist(a.Vector, c.Vector) <= epsilon && keys[i - 2] && keys[i + 2]
          && a.Frame - keys[i - 2].Frame >= 150 && keys[i + 2].Frame - c.Frame >= 150
          && dist(keys[i - 2].Vector, a.Vector) <= epsilon && dist(c.Vector, keys[i + 2].Vector) <= epsilon;
        if (error < minimum || !copiedSpike && !heldSpike) continue;
        const axes = [0, 1, 2].filter(axis => Math.abs(expected[axis] - b.Vector[axis]) > epsilon);
        if (axes.every(axis => existing.some(f => f.sequence === sequence && f.nodeId === node.ObjectId && f.property === 'Translation' && f.bridges?.some(s => s.axis === axis && b.Frame > s.start && b.Frame < s.end)))) continue;
        spans.push({ start: a.Frame, end: c.Frame, axes, reason: 'brief whole-body excursion' });
      }
      if (!spans.length) continue;
      const first = spans.reduce((a, b) => a.start < b.start ? a : b), name = model.Sequences[sequence].Name;
      findings.push({ id: `snap:${sequence}:${node.ObjectId}`, kind: 'snap', sequence, nodeId: node.ObjectId, property: 'Translation', spans,
        frame: first.start, signature: fingerprint(track, interval), label: `${name}: suspicious whole-body snap (${node.Name || node.ObjectId})`,
        detail: `Suspicious body movement in ${name}. Preview reconnects the repeated holding poses or removes the brief excursion. Other bones and animations stay unchanged; approve or skip after reviewing.` });
    }
  }
  return findings;
}

export function repairSuspiciousSnap(model, fix, evidenceModel = model) {
  const node = allNodes(model).find(n => n.ObjectId === fix.nodeId), original = allNodes(evidenceModel).find(n => n.ObjectId === fix.nodeId);
  const interval = evidenceModel.Sequences[fix.sequence]?.Interval;
  if (!interval || !original?.Translation || fingerprint(original.Translation, interval) !== fix.signature) throw Error('This snap finding changed. Select it again.');
  const track = node.Translation, keys = track.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]);
  for (const { start, end, axes } of fix.spans) {
    const a = keys.find(k => k.Frame === start), b = keys.find(k => k.Frame === end);
    if (!a || !b) throw Error('The snap repair anchors changed. Select it again.');
    for (const k of keys) if (k.Frame > start && k.Frame < end) for (const axis of axes) k.Vector[axis] = a.Vector[axis] + (b.Vector[axis] - a.Vector[axis]) * (k.Frame - start) / (end - start);
    for (let i = 1; i < keys.length; i++) {
      const left = keys[i - 1], right = keys[i]; if (left.Frame < start || right.Frame > end || track.LineType < 2) continue;
      for (const axis of axes) {
        const delta = right.Vector[axis] - left.Vector[axis];
        if (track.LineType === 2) left.OutTan[axis] = right.InTan[axis] = delta;
        else { left.OutTan[axis] = left.Vector[axis] + delta / 3; right.InTan[axis] = right.Vector[axis] - delta / 3; }
      }
    }
  }
}
