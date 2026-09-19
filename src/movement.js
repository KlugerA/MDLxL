import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from './animation.js';

export const movementProperties = { move: 'Translation', rotate: 'Rotation', scale: 'Scaling' };
const defaults = { Translation: [0, 0, 0], Rotation: [0, 0, 0, 1], Scaling: [1, 1, 1] };
const axes = ['X', 'Y', 'Z'];
const vector = values => new Vector3().fromArray(values);

/** Locks are editor interaction state; they never become model properties. */
export function movementRestricted(mode, restrictions = {}) {
  const property = movementProperties[mode === 'translate' ? 'move' : mode];
  return !!(property && (restrictions[property.toLowerCase()] || restrictions[property]));
}

export function movementPlaneAxis(workplane = 'xy') {
  const plane = String(workplane).toLowerCase();
  if (plane === 'xy') return 2;
  if (plane === 'xz' || plane === 'zx') return 1;
  if (plane === 'yz') return 0;
  throw new Error('Choose the XY, ZX, or YZ workplane.');
}

/** Workplanes always describe model/world axes, independently of gizmo space. */
export function constrainMovementVector(values, change = {}) {
  const result = Array.from(values);
  if (change.workplaneEnabled) result[movementPlaneAxis(change.workplane)] = 0;
  return result;
}

function checkRestriction(mode, change) {
  if (movementRestricted(mode, change.restrictions)) throw new Error(`${movementProperties[mode]} is restricted. Release its restriction to edit it.`);
}

/** Bones edits reposition model-space pivots without changing skin or keys. */
export function applyRestPoseTransform(model, ids, change = {}) {
  const { mode = 'move', axis, amount = 0 } = change;
  if (!movementProperties[mode]) throw new Error('Choose Move, Rotate, or Scale.');
  checkRestriction(mode, change);
  if (mode !== 'move') throw new Error('Rest-pose nodes have position pivots. Use Move to position them; rotate or scale in Movement.');
  const input = change.values ? Array.from(change.values) : axes.map(name => name === String(axis).toUpperCase() ? Number(amount) : 0);
  if (input.length !== 3 || input.some(value => !Number.isFinite(value))) throw new Error('Enter finite X, Y, and Z values.');
  const offset = constrainMovementVector(input, change), nodes = selectedNodes(model, ids);
  const changes = nodes.map(node => {
    const pivot = node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0];
    const values = Array.from(pivot, (value, i) => value + offset[i]);
    if (values.length !== 3 || values.some(value => !Number.isFinite(value) || Math.abs(value) > 3.4028234663852886e38)) throw new Error('The resulting pivot must contain finite model coordinates.');
    return { node, pivot: new Float32Array(values) };
  });
  if (offset.every(value => value === 0)) return 0;
  // PIVT is authoritative for serialization/history; node.PivotPoint is its alias.
  // WC3 skin coordinates and BPOS matrices are unchanged by a pivot relocation.
  model.PivotPoints ||= [];
  for (const { node, pivot } of changes) model.PivotPoints[node.ObjectId] = node.PivotPoint = pivot;
  return changes.length;
}

export function movementFrame(model, node, property, time, sequenceIndex) {
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  if (!interval) throw new Error('Choose an animation before editing movement.');
  const duration = model.GlobalSequences?.[node[property]?.GlobalSeqId];
  const frame = Math.round(Number(time));
  if (!Number.isFinite(frame)) throw new Error('Choose a valid keyframe time.');
  return duration > 0 ? ((frame % duration) + duration) % duration : Math.max(interval[0], Math.min(interval[1], frame));
}

export function sampleMovement(model, node, property, time, sequenceIndex) {
  return Array.from(sampleTrack(node[property], time, {
    interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences,
    globalTime: time, fallback: defaults[property], quaternion: property === 'Rotation',
  }));
}

function selectedNodes(model, ids) {
  const selected = new Set(ids);
  const nodes = allNodes(model).filter(node => selected.has(node.ObjectId));
  if (!nodes.length) throw new Error('Select a bone or node first.');
  return nodes;
}

const controllerTypes = new Set([0, 1, 2, 3]);
const finiteCurveValue = (value, name) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < -1 || number > 1) throw new Error(`${name} must be between -1 and 1.`);
  return number;
};
const keyInSequence = (key, interval) => !interval || key.Frame >= interval[0] && key.Frame <= interval[1];
const normalizedQuaternion = values => new Quaternion().fromArray(values).normalize();

