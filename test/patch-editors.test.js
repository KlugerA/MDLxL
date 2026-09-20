import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Euler } from 'three';
import { directlyBoundBoneIds } from '../src/binding-inspection.js';
import { nodeHierarchyRows, visibleNodeRows, relatedResourceIndices } from '../src/node-hierarchy.js';
import { particleAnimatedParameters, particleUVGroups, particlePreviewModel, particleRotationDegrees, setParticleRotationDegrees } from '../src/particle-editing.js';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';

test('direct bindings deduplicate SD groups and weighted HD influences, never infer ancestors', () => {
  const model = { Bones: [{ ObjectId: 0 }, { ObjectId: 2, Parent: 0 }, { ObjectId: 7, Parent: 2 }], Helpers: [{ ObjectId: 8 }], Geosets: [
    { Vertices: new Float32Array(9), VertexGroup: [0, 1, 2], Groups: [[2, 8], [7, 2], [0]] },
    { Vertices: new Float32Array(6), VertexGroup: [0, 0], Groups: [[0]], SkinWeights: new Uint8Array([7, 0, 8, 2, 255, 0, 0, 0, 0, 2, 7, 0, 64, 191, 0, 0]) },
  ] };
  const before = structuredClone(model);
  assert.deepEqual(directlyBoundBoneIds(model, { 0: [0, 1, 1, -1, 99], 1: [0] }), [2, 7]);
  assert.deepEqual(directlyBoundBoneIds(model, { 0: [2], 1: [1] }), [0, 2]); // directly bound parent stays
  assert.deepEqual(directlyBoundBoneIds(model, {}), []);
  assert.deepEqual(model, before);
});

test('tree collapse hides descendants once, keeps stable identities and handles cycles', () => {
  const model = { Bones: [{ ObjectId: 0, Name: 'Root' }, { ObjectId: 3, Parent: 0 }, { ObjectId: 5, Parent: 3 }, { ObjectId: 8, Parent: 0 }, { ObjectId: 9, Parent: 10 }, { ObjectId: 10, Parent: 9 }] };
  const before = structuredClone(model), rows = nodeHierarchyRows(model);
  assert.deepEqual(rows.map(row => row.index), [0, 3, 5, 8, 9, 10]);
  assert.deepEqual(visibleNodeRows(rows, new Set([3])).map(row => row.index), [0, 3, 8, 9, 10]);
  assert.deepEqual(visibleNodeRows(rows, new Set([0])).map(row => row.index), [0, 9, 10]);
  assert.deepEqual(rows.find(row => row.index === 5).ancestors, [0, 3]);
  assert.equal(new Set(rows.map(row => row.index)).size, 6);
  assert.deepEqual(model, before);
});

test('picked geosets map many-to-one materials and every geoset-animation record', () => {
  const model = { Geosets: [{ MaterialID: 1 }, { MaterialID: 1 }, { MaterialID: 0 }], Materials: [{}, {}], GeosetAnims: [{ GeosetId: 0 }, { GeosetId: 0 }, { GeosetId: 2 }] };
  assert.deepEqual(relatedResourceIndices(model, 0, 'GeosetAnims'), [0, 1]);
  assert.deepEqual(relatedResourceIndices(model, 1, 'GeosetAnims'), []);
  assert.deepEqual(relatedResourceIndices(model, 0, 'Materials'), [1]);
  assert.deepEqual(relatedResourceIndices(model, 1, 'Materials'), [1]);
  assert.deepEqual(relatedResourceIndices(model, 8, 'Geosets'), []);
});

