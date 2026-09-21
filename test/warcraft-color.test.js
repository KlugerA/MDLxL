import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareWarcraftPreviewColors, previewGeosetTint } from '../app/warcraft-preview-adapter.js';
import {
  rgbToWarcraftColor, rgbTrackToWarcraftColor,
  warcraftColorToRgb, warcraftColorTrackToRgb,
} from '../src/warcraft-color.js';

const array = value => Array.from(value);
const close = (actual, expected) => array(actual).forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-6, `${value} != ${expected[index]}`));

test('Warcraft colors cross the display boundary as BGR to RGB without mutation', () => {
  const stored = new Float32Array([.72549, 1, .215686]), before = stored.slice();
  close(warcraftColorToRgb(stored), [.215686, 1, .72549]);
  assert.deepEqual(array(rgbToWarcraftColor([.215686, 1, .72549])), array(stored));
  assert.deepEqual(stored, before);
});

test('animated vectors and cubic tangents convert at the boundary and roundtrip exactly', () => {
  const stored = { LineType: 3, GlobalSeqId: null, Keys: [{
    Frame: 333,
    Vector: new Float32Array([.72549, 1, .215686]),
    InTan: new Float32Array([.9, .5, .1]),
    OutTan: new Float32Array([.8, .4, .2]),
  }] };
  const before = structuredClone(stored), rgb = warcraftColorTrackToRgb(stored);
  close(rgb.Keys[0].Vector, [.215686, 1, .72549]);
  close(rgb.Keys[0].InTan, [.1, .5, .9]);
  assert.deepEqual(rgbTrackToWarcraftColor(rgb), stored);
  assert.deepEqual(stored, before);
});

test('custom and native preview adapters receive human RGB while the model remains in Warcraft order', () => {
  const model = {
    Geosets: [{}], Sequences: [{ Interval: [0, 1000] }], GlobalSequences: [],
    GeosetAnims: [{ GeosetId: 0, Flags: 2, Alpha: 1, Color: new Float32Array([.8, .5, .2]) }],
    ParticleEmitters2: [{ SegmentColor: [new Float32Array([.7, .4, .1])] }],
    RibbonEmitters: [{ Color: new Float32Array([.6, .3, .2]) }],
  };
  const before = structuredClone(model);
  assert.deepEqual(previewGeosetTint(model, 0, { Alpha: 1 }, 0, 0), [.20000000298023224, .5, .800000011920929, 1]);
  const preview = prepareWarcraftPreviewColors(structuredClone(model));
  assert.deepEqual(array(preview.ParticleEmitters2[0].SegmentColor[0]), [.10000000149011612, .4000000059604645, .699999988079071]);
  assert.deepEqual(array(preview.RibbonEmitters[0].Color), [.20000000298023224, .30000001192092896, .6000000238418579]);
  assert.deepEqual(model, before);
});
