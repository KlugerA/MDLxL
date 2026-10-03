import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, deleteNode, openDocument, EditorDocument } from '../src/editor-document.js';
import { canonicalizeSerializedNodeOrder, serializedNodes } from '../src/node-id-order.js';
import { formatGeneratedMdl, mdlMembers } from '../src/mdl-compatibility.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { createStarterDocument } from '../src/starter-model.js';
import { parseMdx } from '../src/mdx-container.js';
import { mdxRecords, readTrack } from '../src/mdx-compatibility.js';

const f = (...values) => Float32Array.from(values);
const expectedSave = model => {
  const result = structuredClone(model);
  if (serializedNodes(result).some((node, index) => node.ObjectId !== index)) canonicalizeSerializedNodeOrder(result, { preserveUnusedPivots: true });
  return result;
};
function verify(doc, format) {
  const before = structuredClone(doc.model), history = doc.historyStats;
  const bytes = doc.serialize(format), reopened = openDocument(bytes, `saved.${format}`);
  assert.equal(reopened.readOnly, false);
  assertModelEquivalent(expectedSave(before), reopened.model);
  assert.deepEqual(doc.model, before, 'saving must not renumber the live document');
  assert.deepEqual(doc.historyStats, history, 'saving must not change undo history');
  assert.deepEqual(serializedNodes(reopened.model).map(node => node.ObjectId), serializedNodes(reopened.model).map((_, index) => index));
  if (format === 'mdl') {
    const ids = mdlMembers(bytes).members.flatMap(member => member.children?.filter(child => child.name === 'ObjectId').map(child => Number(child.header[1].raw.toString())) || []);
    assert.deepEqual(ids, ids.map((_, index) => index), 'MDL encounter order must agree with IDs, including newly introduced families');
  }
  return bytes;
}

for (const format of ['mdx', 'mdl']) test(`${format}: every Classic node family survives repeated saves, async edits, recovery and undo`, () => {
  const doc = openDocument(createDemoDocument().serialize(format), `base.${format}`);
  for (const type of ['Helper', 'EventObject', 'ParticleEmitter2', 'Bone', 'Light', 'Attachment', 'RibbonEmitter', 'ParticleEmitter', 'CollisionShape']) {
    doc.apply('Create ' + type, [], model => {
      const node = createNode(model, type); node.Name = 'Added ' + type; node.Parent = model.Bones[0].ObjectId;
      node.PivotPoint.set([node.ObjectId, 2, 3]);
      node.Translation = { LineType: 2, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: f(1, 2, 3), InTan: f(4, 5, 6), OutTan: f(7, 8, 9) }] };
      if (type === 'Bone') model.Geosets[0].Groups[0] = [node.ObjectId];
    });
    const bytes = verify(doc, format);
    doc.apply('Edit during save', ['Info'], model => { model.Info.Name += '!'; });
    doc.markSaved(bytes, `saved.${format}`);
    assert.equal(doc.dirty, true);
    const current = verify(doc, format); doc.markSaved(current, `saved.${format}`);
    assert.equal(doc.dirty, false);
    assert.deepEqual(doc.serialize(format), current, 'an unchanged save keeps the already verified bytes');
    for (const compact of [false, true]) verify(EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ compact })), format);
  }
  doc.apply('Delete helper', [], model => deleteNode(model, model.Helpers.find(node => node.Name === 'Added Helper').ObjectId));
  verify(doc, format); doc.undo(); verify(doc, format); doc.redo(); verify(doc, format);
});

test('node permutation retains skin weights, camera bind poses and unused pivots', () => {
  const model = createDemoDocument().model; model.Version = 1000;
  createNode(model, 'Helper'); const bone = createNode(model, 'Bone');
  model.Cameras = [{ Name: 'camera' }];
  model.BindPoses = [{ Matrices: [...model.Nodes.map(node => f(1, 0, 0, 0, 1, 0, 0, 0, 1, node.ObjectId, 2, 3)), f(1, 0, 0, 0, 1, 0, 0, 0, 1, 77, 88, 99)] }];
  model.PivotPoints.push(f(101, 102, 103));
  const geoset = model.Geosets[0]; geoset.SkinWeights = Uint8Array.of(bone.ObjectId, 0, 0, 0, 255, 0, 0, 0);
  const cameraPose = model.BindPoses[0].Matrices.at(-1), nodePose = model.BindPoses[0].Matrices[bone.ObjectId];
  canonicalizeSerializedNodeOrder(model, { preserveUnusedPivots: true });
  assert.equal(geoset.SkinWeights[0], bone.ObjectId);
  assert.deepEqual(model.BindPoses[0].Matrices[bone.ObjectId], nodePose);
  assert.deepEqual(model.BindPoses[0].Matrices.at(-1), cameraPose);
  assert.deepEqual(model.PivotPoints.at(-1), f(101, 102, 103));
});

