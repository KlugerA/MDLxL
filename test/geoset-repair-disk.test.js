import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const { createGeosetRepairStore } = createRequire(import.meta.url)('../electron/geoset-repair.cjs');

async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-geoset-repair-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'test.mdx'), before = Buffer.from('MDLX original fixture'), bytes = Buffer.from('MDLX repaired fixture');
  await fs.writeFile(file, before);
  const store = createGeosetRepairStore(new Set([file]));
  return { directory, file, before, bytes, store, payload: { path: file, beforeBytes: before, expectedDiskBytes: before, bytes } };
}
test('disk repair creates exact backup, replaces file, and Undo restores exact original', async t => {
  const { file, before, bytes, store, payload } = await setup(t);
  const receipt = await store.repair(payload);
  assert.deepEqual(await fs.readFile(receipt.backupPath), before); assert.deepEqual(await fs.readFile(file), bytes);
  const restored = await store.undo(receipt.id);
  assert.deepEqual(restored.bytes, before); assert.deepEqual(await fs.readFile(file), before);
  assert.deepEqual(await fs.readFile(receipt.backupPath), before);
  await assert.rejects(store.undo(receipt.id), /no longer available/);
});
test('unsaved pre-repair work and original disk version both get backups', async t => {
  const { file, before, store, payload } = await setup(t), working = Buffer.from('MDLX unsaved work');
  const receipt = await store.repair({ ...payload, beforeBytes: working });
  assert.deepEqual(await fs.readFile(receipt.backupPath), working); assert.deepEqual(await fs.readFile(receipt.diskBackupPath), before);
  await store.undo(receipt.id); assert.deepEqual(await fs.readFile(file), working);
});
test('external disk changes block repair and Undo without overwriting', async t => {
  const { file, before, store, payload } = await setup(t), external = Buffer.from('MDLX external changes');
  await fs.writeFile(file, external); await assert.rejects(store.repair(payload), /changed on disk/);
  assert.deepEqual(await fs.readFile(file), external);
  await fs.writeFile(file, before); const receipt = await store.repair(payload);
  await fs.writeFile(file, external); await assert.rejects(store.undo(receipt.id), /changed on disk/);
  assert.deepEqual(await fs.readFile(file), external);
});
test('tampered backup and unapproved model paths are rejected', async t => {
  const { file, bytes, store, payload } = await setup(t);
  await assert.rejects(store.repair({ ...payload, path: file + '.mdx' }), /Open a local/);
  const receipt = await store.repair(payload);
  await fs.writeFile(receipt.backupPath, 'tampered'); await assert.rejects(store.undo(receipt.id), /backup changed/);
  assert.deepEqual(await fs.readFile(file), bytes);
});
