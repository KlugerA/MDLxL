import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UV_PREVIEW_DEFAULT, UV_PREVIEW_MAX, UV_SIDE_DEFAULT,
  clampUVPreviewPercent, clampUVSidePercent, uvPreviewPercentAtPointer, uvSidePercentAtPointer,
} from '../app/uv-workspace-layout.js';

test('UV workspace retains the compact side and preview defaults', () => {
  assert.equal(UV_SIDE_DEFAULT, 40);
  assert.equal(UV_PREVIEW_DEFAULT, 62);
});

test('UV workspace splitters convert pointer positions into bounded pane percentages', () => {
  const wide = { left: 100, width: 1000 };
  assert.equal(uvSidePercentAtPointer(700, wide), 40);
  assert.equal(uvSidePercentAtPointer(-1000, wide), 63.3);
  assert.equal(uvSidePercentAtPointer(3000, wide), 30);
  assert.equal(uvPreviewPercentAtPointer(500, { top: 100, height: 800 }), 50);
  assert.equal(uvPreviewPercentAtPointer(5000, { top: 100, height: 800 }), UV_PREVIEW_MAX);
  assert.equal(clampUVSidePercent(Infinity), UV_SIDE_DEFAULT);
  assert.equal(clampUVPreviewPercent(NaN), UV_PREVIEW_DEFAULT);
});
