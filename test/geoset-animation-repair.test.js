import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { createNode, openDocument } from '../src/editor-document.js';
import { scanGeosetAnimationDuplicates, repairGeosetAnimations, classifyVisibilityGeoset, describeGeosetTint, geosetTintForDisplay } from '../src/geoset-animation-repair.js';
import { rgbToWarcraftColor } from '../src/warcraft-color.js';
import { readAnimationTrack } from '../src/animation-tracks.js';

const track = (frames = [[100, 1], [200, 0]], extra = {}) => ({ LineType: 1, GlobalSeqId: null, Keys: frames.map(([Frame, value]) => ({ Frame, Vector: new Float32Array(Array.isArray(value) ? value : [value]) })), ...extra });
function fixture() {
  const doc = createStarterDocument();
  doc.apply('Duplicate fixture', ['GeosetAnims', 'Sequences', 'Bones'], model => {
    model.GeosetAnims = [{ GeosetId: 0, Flags: 0, Alpha: 1, Color: null }, { GeosetId: 0, Flags: 1, Alpha: track(), Color: null }];
    model.Bones[0].GeosetAnimId = 0;
    model.Sequences = ['Stand', 'Decay Flesh', 'Decay Bones', 'Portrait Talk'].map((Name, i) => ({ Name, Interval: new Uint32Array([100 + i * 200, 200 + i * 200]), MinimumExtent: new Float32Array([-99, -99, -99]), MaximumExtent: new Float32Array([99, 99, 99]), BoundsRadius: 200, MoveSpeed: 0, NonLooping: false, Rarity: 0 }));
  });
  return doc;
}
const repair = (doc, options) => doc.apply('Repair', ['GeosetAnims', 'Bones', 'Geosets', 'Info'], model => repairGeosetAnimations(model, options));

test('repair review reports Warcraft stored tints as human RGB without mutating them', () => {
  const stored = rgbToWarcraftColor([0.2, 0.5, 0.8]), before = Array.from(stored);
  assert.equal(describeGeosetTint(stored), 'static RGB (0.2, 0.5, 0.8)');
  Array.from(geosetTintForDisplay(stored)).forEach((value, index) => assert.ok(Math.abs(value - [0.2, 0.5, 0.8][index]) < 1e-6));
  assert.deepEqual(Array.from(stored), before);
});
const values = animation => animation.Alpha.Keys.map(key => key.Vector[0]);

test('duplicate preflight detects the render failure without weakening strict track editing', () => {
  const doc = fixture();
  assert.throws(() => readAnimationTrack(doc.model, { kind: 'geoset', id: 0, property: 'Alpha' }), /multiple geoset animations/);
  const [group] = scanGeosetAnimationDuplicates(doc.model);
  assert.deepEqual(group.indices, [0, 1]); assert.equal(group.suggestedOwner, 1);
  const expected = structuredClone(doc.model.GeosetAnims[1].Alpha), original = doc.serialize('mdx');
  const report = repair(doc);
  assert.equal(report.removedCount, 1); assert.equal(doc.model.GeosetAnims.length, 1);
  assert.equal(doc.model.Bones[0].GeosetAnimId, 0);
  assert.deepEqual(readAnimationTrack(doc.model, { kind: 'geoset', id: 0, property: 'Alpha' }), expected);
  assert.equal(doc.model.GeosetAnims[0].Flags, 1);
  doc.undo(); assert.deepEqual(doc.serialize('mdx'), original);
});

test('all constant-one clones retain one owner; static hidden beats static one', () => {
  const doc = fixture(); doc.model.GeosetAnims[1].Alpha = 1;
  assert.equal(scanGeosetAnimationDuplicates(doc.model)[0].suggestedOwner, 0);
  doc.model.GeosetAnims[1].Alpha = 0;
  assert.equal(scanGeosetAnimationDuplicates(doc.model)[0].suggestedOwner, 1);
  repair(doc); assert.equal(doc.model.GeosetAnims[0].Alpha, 0);
});

test('largest Alpha count is suggested but an explicit owner overrides it', () => {
  const doc = fixture(); doc.model.GeosetAnims[0].Alpha = track([[100, 0], [150, 0], [200, 1]]);
  assert.equal(scanGeosetAnimationDuplicates(doc.model)[0].suggestedOwner, 0);
  repair(doc, { owners: { 0: 1 } }); assert.equal(doc.model.GeosetAnims[0].Alpha.Keys.length, 2);
});

