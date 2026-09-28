import { allNodes } from './animation.js';
import { scanCurveMotion } from './motion-inspector.js';

/** A reviewable correction for the scanner's copied Hermite position controls.
 * Warcraft's vector Hermite tangents are derivatives in normalized segment
 * time. Setting both facing tangents to the endpoint delta gives a straight
 * path between the existing poses, without changing keys or other segments.
 */
export function repairCurveMotion(model, fix) {
  const warning = scanCurveMotion(model, { sequenceIndex: fix.sequence, nodeIds: [fix.nodeId] })[0];
  if (!warning) throw Error('This motion finding no longer matches the current model.');
  // Recheck against the current proposal, then modify exactly its segments.
  // Two separated runs must never turn their intervening keys into a repair.
  if (JSON.stringify(warning.segments) !== JSON.stringify(fix.segments)) throw Error('The affected curve segments changed. Select the finding again.');
  const track = allNodes(model).find(n => n.ObjectId === fix.nodeId).Translation;
  const keys = new Map(track.Keys.map(k => [k.Frame, k]));
  for (const { start, end } of warning.segments) {
    const left = keys.get(start), right = keys.get(end);
    const delta = new Float32Array(Array.from(right.Vector, (value, axis) => value - left.Vector[axis]));
    left.OutTan = delta;
    right.InTan = new Float32Array(delta);
  }
}
