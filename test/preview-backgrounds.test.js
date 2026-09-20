import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const { BackgroundLibrary, MAX_BACKGROUND_BYTES } = createRequire(import.meta.url)('../electron/preview-backgrounds.cjs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
const gif = Buffer.from('47494638396101000100800000000000ffffff21f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b', 'hex');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlvis-backgrounds-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('mdlvis-backgrounds-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const directory = path.join(root, 'Backgrounds'), bundledDirectory = path.join(root, 'bundled');
  await fs.mkdir(bundledDirectory);
  return { root, directory, bundledDirectory, library: new BackgroundLibrary({ directory, bundledDirectory }) };
}

test('new Backgrounds folder seeds PNG defaults once and preserves literal display names', async t => {
  const f = await fixture(t);
  for (let index = 1; index <= 9; index++) await fs.writeFile(path.join(f.bundledDirectory, `${index}_Original.png`), png);
  await fs.writeFile(path.join(f.bundledDirectory, 'not-a-default.gif'), gif);
  const [first, same] = await Promise.all([f.library.list(), f.library.list()]);
  assert.equal(first.items.length, 9); assert.equal(same.signature, first.signature);
  assert.deepEqual(first.items[0], { id: '1_Original.png', name: '1_Original', mime: 'image/png', size: png.length, signature: first.items[0].signature });
  await fs.unlink(path.join(f.directory, '1_Original.png'));
  const reopened = await new BackgroundLibrary(f).list();
  assert.equal(reopened.items.length, 8); assert.notEqual(reopened.signature, first.signature);
  await fs.writeFile(path.join(f.directory, '2_Original.png'), Buffer.from('custom contents'));
  await f.library.list();
  assert.equal(await fs.readFile(path.join(f.directory, '2_Original.png'), 'utf8'), 'custom contents');
});

test('existing folder is never seeded and refresh discovers direct supported files', async t => {
  const f = await fixture(t); await fs.mkdir(f.directory);
  await fs.writeFile(path.join(f.bundledDirectory, 'Original.png'), png);
  const before = await f.library.list(); assert.equal(before.items.length, 0);
  for (const id of ['My_Name.PNG', 'photo.jpg', 'photo.jpeg', 'image.webp', 'map.bmp', 'Loop.GIF']) await fs.writeFile(path.join(f.directory, id), id.endsWith('.GIF') ? gif : png);
  await fs.writeFile(path.join(f.directory, 'notes.txt'), 'ignored');
  await fs.mkdir(path.join(f.directory, 'nested')); await fs.writeFile(path.join(f.directory, 'nested', 'hidden.png'), png);
  const next = await f.library.list(); assert.equal(next.items.length, 6); assert.notEqual(next.signature, before.signature);
  assert.equal(next.items.find(item => item.id === 'My_Name.PNG').name, 'My_Name');
  const animation = await f.library.read('Loop.GIF'); assert.equal(animation.mime, 'image/gif'); assert.deepEqual(Buffer.from(animation.bytes), gif);
  await fs.writeFile(path.join(f.directory, 'Loop.GIF'), Buffer.concat([gif, Buffer.from([0])]));
  assert.notEqual((await f.library.list()).items.find(item => item.id === 'Loop.GIF').signature, animation.signature);
});

test('reads reject path traversal, unsupported extensions, directories and oversized files', async t => {
  const f = await fixture(t); await f.library.list();
  await fs.writeFile(path.join(f.root, 'outside.png'), png);
  for (const id of ['../outside.png', '..\\outside.png', path.join(f.root, 'outside.png'), 'name.png:secret', 'name\0.png', '', '..', null, 'notes.txt']) await assert.rejects(f.library.read(id));
  await fs.mkdir(path.join(f.directory, 'folder.png')); await assert.rejects(f.library.read('folder.png'), /regular image/);
  const large = await fs.open(path.join(f.directory, 'large.png'), 'w'); await large.truncate(MAX_BACKGROUND_BYTES + 1); await large.close();
  await fs.writeFile(path.join(f.directory, 'empty.png'), '');
  await assert.rejects(f.library.read('large.png'), /64 MiB/); await assert.rejects(f.library.read('empty.png'), /64 MiB/);
  assert.deepEqual((await f.library.list()).items, []);
});

test('symbolic links cannot expose backgrounds outside the folder', async t => {
  const f = await fixture(t); await f.library.list();
  const outside = path.join(f.root, 'outside.png'), link = path.join(f.directory, 'linked.png');
  await fs.writeFile(outside, png);
  try { await fs.symlink(outside, link, 'file'); }
  catch (error) { if (error.code === 'EPERM' || error.code === 'EACCES') { t.skip('Windows account cannot create symbolic links.'); return; } throw error; }
  await assert.rejects(f.library.read('linked.png'), /regular image/); assert.equal((await f.library.list()).items.length, 0);
});
