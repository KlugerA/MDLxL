import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createPixelLineBatch } from '../app/pixel-lines.js';
import { drawPreviewGeometryOverlay } from '../app/preview-overlays.js';

function rasterContext(width, height) {
  const uploads = [], calls = { fillRect: 0 };
  const context = new Proxy({
    canvas: { width, height }, uploads, calls,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: image => uploads.push(new Uint8ClampedArray(image.data)),
    fillRect: () => { calls.fillRect++; },
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  return context;
}

test('wire raster clips distant offscreen lines and uploads sharp pixels once', () => {
  const context = rasterContext(20, 10), batch = createPixelLineBatch(context);
  batch.draw({ x: -10_000_000, y: 5 }, { x: 10_000_000, y: 5 }, { color: '#4cb259' });
  batch.flush();
  assert.equal(context.uploads.length, 1);
  assert.equal(context.calls.fillRect, 0);
  for (let x = 0; x < 20; x++) assert.deepEqual([...context.uploads[0].slice((5 * 20 + x) * 4, (5 * 20 + x) * 4 + 4)], [76, 178, 89, 255]);
});

test('wireframe geometry uses a single pixel upload for its visible and hidden edges', () => {
  const context = rasterContext(200, 200), camera = new PerspectiveCamera(60, 1, .1, 100);
  camera.position.set(0, 0, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const geosets = [{ index: 0, vertices: new Float32Array([-2, -2, 0, 2, -2, 0, 0, 2, 0]), faces: new Uint16Array([0, 1, 2]) }];
  drawPreviewGeometryOverlay(context, geosets, camera, 200, 200, { wires: true, selectableGeosets: [0] }, new Vector3(), 4);
  assert.equal(context.uploads.length, 1);
  assert.equal(context.calls.fillRect, 0);
  assert.ok(context.uploads[0].some(value => value !== 0));
});
