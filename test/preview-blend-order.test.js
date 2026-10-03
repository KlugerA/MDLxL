import test from 'node:test';
import assert from 'node:assert/strict';
import { installWarcraftPreviewAdapter, isExplicitHdMaterial } from '../app/warcraft-preview-adapter.js';

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

test('weighted Classic materials keep HD skinning and render every authored layer', () => {
  const calls = [], buffers = [{}], program = {}, textures = [{ Image: 'skin.blp' }, { Image: 'glow.blp' }];
  const layers = [{ FilterMode: 0, TextureID: 0, Alpha: 1 }, { FilterMode: 3, TextureID: 1, Alpha: .5 }];
  const model = {
    Sequences: [], GlobalSequences: [], GeosetAnims: [], Textures: textures,
    Geosets: [{ MaterialID: 0, SkinWeights: new Uint8Array([0, 0, 0, 0, 255, 0, 0, 0]) }],
    Materials: [{ Shader: '', Layers: layers }],
  };
  let bound, activeTexture = 0, hdCalls = 0, created = 0, deleted = 0; const uploadedPixels = [];
  const gl = {
    ELEMENT_ARRAY_BUFFER: 1, ONE: 2, SRC_COLOR: 3, SAMPLE_ALPHA_TO_COVERAGE: 4,
    TEXTURE_2D: 5, TEXTURE0: 10, TEXTURE1: 11, TEXTURE2: 12, TEXTURE_MIN_FILTER: 13,
    TEXTURE_MAG_FILTER: 14, TEXTURE_WRAP_S: 15, TEXTURE_WRAP_T: 16, LINEAR: 17,
    CLAMP_TO_EDGE: 18, RGBA: 19, UNSIGNED_BYTE: 20,
    shaderSource() {}, useProgram() {}, bindBuffer(target, buffer) { bound = buffer; },
    drawElements() { calls.push(['mesh', buffers.indexOf(bound), activeTexture]); },
    getUniformLocation: (_, name) => name, getContextAttributes: () => ({ antialias: false }),
    uniform1f() {}, uniform1i() {}, uniform3fv() {}, uniform4fv() {}, enable() {}, disable() {}, depthMask() {}, blendFuncSeparate() {},
    blendFunc(src, dst) { calls.push(['blend', src, dst]); },
    createTexture() { created++; return { created }; }, deleteTexture() { deleted++; },
    activeTexture(unit) { activeTexture = unit; }, bindTexture() {}, texParameteri() {}, texImage2D(...args) { uploadedPixels.push(Array.from(args.at(-1))); },
  };
  const native = {
    isHD: true, model, shaderProgram: program, indexBuffer: buffers,
    rendererData: { materialLayerTextureID: [[0, 1]], textures: { 'skin.blp': {}, 'glow.blp': {} }, teamColor: [1, 0, 0] },
    shaderProgramLocations: { replaceableColorUniform: 'color', replaceableTypeUniform: null, normalSamplerUniform: 'normal', ormSamplerUniform: 'orm' },
    setLayerProps(layer) { gl.activeTexture(gl.TEXTURE0); if (layer.FilterMode === 3) gl.blendFunc(gl.SRC_COLOR, gl.ONE); },
    setLayerPropsHD() { hdCalls++; throw Error('Classic material entered the native HD material path'); },
    particlesController: { render() {} }, ribbonsController: { emitters: [], update() {}, render() {} },
    render() { gl.useProgram(program); this.setLayerPropsHD(0, layers); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers[0]); gl.drawElements(); },
  };
  const before = structuredClone(model), clock = { frame: 0, sequenceIndex: -1, globalTime: 0 };
  const adapter = installWarcraftPreviewAdapter(gl, model, () => clock); adapter.ready(native);
  native.render([], [], {});
  assert.equal(hdCalls, 0);
  assert.deepEqual(calls.filter(call => call[0] === 'mesh').map(call => call[1]), [0, 0]);
  assert.deepEqual(calls.filter(call => call[0] === 'blend').at(-1), ['blend', gl.ONE, gl.ONE]);
  assert.equal(created, 2);
  assert.deepEqual(uploadedPixels, [[128, 128, 255, 255], [255, 255, 0, 0]]);
  assert.deepEqual(model, before);
  adapter.dispose(); assert.equal(deleted, 2);
});

test('only explicitly HD materials bypass the weighted Classic adapter', () => {
  assert.equal(isExplicitHdMaterial({ Shader: '', Layers: [{ TextureID: 0 }] }), false);
  assert.equal(isExplicitHdMaterial({ Shader: 'Shader_HD_DefaultUnit', Layers: [{ TextureID: 0 }] }), true);
  assert.equal(isExplicitHdMaterial({ Layers: [{ ShaderTypeId: 1, TextureID: 0 }] }), true);
});
