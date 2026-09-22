import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { createGeosetAnimations, setAnimationKey, setAnimationInlineValues } from '../src/animation-tracks.js';
import { sampleGeosetAnimation } from '../src/animation.js';
import { prepareModelSave } from '../src/save-target.js';
import { assertModelEquivalent, modelDifferenceReport } from '../src/save-equivalence.js';
import { createVisibilityGeosetAnimation, setGeosetTintEnabled } from '../src/geoset-animation-defaults.js';
import { prepareModelSaveAsync } from '../app/model-save.js';

const bytes = fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fixture = () => openDocument(bytes, 'Tzeentch_Knight_Max_Reduced.mdx');
const target = (id, property = 'Alpha') => ({ kind: 'geoset', id, property });
const vector = values => new Float32Array(values);
const animation = (model, id) => model.GeosetAnims.find(a => a.GeosetId === id);
function hide(doc, ids = doc.model.Geosets.map((_, id) => id), value = 0) {
  const sequence = doc.model.Sequences.findIndex(s => s.Name === 'Decay Bone');
  const frame = doc.model.Sequences[sequence].Interval[0];
  doc.apply('Set geoset visibility keyframe', ['GeosetAnims', 'Info'], model =>
    setAnimationKey(model, ids.map(id => target(id)), frame, value, sequence));
  return { sequence, frame };
}
// Independent container/record decoding: no MDLxL parser or writer helpers.
function chunks(data) {
  const result = new Map(), buffer = Buffer.from(data);
  for (let at = 4; at < buffer.length;) {
    const size = buffer.readUInt32LE(at + 4);
    result.set(buffer.toString('ascii', at, at + 4), buffer.subarray(at + 8, at + 8 + size));
    at += 8 + size;
  }
  return result;
}
function records(data) {
  const buffer = chunks(data).get('GEOA'), result = [];
  for (let at = 0; at < buffer.length;) {
    const size = buffer.readUInt32LE(at);
    result.push({ id: buffer.readInt32LE(at + 24), flags: buffer.readUInt32LE(at + 8),
      alpha: buffer.readFloatLE(at + 4), color: [12, 16, 20].map(offset => buffer.readFloatLE(at + offset)),
      bytes: buffer.subarray(at, at + size) });
    at += size;
  }
  return result;
}

test('original fixture has optional records, disabled white colors, and byte-exact untouched MDX export', () => {
  assert.equal(sha(bytes), 'bced442553d8b6fb3c8801f7ba096dbc9a8a0055435b59c67316badcef2edabd');
  const doc = fixture(), before = structuredClone(doc.model);
  assert.equal(doc.model.Geosets.length, 48);
  assert.deepEqual(records(bytes).map(a => a.id), Array.from({ length: 46 }, (_, i) => i));
  assert.equal(records(bytes).filter(a => !(a.flags & 2) && a.color.every(v => v === 1) && !a.bytes.includes(Buffer.from('KGAC'))).length, 24);
  assert.deepEqual(Buffer.from(prepareModelSave(doc, 'mdx').bytes), bytes);
  assert.deepEqual(doc.model, before);
  assert.equal(doc.dirty, false);
});

test('fixture MDL export reports the separate 26 Helper flag losses, never harmless Color defaults', () => {
  for (const edited of [false, true]) {
    const doc = fixture();
    if (edited) hide(doc);
    const before = structuredClone(doc.model), history = doc.historyStats;
    assert.throws(() => prepareModelSave(doc, 'mdl'), error => {
      assert.match(error.message, /26 fields: Helpers\[0\]\.Flags/);
      assert.doesNotMatch(error.message, /GeosetAnims/);
      assert(error.message.length < 600);
      return true;
    });
    assert.deepEqual(doc.model, before);
    assert.deepEqual(doc.historyStats, history);
    assert.equal(doc.dirty, edited);
    assert.deepEqual(Buffer.from(doc.originalBytes), bytes);
  }
});

