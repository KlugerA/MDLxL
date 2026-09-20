import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { verifyFFmpegBundle } = createRequire(import.meta.url)('../electron/ffmpeg-verification.cjs');
const manifest = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
const runtimeFolders = ['dist', 'electron', 'src'];
const externalFolders = ['Backgrounds', 'BitsAndParts', 'Addons'];
const runtimeGuides = ['ADDONS.md', 'COMMUNITY_RESEARCH.md'];
const stageEntries = [...runtimeFolders, 'docs', 'package.json', 'README.md', 'MERGER_NOTES.md', 'THIRD_PARTY_NOTICES.md', 'LICENSES.bundled.txt'].sort();
const exists = async file => { try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');

function options(args) {
  const result = { out: path.join(source, 'release'), overwrite: false, check: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--overwrite') result.overwrite = true;
    else if (arg === '--check') result.check = true;
    else if (arg === '--out' || arg === '--electron-zip-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw Error(`${arg} needs a directory.`);
      result[arg === '--out' ? 'out' : 'electronZipDir'] = path.resolve(value);
    } else throw Error(`Unknown option: ${arg}`);
  }
  return result;
}

async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name), full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error(`Packaging requires regular files: ${full}`);
    if (entry.isDirectory()) result.push(...await files(full, relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}

async function dependencyDirectory(name, from) {
  const requireFrom = createRequire(path.join(from, 'package.json'));
  // Use a subpath so a package named "buffer" is not treated as Node's builtin.
  for (const modules of requireFrom.resolve.paths(`${name}/package.json`) || []) {
    const directory = path.join(modules, name);
    if (await exists(path.join(directory, 'package.json'))) return fs.realpath(directory);
  }
  throw Error(`Install dependency ${name} before packaging.`);
}

// The renderer already bundles these packages. Retain their complete license
// texts, including transitive dependencies, without shipping their source trees.
async function bundledLicenses() {
  const packages = new Map();
  async function visit(name, from) {
    const directory = await dependencyDirectory(name, from);
    const info = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
    const key = `${info.name}@${info.version}`;
    if (packages.has(key)) return;
    const names = (await fs.readdir(directory)).filter(name => /^(?:licen[cs]e|copying|notice)(?:$|[._-])/i.test(name)).sort();
    const texts = [];
    for (const name of names) {
      if ((await fs.stat(path.join(directory, name))).isFile()) texts.push(`${name}\n\n${await fs.readFile(path.join(directory, name), 'utf8')}`);
    }
    // This npm release contains only clipper.js; retain its complete Boost and
    // embedded JSBN notices from the checked-in dependency notice.
    if (key === 'clipper-lib@6.4.2') texts.push(await fs.readFile(path.join(source, 'docs/licenses/clipper-lib.txt'), 'utf8'));
    if (!texts.length) throw Error(`No complete license text found for ${key}; add its notice before packaging.`);
    packages.set(key, texts);
    for (const dependency of Object.keys(info.dependencies || {}).sort()) await visit(dependency, directory);
    for (const dependency of Object.keys(info.optionalDependencies || {}).sort()) {
      let optionalDirectory;
      try { optionalDirectory = await dependencyDirectory(dependency, directory); } catch { continue; }
      if (optionalDirectory) await visit(dependency, directory);
    }
  }
  for (const name of Object.keys(manifest.dependencies || {}).sort()) await visit(name, source);
  return 'Full license notices for libraries bundled into the MDLxL renderer.\nElectron/Chromium and CascLib retain their accompanying license files.\n\n' +
    [...packages].sort(([a], [b]) => a.localeCompare(b)).map(([name, texts]) => `===== ${name} =====\n\n${texts.join('\n\n')}\n`).join('\n');
}

async function makeStage(stage) {
  if (!await exists(path.join(source, 'dist', 'index.html'))) throw Error('Run npm run build before packaging.');
  for (const folder of runtimeFolders) await fs.cp(path.join(source, folder), path.join(stage, folder), { recursive: true });
  const runtimeManifest = Object.fromEntries(['name', 'version', 'private', 'type', 'description', 'main', 'productName'].filter(key => key in manifest).map(key => [key, manifest[key]]));
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify(runtimeManifest, null, 2) + '\n');
  await fs.copyFile(path.join(source, 'README.md'), path.join(stage, 'README.md'));
  await fs.copyFile(path.join(source, 'MERGER_NOTES.md'), path.join(stage, 'MERGER_NOTES.md'));
  await fs.copyFile(path.join(source, 'THIRD_PARTY_NOTICES.md'), path.join(stage, 'THIRD_PARTY_NOTICES.md'));
  await fs.mkdir(path.join(stage, 'docs'));
  for (const guide of runtimeGuides) await fs.copyFile(path.join(source, 'docs', guide), path.join(stage, 'docs', guide));
  await fs.writeFile(path.join(stage, 'LICENSES.bundled.txt'), await bundledLicenses());
  await verifyStage(stage);
}

