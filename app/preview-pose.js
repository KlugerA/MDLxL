import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices } from '../src/animation.js';

const correction = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
const aroundPivot = (q, pivot) => new Matrix4().makeTranslation(...pivot.toArray()).multiply(new Matrix4().makeRotationFromQuaternion(q)).multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
const inherited = (matrix, flags) => {
  if (!(flags & 7)) return matrix;
  const p = new Vector3(), q = new Quaternion(), s = new Vector3(); matrix.decompose(p, q, s);
  if (flags & 1) p.set(0, 0, 0); if (flags & 2) q.identity(); if (flags & 4) s.set(1, 1, 1);
  return new Matrix4().compose(p, q, s);
};

/** Camera-facing transforms are preview state, never animation-track edits.
 * Matches the native Warcraft renderer's +X billboard convention. */
export function samplePreviewMatrices(model, frame, sequence, globalTime, camera) {
  const base = sampleNodeMatrices(model, frame, sequence, globalTime);
  const nodes = allNodes(model), byId = new Map(nodes.map(n => [n.ObjectId, n]));
  if (!camera || !nodes.some(n => n.Flags & 120)) return base;
  const out = new Map(), visiting = new Set(), cameraQ = camera.quaternion.clone().multiply(correction);
  function resolve(id) {
    if (out.has(id)) return out.get(id);
    const node = byId.get(id); if (!node || visiting.has(id)) return new Matrix4(); visiting.add(id);
    let matrix = base.get(id).clone(); const parent = byId.get(node.Parent);
    if (parent) {
      const originalParent = inherited(base.get(parent.ObjectId), node.Flags);
      matrix.premultiply(originalParent.clone().invert()).premultiply(inherited(resolve(parent.ObjectId), node.Flags));
    }
    const pivot = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]).applyMatrix4(matrix);
    if (node.Flags & 8) {
      if (parent) { const q = new Quaternion(); resolve(parent.ObjectId).decompose(new Vector3(), q, new Vector3()); matrix.premultiply(aroundPivot(q.invert(), pivot)); }
      matrix.premultiply(aroundPivot(cameraQ, pivot));
    } else if (node.Flags & 112) {
      const axis = new Vector3(...(node.Flags & 16 ? [1, 0, 0] : node.Flags & 32 ? [0, 1, 0] : [0, 0, 1])).transformDirection(matrix);
      const forward = new Vector3(1, 0, 0).transformDirection(matrix);
      const toward = new Vector3(1, 0, 0).applyQuaternion(cameraQ).addScaledVector(axis, -new Vector3(1, 0, 0).applyQuaternion(cameraQ).dot(axis));
      if (toward.lengthSq() > 1e-10) matrix.premultiply(aroundPivot(new Quaternion().setFromUnitVectors(forward, toward.normalize()), pivot));
    }
    visiting.delete(id); out.set(id, matrix); return matrix;
  }
  nodes.forEach(n => resolve(n.ObjectId)); return out;
}
