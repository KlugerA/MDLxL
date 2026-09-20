import test from 'node:test';
import assert from 'node:assert/strict';
import { weldVertices, detachFaces, extrudeFaces } from '../src/mesh-tools.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

function geoset(vertices, faces, hd = true) {
  const count = vertices.length / 3;
  const g = {
    Vertices: new Float32Array(vertices), Normals: new Float32Array(Array.from({ length: count }, () => [0, 0, 1]).flat()),
    TVertices: [new Float32Array(vertices.flatMap((_, i) => i % 3 ? [] : [vertices[i], vertices[i + 1]])), new Float32Array(vertices.flatMap((_, i) => i % 3 ? [] : [vertices[i] / 2, vertices[i + 1] / 2]))],
    Faces: new Uint16Array(faces), VertexGroup: new Uint8Array(count), Groups: [[0], [1]], TotalGroupsCount: 2,
    MaterialID: 0, SelectionGroup: 0, Unselectable: false, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array([1, 1, 1]), BoundsRadius: 2,
    Anims: [{ MinimumExtent: new Float32Array([-1, -1, -1]), MaximumExtent: new Float32Array([10, 10, 10]), BoundsRadius: 20 }],
  };
  if (hd) {
    g.Tangents = new Float32Array(Array.from({ length: count }, () => [1, 0, 0, 1]).flat());
    g.SkinWeights = new Uint8Array(Array.from({ length: count }, () => [0, 0, 0, 0, 255, 0, 0, 0]).flat());
  }
  return g;
}
const patch = () => geoset([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3]);
const duplicated = () => geoset([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, -1, 0], [0, 1, 2, 3, 4, 5]);
const vectors = (array, stride) => Array.from({ length: array.length / stride }, (_, i) => Array.from(array.slice(i * stride, i * stride + stride)));
const faceNormal = (g, offset) => {
  const [a, b, c] = Array.from(g.Faces.subarray(offset, offset + 3), (i) => Array.from(g.Vertices.subarray(i * 3, i * 3 + 3)));
  const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};

test('weld compacts only selected coincident vertices and remaps selection and triangles', () => {
  const g = duplicated(), source = structuredClone(g);
  const result = weldVertices(g, [0, 3, 0]);
  assert.deepEqual(result, { merged: 1, selection: [0] });
  assert.equal(g.Vertices.length / 3, 5);
  assert.deepEqual([...g.Faces], [0, 1, 2, 0, 3, 4]);
  assert.deepEqual(vectors(g.TVertices[1], 2), vectors(source.TVertices[1], 2).filter((_, i) => i !== 3));
  assert.deepEqual(vectors(g.SkinWeights, 8), vectors(source.SkinWeights, 8).filter((_, i) => i !== 3));
  assert.deepEqual(g.Anims, source.Anims);
  const unselected = duplicated();
  assert.equal(weldVertices(unselected, [0]).merged, 0);
  assert.equal(unselected.Vertices.length / 3, 6);
});

test('weld never crosses normal, UV, matrix-group, tangent or skin seams', () => {
  for (const mutate of [
    (g) => { g.Normals[10] = 0.01; },
    (g) => { g.TVertices[0][6] = 0.01; },
    (g) => { g.TVertices[1][7] = 0.01; },
    (g) => { g.VertexGroup[3] = 1; },
    (g) => { g.Tangents[15] = -1; },
    (g) => { g.SkinWeights[24] = 1; },
  ]) {
    const g = duplicated(); mutate(g); const original = structuredClone(g);
    assert.equal(weldVertices(g, [0, 3], 0.1).merged, 0);
    assert.deepEqual(g, original);
  }
});

test('weld searches adjacent spatial cells and enforces Euclidean tolerance', () => {
  const g = duplicated(); g.Vertices[0] = -0.000001; g.Vertices[9] = 0.000001;
  assert.equal(weldVertices(g, [0, 3], 0.00001).merged, 1);
  const far = duplicated(); far.Vertices[9] = 0.009; far.Vertices[10] = 0.009;
  assert.equal(weldVertices(far, [0, 3], 0.01).merged, 0);
  const exact = duplicated(); assert.equal(weldVertices(exact, [3, 0], 0).merged, 1);
});

test('weld drops only collapsed triangles and refuses a wholly empty result atomically', () => {
  const g = duplicated(); g.Faces = new Uint16Array([0, 3, 2, 3, 4, 5]);
  assert.equal(weldVertices(g, [0, 3]).merged, 1);
  assert.deepEqual([...g.Faces], [0, 3, 4]);
  const empty = duplicated(); empty.Faces = new Uint16Array([0, 3, 2]); const original = structuredClone(empty);
  assert.throws(() => weldVertices(empty, [0, 3]), /every triangle/);
  assert.deepEqual(empty, original);
});