/** The selected transform channel has one WC3 interpolation mode. A mixed
 * multi-selection is reported as null so the toolbox can show that honestly. */
export function movementControllerType(model, ids, mode = 'rotate') {
  const property = movementProperties[mode];
  if (!property) return null;
  const values = selectedNodes(model, ids).map(node => node[property]?.Keys ? Number(node[property].LineType ?? 1) : 1);
  return values.every(value => value === values[0]) ? values[0] : null;
}

function cubicDefault(property, lineType, value) {
  if (property === 'Rotation' || lineType === 3) return new Float32Array(value);
  return new Float32Array(value.length);
}

/** Change a transform controller without discarding keys. Cubic modes always
 * receive complete typed tangents so both MDL and MDX validation remain safe. */
export function setMovementControllerType(model, ids, sequenceIndex, mode, lineType) {
  const property = movementProperties[mode];
  lineType = Number(lineType);
  if (!property) throw new Error('Choose Move, Rotate, or Resize first.');
  if (!controllerTypes.has(lineType)) throw new Error('Choose Non-Interp, Linear, Bezier, or Hermite.');
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  let count = 0;
  for (const node of selectedNodes(model, ids)) {
    const source = node[property];
    let track;
    if (source?.Keys) track = source;
    else {
      const value = Array.from(source || defaults[property]);
      const frames = interval ? [...new Set(Array.from(interval))] : [0];
      track = { LineType: lineType, GlobalSeqId: null, Keys: frames.map(Frame => ({ Frame, Vector: new Float32Array(value) })) };
      node[property] = track;
    }
    track.LineType = lineType;
    for (const key of track.Keys) {
      if (lineType < 2) { delete key.InTan; delete key.OutTan; }
      else {
        key.InTan ||= cubicDefault(property, lineType, key.Vector);
        key.OutTan ||= cubicDefault(property, lineType, key.Vector);
      }
    }
    count++;
  }
  return count;
}

/** Apply Kochanek-Bartels controls to Hermite keys in the current animation.
 * Vector tracks store Hermite derivatives; quaternion tracks store normalized
 * squad controls, matching sampleTrack's cubic rotation evaluator. */
export function setMovementHermiteCurve(model, ids, sequenceIndex, mode, values = {}) {
  const property = movementProperties[mode];
  if (!property) throw new Error('Choose Move, Rotate, or Resize first.');
  const tension = finiteCurveValue(values.tension ?? 0, 'Tension');
  const continuity = finiteCurveValue(values.continuity ?? 0, 'Continuity');
  const bias = finiteCurveValue(values.bias ?? 0, 'Bias');
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  let count = 0;
  for (const node of selectedNodes(model, ids)) {
    const track = node[property];
    if (!track?.Keys || track.LineType !== 2) continue;
    const scoped = track.Keys.filter(key => keyInSequence(key, interval));
    scoped.forEach((key, index) => {
      const previous = scoped[index - 1] || key, next = scoped[index + 1] || key;
      if (property === 'Rotation') {
        const current = normalizedQuaternion(key.Vector);
        const inWeight = Math.max(0, Math.min(1, (1 - tension) * (1 - continuity) * (1 + bias) / 3));
        const outWeight = Math.max(0, Math.min(1, (1 - tension) * (1 + continuity) * (1 - bias) / 3));
        key.InTan = new Float32Array(current.clone().slerp(normalizedQuaternion(previous.Vector), inWeight).normalize().toArray());
        key.OutTan = new Float32Array(current.clone().slerp(normalizedQuaternion(next.Vector), outWeight).normalize().toArray());
      } else {
        const current = Array.from(key.Vector), before = Array.from(previous.Vector), after = Array.from(next.Vector);
        const incoming = current.map((value, component) => (1 - tension) / 2 * ((1 - continuity) * (1 + bias) * (value - before[component]) + (1 + continuity) * (1 - bias) * (after[component] - value)));
        const outgoing = current.map((value, component) => (1 - tension) / 2 * ((1 + continuity) * (1 + bias) * (value - before[component]) + (1 - continuity) * (1 - bias) * (after[component] - value)));
        key.InTan = new Float32Array(incoming); key.OutTan = new Float32Array(outgoing);
      }
      count++;
    });
  }
  return count;
}

