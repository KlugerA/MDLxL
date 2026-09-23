import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { createNode, openDocument } from '../src/editor-document.js';
import { attachToBone, boneVertexHighlights, changeVertexBinding, createRigNode, deleteRigBone, deleteRigNode, detachFromBone, renameRigNode, selectedVertexCenter, setBoneBillboarded } from '../src/bone-tools.js';
import { markerStyle } from '../app/rig-markers-gl.js';

test('rig creation uses selected vertex center and sequential names', () => {
  const doc = createStarterDocument();
  const selection = { 0: [0, 1] };
  assert.deepEqual(selectedVertexCenter(doc.model, selection), [0, -32, -32]);
  const first = doc.apply('Create bone', [], model => createRigNode(model, 'Bone', selection));
  assert.equal(first.Name, 'bone_new0');
  assert.deepEqual([...first.PivotPoint], [0, -32, -32]);
  const second = doc.apply('Create bone', [], model => createRigNode(model, 'Bone'));
  assert.equal(second.Name, 'bone_new1');
  assert.deepEqual([...second.PivotPoint], [0, 0, 0]);
  const attachment = doc.apply('Create attachment', [], model => createRigNode(model, 'Attachment', selection));
  assert.equal(attachment.Name, 'New Ref');
  assert.deepEqual([...attachment.PivotPoint], [0, -32, -32]);
});

test('only bones can be targets, cycles are rejected, and detaching leaves a root', () => {
  const doc = createStarterDocument(), model = doc.model;
  const child = createRigNode(model, 'Bone'), attachment = createRigNode(model, 'Attachment');
  attachToBone(model, child.ObjectId, model.Bones[0].ObjectId);
  attachToBone(model, attachment.ObjectId, child.ObjectId);
  assert.throws(() => attachToBone(model, child.ObjectId, attachment.ObjectId), /parent bone/);
  assert.throws(() => attachToBone(model, model.Bones[0].ObjectId, child.ObjectId), /descendant/);
  detachFromBone(model, child.ObjectId);
  assert.equal(child.Parent, null);
  assert.equal(attachment.Parent, child.ObjectId);
});

test('soft, hard, detach-vertices and delete preserve unrelated vertices and clear links', () => {
  const doc = createStarterDocument(), root = doc.model.Bones[0].ObjectId;
  const added = doc.apply('Create bone', [], model => createRigNode(model, 'Bone'));
  doc.apply('Attach', [], model => attachToBone(model, added.ObjectId, root));
  doc.apply('Soft bind', [], model => changeVertexBinding(model, model.Geosets[0], [0], added.ObjectId, 'soft'));
  assert.deepEqual(doc.model.Geosets[0].Groups[doc.model.Geosets[0].VertexGroup[0]], [root, added.ObjectId]);
  assert.deepEqual(doc.model.Geosets[0].Groups[doc.model.Geosets[0].VertexGroup[1]], [root]);
  doc.apply('Detach vertex', [], model => changeVertexBinding(model, model.Geosets[0], [0], root, 'detach'));
  assert.deepEqual(doc.model.Geosets[0].Groups[doc.model.Geosets[0].VertexGroup[0]], [added.ObjectId]);
  doc.apply('Hard bind', [], model => changeVertexBinding(model, model.Geosets[0], [0], root, 'hard'));
  assert.deepEqual(doc.model.Geosets[0].Groups[doc.model.Geosets[0].VertexGroup[0]], [root]);
  const child = doc.apply('Create child', [], model => createRigNode(model, 'Attachment'));
  doc.apply('Attach child', [], model => attachToBone(model, child.ObjectId, added.ObjectId));
  doc.apply('Delete bone', [], model => deleteRigBone(model, added.ObjectId));
  assert.equal(doc.model.Nodes[child.ObjectId].Parent, null);
  assert.ok(doc.model.Geosets[0].Groups.every(group => !group.includes(added.ObjectId)));
  assert.equal(openDocument(doc.serialize('mdx')).readOnly, false);
  doc.undo();
  assert.ok(doc.model.Bones.some(bone => bone.ObjectId === added.ObjectId));
});

test('root and child bone marker colors follow parent bone membership', () => {
  const root = { node: { ObjectId: 1, Parent: null }, overlayKind: 'bones' };
  const child = { node: { ObjectId: 2, Parent: 1 }, overlayKind: 'bones' };
  const byId = new Map([[1, root], [2, child]]);
  assert.equal(markerStyle(root, byId, {}).color, '#4cb259');
  assert.equal(markerStyle(child, byId, {}).color, '#4cff59');
});

