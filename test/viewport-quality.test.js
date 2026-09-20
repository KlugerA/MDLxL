import test from 'node:test';
import assert from 'node:assert/strict';
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, PerspectiveCamera, OrthographicCamera, Vector3 } from 'three';
import { EditorCameraControls, zoomEditorCamera } from '../app/editor-camera-controls.js';
import { configureEditorTexture, cameraLeftLight, captureDimensions, improveNativeTexture } from '../app/viewport-quality.js';
import { modelCameraGizmos } from '../app/model-camera-overlay.js';
import { patchWarcraftMeshVertexShader, patchWarcraftMeshFragmentShader } from '../app/warcraft-preview-adapter.js';

test('perspective zoom changes projected size while retaining camera position, target and depth proportions', () => {
  const camera = new PerspectiveCamera(42, 1, 100, 1000); camera.position.set(0, 0, 320); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const controls = new EditorCameraControls(camera), original = camera.position.clone(), direction = camera.quaternion.clone();
  const a = new Vector3(10, 0, 0), b = new Vector3(10, 0, 50);
  const widthA = a.clone().project(camera).x, widthB = b.clone().project(camera).x;
  controls.dollyOut(2); controls.update(); camera.updateMatrixWorld();
  assert.equal(camera.zoom, 2); assert.ok(camera.position.distanceTo(original) < 1e-9); assert.ok(camera.quaternion.angleTo(direction) < 1e-8);
  assert.ok(Math.abs(a.clone().project(camera).x / widthA - 2) < 1e-9);
  assert.ok(Math.abs(b.clone().project(camera).x / widthB - 2) < 1e-9);
  assert.equal(camera.near, 100); assert.equal(camera.far, 1000);
  controls.dollyIn(2); assert.equal(camera.zoom, 1);
  const ortho = new OrthographicCamera(-1, 1, 1, -1); zoomEditorCamera(ortho, 10000); assert.equal(ortho.zoom, 100);
});

test('key light remains on viewing-camera left after rotation and pan', () => {
  for (const position of [[10, -20, 30], [-30, 10, 5], [0, 0, 40]]) {
    const camera = new PerspectiveCamera(), target = new Vector3(4, 5, 6); camera.position.fromArray(position); camera.lookAt(target);
    const light = cameraLeftLight(camera, target, 100), local = light.position.clone().sub(target).applyQuaternion(camera.quaternion.clone().invert());
    assert.ok(local.x < 0 && local.y > 0 && local.z > 0); assert.ok(Math.abs(light.direction.length() - 1) < 1e-9);
  }
});

test('decoded texture maps generate filtered mipmaps and native upload preserves previous binding', () => {
  const texture = configureEditorTexture(new DataTexture(new Uint8Array(64), 4, 4), 64);
  assert.equal(texture.magFilter, LinearFilter); assert.equal(texture.minFilter, LinearMipmapLinearFilter); assert.equal(texture.generateMipmaps, true); assert.equal(texture.anisotropy, 16);
  const calls = [], gl = { TEXTURE_2D:1,TEXTURE_BINDING_2D:2,TEXTURE_MAG_FILTER:3,TEXTURE_MIN_FILTER:4,LINEAR:5,LINEAR_MIPMAP_LINEAR:6,
    getParameter: () => 'previous', bindTexture: (...args) => calls.push(['bind',...args]), generateMipmap: (...args) => calls.push(['mips',...args]), texParameteri: (...args) => calls.push(['parameter',...args]) };
  improveNativeTexture(gl, { rendererData:{textures:{'skin.blp':'skin'}} }, 'skin.blp');
  assert.deepEqual(calls[0], ['bind',1,'skin']); assert.deepEqual(calls.at(-1), ['bind',1,'previous']); assert.ok(calls.some(call=>call[0]==='mips'));
});

test('capture dimensions render at requested long edge, preserve aspect and respect GPU limits', () => {
  assert.deepEqual(captureDimensions(800,600,3840), {width:3840,height:2880});
  assert.deepEqual(captureDimensions(600,800,1920), {width:1440,height:1920});
  assert.deepEqual(captureDimensions(800,600,3840,2048), {width:2048,height:1536});
  assert.deepEqual(captureDimensions(800,600), {width:800,height:600});
});

test('camera gizmos follow animated camera and target without modifying model', () => {
  const track = Vector => ({LineType:0,Keys:[{Frame:0,Vector}]});
  const model = {Sequences:[{Interval:[0,100]}],Cameras:[{Name:'Portrait',Position:[0,-20,10],TargetPosition:[0,0,10],FieldOfView:Math.PI/4,Translation:track([10,0,0]),TargetTranslation:track([0,0,20])}]};
  const original = structuredClone(model), [gizmo] = modelCameraGizmos(model,50,0);
  assert.deepEqual(gizmo.position.toArray(),[10,-20,10]); assert.deepEqual(gizmo.segments[0][1].toArray(),[0,0,30]); assert.equal(gizmo.segments.length,11); assert.deepEqual(model,original);
  assert.deepEqual(modelCameraGizmos({Cameras:[{Position:[NaN,0,0],TargetPosition:[0,0,0]}]}),[]);
});

test('native shader repairs retain SD bone bounds and derivative support for smooth alpha cutouts', () => {
  const vertex = 'uniform mat4 uNodesMatrices[128]; attribute vec4 aGroup; void main() { vNormal = aNormal; }';
  const result = patchWarcraftMeshVertexShader(vertex);
  assert.ok(result.includes('aGroup[3] < 128.')); assert.ok(!result.includes('${MAX_NODES}'));
  const fragment = 'precision mediump float; uniform mat3 uTVertexAnim; uniform float uWireframe; void main() { gl_FragColor = vec4(1.); if (gl_FragColor[3] < uDiscardAlphaLevel) { discard; } }';
  const shader = patchWarcraftMeshFragmentShader(fragment);
  assert.ok(shader.startsWith('#version 300 es')); assert.ok(shader.includes('fwidth(gl_FragColor.a)')); assert.ok(shader.includes('uMdlxlLightDirection'));
});

test('classic portrait uses clamped vertex lighting without changing ordinary inspection shading', () => {
  const vertex = patchWarcraftMeshVertexShader('uniform mat4 uNodesMatrices[128]; attribute vec4 aGroup; void main() { vNormal = aNormal; }');
  const fragment = patchWarcraftMeshFragmentShader('precision mediump float; uniform mat3 uTVertexAnim; uniform float uWireframe; void main() { gl_FragColor = vec4(1.); }');
  assert.ok(vertex.includes('out float vMdlxlPortraitLight;'));
  assert.ok(vertex.includes('vMdlxlPortraitLight = clamp(.3 + max(0., dot(vNormal, normalize(uMdlxlLightDirection))), 0., 1.)'));
  assert.ok(fragment.includes('in float vMdlxlPortraitLight;'));
  assert.ok(fragment.includes('if (uMdlxlPortrait > .5) { if (uMdlxlLighting > .5) gl_FragColor.rgb *= vMdlxlPortraitLight; } else if (uMdlxlLegacy > .5)'));
  assert.ok(fragment.includes('mdlxlEncodeSRGB(max(inspectionBase'));
});
