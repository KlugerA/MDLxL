import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPreviewUVCoordinates } from '../app/preview-selection.js';

const face = (index, z) => ({
  index,
  faces: new Uint16Array([0, 1, 2]),
  points: [
    { x: 20, y: 20, z, visible: true },
    { x: 80, y: 20, z, visible: true },
    { x: 50, y: 80, z, visible: true },
  ],
});
const pick = (geosets, previous, x, y, eligible, vertices = false, keys = {}) =>
  selectPreviewUVCoordinates(geosets, previous, { x, y, ...keys }, { x, y }, eligible, vertices, 100, 100);

test('polygon clicks select all three UV corners and keep other material selections', () => {
  const geosets = [face(0, 0)], eligible = { 0: [0, 1, 2] };
  assert.deepEqual(pick(geosets, { 0: [0], 4: [8] }, 50, 40, eligible), { 0: [0, 1, 2], 4: [8] });
  assert.deepEqual(pick(geosets, { 0: [0, 1, 2] }, 50, 40, eligible, false, { ctrl: true }), { 0: [] });
  assert.deepEqual(pick(geosets, { 0: [0, 1, 2] }, 5, 5, eligible), { 0: [] });
  assert.deepEqual(pick(geosets, {}, 50, 40, { 0: [0, 1] }), { 0: [] });
});

test('front polygons block UV picking through unrelated geosets', () => {
  assert.deepEqual(pick([face(0, 0), face(1, -.5)], {}, 50, 40, { 0: [0, 1, 2] }), { 0: [] });
});

test('show verticles picks individual visible UV vertices and respects the entry selection', () => {
  const geosets = [face(0, 0)], eligible = { 0: [0, 1, 2] };
  assert.deepEqual(pick(geosets, {}, 21, 21, eligible, true), { 0: [0] });
  assert.deepEqual(pick(geosets, { 0: [1] }, 21, 21, eligible, true, { shift: true }), { 0: [1, 0] });
  assert.deepEqual(pick(geosets, { 0: [0, 1] }, 21, 21, eligible, true, { ctrl: true }), { 0: [1] });
  assert.deepEqual(pick(geosets, {}, 21, 21, { 0: [1, 2] }, true), { 0: [] });
  assert.deepEqual(pick([face(0, 0), face(1, -.5)], {}, 50, 49, { 0: [0, 1, 2] }, true), { 0: [] });
});
