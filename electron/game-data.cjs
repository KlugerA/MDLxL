// Bounded, read-only discovery of classic Warcraft III data. No permanent watcher
// or recursive whole-drive scan is used. An explicit folder is always preferred.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const ARCHIVE_ORDER = ['war3patch.mpq', 'war3x.mpq', 'war3xlocal.mpq', 'war3.mpq'];
const CONTAINERS = ['Games', 'Warcraft III', 'Warcraft 3', 'WarcraftIII', 'War3', 'WC3', 'Blizzard', 'Blizzard Entertainment', 'Battle.net', 'Program Files', 'Program Files (x86)'];
const GAME_NAME = /warcraft|war[ _-]?3|\bwc3\b/i;
const CONTAINER_NAME = /^(games?|my games|blizzard(?: entertainment)?|battle\.net|program files(?: \(x86\))?)$/i;
const SKIP = /^(windows|node_modules|\.git|\.codex|appdata|recovery|profile|\$recycle\.bin|system volume information)$/i;
const unique = values => [...new Map(values.filter(value => typeof value === 'string' && value && !value.includes('\0')).map(value => [path.resolve(value).toLowerCase(), path.resolve(value)])).values()];

function isInsideFolder(candidate, folder) {
  if (typeof candidate !== 'string' || typeof folder !== 'string' || !candidate || !folder) return false;
  const relative = path.relative(path.resolve(folder), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

// Keep a user-selected Warcraft installation ahead of heuristic discovery.  An
// install can keep the classic archives under _classic_ or Data, so checking
// only the selected directory itself is not sufficient.
function selectedGameDataSources(result, folder) {
  if (typeof folder !== 'string' || !folder) return { folder: null, folders: [], archives: [] };
  const root = path.resolve(folder);
  const folders = unique([root, ...(result?.folders || []).filter(candidate => isInsideFolder(candidate, root))]);
  const archives = unique((result?.archives || []).filter(candidate => isInsideFolder(candidate, root))).sort(archiveSort);
  return { folder: root, folders, archives };
}

function parseRegistryPaths(text) {
  const paths = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:InstallPathX?|InstallLocation|GamePath|ProgramX?)\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/i);
    if (!match) continue;
    let value = match[1].replace(/^"|"$/g, '');
    value = value.replace(/%([^%]+)%/g, (all, key) => process.env[key] || all);
    if (/\.exe$/i.test(value)) value = path.win32.dirname(value);
    if (path.win32.isAbsolute(value)) paths.push(value);
  }
  return [...new Set(paths)];
}

async function registryGameFolders() {
  if (process.platform !== 'win32') return [];
  const keys = [
    'HKCU\\Software\\Blizzard Entertainment\\Warcraft III',
    'HKLM\\Software\\Blizzard Entertainment\\Warcraft III',
    'HKLM\\Software\\WOW6432Node\\Blizzard Entertainment\\Warcraft III',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Warcraft III',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Warcraft III',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Warcraft III Reforged',
  ];
  const results = await Promise.allSettled(keys.map(key => run('reg.exe', ['query', key], { windowsHide: true, timeout: 1800, maxBuffer: 256 * 1024 })));
  return unique(results.flatMap(result => result.status === 'fulfilled' ? parseRegistryPaths(result.value.stdout) : []));
}

async function fixedDriveRoots() {
  if (process.platform !== 'win32') return [];
  try {
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType = 3' | ForEach-Object { $_.DeviceID + '\\' }"], { windowsHide: true, timeout: 2200, maxBuffer: 32 * 1024 });
    return stdout.split(/\r?\n/).map(value => value.trim()).filter(value => /^[a-z]:\\$/i.test(value));
  } catch { return [process.env.SystemDrive ? process.env.SystemDrive + '\\' : 'C:\\']; }
}

function archiveSort(a, b) {
  const rank = file => { const index = ARCHIVE_ORDER.indexOf(path.basename(file).toLowerCase()); return index < 0 ? ARCHIVE_ORDER.length : index; };
  return rank(a) - rank(b) || a.localeCompare(b);
}

async function beforeDeadline(operation, deadline) {
  let timer;
  try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Discovery time limit reached.')), Math.max(1, deadline - Date.now())); })]); }
  finally { clearTimeout(timer); }
}

