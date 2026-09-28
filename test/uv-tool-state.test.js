import test from 'node:test';
import assert from 'node:assert/strict';
import { uvToolState } from '../src/uv-tool-state.js';

test('UV edit tools stay available for the captured working selection', () => {
  assert.deepEqual(uvToolState({ selectionCount: 2 }), {
    move: true, rotate: true, scale: true, mirror: true, uncouple: true, fold: true,
  });
});

test('only the valid safety and selection requirements disable UV tools', () => {
  assert.deepEqual(uvToolState({ selectionCount: 0 }), {
    move: true, rotate: true, scale: true, mirror: false, uncouple: false, fold: false,
  });
  assert.equal(uvToolState({ selectionCount: 2, draftCount: 1 }).uncouple, false);
  assert.deepEqual(uvToolState({ readOnly: true, selectionCount: 2 }), {
    move: false, rotate: false, scale: false, mirror: false, uncouple: false, fold: false,
  });});
