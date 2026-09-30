import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPlaybackSpeed, scalePlaybackDelta } from '../src/playback-speed.js';

test('typed playback speed clamps to the requested 1 through 250 percent range', () => {
  assert.equal(clampPlaybackSpeed(-100), 1);
  assert.equal(clampPlaybackSpeed(0), 1);
  assert.equal(clampPlaybackSpeed(100), 100);
  assert.equal(clampPlaybackSpeed(999), 250);
  assert.equal(clampPlaybackSpeed('not a number', 75), 75);
});

test('playback speed scales only elapsed preview time', () => {
  assert.equal(scalePlaybackDelta(16, 1), .16);
  assert.equal(scalePlaybackDelta(16, 100), 16);
  assert.equal(scalePlaybackDelta(16, 250), 40);
});
