import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { sampleTrack } from '../src/animation.js';
import { scanSuspiciousSnaps } from '../src/optimizexl-snaps.js';
import { findIrregularities, runOptimizeStage, sanityProposals } from '../src/optimizexl.js';
import { OptimizeXLSession } from '../src/optimizexl-session.js';

function fixture(times = [0, 300, 333, 400, 700, 733, 800, 1200], values = [10, 10, 12, 10, 10, 13, 10, 10], type = 2) {
  const doc = createStarterDocument();
  doc.apply('Suspicious body motion', ['Info', 'Sequences', 'Bones'], m => {
    m.Info.BoundsRadius = 100;
    const seq = (Name, start, end) => ({ ...m.Sequences[0], Name, Interval: new Uint32Array([start, end]), MoveSpeed: 0, NonLooping: false, Rarity: 0 });
    m.Sequences = [seq('Unfamiliar action', 0, 1200), seq('Separate action', 2000, 3200)];
    m.Bones[0].Translation = { LineType: type, GlobalSeqId: null, Keys: [...times.map((Frame, i) => ({ Frame, Vector: new Float32Array([values[i], 0, 0]) })),
      ...[2000, 2400, 2800, 3200].map((Frame, i) => ({ Frame, Vector: new Float32Array([i + 15, 0, 0]) }))] };
    if (type >= 2) for (const k of m.Bones[0].Translation.Keys) { k.InTan = new Float32Array(k.Vector); k.OutTan = new Float32Array(k.Vector); }
  });
  return doc;
}
const read = bytes => openDocument(bytes, 'fixture.mdx').model;
const sample = (m, frame) => sampleTrack(m.Bones[0].Translation, frame, { interval: m.Sequences[0].Interval, fallback: [0, 0, 0] });

test('repeated offsets return exactly to the held pose while retaining all other data', () => {
  const doc = fixture(), source = doc.serialize('mdx'), before = read(source), fix = scanSuspiciousSnaps(before).find(f => f.sequence === 0);
  assert.ok(fix); assert.equal(fix.kind, 'snap');
  const after = read(runOptimizeStage(source, 'irregularities', {}, fix).bytes);
  for (const { start, end } of fix.spans) for (let t = start; t <= end; t++) assert.ok(Math.hypot(...Array.from(sample(after, t), (v, i) => v - (i ? 0 : 10))) < 1e-6);
  assert.deepEqual(scanSuspiciousSnaps(after).filter(f => f.sequence === 0), []);
  assert.deepEqual(after.Bones[0].Translation.Keys.filter(k => k.Frame >= 2000), before.Bones[0].Translation.Keys.filter(k => k.Frame >= 2000));
  after.Bones[0].Translation = structuredClone(before.Bones[0].Translation); assert.deepEqual(after, before);
  assert.deepEqual(doc.serialize('mdx'), source);
});

test('an abrupt whole-body excursion between long holds is suspicious without copied controls', () => {
  const source = fixture([0, 400, 450, 500, 1200], [0, 0, 2, 0, 0], 1).serialize('mdx'), before = read(source), fix = scanSuspiciousSnaps(before)[0];
  assert.ok(fix); assert.deepEqual(fix.spans.map(s => [s.start, s.end]), [[400, 500]]);
  const after = read(runOptimizeStage(source, 'irregularities', {}, fix).bytes);
  for (let t = 0; t <= 1200; t++) assert.equal(sample(after, t)[0], 0);
});

test('ordinary movement, a slow bob, and small deviations do not become snap warnings', () => {
  for (const [times, values] of [
    [[0, 300, 600, 900, 1200], [0, 2, 4, 6, 8]],
    [[0, 300, 600, 900, 1200], [0, 0, 2, 0, 0]],
    [[0, 400, 450, 500, 1200], [0, 0, .1, 0, 0]],
  ]) assert.deepEqual(scanSuspiciousSnaps(fixture(times, values, 1).model), []);
});

test('shared, stepped, overlapping and unbound effect tracks are not repaired as body snaps', () => {
  for (const mode of ['global', 'step', 'overlap', 'unbound']) {
    const m = structuredClone(fixture().model);
    if (mode === 'global') m.Bones[0].Translation.GlobalSeqId = 0;
    if (mode === 'step') m.Bones[0].Translation.LineType = 0;
    if (mode === 'overlap') m.Sequences[1].Interval = new Uint32Array([0, 3200]);
    if (mode === 'unbound') m.Geosets[0].Groups = [[]];
    assert.deepEqual(scanSuspiciousSnaps(m), []);
  }
});

