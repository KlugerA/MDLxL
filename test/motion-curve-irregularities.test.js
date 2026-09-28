import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { scanCurveMotion, scanMotion, motionSnapshot } from '../src/motion-inspector.js';
import { findIrregularities, runOptimizeStage } from '../src/optimizexl.js';

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
  assert.ok(finding.inspectionOnly); assert.equal(finding.sequence, 0); assert.equal(finding.frame, 0);
  assert.match(finding.label, /Any animation: irregular movement/);
  assert.throws(() => runOptimizeStage(mdx, 'irregularities', {}, finding), /no automatic correction/);
  assert.deepEqual(doc.model, before); assert.deepEqual(doc.serialize('mdx'), mdx); assert.deepEqual(doc.serialize('mdl'), mdl);
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
