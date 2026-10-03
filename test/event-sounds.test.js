import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url), {CascTextures, soundCandidates} = require('../electron/casc.cjs');
const {TextureResolver} = require('../electron/texture-resolver.cjs');

test('sound resolution uses exact identity, installed locale and base before HD', () => {
  const stem = 'units\\human\\hero\\warcry1', base = 'war3.w3mod:';
  const names = [`${base}_hd.w3mod:_locales\\enus.w3mod:${stem}.ogg`, `${base}_locales\\dede.w3mod:${stem}.ogg`, `${base}_locales\\enus.w3mod:${stem}.ogg`, `${base}${stem}other.ogg`];
  assert.deepEqual(soundCandidates(`${base}${stem}.flac`, names, ['enus']), [names[2], names[0]]);
  assert.deepEqual(soundCandidates(`${base}_hd.w3mod:${stem}.flac`, names, ['enus']), [names[0]]);
  assert.deepEqual(soundCandidates(`${base}${stem}.flac`, names, ['dede']), [names[1]]);
});

test('cached missing filename does not block indexed CKey audio; restart reuses index', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mdlxl-sound-')), folder = path.join(dir, 'game'), cacheDirectory = path.join(dir, 'cache');
  const {mkdir} = await import('node:fs/promises'); await mkdir(folder); await writeFile(path.join(folder, '.build.info'), 'enUS speech?');
  const requested = 'war3.w3mod:units\\human\\hero\\warcry1.flac', sourceName = 'war3.w3mod:_locales\\enus.w3mod:units\\human\\hero\\warcry1.ogg', key = 'ab'.repeat(16), bytes = Buffer.from('OggS data');
  let listed = 0, reads = 0;
  const openReader = () => ({read:async name => { reads++; return name === '@ckey:' + key ? bytes : null; }, list:async kind => { assert.equal(kind, 'sounds'); listed++; return {names:[sourceName], keys:{[sourceName]:key}}; }, close(){}});
  try {
    for (let i = 0; i < 2; i++) {
      const casc = new CascTextures({cacheDirectory, openReader});
      assert.deepEqual(await casc.readSound(requested, [folder]), {bytes, sourceName}); await casc.close();
    }
    assert.equal(listed, 1); assert.equal(reads, 2);
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('event resource IPC preserves requested name and actual sound format', async () => {
  const bytes = Buffer.from('OggS'), name = 'war3.w3mod:units\\hero.flac';
  const resolver = new TextureResolver({casc:{readSound:async () => ({bytes,sourceName:'war3.w3mod:_locales\\enus.w3mod:units\\hero.ogg'})}});
  assert.deepEqual(await resolver.resolve([name], {cascFolders:['game']}, ['flac']), [{name,bytes,sourceName:'war3.w3mod:_locales\\enus.w3mod:units\\hero.ogg'}]);
});