test('combined preview validates against one baseline, applies only checked fixes, and undoes in one step', () => {
  const source = fixture().serialize('mdx'), model = read(source), catalog = findIrregularities(model);
  const fixes = catalog.filter(f => f.sequence === 0 && ['motion', 'snap'].includes(f.kind));
  assert.ok(fixes.some(f => f.kind === 'motion')); assert.ok(fixes.some(f => f.kind === 'snap'));
  const batch = { kind: 'batch', stage: 'irregularities', entries: fixes.map(fix => ({ fix, settings: {} })) };
  const result = runOptimizeStage(source, 'irregularities', {}, batch), after = read(result.bytes);
  for (const span of fixes.find(f => f.kind === 'snap').spans) for (let t = span.start; t <= span.end; t++) assert.ok(Math.abs(sample(after, t)[0] - 10) < 1e-6);
  assert.deepEqual(after.Bones[0].Translation.Keys.filter(k => k.Frame >= 2000), model.Bones[0].Translation.Keys.filter(k => k.Frame >= 2000));
  const onlySnap = { ...batch, entries: batch.entries.filter(e => e.fix.kind === 'snap') };
  assert.deepEqual(runOptimizeStage(source, 'irregularities', {}, onlySnap).bytes, runOptimizeStage(source, 'irregularities', {}, onlySnap.entries[0].fix).bytes);
  const session = new OptimizeXLSession(source, 'fixture.mdx'); session.propose(result, 0); session.approve('irregularities', { fix: batch });
  assert.equal(session.steps.length, 1); assert.deepEqual(session.before, source); assert.deepEqual(session.accepted, result.bytes);
  assert.deepEqual(session.back().settings.fix, batch); assert.deepEqual(session.accepted, source);
});

test('combined fixes reject stale, duplicate or unknown findings atomically', () => {
  const doc = fixture(), source = doc.serialize('mdx'), fix = scanSuspiciousSnaps(read(source))[0];
  const batch = entries => ({ kind: 'batch', stage: 'irregularities', entries });
  for (const entries of [[{ fix: { ...fix, signature: 'stale' } }], [{ fix }, { fix }], [{ fix: { ...fix, id: 'unknown' } }]])
    assert.throws(() => runOptimizeStage(source, 'irregularities', {}, batch(entries)), /changed|selected|finding/i);
  doc.apply('Alter the evidence', ['Bones'], m => { m.Bones[0].Translation.Keys[2].Vector[0] = 20; });
  assert.throws(() => runOptimizeStage(doc.serialize('mdx'), 'irregularities', {}, fix), /changed/);
  assert.deepEqual(read(source), read(fixture().serialize('mdx')));
});

test('combined sanity repairs retain a different setting for each selected finding', () => {
  const doc = fixture();
  doc.apply('Two fire emitters', ['ParticleEmitters2', 'PivotPoints'], m => {
    for (let i = 0; i < 2; i++) createNode(m, 'ParticleEmitter2').Gravity = { LineType: 1, GlobalSeqId: null, Keys: [0, 1200].map(Frame => ({ Frame, Vector: new Float32Array([100 + i]) })) };
  });
  const source = doc.serialize('mdx'), before = read(source), fixes = sanityProposals(before).filter(f => f.kind === 'gravity');
  assert.equal(fixes.length, 2);
  const values = [-400, -200], batch = { kind: 'batch', stage: 'sanity', entries: fixes.map((fix, i) => ({ fix, settings: { gravity: values[i] } })) };
  const single = read(runOptimizeStage(source, 'sanity', { gravity: -400 }, fixes[0]).bytes);
  assert.equal(single.ParticleEmitters2[0].Gravity, -400); assert.deepEqual(single.ParticleEmitters2[1], before.ParticleEmitters2[1]);
  const after = read(runOptimizeStage(source, 'sanity', { gravity: 999 }, batch).bytes);
  assert.deepEqual(after.ParticleEmitters2.map(e => e.Gravity), values);
  after.ParticleEmitters2.forEach((e, i) => { e.Gravity = structuredClone(before.ParticleEmitters2[i].Gravity); e._MdxDefaults = structuredClone(before.ParticleEmitters2[i]._MdxDefaults); }); assert.deepEqual(after, before);
});
