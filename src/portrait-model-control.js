import { Euler, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices } from './animation.js';
import { applyMovementTransform, movementRestricted, sampleMovement } from './movement.js';
import { portraitSequenceIndices } from './sequence-editor.js';

const trackProperty = { move: 'Translation', rotate: 'Rotation' };

function controlBindings(model) {
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const weights = new Map(), geosetRoots = [];
  for (const geoset of model.Geosets || []) {
    const connected = new Set();
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
        connected.add(node.ObjectId);
      }
    }
    geosetRoots.push(connected);
  }
  if (!weights.size) throw new Error('Control Model found no bound geosets.');
  return { weights, geosetRoots };
}

/** Find every top-level controller that actually owns skinned model vertices. */
export function modelControlRoots(model) {
  const { weights } = controlBindings(model);
  return [...weights].sort(([a, wa], [b, wb]) => wa - wb || a - b).map(([id, weight]) => ({ id, weight }));
}

/** Roots sharing a geoset must move as one group; disconnected geosets may be
 * positioned independently without changing their skin bindings. */
export function modelControlGroups(model) {
  const { weights, geosetRoots } = controlBindings(model);
  const neighbors = new Map([...weights.keys()].map(id => [id, new Set()]));
  for (const connected of geosetRoots) for (const id of connected) for (const other of connected) neighbors.get(id).add(other);
  const seen = new Set(), groups = [];
  for (const roots of geosetRoots) for (const root of roots) {
    if (seen.has(root)) continue;
    const stack = [root], ids = [];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id); ids.push(id);
      stack.push(...neighbors.get(id));
    }
    ids.sort((a, b) => weights.get(a) - weights.get(b) || a - b);
    groups.push({ ids, geosetIndices: geosetRoots.flatMap((set, index) => ids.some(id => set.has(id)) ? [index] : []) });
  }
  return groups;
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
  const all = modelControlRoots(model), groups = modelControlGroups(model);
  const ids = all.map(root => root.id);
  const selection = ids.length === roots.length && ids.every(id => roots.includes(id)) ? ids
    : groups.find(group => group.ids.length === roots.length && group.ids.every(id => roots.includes(id)))?.ids;
  if (!selection) throw new Error('Select Control Model before transforming.');
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const before = mode === 'rotate' ? sampleNodeMatrices(model, time, sequenceIndex, time) : null;
  let pivot;
  if (before) {
    if (movementRestricted('move', change.restrictions)) throw new Error('Release the Move restriction to rotate the whole model.');
    const weights = all.filter(root => selection.includes(root.id));
    pivot = new Vector3();
    for (const { id, weight } of weights) {
      const node = nodes.get(id), origin = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]).applyMatrix4(before.get(id));
      pivot.addScaledVector(origin, weight);
    }
    pivot.divideScalar(weights.reduce((total, root) => total + root.weight, 0));
  }
  applyMovementTransform(model, selection, time, sequenceIndex, { ...change, mode, space: 'world', rotateOnOwnAxis: false });
  if (mode === 'rotate') {
    const values = change.values ? Array.from(change.values) : ['X', 'Y', 'Z'].map(axis => axis === String(change.axis).toUpperCase() ? Number(change.amount) : 0);
    const delta = new Quaternion().setFromEuler(new Euler(...values.map(value => value * Math.PI / 180), 'XYZ'));
    for (const id of selection) {
      const node = nodes.get(id), origin = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]).applyMatrix4(before.get(id));
      const target = origin.clone().sub(pivot).applyQuaternion(delta).add(pivot);
      const offset = target.sub(origin);
      if (offset.lengthSq() > 1e-20) applyMovementTransform(model, [id], time, sequenceIndex, { ...change, mode: 'move', space: 'world', values: offset.toArray(), rotateOnOwnAxis: false });
    }
  }
  for (const id of selection) {
    const node = nodes.get(id);
    for (const property of mode === 'rotate' ? ['Rotation', 'Translation'] : ['Translation']) {
      sharePortraitPose(model, node, property, sampleMovement(model, node, property, time, sequenceIndex));
    }
  }
  return selection.length;
}