test('video replay: create missing visibility, Decay Bone, All, hide, save/reopen with no unrelated changes', () => {
  const doc = fixture();
  doc.apply('Create geoset visibility', ['GeosetAnims', 'Info'], model => createGeosetAnimations(model, [46, 47]));
  for (const id of [46, 47]) assert.deepEqual(animation(doc.model, id), createVisibilityGeosetAnimation(id));
  const { sequence, frame } = hide(doc), edited = structuredClone(doc.model);
  const saved = prepareModelSave(doc, 'mdx').bytes, reopened = openDocument(saved, 'saved.mdx');
  assertModelEquivalent(edited, reopened.model);
  for (let id = 0; id < 48; id++) assert.equal(sampleGeosetAnimation(reopened.model, id, frame, sequence).alpha, 0);
  for (const [tag, original] of chunks(bytes)) if (!['MODL', 'GEOA'].includes(tag)) assert.deepEqual(chunks(saved).get(tag), original, tag);
  for (const id of [46, 47]) {
    const record = records(saved).find(a => a.id === id);
    assert.equal(record.flags, 0); assert.equal(record.alpha, 1); assert.deepEqual(record.color, [1, 1, 1]);
  }
  assert.deepEqual(doc.model, edited);
  assert(doc.dirty);
  doc.markSaved(saved, 'saved.mdx'); assert.equal(doc.dirty, false);
  for (let cycle = 0; cycle < 3; cycle++) {
    hide(doc);
    const output = prepareModelSave(doc, 'mdx').bytes;
    assert.deepEqual(Buffer.from(output), Buffer.from(saved));
    assert.equal(openDocument(output, 'cycle.mdx').model.GeosetAnims.length, 48);
    doc.markSaved(output);
  }
});

test('existing and either missing ID are edited by GeosetId; undo/redo restores creation and alpha', () => {
  for (const id of [1, 46, 47]) {
    const doc = fixture();
    doc.apply('Reorder records', ['GeosetAnims'], m => { m.GeosetAnims.reverse(); });
    const before = structuredClone(doc.model);
    hide(doc, [id], .25); const edited = structuredClone(doc.model);
    assert.equal(doc.model.GeosetAnims.length, id < 46 ? 46 : 47);
    const output = prepareModelSave(doc, 'mdx');
    assertModelEquivalent(edited, openDocument(output.bytes, output.name).model);
    doc.undo(); assert.deepEqual(doc.model, before);
    doc.redo(); assert.deepEqual(doc.model, edited);
  }
});

test('disabled null, absent and white export to BOTH formats without tint or live mutation', () => {
  for (const color of [null, undefined, vector([1, 1, 1])]) for (const flags of [0, 1]) {
    const doc = createDemoDocument();
    doc.apply('Visibility only default', ['GeosetAnims'], model => {
      Object.assign(model.GeosetAnims[0], { Flags: flags, Alpha: 0, Color: color });
      if (color === undefined) delete model.GeosetAnims[0].Color;
    });
    const before = structuredClone(doc.model), history = doc.historyStats;
    for (const format of ['mdx', 'mdl']) {
      const output = prepareModelSave(doc, format), reopened = openDocument(output.bytes, output.name);
      assertModelEquivalent(before, reopened.model);
      assert.equal(reopened.model.GeosetAnims[0].Flags, flags);
      assert.equal(reopened.model.GeosetAnims[0].Alpha, 0);
      assert.deepEqual(doc.model, before); assert.deepEqual(doc.historyStats, history);
      const next = prepareModelSave(reopened, format === 'mdx' ? 'mdl' : 'mdx');
      assertModelEquivalent(before, openDocument(next.bytes, next.name).model);
    }
  }
});

test('enabled white, black and asymmetric static RGB retain tint, DropShadow and channels in BOTH formats', () => {
  for (const rgb of [[1, 1, 1], [0, 0, 0], [.125, .25, .875]]) {
    const doc = createDemoDocument();
    doc.apply('Enabled tint', ['GeosetAnims'], model => {
      model.GeosetAnims[0].Flags = 1;
      setAnimationInlineValues(model, [target(0, 'Color')], rgb);
      setAnimationInlineValues(model, [target(0)], 0);
    });
    for (const format of ['mdx', 'mdl']) {
      const output = prepareModelSave(doc, format), reopened = openDocument(output.bytes, output.name);
      assertModelEquivalent(doc.model, reopened.model);
      assert.equal(reopened.model.GeosetAnims[0].Flags, 3);
      assert.equal(reopened.model.GeosetAnims[0].Alpha, 0);
      assert.deepEqual([...reopened.model.GeosetAnims[0].Color], rgb);
      if (format === 'mdx') assert.deepEqual(records(output.bytes)[0].color, rgb);
    }
  }
});

