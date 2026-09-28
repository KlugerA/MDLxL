// Private model paths are supplied locally; the repository keeps hashes only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDocument } from '../src/editor-document.js';
import { findIrregularities, sanityProposals, runOptimizeStage, simpleSettings } from '../src/optimizexl.js';
import { prepareNuclearReduction } from '../src/optimizexl-geometry.js';
await prepareNuclearReduction();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const baselinePath = new URL('./fixtures/optimizexl-flail-baseline.json', import.meta.url);
const capture = process.argv.includes('--capture');
const paths = process.argv.slice(2).filter(p => p !== '--capture');
if (!paths.length) throw Error('Supply the reviewed Flail model paths.');
const reports = [];
for (const path of paths) {
  const source = new Uint8Array(fs.readFileSync(path)), model = openDocument(source, 'input.mdx').model;
  const results = {}, put = (name, bytes) => results[name] = { bytes: bytes.length, sha256: hash(bytes) };
  for (const stage of ['duplicates', 'animation', 'unused', 'nuclear']) for (const strength of [0, 40, 100]) {
    const settings = simpleSettings(stage, strength, model);
    put(`${stage}:${strength}`, runOptimizeStage(source, stage, settings).bytes);
    if (strength === 100) put(`${stage}:excluded`, runOptimizeStage(source, stage, { ...settings, excludedGeosets: [0, 1] }).bytes);
  }
  for (const stage of ['sanity', 'irregularities']) {
    const findings = stage === 'sanity' ? sanityProposals(model) : findIrregularities(model);
    results[`${stage}:findings`] = findings.map(f => f.id);
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
  reports.push({ model: path.split(/[\\/]/).at(-1), source: hash(source), results });
}
if (capture) {
  if (fs.existsSync(baselinePath)) throw Error('The accepted baseline already exists; do not replace it.');
  fs.writeFileSync(baselinePath, JSON.stringify({ acceptedCommit: 'c6dc15ce0253355f6ef212d18c99157d48e80d37', models: reports }, null, 2) + '\n');
} else {
  const baseline = JSON.parse(fs.readFileSync(baselinePath));
  for (const report of reports) {
    const expected = baseline.models.find(m => m.source === report.source);
    assert.ok(expected, 'Supply the unchanged accepted Flail fixture');
    assert.deepEqual(report.results, expected.results, report.model + ': preserve all accepted optimization/repair bytes');
  }
}
console.log(JSON.stringify({ captured: capture, models: reports.map(m => ({ model: m.model, checkedResults: Object.keys(m.results).length, unchanged: true })) }));
