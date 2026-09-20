import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GameDataDiscovery, parseRegistryPaths, selectedGameDataSources } = require('../electron/game-data.cjs');
const { TextureResolver } = require('../electron/texture-resolver.cjs');

async function scratch(t) {
  const base = path.resolve(os.tmpdir()), directory = await fs.mkdtemp(path.join(base, 'mdlvis-game-data-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    if (!resolved.toLowerCase().startsWith(base.toLowerCase() + path.sep) || !path.basename(resolved).startsWith('mdlvis-game-data-')) throw Error('Unexpected test cleanup location.');
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return directory;
}
async function archives(folder, names = ['war3.mpq']) {
  await fs.mkdir(folder, { recursive: true });
  await Promise.all(names.map(name => fs.writeFile(path.join(folder, name), 'fixture')));
  return folder;
}
const discovery = options => new GameDataDiscovery({ env: {}, registry: async () => [], drives: async () => [], ...options });

test('registry Warcraft installation and executable values support spaces and both registry string types', () => {
  assert.deepEqual(parseRegistryPaths('HKEY_LOCAL_MACHINE\\Software\\Blizzard Entertainment\\Warcraft III\r\n    InstallPath    REG_SZ    D:\\Games\\Warcraft III\r\n    InstallPathX    REG_EXPAND_SZ    E:\\WC3\r\n    Program    REG_SZ    "D:\\Games\\Warcraft III\\Warcraft III.exe"\r\n    Unrelated    REG_SZ    C:\\Ignore\r\n'), ['D:\\Games\\Warcraft III', 'E:\\WC3']);
});

test('discovery finds registry, fixed-drive game libraries and app/model adjacent MPQs in priority order', async t => {
  const root = await scratch(t);
  const override = await archives(path.join(root, 'override'), ['War3.mpq', 'War3Patch.mpq', 'War3x.mpq']);
  const registered = await archives(path.join(root, 'registered'));
  const library = await archives(path.join(root, 'drive', 'Games', 'Blizzard', 'Warcraft III', '_classic_'));
  const nearby = await archives(path.join(root, 'models', 'Warcraft III'));
  const scan = discovery({ registry: async () => [registered], drives: async () => [path.join(root, 'drive')], appFolders: [path.join(root, 'app')] });
  const result = await scan.discover({ explicitFolder: override, modelFolders: [path.join(root, 'models')] });
  assert.deepEqual(result.archives.slice(0, 3).map(file => path.basename(file)), ['War3Patch.mpq', 'War3x.mpq', 'War3.mpq']);
  for (const folder of [override, registered, library, nearby]) assert.ok(result.folders.includes(folder), 'Missing discovered folder: ' + folder);
  assert.equal(result.truncated, false);
});

test('cache survives restart, verifies missing paths, and a rescan discovers a newly added archive', async t => {
  const root = await scratch(t), folder = await archives(path.join(root, 'unusual-install')), cacheFile = path.join(root, 'profile', 'discovery.json');
  await discovery({ cacheFile, registry: async () => [folder] }).discover();
  let calls = 0;
  const restarted = discovery({ cacheFile, readdir: (...args) => { calls++; return fs.readdir(...args); } });
  assert.ok((await restarted.discover()).folders.includes(folder));
  const afterFirst = calls;
  await restarted.discover(); assert.equal(calls, afterFirst, 'unchanged resolution must not launch another scan');
  await fs.writeFile(path.join(folder, 'War3Patch.mpq'), 'patch');
  assert.equal((await restarted.discover()).archives.length, 1);
  assert.equal((await restarted.discover({ force: true })).archives.length, 2);
  await fs.unlink(path.join(folder, 'war3.mpq')); await fs.unlink(path.join(folder, 'War3Patch.mpq'));
  assert.deepEqual((await restarted.discover({ force: true })).archives, []);
});

test('discovery shares concurrent work, skips inaccessible directories and enforces directory and time budgets', async t => {
  const root = await scratch(t), folder = await archives(path.join(root, 'Warcraft III'));
  let registryCalls = 0;
  const scan = discovery({ registry: async () => { registryCalls++; await new Promise(resolve => setTimeout(resolve, 5)); return [path.join(root, 'forbidden'), folder]; }, maxDirectories: 2 });
  const [first, second] = await Promise.all([scan.discover(), scan.discover()]);
  assert.equal(registryCalls, 1); assert.equal(first, second); assert.equal(first.directoriesChecked, 2); assert.ok(first.folders.includes(folder));
  const limited = await discovery({ appFolders: [folder], maxDirectories: 1 }).discover();
  assert.equal(limited.directoriesChecked, 1); assert.equal(limited.truncated, true);
  const began = Date.now();
  const slow = await discovery({ appFolders: [folder], maxMilliseconds: 25, readdir: () => new Promise(() => {}) }).discover();
  assert.ok(Date.now() - began < 1000); assert.equal(slow.truncated, true);
});

test('fixed drive surface finds a game under a custom top-level folder without following symlinks or system trees', async t => {
  const root = await scratch(t), drive = path.join(root, 'drive');
  const game = await archives(path.join(drive, 'My Collection', 'Warcraft III'));
  await archives(path.join(drive, 'Windows', 'Warcraft III'));
  const result = await discovery({ drives: async () => [drive] }).discover();
  assert.deepEqual(result.folders, [game]);
});

test('automatic search ignores unrelated MPQs while a chosen data folder can supply custom archives', async t => {
  const root = await scratch(t), folder = await archives(path.join(root, 'Games', 'Battle.net'), ['Battle.net.mpq']);
  assert.deepEqual((await discovery({ drives: async () => [root] }).discover()).archives, []);
  assert.deepEqual((await discovery().discover({ explicitFolder: folder })).archives, [path.join(folder, 'Battle.net.mpq')]);
});

test('a selected Warcraft installation uses nested classic MPQs before automatic locations', async t => {
  const root = await scratch(t);
  const install = path.join(root, 'Warcraft III');
  const classic = await archives(path.join(install, 'Data', '_classic_'), ['War3.mpq', 'War3Patch.mpq']);
  const automatic = await archives(path.join(root, 'automatic'), ['War3.mpq']);
  const scan = discovery({ registry: async () => [automatic] });
  const result = await scan.discover({ explicitFolder: install });
  const selected = selectedGameDataSources(result, install);
  assert.ok(selected.folders.includes(path.resolve(install)), 'The chosen root remains a loose-texture root.');
  assert.ok(selected.folders.includes(classic), 'The selected _classic_ folder is a loose-texture root.');
  assert.deepEqual(selected.archives.map(file => path.basename(file)), ['War3Patch.mpq', 'War3.mpq']);
  const resolver = new TextureResolver({ openArchive: async file => ({
    read: async name => name === 'Units\\Human\\Footman\\Footman.blp' ? Buffer.from(path.basename(file)) : null,
    close: async () => {},
  }) });
  t.after(() => resolver.close());
  const found = await resolver.resolve(['Units\\Human\\Footman\\Footman.blp'], {
    folders: selected.folders,
    archives: selected.archives,
    fallbackFolders: result.folders.filter(folder => !selected.folders.includes(folder)),
    fallbackArchives: result.archives.filter(file => !selected.archives.includes(file)),
  });
  assert.equal(found[0].bytes.toString(), 'War3Patch.mpq');
});

test('loose model textures precede archives and explicit archive overrides precede discovered loose textures', async t => {
  const root = await scratch(t), explicit = path.join(root, 'manual'), auto = path.join(root, 'automatic'), model = path.join(root, 'model');
  await fs.mkdir(path.join(auto, 'Textures'), { recursive: true }); await fs.writeFile(path.join(auto, 'Textures', 'Native.blp'), 'automatic loose');
  await fs.mkdir(path.join(model, 'Textures'), { recursive: true }); await fs.writeFile(path.join(model, 'Textures', 'Local.blp'), 'model loose');
  let opened = 0;
  const resolver = new TextureResolver({ openArchive: async () => { opened++; return { read: async () => Buffer.from('explicit archive'), close: async () => {} }; } });
  t.after(() => resolver.close());
  const sources = { folders: [model, explicit], archives: [path.join(explicit, 'war3.mpq')], fallbackFolders: [auto] };
  assert.equal((await resolver.resolve(['Textures\\Local.blp'], sources))[0].bytes.toString(), 'model loose'); assert.equal(opened, 0);
  assert.equal((await resolver.resolve(['Textures\\Native.blp'], sources))[0].bytes.toString(), 'explicit archive'); assert.equal(opened, 1);
});

test('failed loose files, broken MPQs and unsupported entries fall through without losing the remaining textures', async t => {
  const root = await scratch(t), warnings = [], opens = [], reads = [];
  const resolver = new TextureResolver({
    warn: message => warnings.push(message),
    stat: async () => { throw Object.assign(Error('Denied'), { code: 'EACCES' }); },
    openArchive: async file => {
      const archive = path.basename(file); opens.push(archive);
      if (archive === 'broken.mpq') throw Error('Bad archive');
      return { read: async name => { reads.push(archive + '|' + name); if (archive === 'patch.mpq' && name === 'One.blp') throw Error('Unsupported MPQ compression mask 8'); return Buffer.from(archive + '|' + name); }, close: async () => {} };
    },
  });
  t.after(() => resolver.close());
  const sources = { folders: [root], archives: ['broken.mpq', 'patch.mpq', 'base.mpq'].map(name => path.join(root, name)) };
  const result = await resolver.resolve(['One.blp', 'Two.blp', 'ignored.exe', null], sources);
  assert.deepEqual(result.map(value => value.bytes.toString()), ['base.mpq|One.blp', 'patch.mpq|Two.blp']);
  const warningCount = warnings.length, readCount = reads.length;
  await resolver.resolve(['One.blp', 'Two.blp'], sources);
  assert.equal(warnings.length, warningCount); assert.equal(reads.length, readCount); assert.deepEqual(opens, ['broken.mpq', 'patch.mpq', 'base.mpq']);
});

test('archive opens are shared, missing texture results are cached, and no candidate escapes a texture root', async t => {
  const root = await scratch(t), candidates = []; let opens = 0, reads = 0, closes = 0;
  const resolver = new TextureResolver({ stat: async file => { candidates.push(file); throw Object.assign(Error('missing'), { code: 'ENOENT' }); }, openArchive: async () => { opens++; return { read: async () => { reads++; return null; }, close: async () => { closes++; } }; } });
  const sources = { folders: [root], archives: [path.join(root, 'War3.mpq')] };
  await Promise.all([resolver.resolve(['First.blp'], sources), resolver.resolve(['Second.blp'], sources)]);
  assert.equal(opens, 1);
  await resolver.resolve(['First.blp', 'Second.blp'], sources); assert.equal(reads, 2);
  await resolver.resolve(['..\\escape.blp'], sources);
  assert.ok(candidates.every(file => file.toLowerCase().startsWith(root.toLowerCase() + path.sep)));
  await resolver.close(); assert.equal(closes, 1); assert.equal(resolver.cache.size, 0);
});

test('archive reader LRU closes unused handles without closing an archive during a concurrent read', async t => {
  const root = await scratch(t), closed = [], running = new Set();
  const resolver = new TextureResolver({ maxReaders: 2, openArchive: async file => ({
    read: async () => { running.add(file); await new Promise(resolve => setTimeout(resolve, 5)); assert.ok(!closed.includes(file)); running.delete(file); return null; },
    close: async () => { assert.ok(!running.has(file)); closed.push(file); },
  }) });
  const files = [0, 1, 2, 3, 4].map(index => path.join(root, index + '.mpq'));
  await Promise.all(files.map((file, index) => resolver.resolve([index + '.blp'], { archives: [file] })));
  assert.ok(resolver.readers.size <= 2);
  await resolver.close(); assert.equal(closed.length, 5);
});
