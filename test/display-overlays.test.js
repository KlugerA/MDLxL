import test from 'node:test';
import assert from 'node:assert/strict';
import { clearQuickDisplay, defaultEditorDisplay, setEditorDisplay } from '../src/display-overlays.js';
import { previewOverlayOptions } from '../app/preview-overlays.js';

test('startup selects only Shadows and Vertices where those options exist', () => {
  const state = defaultEditorDisplay();
  for (const mode of ['vertices', 'bones', 'movement']) {
    assert.deepEqual(Object.entries(state[mode]).filter(([, enabled]) => enabled).map(([key]) => key), ['shaded', 'vertices']);
  }
  assert.ok(Object.values(state.animations).every(enabled => !enabled));
});

test('display switches belong to their respective editor', () => {
  const initial = defaultEditorDisplay();
  const bones = setEditorDisplay(initial, 'bones', 'bones', true);
  const skeleton = setEditorDisplay(bones, 'bones', 'skeleton', true);
  const movement = setEditorDisplay(skeleton, 'movement', 'nodes', true);
  assert.equal(movement.bones.bones, true);
  assert.equal(movement.bones.skeleton, true);
  assert.equal(movement.movement.nodes, true);
  assert.equal(movement.vertices.bones, false);
  assert.equal(movement.animations.bones, false);
  assert.deepEqual(initial, defaultEditorDisplay());
});

test('Bones and Skeleton independently control markers and connecting lines', () => {
  const defaults = defaultEditorDisplay().bones;
  assert.deepEqual(
    [previewOverlayOptions({ ...defaults, bones: true }).bones, previewOverlayOptions({ ...defaults, bones: true }).boneLines],
    [true, false],
  );
  assert.deepEqual(
    [previewOverlayOptions({ ...defaults, skeleton: true }).bones, previewOverlayOptions({ ...defaults, skeleton: true }).boneLines],
    [false, true],
  );
});

test('Clear turns off only the active editor options', () => {
  const state = setEditorDisplay(defaultEditorDisplay(), 'bones', 'skeleton', true);
  const cleared = clearQuickDisplay(state, 'bones');
  assert.ok(Object.values(cleared.bones).every(enabled => !enabled));
  assert.deepEqual(cleared.vertices, state.vertices);
  assert.deepEqual(cleared.movement, state.movement);
});
