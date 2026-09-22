import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { sampleGeosetAnimation } from '../src/animation.js';
import { sampleAnimationProperty, setAnimationKey, setAnimationSequences } from '../src/animation-tracks.js';
import { previewGeosetTint } from '../app/warcraft-preview-adapter.js';
import { vertexRgbPreviewState } from '../app/vertex-rgb-preview.js';

const target = { kind: 'geoset', id: 0, property: 'Color' };
const triple = (bytes, offset) => [0, 4, 8].map(delta => bytes.readFloatLE(offset + delta));

// Independent MDX oracle: Retera GeosetAnimationChunk writes static GEOA in
// RGB, but KGAC values/tangents in BGR. Encode these bytes directly so a
// mutually wrong MDLxL reader/writer cannot make this fixture pass.
function externalFixture() {
  const doc = createDemoDocument();
  doc.apply('Fixture structure', ['GeosetAnims'], model => {
    model.GeosetAnims[0].Color = { LineType: 2, GlobalSeqId: null, Keys: [{
      Frame: 0, Vector: new Float32Array([1, 1, 1]),
      InTan: new Float32Array(3), OutTan: new Float32Array(3),
    }] };
  });
  const bytes = Buffer.from(doc.serialize('mdx'));
  const record = bytes.indexOf(Buffer.from('GEOA')) + 8;
  const kgac = bytes.indexOf(Buffer.from('KGAC'));
  for (const [offset, values] of [
    [record + 12, [.125, .25, .875]], // Static RGB base must NOT be reversed.
    [kgac + 20, [1, 1, 0]], // Stored BGR = displayed cyan, as in geoset 18.
    [kgac + 32, [.125, .25, .5]],
    [kgac + 44, [.75, .5, .25]],
  ]) values.forEach((value, i) => bytes.writeFloatLE(value, offset + i * 4));
  return { bytes, kgac, record };
}

test('external BGR KGAC displays RGB in controls and both previews; static base stays RGB', () => {
  const { bytes } = externalFixture();
  const doc = openDocument(bytes, 'external.mdx'), model = doc.model;
  const before = structuredClone(model);
  assert.equal(doc.readOnly, false);
  assert.deepEqual(sampleAnimationProperty(model, target, 0, 0), [0, 1, 1]);
  assert.deepEqual(sampleGeosetAnimation(model, 0, 0, -1).color, [.125, .25, .875]);
  const state = vertexRgbPreviewState(model, { enabled: true, sequenceIndex: 0 });
  assert.deepEqual(sampleGeosetAnimation(model, 0, state.frame, state.sequenceIndex).color, [0, 1, 1]);
  assert.deepEqual(previewGeosetTint(model, 0, { Alpha: 1 }, 0, 0), [0, 1, 1, 1]);
  assert.deepEqual([...model.GeosetAnims[0].Color.Keys[0].InTan], [.5, .25, .125]);
  assert.deepEqual([...model.GeosetAnims[0].Color.Keys[0].OutTan], [.25, .5, .75]);
  assert.deepEqual(model, before, 'viewing does not edit the model');
  assert.deepEqual(Buffer.from(doc.serialize('mdx')), bytes, 'untouched save is byte-exact');
  const mdl = doc.serialize('mdl');
  const reopened = openDocument(mdl, 'external.mdl');
  assert.deepEqual(sampleAnimationProperty(reopened.model, target, 0, 0), [0, 1, 1]);
  const converted = Buffer.from(reopened.serialize('mdx'));
  assert.deepEqual(triple(converted, converted.indexOf(Buffer.from('KGAC')) + 20), [1, 1, 0]);
});

test('editing another GEOA field preserves external color keys, tangents and static base', () => {
  const { bytes, kgac, record } = externalFixture();
  const doc = openDocument(bytes, 'external.mdx');
  doc.apply('Alpha only', ['GeosetAnims'], model => { model.GeosetAnims[0].Alpha = .5; });
  const saved = Buffer.from(doc.serialize('mdx'));
  assert.deepEqual(saved.subarray(kgac, kgac + 56), bytes.subarray(kgac, kgac + 56));
  assert.deepEqual(saved.subarray(record + 12, record + 24), bytes.subarray(record + 12, record + 24));
});

test('RGB controls write animated BGR while readback keeps the entered RGB', () => {
  const { bytes } = externalFixture();
  for (const edit of [
    model => setAnimationKey(model, [target], 0, [1, 0, 100 / 255], 0),
    model => setAnimationSequences(model, [target], [1, 0, 100 / 255], [0]),
  ]) {
    const doc = openDocument(bytes, 'external.mdx');
    doc.apply('Enter R255 G0 B100', ['GeosetAnims'], edit);
    const saved = Buffer.from(doc.serialize('mdx'));
    assert.deepEqual(triple(saved, saved.indexOf(Buffer.from('KGAC')) + 20), [Math.fround(100 / 255), 0, 1]);
    assert.deepEqual(sampleAnimationProperty(openDocument(saved, 'saved.mdx').model, target, 0, 0), [1, 0, Math.fround(100 / 255)]);
  }
});
