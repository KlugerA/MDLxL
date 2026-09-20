import test from 'node:test';
import assert from 'node:assert/strict';
import { animationPanelDisplay, enterMovementDisplay, setEditorDisplay, synchronizeEditorDisplay } from '../src/display-overlays.js';

const modes = () => ({
  vertices: { bones: false, wires: true, nodes: false, attachments: true, particles: false, vertices: true, grid: true, cameras: false, normals: true },
  uv: { bones: true, wires: false, nodes: true, attachments: false, particles: true, vertices: false, grid: false, cameras: true, normals: false },
  bones: { bones: true, wires: false, nodes: true, attachments: false, particles: true, vertices: false, grid: false, cameras: true, normals: false },
  animation: { bones: true, wires: false, nodes: true, attachments: false, particles: true, vertices: false, grid: false, cameras: true, normals: false },
});

test('legacy editor display state migrates to one shared state without changing UV', () => {
  const source = modes(), next = synchronizeEditorDisplay(source);
  for (const mode of ['vertices', 'bones', 'animation']) assert.deepEqual(next[mode], source.vertices);
  assert.deepEqual(next.uv, source.uv);
  assert.notEqual(next.vertices, next.bones);
});

test('every editor display switch is synchronized across Vertices, Bones, Movement, and Animations', () => {
  let state = synchronizeEditorDisplay(modes());
  for (const key of ['bones', 'wires', 'nodes', 'attachments', 'particles', 'vertices', 'grid', 'cameras', 'normals']) {
    state = setEditorDisplay(state, 'animation', key, previous => !previous);
    for (const mode of ['vertices', 'bones', 'animation']) assert.equal(state[mode][key], state.animation[key], `${key} in ${mode}`);
  }
  assert.deepEqual(state.uv, modes().uv);
});

test('Movement enables rig layers and renders only selected vertex squares', () => {
  const entered = enterMovementDisplay({ bones: false, attachments: false, vertices: true, grid: true });
  assert.equal(entered.bones, true); assert.equal(entered.attachments, true);
  const display = animationPanelDisplay(entered, 'movement');
  assert.equal(display.vertices, false); assert.equal(display.selectedVerticesOnly, true); assert.equal(display.grid, true);
});

test('Animations suppresses every rig, node, emitter and vertex marker', () => {
  const display = animationPanelDisplay({ bones: true, nodes: true, attachments: true, particles: true, vertices: true, cameras: true }, 'animations');
  for (const key of ['bones', 'nodes', 'attachments', 'particles', 'vertices', 'cameras']) assert.equal(display[key], false, key);
});
