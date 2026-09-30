import test from 'node:test';
import assert from 'node:assert/strict';
import { downstreamBoneIds } from '../src/node-hierarchy.js';
import { classicTimelineDomain, classicTimelineTargets } from '../src/classic-keyframes.js';
import { copyTimelineKeys, timelineKeys, timelineTracks } from '../src/keyframe-timeline.js';

const rotation = frame => ({ LineType: 1, GlobalSeqId: null, Keys: [{ Frame: frame, Vector: new Float32Array([0, 0, 0, 1]) }] });

test('Highlight Chain copy captures selected and downstream bone keys without copying the parent', () => {
  const chest = { ObjectId: 0, Name: 'Chest', Parent: null, Rotation: rotation(100) };
  const shoulder = { ObjectId: 1, Name: 'Shoulder 1', Parent: 0, Rotation: rotation(200) };
  const arm = { ObjectId: 2, Name: 'Arm 1', Parent: 1, Rotation: rotation(300) };
  const hand = { ObjectId: 3, Name: 'Hand 1', Parent: 2, Rotation: rotation(400) };
  const model = { Nodes: [chest, shoulder, arm, hand], Bones: [chest, shoulder, arm, hand], Helpers: [], Geosets: [], GeosetAnims: [], Sequences: [{ Name: 'Stand', Interval: [0, 1000] }], GlobalSequences: [], Materials: [], TextureAnims: [], Cameras: [] };
  const domain = classicTimelineDomain(model, 0, null), tracks = timelineTracks(model);
  const nodeIds = downstreamBoneIds(model, [shoulder.ObjectId]);
  const targets = ['move', 'rotate', 'scale'].flatMap(activeController => classicTimelineTargets(model, { tracks, nodeIds, activeController, highlightKeyframes: true, domain }));
  const keys = timelineKeys(model, targets, domain);
  const clipboard = copyTimelineKeys(model, targets, keys, domain, domain.start);
  assert.equal(clipboard.count, 3);
  assert.deepEqual(clipboard.entries.map(entry => entry.target.id).sort((a, b) => a - b), [shoulder.ObjectId, arm.ObjectId, hand.ObjectId]);
  assert.ok(!clipboard.entries.some(entry => entry.target.id === chest.ObjectId));
});
