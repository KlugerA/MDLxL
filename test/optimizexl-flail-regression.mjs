// Private model paths are supplied locally; the repository keeps hashes only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDocument } from '../src/editor-document.js';
import { assertRoundTripFields } from '../src/model-optimizer.js';
import { findIrregularities, sanityProposals, runOptimizeStage, simpleSettings } from '../src/optimizexl.js';
import { prepareNuclearReduction } from '../src/optimizexl-geometry.js';
await prepareNuclearReduction();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const baselinePath = new URL('./fixtures/optimizexl-flail-baseline.json', import.meta.url);
const capture = process.argv.includes('--capture');
const baseline = capture ? null : JSON.parse(fs.readFileSync(baselinePath));
const motionEvidence = JSON.parse(fs.readFileSync(new URL('./fixtures/optimizexl-flail-retained-frames.json', import.meta.url)));
const paths = process.argv.slice(2).filter(p => p !== '--capture');
if (!paths.length) throw Error('Supply the reviewed Flail model paths.');
const reports = [];
for (const path of paths) {
  const source = new Uint8Array(fs.readFileSync(path)), model = openDocument(source, 'input.mdx').model;
  const expected = baseline?.models.find(m => m.source === hash(source));
  if (!capture) assert.ok(expected, 'Supply the unchanged accepted Flail fixture');
  const additionalRepairs = [];
  const results = {}, comparison = {}, preservedMotion = [];
  const put = (name, bytes) => {
    results[name] = comparison[name] = { bytes: bytes.length, sha256: hash(bytes) };
    if (capture || results[name].sha256 === expected.results[name]?.sha256) return;
    if(name==='mounted-spheres'&&process.env.MDLXL_FLAIL_MOUNTED_REFERENCE){
      // Keep the original golden hash. A historical reference must reproduce
      // it exactly before allowing the serializer's atomic ID permutation.
      const reference=new Uint8Array(fs.readFileSync(process.env.MDLXL_FLAIL_MOUNTED_REFERENCE));
      assert.equal(hash(reference),expected.results[name].sha256);
      assertRoundTripFields(openDocument(reference,'historical.mdx').model,openDocument(bytes,'current.mdx').model);
      comparison[name]={bytes:reference.length,sha256:hash(reference)};
      return;
    }
    const paths = motionEvidence.models.find(m => m.source === hash(source))?.cases[name];
    if (!paths) return; // Unrelated outputs still require their original hash.
    const projection = openDocument(bytes, 'projection.mdx'); let restored = 0;
    projection.apply('Verify approved motion retention', [...new Set(Object.keys(paths).map(p => p.split('.')[0]))], m => {
      for (const [path, frames] of Object.entries(paths)) {
        const [collection, index, property] = path.split('.');
        assert.ok(['Translation','Rotation','Scaling'].includes(property));
        const node = m[collection][index], originals = model[collection].filter(n => n.Name === node.Name);
        assert.equal(originals.length, 1, 'Unambiguous private-fixture source node');
        const removedBefore = new Set(frames), track = node[property];
        for (const key of track.Keys.filter(k => removedBefore.has(k.Frame))) {
          assert.deepEqual(key, originals[0][property].Keys.find(k => k.Frame === key.Frame), 'Restored values and controls must be authored input data');
          restored++;
        }
        track.Keys = track.Keys.filter(k => !removedBefore.has(k.Frame));
      }
    });
    const oldBytes = projection.serialize('mdx');
    comparison[name] = { bytes: oldBytes.length, sha256: hash(oldBytes) };
    assert.deepEqual(comparison[name], expected.results[name], 'Removing only restored authored keys must reproduce the unchanged accepted hash');
    assert.ok(restored > 0);
    preservedMotion.push({ operation: name, restoredKeys: restored, extraBytes: bytes.length - oldBytes.length });
  };
  for (const stage of ['duplicates', 'animation', 'unused', 'nuclear']) for (const strength of [0, 40, 100]) {
    const settings = simpleSettings(stage, strength, model);
    put(`${stage}:${strength}`, runOptimizeStage(source, stage, settings).bytes);
    if (strength === 100) put(`${stage}:excluded`, runOptimizeStage(source, stage, { ...settings, excludedGeosets: [0, 1] }).bytes);
  }
  for (const stage of ['sanity', 'irregularities']) {
    const available = stage === 'sanity' ? sanityProposals(model) : findIrregularities(model);
    const acceptedIds = expected?.results[`${stage}:findings`];
    // Keep the immutable accepted outputs as the regression contract. The new
    // explicitly added repairs are additional capacity, checked separately.
    const added = capture ? [] : available.filter(f => !acceptedIds.includes(f.id));
    for (const fix of added) {
      assert.ok(stage === 'sanity' ? ['openingTrack','unusedLocalKeys','redundantTracks','splineResample'].includes(fix.kind) : fix.kind === 'effectVisibility', 'Only explicitly added repair capabilities may extend this baseline');
      if(fix.inspectionOnly){additionalRepairs.push({id:fix.id,inspectionOnly:true});continue;}
      const repaired = runOptimizeStage(source, stage, {}, fix);
      const repairedModel = openDocument(repaired.bytes, 'repaired.mdx').model;
      assert.ok(!(stage === 'sanity' ? sanityProposals(repairedModel) : findIrregularities(repairedModel)).some(f => f.id === fix.id), 'Additional repair resolves its finding');
      additionalRepairs.push({ id: fix.id, bytes: repaired.bytes.length, sha256: hash(repaired.bytes) });
    }
    const findings = capture ? available : available.filter(f => acceptedIds.includes(f.id));
    if (!capture) assert.deepEqual(findings.map(f => f.id), acceptedIds, 'Every accepted finding remains available in its original order');
    results[`${stage}:findings`] = findings.map(f => f.id);
    comparison[`${stage}:findings`] = results[`${stage}:findings`];
    for (const f of findings) put(`${stage}:${f.id}`, runOptimizeStage(source, stage, {}, f).bytes);
    let bytes = source;
    for (const f of findings) {
      const current = openDocument(bytes, 'current.mdx').model;
      const next = (stage === 'sanity' ? sanityProposals(current) : findIrregularities(current)).find(p => p.id === f.id);
      if (next) bytes = runOptimizeStage(bytes, stage, {}, next).bytes;
    }
    put(`${stage}:all`, bytes);
    if (!capture && findings.length) assert.deepEqual(runOptimizeStage(source, stage, {}, { kind: 'batch', stage, entries: findings.map(fix => ({ fix, settings: {} })) }).bytes, bytes, 'Selected fixes preserve the existing individual repair result');
  }
  for (const strength of [0, 40, 100]) {
    let bytes = source;
    for (const stage of ['duplicates', 'animation', 'unused']) bytes = runOptimizeStage(bytes, stage, simpleSettings(stage, strength, openDocument(bytes, 'current.mdx').model)).bytes;
    put(`pipeline:${strength}`, bytes);
  }
  put('mounted-spheres', runOptimizeStage(source, 'spheres', { preset: 4, size: 1 }).bytes);
  assert.deepEqual(new Uint8Array(fs.readFileSync(path)), source);
  reports.push({ model: path.split(/[\\/]/).at(-1), source: hash(source), results, comparison, additionalRepairs, preservedMotion });
}
if (capture) {
  if (fs.existsSync(baselinePath)) throw Error('The accepted baseline already exists; do not replace it.');
  fs.writeFileSync(baselinePath, JSON.stringify({ acceptedCommit: 'c6dc15ce0253355f6ef212d18c99157d48e80d37', models: reports }, null, 2) + '\n');
} else {
  for (const report of reports) {
    const expected = baseline.models.find(m => m.source === report.source);
    assert.ok(expected, 'Supply the unchanged accepted Flail fixture');
    assert.deepEqual(report.comparison, expected.results, report.model + ': preserve all accepted bytes except explicitly verified authored-key retention');
  }
}
console.log(JSON.stringify({ captured: capture, models: reports.map(m => ({ model: m.model, checkedResults: Object.keys(m.results).length, unchangedExceptAuthoredKeyRetention: true, preservedMotion: m.preservedMotion, additionalRepairs: m.additionalRepairs })) }));
