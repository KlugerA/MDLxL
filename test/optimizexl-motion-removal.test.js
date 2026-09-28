import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument } from '../src/editor-document.js';
import { sampleTrack } from '../src/animation.js';
import { scanIrregularMotion } from '../src/optimizexl-motion.js';
import { runOptimizeStage } from '../src/optimizexl.js';

function fixture(property, times, values, type = 1) {
  const doc = createStarterDocument();
  doc.apply('Motion fixture', ['Info', 'Sequences', 'Bones'], m => {
    m.Info.BoundsRadius = 100;
    const sequence = (name, start, end) => ({ Name: name, Interval: new Uint32Array([start, end]), MoveSpeed: 0, NonLooping: false, Rarity: 0,
      BoundsRadius: 100, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3) });
    m.Sequences = [sequence('Unfamiliar motion A', 0, 1200), sequence('Reference B', 2000, 3200)];
    const vector = v => property === 'Rotation' ? new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), v * Math.PI / 180).toArray()
      : property === 'Scaling' ? [1, 1, v] : Array.isArray(v) ? v : [0, 0, v];
    const baseline = property === 'Scaling' ? [1, 1.01, 1.02] : [0, 1, 2];
    const keys = [...times.map((Frame, i) => ({ Frame, Vector: new Float32Array(vector(values[i])) })),
      ...baseline.map((v, i) => ({ Frame: 2000 + 600 * i, Vector: new Float32Array(vector(v)) }))];
    if (type >= 2) for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      k.InTan = new Float32Array(k.Vector); k.OutTan = new Float32Array(k.Vector);
      if (property !== 'Rotation') for (let axis = 0; axis < 3; axis++) {
        const a = keys[i - 1] || k, b = keys[i + 1] || k;
        k.InTan[axis] = type === 2 ? k.Vector[axis] - a.Vector[axis] : k.Vector[axis] - (k.Vector[axis] - a.Vector[axis]) / 3;
        k.OutTan[axis] = type === 2 ? b.Vector[axis] - k.Vector[axis] : k.Vector[axis] + (b.Vector[axis] - k.Vector[axis]) / 3;
      }
    }
    m.Bones[0][property] = { LineType: type, GlobalSeqId: null, Keys: keys };
  });
  return doc.serialize('mdx');
}
const read = bytes => openDocument(bytes, 'fixture.mdx').model;
const sample = (model, property, frame) => sampleTrack(model.Bones[0][property], frame, {
  interval: model.Sequences[frame < 2000 ? 0 : 1].Interval, quaternion: property === 'Rotation', fallback: property === 'Rotation' ? [0, 0, 0, 1] : [0, 0, 0],
});

test('remove a small rate hitch only with copied-control corruption and an independently supported rate', () => {
  const times = [0, 300, 650, 700, 1000, 1200];
  const doc = openDocument(fixture('Translation', times, [-5, -5.9, -7.04, -7.1, -6.2, -5.6], 2), 'hitch.mdx');
  doc.apply('Corrupted other intervals', ['Bones'], m => {
    const t = m.Bones[0].Translation;
    t.Keys = t.Keys.filter(k => k.Frame < 2000);
    for (let i = 0; i < 7; i++) {
      const Vector = new Float32Array([0, 0, -10 * (i + 1)]);
      t.Keys.push({ Frame: 2000 + i * 200, Vector, InTan: new Float32Array(Vector), OutTan: new Float32Array(Vector) });
    }
  });
  const before = doc.model, fix = scanIrregularMotion(before).find(f => f.sequence === 0);
  assert.deepEqual(fix.bridges, [{ start: 300, end: 700, axis: 2 }]);
  const after = read(runOptimizeStage(doc.serialize('mdx'), 'irregularities', {}, fix).bytes);
  const keys = after.Bones[0].Translation.Keys;
  assert.ok(Math.abs(keys.find(k => k.Frame === 650).Vector[2] + 6.95) < 1e-6);
  for (let t = 300; t < 700; t++) assert.ok(Math.abs((sample(after, 'Translation', t + 1)[2] - sample(after, 'Translation', t)[2]) * 1000 + 3) < .002);
  assert.deepEqual(scanIrregularMotion(after).filter(f => f.sequence === 0), []);
  const noSupport = structuredClone(before);noSupport.Bones[0].Translation.Keys[0].Vector[2] = -4;
  assert.deepEqual(scanIrregularMotion(noSupport).filter(f => f.sequence === 0), [], 'No independent rate support means no speculative smoothing');
  const noCorruption = structuredClone(before);noCorruption.Bones[0].Translation.LineType = 1;
  assert.deepEqual(scanIrregularMotion(noCorruption).filter(f => f.sequence === 0), [], 'An ordinary small speed change is not a warning');
});