test('billboarding and renaming edit only the selected bone or node', () => {
  const doc = createStarterDocument(), model = doc.model, bone = model.Bones[0];
  const oldFlags = bone.Flags;
  setBoneBillboarded(model, bone.ObjectId, true);
  assert.equal(!!(bone.Flags & 8), true);
  assert.equal(!!(openDocument(doc.serialize('mdx')).model.Bones[0].Flags & 8), true);
  setBoneBillboarded(model, bone.ObjectId, false);
  assert.equal(bone.Flags, oldFlags & ~120);
  assert.equal(renameRigNode(model, bone.ObjectId, '  New Bone  '), 'New Bone');
  assert.equal(bone.Name, 'New Bone');
  assert.throws(() => renameRigNode(model, bone.ObjectId, '  '), /empty/);
  const attachment = createRigNode(model, 'Attachment');
  renameRigNode(model, attachment.ObjectId, 'Anchor');
  assert.equal(attachment.Name, 'Anchor');
  assert.throws(() => setBoneBillboarded(model, attachment.ObjectId, true), /bone/);
});

test('delete accepts attachments, emitters and helper nodes without affecting other nodes', () => {
  const model = createStarterDocument().model;
  const attachment = createRigNode(model, 'Attachment');
  const emitter = createNode(model, 'ParticleEmitter2');
  const helper = createNode(model, 'Helper');
  for (const node of [attachment, emitter, helper]) {
    deleteRigNode(model, node.ObjectId);
    assert.equal(model.Nodes[node.ObjectId], undefined);
  }
  assert.ok(model.Bones.length);
});

test('selected bone vertices are black and vertices bound only to child bones are grey', () => {
  const model = createStarterDocument().model, root = model.Bones[0].ObjectId;
  const child = createRigNode(model, 'Bone');
  attachToBone(model, child.ObjectId, root);
  changeVertexBinding(model, model.Geosets[0], [0], child.ObjectId, 'hard');
  const colors = boneVertexHighlights(model, [root]).get(0);
  assert.equal(colors.get(0), '#808080');
  assert.equal(colors.get(1), '#000000');
  assert.equal(boneVertexHighlights(model, [root, child.ObjectId]).get(0).get(0), '#000000');
});

test('skin weights add and remove only the selected bone while retaining a valid total', () => {
  const doc = createStarterDocument(1000), root = doc.model.Bones[0].ObjectId;
  const added = doc.apply('Create bone', [], model => createRigNode(model, 'Bone'));
  doc.apply('Add skin weights', [], model => {
    const geoset = model.Geosets[0];
    geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
    for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) geoset.SkinWeights.set([root, 0, 0, 0, 255, 0, 0, 0], vertex * 8);
  });
  doc.apply('Soft bind', [], model => changeVertexBinding(model, model.Geosets[0], [0], added.ObjectId, 'soft'));
  let skin = doc.model.Geosets[0].SkinWeights;
  assert.ok(skin[4] > 0 && skin[5] > 0);
  assert.equal(skin[4] + skin[5], 255);
  assert.deepEqual([...skin.slice(8, 16)], [root, 0, 0, 0, 255, 0, 0, 0]);
  doc.apply('Detach vertices', [], model => changeVertexBinding(model, model.Geosets[0], [0], root, 'detach'));
  skin = doc.model.Geosets[0].SkinWeights;
  assert.equal(skin[0], added.ObjectId);
  assert.equal(skin[4], 255);
  doc.apply('Delete added bone', [], model => deleteRigBone(model, added.ObjectId));
  skin = doc.model.Geosets[0].SkinWeights;
  assert.deepEqual([...skin.slice(0, 8)], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...skin.slice(8, 16)], [root, 0, 0, 0, 255, 0, 0, 0]);
  assert.equal(openDocument(doc.serialize('mdx')).readOnly, false);
});

test('rig edits keep existing bind-pose matrix slots and round-trip MDX1000', () => {
  const doc = createStarterDocument(1000);
  const original = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 4, 5, 6]);
  doc.apply('Add bind pose', [], model => { model.BindPoses = [{ Matrices: [original] }]; });
  const created = doc.apply('Create bone', [], model => createRigNode(model, 'Bone'));
  assert.deepEqual([...doc.model.BindPoses[0].Matrices[0]], [...original]);
  assert.equal(doc.model.BindPoses[0].Matrices.length, 2);
  doc.apply('Delete bone', [], model => deleteRigBone(model, created.ObjectId));
  assert.equal(doc.model.BindPoses[0].Matrices.length, 1);
  assert.deepEqual([...doc.model.BindPoses[0].Matrices[0]], [...original]);
  const reopened = openDocument(doc.serialize('mdx'), 'bindpose.mdx');
  assert.equal(reopened.readOnly, false);
  assert.deepEqual([...reopened.model.BindPoses[0].Matrices[0]], [...original]);
});
