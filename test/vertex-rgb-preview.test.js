import test from 'node:test';
import assert from 'node:assert/strict';
import { vertexRgbPreviewState } from '../app/vertex-rgb-preview.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { sampleAnimationProperty, setAnimationInlineValues } from '../src/animation-tracks.js';
import { rgbToWarcraftColor } from '../src/warcraft-color.js';

test('Vertex RGB Preview evaluates every material channel at its selected animation start', () => {
  const model = { Sequences: [{ Interval: [100, 200] }, { Interval: [333, 900] }] };
  assert.deepEqual(vertexRgbPreviewState(model, { enabled: true, sequenceIndex: 1, frame: 0, globalTime: 0 }), { sequenceIndex: 1, frame: 333, globalTime: 333, interval: [333, 900] });
  assert.deepEqual(vertexRgbPreviewState(model, { enabled: false, sequenceIndex: 1, frame: 25, globalTime: 90 }), { sequenceIndex: 1, frame: 25, globalTime: 90, interval: [333, 900] });
});

test('inline RGB remains inline when changed through Animations', () => {
  const doc = createDemoDocument(), target = { kind: 'geoset', id: 0, property: 'Color' };
  doc.apply('Change inline RGB', ['GeosetAnims'], model => setAnimationInlineValues(model, [target], [.2, .5, .8]));
  const color = doc.model.GeosetAnims.find(animation => animation.GeosetId === 0).Color;
  assert.ok(color instanceof Float32Array); assert.equal(color.Keys, undefined);
  Array.from(color).forEach((value, index) => assert.ok(Math.abs(value - rgbToWarcraftColor([.2, .5, .8])[index]) < 1e-6));
  Array.from(sampleAnimationProperty(doc.model, target, 0, 0)).forEach((value, index) => assert.ok(Math.abs(value - [.2, .5, .8][index]) < 1e-6));
  for (const format of ['mdl', 'mdx']) {
    const saved = openDocument(doc.serialize(format), `inline.${format}`).model.GeosetAnims.find(animation => animation.GeosetId === 0).Color;
    Array.from(saved).forEach((value, index) => assert.ok(Math.abs(value - rgbToWarcraftColor([.2, .5, .8])[index]) < 1e-6));
  }
});
