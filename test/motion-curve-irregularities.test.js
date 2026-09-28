import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { scanCurveMotion, scanMotion, motionSnapshot } from '../src/motion-inspector.js';
import { findIrregularities, runOptimizeStage } from '../src/optimizexl.js';
import { openDocument } from '../src/editor-document.js';
import { sampleTrack } from '../src/animation.js';

function fixture({ values = [-5, -6, -7, -6, -5], duration = 300, type = 2 } = {}) {
  const doc = createStarterDocument();
  doc.apply('Curve fixture', ['Info', 'Sequences', 'Bones'], m => {
    m.Info.BoundsRadius = 100;
    m.Sequences = [{ Name: 'Any animation', Interval: new Uint32Array([0, (values.length - 1) * duration]),
      MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 100, MoveSpeed: 0, NonLooping: false, Rarity: 0 }];
    m.Bones[0].Translation = { LineType: type, GlobalSeqId: null, Keys: values.map((z, i) => ({
      Frame: i * duration, Vector: new Float32Array([0, 0, z]), InTan: new Float32Array([0, 0, z]), OutTan: new Float32Array([0, 0, z]),
    })) };
  });
  return doc;
}

test('small repeated between-key reversals appear in OptimizeXL and the existing motion scanner', () => {
  const doc = fixture(), before = structuredClone(doc.model), mdx = doc.serialize('mdx'), mdl = doc.serialize('mdl');
  const warnings = scanCurveMotion(motionSnapshot(doc.model));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].kind, 'repeated-curve-reversals');
  assert.deepEqual(warnings[0].keyTimes, [0, 300, 600, 900, 1200]);
  assert.ok(scanMotion(doc.model).findings.some(f => f.kind === warnings[0].kind));
  const finding = findIrregularities(doc.model).find(f => f.kind === 'motion');
  assert.equal(finding.sequence, 0); assert.equal(finding.frame, 0);
  assert.match(finding.label, /Any animation: irregular movement/);
  assert.deepEqual(doc.model, before); assert.deepEqual(doc.serialize('mdx'), mdx); assert.deepEqual(doc.serialize('mdl'), mdl);
});

test('the proposed repair removes between-key overshoot while preserving every stored pose and time', () => {
  const doc = fixture(), bytes = doc.serialize('mdx'), before = openDocument(bytes, 'before.mdx').model;
  const fix = findIrregularities(before).find(f => f.kind === 'motion');
  const result = runOptimizeStage(bytes, 'irregularities', {}, fix), after = openDocument(result.bytes, 'after.mdx').model;
  const track = after.Bones[0].Translation, source = before.Bones[0].Translation;
  assert.ok(result.changed); assert.deepEqual(track.Keys.map(k => [k.Frame, ...k.Vector]), source.Keys.map(k => [k.Frame, ...k.Vector]));
  assert.deepEqual(scanCurveMotion(after), []);
  for (let i = 1; i < track.Keys.length; i++) {
    const a = track.Keys[i - 1], b = track.Keys[i];
    for (let j = 0; j <= 32; j++) {
      const value = sampleTrack(track, a.Frame + (b.Frame - a.Frame) * j / 32, { interval: after.Sequences[0].Interval, fallback: [0, 0, 0] });
      for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(value[axis] - (a.Vector[axis] + (b.Vector[axis] - a.Vector[axis]) * j / 32)) < 1e-5);
    }
  }
  assert.deepEqual(track.Keys[0].InTan, source.Keys[0].InTan); assert.deepEqual(track.Keys.at(-1).OutTan, source.Keys.at(-1).OutTan);
  after.Bones[0].Translation = structuredClone(source); after.Nodes[after.Bones[0].ObjectId].Translation = after.Bones[0].Translation;
  assert.deepEqual(after, before, 'Only the selected translation controls may change');
  assert.deepEqual(doc.serialize('mdx'), bytes);
});

