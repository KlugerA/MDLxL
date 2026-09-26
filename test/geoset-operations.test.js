import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { gather, updateBounds } from '../src/mesh-tools.js';
import { separateGeosetsByLoosePart, nuclearSeparateGeosets, mergeSimilarGeosets } from '../src/geoset-operations.js';

test('nuclear separation only acts on selected vertices and retains every stream', () => {
  const doc = createDemoDocument();
  doc.apply('Prepare loose parts', ['Geosets'], model => {
    const g = model.Geosets[0];
    Object.assign(g, gather(g, [0, 1, 2, 3, 4, 5, 6]));
    g.Faces = Uint16Array.of(0, 1, 2, 3, 4, 5);
    g.PrimitiveTypes = Uint32Array.of(4);
    g.PrimitiveCounts = Uint32Array.of(6);
    updateBounds(g);
  });
  const before = structuredClone(doc.model.Geosets[0]);
  const result = doc.apply('Separate', ['Geosets', 'GeosetAnims', 'Info'], model => nuclearSeparateGeosets(model, { 0: [0, 1, 2, 3, 4, 5, 6] }));
  assert.equal(result.parts, 2);
  assert.equal(doc.model.Geosets.length, 7);
  const left = doc.model.Geosets[0], right = doc.model.Geosets[5], loose = doc.model.Geosets[6];
  for (const [piece, indices] of [[left, [0, 1, 2]], [right, [3, 4, 5]], [loose, [6]]]) {
    assert.deepEqual(piece.Vertices, gather(before, indices).Vertices);
    assert.deepEqual(piece.Normals, gather(before, indices).Normals);
    assert.deepEqual(piece.TVertices, gather(before, indices).TVertices);
    assert.deepEqual(piece.VertexGroup, gather(before, indices).VertexGroup);
    assert.deepEqual(Array.from(piece.Faces), indices.length === 1 ? [] : [0, 1, 2]);
    assert.deepEqual(piece.Groups, before.Groups);
  }
  assert.deepEqual({ ...doc.model.GeosetAnims.at(-1), GeosetId: 0 }, doc.model.GeosetAnims[0]);
  doc.model.GeosetAnims.at(-1).Color[0] = 0;
  assert.notEqual(doc.model.GeosetAnims[0].Color[0], 0);
  assert.equal(nuclearSeparateGeosets(doc.model, {}), false);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), `parts.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.Geosets.length, 7);
  }
});

test('refined separation joins unwelded edges, keeps intersecting objects distinct, and leaves unselected geometry intact', () => {
  const prepare = () => {
    const doc = createDemoDocument();
    doc.apply('Prepare stitched geometry', ['Geosets'], model => {
      const g = model.Geosets[0];
      Object.assign(g, gather(g, Array.from({ length: 9 }, (_, index) => index)));
      g.Vertices.set([
        0, 0, 0, 2, 0, 0, 2, 2, 0,
        0, 0, 0, 2, 2, 0, 0, 2, 0,
        0.8, 0.8, -1, 1.2, 0.8, 1, 1, 1.2, 1,
      ]);
      g.Faces = Uint16Array.from(Array.from({ length: 9 }, (_, index) => index));
      g.PrimitiveTypes = Uint32Array.of(4); g.PrimitiveCounts = Uint32Array.of(9);
      updateBounds(g);
    });
    return doc;
  };
  const partial = prepare(), untouched = structuredClone(partial.model.Geosets[1]);
  const result = partial.apply('Separate selected square', ['Geosets', 'GeosetAnims', 'Info'], model => separateGeosetsByLoosePart(model, { 0: [0, 1, 2, 3, 4, 5] }));
  assert.equal(result.parts, 1);
  assert.deepEqual(result.touched, [0]);
  assert.deepEqual(partial.model.Geosets[1], untouched);
  assert.equal(partial.model.Geosets[0].Faces.length, 3);
  assert.equal(partial.model.Geosets[5].Faces.length, 6);
  assert.equal(partial.model.Geosets[5].Vertices.length / 3, 6);
  assert.equal(openDocument(partial.serialize('mdx'), 'selected.mdx').model.Geosets.length, 6);

  const refined = prepare();
  const refinedResult = refined.apply('Separate all selected', ['Geosets', 'GeosetAnims', 'Info'], model => separateGeosetsByLoosePart(model, { 0: Array.from({ length: 9 }, (_, index) => index) }));
  assert.equal(refinedResult.parts, 1);
  assert.equal(refined.model.Geosets[0].Faces.length, 6);
  assert.equal(refined.model.Geosets[5].Faces.length, 3);
  const nuclear = prepare();
  const nuclearResult = nuclear.apply('Nuclear selected', ['Geosets', 'GeosetAnims', 'Info'], model => nuclearSeparateGeosets(model, { 0: Array.from({ length: 9 }, (_, index) => index) }));
  assert.equal(nuclearResult.parts, 2);
  assert.equal(nuclear.model.Geosets.length, 7);
});

test('refined separation keeps repeated small trim details in one geoset', () => {
  const doc = createDemoDocument();
  doc.apply('Prepare trim', ['Geosets'], model => {
    const g = model.Geosets[0], points = [], faces = [];
    const ring = Array.from({ length: 21 }, (_, index) => [Math.cos(index * Math.PI / 10) * 10, Math.sin(index * Math.PI / 10) * 10, 0]);
    for (let index = 0; index < 20; index++) for (const point of [[0, 0, 0], ring[index], ring[index + 1]]) { faces.push(faces.length); points.push(...point); }
    for (let index = 0; index < 4; index++) for (const point of [[index * 2, 0, 2], [index * 2 + 1, 0, 2], [index * 2, 1, 2]]) { faces.push(faces.length); points.push(...point); }
    const count = points.length / 3;
    g.Vertices = Float32Array.from(points);
    g.Normals = Float32Array.from(Array.from({ length: count }, () => [0, 0, 1]).flat());
    g.TVertices = [new Float32Array(count * 2)];
    g.VertexGroup = new Uint8Array(count);
    g.Faces = Uint16Array.from(faces);
    g.PrimitiveTypes = Uint32Array.of(4); g.PrimitiveCounts = Uint32Array.of(faces.length);
    updateBounds(g);
  });
  const selected = Array.from({ length: doc.model.Geosets[0].Vertices.length / 3 }, (_, index) => index);
  const result = doc.apply('Separate trim', ['Geosets', 'GeosetAnims', 'Info'], model => separateGeosetsByLoosePart(model, { 0: selected }));
  assert.equal(result.parts, 1);
  assert.deepEqual([doc.model.Geosets[0].Faces.length / 3, doc.model.Geosets[5].Faces.length / 3].sort((a, b) => a - b), [4, 20]);
  assert.equal(openDocument(doc.serialize('mdx'), 'trim.mdx').model.Geosets.length, 6);
});

test('half of a loose part selects the whole part, while less than half leaves it untouched', () => {
  const prepare = () => {
    const doc = createDemoDocument();
    doc.apply('Prepare two loose parts', ['Geosets'], model => {
      const g = model.Geosets[0];
      Object.assign(g, gather(g, Array.from({ length: 9 }, (_, index) => index)));
      g.Vertices.set([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 2, 0, 10, 0, 0, 11, 0, 0, 10, 1, 0]);
      g.Faces = Uint16Array.from(Array.from({ length: 9 }, (_, index) => index));
      g.PrimitiveTypes = Uint32Array.of(4); g.PrimitiveCounts = Uint32Array.of(9);
      updateBounds(g);
    });
    return doc;
  };
  const belowHalf = prepare(), original = structuredClone(belowHalf.model.Geosets[0]);
  assert.equal(separateGeosetsByLoosePart(belowHalf.model, { 0: [0, 1] }), false);
  assert.deepEqual(belowHalf.model.Geosets[0], original);
  const half = prepare(), untouched = structuredClone(half.model.Geosets[1]);
  const result = half.apply('Separate half-selected square', ['Geosets', 'GeosetAnims', 'Info'], model => separateGeosetsByLoosePart(model, { 0: [0, 1, 2] }));
  assert.equal(result.parts, 1);
  assert.equal(half.model.Geosets[0].Faces.length, 3);
  assert.equal(half.model.Geosets[5].Faces.length, 6);
  assert.equal(half.model.Geosets[5].Vertices.length / 3, 6);
  assert.deepEqual(half.model.Geosets[1], untouched);
  assert.equal(openDocument(half.serialize('mdx'), 'half-selected.mdx').model.Geosets.length, 6);
  const nuclear = prepare();
  assert.equal(nuclearSeparateGeosets(nuclear.model, { 0: [0] }), false);
  assert.equal(nuclearSeparateGeosets(nuclear.model, { 0: [0, 1] }).parts, 1);
  assert.equal(nuclear.model.Geosets[5].Vertices.length / 3, 3);
});

test('merge resolves equivalent texture records but keeps team color, RGB and visibility differences separate', () => {
  const doc = createDemoDocument();
  doc.apply('Prepare merge cases', ['Geosets', 'GeosetAnims', 'Materials', 'Textures', 'Bones', 'Info'], model => {
    const base = model.Geosets[0], anim = model.GeosetAnims[0];
    const copy = (materialId, alterAnim = () => {}) => {
      const id = model.Geosets.push({ ...structuredClone(base), MaterialID: materialId }) - 1;
      const record = { ...structuredClone(anim), GeosetId: id };
      alterAnim(record);
      model.GeosetAnims.push(record);
      return id;
    };
    const sameTexture = model.Textures.push(structuredClone(model.Textures[0])) - 1;
    const sameMaterial = structuredClone(model.Materials[0]);
    sameMaterial.Layers[0].TextureID = sameTexture;
    const matchingMaterialId = model.Materials.push(sameMaterial) - 1;
    const matching = copy(matchingMaterialId);
    copy(matchingMaterialId); // Compatible but never selected.
    model.Geosets[matching].Groups = [[model.Bones[1].ObjectId]];
    model.Bones[0].GeosetId = matching;
    model.Bones[0].GeosetAnimId = model.GeosetAnims.findIndex(record => record.GeosetId === matching);
    const ordinaryTexture = model.Textures.push({ ...structuredClone(model.Textures[0]), ReplaceableId: 0 }) - 1;
    const ordinaryMaterial = structuredClone(model.Materials[0]);
    ordinaryMaterial.Layers[0].TextureID = ordinaryTexture;
    copy(model.Materials.push(ordinaryMaterial) - 1);
    copy(0, record => { record.Color[0] = 0.25; });
    copy(0, record => { record.Alpha = 0.5; });
  });
  const before = structuredClone(doc.model.Geosets[0]);
  const unselected = structuredClone(doc.model.Geosets[6]);
  assert.equal(mergeSimilarGeosets(doc.model, { 0: [0] }), false);
  assert.equal(mergeSimilarGeosets(doc.model, {}), false);
  const result = doc.apply('Merge', ['Geosets', 'GeosetAnims', 'Bones', 'Info'], model => mergeSimilarGeosets(model, { 0: [0], 5: [0] }));
  assert.equal(result.merged, 1);
  assert.equal(doc.model.Geosets.length, 9);
  assert.equal(doc.model.GeosetAnims.length, 9);
  assert.deepEqual(doc.model.Geosets[5], unselected);
  assert.equal(result.oldToNew[6], 5);
  assert.equal(result.vertexOffsets[5], before.Vertices.length / 3);
  assert.equal(doc.model.Bones[0].GeosetId, 0);
  assert.equal(doc.model.Bones[0].GeosetAnimId, 0);
  assert.deepEqual(Array.from(doc.model.Geosets[0].Vertices), [...before.Vertices, ...before.Vertices]);
  assert.deepEqual(Array.from(doc.model.Geosets[0].Faces.slice(before.Faces.length)), Array.from(before.Faces, index => index + before.Vertices.length / 3));
  assert.deepEqual(doc.model.Geosets[0].Groups[doc.model.Geosets[0].VertexGroup[before.Vertices.length / 3]], [doc.model.Bones[1].ObjectId]);
  assert.equal(mergeSimilarGeosets(doc.model, { 0: [0] }), false);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), `merged.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.Geosets.length, 9);
    assert.equal(reopened.model.Bones[0].GeosetId, 0);
  }
});
