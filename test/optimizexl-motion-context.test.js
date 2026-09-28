import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { createStarterDocument } from '../src/starter-model.js';
import { createNode, openDocument } from '../src/editor-document.js';
import { sampleTrack } from '../src/animation.js';
import { scanModelMotionContext } from '../src/optimizexl-motion-context.js';
import { findIrregularities, runOptimizeStage } from '../src/optimizexl.js';

function fixture({ scope = 'body', irregular = false, property = 'Translation', sequences = 3, coordinated = false, ambiguous = false } = {}) {
  const doc = createStarterDocument();
  doc.apply('Model-wide context fixture', ['Info', 'Sequences', 'Bones', 'Geosets', 'PivotPoints'], m => {
    m.Sequences = Array.from({ length: sequences }, (_, i) => ({ Name: `Unknown action ${i}`, Interval: new Uint32Array([i * 2000, i * 2000 + 1800]),
      BoundsRadius: 60, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), MoveSpeed: 0, NonLooping: false, Rarity: 0 }));
    const drivers = scope === 'body' ? [m.Bones[0]] : [createNode(m, 'Bone')];
    if (scope === 'parts') drivers.push(createNode(m, 'Bone'));
    if (scope !== 'body') {
      drivers.forEach(n => { n.Parent = 0; });
      m.Geosets[0].Groups = [[0], ...drivers.map(n => [n.ObjectId])]; m.Geosets[0].TotalGroupsCount = m.Geosets[0].Groups.length;
      m.Geosets[0].VertexGroup = new Uint8Array(scope === 'parts' ? [1, 1, 1, 2, 2, 2, 0, 0] : [1, 0, 0, 0, 0, 0, 0, 0]);
    }
    drivers.forEach((node, driver) => {
      const vector = v => property === 'Rotation' ? new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), v * Math.PI / 180).toArray() : property === 'Scaling' ? [1, 1, 1 + v] : [v, 0, 0];
      const keys = [];
      for (let si = 0; si < sequences; si++) {
        const offset = si * 2000, times = [[0, 0], [150, 0]];
        [350, 700, 1100, 1500].forEach((center, i) => {
          const half = irregular ? [25, 65, 35, 20][i] : 40, shift = driver && !coordinated ? 85 : 0;
          let amplitude = irregular ? [.2, 1.7, .4, 2.5][i] : .35;
          if (property === 'Rotation') amplitude *= 20;
          if (property === 'Scaling') amplitude *= .4;
          times.push([center + shift - half, ambiguous ? .5 : 0], [center + shift, -amplitude], [center + shift + half, ambiguous ? 1 : 0]);
        });
        times.push([1750, 0], [1800, 0]);
        keys.push(...times.sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ Frame: offset + t, Vector: new Float32Array(vector(v)) })));
      }
      node[property] = { LineType: 1, GlobalSeqId: null, Keys: keys };
    });
  });
  return doc;
}

for (const property of ['Translation', 'Rotation', 'Scaling']) test(`repeated whole-body ${property} is orange and removable only between supported holds`, () => {
  const doc = fixture({ property }), source = doc.serialize('mdx'), model = openDocument(source, 'source.mdx').model;
  const scan = scanModelMotionContext(model), findings = scan.findings;
  assert.equal(findings.length, 3); assert.ok(findings.every(f => f.motionContext.level === 'orange' && f.motionContext.sequenceCount === 3 && !f.inspectionOnly));
  const first = findings[0], after = openDocument(runOptimizeStage(source, 'irregularities', {}, first).bytes, 'after.mdx').model;
  for (const span of first.bridges) for (let t = span.start; t <= span.end; t++) {
    const v = sampleTrack(after.Bones[0][property], t, { interval: after.Sequences[0].Interval, quaternion: property === 'Rotation', fallback: property === 'Rotation' ? [0, 0, 0, 1] : [0, 0, 0] });
    const expected = property === 'Rotation' ? [0, 0, 0, 1] : property === 'Scaling' ? [1, 1, 1] : [0, 0, 0];
    assert.ok(Math.hypot(...v.map((x, i) => x - expected[i])) < 1e-6);
  }
  assert.deepEqual(after.Bones[0][property].Keys.filter(k => k.Frame >= 2000), model.Bones[0][property].Keys.filter(k => k.Frame >= 2000));
  after.Bones[0][property] = structuredClone(model.Bones[0][property]); assert.deepEqual(after, model);
});

