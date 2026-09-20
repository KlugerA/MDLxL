import test from 'node:test';
import assert from 'node:assert/strict';
import { alphaMask, buildForgeMesh, combineMask, commitForge, encodeForgeTga, magicWand, polygonMask, traceMask } from '../src/forge.js';
import { createDemoDocument, openDocument, validateModel } from '../src/editor-document.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';

const maskOf = lines => ({ width: lines[0].length, height: lines.length, mask: new Uint8Array(lines.join('').split('').map(c => c === '#' ? 1 : 0)) });
function projectedArea(g) {
  let sum = 0; for (let i = 0; i < g.Faces.length; i += 3) { const [a, b, c] = Array.from(g.Faces.slice(i, i + 3), n => n * 3); sum += Math.abs((g.Vertices[b] - g.Vertices[a]) * (g.Vertices[c + 1] - g.Vertices[a + 1]) - (g.Vertices[b + 1] - g.Vertices[a + 1]) * (g.Vertices[c] - g.Vertices[a])) / 2; } return sum;
}
test('polygon rasterization crops within the original image coordinate system', () => {
  const mask = polygonMask(8, 8, [[2, 1], [6, 1], [6, 7], [2, 7]]);
  assert.equal(mask.reduce((a, b) => a + b), 24);
  const g = buildForgeMesh({ mask, width: 8, height: 8, detail: 100, size: 8 }).geosets[0];
  const uv = g.TVertices[0]; assert.equal(Math.min(...uv.filter((_, i) => i % 2 === 0)), .25); assert.equal(Math.max(...uv.filter((_, i) => i % 2 === 0)), .75);
  assert.equal(projectedArea(g), 24);
});
test('wand distinguishes connected color from every matching shade and cleanup supports restoration', () => {
  const image = { width: 3, height: 1, data: new Uint8Array([255, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255]) };
  assert.deepEqual([...magicWand(image, 0, 0, 0, true)], [1, 0, 0]);
  assert.deepEqual([...magicWand(image, 0, 0, 0, false)], [1, 0, 1]);
  const original = alphaMask(image), cut = combineMask(original, magicWand(image, 0, 0, 0, false), 'remove');
  assert.deepEqual([...cut], [0, 1, 0]); assert.deepEqual([...combineMask(cut, new Uint8Array([1, 0, 0]), 'add', original)], [1, 1, 0]);
  assert.deepEqual([...combineMask(cut, null, 'reset', original)], [1, 1, 1]);
});
test('contours and triangles preserve holes, disconnected islands, and corner-touching pixels', () => {
  for (const input of [maskOf(['######..##', '#....#..##', '#.##.#....', '#....#....', '######....']), maskOf(['#.#', '.#.', '#.#'])]) {
    const loops = traceMask(input.mask, input.width, input.height); assert.ok(loops.length >= 3);
    const mesh = buildForgeMesh({ ...input, size: Math.max(input.width, input.height), detail: 100 });
    assert.ok(Math.abs(projectedArea(mesh.geosets[0]) - input.mask.reduce((a, b) => a + b)) < 1e-5);
    for (let i = 0; i < mesh.geosets[0].Faces.length; i += 3) {
      const uv = mesh.geosets[0].TVertices[0], face = [...mesh.geosets[0].Faces.slice(i, i + 3)], x = Math.min(input.width - 1, Math.floor(face.reduce((n, v) => n + uv[v * 2], 0) / 3 * input.width + 1e-8)), y = Math.min(input.height - 1, Math.floor(face.reduce((n, v) => n + uv[v * 2 + 1], 0) / 3 * input.height + 1e-8));
      assert.equal(input.mask[y * input.width + x], 1, `Triangle enters a removed pixel at ${x},${y}`);
    }
  }
});
test('Detail increases internal polygons and silhouette precision, including simple rectangles', () => {
  const square = { width: 64, height: 64, mask: new Uint8Array(4096).fill(1), size: 64 };
  const low = buildForgeMesh({ ...square, detail: 0 }), high = buildForgeMesh({ ...square, detail: 100 });
  assert.equal(low.vertexCount, 4); assert.equal(low.triangleCount, 2);
  assert.ok(high.geosets[0].Vertices.some((v, i) => i % 3 === 0 && v > -31 && v < 31), 'Detail provides interior support'); assert.equal(projectedArea(high.geosets[0]), 4096);
  const diagonal = Uint8Array.from({ length: 64 * 64 }, (_, i) => i % 64 >= Math.floor(i / 64) ? 1 : 0);
  assert.ok(traceMask(diagonal, 64, 64, 0)[0].length > traceMask(diagonal, 64, 64, 1.5)[0].length);
});
test('thickness closes every geometric edge and trim stays independently editable', () => {
  const input = maskOf(['########', '#......#', '#......#', '########']), mesh = buildForgeMesh({ ...input, size: 8, detail: 25, thickness: 2, trim: true, trimWidth: 1, trimThickness: 1, trimOffset: .2 });
  assert.equal(mesh.geosets.length, 2);
  for (const g of mesh.geosets) {
    const edges = new Map(), position = n => Array.from(g.Vertices.slice(n * 3, n * 3 + 3)).map(v => v.toFixed(5)).join(',');
    for (let i = 0; i < g.Faces.length; i += 3) for (let k = 0; k < 3; k++) { const p = position(g.Faces[i + k]), q = position(g.Faces[i + (k + 1) % 3]), key = [p, q].sort().join('|'); edges.set(key, (edges.get(key) || 0) + 1); }
    assert.ok([...edges.values()].every(n => n === 2), 'A closed thickness surface has an open edge');
    assert.ok(g.Normals.every(Number.isFinite));
  }
  const depth = mesh.geosets[1].Vertices.filter((_, i) => i % 3 === 2);
  assert.ok(Math.abs(Math.min(...depth) - (-.3)) < 1e-6); assert.ok(Math.abs(Math.max(...depth) - .7) < 1e-6);
});
test('TGA export retains original RGBA pixels, top origin and dimensions', () => {
  const image = { width: 2, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 255, 255, 255, 12]) };
  const decoded = new TGALoader().parse(encodeForgeTga(image).buffer);
  assert.equal(decoded.width, 2); assert.equal(decoded.height, 2); assert.deepEqual([...decoded.data], [...image.data]);
});
test('Forge shares exactly one DummyBone, round-trips MDL/MDX, and undoes atomically', () => {
  const doc = createDemoDocument(), before = doc.serialize(), initialCount = doc.model.Geosets.length;
  const mesh = buildForgeMesh({ ...maskOf(['####', '#..#', '####']), detail: 20, trim: true });
  const commit = () => doc.apply('Forge item', [], model => commitForge(model, mesh, { texturePath: 'MDLxL_Forge\\test.tga' }));
  const first = commit(), second = commit(); assert.equal(first.boneId, second.boneId);
  assert.equal(doc.model.Bones.filter(b => b.Name === 'DummyBone').length, 1);
  for (const gi of [...first.geosetIndices, ...second.geosetIndices]) assert.deepEqual(doc.model.Geosets[gi].Groups, [[first.boneId]]);
  for (const format of ['mdl', 'mdx']) { const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.readOnly, false); assert.equal(reopened.model.Geosets.length, initialCount + 4); assert.equal(reopened.model.Bones.filter(b => b.Name === 'DummyBone').length, 1); assert.deepEqual(validateModel(reopened.model).filter(d => d.severity === 'error'), []); }
  doc.undo(); doc.undo(); assert.deepEqual(doc.serialize(), before);
});
test('Forge safely rejects empty masks and invalid settings', () => {
  assert.throws(() => buildForgeMesh({ width: 2, height: 2, mask: new Uint8Array(4) }), /empty/);
  assert.throws(() => buildForgeMesh({ ...maskOf(['##', '##']), size: 0 }), /range/);
});
