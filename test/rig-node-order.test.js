import test from 'node:test';
import assert from 'node:assert/strict';
import { createNode } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { rigNodeListGroups } from '../src/rig-node-order.js';

function skeletonFixture() {
  const model = createStarterDocument().model, root = model.Bones[0];
  root.Name = 'Bone_Root';
  const add = (type, name, parent, values) => {
    const node = createNode(model, type);
    node.Name = name; node.Parent = parent?.ObjectId ?? null;
    node.PivotPoint.set(values); model.PivotPoints[node.ObjectId] = node.PivotPoint;
    return node;
  };
  const chest = add('Helper', 'Bone_Chest', root, [0, 0, 72]);
  const armR1 = add('Helper', 'Bone_Arm1_R', chest, [0, -24, 68]);
  const armR2 = add('Helper', 'Bone_Arm2_R', armR1, [0, -48, 58]);
  const armL1 = add('Helper', 'Bone_Arm1_L', chest, [0, 24, 68]);
  const legR1 = add('Helper', 'Bone_Leg1_R', root, [0, -15, 32]);
  const footR = add('Helper', 'Bone_Foot_R', legR1, [0, -18, 4]);
  const legL1 = add('Helper', 'Bone_Leg1_L', root, [0, 15, 32]);
  add('Bone', 'MeshChest', chest, [0, 0, 72]);
  add('Bone', 'MeshArmR1', armR1, [0, -24, 68]);
  add('Bone', 'MeshArmR2', armR2, [0, -48, 58]);
  add('Bone', 'ObjectArmL1', armL1, [0, 24, 68]);
  add('Bone', 'MeshLegR1', legR1, [0, -15, 32]);
  add('Bone', 'MeshFootR', footR, [0, -18, 4]);
  add('Bone', 'MeshLegL1', legL1, [0, 15, 32]);
  add('Attachment', 'Chest Ref', chest, [0, 0, 76]);
  return model;
}

test('rig dropdown orders anatomical bone chains first and leaves Helpers at the bottom', () => {
  const model = skeletonFixture(), before = structuredClone(model), groups = rigNodeListGroups(model);
  assert.deepEqual(groups.bones.map(node => node.Name), [
    'MeshChest', 'MeshArmR1', 'MeshArmR2', 'ObjectArmL1', 'MeshLegR1', 'MeshFootR', 'MeshLegL1', 'Bone_Root',
  ]);
  assert.deepEqual(groups.others.map(node => node.Name), ['Chest Ref']);
  assert.deepEqual(groups.helpers.map(node => node.Name), [
    'Bone_Chest', 'Bone_Arm1_R', 'Bone_Arm2_R', 'Bone_Arm1_L', 'Bone_Leg1_R', 'Bone_Foot_R', 'Bone_Leg1_L',
  ]);
  assert.deepEqual(model, before, 'organizing the list must not edit model data');
});

test('hierarchy and skeleton layout can outweigh a misleading name', () => {
  const model = skeletonFixture(), leg = model.Helpers.find(node => node.Name === 'Bone_Leg1_R');
  const misleading = createNode(model, 'Bone');
  misleading.Name = 'ArmR9'; misleading.Parent = leg.ObjectId;
  misleading.PivotPoint.set([0, -16, 18]); model.PivotPoints[misleading.ObjectId] = misleading.PivotPoint;
  const names = rigNodeListGroups(model).bones.map(node => node.Name);
  assert.ok(names.indexOf('ArmR9') > names.indexOf('ObjectArmL1'));
  assert.ok(names.indexOf('ArmR9') < names.indexOf('MeshLegL1'));
});

test('actual mesh influence breaks ties between bones in the same anatomical slot', () => {
  const model = skeletonFixture(), chest = model.Helpers.find(node => node.Name === 'Bone_Chest');
  const lightlyUsed = createNode(model, 'Bone'), heavilyUsed = createNode(model, 'Bone');
  lightlyUsed.Name = 'Chest Detail A'; heavilyUsed.Name = 'Chest Detail B';
  lightlyUsed.Parent = heavilyUsed.Parent = chest.ObjectId;
  lightlyUsed.PivotPoint.set([0, 0, 70]); heavilyUsed.PivotPoint.set([0, 0, 70]);
  const geoset = model.Geosets[0];
  geoset.Groups.push([lightlyUsed.ObjectId], [heavilyUsed.ObjectId]);
  geoset.VertexGroup.set([geoset.Groups.length - 2, geoset.Groups.length - 1, geoset.Groups.length - 1]);
  const names = rigNodeListGroups(model).bones.map(node => node.Name);
  assert.ok(names.indexOf('Chest Detail B') < names.indexOf('Chest Detail A'));
});

test('a parent remains before its more heavily influenced child in one chain', () => {
  const model = skeletonFixture(), arm = model.Helpers.find(node => node.Name === 'Bone_Arm2_R');
  const parent = createNode(model, 'Bone'), child = createNode(model, 'Bone');
  parent.Name = 'Hand Chain'; child.Name = 'Hand Chain';
  parent.Parent = arm.ObjectId; child.Parent = parent.ObjectId;
  parent.PivotPoint.set([0, -56, 52]); child.PivotPoint.set([0, -62, 50]);
  const geoset = model.Geosets[0];
  geoset.Groups.push([parent.ObjectId], [child.ObjectId]);
  geoset.VertexGroup.set([geoset.Groups.length - 2, geoset.Groups.length - 1, geoset.Groups.length - 1]);
  const ids = rigNodeListGroups(model).bones.map(node => node.ObjectId);
  assert.ok(ids.indexOf(parent.ObjectId) < ids.indexOf(child.ObjectId));
});
