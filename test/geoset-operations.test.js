import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { gather, updateBounds } from '../src/mesh-tools.js';
import { separateGeosetsByLoosePart, mergeSimilarGeosets } from '../src/geoset-operations.js';

test('separate loose parts retains each vertex stream, face, rig group and animation', () => {
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
  const result = doc.apply('Separate', ['Geosets', 'GeosetAnims', 'Info'], separateGeosetsByLoosePart);
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
  assert.equal(separateGeosetsByLoosePart(doc.model), false);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), `parts.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.Geosets.length, 7);
  }
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
    model.Geosets[matching].Groups = [[model.Bones[1].ObjectId]];
    model.Bones[0].GeosetId = matching;
    model.Bones[0].GeosetAnimId = model.GeosetAnims.length - 1;
    const ordinaryTexture = model.Textures.push({ ...structuredClone(model.Textures[0]), ReplaceableId: 0 }) - 1;
    const ordinaryMaterial = structuredClone(model.Materials[0]);
    ordinaryMaterial.Layers[0].TextureID = ordinaryTexture;
    copy(model.Materials.push(ordinaryMaterial) - 1);
    copy(0, record => { record.Color[0] = 0.25; });
    copy(0, record => { record.Alpha = 0.5; });
  });
  const before = structuredClone(doc.model.Geosets[0]);
  const result = doc.apply('Merge', ['Geosets', 'GeosetAnims', 'Bones', 'Info'], mergeSimilarGeosets);
  assert.equal(result.merged, 1);
  assert.equal(doc.model.Geosets.length, 8);
  assert.equal(doc.model.GeosetAnims.length, 8);
  assert.equal(doc.model.Bones[0].GeosetId, 0);
  assert.equal(doc.model.Bones[0].GeosetAnimId, 0);
  assert.deepEqual(Array.from(doc.model.Geosets[0].Vertices), [...before.Vertices, ...before.Vertices]);
  assert.deepEqual(Array.from(doc.model.Geosets[0].Faces.slice(before.Faces.length)), Array.from(before.Faces, index => index + before.Vertices.length / 3));
  assert.deepEqual(doc.model.Geosets[0].Groups[doc.model.Geosets[0].VertexGroup[before.Vertices.length / 3]], [doc.model.Bones[1].ObjectId]);
  assert.equal(mergeSimilarGeosets(doc.model), false);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), `merged.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.Geosets.length, 8);
    assert.equal(reopened.model.Bones[0].GeosetId, 0);
  }
});
