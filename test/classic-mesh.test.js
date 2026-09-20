import test from 'node:test';
import assert from 'node:assert/strict';
import { collapseVertices, weldSelectedVertices, uncoupleVertices, deleteSelectedFaces, averageSelectedNormals } from '../src/classic-mesh.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

function geoset(vertices = [0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0], faces = [0, 1, 2, 0, 2, 3]) {
  const count = vertices.length / 3;
  return {
    Vertices: new Float32Array(vertices), Faces: new Uint16Array(faces),
    Normals: new Float32Array(Array.from({ length: count }, () => [0, 0, 1]).flat()),
    TVertices: [new Float32Array(Array.from({ length: count * 2 }, (_, i) => i / 10)), new Float32Array(Array.from({ length: count * 2 }, (_, i) => i / 20))],
    VertexGroup: new Uint8Array(Array.from({ length: count }, (_, i) => i % 2)), Groups: [[0], [1]], TotalGroupsCount: 2,
    Tangents: new Float32Array(Array.from({ length: count }, () => [1, 0, 0, 1]).flat()),
    SkinWeights: new Uint8Array(Array.from({ length: count }, (_, i) => [i % 2, 0, 0, 0, 255, 0, 0, 0]).flat()),
    MaterialID: 0, SelectionGroup: 0, Unselectable: false,
    MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array([2, 2, 0]), BoundsRadius: 2,
    Anims: [{ MinimumExtent: new Float32Array([-10, -10, -10]), MaximumExtent: new Float32Array([10, 10, 10]), BoundsRadius: 18 }],
  };
}

test('C collapses positions to arithmetic/shared center without welding topology or UV/rig streams', () => {
  const g = geoset(), before = structuredClone(g);
  const result = collapseVertices(g, [0, 1, 2]);
  assert.deepEqual(result.center, [4 / 3, 2 / 3, 0]);
  for (const i of [0, 1, 2]) assert.deepEqual(g.Vertices.slice(i * 3, i * 3 + 3), new Float32Array(result.center));
  for (const key of ['Faces', 'Normals', 'TVertices', 'VertexGroup', 'Groups', 'Tangents', 'SkinWeights', 'Anims']) assert.deepEqual(g[key], before[key], key);
  collapseVertices(g, [0, 3], [10, 20, 30]);
  assert.deepEqual([...g.Vertices.slice(0, 3)], [10, 20, 30]);
  assert.deepEqual([...g.Vertices.slice(9, 12)], [10, 20, 30]);
});

test('B joins distant/seamed selected vertices and retains LAST selected UV, normal and rig attributes', () => {
  const g = geoset([0, 0, 0, 1, 0, 0, 0, 1, 0, 4, 0, 0, 5, 0, 0, 4, 1, 0], [0, 1, 2, 3, 4, 5]);
  g.Normals.set([0, 1, 0], 9); g.Tangents[15] = -1;
  const before = structuredClone(g), result = weldSelectedVertices(g, [0, 3]);
  assert.deepEqual(result, { selection: [2], merged: 1, removedFaces: 0, retainedVertex: 2 });
  assert.deepEqual([...g.Faces], [2, 0, 1, 2, 3, 4]);
  assert.deepEqual([...g.Vertices.slice(6, 9)], [2, 0, 0]);
  for (const [name, stride] of [['Normals', 3], ['VertexGroup', 1], ['Tangents', 4], ['SkinWeights', 8]]) assert.deepEqual(g[name].slice(2 * stride, 3 * stride), before[name].slice(3 * stride, 4 * stride));
  for (let i = 0; i < g.TVertices.length; i++) assert.deepEqual(g.TVertices[i].slice(4, 6), before.TVertices[i].slice(6, 8));
  assert.deepEqual(g.Anims, before.Anims);
  const reverse = structuredClone(before); const other = weldSelectedVertices(reverse, [3, 0]);
  assert.equal(other.retainedVertex, 0); assert.deepEqual([...reverse.Normals.slice(0, 3)], [0, 0, 1]);
});

test('B removes every repeated-corner triangle and refuses an empty result without mutation', () => {
  const g = geoset(), result = weldSelectedVertices(g, [0, 1]);
  assert.equal(result.removedFaces, 1); assert.equal(g.Faces.length, 3);
  assert.equal(new Set(g.Faces).size, 3);
  const empty = geoset(), before = structuredClone(empty);
  assert.throws(() => weldSelectedVertices(empty, [0, 2]), /every triangle/);
  assert.deepEqual(empty, before);
});

test('U visibly separates selected corners while preserving their non-position SD/HD attributes', () => {
  const g = geoset(), before = structuredClone(g), result = uncoupleVertices(g, [0, 2]);
  assert.deepEqual(result, { selection: [0, 2, 4, 5], added: 2 });
  assert.deepEqual([...g.Faces], [0, 1, 2, 4, 5, 3]);
  assert.equal(g.Vertices.length / 3, 6);
  for (const [name, stride] of [['Normals', 3], ['VertexGroup', 1], ['Tangents', 4], ['SkinWeights', 8]]) {
    assert.deepEqual(g[name].slice(0, 4 * stride), before[name]);
    assert.deepEqual(g[name].slice(4 * stride, 5 * stride), before[name].slice(0, stride));
    assert.deepEqual(g[name].slice(5 * stride, 6 * stride), before[name].slice(2 * stride, 3 * stride));
  }
  for (let i = 0; i < g.TVertices.length; i++) assert.deepEqual(g.TVertices[i].slice(8, 12), new Float32Array([...before.TVertices[i].slice(0, 2), ...before.TVertices[i].slice(4, 6)]));
  assert.deepEqual(g.Anims, before.Anims);
  for (const id of [1, 3]) assert.deepEqual(g.Vertices.slice(id * 3, id * 3 + 3), before.Vertices.slice(id * 3, id * 3 + 3));
  for (const [a, b] of [[0,4],[2,5]]) assert.notDeepEqual(g.Vertices.slice(a * 3, a * 3 + 3), g.Vertices.slice(b * 3, b * 3 + 3));
  assert.deepEqual(uncoupleVertices(g, result.selection), { selection: result.selection, added: 0 });
  const retainedX=g.Vertices[0]; g.Vertices[12] += 5; assert.equal(g.Vertices[0], retainedX);
});