for (const type of [1, 2, 3]) test(`replace a stray position completely and preserve independent axes (${type})`, () => {
  const times = [0, 300, 500, 533, 566, 900, 1200];
  const bytes = fixture('Translation', times, times.map(t => [t / 100, Math.sin(t / 300), t === 533 ? 30 : 0]), type);
  const before = read(bytes), fix = scanIrregularMotion(before).find(f => f.sequence === 0), source = structuredClone(before);
  assert.ok(fix); assert.deepEqual(fix.bridges, [{ start: 500, end: 566, axis: 2 }]);
  const after = read(runOptimizeStage(bytes, 'irregularities', {}, fix).bytes);
  for (let t = 0; t <= 1200; t++) {
    const a = sample(before, 'Translation', t), b = sample(after, 'Translation', t);
    assert.ok(Math.abs(b[2]) < 1e-6, `The spike must be absent, not merely smaller at ${t}`);
    assert.ok(Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6);
  }
  assert.deepEqual(scanIrregularMotion(after), []);
  assert.deepEqual(after.Bones[0].Translation.Keys.filter(k => k.Frame < 500 || k.Frame > 566), before.Bones[0].Translation.Keys.filter(k => k.Frame < 500 || k.Frame > 566));
  assert.deepEqual(before, source);
});

test('detect a repeated whole-body jitter and preserve its underlying drift', () => {
  const times = [0, 300, 400, 450, 500, 550, 600, 650, 700, 900, 1200];
  const bytes = fixture('Translation', times, times.map((t, i) => [t / 100, 0, i >= 2 && i <= 8 ? (i % 2 ? 1 : -1) : 0]));
  const before = read(bytes), fix = scanIrregularMotion(before).find(f => f.sequence === 0);
  assert.ok(fix.wholeBody); assert.ok(fix.bridges.length);
  const after = read(runOptimizeStage(bytes, 'irregularities', {}, fix).bytes);
  for (const span of fix.bridges) for (let t = span.start; t <= span.end; t++) {
    const a = sample(after, 'Translation', span.start), b = sample(after, 'Translation', span.end), actual = sample(after, 'Translation', t);
    assert.ok(Math.abs(actual[2] - (a[2] + (b[2] - a[2]) * (t - span.start) / (span.end - span.start))) < 1e-6);
    assert.ok(Math.abs(actual[0] - t / 100) < 1e-6);
  }
  assert.deepEqual(scanIrregularMotion(after), []);
  for (let t = 0; t <= 1200; t++) assert.ok(Math.abs(sample(after, 'Translation', t)[2]) < 1e-6, 'No residual jitter offset');
});

for (const property of ['Rotation', 'Scaling']) test(`remove ${property.toLowerCase()} jitter without changing other channels`, () => {
  const times = [0, 300, 500, 533, 566, 900, 1200], base = property === 'Scaling' ? 1 : 0;
  const bytes = fixture(property, times, times.map(t => t === 533 ? (property === 'Scaling' ? 4 : 90) : base), 2);
  const before = read(bytes), fix = scanIrregularMotion(before).find(f => f.sequence === 0);
  assert.ok(fix); const after = read(runOptimizeStage(bytes, 'irregularities', {}, fix).bytes);
  for (let t = 0; t <= 1200; t++) {
    const v = sample(after, property, t);
    if (property === 'Scaling') assert.ok(Math.abs(v[2] - 1) < 1e-6);
    else assert.ok(new Quaternion().fromArray(v).angleTo(new Quaternion()) < 1e-6);
  }
  const restored = structuredClone(after); restored.Bones[0][property] = structuredClone(before.Bones[0][property]); restored.Nodes[restored.Bones[0].ObjectId][property] = restored.Bones[0][property];
  assert.deepEqual(restored, before); assert.deepEqual(scanIrregularMotion(after), []);
});

