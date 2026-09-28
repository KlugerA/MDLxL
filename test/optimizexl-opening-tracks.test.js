import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { ModelRenderer } from 'war3-model';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { sanityProposals, runOptimizeStage } from '../src/optimizexl.js';

function fixture(lineType, property = 'Translation') {
  const doc = createStarterDocument();
  doc.apply('Missing local opening fixture', ['Sequences', 'Bones'], m => {
    m.Sequences = [{ Name: 'Action', Interval: new Uint32Array([100, 500]), MinimumExtent: new Float32Array([-50,-50,0]), MaximumExtent: new Float32Array([50,50,100]), BoundsRadius: 100, MoveSpeed: 0, NonLooping: false, Rarity: 0 }];
    m.Sequences.push({ ...structuredClone(m.Sequences[0]), Name: 'Other', Interval: new Uint32Array([1000, 1500]) });
    const value = x => property === 'Rotation' ? new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), x * .01).toArray() : [x, 2, 3];
    const key = (Frame, x) => ({ Frame, Vector: new Float32Array(value(x)), ...(lineType >= 2 ? {
      InTan: new Float32Array(property === 'Rotation' ? value(40) : [2000, -500, 1]),
      OutTan: new Float32Array(property === 'Rotation' ? value(60) : [10, 5, 1]),
    } : {}) });
    m.Bones[0][property] = { LineType: lineType, GlobalSeqId: null, Keys: [key(0, 0), key(200, 5), key(400, 20), key(600, 99), key(1000, 30), key(1500, 40)] };
  });
  return doc;
}

for (const lineType of [1, 2, 3]) for (const property of ['Translation', 'Rotation']) test(`opening ${property}, interpolation ${lineType}: native motion and unused records are retained`, () => {
  const doc = fixture(lineType, property), bytes = doc.serialize('mdx'), before = openDocument(bytes, 'before.mdx').model;
  const fix = sanityProposals(before).find(f => f.kind === 'openingTrack'); assert.ok(fix);
  const after = openDocument(runOptimizeStage(bytes, 'sanity', {}, fix).bytes, 'after.mdx').model;
  assert.equal(after.Bones[0][property].Keys.filter(k => k.Frame === 100).length, 1);
  assert.equal(sanityProposals(after).filter(f => f.kind === 'openingTrack').length, 0);
  const a = new ModelRenderer(structuredClone(before)), b = new ModelRenderer(structuredClone(after));
  for (const [sequence, animation] of before.Sequences.entries()) {
    a.setSequence(sequence); b.setSequence(sequence);
    for (let frame = animation.Interval[0]; frame <= animation.Interval[1]; frame++) {
      a.setFrame(frame); b.setFrame(frame);
      const p = property === 'Rotation' ? a.interp.quat(new Float32Array(4), before.Bones[0][property]) : a.interp.vec3(new Float32Array(3), before.Bones[0][property]);
      const q = property === 'Rotation' ? b.interp.quat(new Float32Array(4), after.Bones[0][property]) : b.interp.vec3(new Float32Array(3), after.Bones[0][property]);
      assert.ok(Math.hypot(...Array.from(p, (v, i) => v - q[i])) < 1e-5, `Frame ${frame} changed`);
    }
  }
  const originalKeys = before.Bones[0][property].Keys, retained = after.Bones[0][property].Keys.filter(k => k.Frame !== 100);
  for (const [i, key] of retained.entries()) {
    assert.deepEqual(key.Vector, originalKeys[i].Vector); assert.equal(key.Frame, originalKeys[i].Frame);
    assert.deepEqual(key.OutTan, originalKeys[i].OutTan);
    if (key.Frame !== 200) assert.deepEqual(key.InTan, originalKeys[i].InTan);
  }
  after.Bones[0][property] = structuredClone(before.Bones[0][property]); assert.deepEqual(after, before);
  assert.deepEqual(doc.serialize('mdx'), bytes);
});

test('constant, step, global, empty and overlapping domains do not get speculative opening repairs', () => {
  for (const mode of ['constant', 'step', 'global', 'empty', 'overlap']) {
    const model = structuredClone(fixture(1).model), track = model.Bones[0].Translation;
    if (mode === 'constant') track.Keys.find(k => k.Frame === 400).Vector = structuredClone(track.Keys.find(k => k.Frame === 200).Vector);
    if (mode === 'step') track.LineType = 0;
    if (mode === 'global') { track.GlobalSeqId = 0; model.GlobalSequences = new Uint32Array([1500]); }
    if (mode === 'empty') track.Keys = track.Keys.filter(k => k.Frame < 100 || k.Frame > 500);
    if (mode === 'overlap') model.Sequences[1].Interval = new Uint32Array([150, 550]);
    assert.deepEqual(sanityProposals(model).filter(f => f.kind === 'openingTrack'), [], mode);
  }
});

test('a stale opening proposal cannot edit a changed track, singly or in a selection batch', () => {
  const doc = fixture(3), fix = sanityProposals(doc.model).find(f => f.kind === 'openingTrack');
  doc.apply('Changed incoming control', ['Bones'], m => { m.Bones[0].Translation.Keys[1].InTan[0]++; });
  const bytes = doc.serialize('mdx');
  assert.throws(() => runOptimizeStage(bytes, 'sanity', {}, fix), /finding changed/);
  assert.throws(() => runOptimizeStage(bytes, 'sanity', {}, { kind: 'batch', stage: 'sanity', entries: [{ fix, settings: {} }] }), /finding changed/);
  assert.deepEqual(doc.serialize('mdx'), bytes);
});

test('a curved scalar particle channel uses the same constant lead-in without moving its burst', () => {
  const doc = fixture(3);
  doc.apply('Particle scalar fixture', ['Bones', 'ParticleEmitters2', 'PivotPoints', 'Info'], m => {
    delete m.Bones[0].Translation;
    const emitter = createNode(m, 'ParticleEmitter2'); emitter.Name = 'Test emitter';
    emitter.EmissionRate = { LineType: 3, GlobalSeqId: null, Keys: [
      { Frame: 200, Vector: new Float32Array([5]), InTan: new Float32Array([-1000]), OutTan: new Float32Array([8]) },
      { Frame: 400, Vector: new Float32Array([20]), InTan: new Float32Array([12]), OutTan: new Float32Array([20]) },
    ] };
  });
  const bytes = doc.serialize('mdx'), before = openDocument(bytes, 'before.mdx').model;
  const fix = sanityProposals(before).find(f => f.kind === 'openingTrack'), after = openDocument(runOptimizeStage(bytes, 'sanity', {}, fix).bytes, 'after.mdx').model;
  const a = new ModelRenderer(structuredClone(before)), b = new ModelRenderer(structuredClone(after)); a.setSequence(0); b.setSequence(0);
  for (let frame = 100; frame <= 500; frame++) {
    a.setFrame(frame); b.setFrame(frame);
    assert.ok(Math.abs(a.interp.num(before.ParticleEmitters2[0].EmissionRate) - b.interp.num(after.ParticleEmitters2[0].EmissionRate)) < 1e-5);
  }
});
