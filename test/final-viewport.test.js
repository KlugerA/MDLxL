import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, OrthographicCamera, Vector3, Quaternion, HemisphereLight, DirectionalLight, MeshPhongMaterial, DoubleSide, FrontSide } from 'three';
import { EditorCameraControls, editorCameraAngles, setEditorCameraAngles } from '../app/editor-camera-controls.js';
import { normalizePreviewLighting, previewLighting } from '../src/preview-lighting.js';
import { configurePreviewLights, applyPreviewMaterialLighting } from '../app/preview-lighting.js';
import { viewportCursor, ROTATION_CURSOR } from '../app/viewport-cursors.js';
import { projectMovementNodes, drawMovementOverlay } from '../app/movement-overlay.js';
import { normalSegments } from '../app/preview-overlays.js';
import { needsSolidDepthPrepass } from '../app/preview-depth.js';
import { platformGeometry, previewPlatformOptions } from '../app/preview-platform.js';
import { projectPreviewGeosets, pickPreviewGeoset, selectPreviewVertices } from '../app/preview-selection.js';
import { samplePreviewMatrices } from '../app/preview-pose.js';
import { skinGeoset, sampleNodeMatrices } from '../src/animation.js';
import { createPreviewSceneGL } from '../app/preview-scene-gl.js';
import { createViewportGrid } from '../app/viewport-grid.js';
import { ModelRenderer } from 'war3-model';
import { createDemoDocument } from '../src/editor-document.js';
import { skinGeosetNormals } from '../src/animation.js';

