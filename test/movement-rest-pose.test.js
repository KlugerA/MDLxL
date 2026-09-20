import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { generateMDL } from 'war3-model';
import { allNodes, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { applyMovementTransform, applyRestPoseTransform, constrainMovementVector, movementPlaneAxis, movementRestricted } from '../src/movement.js';
import { movementChildVertexCount, movementSelectionSummary } from '../src/movement-selection.js';
import { createDemoDocument, createNode, NODE_TYPES, openDocument } from '../src/editor-document.js';
import { directlyBoundBoneIds } from '../src/binding-inspection.js';

const nearVector = (actual, expected) => Array.from(actual).forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-4, `${actual} != ${expected}`));
const key = value => ({ LineType: 1, Keys: [{ Frame: 100, Vector: new Float32Array(value) }] });
const fixture = () => ({ Sequences: [{ Interval: [100, 1000] }], GlobalSequences: [], Bones: [
  { ObjectId: 0, PivotPoint: [0, 0, 0], Rotation: key(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), .73).toArray()), Scaling: key([2, 3, 4]) },
  { ObjectId: 1, Parent: 0, PivotPoint: [2, 4, 6], Rotation: key(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), .41).toArray()) },
], Helpers: [], Geosets: [], PivotPoints: [] });
const nodePoint = (model, id) => new Vector3().fromArray(allNodes(model).find(n => n.ObjectId === id).PivotPoint).applyMatrix4(sampleNodeMatrices(model, 500, 0).get(id));

test('Movement coordinate fields lock the workplane normal axis', () => {
  assert.deepEqual(['xy', 'xz', 'zx', 'yz'].map(movementPlaneAxis), [2, 1, 1, 0]);
});

test('workplanes preserve world perpendicular coordinate through rotated/scaled parents and local axes', () => {
  for (const plane of ['xy', 'xz', 'zx', 'yz']) for (const space of ['local', 'world']) {
    const unconstrained = fixture(), model = fixture(), before = nodePoint(model, 1);
    applyMovementTransform(unconstrained, [1], 500, 0, { mode: 'move', space, values: [3, 5, 7] });
    const desired = constrainMovementVector(nodePoint(unconstrained, 1).sub(before).toArray(), { workplaneEnabled: true, workplane: plane });
    applyMovementTransform(model, [1], 500, 0, { mode: 'move', space, values: [3, 5, 7], workplaneEnabled: true, workplane: plane });
    nearVector(nodePoint(model, 1).sub(before).toArray(), desired);
  }
});

test('world multi-selection movement does not double-translate selected descendants', () => {
  const model = fixture(); model.Helpers = [{ ObjectId: 4, Parent: 1, PivotPoint: [8, 9, 10] }];
  const before = [0, 1, 4].map(id => nodePoint(model, id));
  applyMovementTransform(model, [0, 1, 4], 500, 0, { mode: 'move', space: 'world', values: [3, 5, 7] });
  [0, 1, 4].forEach((id, i) => nearVector(nodePoint(model, id).sub(before[i]).toArray(), [3, 5, 7]));
  assert.equal(model.Bones[1].Translation, undefined);
  assert.equal(model.Helpers[0].Translation, undefined);
});

test('each transform lock blocks numeric and axis payloads before mutation; release restores independent channels', () => {
  for (const [mode, name] of [['move', 'translation'], ['rotate', 'rotation'], ['scale', 'scaling']]) {
    const model = fixture(), original = structuredClone(model), restrictions = { [name]: true };
    assert.equal(movementRestricted(mode, restrictions), true);
    for (const input of [{ axis: 'X', amount: 2 }, { values: [2, 3, 4] }]) assert.throws(() => applyMovementTransform(model, [1], 500, 0, { mode, restrictions, ...input }), /restricted/);
    assert.deepEqual(model, original);
    for (const other of ['move', 'rotate', 'scale'].filter(value => value !== mode)) assert.equal(movementRestricted(other, restrictions), false);
    applyMovementTransform(model, [1], 500, 0, { mode, restrictions: {}, axis: 'X', amount: 2 });
    assert.notDeepEqual(model, original);
  }
  const model = fixture(), before = structuredClone(model);
  assert.throws(() => applyMovementTransform(model, [1], 500, 0, { restPose: true, mode: 'move', values: [1, 2, 3], restrictions: { translation: true } }), /restricted/);
  assert.deepEqual(model, before);
});

test('perpendicular-only workplane moves author no keys or pivots and do not modify unrelated editor display state', () => {
  const model = fixture(), before = structuredClone(model), options = { workplaneEnabled: true, workplane: 'xy', gridPlanes: { xy: false, xz: true, yz: true } }, savedOptions = structuredClone(options);
  assert.equal(applyMovementTransform(model, [1], 500, 0, { mode: 'move', space: 'world', values: [0, 0, 9], ...options }), 0);
  assert.equal(applyRestPoseTransform(model, [1], { mode: 'move', values: [0, 0, 9], ...options }), 0);
  assert.deepEqual(model, before); assert.deepEqual(options, savedOptions);
});