test('U checks the 16-bit limit before writing and accepts the final valid vertex index', () => {
  const tooLarge = geoset(Array(65536 * 3).fill(0)), before = structuredClone(tooLarge);
  assert.throws(() => uncoupleVertices(tooLarge, [0]), /65536/);
  assert.deepEqual(tooLarge, before);
  const lastSlot = geoset(Array(65535 * 3).fill(0));
  assert.equal(uncoupleVertices(lastSlot, [0]).added, 1);
  assert.equal(lastSlot.Vertices.length / 3, 65536); assert.equal(lastSlot.Faces[3], 65535);
});

test('face deletion removes only complete selected triangles and preserves loose vertices', () => {
  const g = geoset(), vertices = g.Vertices, uvs = g.TVertices;
  assert.equal(deleteSelectedFaces(g, [0, 1]).removedFaces, 0);
  assert.equal(deleteSelectedFaces(g, [0, 1, 2]).removedFaces, 1);
  assert.deepEqual([...g.Faces], [0, 2, 3]); assert.equal(g.Vertices, vertices); assert.equal(g.TVertices, uvs);
  assert.equal(deleteSelectedFaces(g, [0, 2, 3]).removedFaces, 1);
  assert.equal(g.Faces.length, 0); assert.equal(g.Vertices, vertices);
});

test('normal averaging changes selected normals only and leaves a valid HD tangent frame', () => {
  const g = geoset(); g.Normals.set([1, 0, 0], 0); g.Normals.set([0, 1, 0], 3);
  const before = structuredClone(g); averageSelectedNormals(g, [0, 1]);
  for (const i of [0, 1]) {
    const normal = g.Normals.slice(i * 3, i * 3 + 3), tangent = g.Tangents.slice(i * 4, i * 4 + 3);
    assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-6); assert.ok(Math.abs(Math.hypot(...tangent) - 1) < 1e-6);
    assert.ok(Math.abs(normal.reduce((sum, v, axis) => sum + v * tangent[axis], 0)) < 1e-6);
    assert.equal(g.Tangents[i * 4 + 3], before.Tangents[i * 4 + 3]);
  }
  assert.deepEqual(g.Normals.slice(6), before.Normals.slice(6));
  g.Normals.set([1, 0, 0], 0); g.Normals.set([-1, 0, 0], 3);
  const cancelled = structuredClone(g);
  assert.throws(() => averageSelectedNormals(g, [0, 1]), /cancel/); assert.deepEqual(g, cancelled);
});

test('invalid selections, malformed streams and coordinate overflow never partially mutate commands', () => {
  for (const command of [collapseVertices, weldSelectedVertices, uncoupleVertices, deleteSelectedFaces, averageSelectedNormals]) {
    for (const indices of [[], [-1], [0, 9999], [NaN], [0.5]]) {
      const g = geoset(), before = structuredClone(g); assert.throws(() => command(g, indices)); assert.deepEqual(g, before);
    }
    const g = geoset(); g.SkinWeights = new Uint8Array(1); const before = structuredClone(g);
    assert.throws(() => command(g, [0, 1]), /SkinWeights/); assert.deepEqual(g, before);
  }
  for (const command of [collapseVertices, weldSelectedVertices]) {
    const g = geoset(), before = structuredClone(g);
    assert.throws(() => command(g, [0, 1], [Number.MAX_VALUE, 0, 0]), /center/); assert.deepEqual(g, before);
  }
});

test('classic uncouple, collapse and weld survive full undo/redo and MDL/MDX save/reload', () => {
  const doc = createDemoDocument(), initial = structuredClone(doc.model);
  const count = doc.model.Geosets[0].Vertices.length / 3;
  doc.apply('Uncouple', ['Geosets'], (m) => uncoupleVertices(m.Geosets[0], Array.from({ length: count }, (_, i) => i)));
  const split = structuredClone(doc.model);
  doc.apply('Collapse', ['Geosets'], (m) => collapseVertices(m.Geosets[0], [0, count], [2, 3, 4]));
  doc.apply('Weld', ['Geosets'], (m) => weldSelectedVertices(m.Geosets[0], [0, count]));
  const final = structuredClone(doc.model);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.readOnly, false);
    assert.deepEqual(reopened.model.Geosets[0].Faces, final.Geosets[0].Faces);
    assert.deepEqual(reopened.model.Geosets[0].VertexGroup, final.Geosets[0].VertexGroup);
    assert.deepEqual(reopened.model.Geosets[0].Vertices, final.Geosets[0].Vertices);
    assert.equal(reopened.diagnostics.filter((d) => d.severity === 'error').length, 0);
  }
  doc.undo(); doc.undo(); assert.deepEqual(doc.model, split);
  doc.undo(); assert.deepEqual(doc.model, initial); assert.equal(doc.dirty, false);
  doc.redo(); doc.redo(); doc.redo(); assert.deepEqual(doc.model, final);
});