test('detach retains all UV/HD streams, material and animation metadata with independent copies', () => {
  const g = patch(); g.Name = 'Panel';
  const model = { Geosets: [g], GeosetAnims: [{ GeosetId: 0, Flags: 2, Alpha: { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([0.5]) }] }, Color: new Float32Array([1, 0, 0]) }], Bones: [{ GeosetId: 0 }], Info: {} };
  const original = structuredClone(g), newIndex = detachFaces(model, 0, [0, 1, 2]);
  assert.equal(newIndex, 1);
  const detached = model.Geosets[1];
  assert.deepEqual([...detached.Faces], [0, 1, 2]);
  assert.deepEqual([...g.Faces], [0, 1, 2]);
  assert.deepEqual(vectors(g.Vertices, 3), [0, 2, 3].map((i) => vectors(original.Vertices, 3)[i]));
  for (const [field, stride] of [['Normals', 3], ['Tangents', 4], ['SkinWeights', 8], ['VertexGroup', 1]]) assert.deepEqual(vectors(detached[field], stride), vectors(original[field], stride).slice(0, 3));
  assert.deepEqual(detached.TVertices.map((uv) => [...uv]), original.TVertices.map((uv) => [...uv.slice(0, 6)]));
  assert.deepEqual(detached.Anims, original.Anims);
  assert.equal(detached.MaterialID, original.MaterialID);
  assert.equal(model.GeosetAnims[1].GeosetId, 1);
  assert.equal(model.Bones[0].GeosetId, null);
  model.GeosetAnims[1].Alpha.Keys[0].Vector[0] = 0.8;
  assert.equal(model.GeosetAnims[0].Alpha.Keys[0].Vector[0], 0.5);
  detached.Anims[0].MinimumExtent[0] = -80;
  assert.equal(g.Anims[0].MinimumExtent[0], -1);
});

test('detach keeps pre-existing loose vertices and rejects incomplete/all-face selections', () => {
  const g = geoset([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 7, 7, 7], [0, 1, 2, 0, 2, 3]);
  const model = { Geosets: [g], GeosetAnims: [] };
  detachFaces(model, 0, [0, 1, 2]);
  assert.ok(vectors(g.Vertices, 3).some((p) => p.every((v) => v === 7)));
  const remaining = structuredClone(model);
  assert.throws(() => detachFaces(model, 0, [0, 1]), /three vertices/);
  assert.throws(() => detachFaces(model, 0, [0, 1, 2]), /every face/);
  assert.deepEqual(model, remaining);
});

test('extrude removes the internal diagonal from walls and produces outward boundary normals', () => {
  const g = patch(), original = structuredClone(g);
  const top = extrudeFaces(g, [0, 1, 2, 3], [0, 0, 2]);
  assert.deepEqual(top, [0, 1, 2, 3]);
  assert.equal(g.Vertices.length / 3, 20); // four top and four seam vertices per boundary edge
  assert.equal(g.Faces.length / 3, 10); // two top, eight side; no internal diagonal wall
  for (let i = 0; i < top.length; i++) {
    assert.deepEqual([...g.Vertices.slice(i * 3, i * 3 + 3)], [original.Vertices[i * 3], original.Vertices[i * 3 + 1], 2]);
    assert.deepEqual([...g.Normals.slice(i * 3, i * 3 + 3)], [0, 0, 1]);
    assert.deepEqual([...g.SkinWeights.slice(i * 8, i * 8 + 8)], [...original.SkinWeights.slice(i * 8, i * 8 + 8)]);
    assert.deepEqual([...g.Tangents.slice(i * 4, i * 4 + 4)], [...original.Tangents.slice(i * 4, i * 4 + 4)]);
    for (let uv = 0; uv < 2; uv++) assert.deepEqual([...g.TVertices[uv].slice(i * 2, i * 2 + 2)], [...original.TVertices[uv].slice(i * 2, i * 2 + 2)]);
  }
  for (let offset = 6; offset < g.Faces.length; offset += 3) {
    const normal = faceNormal(g, offset), ids = [...g.Faces.slice(offset, offset + 3)];
    const center = [0, 1, 2].map((axis) => ids.reduce((sum, i) => sum + g.Vertices[i * 3 + axis], 0) / 3);
    const outward = [center[0] - 0.5, center[1] - 0.5, 0];
    assert.ok(normal.reduce((sum, v, i) => sum + v * outward[i], 0) > 0, 'side winding points outside the patch');
    const vertexNormal = [...g.Normals.slice(ids[0] * 3, ids[0] * 3 + 3)];
    assert.ok(normal.reduce((sum, v, i) => sum + v * vertexNormal[i], 0) > 0);
  }
  assert.deepEqual(g.Anims, original.Anims);
  assert.equal(g.MaximumExtent[2], 2);
});

