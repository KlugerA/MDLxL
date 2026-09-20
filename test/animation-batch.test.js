import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { bakeGeosetAnimationSettings, sampleAnimationProperty, setAnimationKey } from '../src/animation-tracks.js';

const target = (id, property) => ({ kind: 'geoset', id, property });
const close = (actual, expected) => {
  const values = typeof actual === 'number' ? [actual] : Array.from(actual);
  const wanted = typeof expected === 'number' ? [expected] : expected;
  assert.equal(values.length, wanted.length);
  values.forEach((value, i) => assert.ok(Math.abs(value - wanted[i]) < 1e-6, `${value} differs from ${wanted[i]}`));
};
function fixture() {
  const doc = createDemoDocument();
  doc.apply('Synthetic second animation and node', ['Sequences', 'Nodes'], model => {
    model.Sequences.push({ ...structuredClone(model.Sequences[0]), Name: 'Attack', Interval: new Uint32Array([3000, 4000]) });
    createNode(model, 'Light').Name = 'Untouched light';
  });
  return doc;
}
const settings = { geosetIds: [0, 2], alpha: .25, color: [1, .2, .4] };

test('BAKE applies current visibility and RGB throughout one animation of checked geosets only', () => {
  const doc = fixture(), model = doc.model;
  setAnimationKey(model, [target(0, 'Alpha')], 1000, 0, 0);
  setAnimationKey(model, [target(0, 'Color')], 1000, [0, 1, 0], 0);
  const before = structuredClone(model);
  const savedOther = settings.geosetIds.map(id => ['Alpha', 'Color'].map(property => sampleAnimationProperty(model, target(id, property), 3500, 1)));
  assert.equal(bakeGeosetAnimationSettings(model, { ...settings, geosetIds: new Set(settings.geosetIds), sequenceIndices: [0] }), 4);
  for (const [index, id] of settings.geosetIds.entries()) {
    for (const frame of [0, 1000, 2000]) {
      close(sampleAnimationProperty(model, target(id, 'Alpha'), frame, 0), settings.alpha);
      close(sampleAnimationProperty(model, target(id, 'Color'), frame, 0), settings.color);
    }
    close(sampleAnimationProperty(model, target(id, 'Alpha'), 3500, 1), savedOther[index][0]);
    close(sampleAnimationProperty(model, target(id, 'Color'), 3500, 1), savedOther[index][1]);
  }
  assert.deepEqual(model.GeosetAnims.filter(anim => !settings.geosetIds.includes(anim.GeosetId)), before.GeosetAnims.filter(anim => !settings.geosetIds.includes(anim.GeosetId)));
  assert.deepEqual(model.Geosets, before.Geosets);
  assert.deepEqual(model.Lights, before.Lights);
});

test('ALL applies both settings across every animation while retaining gap keys and unchecked targets', () => {
  const model = fixture().model;
  model.GeosetAnims[0].Alpha = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 2500, Vector: new Float32Array([.8]) }] };
  const before = structuredClone(model);
  bakeGeosetAnimationSettings(model, settings);
  for (const id of settings.geosetIds) for (const [sequenceIndex, frame] of [[0, 1000], [1, 3500]]) {
    close(sampleAnimationProperty(model, target(id, 'Alpha'), frame, sequenceIndex), settings.alpha);
    close(sampleAnimationProperty(model, target(id, 'Color'), frame, sequenceIndex), settings.color);
  }
  assert.deepEqual(model.GeosetAnims[0].Alpha.Keys.find(key => key.Frame === 2500), before.GeosetAnims[0].Alpha.Keys[0]);
  assert.deepEqual(model.GeosetAnims.filter(anim => !settings.geosetIds.includes(anim.GeosetId)), before.GeosetAnims.filter(anim => !settings.geosetIds.includes(anim.GeosetId)));
  assert.deepEqual(model.Lights, before.Lights);
});

test('combined BAKE and ALL are each one undo transaction and serialize both channels', () => {
  for (const sequenceIndices of [[0], null]) {
    const doc = fixture(), before = structuredClone(doc.model), count = doc.historyStats.undoSteps;
    doc.apply('Bake settings', ['GeosetAnims', 'Info'], model => bakeGeosetAnimationSettings(model, { ...settings, sequenceIndices }));
    const baked = structuredClone(doc.model);
    assert.equal(doc.historyStats.undoSteps, count + 1);
    doc.undo(); assert.deepEqual(doc.model, before);
    doc.redo(); assert.deepEqual(doc.model, baked);
    for (const format of ['mdl', 'mdx']) {
      const reopened = openDocument(doc.serialize(format), `memory.${format}`);
      for (const id of settings.geosetIds) {
        close(sampleAnimationProperty(reopened.model, target(id, 'Alpha'), 1000, 0), settings.alpha);
        close(sampleAnimationProperty(reopened.model, target(id, 'Color'), 1000, 0), settings.color);
      }
    }
  }
});

test('batch validates every input and channel before modifying any geoset animation', () => {
  for (const patch of [
    { alpha: NaN }, { color: [1, NaN, 0] }, { color: [1, 0] }, { color: [1, 2, 0] },
    { geosetIds: [] }, { geosetIds: [0, 999] }, { sequenceIndices: [-1] }, { sequenceIndices: [] },
  ]) {
    const model = fixture().model, before = structuredClone(model);
    assert.throws(() => bakeGeosetAnimationSettings(model, { ...settings, ...patch }));
    assert.deepEqual(model, before);
  }
  const model = fixture().model;
  model.GeosetAnims[0].Flags |= 2;
  model.GeosetAnims[0].Color = { GlobalSeqId: 0, LineType: 1, Keys: [{ Frame: 0, Vector: new Float32Array([1, 0, 0]) }] };
  const before = structuredClone(model);
  assert.throws(() => bakeGeosetAnimationSettings(model, settings), /global sequence/);
  assert.deepEqual(model, before);
  model.Sequences = [];
  assert.throws(() => bakeGeosetAnimationSettings(model, settings), /Select an animation/);
});

test('conflicting pending text blocks the combined edit without changing or discarding drafts', () => {
  const model = fixture().model, before = structuredClone(model);
  for (const property of ['Alpha', 'Color']) {
    const drafts = { pending: { target: target(2, property), text: 'unfinished text' } }, savedDrafts = structuredClone(drafts);
    assert.throws(() => bakeGeosetAnimationSettings(model, { ...settings, drafts }), /Bake Text or Discard text/);
    assert.deepEqual(model, before);
    assert.deepEqual(drafts, savedDrafts);
  }
});

test('node and unchecked-geoset drafts remain pending while BAKE updates only checked geosets', () => {
  const model = fixture().model, light = structuredClone(model.Lights[0]);
  const drafts = {
    unchecked: { target: target(1, 'Alpha'), text: 'unfinished' },
    node: { target: { kind: 'node', id: light.ObjectId, property: 'Color' }, text: '0: .1, .2, .3' },
  };
  const before = structuredClone(drafts);
  bakeGeosetAnimationSettings(model, { ...settings, drafts, sequenceIndices: [0] });
  assert.deepEqual(drafts, before);
  assert.deepEqual(model.Lights[0], light);
  close(sampleAnimationProperty(model, target(0, 'Color'), 1000, 0), settings.color);
});
