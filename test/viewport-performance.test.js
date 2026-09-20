import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';
import { createScrollSensitivity, createRenderScheduler, gridRotation, pointerDragPoint, sensitivityIndicatorText, wheelPixels } from '../app/viewport-performance.js';
import { gridSegments } from '../app/viewport-grid.js';

function wheel(deltaY, extra = {}) {
  return { deltaY, deltaMode: 0, buttons: 0, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
}

test('right-hold wheel changes sensitivity without zoom and release uses it before persistence commits', () => {
  let preferences = { scrollSensitivity: 2 }, saved, indicator;
  const control = createScrollSensitivity({ getPreferences: () => preferences, onChange: value => { saved = value; }, onIndicator: value => { indicator = value; } });
  control.pointerDown({ button: 2 });
  const event = wheel(-100), result = control.wheel(event);
  assert.equal(result.adjusting, true); assert.ok(saved > 2);
  assert.equal(event.prevented, true); assert.equal(event.stopped, true); assert.deepEqual(indicator, { kind: 'scroll', value: saved, shortcut: true });
  control.pointerUp({ button: 2 });
  assert.equal(indicator, null);
  const ordinary = wheel(-100), after = control.wheel(ordinary);
  assert.equal(after.adjusting, false); assert.equal(after.sensitivity, saved);
  assert.equal(ordinary.stopped, false);
  preferences = { scrollSensitivity: saved };
  assert.equal(control.wheel(wheel(-100)).sensitivity, saved);
  preferences = { scrollSensitivity: 4 };
  assert.equal(control.wheel(wheel(-100)).sensitivity, 4);
});

test('scroll adjustment honors disabled setting, wheel units and safe bounds', () => {
  let preferences = { scrollSensitivity: 2, rightScrollAdjust: false }, saved;
  const control = createScrollSensitivity({ getPreferences: () => preferences, onChange: value => { saved = value; } });
  control.pointerDown({ button: 2 });
  assert.equal(control.wheel(wheel(-100)).adjusting, false); assert.equal(saved, undefined);
  preferences = { scrollSensitivity: 2, rightScrollAdjust: true };
  for (let i = 0; i < 100; i++) control.wheel(wheel(-800));
  assert.equal(saved, 10);
  for (let i = 0; i < 100; i++) control.wheel(wheel(800));
  assert.equal(saved, .1);
  assert.equal(wheelPixels(wheel(3, { deltaMode: 1 })), 48);
  assert.equal(wheelPixels(wheel(1, { deltaMode: 2 })), 800);
  control.pointerUp({ type: 'blur' });
  assert.equal(control.wheel(wheel(-100)).adjusting, false);
});

test('Peon adjusts sensitivity with the wheel alone and normal mode immediately zooms at that value', () => {
  let preferences = { wheelMode: 'scroll', scrollSensitivity: 2, rightScrollAdjust: false }, saved, indicator;
  const control = createScrollSensitivity({ getPreferences: () => preferences, onChange: value => { saved = value; }, onIndicator: value => { indicator = value; } });
  const first = wheel(-100);
  assert.equal(control.wheel(first).kind, 'scroll');
  assert.ok(first.prevented && first.stopped); assert.ok(saved > 2);
  const firstValue = saved;
  control.wheel(wheel(-100)); assert.ok(saved > firstValue, 'successive wheels accumulate before React saves');
  assert.deepEqual(indicator, { kind: 'scroll', value: saved, shortcut: false });
  assert.equal(sensitivityIndicatorText(indicator).includes('release right button'), false);
  preferences = { ...preferences, wheelMode: 'rotate' };
  const zoomEvent = wheel(-100), result = control.wheel(zoomEvent);
  assert.equal(result.adjusting, false); assert.equal(result.sensitivity, saved); assert.equal(zoomEvent.stopped, false);
});

test('held-left wheel temporarily adjusts pointer speed, and leaves ordinary wheel zoom and right-wheel zoom speed available', () => {
  let preferences = { wheelMode: 'rotate', scrollSensitivity: 3, pointerSensitivity: 1 }, pointerSaved, scrollSaved, indicator, adjustments = 0, activated = [];
  const control = createScrollSensitivity({
    getPreferences: () => preferences,
    onChange: value => { scrollSaved = value; },
    onPointerChange: value => { pointerSaved = value; },
    onPointerAdjustment: () => { adjustments++; },
    onWheelModeChange: value => { activated.push(value); },
    onIndicator: value => { indicator = value; },
  });
  const ordinary = wheel(-100);
  assert.deepEqual(control.wheel(ordinary), { adjusting: false, sensitivity: 3 });
  assert.equal(ordinary.prevented, false, 'Wisp does not take over the wheel until left is held');

  control.pointerDown({ button: 0, pointerId: 41 });
  const event = wheel(-100, { buttons: 1 }), result = control.wheel(event);
  assert.equal(result.kind, 'pointer'); assert.ok(pointerSaved > 1); assert.equal(scrollSaved, undefined);
  assert.deepEqual(activated, [], 'the held-left gesture leaves the persistent toolbar mode unchanged');
  assert.ok(event.prevented && event.stopped); assert.equal(result.sensitivity, 3);
  assert.equal(indicator.kind, 'pointer'); assert.equal(indicator.shortcut, true);
  assert.match(sensitivityIndicatorText(indicator), /release left button/i);
  control.wheel(wheel(-100, { buttons: 1 }));
  assert.equal(adjustments, 1, 'a held left button starts one cancellable DPI gesture');
  for (let i = 0; i < 100; i++) control.wheel(wheel(-800, { buttons: 1 })); assert.equal(pointerSaved, 4);
  for (let i = 0; i < 100; i++) control.wheel(wheel(800, { buttons: 1 })); assert.equal(pointerSaved, .01);
  preferences = { ...preferences, pointerSensitivity: 2 };
  assert.ok(control.wheel(wheel(-100, { buttons: 1 })).pointerSensitivity > 2, 'slider changes synchronize to the held-left wheel controller');
  control.pointerUp({ button: 0, pointerId: 41 });
  assert.equal(indicator, null);

  control.pointerDown({ button: 2, pointerId: 42 });
  const rightHeld = wheel(-100, { buttons: 2 });
  assert.equal(control.wheel(rightHeld).kind, 'scroll'); assert.ok(scrollSaved > 3);
  assert.ok(rightHeld.prevented && rightHeld.stopped);
  control.pointerUp({ button: 2, pointerId: 42 });
  preferences = { ...preferences, wheelMode: 'rotate' };
  assert.equal(control.wheel(wheel(-100)).adjusting, false);
});

test('opposite mouse-button clicks reset DPI and scroll strength immediately', () => {
  let preferences = { wheelMode: 'pointer', scrollSensitivity: 6.4, pointerSensitivity: .07 }, pointerSaved, scrollSaved, cancelled = 0;
  const control = createScrollSensitivity({ getPreferences: () => preferences, onChange: value => { scrollSaved = value; }, onPointerChange: value => { pointerSaved = value; }, onPointerAdjustment: () => { cancelled++; } });
  const left = wheel(0, { button: 0, pointerId: 10 }), right = wheel(0, { button: 2, pointerId: 11 });
  // Pointer Events emit pointerdown only for the first pressed mouse button.
  // The second button in a real held chord arrives as mousedown.
  control.pointerDown(left); control.mouseDown(right);
  assert.equal(pointerSaved, 1); assert.ok(right.prevented && right.stopped, 'left then right consumes the DPI reset chord');
  control.pointerUp(right); control.pointerUp(left);
  const heldRight = wheel(0, { button: 2, pointerId: 12 }), resetScroll = wheel(0, { button: 0, pointerId: 13 });
  control.pointerDown(heldRight); control.mouseDown(resetScroll);
  assert.equal(scrollSaved, 2); assert.ok(resetScroll.prevented && resetScroll.stopped, 'right then left consumes the scroll reset chord');
  assert.equal(cancelled, 2, 'both reset chords cancel an active editor gesture');
});

test('middle-button release toggles Rotation and Work without panning on press', () => {
  let cameraMode = 'work', toggles = 0;
  const control = createScrollSensitivity({ getPreferences: () => ({}), onCameraModeToggle: () => { toggles++; cameraMode = cameraMode === 'rotate' ? 'work' : 'rotate'; } });
  const press = wheel(0, { button: 1, pointerId: 7 });
  control.pointerDown(press);
  assert.ok(press.prevented && press.stopped); assert.equal(toggles, 0);
  control.pointerUp({ button: 1, pointerId: 99 }); assert.equal(toggles, 0, 'unrelated pointer release does not toggle');
  control.pointerUp({ button: 1, pointerId: 7 }); assert.equal(cameraMode, 'rotate');
  control.pointerUp({ button: 1, pointerId: 7 }); assert.equal(toggles, 1, 'duplicate release does not toggle twice');
  control.pointerDown(press); control.pointerUp({ button: 1, pointerId: 7 }); assert.equal(cameraMode, 'work');
});

test('middle clicks do not select rotation during Peon/Wisp adjustment or after interrupted gestures', () => {
  let preferences = { wheelMode: 'scroll' }, toggles = 0;
  const control = createScrollSensitivity({ getPreferences: () => preferences, onCameraModeToggle: () => { toggles++; } });
  const press = { button: 1, pointerId: 1 };
  control.pointerDown(press); control.pointerUp(press);
  preferences.wheelMode = 'pointer'; control.pointerDown(press); control.pointerUp(press);
  preferences.wheelMode = 'rotate'; control.pointerDown(press); control.pointerUp({ type: 'blur' }); control.pointerUp(press);
  control.pointerDown(press); control.pointerUp({ type: 'pointercancel', pointerId: 1 }); control.pointerUp(press);
  control.pointerDown(press); preferences.wheelMode = 'scroll'; control.pointerUp(press);
  assert.equal(toggles, 0);
});

test('the default grid lies flat on Warcraft XY ground while other workplanes remain available', () => {
  const source = new Vector3(64, 0, 128);
  const horizontal = source.clone().applyEuler(new Euler(...gridRotation()));
  assert.ok(Math.abs(horizontal.z) < 1e-9); assert.equal(horizontal.x, 64); assert.ok(Math.abs(horizontal.y) > 0);
  const xz = source.clone().applyEuler(new Euler(...gridRotation('xz')));
  assert.equal(xz.y, 0); assert.equal(xz.z, 128);
  const yz = source.clone().applyEuler(new Euler(...gridRotation('yz')));
  assert.ok(Math.abs(yz.x) < 1e-9); assert.ok(Math.abs(yz.y) > 0); assert.equal(yz.z, 128);
});

test('XYZ grid axes use an exact three-pixel stroke', () => {
  const lines = gridSegments({ grid: { spacing: 8, extent: 16, majorEvery: 2, planes: { xy: false, xz: false, yz: false }, axes: { x: true, y: true, z: true } } }, 'xy', false, true);
  assert.equal(lines.length, 3);
  assert.ok(lines.every(line => line.width === 3));
});

test('pointer speed scales drag movement from its origin and leaves picking coordinates intact', () => {
  const origin = { x: 100, y: 80 }, cursor = { x: 140, y: 60, width: 800, height: 600 };
  assert.deepEqual(pointerDragPoint(origin, cursor, 2), { x: 180, y: 40, width: 800, height: 600 });
  assert.deepEqual(pointerDragPoint(origin, cursor, .25), { x: 110, y: 75, width: 800, height: 600 });
  assert.deepEqual(pointerDragPoint(origin, cursor, .01), { x: 100.4, y: 79.8, width: 800, height: 600 });
  assert.deepEqual(pointerDragPoint(origin, cursor, undefined), cursor);
  assert.deepEqual(cursor, { x: 140, y: 60, width: 800, height: 600 }, 'original cursor stays unchanged for hit tests');
  assert.deepEqual(origin, { x: 100, y: 80 });
});

function clock() {
  let id = 0; const queue = new Map();
  return { request(fn) { const next = ++id; queue.set(next, fn); return next; }, cancel(id) { queue.delete(id); },
    step(now) { const callbacks = [...queue.values()]; queue.clear(); for (const fn of callbacks) fn(now); },
    get pending() { return queue.size; } };
}

test('static views have no pending animation work and coalesce repeated invalidations', () => {
  const timer = clock(), frames = [];
  const scheduler = createRenderScheduler({ render: (...args) => { frames.push(args); }, continuous: () => false, paused: () => false, maxFps: () => 60, request: timer.request, cancel: timer.cancel });
  scheduler.invalidate(); scheduler.invalidate(); assert.equal(timer.pending, 1);
  timer.step(16); assert.equal(frames.length, 1); assert.equal(timer.pending, 0);
  timer.step(32); assert.equal(frames.length, 1);
  scheduler.invalidate(); timer.step(1000); assert.equal(frames.length, 2); assert.equal(frames[1][1], 0); assert.equal(timer.pending, 0);
  scheduler.dispose(); scheduler.invalidate(); assert.equal(timer.pending, 0);
});

test('animation honors frame cap, suspension cancels work, resume excludes hidden time', () => {
  const timer = clock(), frames = []; let playing = true, paused = false;
  const scheduler = createRenderScheduler({ render: (...args) => { frames.push(args); }, continuous: () => playing, paused: () => paused, maxFps: () => 30, request: timer.request, cancel: timer.cancel });
  scheduler.invalidate(); timer.step(0); timer.step(16); timer.step(34);
  assert.equal(frames.length, 2); assert.equal(frames[1][1], 34);
  paused = true; scheduler.sync(); assert.equal(timer.pending, 0);
  scheduler.invalidate(); timer.step(5000); assert.equal(frames.length, 2); assert.equal(timer.pending, 0);
  paused = false; scheduler.sync(); timer.step(10000); assert.equal(frames[2][1], 0);
  playing = false; scheduler.sync(); timer.step(10034); assert.equal(timer.pending, 0);
});

test('rapid camera invalidations respect the frame limit without dropping the final update', () => {
  const timer = clock(), frames = [];
  const scheduler = createRenderScheduler({ render: now => { frames.push(now); }, continuous: () => false, paused: () => false, maxFps: () => 30, request: timer.request, cancel: timer.cancel });
  scheduler.invalidate(); timer.step(0);
  scheduler.invalidate(); timer.step(16); assert.deepEqual(frames, [0]);
  scheduler.invalidate(); timer.step(34); assert.deepEqual(frames, [0, 34]); assert.equal(timer.pending, 0);
});

test('a rendering failure stops scheduling repeated work', () => {
  const timer = clock();
  const scheduler = createRenderScheduler({ render: () => false, continuous: () => true, paused: () => false, maxFps: () => 60, request: timer.request, cancel: timer.cancel });
  scheduler.invalidate(); timer.step(0); assert.equal(timer.pending, 0);
});

test('paused playback redraws a settled resize and returns to idle, preserving frame caps and suspension', () => {
  const timer = clock(), frames = []; let suspended = false;
  const scheduler = createRenderScheduler({ render: (...args) => frames.push(args), continuous: () => false, paused: () => suspended, maxFps: () => 30, request: timer.request, cancel: timer.cancel });
  scheduler.invalidate(); timer.step(0);
  scheduler.resize(); scheduler.resize(); assert.equal(timer.pending, 1);
  timer.step(34); assert.equal(frames.length, 2); assert.equal(frames[1][1], 0, 'idle resize does not accumulate hidden elapsed time');
  timer.step(50); assert.equal(frames.length, 2, 'settled frame still respects frame cap');
  timer.step(68); assert.equal(frames.length, 3); assert.equal(timer.pending, 0, 'resize settles after two frames');
  suspended = true; scheduler.sync(); scheduler.resize(); assert.equal(timer.pending, 0);
  suspended = false; scheduler.sync(); timer.step(1000); timer.step(1034);
  assert.equal(frames.length, 5); assert.equal(frames[3][1], 0); assert.equal(timer.pending, 0);
  scheduler.resize(); scheduler.dispose(); assert.equal(timer.pending, 0);
});