test('extruded wall UVs are nondegenerate and tangent frames agree with normals', () => {
  const g = patch(); extrudeFaces(g, [0, 1, 2, 3], [0.2, 0.1, 2]);
  for (let first = 4; first < 20; first += 4) {
    for (const uv of g.TVertices) {
      const [au, av, bu, bv, cu, cv] = uv.slice(first * 2, first * 2 + 6);
      assert.ok(Math.abs((bu - au) * (cv - av) - (bv - av) * (cu - au)) > 1e-6);
    }
    const normal = [...g.Normals.slice(first * 3, first * 3 + 3)], tangent = [...g.Tangents.slice(first * 4, first * 4 + 3)];
    assert.ok(Math.abs(normal.reduce((sum, v, i) => sum + v * tangent[i], 0)) < 1e-6);
    assert.ok(Math.abs(Math.hypot(...tangent) - 1) < 1e-6);
    assert.equal(g.Tangents[first * 4 + 3], 1);
  }
});

test('extrusion preserves unselected faces and can extrude its returned cap repeatedly', () => {
  const g = patch();
  const first = extrudeFaces(g, [0, 1, 2], [0, 0, 1]);
  assert.deepEqual(vectors(g.Vertices, 3).slice(0, 3), [[0, 0, 0], [1, 1, 0], [0, 1, 0]]);
  const beforeFaces = [...g.Faces.slice(0, 3)];
  const second = extrudeFaces(g, first, [0, 0, 1]);
  assert.deepEqual([...g.Faces.slice(0, 3)], beforeFaces);
  assert.equal(second.length, 3);
  for (const index of second) assert.equal(g.Vertices[index * 3 + 2], 2);
});

test('mesh tools reject invalid selections and extrusion topology before changing data', () => {
  const g = patch(), original = structuredClone(g);
  assert.throws(() => weldVertices(g, [99]), /out of range/);
  assert.throws(() => weldVertices(g, [0, 1], -1), /tolerance/);
  assert.throws(() => extrudeFaces(g, [0, 1, 2], [0, 0, 0]), /non-zero/);
  assert.throws(() => extrudeFaces(g, [0, 1, 2], [1, 0, 0]), /parallel/);
  assert.deepEqual(g, original);
  const inconsistent = patch(); inconsistent.Faces = new Uint16Array([0, 1, 2, 0, 3, 2]);
  assert.throws(() => extrudeFaces(inconsistent, [0, 1, 2, 3]), /inconsistent winding/);
  const nonmanifold = patch(); nonmanifold.Faces = new Uint16Array([0, 1, 2, 1, 0, 3, 0, 1, 3]);
  assert.throws(() => extrudeFaces(nonmanifold, [0, 1, 2, 3]), /nonmanifold/);
  const closed = geoset([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]);
  assert.throws(() => extrudeFaces(closed, [0, 1, 2, 3]), /boundary/);
});

test('extrusion checks 16-bit index capacity before creating new vertices', () => {
  const points = Array.from({ length: 65535 * 3 }, (_, i) => i < 12 ? [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0][i] : 0);
  const g = geoset(points, [0, 1, 2, 0, 2, 3], false);
  assert.throws(() => extrudeFaces(g, [0, 1, 2]), /65536/);
  assert.equal(g.Vertices.length / 3, 65535);
});

test('mesh commands integrate with document undo and preservation-aware MDL/MDX saving', () => {
  const doc = createDemoDocument(), before = doc.serialize();
  const selected = [...doc.model.Geosets[0].Faces.slice(0, 3)];
  doc.apply('Detach triangle', ['Geosets', 'GeosetAnims'], (m) => detachFaces(m, 0, selected));
  assert.equal(doc.model.Geosets.length, 6);
  doc.apply('Extrude triangle', ['Geosets'], (m) => extrudeFaces(m.Geosets[5], [0, 1, 2], [0, -10, 0]));
  for (const format of ['mdl', 'mdx']) {
    const result = openDocument(doc.serialize(format));
    assert.equal(result.readOnly, false);
    assert.equal(result.model.Geosets.length, 6);
    assert.equal(result.model.Geosets[5].Faces.length / 3, 7);
    assert.deepEqual(result.diagnostics.filter((d) => d.severity === 'error'), []);
  }
  doc.undo(); doc.undo();
  assert.deepEqual(doc.serialize(), before);
});
