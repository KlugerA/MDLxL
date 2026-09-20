import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundCoverRect, composePreviewCapture, previewPlaybackStep } from '../app/game-preview-capture.js';
import { movementNodeCategories, previewOverlayOptions, visibleMovementPoints } from '../app/preview-overlays.js';

test('background cover preserves aspect, centrally crops wide and tall images', () => {
  assert.deepEqual(backgroundCoverRect(1600, 900, 800, 450), { x: 0, y: 0, width: 1600, height: 900 });
  assert.deepEqual(backgroundCoverRect(1600, 900, 600, 600), { x: 350, y: 0, width: 900, height: 900 });
  assert.deepEqual(backgroundCoverRect(600, 1200, 600, 600), { x: 0, y: 300, width: 600, height: 600 });
  assert.throws(() => backgroundCoverRect(0, 900, 600, 600));
});

test('clean capture composites only supplied background and rendered model in order', () => {
  const calls = [], background = { name: 'background' }, model = { name: 'model', width: 1200, height: 800 };
  const output = { getContext: kind => { assert.equal(kind, '2d'); return { drawImage: (...args) => calls.push(args) }; } };
  assert.equal(composePreviewCapture(background, model, () => output), output);
  assert.equal(output.width, 1200); assert.equal(output.height, 800);
  assert.deepEqual(calls, [[background, 0, 0, 1200, 800], [model, 0, 0, 1200, 800]]);
});

test('Loop off stops once at end and resets to selected sequence beginning', () => {
  assert.deepEqual(previewPlaybackStep([1000, 2000], 1980, 50, false), { frame: 1000, elapsed: 20, finished: true });
  assert.deepEqual(previewPlaybackStep([1000, 2000], 1980, 0, false), { frame: 1980, elapsed: 0, finished: false });
  assert.deepEqual(previewPlaybackStep([1000, 2000], 1100, 20, false), { frame: 1120, elapsed: 20, finished: false });
});

test('Loop on retains fractional remainder and handles multiple sequence crossings', () => {
  assert.deepEqual(previewPlaybackStep([1000, 2000], 1980, 50), { frame: 1030, elapsed: 50, finished: false });
  assert.deepEqual(previewPlaybackStep([1000, 2000], 1980, 3050), { frame: 1030, elapsed: 3050, finished: false });
  assert.deepEqual(previewPlaybackStep([1000, 1000], 1000, 10), { frame: 1000, elapsed: 0, finished: true });
});

test('overlay categories independently gate visible and pickable markers', () => {
  const model = { Bones: [{ ObjectId: 0 }], Attachments: [{ ObjectId: 1 }], ParticleEmitters2: [{ ObjectId: 2 }], RibbonEmitters: [{ ObjectId: 3 }], Lights: [{ ObjectId: 4 }], Helpers: [{ObjectId:5}] };
  const kinds = movementNodeCategories(model);
  const points = [0, 1, 2, 3, 4, 5].map(id => ({ id, overlayKind: kinds.get(id) || 'nodes' }));
  assert.deepEqual(visibleMovementPoints(points, previewOverlayOptions(undefined, false)), []);
  assert.equal(visibleMovementPoints(points, previewOverlayOptions(undefined, true)).length, 6);
  assert.deepEqual(visibleMovementPoints(points, previewOverlayOptions({ bones: true, attachments: false, particles: false, nodes: false }, true)).map(point => point.id), [0,5]);
  assert.deepEqual(visibleMovementPoints(points, previewOverlayOptions({ particles: true })).map(point => point.id), [2, 3]);
  assert.equal(previewOverlayOptions(undefined, true).wires, false);
  assert.equal(previewOverlayOptions(undefined, true).grid, false);
});
