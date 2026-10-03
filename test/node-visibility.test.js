import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { nodeVisibilityTargets, setNodeVisibility } from '../src/node-visibility.js';
import { classicTimelineTargets } from '../src/classic-keyframes.js';

function fixture() {
  const doc = createDemoDocument();
  let id;
  doc.apply('Fixture', ['Sequences', 'Nodes', 'PivotPoints'], model => {
    model.Sequences[0].Interval = new Uint32Array([100, 1100]);
    const node = createNode(model, 'ParticleEmitter2'); node.Name = 'Visibility test'; id = node.ObjectId;
  });
  return { doc, model: doc.model, id };
}
test('node quick controls author a native key, preserving other channels and undo/save boundaries', () => {
  const { doc, model, id } = fixture(), original = doc.serialize('mdx');
  const before = structuredClone(model.Nodes[id]);
  doc.apply('Hide emitter', ['Nodes', 'GeosetAnims'], m => setNodeVisibility(m, [id], { sequenceIndex: 0, frame: 550, amount: 0 }));
  assert.deepEqual(model.Nodes[id].Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), [[100, 1], [550, 0]]);
  const { Visibility, ...unchanged } = model.Nodes[id]; assert.deepEqual(unchanged, before);
  for (const format of ['mdx', 'mdl']) assert.equal(openDocument(doc.serialize(format), `node.${format}`).model.Nodes[id].Visibility.Keys.at(-1).Vector[0], 0);
  doc.undo(); assert.deepEqual(doc.serialize('mdx'), original);
});
test('node timeline targets include visibility only; bone visibility follows actual skin bindings', () => {
  const { model, id } = fixture();
  const targets = classicTimelineTargets(model, { nodeIds: [id], geosetIds: [0], activeController: 'nodeVisibility' });
  assert.deepEqual(targets.map(t => [t.kind, t.id, t.property]), [['node', id, 'Visibility']]);
  const boneId = model.Geosets[0].Groups[model.Geosets[0].VertexGroup[0]][0];
  const meshes = nodeVisibilityTargets(model, [boneId]);
  assert.ok(meshes.length); assert.ok(meshes.every(t => t.kind === 'geoset' && t.property === 'Alpha'));
  setNodeVisibility(model, [boneId], { sequenceIndex: 0, range: [100, 1100], amount: 0 });
  assert.equal(model.Nodes[boneId].Visibility, undefined);
  assert.ok(model.GeosetAnims.some(a => a.Alpha?.Keys?.[0].Vector[0] === 0));
});
test('global node visibility requires its clock and preserves the endpoint', () => {
  const { model, id } = fixture(); model.GlobalSequences = [1000];
  model.Nodes[id].Visibility = { LineType: 0, GlobalSeqId: 0, Keys: [0, 1000].map(Frame => ({ Frame, Vector: new Float32Array([1]) })) };
  assert.throws(() => setNodeVisibility(model, [id], { sequenceIndex: 0, frame: 500, amount: 0 }), /clock/);
  setNodeVisibility(model, [id], { sequenceIndex: -1, globalSeqId: 0, range: [0, 1000], amount: 0 });
  assert.deepEqual(model.Nodes[id].Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), [[0, 0], [1000, 0]]);
  assert.equal(model.Nodes[id].Visibility.GlobalSeqId, 0);
});

test('separate key selection changes only existing keys on each selected owner', () => {
  const { model, id } = fixture(), other = createNode(model, 'Attachment');
  const key = Frame => ({ Frame, Vector: new Float32Array([1]) });
  model.Nodes[id].Visibility = { LineType: 0, Keys: [key(100), key(300)] };
  other.Visibility = { LineType: 0, Keys: [key(100), key(700)] };
  setNodeVisibility(model, [id, other.ObjectId], { sequenceIndex: 0, frames: [300, 700], amount: 0 });
  assert.deepEqual(model.Nodes[id].Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), [[100, 1], [300, 0]]);
  assert.deepEqual(other.Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), [[100, 1], [700, 0]]);
});