export function setMovementBezierHandles(model, ids, time, sequenceIndex, mode, handles = {}) {
  const property = movementProperties[mode];
  if (!property) throw new Error('Choose Move, Rotate, or Resize first.');
  let count = 0;
  for (const node of selectedNodes(model, ids)) {
    const track = node[property];
    if (!track?.Keys || track.LineType !== 3) continue;
    const frame = movementFrame(model, node, property, time, sequenceIndex);
    const key = track.Keys.find(item => item.Frame === frame);
    if (!key) throw new Error('Select a stored keyframe before editing Bezier handles.');
    const width = key.Vector.length;
    const incoming = Array.from(handles.incoming || key.InTan || key.Vector, Number);
    const outgoing = Array.from(handles.outgoing || key.OutTan || key.Vector, Number);
    if (incoming.length !== width || outgoing.length !== width || [...incoming, ...outgoing].some(value => !Number.isFinite(value))) throw new Error(`Bezier handles need ${width} finite components.`);
    if (property === 'Rotation') {
      if (Math.hypot(...incoming) < 1e-12 || Math.hypot(...outgoing) < 1e-12) throw new Error('Rotation handles must be non-zero quaternions.');
      key.InTan = new Float32Array(normalizedQuaternion(incoming).toArray());
      key.OutTan = new Float32Array(normalizedQuaternion(outgoing).toArray());
    } else {
      key.InTan = new Float32Array(incoming); key.OutTan = new Float32Array(outgoing);
    }
    count++;
  }
  return count;
}

/** Delete selected-node transform data in one local animation, or everywhere
 * when the classic All line is selected. Global-sequence tracks are not local
 * to an individual animation and are therefore retained for a scoped delete. */
export function deleteMovementControllers(model, ids, sequenceIndex = -1) {
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  let count = 0;
  for (const node of selectedNodes(model, ids)) for (const property of Object.values(movementProperties)) {
    const track = node[property];
    if (sequenceIndex < 0) {
      if (track !== undefined) { delete node[property]; count++; }
      continue;
    }
    if (!track?.Keys || Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) continue;
    const before = track.Keys.length;
    track.Keys = track.Keys.filter(key => !keyInSequence(key, interval));
    count += before - track.Keys.length;
    if (!track.Keys.length) delete node[property];
  }
  return count;
}

// Rotation inheritance uses the same convention as sampleNodeMatrices. Local
// deltas follow the current bone axes; world deltas are conjugated by the
// effective parent rotation before being written into the WC3 local track.
export function movementParentMatrix(node, matrices) {
  const parent = matrices.get(node.Parent)?.clone() || new Matrix4();
  if (!(node.Flags & 7)) return parent;
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  parent.decompose(position, rotation, scale);
  if (node.Flags & 1) position.set(0, 0, 0);
  if (node.Flags & 2) rotation.identity();
  if (node.Flags & 4) scale.set(1, 1, 1);
  return parent.compose(position, rotation, scale);
}

function writeKey(model, node, property, time, sequenceIndex, values, transformTangent) {
  const frame = movementFrame(model, node, property, time, sequenceIndex);
  const prior = node[property];
  const track = prior?.Keys ? prior : { LineType: 1, Keys: [] };
  const interval = model.Sequences[sequenceIndex].Interval;
  const global = model.GlobalSequences?.[track.GlobalSeqId] > 0;
  const make = (at, value) => {
    const key = { Frame: at, Vector: new Float32Array(value) };
    if (track.LineType >= 2) {
      // Bezier controls are points. Hermite vector tangents are derivatives;
      // zero preserves a constant boundary. Quaternion cubic uses squad.
      const tangent = track.LineType === 2 && property !== 'Rotation' ? value.map(() => 0) : value;
      key.InTan = new Float32Array(tangent); key.OutTan = new Float32Array(tangent);
    }
    return key;
  };
  if (!global && !track.Keys.some(key => key.Frame >= interval[0] && key.Frame <= interval[1])) {
    for (const boundary of new Set(interval)) track.Keys.push(make(boundary, sampleMovement(model, node, property, boundary, sequenceIndex)));
  }
  const index = track.Keys.findIndex(key => key.Frame === frame);
  const old = index >= 0 ? track.Keys[index] : null;
  const key = make(frame, values);
  if (old && track.LineType >= 2) for (const tangent of ['InTan', 'OutTan']) {
    if (old[tangent]) key[tangent] = new Float32Array(transformTangent ? transformTangent(old[tangent], track.LineType) : old[tangent]);
  }
  if (index < 0) track.Keys.push(key); else track.Keys[index] = key;
  track.Keys.sort((a, b) => a.Frame - b.Frame);
  node[property] = track;
}

