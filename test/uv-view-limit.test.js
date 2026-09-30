import test from 'node:test';
import assert from 'node:assert/strict';
import { minimumUVZoom, normalizeUVViewTileLimit } from '../src/uv-view-limit.js';

test('UV tile-limit preference defaults to 7x7 and permits a larger user value', () => {
  assert.equal(normalizeUVViewTileLimit(undefined), 7);
  assert.equal(normalizeUVViewTileLimit(4), 7);
  assert.equal(normalizeUVViewTileLimit(12), 12);
  assert.equal(normalizeUVViewTileLimit(100), 64);
});

test('minimum UV zoom keeps both visible axes within the configured tile count', () => {
  const width = 700, height = 560, unitWidth = 140, unitHeight = 100;
  const seven = minimumUVZoom(width, height, unitWidth, unitHeight, 7);
  assert.ok(width / (unitWidth * seven) <= 7);
  assert.ok(height / (unitHeight * seven) <= 7);
  const fourteen = minimumUVZoom(width, height, unitWidth, unitHeight, 14);
  assert.ok(fourteen < seven, 'raising the tile limit permits further zoom-out');
});
