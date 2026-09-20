import test from 'node:test';
import assert from 'node:assert/strict';
import { clampAlphaPercentText, removeSequenceToggle, setSequenceToggle } from '../src/animation-controller-inputs.js';

test('Animations Alpha input immediately rewrites values above 100', () => {
  assert.equal(clampAlphaPercentText('101'), '100');
  assert.equal(clampAlphaPercentText('900'), '100');
  assert.equal(clampAlphaPercentText('100'), '100');
  assert.equal(clampAlphaPercentText('42'), '42');
  assert.equal(clampAlphaPercentText(''), '');
});

test('Apply Move Speed checked state survives sequence navigation and follows deletion', () => {
  let state = setSequenceToggle({}, 1, true);
  state = setSequenceToggle(state, 3, true);
  assert.equal(state[1], true);
  assert.equal(state[2], undefined);
  assert.equal(state[3], true);
  state = removeSequenceToggle(state, 2);
  assert.deepEqual(state, { 1: true, 2: true });
  state = setSequenceToggle(state, 1, false);
  assert.equal(state[1], false);
});

