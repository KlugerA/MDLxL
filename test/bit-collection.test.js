import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openDocument, validateModel } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { sampleGeosetAnimation } from '../src/animation.js';
import { collectPart, collectedPartModel, commitPart, currentPartPresets, partPresetColor, serializeCollectedPart } from '../src/bits-and-parts.js';
const { BitsAndPartsLibrary } = createRequire(import.meta.url)('../electron/bits-and-parts.cjs');

function donor(version = 800) {
  const doc = createStarterDocument(version);
  doc.apply('Prepare donor', [], model => {
    model.Geosets.push(structuredClone(model.Geosets[0]), structuredClone(model.Geosets[0]));
    model.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([1000, 1900]), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: model.Info.MinimumExtent.slice(), MaximumExtent: model.Info.MaximumExtent.slice(), BoundsRadius: model.Info.BoundsRadius }];
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: .75, Color: { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 1000, Vector: new Float32Array([1, 0, 0]) }, { Frame: 1900, Vector: new Float32Array([0, 0, 1]) }] } }];
  });
  return doc;
}
const selection = { 0: [0, 1, 2, 3], 1: [4, 5, 6], 2: [0] };
const presets = [{ name: 'Red', rgb: [1, 0, 0] }, { name: 'Cyan', rgb: [0, 1, 1] }];

test('cross-geoset collection slices selected geometry, keeps loose points and attributes, and never changes the donor', () => {
  const doc = donor(), before = doc.serialize('mdx'), collected = collectPart(doc.model, selection);
  assert.deepEqual(collected.Geosets.map(geoset => geoset.Vertices.length / 3), [4, 3, 1]);
  assert.deepEqual(collected.Geosets.map(geoset => geoset.Faces.length / 3), [2, 1, 0]);
  assert.deepEqual([...collected.Geosets[1].TVertices[0]], [0, 0, 1, 0, 1, 1]);
  assert.deepEqual([...collected.Geosets[1].Vertices], [...doc.model.Geosets[1].Vertices.slice(12, 21)]);
  assert.equal(collected.Bones.length, 1); assert.equal(collected.Bones[0].Name, 'DummyBone'); assert.equal(collected.Bones[0].Translation, undefined);
  assert.deepEqual(collected.Geosets.map(geoset => geoset.Groups), [[[0]], [[0]], [[0]]]);
  assert.equal(collected.Materials.length, 1); assert.equal(collected.Textures.length, 1);
  assert.deepEqual(doc.serialize('mdx'), before);
  assert.throws(() => collectPart(doc.model, {}), /Select vertices/);
});

for (const version of [800, 1000]) test(`MDX${version} collection saves real RGB sequences, roundtrips and re-imports each selected animation`, () => {
  const collected = collectPart(donor(version).model, selection), model = collectedPartModel(collected, { name: 'Collected sword', presets });
  const bytes = serializeCollectedPart(model), reopened = openDocument(bytes, 'Collected sword.mdx');
  assert.equal(reopened.readOnly, false); assert.equal(reopened.model.Info.Name, 'Collected sword');
  assert.deepEqual(reopened.model.Sequences.map(sequence => sequence.Name), ['Red', 'Cyan']);
  assert.deepEqual(validateModel(reopened.model).filter(issue => issue.severity === 'error'), []);
  // Independent byte oracle: animated KGAC is stored in BGR, not UI RGB.
  const buffer = Buffer.from(bytes), kgac = buffer.indexOf(Buffer.from('KGAC'));
  assert.ok(kgac >= 0); assert.equal(buffer.readUInt32LE(kgac + 4), 4);
  assert.deepEqual([20, 24, 28].map(offset => buffer.readFloatLE(kgac + offset)), [0, 0, 1]);
  for (let index = 0; index < presets.length; index++) {
    const rgb = partPresetColor(reopened.model, index); assert.deepEqual(rgb, presets[index].rgb);
    for (let gi = 0; gi < model.Geosets.length; gi++) assert.deepEqual(sampleGeosetAnimation(reopened.model, gi, index * 1000 + 450, index).color, rgb);
    const destination = createStarterDocument(version);
    const result = destination.apply('Import preset', [], target => commitPart(target, reopened.model, { rgb }));
    const saved = openDocument(destination.serialize('mdx'));
    for (const gi of result.geosetIndices) assert.deepEqual(sampleGeosetAnimation(saved.model, gi, 0, -1).color, rgb);
    assert.deepEqual(validateModel(saved.model).filter(issue => issue.severity === 'error'), []);
  }
  const mdl = openDocument(reopened.serialize('mdl'), 'Collected sword.mdl');
  assert.deepEqual(partPresetColor(mdl.model, 1), presets[1].rgb);
});

