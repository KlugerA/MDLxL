import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleGeosetAnimation, setSequenceOptions } from '../src/animation.js';
import { sampleAnimationProperty } from '../src/animation-tracks.js';
import { previewGeosetTint } from '../app/warcraft-preview-adapter.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

const key = (Frame, Vector) => ({ Frame, Vector: new Float32Array(Vector) });
const close = (actual, expected) => Array.from(actual).forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${value} != ${expected[i]}`));

test('sequence flags and numeric rarity survive undo/redo and both model formats', () => {
  const doc = createDemoDocument(), before = structuredClone(doc.model.Sequences);
  doc.apply('Sequence options', ['Sequences'], m => setSequenceOptions(m, 0, { nonLooping: true, rarity: 3 }));
  assert.equal(doc.model.Sequences[0].NonLooping, true); assert.equal(doc.model.Sequences[0].Rarity, 3);
  doc.undo(); assert.deepEqual(doc.model.Sequences, before); doc.redo();
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `sequence-options.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.Sequences[0].NonLooping, true); assert.equal(reopened.model.Sequences[0].Rarity, 3);
    reopened.apply('Clear rarity and non-looping', ['Sequences'], m => setSequenceOptions(m, 0, { nonLooping: false, rarity: 0 }));
    const cleared = openDocument(reopened.serialize(format), `sequence-clear.${format}`);
    assert.equal(cleared.model.Sequences[0].NonLooping, false); assert.equal(cleared.model.Sequences[0].Rarity, 0);
  }
});

test('sequence options validate atomically without adding metadata', () => {
  const model = { Sequences: [{ NonLooping: false, Rarity: 3 }] }, before = structuredClone(model);
  for (const rarity of [-1, 2.5, 41, NaN, Infinity]) assert.throws(() => setSequenceOptions(model, 0, { nonLooping: true, rarity }), /Rarity/);
  assert.throws(() => setSequenceOptions(model, 4, { rarity: 1 }), /Select/);
  assert.deepEqual(model, before);
  setSequenceOptions(model, 0, { rarity: 0 });
  assert.deepEqual(Object.keys(model.Sequences[0]).sort(), ['NonLooping', 'Rarity']);
});

test('shared geoset evaluator matches controls and native preview across sequences and scrubbing', () => {
  const model = {
    Geosets: [{}], Sequences: [{ Interval: [100, 200] }, { Interval: [500, 600] }], GlobalSequences: [100],
    GeosetAnims: [{ GeosetId: 0, Flags: 2, Alpha: 0.5, Color: { LineType: 1, Keys: [key(100, [1, 0, 0]), key(200, [0, 0, 1]), key(500, [0, 1, 0]), key(600, [0, 1, 0])] } }],
  }, before = structuredClone(model);
  for (const [frame, sequence, expected] of [[150, 0, [0.5, 0, 0.5]], [500, 1, [0, 1, 0]], [100, 0, [1, 0, 0]]]) {
    const sample = sampleGeosetAnimation(model, 0, frame, sequence);
    close(sample.color, expected); assert.equal(sample.alpha, 0.5);
    close(sampleAnimationProperty(model, { kind: 'geoset', id: 0, property: 'Color' }, frame, sequence), expected);
    close(previewGeosetTint(model, 0, { Alpha: 0.8 }, frame, sequence), [...expected, 0.4]);
  }
  assert.deepEqual(model, before, 'preview never changes authored data');
  model.GeosetAnims[0].Color = { LineType: 1, GlobalSeqId: 0, Keys: [key(0, [1, 0, 0]), key(100, [0, 0, 1])] };
  close(sampleGeosetAnimation(model, 0, 550, 1, 125).color, [0.75, 0, 0.25]);
  model.GeosetAnims[0].Flags = 0;
  close(sampleGeosetAnimation(model, 0, 550, 1).color, [1, 1, 1]);
});

test('Unanimated geosets use MDX static bases instead of the first RGB and alpha keys', () => {
  const model = {
    Geosets: [{}], Sequences: [{ Interval: [333, 666] }], GlobalSequences: [],
    GeosetAnims: [{
      GeosetId: 0, Flags: 2,
      Alpha: { LineType: 1, Keys: [key(333, [0.25]), key(666, [0.75])] },
      Color: { LineType: 1, Keys: [key(333, [0.72549, 1, 0.215686]), key(666, [1, 1, 1])] },
      _MdxDefaults: { Alpha: 1, Color: new Float32Array([1, 1, 1]) },
    }],
  };
  const unanimated = sampleGeosetAnimation(model, 0, 0, -1);
  close(unanimated.color, [1, 1, 1]); assert.equal(unanimated.alpha, 1);
  const animated = sampleGeosetAnimation(model, 0, 333, 0);
  close(animated.color, [0.72549, 1, 0.215686]); assert.equal(animated.alpha, 0.25);
  close(previewGeosetTint(model, 0, { Alpha: 1 }, 0, -1), [1, 1, 1, 1]);
});

test('static RGB codec paths preserve channel order and evaluated appearance', () => {
  const doc = createDemoDocument();
  doc.apply('Set static RGB', ['GeosetAnims'], m => Object.assign(m.GeosetAnims[0], { Flags: 3, Alpha: 0.75, Color: new Float32Array([0.8, 0.2, 0.4]) }));
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `static-rgb.${format}`);
    const evaluated = sampleGeosetAnimation(reopened.model, 0, reopened.model.Sequences[0].Interval[0], 0);
    close(evaluated.color, [0.8, 0.2, 0.4]); assert.equal(evaluated.alpha, 0.75);
  }
});
