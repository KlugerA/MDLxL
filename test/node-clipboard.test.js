import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument, validateModel } from '../src/editor-document.js';
import { captureNodeSelection, pasteNodesToDummy } from '../src/node-clipboard.js';

test('selected nodes paste beneath one validated DummyBone and preserve selected hierarchy only', () => {
  const source = createDemoDocument(), root = createNode(source.model, 'Helper'), child = createNode(source.model, 'Bone'), omitted = createNode(source.model, 'Helper');
  root.Name = 'Copied Root'; child.Name = 'Copied Child'; omitted.Name = 'Not Copied'; child.Parent = root.ObjectId; root.Parent = omitted.ObjectId;
  root.Translation = { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([1, 2, 3]) }] };
  const clipboard = captureNodeSelection(source.model, [child.ObjectId, root.ObjectId]), target = createDemoDocument();
  const result = target.apply('Paste nodes', ['Nodes', 'PivotPoints'], model => pasteNodesToDummy(model, clipboard));
  const pastedRoot = target.model.Nodes[result.nodeMap[root.ObjectId]], pastedChild = target.model.Nodes[result.nodeMap[child.ObjectId]];
  assert.equal(pastedRoot.Parent, result.dummyId); assert.equal(pastedChild.Parent, pastedRoot.ObjectId);
  assert.deepEqual(pastedRoot.Translation, root.Translation);
  assert.equal(target.model.Nodes.filter(Boolean).some(node => node.Name === omitted.Name), false);
  assert.equal(target.model.Bones.filter(node => node.Name === 'DummyBone').length, 1);
  assert.deepEqual(validateModel(target.model).filter(issue => issue.severity === 'error'), []);
  for (const format of ['mdl', 'mdx']) assert.equal(openDocument(target.serialize(format), `nodes.${format}`).diagnostics.some(issue => issue.severity === 'error'), false);
});

test('an occupied or malformed DummyBone rejects node and BitsAndParts imports without partial edits', async () => {
  const source = createDemoDocument(), copied = createNode(source.model, 'Helper'), clipboard = captureNodeSelection(source.model, [copied.ObjectId]);
  const target = createDemoDocument();
  target.apply('Occupy DummyBone', ['Nodes', 'PivotPoints'], model => { const occupied = createNode(model, 'Bone'); occupied.Name = 'DummyBone'; occupied.GeosetId = 0; });
  const before = target.serialize('mdx');
  assert.throws(() => target.apply('Unsafe paste', [], model => pasteNodesToDummy(model, clipboard)), /already owns/);
  assert.deepEqual(target.serialize('mdx'), before);
  const { commitPart } = await import('../src/bits-and-parts.js');
  assert.throws(() => target.apply('Unsafe part', [], model => commitPart(model, source.model)), /already owns/);
  assert.deepEqual(target.serialize('mdx'), before);
});