test('rest-pose pivot edits support every node kind, persist in MDL/MDX, undo, and retain authored animation/skin/BPOS', () => {
  const source = structuredClone(createDemoDocument().model); source.Version = 1000;
  for (const type of Object.keys(NODE_TYPES)) createNode(source, type);
  source.BindPoses = [{ Matrices: Array.from({ length: source.Nodes.length }, (_, i) => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, i, i + 1, i + 2])) }];
  const doc = openDocument(generateMDL(source)), original = structuredClone(doc.model), ids = allNodes(doc.model).map(node => node.ObjectId);
  const skins = doc.model.Geosets.map(geo => skinGeoset(geo, sampleNodeMatrices(doc.model, 999, -1)));
  doc.apply('Move rig pivots', ['Nodes', 'PivotPoints'], model => applyMovementTransform(model, ids, 777, 0, { restPose: true, mode: 'move', values: [12, 8, -3] }));
  const authored = structuredClone(doc.model);
  for (const node of allNodes(doc.model)) {
    const prior = allNodes(original).find(other => other.ObjectId === node.ObjectId);
    nearVector(node.PivotPoint, Array.from(prior.PivotPoint, (v, i) => v + [12, 8, -3][i]));
    assert.equal(node.PivotPoint, doc.model.PivotPoints[node.ObjectId]);
    for (const property of ['Translation', 'Rotation', 'Scaling', 'EventTrack']) assert.deepEqual(node[property], prior[property]);
  }
  assert.deepEqual(doc.model.BindPoses, original.BindPoses); assert.deepEqual(doc.model.Geosets, original.Geosets);
  doc.model.Geosets.forEach((geo, i) => assert.deepEqual(skinGeoset(geo, sampleNodeMatrices(doc.model, 777, -1)), skins[i]));
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `rest-pose.${format}`);
    assert.deepEqual(reopened.model.PivotPoints, authored.PivotPoints);
    assert.deepEqual(reopened.model.BindPoses, original.BindPoses);
    for (const node of allNodes(reopened.model)) {
      const prior = allNodes(original).find(other => other.ObjectId === node.ObjectId);
      for (const property of ['Translation', 'Rotation', 'Scaling', 'EventTrack']) assert.deepEqual(node[property], prior[property]);
    }
  }
  doc.undo(); assert.deepEqual(doc.model.PivotPoints, original.PivotPoints);
  doc.redo(); assert.deepEqual(doc.model.PivotPoints, authored.PivotPoints);
});

test('rest-pose plane moves preserve the perpendicular pivot and reject unsupported/invalid transforms atomically', () => {
  for (const [plane, expected] of [['xy', [5, 9, 6]], ['xz', [5, 4, 13]], ['yz', [2, 9, 13]]]) {
    const model = fixture(); applyRestPoseTransform(model, [1], { values: [3, 5, 7], workplaneEnabled: true, workplane: plane }); nearVector(model.Bones[1].PivotPoint, expected);
  }
  const model = fixture(), original = structuredClone(model);
  assert.throws(() => applyRestPoseTransform(model, [1], { mode: 'rotate', values: [3, 5, 7] }), /position pivots/);
  assert.throws(() => applyRestPoseTransform(model, [1], { values: [Infinity, 5, 7] }), /finite/);
  assert.deepEqual(model, original);
});

test('compact counts use unique selected vertices and direct nonzero bindings, not ancestors or visibility', () => {
  const model = fixture(); model.Geosets = [
    { Vertices: new Float32Array([1, 2, 3, 5, 6, 7, 9, 10, 11]), VertexGroup: [0, 1, 2], Groups: [[1], [0, 1], []] },
    { Vertices: new Float32Array([13, 14, 15, 17, 18, 19]), SkinWeights: new Uint8Array([0, 1, 0, 0, 0, 255, 0, 0, 0, 1, 0, 0, 255, 0, 0, 0]) },
  ];
  assert.equal(movementChildVertexCount(model, [0]), 2);
  assert.equal(movementChildVertexCount(model, [1]), 3);
  assert.equal(movementChildVertexCount(model, [0, 1]), 4);
  const selection = { 0: [0, 0, 2, -1, 99], 1: [0] }, summary = movementSelectionSummary(model, [], selection, { restPose: true });
  assert.equal(summary.selectedCount, 3); assert.equal(summary.source, 'vertices'); nearVector(summary.center, [23 / 3, 26 / 3, 29 / 3]);
  assert.deepEqual(directlyBoundBoneIds(model, selection), [1]);
  assert.equal(movementSelectionSummary(model).center, null);
});

test('coordinates show animated node/vertex positions and return to unanimated pivots in Bones', () => {
  const model = fixture(); model.Geosets = [{ Vertices: new Float32Array([2, 4, 6]), VertexGroup: [0], Groups: [[1]] }];
  const animated = movementSelectionSummary(model, [1], { 0: [0] }, { time: 500, sequenceIndex: 0 });
  nearVector(animated.center, nodePoint(model, 1).toArray()); assert.equal(animated.source, 'nodes'); assert.equal(animated.selectedCount, 1);
  nearVector(movementSelectionSummary(model, [], { 0: [0] }, { time: 500, sequenceIndex: 0 }).center, animated.center);
  nearVector(movementSelectionSummary(model, [1], {}, { time: 500, sequenceIndex: 0, restPose: true }).center, [2, 4, 6]);
});