const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≈ ${b}`);
const camera = () => { const c = new OrthographicCamera(-10, 10, 10, -10, .1, 1000); c.position.set(0, 0, 30); c.lookAt(0, 0, 0); c.updateMatrixWorld(); return c; };

test('camera XYZ fields round-trip all axes and preserve orbit target, distance, zoom and authored data', () => {
  for (const c of [camera(), new PerspectiveCamera(45, 2, .1, 1000)]) {
    c.position.set(30, 40, 50); c.zoom = 2; const target = new Vector3(3, 4, 5), distance = c.position.distanceTo(target);
    assert.equal(setEditorCameraAngles(c, target, { x: 20, y: 30, z: 40 }), true);
    const values = editorCameraAngles(c); near(values.x, 20); near(values.y, 30); near(values.z, 40);
    const controls = new EditorCameraControls(c); controls.target.copy(target); setEditorCameraAngles(c, target, values); controls.update();
    const afterUpdate = editorCameraAngles(c); near(afterUpdate.x, 20); near(afterUpdate.y, 30); near(afterUpdate.z, 40);
    near(c.position.distanceTo(target), distance); near(c.zoom, 2); assert.deepEqual(target.toArray(), [3, 4, 5]);
    near(c.getWorldDirection(new Vector3()).dot(target.clone().sub(c.position).normalize()), 1);
    const before = c.position.clone(); assert.equal(setEditorCameraAngles(c, target, { x: NaN, y: 0, z: 0 }), false); assert.deepEqual(c.position, before);
  }
});

test('orthographic orbit retains equal projected dimensions at different depths', () => {
  const c = camera(); setEditorCameraAngles(c, new Vector3(), { x: 12, y: 31, z: -7 });
  const right = new Vector3(1, 0, 0).applyQuaternion(c.quaternion), forward = c.getWorldDirection(new Vector3());
  const widthAt = depth => { const a = forward.clone().multiplyScalar(depth), b = a.clone().add(right); return a.project(c).distanceTo(b.project(c)); };
  near(widthAt(-5), widthAt(5));
});

test('requested lighting is exact, configurable and applied without altering model materials', () => {
  assert.deepEqual(normalizePreviewLighting(), { preset: 'requested', ambient: [128, 128, 128], diffuse: [192, 192, 192], specular: [0, 0, 0], power: 1 });
  const config = previewLighting(), ambient = new HemisphereLight(), key = new DirectionalLight(), material = new MeshPhongMaterial();
  configurePreviewLights(ambient, key, config); applyPreviewMaterialLighting(material, config);
  near(ambient.color.r, 128 / 255); near(ambient.groundColor.r, 128 / 255); near(key.color.r, 192 / 255); near(key.intensity, Math.PI);
  assert.equal(material.specular.getHex(), 0); assert.equal(material.shininess, 1);
  configurePreviewLights(ambient, key, previewLighting({ lighting: { preset: 'legacy' } })); near(ambient.intensity, 2.2); near(key.intensity, 2.8);
  assert.deepEqual(normalizePreviewLighting({ preset: 'custom', ambient: [-2, 256, 32], power: -3 }).ambient, [0, 255, 32]);
  material.dispose();
});

test('selection arrow and every rotation pathway share one cursor and restore predictably', () => {
  assert.equal(viewportCursor('work', 'select'), 'default');
  for (const args of [['rotate', 'select'], ['work', 'rotate'], ['work', 'rotateNormals'], ['work', 'select', true]]) assert.equal(viewportCursor(...args), ROTATION_CURSOR);
  assert.equal(viewportCursor('work', 'select', false), 'default');
});

test('bone/helper cubes retain reference size, roots differ, attachments are tetrahedra and links run black to white', () => {
  const model = { Bones: [{ ObjectId: 0, PivotPoint: [0, 0, 0] }, { ObjectId: 1, Parent: 0, PivotPoint: [4, 0, 0] }], Helpers: [{ ObjectId: 2, Parent: 0, PivotPoint: [0, 4, 0] }], Attachments: [{ ObjectId: 3, Parent: 0, PivotPoint: [0, 6, 0] }] };
  const before = structuredClone(model), points = projectMovementNodes(model, 0, -1, camera(), 400, 400);
  assert.equal(points[3].tetrahedron.length, 4);
  const boxes = [], colors = [], stops = [], gradients = [];
  const context = new Proxy({ rect(...args) { boxes.push(args); }, fill() { colors.push(this.fillStyle); }, createLinearGradient(...args) { gradients.push(args); return { addColorStop(...stop) { stops.push(stop); } }; } }, { get: (o, k) => k in o ? o[k] : () => {} });
  drawMovementOverlay(context, points, [], [], 400, 400, 1, { bones: true, nodes: true, attachments: true, boneLines: true });
  assert.deepEqual(boxes.map(box => box.slice(2)), [[18, 18], [18, 18], [18, 18]]);
  assert.ok(colors.includes('#4cff59')); assert.ok(colors.includes('#b2b2ff')); assert.ok(!colors.includes('#4cb259'));
  assert.deepEqual(stops, Array.from({length: 3}, () => [[0, '#000000'], [1, '#ffffff']]).flat());
  assert.ok(gradients[0][0]!==points[0].x||gradients[0][1]!==points[0].y,'connector begins outside the parent marker'); assert.deepEqual(model, before);
});

test('normal indicators preserve split stored directions, normalize display length and leave data intact', () => {
  const vertices = new Float32Array([0, 0, 0, 0, 0, 0]), normals = new Float32Array([0, 0, 2, 0, -3, 0]);
  const before = new Float32Array(normals);
  assert.deepEqual(normalSegments(vertices, normals, 5), [[[0, 0, 0], [0, 0, 5]], [[0, 0, 0], [0, -5, 0]]]);
  assert.deepEqual(normals, before); assert.deepEqual(normalSegments(vertices, new Float32Array(), 5), []);
});

test('preview marquee spans selectable geosets; empty clicks clear and Ctrl inspection finds nearest surface', () => {
  const geo = z => ({ faces: new Uint16Array([0, 1, 2]), vertices: new Float32Array([-2, -2, z, 2, -2, z, 0, 2, z]) });
  const geosets = projectPreviewGeosets([{ ...geo(0), index: 0 }, { ...geo(5), index: 1 }], camera(), 400, 400);
  assert.equal(pickPreviewGeoset(geosets, 200, 200).index, 1);
  assert.deepEqual(selectPreviewVertices(geosets, {}, { x: 140, y: 140 }, { x: 260, y: 260 }), { 0: [0, 1, 2], 1: [0, 1, 2] });
  assert.deepEqual(selectPreviewVertices(geosets, {}, { x: 140, y: 140 }, { x: 260, y: 260 }, [1]), { 1: [0, 1, 2] });
  assert.deepEqual(selectPreviewVertices(geosets, { 0: [0], 1: [1] }, { x: 5, y: 5 }, { x: 5, y: 5 }), { 0: [], 1: [] });
  assert.deepEqual(selectPreviewVertices(geosets, { 0: [0] }, { x: 5, y: 5, shift: true }, { x: 5, y: 5 }), { 0: [0], 1: [] });
});

test('billboard-bound mesh and children face changing cameras while ordinary bones and source tracks remain intact', () => {
  const model = { Bones: [{ ObjectId: 0, Flags: 8, PivotPoint: [0, 0, 0] }, { ObjectId: 1, Parent: 0, PivotPoint: [0, 0, 0] }, { ObjectId: 2, PivotPoint: [0, 0, 0] }] };
  const geo = { Vertices: new Float32Array([0, -1, -1, 0, 1, -1, 0, 0, 1]), Groups: [[0]], VertexGroup: [0, 0, 0] };
  const before = structuredClone(model), c = camera();
  for (const angle of [0, 45, 100]) {
    setEditorCameraAngles(c, new Vector3(), { x: 0, y: angle, z: 0 });
    const matrices = samplePreviewMatrices(model, 0, -1, 0, c), positions = skinGeoset(geo, matrices);
    const a = new Vector3().fromArray(positions), b = new Vector3().fromArray(positions, 3), d = new Vector3().fromArray(positions, 6);
    const normal = b.sub(a).cross(d.sub(a)).normalize(); near(Math.abs(normal.dot(c.getWorldDirection(new Vector3()))), 1);
    assert.deepEqual(matrices.get(1), matrices.get(0)); assert.deepEqual(matrices.get(2), sampleNodeMatrices(model).get(2));
  }
  assert.deepEqual(model, before);
});

test('all billboard axis flags match native evaluated matrices, keep animated pivots and normalized normals', () => {
  const correction = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
  for (const flags of [8, 16, 32, 64]) for (const angle of [0, 40, 110]) {
    const model = createDemoDocument().model;
    for (const node of model.Nodes) if (node) node.Flags &= ~120;
    const node = model.Nodes.find(node => node?.Parent != null) || model.Nodes[0]; node.Flags |= flags;
    const before = structuredClone(model), c = camera(); setEditorCameraAngles(c, new Vector3(), { x: 21, y: angle, z: -18 });
    const frame = model.Sequences[0].Interval[0] + 100;
    const native = new ModelRenderer(model); native.setFrame(frame); native.setCamera(c.position.toArray(), c.quaternion.clone().multiply(correction).toArray()); native.updateNode(native.rendererData.rootNode);
    const matrices = samplePreviewMatrices(model, frame, 0, frame, c), baseline = sampleNodeMatrices(model, frame, 0, frame);
    for (const [id, matrix] of matrices) matrix.elements.forEach((value, i) => near(value, native.rendererData.nodes[id].matrix[i], 2e-4));
    const pivot = new Vector3().fromArray(node.PivotPoint), posed = pivot.clone().applyMatrix4(matrices.get(node.ObjectId)), original = pivot.clone().applyMatrix4(baseline.get(node.ObjectId));
    near(posed.distanceTo(original), 0, 2e-4);
    for (const geo of model.Geosets) { const normals = skinGeosetNormals(geo, matrices); for (let i = 0; i < normals.length; i += 3) near(Math.hypot(...normals.subarray(i, i + 3)), 1, 2e-4); }
    assert.deepEqual(model, before);
  }
});

test('platform shapes have correct triangle counts, clockwise faces remain backs and settings never alter model data', () => {
  const center = new Vector3(3, 4, 5);
  for (const [shape, count] of [['square', 4], ['hexagon', 6], ['disc', 64]]) {
    const geometry = platformGeometry(previewPlatformOptions({ platform: { enabled: true, shape, size: 2, height: 3 } }), center, 10, -1);
    assert.equal(geometry.vertices.length / 9, count); assert.equal(geometry.uvs.length / 6, count);
    near(geometry.vertices[2], 1.999, 1e-5);
    const [a, b, c] = [0, 3, 6].map(i => new Vector3().fromArray(geometry.vertices, i)); assert.ok(b.sub(a).cross(c.sub(a)).z > 0);
  }
  assert.deepEqual(center.toArray(), [3, 4, 5]);
});

test('grid uses a background pass with no depth writes; platform and model depth remain available', () => {
  const calls = []; let counter = 0;
  const gl = new Proxy({}, { get(object, key) {
    if (key in object) return object[key];
    if (key === key.toUpperCase()) return object[key] = ++counter;
    if (key.startsWith('create')) return () => ({});
    if (key.startsWith('get')) return () => true;
    return (...args) => calls.push([key, ...args]);
  } });
  const scene = createPreviewSceneGL(gl), prefs = { grid: { extent: 8, spacing: 8 }, platform: { enabled: true } };
  scene.draw(camera(), prefs, 'xy', true, new Vector3(), 10, 0, { gridOnly: true });
  const draw = calls.findIndex(call => call[0] === 'drawArrays');
  assert.ok(draw > 0); assert.ok(calls.slice(0, draw).some(call => call[0] === 'enable' && call[1] === gl.DEPTH_TEST));
  assert.ok(calls.slice(0, draw).some(call => call[0] === 'depthMask' && call[1] === false));
  assert.equal(calls[draw][1], gl.LINES);
  assert.deepEqual(calls.filter(call => call[0] === 'depthMask').at(-1), ['depthMask', true]);
  scene.draw(camera(), prefs, 'xy', true, new Vector3(), 10, 0, { platformOnly: true });
  assert.deepEqual(calls.filter(call => call[0] === 'drawArrays').map(call => call[1]), [gl.LINES, gl.TRIANGLES, gl.TRIANGLES]);
  scene.dispose();
  const grid = createViewportGrid(); grid.update(prefs, 'xy', true, true);
  assert.ok(grid.children.every(line => line.renderOrder < 0 && line.material.transparent === false && line.material.depthWrite === false && line.material.depthTest));
  grid.dispose();
});

test('solid occlusion prepass is limited to views without rendered model surfaces', () => {
  assert.equal(needsSolidDepthPrepass('wireframe'), true);
  assert.equal(needsSolidDepthPrepass('vertices'), true);
  assert.equal(needsSolidDepthPrepass('textured'), false);
  assert.equal(needsSolidDepthPrepass('solid'), false);
});