/** Apply an incremental XYZ transform at the selected frame, never a pivot edit. */
export function applyMovementTransform(model, ids, time, sequenceIndex, change = {}) {
  if (change.restPose) return applyRestPoseTransform(model, ids, change);
  const { mode = 'rotate', space = 'local', axis, amount = 0 } = change;
  const property = movementProperties[mode];
  if (!property) throw new Error('Choose Move, Rotate, or Scale.');
  checkRestriction(mode, change);
  if (!['world', 'local'].includes(space)) throw new Error('Choose World or Local axes.');
  const values = change.values ? Array.from(change.values) : axes.map(name => name === String(axis).toUpperCase() ? Number(amount) : mode === 'scale' ? 1 : 0);
  if (values.length !== 3 || values.some(value => !Number.isFinite(value))) throw new Error('Enter finite X, Y, and Z values.');
  if (mode === 'scale' && values.some(value => Math.abs(value) < 1e-6)) throw new Error('Scale must not be zero.');
  const nodes = selectedNodes(model, ids);
  nodes.forEach(node => movementFrame(model, node, property, time, sequenceIndex));
  const matrices = sampleNodeMatrices(model, time, sequenceIndex, time);
  const worldMoves = new Map();
  if (mode === 'move') for (const node of nodes) {
    const offset = vector(values), parent = movementParentMatrix(node, matrices);
    if (space === 'local') {
      offset.applyQuaternion(new Quaternion().fromArray(sampleMovement(model, node, 'Rotation', time, sequenceIndex)).normalize());
      offset.applyMatrix4(parent).sub(new Vector3().applyMatrix4(parent));
    }
    worldMoves.set(node.ObjectId, offset.fromArray(constrainMovementVector(offset.toArray(), change)));
  }
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const inheritedMove = (node, visited = new Set()) => {
    if (node.Flags & 1 || visited.has(node.ObjectId)) return new Vector3();
    visited.add(node.ObjectId);
    const parent = byId.get(node.Parent);
    return !parent ? new Vector3() : worldMoves.get(parent.ObjectId)?.clone() || inheritedMove(parent, visited);
  };
  const deltaRotation = new Quaternion().setFromEuler(new Euler(...values.map(value => value * Math.PI / 180), 'XYZ'));
  const changes = nodes.map(node => {
    const current = sampleMovement(model, node, property, time, sequenceIndex);
    const parent = movementParentMatrix(node, matrices);
    const parentRotation = new Quaternion(); parent.decompose(new Vector3(), parentRotation, new Vector3());
    if (mode === 'rotate') {
      const delta = space === 'world' ? parentRotation.clone().invert().multiply(deltaRotation).multiply(parentRotation) : deltaRotation;
      const rotate = input => {
        const q = new Quaternion().fromArray(input).normalize();
        return (space === 'local' ? q.multiply(delta) : q.premultiply(delta)).normalize().toArray();
      };
      return { node, value: rotate(current), tangent: rotate };
    }
    if (mode === 'move') {
      // Subtract a selected ancestor's move so a multi-selection is translated
      // once, rather than dragging a selected child twice through inheritance.
      const offset = worldMoves.get(node.ObjectId).clone().sub(inheritedMove(node));
      if (Math.abs(parent.determinant()) < 1e-12) throw new Error('This parent has zero scale. Restore its scale before moving in world axes.');
      const inverse = parent.clone().invert();
      offset.applyMatrix4(inverse).sub(new Vector3().applyMatrix4(inverse));
      if (offset.lengthSq() < 1e-24) return null;
      return { node, value: vector(current).add(offset).toArray(), tangent: (input, lineType) => lineType === 3 ? vector(input).add(offset).toArray() : Array.from(input) };
    }
    // WC3 scale is diagonal in node-local coordinates: a rotated world stretch
    // requires shear, which WC3 cannot store. Keep scale explicitly local.
    return { node, value: current.map((value, i) => value * values[i]), tangent: input => Array.from(input, (value, i) => value * values[i]) };
  }).filter(Boolean);
  for (const { node, value, tangent } of changes) writeKey(model, node, property, time, sequenceIndex, value, tangent);
  return changes.length;
}