test('a one-way yank reconnects surrounding poses and leaves their exterior movement intact', () => {
  const bytes = fixture('Translation', [0, 300, 500, 510, 800, 1200], [0, 3, 5, 15, 18, 22]);
  const before = read(bytes), fix = scanIrregularMotion(before).find(f => f.sequence === 0);
  assert.ok(fix?.reasons.includes('sudden yank'));
  const after = read(runOptimizeStage(bytes, 'irregularities', {}, fix).bytes);
  for (let t = 0; t <= 1200; t++) {
    const v = sample(after, 'Translation', t)[2];
    if (t <= 300 || t >= 800) assert.ok(Math.abs(v - sample(before, 'Translation', t)[2]) < 1e-6);
    else assert.ok(Math.abs(v - (3 + (t - 300) * .03)) < 1e-6);
  }
  assert.deepEqual(scanIrregularMotion(after), []);
});

test('other animations supply speed context; normal fast actions are not removed just because idles are slower', () => {
  const bytes = fixture('Translation', [0, 300, 500, 533, 566, 900, 1200], [0, 0, 0, 10, 0, 0, 0]);
  const m = read(bytes), track = m.Bones[0].Translation;
  const before = scanIrregularMotion(m); assert.ok(before.length);
  // Comparable action in a differently named animation is evidence against a
  // model-wide speed outlier, without an attack-name allowlist.
  track.Keys = track.Keys.filter(k => k.Frame < 2000).concat([2000, 2020, 2040, 2060, 3200].map((Frame, i) => ({ Frame, Vector: new Float32Array([0, 0, [0, 10, 20, 30, 30][i]]) })));
  assert.deepEqual(scanIrregularMotion(m).filter(f => f.sequence === 0), []);
});

test('stale values reject a proposal even when its frame numbers are unchanged', () => {
  const bytes = fixture('Translation', [0, 300, 500, 533, 566, 900, 1200], [0, 0, 0, 30, 0, 0, 0]);
  const doc = openDocument(bytes, 'fixture.mdx'), fix = scanIrregularMotion(doc.model)[0];
  doc.apply('Change a source pose', ['Bones'], m => { m.Bones[0].Translation.Keys[3].Vector[2] = 40; });
  assert.throws(() => runOptimizeStage(doc.serialize('mdx'), 'irregularities', {}, fix), /segments changed/);
});

test('repeated angular shaking is removed, while equivalent quaternion signs stay quiet', () => {
  const times = [0, 300, 400, 450, 500, 550, 600, 650, 700, 900, 1200];
  const bytes = fixture('Rotation', times, times.map((t, i) => i >= 2 && i <= 8 ? (i % 2 ? 12 : -12) : 0), 3);
  const before = read(bytes), fix = scanIrregularMotion(before).find(f => f.sequence === 0);
  assert.ok(fix?.wholeBody);
  const after = read(runOptimizeStage(bytes, 'irregularities', {}, fix).bytes);
  for (let t = 0; t <= 1200; t++) assert.ok(new Quaternion().fromArray(sample(after, 'Rotation', t)).angleTo(new Quaternion()) < 1e-6);
  assert.deepEqual(scanIrregularMotion(after), []);
  const equivalent = read(fixture('Rotation', times, times.map((_, i) => i % 2 ? 360 : 0)));
  assert.deepEqual(scanIrregularMotion(equivalent), []);
});

test('automatic repair does not cross overlapping animations or change shared global and stepped tracks', () => {
  const bytes = fixture('Translation', [0, 300, 500, 533, 566, 900, 1200], [0, 0, 0, 30, 0, 0, 0]);
  for (const mode of ['overlap', 'global', 'step']) {
    const m = read(bytes), track = m.Bones[0].Translation;
    if (mode === 'overlap') m.Sequences[1].Interval = new Uint32Array([400, 1800]);
    else if (mode === 'global') { track.GlobalSeqId = 0; m.GlobalSequences = [4000]; }
    else track.LineType = 0;
    const before = structuredClone(m);
    assert.deepEqual(scanIrregularMotion(m), []); assert.deepEqual(m, before);
  }
});
