import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { enableUVTextureWrapping, uvMaterialLayers } from '../src/uv-tools.js';

test('material wrapping preserves unrelated flags, textures, materials and geometry through save and undo', () => {
  const doc = createDemoDocument();
  doc.apply('Set up material', ['Textures', 'Materials'], model => {
    model.Textures = [
      { Image: '', ReplaceableId: 1, Flags: 0 },
      { Image: 'Body.blp', ReplaceableId: 0, Flags: 0 },
      { Image: 'Overlay.blp', ReplaceableId: 0, Flags: 1 },
      { Image: 'Other.blp', ReplaceableId: 0, Flags: 2 },
    ];
    model.Materials[0].Layers = [0, 1, 2, 1].map(TextureID => ({ TextureID, Alpha: 1, FilterMode: 0, Shading: 0, CoordId: 0 }));
  });
  const before = structuredClone(doc.model);
  const ids = uvMaterialLayers(doc.model, 0).map(layer => layer.textureID);
  doc.apply('Enable UV texture wrapping', ['Textures'], model => enableUVTextureWrapping(model, ids));
  const expected = structuredClone(before); expected.Textures[1].Flags = 3; expected.Textures[2].Flags = 3;
  assert.deepEqual(doc.model, expected);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), `wrapping.${format}`);
    assert.deepEqual(reopened.model.Textures, expected.Textures);
  }
  doc.undo(); assert.deepEqual(doc.model, before);
  doc.redo(); assert.deepEqual(doc.model, expected);
});

test('enabling repeat retains unknown texture flag bits', () => {
  const model = { Textures: [{ Image: 'Body.blp', Flags: 4 }] };
  enableUVTextureWrapping(model, [0]);
  assert.equal(model.Textures[0].Flags, 7);
});
