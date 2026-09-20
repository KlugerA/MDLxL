import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createDemoDocument, deleteNode, openDocument, validateModel } from '../src/editor-document.js';
import { buildForgeMesh, commitForge } from '../src/forge.js';
import { applyPartColor, commitPart, partColorSamples, partColorSources, partTextureIndices, partTextureKey, previewPart, resolvePartColor } from '../src/bits-and-parts.js';
import { sampleGeosetAnimation } from '../src/animation.js';
import { retainedForgeAssets } from '../src/forge-assets.js';
const require = createRequire(import.meta.url), { BitsAndPartsLibrary } = require('../electron/bits-and-parts.cjs'), { saveForgeAssets } = require('../electron/forge-assets.cjs');
const colors = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1]];
function sword() {
  const model = structuredClone(createDemoDocument().model);
  model.Sequences = colors.map((_, index) => ({ ...model.Sequences[0], Name: `Color ${index + 1}`, Interval: new Uint32Array([index * 1000, index * 1000 + 900]) }));
  const keys = colors.flatMap((color, index) => [index * 1000, index * 1000 + 900].map(Frame => ({ Frame, Vector: new Float32Array(color) })));
  model.GeosetAnims = [{ GeosetId: 0, Flags: 3, Color: { LineType: 1, GlobalSeqId: null, Keys: keys }, Alpha: { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([.25]) }, { Frame: 900, Vector: new Float32Array([.75]) }] } }];
  if (model.Geosets.length < 2) model.Geosets.push(structuredClone(model.Geosets[0]));
  return model;
}
test('five-animation sword requires explicit animation, record and frame and previews one whole-part RGB', () => {
  const source = sword(), before = structuredClone(source), target = createDemoDocument(), targetBefore = target.serialize();
  for (let index = 0; index < colors.length; index++) {
    assert.equal(partColorSources(source, index).length, 1);
    const choices = partColorSamples(source, index);
    assert.deepEqual(choices.map(item => item.frame), [index * 1000, index * 1000 + 900]);
    assert.deepEqual(choices[0].rgb, colors[index]);
    const rgb = resolvePartColor(source, { sequenceIndex: index, recordIndex: 0, frame: index * 1000 });
    assert.deepEqual(rgb, colors[index]);
    const preview = previewPart(source, rgb);
    assert.equal(preview.Bones.length, 0);
    assert.equal(preview.GeosetAnims.length, preview.Geosets.length);
    for (let gi = 0; gi < preview.Geosets.length; gi++) assert.deepEqual(sampleGeosetAnimation(preview, gi, 4000, 4).color, rgb);
  }
  assert.throws(() => resolvePartColor(source, { sequenceIndex: 0, recordIndex: 0 }), /sample frame/);
  assert.throws(() => resolvePartColor(source, { sequenceIndex: 0, recordIndex: 0, frame: 2000 }), /sample frame/);
  assert.deepEqual(source, before); assert.deepEqual(target.serialize(), targetBefore);
});
test('time-varying and per-geoset color selection uses the requested channel and interpolated frame', () => {
  const source = sword(); source.GeosetAnims[0].Color.Keys[1].Vector = new Float32Array([0, 0, 1]);
  source.GeosetAnims.push({ GeosetId: 1, Flags: 2, Color: new Float32Array([.5, .25, 1]), Alpha: 1 });
  assert.equal(partColorSources(source, 0).length, 2);
  assert.deepEqual(resolvePartColor(source, { sequenceIndex: 0, recordIndex: 0, frame: 450 }), [.5, 0, .5]);
  assert.deepEqual(resolvePartColor(source, { sequenceIndex: 0, recordIndex: 1, frame: 450 }), [.5, .25, 1]);
  source.GeosetAnims = []; assert.deepEqual(partColorSources(source, 0), []);
});
test('two import colors share equivalent dependencies and one Forge anchor; preserve alpha and prior parts', () => {
  const doc = createDemoDocument(), source = sword(), before = structuredClone(doc.model), counts = [doc.model.Textures.length, doc.model.Materials.length];
  const first = doc.apply('Import red part', [], model => commitPart(model, source, { rgb: colors[0] }));
  const second = doc.apply('Import blue part', [], model => commitPart(model, source, { rgb: colors[2] }));
  assert.deepEqual([doc.model.Textures.length, doc.model.Materials.length], counts);
  assert.equal(first.boneId, second.boneId); assert.equal(doc.model.Bones.filter(bone => bone.Name === 'DummyBone').length, 1);
  for (const [result, rgb] of [[first, colors[0]], [second, colors[2]]]) for (const gi of result.geosetIndices) {
    assert.deepEqual(doc.model.Geosets[gi].Groups, [[first.boneId]]);
    const animation = doc.model.GeosetAnims.find(item => item.GeosetId === gi);
    assert.equal(animation.Color.Keys, undefined);
    assert.deepEqual(sampleGeosetAnimation(doc.model, gi, 0, 0).color, rgb);
  }
  assert.deepEqual(doc.model.GeosetAnims.find(item => item.GeosetId === first.geosetIndices[0]).Alpha, source.GeosetAnims[0].Alpha);
  assert.equal(doc.model.GeosetAnims.find(item => item.GeosetId === first.geosetIndices[0]).Flags, 3);
  assert.deepEqual(doc.model.Textures, before.Textures); assert.deepEqual(doc.model.Materials, before.Materials);
  const mesh = buildForgeMesh({ mask: new Uint8Array(4).fill(1), width: 2, height: 2 });
  const forged = doc.apply('Forge', [], model => commitForge(model, mesh, { texturePath: 'Textures\\White.blp' }));
  assert.equal(forged.boneId, first.boneId);
  assert.deepEqual(validateModel(doc.model).filter(issue => issue.severity === 'error'), []);
});
test('Forge first and replacement after normal reassign/delete use the current shared bone without rebinding older parts', () => {
  const doc = createDemoDocument(), source = sword(), mesh = buildForgeMesh({ mask: new Uint8Array(4).fill(1), width: 2, height: 2 });
  const first = doc.apply('Forge', [], model => commitForge(model, mesh, { texturePath: 'Textures\\White.blp' }));
  const part = doc.apply('Part', [], model => commitPart(model, source)); assert.equal(part.boneId, first.boneId);
  assert.throws(() => doc.apply('Delete bound bone', [], model => deleteNode(model, first.boneId)), /Reassign/);
  doc.apply('Reassign then delete', [], model => { for (const gi of [...first.geosetIndices, ...part.geosetIndices]) model.Geosets[gi].Groups = [[0]]; deleteNode(model, first.boneId); });
  previewPart(source, colors[1]); assert.equal(doc.model.Bones.filter(bone => bone.Name === 'DummyBone').length, 0);
  const replacement = doc.apply('Part after deletion', [], model => commitPart(model, source)); assert.notEqual(replacement.boneId, first.boneId);
  assert.equal(doc.model.Bones.filter(bone => bone.Name === 'DummyBone').length, 1);
  assert.deepEqual(doc.model.Geosets[first.geosetIndices[0]].Groups, [[0]]);
});
test('imports are atomic and undo/redo plus MDL/MDX roundtrip preserve chosen RGB', () => {
  const doc = createDemoDocument(), source = sword(), before = doc.serialize();
  const result = doc.apply('Import sword', [], model => commitPart(model, source, { rgb: colors[4] }));
  assert.equal(doc.undo(), true); assert.deepEqual(doc.serialize(), before); assert.equal(doc.redo(), true);
  for (const format of ['mdl', 'mdx']) { const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.readOnly, false); for (const gi of result.geosetIndices) assert.deepEqual(sampleGeosetAnimation(reopened.model, gi, 1000, 0).color, colors[4]); assert.deepEqual(validateModel(reopened.model).filter(issue => issue.severity === 'error'), []); }
  const frozen = structuredClone(doc.model); source.Geosets[0].MaterialID = 999;
  assert.throws(() => commitPart(doc.model, source), /missing material/); assert.deepEqual(doc.model, frozen);
});
test('without an RGB choice original tracks remain intact; texture animations and globals are remapped once', () => {
  const source = sword(), target = createDemoDocument().model;
  source.GlobalSequences = [1000]; source.TextureAnims = [{ Translation: { LineType: 1, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }] } }];
  source.Materials[0].Layers[0].TVertexAnimId = 0;
  const first = commitPart(target, source), counts = [target.Materials.length, target.TextureAnims.length, target.GlobalSequences.length];
  commitPart(target, source); assert.deepEqual([target.Materials.length, target.TextureAnims.length, target.GlobalSequences.length], counts);
  assert.deepEqual(target.GeosetAnims.find(item => item.GeosetId === first.geosetIndices[0]).Color, source.GeosetAnims[0].Color);
  assert.equal(partTextureKey({ Image: 'Textures/White.blp' }), partTextureKey({ Image: 'textures\\white.BLP', Flags: 0, ReplaceableId: 0 }));
  assert.ok(partTextureIndices(source).length);
});
test('RGB overrides every existing record and creates only required missing records', () => {
  const source = sword(); source.GeosetAnims.push(structuredClone(source.GeosetAnims[0]));
  const existing = source.GeosetAnims.length; applyPartColor(source, source.Geosets.map((_, index) => index), colors[2]);
  assert.equal(source.GeosetAnims.length, existing + source.Geosets.length - 1);
  for (const animation of source.GeosetAnims) assert.deepEqual([...animation.Color], colors[2]);
});
test('library provisions exact folder, retains nested models and case variants, filters nonmodels, and prevents escaping', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-parts-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const library = new BitsAndPartsLibrary(path.join(directory, 'BitsAndParts'));
  assert.deepEqual((await library.list()).children, []);
  await fs.mkdir(path.join(library.directory, 'helms', 'horns'), { recursive: true });
  const bytes = createDemoDocument().serialize();
  for (const name of ['sword.MDL', 'root.mdx', 'helms/helm.mdx', 'helms/horns/horn.mdl']) await fs.writeFile(path.join(library.directory, name), bytes);
  await fs.writeFile(path.join(library.directory, 'notes.txt'), 'ignore');
  const bank = await library.list(); assert.equal(bank.name, 'BitsAndParts'); assert.equal(bank.children.length, 3);
  assert.equal(bank.children[0].children[0].children[0].id, 'helms/horns/horn.mdl');
  assert.equal((await library.read('sword.MDL')).name, 'sword.MDL');
  await assert.rejects(library.read('../outside.mdl'), /inside/); await assert.rejects(library.read('notes.txt'), /MDL or MDX/);
  assert.equal((await library.list()).children.length, 3);
});
test('portable part textures participate in existing save and recovery retention', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-parts-save-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const asset = { name: 'MDLxL_Parts\\hash.tga', bytes: new Uint8Array([1, 2, 3]), source: 'parts' }, model = { Textures: [{ Image: asset.name }] };
  assert.equal(retainedForgeAssets(new Map([[asset.name.toLowerCase(), asset]]), model).length, 1);
  await saveForgeAssets(path.join(directory, 'model.mdl'), [asset]); assert.deepEqual(new Uint8Array(await fs.readFile(path.join(directory, 'MDLxL_Parts', 'hash.tga'))), asset.bytes);
  await assert.rejects(saveForgeAssets(path.join(directory, 'model.mdl'), [{ ...asset, name: 'MDLxL_Parts\\..\\outside.tga' }]), /supported filename/);
});
