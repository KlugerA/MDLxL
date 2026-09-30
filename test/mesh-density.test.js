import test from 'node:test';
import assert from 'node:assert/strict';
import { changeGeosetDensity, densifyGeoset, prepareMeshDensity } from '../src/mesh-density.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

await prepareMeshDensity();

function quad(size = 1) {
  return {
    Vertices: new Float32Array([0, 0, 0, size, 0, 0, size, size, 0, 0, size, 0]),
    Normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    TVertices: [new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])],
    VertexGroup: new Uint8Array(4), Groups: [[0]], TotalGroupsCount: 1,
    Faces: new Uint16Array([0, 1, 2, 0, 2, 3]), PrimitiveTypes: new Uint32Array([4]), PrimitiveCounts: new Uint32Array([6]),
  };
}

function grid(size = 9) {
  const vertices = [], normals = [], uv = [], faces = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { vertices.push(x, y, 0); normals.push(0, 0, 1); uv.push(x / (size - 1), y / (size - 1)); }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const a = y * size + x; faces.push(a, a + 1, a + size, a + 1, a + size + 1, a + size); }
  return { Vertices: new Float32Array(vertices), Normals: new Float32Array(normals), TVertices: [new Float32Array(uv)], VertexGroup: new Uint8Array(size * size), Groups: [[0]], Faces: new Uint16Array(faces), PrimitiveTypes: new Uint32Array([4]), PrimitiveCounts: new Uint32Array([faces.length]) };
}

function sparseBlade() {
  const triangles = [];
  for (const side of [0, 1]) {
    const left = [side, 0, 0], right = [side, 10, 0], upperLeft = [side, 1, 1], lowerLeft = [side, 1, -1], upperRight = [side, 9, 1], lowerRight = [side, 9, -1];
    triangles.push([left, right, lowerRight], [right, left, upperRight], [upperRight, left, upperLeft], [left, lowerRight, lowerLeft]);
  }
  for (let index = 0; index < 52; index++) {
    const y = 20 + index * 2;
    triangles.push([[20, y, 0], [21, y, 0], [20, y + 1, 0]]);
  }
  const vertices = triangles.flat(2), count = vertices.length / 3;
  return {
    Vertices: new Float32Array(vertices), Normals: new Float32Array(Array.from({ length: count }, () => [0, 0, 1]).flat()),
    TVertices: [new Float32Array(Array.from({ length: count }, (_, index) => [vertices[index * 3] / 21, vertices[index * 3 + 1] / 124]).flat())],
    VertexGroup: new Uint8Array(count), Groups: [[0]], TotalGroupsCount: 1,
    Faces: new Uint16Array(Array.from({ length: count }, (_, index) => index)), PrimitiveTypes: new Uint32Array([4]), PrimitiveCounts: new Uint32Array([count]),
  };
}

test('more density replaces long diagonals with a compact square grid and interpolates the surface and UVs', async () => {
  const source = quad(), result = await changeGeosetDensity(source, 100), geoset = result.geoset;
  assert.equal(result.trianglesBefore, 2); assert.equal(result.trianglesAfter, 18); assert.equal(geoset.PrimitiveCounts[0], geoset.Faces.length);
  assert.deepEqual(source, quad(), 'preview generation must not mutate the source');
  const records = Array.from({ length: geoset.Vertices.length / 3 }, (_, index) => ({ p: [...geoset.Vertices.slice(index * 3, index * 3 + 3)], uv: [...geoset.TVertices[0].slice(index * 2, index * 2 + 2)] }));
  for (const record of records) assert.deepEqual(record.uv, record.p.slice(0, 2), 'new UVs follow the same barycentric position as the flat source');
  for (let offset = 0; offset < geoset.Faces.length; offset += 3) {
    const positions = Array.from(geoset.Faces.slice(offset, offset + 3), index => [...geoset.Vertices.slice(index * 3, index * 3 + 2)]);
    for (let edge = 0; edge < 3; edge++) assert.ok(Math.hypot(positions[edge][0] - positions[(edge + 1) % 3][0], positions[edge][1] - positions[(edge + 1) % 3][1]) <= Math.SQRT2 / 3 + 1e-6, 'grid contains a stretched edge');
  }
});

test('equal-length mirrored edges are refined together instead of producing one-sided cuts', () => {
  const geoset = densifyGeoset(quad(2), 4), xs = new Set(Array.from({ length: geoset.Vertices.length / 3 }, (_, index) => geoset.Vertices[index * 3].toFixed(5)));
  for (const x of xs) assert.ok(xs.has((2 - Number(x)).toFixed(5)), `missing mirrored cut plane for X ${x}`);
});

test('square-grid coverage works on a surface with no world-axis alignment', async () => {
  const source = quad(2), along = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)], across = [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0];
  for (let index = 0; index < source.Vertices.length / 3; index++) {
    const x = source.Vertices[index * 3], y = source.Vertices[index * 3 + 1];
    for (let axis = 0; axis < 3; axis++) source.Vertices[index * 3 + axis] = along[axis] * x + across[axis] * y;
  }
  const result = await changeGeosetDensity(source, 100);
  assert.ok(result.trianglesAfter > result.trianglesBefore);
  for (let offset = 0; offset < result.geoset.Faces.length; offset += 3) {
    const positions = Array.from(result.geoset.Faces.slice(offset, offset + 3), index => [...result.geoset.Vertices.slice(index * 3, index * 3 + 3)]);
    for (let edge = 0; edge < 3; edge++) assert.ok(Math.hypot(...positions[edge].map((value, axis) => value - positions[(edge + 1) % 3][axis])) < 1.1, 'rotated surface retained a long texture-stretching edge');
  }
});

