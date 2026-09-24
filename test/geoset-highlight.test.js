import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshBasicMaterial, OrthographicCamera, PointsMaterial } from 'three';
import { configureGeosetHighlightMaterial, drawGeosetHighlight } from '../app/geoset-highlight.js';

test('3D hover material switches between wire, vertices, and filled color', () => {
  const mesh = new MeshBasicMaterial({ wireframe: true, transparent: true });
  const points = new PointsMaterial();
  configureGeosetHighlightMaterial(mesh, points, { color: '#123456', type: 'fill' });
  assert.equal(mesh.wireframe, false); assert.equal(mesh.opacity, .55);
  assert.equal(mesh.color.getHexString(), '123456'); assert.equal(points.color.getHexString(), '123456');
  configureGeosetHighlightMaterial(mesh, points, { color: '#abcdef', type: 'wire' });
  assert.equal(mesh.wireframe, true); assert.equal(mesh.opacity, 1);
  assert.equal(mesh.color.getHexString(), 'abcdef');
  mesh.dispose(); points.dispose();
});

test('geoset highlight styles use the selected color and only their requested geometry', () => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 5; camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const faces = [0, 1, 2], positions = [-.5, -.5, 0, .5, -.5, 0, 0, .5, 0];
  for (const [type, expected] of [['wire-vertices', [1, 0, 3]], ['wire', [1, 0, 0]], ['fill', [0, 1, 0]]]) {
    const calls = { stroke: 0, fill: 0, fillRect: 0 };
    const context = { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() { calls.stroke++; }, fill() { calls.fill++; }, fillRect() { calls.fillRect++; }, globalAlpha: 1 };
    drawGeosetHighlight(context, faces, positions, camera, 100, 100, { color: '#abcdef', type });
    assert.equal(context.fillStyle, '#abcdef');
    assert.deepEqual([calls.stroke, calls.fill, calls.fillRect], expected, type);
    assert.equal(context.globalAlpha, 1);
  }
});