test('explicit tint toggles materialize disabled null white and retain all other flag bits', () => {
  const doc = createDemoDocument();
  doc.apply('Disabled default', ['GeosetAnims'], m => { Object.assign(m.GeosetAnims[0], { Color: null, Flags: 1 }); });
  doc.apply('Enable white', ['GeosetAnims'], m => setGeosetTintEnabled(m.GeosetAnims[0], true));
  for (const format of ['mdx', 'mdl']) {
    const output = prepareModelSave(doc, format), anim = openDocument(output.bytes, output.name).model.GeosetAnims[0];
    assert.equal(anim.Flags, 3); assert.deepEqual([...anim.Color], [1, 1, 1]);
  }
  const anim = { Flags: 0x41, Color: null };
  setGeosetTintEnabled(anim, true); assert.equal(anim.Flags, 0x43);
  setGeosetTintEnabled(anim, false); assert.equal(anim.Flags, 0x41);
});

test('animated RGB/alpha keep global sequence, interpolation, tangents, bases and flag bits', () => {
  const doc = createDemoDocument();
  doc.apply('Spline global fixture', ['GeosetAnims', 'GlobalSequences'], model => {
    model.GlobalSequences = [1000];
    const anim = model.GeosetAnims[0]; anim.Flags = 3;
    for (const [field, values] of [['Color', [.125, .25, .875]], ['Alpha', [0]]]) {
      anim[field] = { LineType: 3, GlobalSeqId: 0, Keys: [0, 1000].map(Frame => ({ Frame,
        Vector: vector(values), InTan: vector(values.map(n => n + .125)), OutTan: vector(values.map(n => n - .125)) })) };
    }
    anim._MdxDefaults = { Color: vector([.75, .5, .25]), Alpha: 0 };
  });
  for (const format of ['mdx', 'mdl']) {
    const output = prepareModelSave(doc, format), reopened = openDocument(output.bytes, output.name);
    assertModelEquivalent(doc.model, reopened.model);
    assert.equal(sampleGeosetAnimation(reopened.model, 0, 0, 0, 0).alpha, 0);
    for (const field of ['Color', 'Alpha']) for (const member of ['LineType', 'GlobalSeqId', 'Vector', 'InTan', 'OutTan']) {
      const damaged = structuredClone(reopened.model), track = damaged.GeosetAnims[0][field];
      if (member === 'LineType') track.LineType = 2;
      else if (member === 'GlobalSeqId') track.GlobalSeqId = null;
      else track.Keys[0][member][0] += .25;
      assert.throws(() => assertModelEquivalent(doc.model, damaged), /Save verification failed/);
    }
    if (format === 'mdx') {
      const record = records(output.bytes)[0], at = record.bytes.indexOf(Buffer.from('KGAC'));
      assert.deepEqual(record.color, [.75, .5, .25]);
      assert.deepEqual([20, 24, 28].map(i => record.bytes.readFloatLE(at + i)), [.875, .25, .125]);
    }
  }
});

test('dormant nonwhite and disabled tracks survive MDX but explicitly block lossy MDL', () => {
  for (const color of [vector([.125, .25, .875]), { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: vector([.125, .25, .875]) }] }]) {
    const doc = createDemoDocument();
    doc.apply('Dormant data', ['GeosetAnims'], m => { m.GeosetAnims[0].Flags = 1; m.GeosetAnims[0].Color = color; });
    const before = structuredClone(doc.model);
    assertModelEquivalent(before, openDocument(prepareModelSave(doc, 'mdx').bytes, 'saved.mdx').model);
    assert.throws(() => prepareModelSave(doc, 'mdl'), /Cannot export geoset colors.*(dormant nonwhite|disabled tint with a color track)/);
    assert.deepEqual(doc.model, before); assert(doc.dirty);
  }
});

