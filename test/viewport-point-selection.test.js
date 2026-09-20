import test from 'node:test';
import assert from 'node:assert/strict';
import { viewportPointDepth, viewportPointIndices } from '../app/viewport-point-selection.js';

test('a newly active geoset with no vertex selection uses its existing non-indexed points immediately', () => {
  assert.deepEqual(viewportPointIndices(250000), { unselected: null, selected: [] });
});

test('selected and hidden vertices receive separate point indices', () => {
  assert.deepEqual(viewportPointIndices(6, [1, 4], [2]), { unselected: [0, 3, 5], selected: [1, 4] });
});

test('wireframe vertices render once above lines while General View preserves depth and optional X-Ray', () => {
  assert.deepEqual(viewportPointDepth(true, false), { depthTest: false, showHidden: false });
  assert.deepEqual(viewportPointDepth(true, true), { depthTest: false, showHidden: false });
  assert.deepEqual(viewportPointDepth(false, false), { depthTest: true, showHidden: false });
  assert.deepEqual(viewportPointDepth(false, true), { depthTest: true, showHidden: true });
});
