import test from 'node:test';
import assert from 'node:assert/strict';
import { downstreamBoneIds } from '../src/node-hierarchy.js';

test('Highlight Chain includes the selected bone and bone descendants, never its ancestor or siblings', () => {
  const chest = { ObjectId: 0, Name: 'Chest', Parent: null };
  const shoulder = { ObjectId: 1, Name: 'Shoulder 1', Parent: 0 };
  const arm = { ObjectId: 2, Name: 'Arm 1', Parent: 1 };
  const hand = { ObjectId: 3, Name: 'Hand 1', Parent: 2 };
  const otherShoulder = { ObjectId: 4, Name: 'Shoulder 2', Parent: 0 };
  const attachment = { ObjectId: 5, Name: 'Weapon Ref', Parent: 3 };
  const model = { Nodes: [chest, shoulder, arm, hand, otherShoulder, attachment], Bones: [chest, shoulder, arm, hand, otherShoulder], Helpers: [], Attachments: [attachment] };
  assert.deepEqual(downstreamBoneIds(model, [shoulder.ObjectId]), [shoulder.ObjectId, arm.ObjectId, hand.ObjectId]);
});

test('Highlight Chain unions multiple downstream bone branches', () => {
  const root = { ObjectId: 0 }, left = { ObjectId: 1, Parent: 0 }, leftHand = { ObjectId: 2, Parent: 1 }, right = { ObjectId: 3, Parent: 0 }, rightHand = { ObjectId: 4, Parent: 3 };
  const model = { Nodes: [root, left, leftHand, right, rightHand], Bones: [root, left, leftHand, right, rightHand], Helpers: [] };
  assert.deepEqual(downstreamBoneIds(model, [left.ObjectId, right.ObjectId]), [left.ObjectId, right.ObjectId, rightHand.ObjectId, leftHand.ObjectId]);
});
