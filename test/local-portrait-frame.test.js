import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { decodeDds } from '../src/dds.js';
const require = createRequire(import.meta.url);
const local = require('../electron/human-portrait-frame.cjs');
const hashes = ['877bdf7c379bf55c69b13a7fa63adb25ad82767311af074239ef99fba6b031e6', 'a4fae942bc762d58015e22f6946b057f9cf0656b6215d942a432dbaaf7870a97', 'e3f88edb1bd116702eab9d6d71759210853721a32b59a2fc742c04e779d870eb'];

test('local Human frame assets match the named patch exactly and keep native transparency', () => {
  local.validateHumanPortraitResources().forEach((asset, i) => {
    assert.equal(createHash('sha256').update(asset.bytes).digest('hex'), hashes[i]);
    const image = decodeDds(asset.bytes);
    assert.equal(image.width, i === 2 ? 256 : 512); assert.equal(image.height, image.width);
    assert.ok(image.data.some((value, index) => index % 4 === 3 && value === 0));
  });
});

test('actual frame IPC handler needs no game discovery, profile cache, FDF or network APIs', async () => {
  const source = fs.readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  const resolver = source.slice(source.indexOf('async function resolveTextures('), source.indexOf("ipcMain.handle('texture:resolve'"));
  const handler = source.slice(source.indexOf("ipcMain.handle('preview:humanPortraitFrame'"), source.indexOf('async function textureLibraryContext('));
  let callback;
  const context = vm.createContext({ ...local, IMAGE_EXTENSIONS: ['dds'], textureOperations: new Set(),
    ipcMain: { handle: (channel, fn) => { assert.equal(channel, 'preview:humanPortraitFrame'); callback = fn; } } });
  vm.runInContext(resolver + handler, context);
  const records = await callback();
  assert.equal(records.length, 3);
  records.forEach((asset, i) => assert.equal(createHash('sha256').update(asset.bytes).digest('hex'), hashes[i]));
});

test('missing or invalid local assets report a complete-folder extraction error', () => {
  const source = fs.readFileSync(new URL('../electron/human-portrait-frame.cjs', import.meta.url), 'utf8');
  for (const readFileSync of [() => { throw Error('ENOENT'); }, () => Buffer.from('bad data')]) {
    const context = { module: { exports: {} }, __dirname: '/isolated-app/electron', Buffer,
      require: name => name === 'node:fs' ? { readFileSync } : path };
    vm.runInNewContext(source, context);
    assert.throws(() => context.module.exports.validateHumanPortraitResources(), /Re-extract the complete MDLxL folder/);
  }
});
