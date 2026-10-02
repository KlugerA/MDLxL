import test from 'node:test';
import assert from 'node:assert/strict';
import { editVisibility, visibilityAt } from '../src/visibility-editing.js';
import { openDocument, createDemoDocument, createNode } from '../src/editor-document.js';
import { createGeosetAnimations } from '../src/animation-tracks.js';
import { geosetBoneIds, nodeGeosets, textureUsers, materialUsers } from '../src/resource-relations.js';
const model = { Sequences: [{ Name: 'Stand', Interval: [100, 1100] }, { Name: 'Death', Interval: [2000, 3000] }], GlobalSequences: [1000] };
const vector = n => new Float32Array([n]);
const key = (Frame, n, a = n, b = n) => ({ Frame, Vector: vector(n), InTan: vector(a), OutTan: vector(b) });

test('range switches preserve static values in every other animation and outside selection', () => {
  const track = editVisibility(.7, model, { range: [350, 650], amount: 0 });
  assert.equal(track.LineType, 0);
  for (let at = 100; at <= 1100; at++) assert.ok(Math.abs(visibilityAt(track, at, [100, 1100]) - (at >= 350 && at <= 650 ? 0 : .7)) < 1e-6);
  assert.ok(Math.abs(visibilityAt(track, 2300, [2000, 3000]) - .7) < 1e-6);
  assert.equal(track.Keys.length, 8);
});
for (const line of [0, 1, 2, 3]) test(`range preserves interpolation ${line} outside the edited interval`, () => {
  const before = { LineType: line, Keys: [key(100, .2, .1, .5), key(1100, .8, .2, .4), key(2000, .4), key(3000, .7)] };
  const bytes = structuredClone(before);
  const after = editVisibility(before, model, { range: [350, 650], amount: 0 });
  assert.equal(after.LineType, line); assert.deepEqual(before, bytes);
  for (let at = 100; at <= 1100; at++) {
    const wanted = at >= 350 && at <= 650 ? 0 : visibilityAt(before, at, [100, 1100]);
    assert.ok(Math.abs(visibilityAt(after, at, [100, 1100]) - wanted) < 1e-6, `frame ${at}`);
  }
  assert.deepEqual(after.Keys.filter(k => k.Frame >= 2000), before.Keys.filter(k => k.Frame >= 2000));
});
for (const line of [0, 1, 2, 3]) test(`range before/after sparse keys preserves clamped interpolation ${line}`, () => {
  const before = { LineType: line, Keys: [key(400, .2, .1, .5), key(700, .8, .2, .4)] };
  for (const range of [[150, 250], [850, 900]]) {
    const after = editVisibility(before, model, { range, amount: 0 });
    for (let at = 100; at <= 1100; at++) if (at < range[0] || at > range[1]) assert.ok(Math.abs(visibilityAt(after, at, [100, 1100]) - visibilityAt(before, at, [100, 1100])) < 1e-6, `frame ${at}`);
  }
});
test('whole animation, empty track, single frame and noncontiguous keys', () => {
  const track = editVisibility({ LineType: 1, Keys: [] }, model, { range: [100, 1100], amount: 0 });
  assert.deepEqual(track.Keys.map(k => [k.Frame, k.Vector[0]]), [[100, 0], [1100, 0]]);
  const single = editVisibility(1, model, { range: [550, 550], amount: 0 });
  assert.equal(visibilityAt(single, 549, [100, 1100]), 1); assert.equal(visibilityAt(single, 550, [100, 1100]), 0); assert.equal(visibilityAt(single, 551, [100, 1100]), 1);
  const changed = editVisibility(single, model, { frames: [100, 1100], amount: .3 });
  assert.equal(visibilityAt(changed, 550, [100, 1100]), 0); assert.deepEqual(changed.Keys.find(k => k.Frame === 551), single.Keys.find(k => k.Frame === 551));
});
test('global loop remains global, including authored end key, with invalid edits rejected', () => {
  const original = { LineType: 0, GlobalSeqId: 0, Keys: [key(0, 1), key(1000, .4)] };
  const changed = editVisibility(original, model, { range: [0, 400], amount: 0 });
  assert.equal(changed.GlobalSeqId, 0); assert.ok(Math.abs(visibilityAt(changed, 1000, [0, 1000]) - .4) < 1e-6);
  assert.throws(() => editVisibility(original, model, { range: [0, 1001], amount: 0 }));
  assert.throws(() => editVisibility(1, model, { range: [50, 200], amount: 0 }));
  assert.throws(() => editVisibility(1, model, { range: [100, 200], amount: 2 }));
  assert.throws(() => editVisibility(1, model, { frames: [300], amount: 0 }));
});
test('native visibility, geoset alpha, material alpha survive undo and MDL/MDX round trips', () => {
  const doc = createDemoDocument(), original = doc.serialize('mdx');
  const interval = Array.from(doc.model.Sequences[0].Interval);
  let id;
  doc.apply('Author visibility', ['Nodes', 'PivotPoints', 'Materials', 'GeosetAnims'], m => {
    const node = createNode(m, 'Attachment'); id = node.ObjectId;
    node.Visibility = editVisibility(undefined, m, { range: interval, amount: 0 });
    createGeosetAnimations(m, [0]); m.GeosetAnims.find(a => a.GeosetId === 0).Alpha = editVisibility(1, m, { range: interval, amount: .5 });
    m.Materials[0].Layers[0].Alpha = editVisibility(1, m, { range: interval, amount: .25 });
  });
  for (const format of ['mdx', 'mdl']) {
    const saved = doc.serialize(format), reopened = openDocument(saved, `visibility.${format}`);
    assert.equal(reopened.model.Attachments.find(n => n.ObjectId === id).Visibility.Keys[0].Vector[0], 0);
    assert.equal(reopened.model.GeosetAnims.find(a => a.GeosetId === 0).Alpha.Keys[0].Vector[0], .5);
    assert.equal(reopened.model.Materials[0].Layers[0].Alpha.Keys[0].Vector[0], .25);
    assert.deepEqual(reopened.model.Geosets[0].Vertices, doc.model.Geosets[0].Vertices);
  }
  doc.undo(); assert.deepEqual(doc.serialize('mdx'), original);
  doc.redo(); assert.equal(doc.model.Attachments.find(n => n.ObjectId === id).Visibility.Keys[0].Vector[0], 0);
});
test('resource relationships include animated/HD texture references, ribbons and real skin bindings', () => {
  const bone = { ObjectId: 2, Parent: 0 }, helper = { ObjectId: 0 }, ribbon = { ObjectId: 3, MaterialID: 0 }, emitter = { ObjectId: 4, TextureID: 2 };
  const g = { Vertices: new Float32Array(6), VertexGroup: [0, 1], Groups: [[2], [8]], MaterialID: 0 };
  const m = { ...model, Geosets: [g], Nodes: [helper, null, bone, ribbon, emitter], Helpers: [helper], Bones: [bone], RibbonEmitters: [ribbon], ParticleEmitters2: [emitter], Textures: [], Materials: [{ Layers: [{ TextureID: { Keys: [key(0, 2)] }, NormalTextureID: 3 }] }] };
  assert.deepEqual(geosetBoneIds(g, [0]), [2]); assert.deepEqual(nodeGeosets(m, 0), [0]);
  assert.deepEqual(textureUsers(m, 2).map(u => u.kind), ['Materials', 'Nodes']);
  assert.equal(textureUsers(m, 3)[0].kind, 'Materials'); assert.deepEqual(materialUsers(m, 0).map(u => u.kind), ['Geosets', 'Nodes']);
  assert.deepEqual(geosetBoneIds({ ...g, SkinWeights: new Uint8Array([2, 4, 5, 8, 100, 155, 0, 0, 8, 0, 0, 0, 255, 0, 0, 0]) }, [0]), [2, 4]);
});