test('MDL layout keeps strings literal and distinguishes tuples from numeric list blocks', () => {
  const text = 'Model "path { literal }" { AnimationFile "folder\\end\\", } GlobalSequences 2 { Duration 100, Duration 200, } Geoset { VertexGroup { 0, 1, } Faces 1 3 { Triangles { { 0, 1, 2 }, } } }';
  const formatted = formatGeneratedMdl(text).toString();
  assert.match(formatted, /Model "path \{ literal \}"/);
  assert.ok(formatted.includes('AnimationFile "folder\\end\\",'));
  assert.match(formatted, /VertexGroup \{\n\t\t0,\n\t\t1,\n\t\}/);
  assert.match(formatted, /Faces 1 3 \{\n\t\tTriangles \{\n\t\t\t\{ 0, 1, 2 \},/);
});

test('Popcorn zero static values survive MDL export instead of becoming default one', () => {
  const doc = createStarterDocument(1000);
  doc.apply('Add Popcorn', [], model => {
    const node = createNode(model, 'ParticleEmitterPopcorn');
    for (const field of ['LifeSpan','EmissionRate','Speed','Alpha']) node[field] = 0;
  });
  for (const format of ['mdx','mdl']) {
    const saved = openDocument(doc.serialize(format));
    for (const field of ['LifeSpan','EmissionRate','Speed','Alpha']) assert.equal(saved.model.ParticleEmitterPopcorns[0][field], 0);
  }
});

test('Reforged Popcorn IDs precede ribbons and events in both save formats', () => {
  const doc = createStarterDocument(1000);
  doc.apply('Mixed nodes', [], model => {
    for (const type of ['RibbonEmitter', 'EventObject', 'ParticleEmitterPopcorn', 'Bone']) createNode(model, type);
  });
  for (const format of ['mdx','mdl']) verify(doc, format);
});

test('editing existing MDL repairs encounter order even when its numeric IDs are already canonical', () => {
  const source = createStarterDocument();
  source.apply('Helper', [], model => createNode(model, 'Helper'));
  const bytes = Buffer.from(source.serialize('mdl')), members = mdlMembers(bytes).members;
  const bone = members.find(m => m.name === 'Bone'), helper = members.find(m => m.name === 'Helper');
  const reordered = Buffer.concat([bytes.subarray(0,bone.start), bytes.subarray(helper.start,helper.end), bytes.subarray(bone.end,helper.start), bytes.subarray(bone.start,bone.end), bytes.subarray(helper.end)]);
  const doc = openDocument(reordered, 'encounter-order.mdl');
  assert.deepEqual(Buffer.from(doc.serialize()), reordered, 'untouched source stays exact');
  doc.apply('Rename model', ['Info'], model => { model.Info.Name = 'Edited'; });
  verify(doc, 'mdl');
});

test('MDX PRE2 static slots follow Hive length/width order even with one animated dimension', () => {
  for (const animated of [null, 'Width', 'Length']) {
    const doc = createStarterDocument();
    doc.apply('Unequal emitter dimensions', [], model => {
      const n = createNode(model, 'ParticleEmitter2'); n.Length = 13; n.Width = 29;
      if (animated) { const value = n[animated]; n._MdxDefaults = { [animated]: value }; n[animated] = { LineType: 0, GlobalSeqId: null, Keys: [{Frame:0, Vector:f(value+2)}] }; }
    });
    const bytes = Buffer.from(verify(doc, 'mdx')), chunk = parseMdx(bytes).chunks.find(c => c.tag === 'PRE2');
    const record = mdxRecords(bytes.subarray(chunk.payloadOffset, chunk.payloadOffset+chunk.declaredSize), 'PRE2')[0], at = 4+record.readUInt32LE(4);
    assert.equal(record.readFloatLE(at+24), 13); assert.equal(record.readFloatLE(at+28), 29);
  }
});

test('MDX classic animated colors and tangents are BGR while live colors stay RGB', () => {
  const doc = createStarterDocument();
  doc.apply('Colored nodes', [], model => {
    for (const type of ['Light', 'RibbonEmitter']) {
      const n = createNode(model, type);
      n.Color = { LineType: 3, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: f(.125,.25,.5), InTan: f(.25,.5,.75), OutTan: f(.5,.75,1) }] };
      if (type === 'Light') n.AmbColor = structuredClone(n.Color);
    }
  });
  const bytes = Buffer.from(verify(doc, 'mdx'));
  for (const tag of ['KLAC','KLBC','KRCO']) {
    const { track } = readTrack(bytes, bytes.indexOf(tag), 3);
    assert.deepEqual(track.Keys[0].Vector, f(.5,.25,.125));
    assert.deepEqual(track.Keys[0].InTan, f(.75,.5,.25));
    assert.deepEqual(track.Keys[0].OutTan, f(1,.75,.5));
  }
});