test('a small repeating mechanism gets no additional context warning', () => {
  const doc = fixture({ scope: 'local' }), before = doc.serialize('mdx');
  assert.deepEqual(scanModelMotionContext(doc.model).findings, []); assert.deepEqual(doc.serialize('mdx'), before);
});

test('irregular timing/amplitude across the body is red and independent jerking parts are identified', () => {
  for (const scope of ['body', 'parts']) {
    const findings = scanModelMotionContext(fixture({ scope, irregular: true }).model).findings;
    assert.ok(findings.length); assert.ok(findings.every(f => f.motionContext.level === 'red' && f.motionContext.erratic));
    if (scope === 'parts') assert.ok(findings.some(f => f.motionContext.disconnected && f.motionContext.scope === 'Independent body parts'));
  }
});

test('coordinated limbs in one action do not become unconnected-body warnings', () => {
  assert.deepEqual(scanModelMotionContext(fixture({ scope: 'parts', irregular: true, sequences: 1, coordinated: true }).model).findings, []);
});

test('equal-size jitters with unrelated directions are red; alternating directions can repeat normally', () => {
  const random = fixture(), periodic = fixture();
  const directions = [[1,0,0], [0,1,0], [-1,0,0], [0,0,1], [0,-1,0], [1,0,0], [0,0,-1], [0,1,0], [0,-1,0], [-1,0,0], [0,0,1], [0,0,-1]];
  for (const [doc, irregular] of [[random, true], [periodic, false]]) doc.apply('Direction patterns', ['Bones'], m => {
    let index = 0;
    for (const k of m.Bones[0].Translation.Keys) if (Math.abs(k.Vector[0]) > .1) {
      k.Vector = new Float32Array(irregular ? directions[index].map(v => v * .35) : [index % 2 ? -.35 : .35, 0, 0]); index++;
    }
  });
  assert.ok(scanModelMotionContext(random.model).findings.every(f => f.motionContext.level === 'red'));
  assert.ok(scanModelMotionContext(periodic.model).findings.every(f => f.motionContext.level === 'orange'));
});

test('an uncertain returning pose is inspection-only and cannot erase intended movement', () => {
  const doc = fixture({ ambiguous: true }), source = doc.serialize('mdx'), findings = findIrregularities(doc.model).filter(f => f.kind === 'motionContext');
  assert.ok(findings.length); assert.ok(findings.every(f => f.inspectionOnly));
  assert.throws(() => runOptimizeStage(source, 'irregularities', {}, findings[0]), /needs inspection/);
  assert.deepEqual(doc.serialize('mdx'), source);
});

test('context annotates established plans without changing or removing them', () => {
  const doc = fixture({ irregular: true }), base = { id: 'established', kind: 'motion', sequence: 0, nodeId: 0, property: 'Translation', bridges: [{ start: 100, end: 200, axis: 0 }], segments: [] };
  const snapshot = structuredClone(base), analysis = scanModelMotionContext(doc.model, [base]);
  assert.equal(analysis.review.get(base.id).level, 'red'); assert.deepEqual(base, snapshot);
});

test('smooth cycles, global tracks, stepped tracks, hidden meshes and overlapping intervals stay quiet', () => {
  for (const mode of ['smooth', 'global', 'step', 'hidden', 'overlap']) {
    const m = structuredClone(fixture().model), t = m.Bones[0].Translation;
    if (mode === 'smooth') t.Keys = m.Sequences.flatMap(s => Array.from({ length: 37 }, (_, i) => ({ Frame: s.Interval[0] + i * 50, Vector: new Float32Array([Math.sin(i * Math.PI / 18), 0, 0]) })));
    if (mode === 'global') { t.GlobalSeqId = 0; m.GlobalSequences = [2000]; }
    if (mode === 'step') t.LineType = 0;
    if (mode === 'hidden') m.GeosetAnims = [{ GeosetId: 0, Alpha: 0, Flags: 0 }];
    if (mode === 'overlap') m.Sequences.forEach(s => { s.Interval = new Uint32Array([0, 6000]); });
    assert.deepEqual(scanModelMotionContext(m).findings, [], mode);
  }
});

test('changing a pose after analysis invalidates the contextual correction', () => {
  const doc = fixture(), fix = scanModelMotionContext(doc.model).findings[0];
  doc.apply('Edited the motion', ['Bones'], m => { m.Bones[0].Translation.Keys[3].Vector[0] = -7; });
  assert.throws(() => runOptimizeStage(doc.serialize('mdx'), 'irregularities', {}, fix), /changed/);
});
