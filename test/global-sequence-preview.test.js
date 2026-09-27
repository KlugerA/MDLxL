import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleNodeMatrices, sampleGeosetAnimation } from '../src/animation.js';
import { isolateGlobalSequence } from '../src/global-sequence-preview.js';

const track = (globalSeqId, end, value) => ({ LineType: 1, GlobalSeqId: globalSeqId, Keys: [
  { Frame: 0, Vector: new Float32Array(value.map(() => 0)) },
  { Frame: end, Vector: new Float32Array(value) },
] });

test('global preview animates only the selected global tracks, including children of local bones', () => {
  const model = {
    Sequences: [{ Interval: [0, 100] }], GlobalSequences: [100, 50], PivotPoints: [],
    Nodes: [
      { ObjectId: 0, Translation: track(null, 100, [10, 0, 0]) },
      { ObjectId: 1, Parent: 0, Translation: track(0, 100, [0, 5, 0]) },
      { ObjectId: 2, Parent: 0, Translation: track(1, 50, [0, 0, 7]) },
    ],
    GeosetAnims: [{ GeosetId: 0, Flags: 0, Alpha: track(null, 100, [1]) }],
  };
  const preview = isolateGlobalSequence(structuredClone(model), 0);
  const at = (id, frame) => sampleNodeMatrices(preview, frame, 0, frame).get(id).elements.slice(12, 15);

  assert.deepEqual(Array.from(at(0, 50)), [0, 0, 0]);
  assert.deepEqual(Array.from(at(1, 50)), [0, 2.5, 0]);
  assert.deepEqual(Array.from(at(2, 50)), [0, 0, 0]);
  assert.equal(sampleGeosetAnimation(preview, 0, 50, 0).alpha, 0);
  assert.deepEqual(Array.from(model.Nodes[0].Translation.Keys[1].Vector), [10, 0, 0]);
  assert.equal(model.GeosetAnims[0].Alpha.Keys.length, 2);
});