test('tint on a removed clone is copied exactly including global sequence and tangents', () => {
  const doc = fixture(), tint = track([[0, [0.2, 0.4, 0.6]], [500, [0.8, 0.1, 0.3]]], { LineType: 3, GlobalSeqId: 0 });
  for (const key of tint.Keys) { key.InTan = new Float32Array([0.1, 0.2, 0.3]); key.OutTan = new Float32Array([0.3, 0.2, 0.1]); }
  doc.model.GlobalSequences = [1000]; doc.model.GeosetAnims[0].Color = tint; doc.model.GeosetAnims[0].Flags = 2;
  repair(doc);
  assert.deepEqual(doc.model.GeosetAnims[0].Color, tint); assert.equal(doc.model.GeosetAnims[0].Flags, 3);
  for (const format of ['mdl', 'mdx']) {
    const loaded = openDocument(doc.serialize(format), `test.${format}`);
    assert.equal(loaded.readOnly, false); assert.deepEqual(loaded.model.GeosetAnims[0].Color, tint);
    assert.equal(scanGeosetAnimationDuplicates(loaded.model).length, 0);
  }
});

test('conflicting tints require selection and a failed repair leaves document unchanged', () => {
  const doc = fixture();
  doc.apply('Tint conflict', ['GeosetAnims'], m => m.GeosetAnims.forEach((a, i) => { a.Flags |= 2; a.Color = new Float32Array(i ? [0, 1, 0] : [1, 0, 0]); }));
  const before = structuredClone(doc.model);
  assert.equal(scanGeosetAnimationDuplicates(doc.model)[0].colorConflict, true);
  assert.throws(() => repair(doc), /conflicting tint tracks/); assert.deepEqual(doc.model, before);
  repair(doc, { colors: { 0: 0 } }); assert.deepEqual([...doc.model.GeosetAnims[0].Color], [1, 0, 0]);
});

test('fresh explicitly clears all geoset tints, preserving other flags and materials', () => {
  const doc = fixture(); doc.model.Geosets.push(structuredClone(doc.model.Geosets[0]));
  doc.model.GeosetAnims.push({ GeosetId: 1, Alpha: 1, Color: new Float32Array([1, 0, 0]), Flags: 3 });
  for (const a of doc.model.GeosetAnims) { a.Color = new Float32Array([0, 1, 0]); a.Flags |= 2; }
  const materials = structuredClone(doc.model.Materials);
  repair(doc, { tint: 'fresh' });
  assert.ok(doc.model.GeosetAnims.every(a => a.Color == null && !(a.Flags & 2)));
  assert.equal(doc.model.GeosetAnims[1].Flags, 1); assert.deepEqual(doc.model.Materials, materials);
  for (const format of ['mdl', 'mdx']) assert.ok(openDocument(doc.serialize(format), `test.${format}`).model.GeosetAnims.every(a => !(a.Flags & 2)));
});

test('every bone index is remapped, including removed owners and shifted unrelated records', () => {
  const doc = fixture();
  doc.apply('More owners', ['Bones', 'Geosets', 'GeosetAnims'], m => {
    m.Geosets.push(structuredClone(m.Geosets[0])); m.GeosetAnims.push({ GeosetId: 1, Alpha: 0.5, Flags: 0, Color: null });
    createNode(m, 'Bone').GeosetAnimId = 1; createNode(m, 'Bone').GeosetAnimId = 2;
    createNode(m, 'Bone').GeosetAnimId = null;
  });
  repair(doc); assert.deepEqual(doc.model.Bones.map(b => b.GeosetAnimId), [0, 0, 1, null]);
});

test('duplicate-only repair keeps authored visibility and animated extents intact', () => {
  const doc = fixture(), sequences = structuredClone(doc.model.Sequences), alpha = structuredClone(doc.model.GeosetAnims[1].Alpha);
  repair(doc); assert.deepEqual(doc.model.GeosetAnims[0].Alpha, alpha); assert.deepEqual(doc.model.Sequences, sequences);
  assert.deepEqual([...doc.model.Geosets[0].MinimumExtent], [-32, -32, -32]);
});

