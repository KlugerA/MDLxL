import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { sampleMovement } from '../src/movement.js';
import { applyPortraitModelTransform, modelControlGroups, modelControlRoots } from '../src/portrait-model-control.js';

const fixture = () => ({
  Sequences: [
    { Name: 'Stand', Interval: [0, 99] },
    { Name: 'Portrait', Interval: [100, 200] },
    { Name: 'Portrait Talk', Interval: [300, 400] },
  ],
  Bones: [
    { ObjectId: 1, Name: 'Root A', PivotPoint: [0, 0, 0] },
    { ObjectId: 2, Name: 'Root B', PivotPoint: [10, 0, 0] },
    { ObjectId: 3, Name: 'Child', Parent: 2, PivotPoint: [10, 0, 0] },
  ],
  Geosets: [{ Vertices: new Float32Array([0, 0, 0, 10, 0, 0]), VertexGroup: [0, 1], Groups: [[1], [3]] }],
  PivotPoints: [],
});

const posed = (model, frame, sequence) => Array.from(skinGeoset(model.Geosets[0], sampleNodeMatrices(model, frame, sequence)));

test('Control Model selects every root needed by bound geosets and moves both Portrait variants', () => {
  const model = fixture();
  assert.deepEqual(modelControlRoots(model).map(root => root.id), [1, 2]);
  assert.deepEqual(modelControlGroups(model).map(group => group.ids), [[1, 2]]);
  const stand = posed(model, 50, 0), child = structuredClone(model.Bones[2]);
  applyPortraitModelTransform(model, [1, 2], 150, 1, { mode: 'move', space: 'world', values: [0, 5, 0] });
  for (const [frame, sequence] of [[100, 1], [200, 1], [300, 2], [400, 2]]) {
    assert.deepEqual(posed(model, frame, sequence), [0, 5, 0, 10, 5, 0]);
    for (const root of model.Bones.slice(0, 2)) assert.deepEqual(sampleMovement(model, root, 'Translation', frame, sequence), [0, 5, 0]);
  }
  assert.deepEqual(posed(model, 50, 0), stand);
  assert.deepEqual(model.Bones[2], child);
});

test('Control Model offers separate geoset groups and edits only the chosen group', () => {
  const model = fixture();
  model.Geosets = [
    { Vertices: new Float32Array([0, 0, 0]), VertexGroup: [0], Groups: [[1]] },
    { Vertices: new Float32Array([10, 0, 0]), VertexGroup: [0], Groups: [[3]] },
  ];
  assert.deepEqual(modelControlGroups(model), [
    { ids: [1], geosetIndices: [0] },
    { ids: [2], geosetIndices: [1] },
  ]);
  const first = structuredClone(model.Bones[0]), child = structuredClone(model.Bones[2]);
  applyPortraitModelTransform(model, [2], 150, 1, { mode: 'move', space: 'world', values: [0, 5, 0] });
  assert.deepEqual(model.Bones[0], first);
  assert.deepEqual(model.Bones[2], child);
  for (const [frame, sequence] of [[100, 1], [200, 1], [300, 2], [400, 2]]) {
    assert.deepEqual(Array.from(skinGeoset(model.Geosets[0], sampleNodeMatrices(model, frame, sequence))), [0, 0, 0]);
    assert.deepEqual(Array.from(skinGeoset(model.Geosets[1], sampleNodeMatrices(model, frame, sequence))), [10, 5, 0]);
  }
});

test('Control Model rotates separate root trees together around their shared center', () => {
  const model = fixture(), child = structuredClone(model.Bones[2]);
  applyPortraitModelTransform(model, [1, 2], 150, 1, { mode: 'rotate', space: 'world', axis: 'Z', amount: 180 });
  for (const [frame, sequence] of [[100, 1], [200, 1], [300, 2], [400, 2]]) {
    const vertices = posed(model, frame, sequence);
    assert.ok(Math.abs(vertices[0] - 10) < 1e-5);
    assert.ok(Math.abs(vertices[3]) < 1e-5);
    assert.ok(Math.abs(vertices[1]) < 1e-5 && Math.abs(vertices[4]) < 1e-5);
  }
  assert.deepEqual(model.Bones[2], child);
  assert.deepEqual(posed(model, 50, 0), [0, 0, 0, 10, 0, 0]);
});
