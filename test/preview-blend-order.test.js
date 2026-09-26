import test from 'node:test';
import assert from 'node:assert/strict';
import { installWarcraftPreviewAdapter } from '../app/warcraft-preview-adapter.js';

function fixture() {
  const calls = [], buffers = [{}, {}, {}, {}], program = {};
  const layers = [{ FilterMode: 3, Alpha: 1 }, { FilterMode: 0, Alpha: 1 }, { FilterMode: 1, Alpha: .5 }, { FilterMode: 2, Alpha: 0 }];
  const model = { Sequences: [], GlobalSequences: [], GeosetAnims: [], Geosets: layers.map((_, MaterialID) => ({ MaterialID })), Materials: layers.map(layer => ({ Layers: [layer] })) };
  let bound;
  const gl = {
    ELEMENT_ARRAY_BUFFER: 1, ONE: 2, SRC_COLOR: 3, SAMPLE_ALPHA_TO_COVERAGE: 4,
    shaderSource() {}, useProgram() {}, bindBuffer(target, buffer) { bound = buffer; },
    drawElements() { calls.push(['mesh', buffers.indexOf(bound)]); },
    getUniformLocation: (_, name) => name, getContextAttributes: () => ({ antialias: false }),
    uniform1f() {}, uniform3fv() {}, uniform4fv() {}, enable() {}, disable() {}, depthMask() {}, blendFuncSeparate() {},
    blendFunc(src, dst) { calls.push(['blend', src, dst]); },
  };
  const native = {
    shaderProgram: program, indexBuffer: buffers,
    setLayerProps(layer) { if (layer.FilterMode === 3) gl.blendFunc(gl.SRC_COLOR, gl.ONE); }, setLayerPropsHD() {},
    particlesController: { render() { calls.push(['particles']); } },
    ribbonsController: { emitters: [], update() {}, render() { calls.push(['ribbons']); } },
    render() {
      gl.useProgram(program);
      layers.forEach((layer, index) => { this.setLayerProps(layer, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers[index]); gl.drawElements(); });
      this.particlesController.render(); this.ribbonsController.render();
    },
  };
  const clock = { frame: 0, sequenceIndex: -1, globalTime: 0 };
  return { calls, gl, native, model, clock };
}

test('an early glow draws after later opaque faces, each layer and effect once, without model reordering', () => {
  const { calls, gl, native, model, clock } = fixture(), before = structuredClone(model);
  const originalRender = native.render, originalParticles = native.particlesController.render, originalRibbons = native.ribbonsController.render;
  const adapter = installWarcraftPreviewAdapter(gl, model, () => clock); adapter.ready(native);
  native.render([], [], {});
  assert.deepEqual(calls.filter(call => call[0] !== 'blend'), [['mesh', 1], ['mesh', 0], ['mesh', 2], ['particles'], ['ribbons']]);
  assert.deepEqual(calls.filter(call => call[0] === 'blend').at(-1), ['blend', gl.ONE, gl.ONE]);
  assert.deepEqual(model, before);
  calls.length = 0; clock.hiddenGeosets = new Set([0]); native.render([], [], {});
  assert.deepEqual(calls.filter(call => call[0] === 'mesh'), [['mesh', 1], ['mesh', 2]]);
  adapter.dispose();
  assert.equal(native.render, originalRender); assert.equal(native.particlesController.render, originalParticles); assert.equal(native.ribbonsController.render, originalRibbons);
});

test('draw failure resets the pass and the next render still renders effects once', () => {
  const { calls, gl, native, model, clock } = fixture();
  let fail = true; const originalDraw = gl.drawElements;
  gl.drawElements = function (...args) { if (fail) throw Error('test draw failure'); return originalDraw.apply(this, args); };
  const adapter = installWarcraftPreviewAdapter(gl, model, () => clock); adapter.ready(native);
  assert.throws(() => native.render([], [], {}), /test draw failure/);
  fail = false; calls.length = 0; native.render([], [], {});
  assert.equal(calls.filter(call => call[0] === 'particles').length, 1);
  assert.equal(calls.filter(call => call[0] === 'ribbons').length, 1);
  adapter.dispose();
});