async function verifyStage(stage) {
  await verifyFFmpegBundle(path.join(stage, 'electron', 'ffmpeg'));
  const actual = (await fs.readdir(stage)).sort();
  if (JSON.stringify(actual) !== JSON.stringify(stageEntries)) throw Error(`Unexpected runtime staging entries: ${actual.join(', ')}`);
  if (JSON.stringify((await fs.readdir(path.join(stage, 'docs'))).sort()) !== JSON.stringify([...runtimeGuides].sort())) throw Error('Only the two linked runtime guides belong in the package.');
  const list = await files(stage);
  if (list.some(file => file.split(path.sep).some(part => ['node_modules', 'profile', '.vite', '.vite-temp', 'work'].includes(part)) || /\.log$/i.test(file))) throw Error('Runtime stage contains a cache, profile, or log.');
  const tengwarPackage = ['LICENCE', 'readme.txt', 'tngan.ttf', 'tnganb.ttf', 'tngani.ttf', 'tnganbi.ttf', 'tngana.ttf', 'tnganab.ttf', 'tnganai.ttf', 'tnganabi.ttf', 'tngandoc.pdf'].map(name => `dist/fonts/tengwar-annatar/${name}`);
  for (const name of ['humanuitile01.dds', 'humanuitile02.dds', 'humanuiportraitmask.dds']) {
    const file = path.join(stage, 'electron', 'portrait-local', name);
    if (!await exists(file)) throw Error(`Local Human portrait frame missing: ${name}`);
    const bytes = await fs.readFile(file);
    if (bytes.length < 128 || bytes.toString('ascii', 0, 4) !== 'DDS ') throw Error(`Invalid local Human portrait asset: ${name}`);
  }
  for (const relative of ['electron/main.cjs', 'electron/preload.cjs', 'electron/casc/CascBridge-0.7.0.exe', 'electron/casc/CascLib.dll', 'electron/data/texture-library-catalog.json', ...['preferences', 'commands', 'localization', 'warmkey-defaults', 'preview-lighting', 'capture-settings'].map(name => `src/${name}.js`), ...['core', 'editor', 'engine', 'additions', 'forge', 'descriptors', 'materials'].map(name => `src/locales/ru-${name}.json`), 'dist/index.html', 'dist/branding/MDLxL.ico', 'dist/classic/wc3-bits-and-parts.png', ...tengwarPackage]) {
    if (!await exists(path.join(stage, relative))) throw Error(`Runtime file missing: ${relative}`);
  }
  for (const relative of ['electron/paint-textures.cjs', 'dist/branding/citadel-paint.svg', 'dist/paint-assets/manifest.json', 'dist/paint-brushes/manifest.json', 'dist/whiteout/whiteout-paint-blp.js', 'dist/whiteout/whiteout-paint-blp.wasm', 'dist/whiteout/LICENSE', 'dist/whiteout/build.json']) {
    if (!await exists(path.join(stage, relative))) throw Error(`Citadel Paint runtime file missing: ${relative}`);
  }
}

async function cachedElectron(version, explicit) {
  const filename = `electron-v${version}-win32-x64.zip`;
  if (explicit) {
    if (!await exists(path.join(explicit, filename))) throw Error(`Cached Electron ZIP missing: ${path.join(explicit, filename)}`);
    return explicit;
  }
  const roots = [process.env.ELECTRON_CACHE, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'electron', 'Cache'), path.join(os.homedir(), '.cache', 'electron')].filter(Boolean);
  for (const root of roots) {
    if (!await exists(root)) continue;
    if (await exists(path.join(root, filename))) return root;
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory() && await exists(path.join(root, entry.name, filename))) return path.join(root, entry.name);
    }
  }
  return undefined; // Packager uses its normal Electron cache/download behavior.
}

