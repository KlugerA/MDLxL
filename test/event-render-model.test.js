import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMDX, generateMDL } from 'war3-model';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { parseEventRenderModel } from '../app/event-render-model.js';

function particleModel(version = 1200) {
  const model = createDemoDocument().model;
  for (const key of ['Materials', 'Geosets', 'GeosetAnims', 'Bones', 'Attachments', 'PivotPoints', 'Nodes']) model[key] = [];
  model.Version = version;
  model.Textures = [{ Image: 'Textures\\Test.blp', ReplaceableId: 0, Flags: 0 }];
  const helper = createNode(model, 'Helper');
  const emitter = createNode(model, 'ParticleEmitter2'); emitter.Parent = helper.ObjectId;
  return model;
}
// The fixture contains only chunks whose binary layout is shared by these
// versions. Avoid the upstream generator's empty FAFX allocation at >=900.
const encoded = model => {
  const bytes = new Uint8Array(generateMDX({ ...model, Version: 800 }));
  new DataView(bytes.buffer).setUint32(12, model.Version, true); return bytes;
};
function chunk(tag, data) {
  const result = new Uint8Array(8 + data.length); result.set(new TextEncoder().encode(tag));
  new DataView(result.buffer).setUint32(4, data.length, true); result.set(data, 8); return result;
}

test('1200 ParticleEmitter2 resources retain their version, tracks, texture and original bytes', () => {
  const model = particleModel(), emitter = model.ParticleEmitters2[0];
  emitter.EmissionRate = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([200]) }, { Frame: 200, Vector: new Float32Array([0]) }] };
  const bytes = encoded(model), original = bytes.slice();
  const parsed = parseEventRenderModel(bytes, 'Test.mdx');
  assert.equal(parsed.Version, 1200); assert.equal(parsed.ParticleEmitters2.length, 1);
  assert.equal(parsed.ParticleEmitters2[0].Parent, parsed.Helpers[0].ObjectId);
  assert.deepEqual(parsed.ParticleEmitters2[0].EmissionRate, emitter.EmissionRate);
  assert.equal(parsed.Textures[0].Image, 'Textures\\Test.blp'); assert.deepEqual(bytes, original);
  assert.equal(openDocument(bytes, 'Test.mdx').readOnly, true, 'runtime capability does not permit writing 1200 files');
});

test('1200 geometry and the changed LITE layout remain explicitly unsupported', () => {
  const mesh = createDemoDocument().model; mesh.Version = 1200;
  assert.throws(() => parseEventRenderModel(encoded(mesh), 'Mesh.mdx'), /ParticleEmitter2 scenes only/);
  const bytes = encoded(particleModel());
  for (const tag of ['LITE', 'ZZZZ']) {
    const extra = chunk(tag, new Uint8Array(4)), combined = new Uint8Array(bytes.length + extra.length);
    combined.set(bytes); combined.set(extra, bytes.length);
    assert.throws(() => parseEventRenderModel(combined), /ParticleEmitter2 scenes only/);
  }
});

test('damaged chunks and invalid particle references/parameters cannot pass the runtime profile', () => {
  const bytes = encoded(particleModel());
  assert.throws(() => parseEventRenderModel(bytes.subarray(0, bytes.length - 1)), /damaged MDX chunks/);
  const invalidReference = particleModel(); invalidReference.ParticleEmitters2[0].TextureID = 9;
  assert.throws(() => parseEventRenderModel(encoded(invalidReference)), /missing texture 9/);
  const invalidParameters = particleModel(); invalidParameters.ParticleEmitters2[0].Rows = 0;
  assert.throws(() => parseEventRenderModel(encoded(invalidParameters)), /invalid rendering parameters/);
});

test('supported legacy MDX and MDL event resources continue decoding', () => {
  const model = particleModel(1100);
  assert.equal(parseEventRenderModel(encoded(model), 'Test.mdx').Version, 1100);
  assert.equal(parseEventRenderModel(new TextEncoder().encode(generateMDL(model)), 'Test.mdl').Version, 1100);
  const unknown = particleModel(1300);
  assert.throws(() => parseEventRenderModel(encoded(unknown)), /format 1300/);
});
