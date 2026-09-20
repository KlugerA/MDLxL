import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { SessionJournal } = require('../electron/session.cjs');
async function scratch(t) {
  const base = path.resolve(os.tmpdir()), directory = await fs.mkdtemp(path.join(base, 'mdlvis-session-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    if (!resolved.toLowerCase().startsWith(base.toLowerCase() + path.sep) || !path.basename(resolved).startsWith('mdlvis-session-')) throw Error('Unexpected session cleanup location.');
    await fs.rm(resolved, { recursive: true, force: true });
  }); return directory;
}

test('fresh startup and normal close remain quiet even when edits were deliberately discarded', async t => {
  const root = await scratch(t), first = new SessionJournal(root, { pid: 100, alive: () => false });
  assert.equal(await first.begin(), false);
  await first.setDirty(true); await first.close();
  assert.deepEqual(await fs.readdir(root), []);
  const next = new SessionJournal(root, { pid: 101, alive: () => false });
  assert.equal(await next.begin(), false); await next.close();
});

test('a dead process with unsaved edits triggers recovery once, while an unedited abnormal exit does not', async t => {
  const root = await scratch(t), crashed = new SessionJournal(root, { pid: 100, alive: () => false });
  await crashed.begin(); await crashed.setDirty(true);
  const next = new SessionJournal(root, { pid: 101, alive: () => false });
  assert.equal(await next.begin(), true);
  const uneditedCrash = new SessionJournal(root, { pid: 102, alive: () => false });
  assert.equal(await uneditedCrash.begin(), false); await uneditedCrash.close();
});

test('another running editor never causes recovery or has its journal removed', async t => {
  const root = await scratch(t), live = new SessionJournal(root, { pid: 100, alive: () => true });
  await live.begin(); await live.setDirty(true);
  const next = new SessionJournal(root, { pid: 101, alive: pid => pid === 100 });
  assert.equal(await next.begin(), false);
  await next.close(); assert.deepEqual(await fs.readdir(root), [path.basename(live.file)]); await live.close();
});

test('saving before a crash clears the recovery prompt and malformed journals do not trigger one', async t => {
  const root = await scratch(t), first = new SessionJournal(root, { pid: 100, alive: () => false });
  await first.begin(); await Promise.all([first.setDirty(true), first.setDirty(false)]);
  await fs.writeFile(path.join(root, 'a'.repeat(24) + '.json'), '{bad json');
  await fs.writeFile(path.join(root, 'b'.repeat(24) + '.json'), JSON.stringify({ pid: -1, dirty: true }));
  const next = new SessionJournal(root, { pid: 101, alive: () => false });
  assert.equal(await next.begin(), false); await next.close();
});