test('the slider builds simple square-like coverage and reaches the supplied flexible 60 to 124 maximum', async () => {
  const source = sparseBlade(), expected = [[25, 76], [50, 92], [75, 108], [100, 124]];
  for (const [amount, triangles] of expected) assert.equal((await changeGeosetDensity(source, amount)).trianglesAfter, triangles);
  const maximum = (await changeGeosetDensity(source, 100)).geoset;
  assert.equal(maximum.Vertices.length / 3, 372, 'triangle-corner UV topology stays independently wrappable');
  let bladeTriangles = 0;
  for (let offset = 0; offset < maximum.Faces.length; offset += 3) {
    const positions = Array.from(maximum.Faces.slice(offset, offset + 3), index => [...maximum.Vertices.slice(index * 3, index * 3 + 3)]);
    if (positions.every(value => value[0] < 2)) {
      bladeTriangles++;
      assert.ok(Math.max(...positions.map(value => value[1])) - Math.min(...positions.map(value => value[1])) <= 1.00001, 'a triangle crosses more than one grid column');
      assert.ok(Math.max(...positions.map(value => value[2])) - Math.min(...positions.map(value => value[2])) <= 1.00001, 'a triangle crosses more than one grid row');
    }
  }
  assert.equal(bladeTriangles, 72);
});

test('new vertices preserve classic and HD binding formats', async () => {
  const classic = quad(); classic.Groups = [[1], [2]]; classic.VertexGroup = new Uint8Array([0, 1, 1, 0]); classic.TotalGroupsCount = 2;
  const classicResult = (await changeGeosetDensity(classic, 100)).geoset;
  assert.ok(classicResult.Groups.some(group => group.length === 2 && group.includes(1) && group.includes(2)));
  assert.ok(classicResult.VertexGroup.every(index => classicResult.Groups[index]));
  const hd = quad(); hd.SkinWeights = new Uint8Array(4 * 8); hd.Tangents = new Float32Array(4 * 4);
  for (let index = 0; index < 4; index++) { hd.SkinWeights.set([index % 2, 0, 0, 0, 255, 0, 0, 0], index * 8); hd.Tangents.set([1, 0, 0, 1], index * 4); }
  const hdResult = (await changeGeosetDensity(hd, 100)).geoset;
  assert.equal(hdResult.SkinWeights.length, hdResult.Vertices.length / 3 * 8); assert.equal(hdResult.Tangents.length, hdResult.Vertices.length / 3 * 4);
  for (let offset = 0; offset < hdResult.SkinWeights.length; offset += 8) assert.equal([...hdResult.SkinWeights.slice(offset + 4, offset + 8)].reduce((sum, value) => sum + value, 0), 255);
});

test('less density protects the open border, keeps authored records and reports exact stream sizes', async () => {
  const source = grid(), before = new Set(Array.from({ length: source.Vertices.length / 3 }, (_, index) => JSON.stringify([...[...source.Vertices.slice(index * 3, index * 3 + 3)], ...source.TVertices[0].slice(index * 2, index * 2 + 2)])));
  const result = await changeGeosetDensity(source, -70), geoset = result.geoset;
  assert.ok(result.trianglesAfter < result.trianglesBefore); assert.ok(result.trianglesAfter >= result.targetTriangles);
  assert.equal(geoset.Normals.length, geoset.Vertices.length); assert.equal(geoset.TVertices[0].length, geoset.Vertices.length / 3 * 2); assert.equal(geoset.VertexGroup.length, geoset.Vertices.length / 3);
  for (let index = 0; index < geoset.Vertices.length / 3; index++) assert.ok(before.has(JSON.stringify([...[...geoset.Vertices.slice(index * 3, index * 3 + 3)], ...geoset.TVertices[0].slice(index * 2, index * 2 + 2)])), 'reduction must retain authored vertex records');
  const retained = new Set(Array.from({ length: geoset.Vertices.length / 3 }, (_, index) => `${geoset.Vertices[index * 3]},${geoset.Vertices[index * 3 + 1]}`));
  for (let value = 0; value < 9; value++) for (const key of [`0,${value}`, `8,${value}`, `${value},0`, `${value},8`]) assert.ok(retained.has(key), `open border lost ${key}`);
});

test('density is one undoable geoset edit and survives MDX save and reopen', async () => {
  const doc = createDemoDocument(), before = structuredClone(doc.model), result = await changeGeosetDensity(doc.model.Geosets[0], 100);
  doc.apply('Change geoset triangle density', ['Geosets'], model => { model.Geosets[0] = result.geoset; });
  assert.equal(doc.model.Geosets[0].Faces.length / 3, result.trianglesAfter); assert.deepEqual(doc.model.Materials, before.Materials); assert.deepEqual(doc.model.Nodes, before.Nodes);
  const reopened = openDocument(doc.serialize('mdx'), 'density.mdx');
  assert.equal(reopened.model.Geosets[0].Faces.length / 3, result.trianglesAfter); assert.equal(reopened.model.Geosets[0].Vertices.length, result.geoset.Vertices.length);
  assert.equal(doc.undo(), true); assert.deepEqual(doc.model.Geosets, before.Geosets);
  assert.equal(doc.redo(), true); assert.equal(doc.model.Geosets[0].Faces.length / 3, result.trianglesAfter);
});