async function verifyCopiedTree(original, copied) {
  const expected = await files(original), actual = await files(copied);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw Error(`Packaged file list differs from ${original}`);
  for (const relative of expected) if (await hash(path.join(original, relative)) !== await hash(path.join(copied, relative))) throw Error(`Packaged file differs: ${relative}`);
  return expected.length;
}

async function main() {
  const opts = options(process.argv.slice(2));
  const temporaryRoot = await fs.realpath(os.tmpdir());
  const stage = await fs.mkdtemp(path.join(temporaryRoot, 'mdlxl-package-'));
  try {
    await makeStage(stage);
    if (opts.check) { console.log('Runtime whitelist and complete bundled dependency licenses verified.'); return; }
    await fs.mkdir(opts.out, { recursive: true });
    const outputRoot = await fs.realpath(opts.out);
    const expectedPackage = path.join(outputRoot, 'MDLxL-win32-x64');
    if (path.dirname(expectedPackage) !== outputRoot) throw Error('Invalid package output path.');
    if (await exists(expectedPackage)) {
      if (!opts.overwrite) throw Error(`${expectedPackage} exists. Use --overwrite to replace this generated package.`);
      if ((await fs.lstat(expectedPackage)).isSymbolicLink() || await fs.realpath(expectedPackage) !== expectedPackage) throw Error('Cannot replace a linked package directory.');
      const existing = JSON.parse(await fs.readFile(path.join(expectedPackage, 'resources/app/package.json'), 'utf8'));
      if (existing.name !== manifest.name || !await exists(path.join(expectedPackage, 'MDLxL.exe'))) throw Error('Refusing to replace a directory that is not an MDLxL package.');
    }
    const electronVersion = JSON.parse(await fs.readFile(path.join(source, 'node_modules/electron/package.json'), 'utf8')).version;
    const electronZipDir = await cachedElectron(electronVersion, opts.electronZipDir);
    const { packager } = await import('@electron/packager');
    const output = await packager({ dir: stage, name: 'MDLxL', platform: 'win32', arch: 'x64', electronVersion, electronZipDir, out: outputRoot, overwrite: opts.overwrite, asar: false, prune: false, icon: path.join(source, 'dist/branding/MDLxL.ico') });
    if (output.length !== 1 || path.resolve(output[0]) !== expectedPackage) throw Error('Unexpected package destination.');
    for (const folder of externalFolders) await fs.cp(path.join(source, folder), path.join(expectedPackage, folder), { recursive: true });
    await fs.copyFile(path.join(source, 'MERGER_NOTES.md'), path.join(expectedPackage, 'MERGER_NOTES.md'));
    const packagedApp = path.join(expectedPackage, 'resources/app');
    await verifyStage(packagedApp);
    let verifiedFiles = await verifyCopiedTree(stage, packagedApp);
    for (const folder of externalFolders) verifiedFiles += await verifyCopiedTree(path.join(source, folder), path.join(expectedPackage, folder));
    const addonGuide = path.join(source, 'docs/ADDONS.md'), packagedGuide = path.join(expectedPackage, 'Addons/ADDONS.md');
    await fs.copyFile(addonGuide, packagedGuide);
    if (await hash(addonGuide) !== await hash(packagedGuide)) throw Error('Packaged Addons guide differs.');
    verifiedFiles++;
    // Packager copies Electron's complete locale set from its runtime archive.
    // A portable rebuild may not retain Electron's postinstall-only source
    // runtime tree, so validate the actual packaged runtime instead.
    const localeCount = (await files(path.join(expectedPackage, 'locales'))).length;
    if (!localeCount) throw Error('Packaged Electron locales are missing.');
    if (await exists(path.join(expectedPackage, 'resources/app.asar'))) throw Error('ASAR must stay disabled for native helpers and portable profile storage.');
    for (const name of ['MDLxL.exe', 'LICENSE', 'LICENSES.chromium.html']) if (!await exists(path.join(expectedPackage, name))) throw Error(`Electron runtime file missing: ${name}`);
    console.log(JSON.stringify({ package: expectedPackage, verifiedRuntimeAndAssetFiles: verifiedFiles, preservedLocaleFiles: localeCount, redundantDependencyCopies: false, asar: false }, null, 2));
  } finally {
    const resolvedStage = await fs.realpath(stage);
    if (path.dirname(resolvedStage) !== temporaryRoot || !path.basename(resolvedStage).startsWith('mdlxl-package-')) throw Error('Unsafe staging cleanup path.');
    await fs.rm(resolvedStage, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
