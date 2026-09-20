import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { COMPASS_AXES, projectCompassAxes } from '../app/viewport-compass.js';

test('viewport compass maps Warcraft world axes to its named views', () => {
  assert.deepEqual(COMPASS_AXES.map(axis => [axis.id, axis.view]), [['x', 'front'], ['y', 'left'], ['z', 'top']]);
});

test('viewport compass rotates its displayed axes with the camera', () => {
  const identity = projectCompassAxes(new Quaternion());
  assert.deepEqual(identity.map(axis => [axis.id, axis.x, axis.y]), [['x', 1, -0], ['y', 0, -1], ['z', 0, -0]]);
  const rotated = projectCompassAxes(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
  const x = rotated.find(axis => axis.id === 'x');
  assert.ok(Math.abs(x.x) < 1e-9);
  assert.ok(Math.abs(x.y - 1) < 1e-9);
});
