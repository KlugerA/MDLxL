import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Vector3 } from 'three';
import { sampleTrack, sampleNodeMatrices, skinGeoset, skinGeosetNormals, advanceSequence } from '../src/animation.js';

const key = (Frame, Vector, extra = {}) => ({ Frame, Vector, ...extra });
const track = (Keys, LineType = 1) => ({ Keys, LineType });
const near = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('tracks cannot interpolate through another sequence', () => {
  const t = track([key(0, [99]), key(100, [1]), key(200, [3]), key(500, [100])]);
  assert.equal(sampleTrack(t, 150, { interval: [100, 200] }), 2);
  assert.equal(sampleTrack(t, 50, { interval: [100, 200] }), 1);
  assert.equal(sampleTrack(t, 350, { interval: [300, 400], fallback: 7 }), 7);
});
test('global sequence zero is recognized and wraps', () => {
  const t = { ...track([key(0, [0]), key(100, [10])]), GlobalSeqId: 0 };
  assert.equal(sampleTrack(t, 1000, { interval: [500, 1000], globalSequences: [100], globalTime: 125 }), 2.5);
});
test('step, Hermite and Bezier interpolation use their tangents', () => {
  const keys = [key(0, [0], { OutTan: [4] }), key(100, [8], { InTan: [2] })];
  assert.equal(sampleTrack(track(keys, 0), 50), 0);
  assert.equal(sampleTrack(track(keys, 2), 50), 4.25);
  assert.equal(sampleTrack(track(keys, 3), 50), 3.25);
});
test('quaternions follow the shortest rotation and stay normalized', () => {
  const t = track([key(0, [0, 0, 0, 1]), key(100, [0, 0, 1, 0])]);
  const q = sampleTrack(t, 50, { quaternion: true, fallback: [0, 0, 0, 1] });
  near(q[2], Math.SQRT1_2); near(q[3], Math.SQRT1_2);
});
test('node hierarchy respects pivots and parent ObjectId zero', () => {
  const model = { Sequences: [{ Interval: [0, 100] }], Bones: [
    { ObjectId: 0, Translation: track([key(0, [10, 0, 0])]), PivotPoint: [0, 0, 0] },
    { ObjectId: 4, Parent: 0, PivotPoint: [1, 0, 0], Rotation: track([key(0, [0, 0, 1, 0])]) }
  ] };
  const matrices = sampleNodeMatrices(model, 0, 0);
  const point = new Vector3(2, 0, 0).applyMatrix4(matrices.get(4));
  near(point.x, 10); near(point.y, 0);
  assert.deepEqual(new Vector3(2, 0, 0).applyMatrix4(sampleNodeMatrices(model, 0, -1).get(4)).toArray(), [2, 0, 0]);
});
test('classic matrix groups average weights; empty groups keep bind vertex', () => {
  const geo = { Vertices: new Float32Array([1, 2, 3, 4, 5, 6]), VertexGroup: [0, 1], Groups: [[0, 4], []] };
  const result = skinGeoset(geo, new Map([[0, new Matrix4().makeTranslation(10, 0, 0)], [4, new Matrix4().makeTranslation(0, 10, 0)]]));
  assert.deepEqual([...result], [6, 7, 3, 4, 5, 6]);
});
test('HD skin weights retain nonuniform influence', () => {
  const geo = { Vertices: new Float32Array([0, 0, 0]), SkinWeights: [0, 1, 0, 0, 204, 51, 0, 0] };
  const result = skinGeoset(geo, new Map([[0, new Matrix4().makeTranslation(10, 0, 0)], [1, new Matrix4().makeTranslation(0, 10, 0)]]));
  near(result[0], 8); near(result[1], 2);
});
test('nonlooping sequences stop; looping sequences preserve overshoot', () => {
  assert.equal(advanceSequence({ Interval: [100, 200], NonLooping: true }, 190, 35), 200);
  assert.equal(advanceSequence({ Interval: [100, 200] }, 190, 35), 125);
});
test('authored normals rotate without translation and use inverse transpose for scaling', () => {
  const geo = { Normals: new Float32Array([1, 1, 0]), VertexGroup: [0], Groups: [[0]] };
  const normal = skinGeosetNormals(geo, new Map([[0, new Matrix4().makeScale(2, 1, 1).setPosition(20, 30, 40)]]));
  near(normal[0], 1 / Math.sqrt(5)); near(normal[1], 2 / Math.sqrt(5)); near(normal[2], 0);
  const rotated = skinGeosetNormals(geo, new Map([[0, new Matrix4().makeRotationZ(Math.PI / 2)]]));
  near(rotated[0], -Math.SQRT1_2); near(rotated[1], Math.SQRT1_2);
});