test('optional current RGB import samples actual keys, including global tracks, and no-presets collection has no animation', () => {
  const collected = collectPart(donor().model, selection);
  assert.deepEqual(currentPartPresets(collected), [{ name: 'Stand RGB 1', rgb: [1, 0, 0] }, { name: 'Stand RGB 2', rgb: [0, 0, 1] }]);
  const base = collectedPartModel(collected, { name: 'Plain' }); assert.equal(base.Sequences.length, 0); assert.equal(base.GeosetAnims[0].Alpha, .75);
  collected.GlobalSequences = [1000]; collected.GeosetAnims[0].Color.GlobalSeqId = 0;
  collected.GeosetAnims[0].Color.Keys = [{ Frame: 0, Vector: new Float32Array([0, 1, 0]) }, { Frame: 500, Vector: new Float32Array([1, 1, 0]) }];
  const model = collectedPartModel(collected, { name: 'Current and new', importCurrent: true, presets });
  const reopened = openDocument(serializeCollectedPart(model));
  assert.deepEqual(reopened.model.Sequences.map(sequence => sequence.Name), ['Stand RGB 1', 'Stand RGB 2', 'Red', 'Cyan']);
  assert.deepEqual(partPresetColor(reopened.model, 0), [0, 1, 0]); assert.deepEqual(partPresetColor(reopened.model, 1), [1, 1, 0]);
  assert.deepEqual(partPresetColor(reopened.model, 3), [0, 1, 1]);
  collected.Sequences[0].Interval = new Uint32Array([1100, 1200]);
  assert.deepEqual(currentPartPresets(collected), [{ name: 'Stand', rgb: [.2, 1, 0] }], 'a short sequence between global keys still imports its displayed RGB');
  assert.throws(() => collectedPartModel(collected, { name: 'Duplicate', presets: [presets[0], presets[0]] }), /unique/);
});

test('library saves collected bytes and portable dependencies, lists them, and preserves an existing Bit on collision', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-collect-bit-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const library = new BitsAndPartsLibrary(path.join(directory, 'BitsAndParts'));
  const model = collectedPartModel(collectPart(donor().model, selection), { name: 'My Bit', presets });
  const asset = { name: `MDLxL_Parts\\${'a'.repeat(64)}.tga`, bytes: new Uint8Array([1, 2, 3]) };
  model.Textures[0].Image = asset.name;
  const bytes = serializeCollectedPart(model), entry = await library.save({ name: 'My Bit', bytes, assets: [asset] });
  assert.equal(entry.id, 'My Bit.mdx'); assert.equal((await library.list()).children.some(item => item.id === entry.id), true);
  assert.deepEqual(new Uint8Array((await library.read(entry.id)).bytes), new Uint8Array(bytes));
  assert.deepEqual(new Uint8Array(await fs.readFile(path.join(library.directory, asset.name))), asset.bytes);
  await assert.rejects(library.save({ name: 'My Bit', bytes, assets: [] }), /already exists/);
  assert.deepEqual(new Uint8Array((await library.read(entry.id)).bytes), new Uint8Array(bytes));
  await assert.rejects(library.save({ name: '../escape', bytes }), /filename/);
  await assert.rejects(library.save({ name: 'Bad asset', bytes, assets: [{ ...asset, name: '..\\outside.tga' }] }), /MDLxL_Parts/);
});