test('optional body rebuild covers Stand, Decay Flesh, Decay Bones, and Portrait', () => {
  const doc = fixture(); repair(doc, { rebuildVisibility: true });
  assert.deepEqual(values(doc.model.GeosetAnims[0]), [1, 1, 1, 0, 0, 0, 1, 1]);
  assert.equal(doc.model.GeosetAnims[0].Alpha.GlobalSeqId, null);
});

test('gutz texture matching is case/slash insensitive and uses guts visibility', () => {
  const doc = fixture(); doc.model.Textures[0].Image = 'Textures/GUTZ.blp';
  assert.equal(classifyVisibilityGeoset(doc.model, 0).role, 'guts');
  repair(doc, { rebuildVisibility: true }); assert.deepEqual(values(doc.model.GeosetAnims[0]), [0, 0, 1, 1, 1, 0, 0, 0]);
});

for (const name of ['Hero_glow', 'Weapon_Glow', 'BONE_GLOW']) test(`ID2 attached to ${name} follows body visibility, including additive layers`, () => {
  for (const filter of [0, 3, 4]) {
    const doc = fixture(); doc.model.Textures[0] = { Image: '', ReplaceableId: 2, Flags: 0 };
    doc.model.Materials[0].Layers[0].FilterMode = filter; doc.model.Bones[0].Name = name;
    assert.equal(classifyVisibilityGeoset(doc.model, 0).role, 'body-glow');
    repair(doc, { rebuildVisibility: true }); assert.deepEqual(values(doc.model.GeosetAnims[0]), [1, 1, 1, 0, 0, 0, 1, 1]);
  }
});

test('an unrelated glow bone and unused matrix group do not override Portrait-only classification', () => {
  const doc = fixture(); doc.model.Textures[0].ReplaceableId = 2;
  const glow = createNode(doc.model, 'Bone'); glow.Name = 'Hero Glow';
  doc.model.Geosets[0].Groups.push([glow.ObjectId]);
  assert.equal(classifyVisibilityGeoset(doc.model, 0).role, 'portrait-background');
  repair(doc, { rebuildVisibility: true }); assert.deepEqual(values(doc.model.GeosetAnims[0]), [0, 0, 0, 0, 0, 0, 1, 1]);
});

test('non-glow additive team geometry retains authored visibility', () => {
  const doc = fixture(), alpha = structuredClone(doc.model.GeosetAnims[1].Alpha);
  doc.model.Textures[0].ReplaceableId = 2; doc.model.Materials[0].Layers[0].FilterMode = 3;
  assert.equal(classifyVisibilityGeoset(doc.model, 0).role, 'unchanged-additive');
  repair(doc, { rebuildVisibility: true }); assert.deepEqual(doc.model.GeosetAnims[0].Alpha, alpha);
});

test('HD binding ignores zero-weight glow slots and accepts nonzero direct influences', () => {
  const doc = fixture(), m = doc.model; m.Textures[0].ReplaceableId = 2;
  const glow = createNode(m, 'Bone'); glow.Name = 'Weapon glow';
  m.Geosets[0].SkinWeights = new Uint8Array(8 * 8);
  for (let vertex = 0; vertex < 8; vertex++) m.Geosets[0].SkinWeights.set([m.Bones[0].ObjectId, glow.ObjectId, 0, 0, 255, 0, 0, 0], vertex * 8);
  assert.equal(classifyVisibilityGeoset(m, 0).role, 'portrait-background');
  m.Geosets[0].SkinWeights[5] = 1; m.Geosets[0].SkinWeights[4] = 254;
  assert.equal(classifyVisibilityGeoset(m, 0).role, 'body-glow');
});

test('ambiguous materials and conflicting sequence boundaries stop rebuild transactionally', () => {
  const doc = fixture();
  doc.apply('Mixed material', ['Materials', 'Textures'], m => { m.Textures.push({ Image: '', ReplaceableId: 2, Flags: 0 }); m.Materials[0].Layers.push({ ...m.Materials[0].Layers[0], TextureID: 1 }); });
  const before = structuredClone(doc.model);
  assert.throws(() => repair(doc, { rebuildVisibility: true }), /mixed body/); assert.deepEqual(doc.model, before);
  repair(doc); assert.equal(doc.model.GeosetAnims.length, 1);
  const other = fixture(); other.model.Sequences[1].Interval = new Uint32Array([300, 300]);
  assert.throws(() => repair(other, { rebuildVisibility: true }), /boundaries disagree/);
});