test('repair changes only detected segments, leaving gaps and other animation controls intact', () => {
  const doc = fixture({ values: [-5, -6, -7, -8, -9, -10, -11, -12, -13], duration: 100 });
  doc.apply('Independent curve section', ['Bones'], m => {
    const keys = m.Bones[0].Translation.Keys;
    keys[3].OutTan = new Float32Array([0, 0, -1]); keys[4].InTan = new Float32Array([0, 0, -1]);
    keys.push({ Frame: 2000, Vector: new Float32Array([5, 0, 0]), InTan: new Float32Array([4, 0, 0]), OutTan: new Float32Array([6, 0, 0]) });
  });
  const bytes = doc.serialize('mdx'), m = openDocument(bytes, 'before.mdx').model, fix = findIrregularities(m).find(f => f.kind === 'motion');
  assert.ok(!fix.segments.some(s => s.start === 300));
  const after = openDocument(runOptimizeStage(bytes, 'irregularities', {}, fix).bytes, 'after.mdx').model;
  assert.deepEqual(after.Bones[0].Translation.Keys[3].OutTan, m.Bones[0].Translation.Keys[3].OutTan);
  assert.deepEqual(after.Bones[0].Translation.Keys[4].InTan, m.Bones[0].Translation.Keys[4].InTan);
  assert.deepEqual(after.Bones[0].Translation.Keys.at(-1), m.Bones[0].Translation.Keys.at(-1));
});

test('a stale motion proposal cannot repair a different set of curve segments', () => {
  const doc = fixture(), bytes = doc.serialize('mdx'), fix = findIrregularities(doc.model).find(f => f.kind === 'motion');
  assert.throws(() => runOptimizeStage(bytes, 'irregularities', {}, { ...fix, segments: [] }), /segments changed/);
  const result = runOptimizeStage(bytes, 'irregularities', {}, fix);
  assert.throws(() => runOptimizeStage(result.bytes, 'irregularities', {}, fix), /no longer matches/);
});

test('correct Hermite controls and ordinary keyed bobs are not warnings', () => {
  for (const type of [0, 1, 2, 3]) {
    const doc = fixture({ type }), keys = doc.model.Bones[0].Translation.Keys;
    if (type === 2) for (let i = 0; i < keys.length - 1; i++) {
      const delta = keys[i + 1].Vector.map((v, axis) => v - keys[i].Vector[axis]);
      keys[i].OutTan = delta; keys[i + 1].InTan = delta;
    }
    assert.deepEqual(scanCurveMotion(doc.model), []);
  }
  const doc = fixture();
  for (const k of doc.model.Bones[0].Translation.Keys) k.InTan = k.OutTan = new Float32Array(3);
  assert.deepEqual(scanCurveMotion(doc.model), []);
});

test('tiny motion, one curved arc, slow motion and quaternion controls stay quiet', () => {
  for (const settings of [{ values: [-.005, -.006, -.007, -.006, -.005] }, { values: [-5, -6, -5] }, { duration: 1000 }])
    assert.deepEqual(scanCurveMotion(fixture(settings).model), []);
  const doc = fixture(), node = doc.model.Bones[0];
  node.Rotation = node.Translation; delete node.Translation;
  for (const k of node.Rotation.Keys) k.Vector = k.InTan = k.OutTan = new Float32Array([0, 0, 0, 1]);
  assert.deepEqual(scanCurveMotion(doc.model), []);
});

test('warnings respect sequence boundaries, global tracks, node scope and interruption of repetition', () => {
  const doc = fixture(), m = doc.model, node = m.Bones[0];
  assert.deepEqual(scanCurveMotion(m, { nodeIds: [] }), []);
  m.Sequences[0].Interval[1] = 600;
  assert.deepEqual(scanCurveMotion(m), []);
  m.Sequences[0].Interval[1] = 1200; node.Translation.GlobalSeqId = 0; m.GlobalSequences = [1200];
  assert.deepEqual(scanCurveMotion(m), []);
  node.Translation.GlobalSeqId = null; node.Translation.Keys[2].OutTan = new Float32Array(3);
  assert.deepEqual(scanCurveMotion(m), []);
});