test('particle XYZ writes one local rotation key, preserves channels/tangents and maps global time', () => {
  const doc = createDemoDocument(), model = doc.model, node = createNode(model, 'ParticleEmitter2');
  node.Rotation = { LineType: 2, GlobalSeqId: 0, Keys: [{ Frame: 25, Vector: new Float32Array([0, 0, 0, 1]), InTan: new Float32Array([0, 0, 0, 1]), OutTan: new Float32Array([0, 0, 0, 1]) }] };
  model.GlobalSequences = [100];
  const original = structuredClone(node);
  assert.equal(setParticleRotationDegrees(model, node.ObjectId, 225, 0, [25, 35, 45]), 25);
  assert.equal(node.Rotation.Keys.length, 1);
  assert.deepEqual(node.Rotation.Keys[0].InTan, original.Rotation.Keys[0].InTan);
  const angles = particleRotationDegrees(model, node, 225, 0);
  angles.forEach((angle, index) => assert.ok(Math.abs(angle - [25, 35, 45][index]) < 0.0001));
  assert.equal(node.Speed, original.Speed);
  assert.deepEqual(node.SegmentColor, original.SegmentColor);
});

test('all PE2 parameter groups and rotation survive undo/redo and MDL/MDX save/reopen', () => {
  for (const format of ['mdl', 'mdx']) {
    const doc = createDemoDocument();
    const id = doc.apply('Create emitter', ['Nodes', 'PivotPoints', 'Info'], model => createNode(model, 'ParticleEmitter2').ObjectId);
    const before = structuredClone(doc.model.ParticleEmitters2.find(node => node.ObjectId === id));
    doc.apply('Edit particle fields', ['Nodes'], model => {
      const emitter = model.ParticleEmitters2.find(node => node.ObjectId === id);
      for (const [i, property] of particleAnimatedParameters.entries()) emitter[property] = { LineType: 1, Keys: [{ Frame: 0, Vector: new Float32Array([i + 1]) }, { Frame: 1000, Vector: new Float32Array([i + 2]) }] };
      for (const [, property] of particleUVGroups) emitter[property] = new Uint32Array([1, 3, 2]);
      emitter.ReplaceableId = 0; emitter.FilterMode = 4; emitter.FrameFlags = 3; emitter.Time = 0.4;
      emitter.SegmentColor = [[0.2, 0.3, 0.4], [0.5, 0.6, 0.7], [0.8, 0.9, 1]].map(color => new Float32Array(color));
      emitter.Alpha = new Uint8Array([255, 128, 0]); emitter.ParticleScaling = new Float32Array([2, 4, 1]);
      setParticleRotationDegrees(model, id, 0, 0, [30, 45, 60]);
    });
    const authored = structuredClone(doc.model.ParticleEmitters2.find(node => node.ObjectId === id));
    const reopened = openDocument(doc.serialize(format), `particle.${format}`).model.ParticleEmitters2.find(node => node.ObjectId === id);
    for (const property of particleAnimatedParameters) assert.deepEqual(reopened[property].Keys.map(key => Array.from(key.Vector)), authored[property].Keys.map(key => Array.from(key.Vector)));
    for (const [, property] of particleUVGroups) assert.deepEqual(Array.from(reopened[property]), [1, 3, 2]);
    assert.equal(reopened.FilterMode, 4); assert.equal(reopened.FrameFlags, 3);
    assert.deepEqual(Array.from(reopened.Alpha), [255, 128, 0]);
    const q = new Quaternion().fromArray(reopened.Rotation.Keys[0].Vector), expected = new Quaternion().setFromEuler(new Euler(Math.PI / 6, Math.PI / 4, Math.PI / 3));
    assert.ok(q.angleTo(expected) < 0.001);
    doc.undo(); assert.deepEqual(doc.model.ParticleEmitters2.find(node => node.ObjectId === id), before);
    doc.redo(); assert.deepEqual(doc.model.ParticleEmitters2.find(node => node.ObjectId === id), authored);
  }
});

test('particle preview isolates effects and geometry without mutating document state', () => {
  const doc = createDemoDocument(), one = createNode(doc.model, 'ParticleEmitter2'), two = createNode(doc.model, 'ParticleEmitter2');
  const before = structuredClone(doc.model), preview = particlePreviewModel(doc.model, one.ObjectId, true);
  assert.deepEqual(preview.ParticleEmitters2.map(node => node.ObjectId), [one.ObjectId]);
  assert.equal(preview.Geosets.length, 0);
  preview.ParticleEmitters2[0].Speed = 999;
  assert.deepEqual(doc.model, before);
  assert.notEqual(one.ObjectId, two.ObjectId);
});
