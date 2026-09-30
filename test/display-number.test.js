import test from 'node:test';
import assert from 'node:assert/strict';
import { displayNumber } from '../src/display-number.js';

test('display numbers are one-based while model indices remain unchanged', () => {
  assert.equal(displayNumber(0), 1);
  assert.equal(displayNumber(8), 9);
  assert.equal(displayNumber(-1), 0);
  assert.equal(displayNumber(null), null);
});
