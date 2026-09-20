import test from 'node:test';
import assert from 'node:assert/strict';
import { applySelection, dragScale, connectedVertices, insideTriangle, marqueeContainsPoint } from '../app/classic-gestures.js';

test('classic selection replaces, Shift adds, Ctrl subtracts without introducing vertices', () => {
  assert.deepEqual(applySelection([1, 2], [2, 3]), [2, 3]);
  assert.deepEqual(applySelection([1, 2], [2, 3], { shift: true }), [1, 2, 3]);
  assert.deepEqual(applySelection([1, 2], [2, 3], { ctrl: true }), [1]);
});

test('classic scale uses horizontal percentage drag and workplane axis constraints', () => {
  assert.deepEqual(dragScale(25), [1.25, 1.25, 1.25]);
  assert.deepEqual(dragScale(-150), [0, 0, 0]);
  assert.deepEqual(dragScale(25, 'xz', true), [1, 1, 1.25]);
  assert.deepEqual(dragScale(25, 'xy', true), [1.25, 1, 1]);
  assert.deepEqual(dragScale(25, 'yz', true), [1, 1.25, 1]);
});

test('marquee selection catches a single vertex marker when the box crosses it', () => {
  const start = { x: 10, y: 10 }, end = { x: 20, y: 20 };
  assert.equal(marqueeContainsPoint([21, 15], start, end, 2), true);
  assert.equal(marqueeContainsPoint([23, 15], start, end, 2), false);
});

test('connected selection reaches neighboring triangles and preserves separate islands', () => {
  assert.deepEqual(connectedVertices([0, 1, 2, 2, 3, 4, 5, 6, 7], [0]).sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual(connectedVertices([0, 1, 2], []), []);
});

test('triangle fallback accepts either winding and rejects outside and degenerate faces', () => {
  assert.equal(insideTriangle([.25, .25], [0, 0], [1, 0], [0, 1]), true);
  assert.equal(insideTriangle([.25, .25], [0, 0], [0, 1], [1, 0]), true);
  assert.equal(insideTriangle([1, 1], [0, 0], [1, 0], [0, 1]), false);
  assert.equal(insideTriangle([.5, 0], [0, 0], [1, 0], [2, 0]), false);
});
