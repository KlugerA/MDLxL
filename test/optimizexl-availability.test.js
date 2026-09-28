import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { stageAvailability } from '../src/optimizexl-availability.js';
import { runOptimizeStage } from '../src/optimizexl.js';

async function check(bytes, exclusions = []) {
  const result = {};
  for await (const item of stageAvailability(bytes, exclusions)) {
    assert.equal(item.error, undefined);
    result[item.stage] = item.hasChanges;
  }
  return result;
}

test('a clean model has no speculative stars, including protected polygons and existing spheres', async () => {
  const bytes = createStarterDocument().serialize('mdx'), original = new Uint8Array(bytes);
  assert.deepEqual(await check(bytes), { duplicates: false, animation: false, unused: false, sanity: false, irregularities: false, spheres: true, nuclear: false });
  const withSphere = runOptimizeStage(bytes, 'spheres', { size: 1, spheres: [[7, 2, 33, 19]] }).bytes;
  assert.deepEqual(await check(withSphere, [0]), { duplicates: false, animation: false, unused: false, sanity: false, irregularities: false, spheres: false, nuclear: false });
  assert.deepEqual(bytes, original);
});

test('unused work is checked again against the newly accepted bytes', async () => {
  const doc = createStarterDocument();
  doc.apply('Unused texture', ['Textures'], m => m.Textures.push({ Image: 'Unused.blp', ReplaceableId: 0, Flags: 0 }));
  const bytes = doc.serialize('mdx');
  assert.equal((await check(bytes)).unused, true);
  const result = runOptimizeStage(bytes, 'unused', { vertices: true, resources: true, nodes: true });
  assert.ok(result.saved > 0);
  assert.equal((await check(result.bytes)).unused, false);
});
