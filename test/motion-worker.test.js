import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { motionSnapshot } from '../src/motion-inspector.js';

test('real scan worker evaluates a dense rig while the caller remains responsive', async () => {
  const model = { Nodes: Array.from({ length: 80 }, (_, id) => ({ ObjectId: id, Name: 'Bone ' + id, Parent: id ? id - 1 : null, PivotPoint: [id, 0, 0],
    Rotation: { LineType: 1, Keys: Array.from({ length: 501 }, (_, i) => ({ Frame: i * 2, Vector: [0, 0, 0, 1] })) } })), Sequences: [{ Name: 'Stand', Interval: [0, 1000] }] };
  const worker = new Worker(new URL('./motion-worker-bridge.js', import.meta.url));
  let ticks = 0; const timer = setInterval(() => ticks++, 5), start = performance.now();
  try {
    const result = await new Promise((resolve, reject) => {
      worker.on('error', reject);
      worker.on('message', data => { if (data.error) reject(Error(data.error)); else if (data.result) resolve(data.result); });
      worker.postMessage({ model: motionSnapshot(model), options: { sequenceIndex: 0, maxWorldSamples: 4000 } });
    });
    assert.deepEqual(result.findings, []); assert.ok(ticks > 5, `Only ${ticks} caller ticks during scan`);
    assert.ok(result.stats.worldSamples <= 4000);
    console.log(`Motion worker: ${result.stats.localIntervals} local intervals, ${result.stats.worldSamples} hierarchy samples, ${Math.round(performance.now() - start)} ms, ${ticks} caller ticks.`);
  } finally { clearInterval(timer); await worker.terminate(); }
});
