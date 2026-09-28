// Optional supplied-model integration test. No input file is overwritten.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { ModelRenderer } from 'war3-model';
import { openDocument } from '../src/editor-document.js';
import { sanityProposals, runOptimizeStage } from '../src/optimizexl.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js', import.meta.url), 'utf8'));
const reports = [];
const sanity = bytes => { const model = new ModelViewer.parsers.mdlx.Model(); model.load(bytes.buffer); return ModelViewer.utils.mdlx.sanityTest(model); };
for (const path of process.argv.slice(2)) {
  const source = new Uint8Array(fs.readFileSync(path)), before = openDocument(source, 'before.mdx').model;
  const fixes = sanityProposals(before).filter(f => f.kind === 'openingTrack');
  assert.equal(fixes.length, 1); const fix = fixes[0];
  const result = runOptimizeStage(source, 'sanity', {}, fix), after = openDocument(result.bytes, 'after.mdx').model;
  const originalHive = sanity(source), repairedHive = sanity(result.bytes);
  assert.equal(originalHive.severe, 1); assert.equal(repairedHive.errors + repairedHive.severe + repairedHive.warnings, 0);
  assert.equal(repairedHive.unused, 3, 'Unused notices remain intact; this repair does not remove their keys');
  const resolve = (m, p) => p.reduce((v, k) => v[k], m), originalTrack = resolve(before, fix.path), afterTrack = resolve(after, fix.path);
  const a = new ModelRenderer(structuredClone(before)), b = new ModelRenderer(structuredClone(after));
  let samples = 0, maxError = 0;
  for (const [sequence, animation] of before.Sequences.entries()) {
    a.setSequence(sequence); b.setSequence(sequence);
    for (let frame = animation.Interval[0]; frame <= animation.Interval[1]; frame++) {
      a.setFrame(frame); b.setFrame(frame);
      const p = a.interp.vec3(new Float32Array(3), originalTrack), q = b.interp.vec3(new Float32Array(3), afterTrack);
      if (p === null || q === null) assert.equal(p, q);
      else maxError = Math.max(maxError, Math.hypot(...Array.from(p, (v, i) => v - q[i])));
      samples++;
    }
  }
  assert.ok(maxError < 1e-5, `Particle motion changed by ${maxError}`);
  const retained = afterTrack.Keys.filter(k => k.Frame !== fix.frame);
  assert.equal(retained.length, originalTrack.Keys.length);
  for (const [i, k] of retained.entries()) {
    assert.equal(k.Frame, originalTrack.Keys[i].Frame); assert.deepEqual(k.Vector, originalTrack.Keys[i].Vector);
    assert.deepEqual(k.OutTan, originalTrack.Keys[i].OutTan);
    if (k.Frame !== 170682) assert.deepEqual(k.InTan, originalTrack.Keys[i].InTan);
  }
  const parent = resolve(after, fix.path.slice(0, -1)); parent[fix.path.at(-1)] = structuredClone(originalTrack);
  assert.deepEqual(after, before, 'The entire model apart from this track must remain unchanged');
  assert.deepEqual(new Uint8Array(fs.readFileSync(path)), source);
  reports.push({ file: path.split(/[\\/]/).at(-1), sourceBytes: source.length, afterBytes: result.bytes.length, animation: before.Sequences[fix.sequence].Name,
    frame: fix.frame, nativeSamples: samples, maxParticlePositionError: maxError,
    hive: { errors: repairedHive.errors, severe: repairedHive.severe, warnings: repairedHive.warnings, unused: repairedHive.unused },
    otherDataAndUnusedRecordsPreserved: true, sourceUnchanged: true });
}
console.log(JSON.stringify(reports, null, 2));