export function insertMovementKeys(model, ids, time, sequenceIndex, mode = 'rotate') {
  const properties = mode === 'all' ? Object.values(movementProperties) : [movementProperties[mode]];
  if (properties.some(property => !property)) throw new Error('Choose a movement channel.');
  const nodes = selectedNodes(model, ids);
  for (const node of nodes) for (const property of properties) {
    writeKey(model, node, property, time, sequenceIndex, sampleMovement(model, node, property, time, sequenceIndex));
  }
}

export function deleteMovementKeys(model, ids, time, sequenceIndex, mode = 'rotate') {
  const property = movementProperties[mode];
  if (!property) throw new Error('Choose a movement channel.');
  let count = 0;
  for (const node of selectedNodes(model, ids)) {
    const frame = movementFrame(model, node, property, time, sequenceIndex), track = node[property];
    if (track?.Keys) { const before = track.Keys.length; track.Keys = track.Keys.filter(key => key.Frame !== frame); count += before - track.Keys.length; if (!track.Keys.length) delete node[property]; }
  }
  return count;
}

/** Replace or retime one existing local transform key without changing siblings. */
export function updateMovementKey(model, nodeId, time, nextTime, sequenceIndex, mode, values) {
  const property = movementProperties[mode], node = selectedNodes(model, [nodeId])[0];
  if (!property) throw new Error('Choose a movement channel.');
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  if (!Number.isInteger(nextTime) || !interval || nextTime < interval[0] || nextTime > interval[1]) throw new Error('Keyframe time must be a whole number inside the selected animation.');
  const source = movementFrame(model, node, property, time, sequenceIndex), destination = movementFrame(model, node, property, nextTime, sequenceIndex);
  const original = node[property];
  if (!original?.Keys?.some(key => key.Frame === source)) throw new Error('Select an existing movement keyframe.');
  if (source !== destination && original.Keys.some(key => key.Frame === destination)) throw new Error('Another key already exists at that time.');
  let vector = Array.from(values || []);
  if (vector.length !== (mode === 'rotate' ? 4 : 3) || vector.some(value => !Number.isFinite(value) || Math.abs(value) > 3.4028234663852886e38)) throw new Error('Enter finite values for this movement key.');
  if (mode === 'scale' && vector.some(value => Math.abs(value) < 1e-6)) throw new Error('Scale must not be zero.');
  if (mode === 'rotate') {
    if (Math.hypot(...vector) < 1e-12) throw new Error('Rotation quaternion must not be zero.');
    vector = new Quaternion().fromArray(vector).normalize().toArray();
  }
  const track = structuredClone(original), key = track.Keys.find(item => item.Frame === source);
  key.Frame = destination; key.Vector = new Float32Array(vector);
  track.Keys.sort((a, b) => a.Frame - b.Frame); node[property] = track;
}

export function movementKeyframes(model, ids, sequenceIndex, mode = 'all') {
  const selected = new Set(ids), interval = model.Sequences?.[sequenceIndex]?.Interval;
  const properties = mode === 'all' ? Object.values(movementProperties) : [movementProperties[mode]];
  const frames = new Set();
  for (const node of allNodes(model)) if (!selected.size || selected.has(node.ObjectId)) for (const property of properties) {
    const track = node[property], duration = model.GlobalSequences?.[track?.GlobalSeqId];
    for (const key of track?.Keys || []) {
      if (duration > 0 && interval) {
        let frame = key.Frame + Math.ceil((interval[0] - key.Frame) / duration) * duration;
        // Only display the current sequence's occurrences, bounded for tiny loops.
        for (let count = 0; frame <= interval[1] && count < 10000; frame += duration, count++) frames.add(frame);
      } else if (!interval || key.Frame >= interval[0] && key.Frame <= interval[1]) frames.add(key.Frame);
    }
  }
  return [...frames].sort((a, b) => a - b);
}