class GameDataDiscovery {
  constructor({ cacheFile, appFolders = [], env = process.env, registry = registryGameFolders, drives = fixedDriveRoots, maxDirectories = 700, maxMilliseconds = 6500, readdir = (...args) => fs.readdir(...args) } = {}) {
    Object.assign(this, { cacheFile, appFolders, env, registry, drives, maxDirectories, maxMilliseconds, readdir });
    this.result = { folders: [], archives: [], searchedAt: null, truncated: false, directoriesChecked: 0 };
    this.pending = null;
    this.requestKey = null;
    this.generation = 0;
    this.providers = null;
  }
  async discover({ explicitFolder, modelFolders = [], force = false } = {}) {
    const hints = unique([explicitFolder, ...modelFolders]);
    const requestKey = JSON.stringify([explicitFolder ? path.resolve(explicitFolder).toLowerCase() : null, hints.map(folder => folder.toLowerCase()).sort()]);
    if (this.pending) {
      await this.pending;
      if (!force && requestKey === this.requestKey) return this.result;
    }
    if (!force && requestKey === this.requestKey) return this.result;
    this.requestKey = requestKey;
    this.pending = this.search(hints, explicitFolder, force).then(result => { this.result = result; this.generation++; return result; });
    try { return await this.pending; } finally { this.pending = null; }
  }
  async search(hints, explicitFolder, force) {
    const began = Date.now(), deadline = began + this.maxMilliseconds;
    let cached = [];
    const selectedKey = explicitFolder ? path.resolve(explicitFolder).toLowerCase() : null;
    if (this.cacheFile) try {
      const saved = JSON.parse(await fs.readFile(this.cacheFile, 'utf8'));
      if (Array.isArray(saved.folders)) cached = saved.folders.slice(0, 100);
      if (!force && saved.version === 2 && saved.selectedKey === selectedKey && saved.stamps?.length) {
        const valid = await Promise.all(saved.stamps.map(async stamp => { try { const info = await fs.stat(stamp.file); return info.size === stamp.size && info.mtimeMs === stamp.mtimeMs; } catch { return false; } }));
        if (valid.every(Boolean)) return { ...saved.result, fromCache: true, directoriesChecked: 0 };
      }
    } catch {}
    if (!this.providers || force) this.providers = Promise.allSettled([this.registry(), this.drives()]);
    const [registry, drives] = await this.providers;
    const roots = drives.status === 'fulfilled' ? unique(drives.value) : [];
    const registered = registry.status === 'fulfilled' ? registry.value : [];
    const extraArchiveRoots = new Set(unique([explicitFolder, ...registered]).map(folder => folder.toLowerCase()));
    const near = unique([...hints, ...this.appFolders].flatMap(folder => [folder, path.dirname(folder)]));
    const known = unique([...hints, ...cached, ...registered, ...near,
      this.env.ProgramFiles, this.env['ProgramFiles(x86)'], this.env.ProgramW6432,
      ...[this.env.USERPROFILE].filter(Boolean).flatMap(folder => ['Desktop', 'Documents', 'Downloads', 'Games'].map(name => path.join(folder, name))),
    ]);
    // Inspect likely folders first, then breadth-first inside game containers.
    const queue = known.map(folder => ({ folder, depth: 0, broad: GAME_NAME.test(path.basename(folder)) || CONTAINER_NAME.test(path.basename(folder)) }));
    for (const root of roots) {
      for (const name of CONTAINERS) queue.push({ folder: path.join(root, name), depth: 0, broad: true });
      queue.push({ folder: root, depth: 0, broad: false, surface: true });
    }
    const visited = new Set(), folders = [], archives = [], cascFolders = [];
    let cursor = 0;
    while (cursor < queue.length && visited.size < this.maxDirectories && Date.now() < deadline) {
      const current = queue[cursor++], key = path.resolve(current.folder).toLowerCase();
      if (visited.has(key)) continue;
      visited.add(key);
      let entries;
      try { entries = await beforeDeadline(this.readdir(current.folder, { withFileTypes: true }), deadline); } catch { continue; }
      if (entries.some(entry => entry.isFile() && entry.name.toLowerCase() === '.build.info') && entries.some(entry => entry.isDirectory() && entry.name.toLowerCase() === 'data')) { folders.push(current.folder); cascFolders.push(current.folder); }
      const found = entries.filter(entry => entry.isFile() && (extraArchiveRoots.has(key) ? /\.mpq$/i : /^war3.*\.mpq$/i).test(entry.name)).map(entry => path.join(current.folder, entry.name)).sort(archiveSort);
      if (found.length) { folders.push(current.folder); archives.push(...found); }
      // A selected folder is trusted as an asset root even when its useful
      // content sits below an otherwise generic directory such as Data.
      else if ((GAME_NAME.test(path.basename(current.folder)) || (explicitFolder && isInsideFolder(current.folder, explicitFolder))) && entries.some(entry => entry.isDirectory() && /^(textures|units|buildings|replaceabletextures)$/i.test(entry.name))) folders.push(current.folder);
      if (current.depth >= 3) continue;
      const children = entries.filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && !SKIP.test(entry.name)).sort((a, b) => Number(GAME_NAME.test(b.name)) - Number(GAME_NAME.test(a.name)) || a.name.localeCompare(b.name));
      for (const entry of children) {
        const game = GAME_NAME.test(entry.name), container = CONTAINER_NAME.test(entry.name);
        // The user deliberately selected this tree, so inspect its small
        // conventional layout (Data, _classic_, etc.) without applying the
        // broad-drive heuristic to unrelated directories.
        const insideExplicit = explicitFolder && isInsideFolder(current.folder, explicitFolder);
        if (current.surface || current.broad || insideExplicit || game || container || /^_(?:classic|retail)_$/i.test(entry.name)) queue.push({ folder: path.join(current.folder, entry.name), depth: current.depth + 1, broad: current.broad || game || container });
      }
    }
    const result = { folders: unique(folders), archives: unique(archives), cascFolders: unique(cascFolders), searchedAt: new Date().toISOString(), truncated: cursor < queue.length, directoriesChecked: visited.size };
    if (this.cacheFile) {
      try {
        const files = [...result.archives, ...result.cascFolders.map(folder => path.join(folder,'.build.info'))];
        const stamps = await Promise.all(files.map(async file => { const info = await fs.stat(file); return { file, size: info.size, mtimeMs: info.mtimeMs }; }));
        await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
        await fs.writeFile(this.cacheFile, JSON.stringify({ version: 2, selectedKey, folders: result.folders, stamps, result }));
      } catch {}
    }
    return result;
  }
}

module.exports = { GameDataDiscovery, parseRegistryPaths, archiveSort, selectedGameDataSources, isInsideFolder, registryGameFolders, fixedDriveRoots };
