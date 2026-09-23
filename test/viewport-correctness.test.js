import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { VIEW_PRESETS, applyViewPreset, applyModelCamera, depthClipRange, projectedPlaneTranslation } from '../app/viewport-math.js';
import { createOverlayDepth } from '../app/preview-depth.js';
import { projectGridSegment } from '../app/preview-overlays.js';
import { gridSegments } from '../app/viewport-grid.js';
import { createScrollSensitivity } from '../app/viewport-performance.js';

test('all six Warcraft views have distinct axes and perpendicular up vectors', () => {
  const camera = new OrthographicCamera(-2, 2, 2, -2, .1, 100), target = new Vector3();
  const standard = ['front','back','right','left','top','bottom'];
  assert.equal(new Set(standard.map(name => VIEW_PRESETS[name].direction.join(','))).size, 6);
  for (const name of standard) {
    const preset = VIEW_PRESETS[name];
    applyViewPreset(camera, name, target, 10);
    assert.equal(new Vector3(...preset.direction).dot(camera.up), 0, name);
    assert.ok(camera.getWorldDirection(new Vector3()).dot(new Vector3(...preset.direction)) < -.999, name);
  }
  applyViewPreset(camera, 'top', target, 10);
  assert.ok(new Vector3(1, 0, 0).project(camera).y < 0, 'model +X forward points down in top view');
  applyViewPreset(camera, 'front', target, 10);
  assert.deepEqual(camera.position.toArray(), [10, 0, 0]);
});

test('UV angled projection presets cover front and back from top and bottom', () => {
  for (const height of ['top','bottom']) for (const plane of ['front','back']) for (const side of ['left','right']) {
    const name = `${height}-${plane}-${side}`, preset = VIEW_PRESETS[name];
    assert.ok(preset, `${name} is available`);
    assert.equal(new Vector3(...preset.direction).dot(new Vector3(...preset.up)), preset.direction[2]);
    const camera = new PerspectiveCamera();
    applyViewPreset(camera, name, new Vector3(), 10);
    assert.ok(Math.abs(camera.position.length() - 10) < 1e-6);
  }
});

test('adaptive depth precision improves at distant zoom without moving model geometry', () => {
  for (const radius of [1, 100, 10000]) for (const multiplier of [3.2, 10, 100, 1000]) {
    const distance = radius * multiplier, clips = depthClipRange(distance, radius, radius * 2);
    assert.ok(clips.near > 0 && clips.near < distance - radius);
    assert.ok(clips.far > distance + radius);
    assert.ok(clips.far / clips.near < 20, 'grid-inclusive range retains useful depth precision');
  }
  assert.ok(depthClipRange(0, 100).near < 1, 'close navigation remains possible');
});

test('classic constrained moves solve the selected workplane axis', () => {
  assert.deepEqual(projectedPlaneTranslation('xy', [[2, 0], [0, 2]], 10, 20, true), [5, 0, 0]);
  assert.deepEqual(projectedPlaneTranslation('yz', [[2, 0], [0, 2]], 10, 20, true), [0, 5, 0]);
  assert.deepEqual(projectedPlaneTranslation('xz', [[2, 0], [0, 2]], 10, 20, true), [0, 0, 10]);
  assert.deepEqual(projectedPlaneTranslation('xz', [[2, 0], [2, .00001]], 10, 20, true).map(Math.round), [0, 0, 5]);
  assert.deepEqual(projectedPlaneTranslation('xz', [[2, 0], [0, 0]], 10, 20, true), [0, 0, 0]);
  for (const plane of ['xy', 'yz', 'xz']) for (const constrain of [false, true]) {
    const value = projectedPlaneTranslation(plane, [[2, 0], [2, .00001]], 10, 20, constrain);
    assert.ok(value.every(n => Number.isFinite(n) && Math.abs(n) < 11));
  }
});

test('view through camera uses model coordinates, target and field of view', () => {
  const camera = new PerspectiveCamera(), controls = { target: new Vector3(), update() {} };
  assert.equal(applyModelCamera(camera, controls, { Position: [3, 4, 5], TargetPosition: [6, 7, 8], FieldOfView: Math.PI / 3 }), true);
  assert.deepEqual(camera.position.toArray(), [3, 4, 5]); assert.deepEqual(controls.target.toArray(), [6, 7, 8]);
  assert.ok(Math.abs(camera.fov - 45) < 1e-8); assert.equal(controls.object, camera);
  assert.equal(applyModelCamera(camera, controls, { Position: [NaN, 0, 0], TargetPosition: [0, 0, 0] }), false);
});

test('depth overlays distinguish front points and occluded rear points', () => {
  const points = [{x:0,y:0,z:0,visible:true},{x:100,y:0,z:0,visible:true},{x:0,y:100,z:0,visible:true}];
  const depth = createOverlayDepth([{points,faces:[0,1,2]}],100,100);
  assert.equal(depth.isOccluded({x:20,y:20,z:.5}),true);
  assert.equal(depth.isOccluded({x:20,y:20,z:0}),false);
  assert.equal(depth.isOccluded({x:20,y:20,z:-.5}),false);
  assert.equal(depth.isOccluded({x:90,y:90,z:.5}),false);
});

test('shared grid honors planes, axes, spacing, extent and distinct theme colors', () => {
  const lines = gridSegments({ grid: { followWorkplane:false,spacing:10,extent:20,majorEvery:2,planes:{xy:false,xz:true,yz:false},axes:{x:false,y:false,z:true} } }, 'xy');
  assert.equal(lines.length, 11); assert.ok(lines.every(line => line.a[1] === 0 && line.b[1] === 0));
  assert.ok(new Set(lines.map(line => line.color)).size >= 3);
});

test('animation grid segments crossing the viewport remain visible with clipped endpoints', () => {
  const camera = new OrthographicCamera(-10,10,10,-10,.1,100); camera.position.set(0,0,20); camera.lookAt(0,0,0); camera.updateMatrixWorld();
  const segment = projectGridSegment(camera,100,100,[-200,0,0],[200,0,0]);
  assert.ok(segment); assert.ok(Math.abs(segment[0].x) < 1e-6); assert.ok(Math.abs(segment[1].x - 100) < 1e-6);
  assert.equal(projectGridSegment(camera,100,100,[-200,200,0],[200,200,0]),null);
});

test('configured middle pan does not trigger classic middle-click mode toggle', () => {
  let consumed = 0, toggles = 0;
  const controller = createScrollSensitivity({ getPreferences: () => ({ cameraBindings: { middle:'pan' } }), onCameraModeToggle:()=>toggles++ });
  const event = { button:1, pointerId:1, preventDefault:()=>consumed++, stopImmediatePropagation:()=>consumed++ };
  controller.pointerDown(event); controller.pointerUp(event); assert.equal(consumed,0); assert.equal(toggles,0);
});