test('active malformed colors and real reference/nonfinite errors are never whitened or accepted', () => {
  for (const color of [null, undefined, vector([1, 0])]) {
    const doc = createDemoDocument();
    doc.apply('Malformed active color', ['GeosetAnims'], m => { m.GeosetAnims[0].Color = color; });
    for (const format of ['mdx', 'mdl']) assert.throws(() => prepareModelSave(doc, format), /invalid static color/);
  }
  const doc = fixture(), before = structuredClone(doc.model);
  assert.throws(() => doc.apply('Bad reference', ['GeosetAnims'], m => { m.GeosetAnims[0].GeosetId = 999; }), /missing geoset/);
  assert.throws(() => doc.apply('Bad alpha', ['GeosetAnims'], m => { m.GeosetAnims[0].Alpha = NaN; }), /non-finite/);
  assert.deepEqual(doc.model, before);
});

test('injected real changes remain failures; reporting counts all differences and bounds details', () => {
  const expected = fixture().model;
  for (const mutate of [
    m => { m.GeosetAnims[0].Flags ^= 2; },
    m => { m.GeosetAnims[0].Alpha.Keys[0].Vector[0] = .123; },
    m => { m.GeosetAnims[0].Alpha.LineType ^= 1; },
    m => { m.GeosetAnims[0].Alpha.GlobalSeqId = 0; },
    m => { m.Bones[0].GeosetAnimId = 47; },
    m => { m.GeosetAnims[1].Color = vector([.1, .2, .3]); },
    m => { m.GeosetAnims[1].Color = { LineType: 1, GlobalSeqId: null, Keys: [] }; },
  ]) {
    const actual = structuredClone(expected); mutate(actual);
    assert.throws(() => assertModelEquivalent(expected, actual), /Save verification failed/);
  }
  const a = { GeosetAnims: Array.from({ length: 10000 }, (_, id) => ({ ...createVisibilityGeosetAnimation(id), Flags: 2 })) };
  const b = structuredClone(a); b.GeosetAnims.forEach(anim => { anim.Color[0] = 0; });
  const report = modelDifferenceReport(a, b);
  assert.equal(report.total, 10000); assert.equal(report.differences.length, 12);
  assert.throws(() => assertModelEquivalent(a, b), e => e.message.length < 700 && /10000 fields/.test(e.message));
});

function nodeWorker(counter) {
  counter.count++;
  const url = new URL('../app/model-save.worker.js', import.meta.url).href;
  const thread = new Worker(`const {parentPort}=require('node:worker_threads');
    globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};
    import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`, { eval: true });
  const adapter = { postMessage: data => thread.postMessage(data), terminate: () => thread.terminate() };
  thread.on('message', data => adapter.onmessage?.({ data }));
  thread.on('error', error => adapter.onerror?.(error));
  return adapter;
}

test('real save worker coalesces repeated attempts, retains failure edits and recovers for a subsequent save', async () => {
  const counter = { count: 0 }, doc = fixture(); hide(doc);
  const before = structuredClone(doc.model), history = doc.historyStats;
  const failed = prepareModelSaveAsync(doc, 'mdl', doc.name, () => nodeWorker(counter));
  assert.equal(prepareModelSaveAsync(doc, 'mdl'), failed);
  await assert.rejects(failed, /26 fields/);
  assert.equal(counter.count, 1); assert.deepEqual(doc.model, before); assert.deepEqual(doc.historyStats, history); assert(doc.dirty);
  const result = await prepareModelSaveAsync(doc, 'mdx', doc.name, () => nodeWorker(counter));
  assert.equal(counter.count, 2); assertModelEquivalent(before, openDocument(result.bytes, result.name).model);
  for (const field of ['serializationMs', 'reparsingMs', 'verificationMs', 'errorFormattingMs']) assert(Number.isFinite(result.timings[field]));
  doc.markSaved(result.bytes, result.name); assert.equal(doc.dirty, false);
});

test('worker snapshot cannot mark edits made during a save as saved', async () => {
  const doc = fixture(); hide(doc);
  const promise = prepareModelSaveAsync(doc, 'mdx', doc.name, () => nodeWorker({ count: 0 }));
  doc.apply('Later name edit', ['Info'], m => { m.Info.Name += ' later'; });
  const output = await promise;
  doc.markSaved(output.bytes, output.name);
  assert(doc.dirty); assert.match(doc.model.Info.Name, / later$/);
  assert.doesNotMatch(openDocument(output.bytes, output.name).model.Info.Name, / later$/);
});
