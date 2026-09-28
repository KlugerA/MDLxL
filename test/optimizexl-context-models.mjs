// Supplied repaired models are test oracles only. Runtime detection uses one model.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { openDocument } from '../src/editor-document.js';
import { findIrregularities, runOptimizeStage } from '../src/optimizexl.js';
import { scanIrregularMotion } from '../src/optimizexl-motion.js';
import { scanSuspiciousSnaps } from '../src/optimizexl-snaps.js';
import { scanModelMotionContext } from '../src/optimizexl-motion-context.js';

const paths = process.argv.slice(2);
if (paths.length < 4) throw Error('Supply unoptimized Footman, good Footman, and both flail regression fixtures.');
const inputs = paths.map(p => new Uint8Array(fs.readFileSync(p)));
const models = inputs.map(bytes => openDocument(bytes, 'fixture.mdx').model);
const reports = [];
for (const [index, model] of models.entries()) {
  const before = structuredClone(model), motion = scanIrregularMotion(model), existing = [...motion, ...scanSuspiciousSnaps(model, motion)];
  const context = scanModelMotionContext(model, existing), all = findIrregularities(model);
  assert.deepEqual(model, before, 'Analysis must not mutate the input model');
  for (const original of existing) {
    const { motionContext, ...retained } = all.find(f => f.id === original.id) || {};
    assert.deepEqual(retained, original, 'Context must retain each established finding and its exact repair plan');
  }
  if (index === 0) {
    assert.deepEqual(context.findings.map(f => f.id), ['context:5:25:Translation', 'context:8:25:Translation']);
    assert.equal(context.review.get('motion:3:25:Translation').level, 'red');
    assert.equal(context.review.get('motion:3:25:Translation').scope, 'Whole body');
    assert.equal(context.review.get('motion:3:25:Translation').sequenceCount, 11);
    assert.equal(context.review.get('motion:4:37:Translation').level, 'orange');
    assert.equal(context.review.get('motion:4:37:Translation').scope, 'Localized part');
    for (const finding of context.findings) {
      assert.equal(finding.inspectionOnly, true, 'A sharp return may be the intended pose; these anchors do not support flattening it');
      assert.equal(finding.motionContext.level, 'red');
      assert.throws(() => runOptimizeStage(inputs[0], 'irregularities', {}, finding), /needs inspection/);
    }
  } else assert.equal(context.findings.length, 0, 'Known-good models must not gain new context findings');
  reports.push({ model: paths[index].split(/[\\/]/).at(-1), establishedPlansPreserved: existing.length,
    additionalFindings: context.findings.map(f => ({ animation: model.Sequences[f.sequence].Name, level: f.motionContext.level, inspectionOnly: f.inspectionOnly })) });
}
for (const [i, path] of paths.entries()) assert.deepEqual(new Uint8Array(fs.readFileSync(path)), inputs[i]);
console.log(JSON.stringify({ reports, inputsUnchanged: true }, null, 2));
