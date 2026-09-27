import { Euler, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices } from './animation.js';
import { applyMovementTransform, movementRestricted, sampleMovement } from './movement.js';
import { portraitSequenceIndices } from './sequence-editor.js';

const trackProperty = { move: 'Translation', rotate: 'Rotation' };

/** Find every top-level controller that actually owns skinned model vertices. */
export function modelControlRoots(model) {
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const weights = new Map();
  for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3;
    for (let vertex = 0; vertex < count; vertex++) {
      const skin = geoset.SkinWeights;
      const ids = skin?.length === count * 8
        ? [0, 1, 2, 3].filter(slot => skin[vertex * 8 + 4 + slot] > 0).map(slot => skin[vertex * 8 + slot])
        : geoset.Groups?.[geoset.VertexGroup?.[vertex]] || [];
      if (!ids.length) throw new Error('Control Model cannot move a geoset with unbound vertices.');
      for (const id of new Set(ids)) {
        let node = byId.get(id), seen = new Set();
        if (!node) throw new Error(`Control Model cannot find bound node ${id}.`);
        while (node.Parent != null) {
          if (seen.has(node.ObjectId)) throw new Error('Control Model found a cycle in the node hierarchy.');
          seen.add(node.ObjectId);
          if (node.Flags & 3) throw new Error('Control Model cannot move a node that ignores parent translation or rotation.');
          node = byId.get(node.Parent);
          if (!node) throw new Error('Control Model found a missing parent node.');
        }
        weights.set(node.ObjectId, (weights.get(node.ObjectId) || 0) + 1);
      }
    }
  }
  if (!weights.size) throw new Error('Control Model found no bound geosets.');
  return [...weights].sort(([a, wa], [b, wb]) => wa - wb || a - b).map(([id, weight]) => ({ id, weight }));
}

function setBoundary(track, property, frame, value) {
  const key = { Frame: frame, Vector: new Float32Array(value) };
  if (track.LineType >= 2) {
    const tangent = track.LineType === 2 && property !== 'Rotation' ? value.map(() => 0) : value;
    key.InTan = new Float32Array(tangent);
    key.OutTan = new Float32Array(tangent);
  }
  const index = track.Keys.findIndex(entry => entry.Frame === frame);
  if (index >= 0) track.Keys[index] = key;
  else track.Keys.push(key);
}

function sharePortraitPose(model, node, property, value) {
  const prior = node[property];
  if (prior?.GlobalSeqId != null) throw new Error('Control Model cannot scope a global-sequence controller to Portrait animations.');
  const track = prior?.Keys ? prior : { LineType: 1, GlobalSeqId: null, Keys: [] };
  for (const index of portraitSequenceIndices(model)) {
    const interval = model.Sequences[index].Interval;
    for (const frame of new Set(interval)) setBoundary(track, property, frame, value);
  }
  track.Keys.sort((a, b) => a.Frame - b.Frame);
  node[property] = track;
}

/** Apply one joint transform, then make each controlled root match in all
 * Portrait variants without touching another node or non-Portrait key. */
export function applyPortraitModelTransform(model, roots, time, sequenceIndex, change) {
  const mode = change.mode === 'translate' ? 'move' : change.mode;
  if (!trackProperty[mode]) throw new Error('Control Model supports Move and Rotate.');
  if (!portraitSequenceIndices(model).includes(sequenceIndex)) throw new Error('Choose a Portrait animation.');
  const ids = modelControlRoots(model).map(root => root.id);
  if (ids.length !== roots.length || ids.some(id => !roots.includes(id))) throw new Error('Select Control Model before transforming.');
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const before = mode === 'rotate' ? sampleNodeMatrices(model, time, sequenceIndex, time) : null;
  let pivot;
  if (before) {
    if (movementRestricted('move', change.restrictions)) throw new Error('Release the Move restriction to rotate the whole model.');
    const weights = modelControlRoots(model);
    pivot = new Vector3();
    for (const { id, weight } of weights) {
      const node = nodes.get(id), origin = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]).applyMatrix4(before.get(id));
      pivot.addScaledVector(origin, weight);
    }
    pivot.divideScalar(weights.reduce((total, root) => total + root.weight, 0));
  }
  applyMovementTransform(model, ids, time, sequenceIndex, { ...change, mode, space: 'world', rotateOnOwnAxis: false });
  if (mode === 'rotate') {
    const values = change.values ? Array.from(change.values) : ['X', 'Y', 'Z'].map(axis => axis === String(change.axis).toUpperCase() ? Number(change.amount) : 0);
    const delta = new Quaternion().setFromEuler(new Euler(...values.map(value => value * Math.PI / 180), 'XYZ'));
    for (const id of ids) {
      const node = nodes.get(id), origin = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]).applyMatrix4(before.get(id));
      const target = origin.clone().sub(pivot).applyQuaternion(delta).add(pivot);
      const offset = target.sub(origin);
      if (offset.lengthSq() > 1e-20) applyMovementTransform(model, [id], time, sequenceIndex, { ...change, mode: 'move', space: 'world', values: offset.toArray(), rotateOnOwnAxis: false });
    }
  }
  for (const id of ids) {
    const node = nodes.get(id);
    for (const property of mode === 'rotate' ? ['Rotation', 'Translation'] : ['Translation']) {
      sharePortraitPose(model, node, property, sampleMovement(model, node, property, time, sequenceIndex));
    }
  }
  return ids.length;
}
