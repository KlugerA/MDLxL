// The repaired model is an oracle for tests only, never an input to the algorithm.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ModelRenderer } from 'war3-model';
import { openDocument } from '../src/editor-document.js';
import { findIrregularities, runOptimizeStage, simpleSettings } from '../src/optimizexl.js';
import { scanSuspiciousSnaps } from '../src/optimizexl-snaps.js';
const paths = process.argv.slice(2);
if (paths.length < 2) throw Error('Supply unoptimized and original Footman paths, then known-good flails.');
const inputs = paths.map(p => new Uint8Array(fs.readFileSync(p))), models = inputs.map(b => openDocument(b, 'model.mdx').model);
const [model, original] = models, findings = findIrregularities(model), reports = [];
for (const knownGood of models.slice(1)) assert.deepEqual(scanSuspiciousSnaps(knownGood), [], 'Good models must not gain speculative snap warnings');
const expectedSnaps = findings.filter(f => f.kind === 'snap').map(f => f.id);
assert.ok(expectedSnaps.length);
const legacy = { kind: 'batch', stage: 'irregularities', entries: findings.filter(f => f.kind === 'motion').map(fix => ({ fix, settings: {} })) };
const legacyResult = runOptimizeStage(inputs[0], 'irregularities', {}, legacy).bytes;
assert.deepEqual(findIrregularities(openDocument(legacyResult, 'previously-repaired.mdx').model).filter(f => f.kind === 'snap').map(f => f.id), expectedSnaps, 'New detection also upgrades previously approved motion repairs');
for (const strength of [0, 100]) {
  let bytes = inputs[0];
  for (const stage of ['duplicates', 'animation', 'unused']) bytes = runOptimizeStage(bytes, stage, simpleSettings(stage, strength, openDocument(bytes, 'stage.mdx').model)).bytes;
  assert.deepEqual(findIrregularities(openDocument(bytes, 'optimized.mdx').model).filter(f => f.kind === 'snap').map(f => f.id), expectedSnaps, 'Optimization must not conceal these suspicious movements');
}
for (const name of ['Stand - 4', 'Stand Defend']) {
  const sequence = model.Sequences.findIndex(s => s.Name === name), referenceSequence = original.Sequences.findIndex(s => s.Name === name);
  const fixes = findings.filter(f => f.sequence === sequence && ['motion', 'snap'].includes(f.kind));
  assert.ok(fixes.some(f => f.kind === 'snap'));
  const batch = { kind: 'batch', stage: 'irregularities', entries: fixes.map(fix => ({ fix, settings: {} })) };
  const after = openDocument(runOptimizeStage(inputs[0], 'irregularities', {}, batch).bytes, 'after.mdx').model;
  const a = new ModelRenderer(structuredClone(after)), r = new ModelRenderer(structuredClone(original)); a.setSequence(sequence); r.setSequence(referenceSequence);
  const ranges = name === 'Stand - 4' ? [[7500, 9467], [10767, 11867]] : [model.Sequences[sequence].Interval];
  let maxError = 0, samples = 0;
  for (const [start, end] of ranges) for (let frame = start; frame <= end; frame++) {
    a.setFrame(frame); r.setFrame(frame);
    const p = a.interp.vec3(new Float32Array(3), after.Nodes[25].Translation), q = r.interp.vec3(new Float32Array(3), original.Nodes[25].Translation);
    maxError = Math.max(maxError, Math.hypot(...p.map((v, i) => v - q[i]))); samples++;
  }
  assert.ok(maxError < 1e-5, `${name}: residual body offset ${maxError}`);
  // Keep the genuine crouch poses that lie between the static windows.
  if (name === 'Stand - 4') for (const time of [10267, 10500, 10767]) assert.deepEqual(after.Nodes[25].Translation.Keys.find(k => k.Frame === time).Vector, model.Nodes[25].Translation.Keys.find(k => k.Frame === time).Vector);
  const track = after.Nodes[25].Translation;
  assert.deepEqual(track.Keys.filter(k => k.Frame < model.Sequences[sequence].Interval[0] || k.Frame > model.Sequences[sequence].Interval[1]), model.Nodes[25].Translation.Keys.filter(k => k.Frame < model.Sequences[sequence].Interval[0] || k.Frame > model.Sequences[sequence].Interval[1]));
  after.Nodes[25].Translation = structuredClone(model.Nodes[25].Translation); assert.deepEqual(after, model, 'No other bone, channel, sequence or model data changes');
  reports.push({ animation: name, nativeSamples: samples, maxRootPositionErrorAgainstGoodVersion: maxError, preservedOtherMotion: true });
}
for (let i = 0; i < paths.length; i++) assert.deepEqual(new Uint8Array(fs.readFileSync(paths[i])), inputs[i]);
if (process.env.MDLXL_SNAPS_REPORT) fs.writeFileSync(process.env.MDLXL_SNAPS_REPORT, JSON.stringify(reports, null, 2));
console.log(JSON.stringify({ reports, newFindingsInGoodModels: 0, detectsAfterPriorRepairsAndOptimization: true, inputsUnchanged: true }, null, 2));
