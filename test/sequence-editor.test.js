import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGlobalSequence, createSequence, deleteGlobalSequence, deleteSequence,
  setGlobalSequenceDuration, setSequenceInterval, setSequenceMoveSpeed, setSequenceName,
} from '../src/sequence-editor.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

const key = (Frame, values) => ({ Frame, Vector: new Float32Array(values) });
const track = (...keys) => ({ LineType: 1, GlobalSeqId: null, Keys: keys });
const extent = () => ({ MinimumExtent: new Float32Array([-1, -2, -3]), MaximumExtent: new Float32Array([4, 5, 6]), BoundsRadius: 8 });
const geoset = () => ({ Vertices: new Float32Array([0, 0, 0, 2, 4, 6]), Groups: [[0]], Anims: [extent(), extent()], ...extent() });

test('frame intervals enforce valid ordered whole frames for model and global sequences', () => {
  const model = { Sequences: [{ Interval: new Uint32Array([100, 200]) }], GlobalSequences: [500] };
  setSequenceInterval(model, 0, 20, 80);
  assert.deepEqual(Array.from(model.Sequences[0].Interval), [20, 80]);
  assert.ok(model.Sequences[0].Interval instanceof Uint32Array);
  setSequenceInterval(model, 0, 80, 80);
  assert.deepEqual(Array.from(model.Sequences[0].Interval), [80, 80]);
  for (const values of [[-1, 80], [81, 80], [1.5, 80]]) assert.throws(() => setSequenceInterval(model, 0, ...values));
  setGlobalSequenceDuration(model, 0, 1000); assert.equal(model.GlobalSequences[0], 1000);
  for (const value of [0, -1, 1.5]) assert.throws(() => setGlobalSequenceDuration(model, 0, value));
});

test('Create leaves a one-second blank gap and keeps geoset sequence extents aligned', () => {
  const model = { Info: extent(), Sequences: [{ Name: 'Stand', Interval: new Uint32Array([0, 1000]) }], GlobalSequences: [], Geosets: [geoset()] };
  const index = createSequence(model);
  assert.equal(index, 1);
  assert.deepEqual(Array.from(model.Sequences[1].Interval), [2000, 3000]);
  assert.equal(model.Sequences[1].Name, 'New Sequence 2');
  assert.equal(model.Geosets[0].Anims.length, 3);
  assert.equal(createGlobalSequence(model), 0); assert.equal(model.GlobalSequences[0], 1000);
});

test('Delete removes every local key and event inside the sequence, then realigns extents', () => {
  const model = {
    Info: extent(), Geosets: [geoset()],
    Sequences: [{ Name: 'Walk', Interval: new Uint32Array([100, 1100]) }, { Name: 'Stand', Interval: new Uint32Array([3000, 4000]) }],
    GlobalSequences: [500, 700],
    Bones: [{ ObjectId: 0, Translation: track(key(100, [0, 0, 0]), key(600, [0, -20, 0]), key(1100, [0, -40, 0]), key(3000, [1, 2, 3])) }],
    Attachments: [{ ObjectId: 1, Visibility: track(key(100, [1]), key(3000, [0])) }],
    EventObjects: [{ ObjectId: 2, EventTrack: new Uint32Array([100, 500, 3000]) }],
    GeosetAnims: [{ GeosetId: 0, Alpha: track(key(100, [1]), key(1100, [0]), key(3000, [1])), Color: track(key(600, [1, 0, 0]), key(3000, [1, 1, 1])) }],
  };
  assert.equal(deleteSequence(model, 0), 9);
  assert.equal(model.Sequences.length, 1);
  assert.equal(model.Geosets[0].Anims.length, 1);
  assert.deepEqual(model.Bones[0].Translation.Keys.map(item => item.Frame), [3000]);
  assert.deepEqual(model.Attachments[0].Visibility.Keys.map(item => item.Frame), [3000]);
  assert.deepEqual(Array.from(model.EventObjects[0].EventTrack), [3000]);
  assert.deepEqual(model.GeosetAnims[0].Alpha.Keys.map(item => item.Frame), [3000]);
  assert.deepEqual(model.GeosetAnims[0].Color.Keys.map(item => item.Frame), [3000]);
  assert.deepEqual(Array.from(model.Info.MinimumExtent), [0, 0, 0]);
  assert.deepEqual(Array.from(model.Info.MaximumExtent), [2, 4, 6]);
});

test('Delete Global removes its keys and repairs every higher global reference', () => {
  const model = {
    Info: extent(), Geosets: [geoset()], Sequences: [], GlobalSequences: [500, 700],
    GeosetAnims: [{ GeosetId: 0, Alpha: { ...track(key(0, [1]), key(500, [0])), GlobalSeqId: 0 } }],
    Lights: [{ ObjectId: 1, Color: { ...track(key(0, [1, 0, 0])), GlobalSeqId: 1 } }],
    EventObjects: [{ ObjectId: 2, GlobalSeqId: 0, EventTrack: new Uint32Array([0, 250]) }],
  };
  assert.equal(deleteGlobalSequence(model, 0), 4);
  assert.deepEqual(model.GlobalSequences, [700]);
  assert.equal(model.GeosetAnims[0].Alpha.GlobalSeqId, null);
  assert.deepEqual(model.GeosetAnims[0].Alpha.Keys, []);
  assert.equal(model.Lights[0].Color.GlobalSeqId, 0);
  assert.equal(model.EventObjects[0].GlobalSeqId, undefined);
  assert.deepEqual(Array.from(model.EventObjects[0].EventTrack), []);
});

test('MoveSpeed edits only sequence ground-speed metadata and never translates a skeleton', () => {
  const translation = track(key(0, [0, 0, 0]), key(500, [10, -20, 5]), key(1000, [20, -40, 0]), key(3000, [7, 8, 9]));
  const before = structuredClone(translation);
  const model = {
    Sequences: [{ Name: 'Walk', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0 }, { Name: 'Stand', Interval: new Uint32Array([3000, 4000]), MoveSpeed: 0 }],
    GlobalSequences: [], Geosets: [{ Groups: [[0]] }], Bones: [{ ObjectId: 0, Translation: translation }],
  };
  assert.equal(setSequenceMoveSpeed(model, 0, 215), 215);
  assert.equal(model.Sequences[0].MoveSpeed, 215);
  assert.deepEqual(translation, before);
  assert.equal(setSequenceMoveSpeed(model, 0, 0), 0);
  assert.deepEqual(translation, before);
});

test('MoveSpeed metadata survives editable MDL and MDX save/reopen cycles', () => {
  const doc = createDemoDocument();
  const before = structuredClone(doc.model.Bones);
  doc.apply('Set move speed', ['Sequences'], model => setSequenceMoveSpeed(model, 0, 215));
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `move-speed.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.Sequences[0].MoveSpeed, 215);
  }
  assert.deepEqual(doc.model.Bones, before);
});

test('sequence names are directly editable and validated for the WC3 field', () => {
  const model = { Sequences: [{ Name: 'Stand', MoveSpeed: 0 }] };
  assert.equal(setSequenceName(model, 0, 'Walk Fast'), 'Walk Fast');
  assert.equal(model.Sequences[0].Name, 'Walk Fast');
  assert.throws(() => setSequenceName(model, 0, '   '), /cannot be empty/);
  assert.throws(() => setSequenceName(model, 0, 'x'.repeat(80)), /79 UTF-8 bytes/);
  assert.throws(() => setSequenceMoveSpeed(model, 0, -1), /greater than or equal/);
});

