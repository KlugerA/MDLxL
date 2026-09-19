const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BACKGROUND_BYTES = 64 * 1024 * 1024;
const BACKGROUND_MIME = Object.freeze({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp', '.gif': 'image/gif' });
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
const safeName = name => typeof name === 'string' && name.length > 0 && name !== '.' && name !== '..' && !/[\\/:<>?"*|\x00-\x1f]/.test(name) && path.basename(name) === name;
const metadata = (id, info) => ({ id, name: path.parse(id).name, mime: BACKGROUND_MIME[path.extname(id).toLowerCase()], size: info.size, signature: hash(`${id}|${info.size}|${info.mtimeMs}|${info.ctimeMs}`) });

class BackgroundLibrary {
  constructor({ directory, bundledDirectory = null } = {}) {
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw Error('Backgrounds needs an absolute folder path.');
    this.directory = path.resolve(directory);
    this.bundledDirectory = bundledDirectory ? path.resolve(bundledDirectory) : null;
    this.pendingDirectory = null;
  }

  // Seed only a newly created folder. Removing an individual default stays permanent.
  async ensureDirectory() {
    if (!this.pendingDirectory) this.pendingDirectory = (async () => {
      const created = await fs.mkdir(this.directory, { recursive: true });
      const info = await fs.lstat(this.directory);
      if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Backgrounds must be a regular folder.');
      if (!created || !this.bundledDirectory) return;
      let entries;
      try { entries = await fs.readdir(this.bundledDirectory, { withFileTypes: true }); }
      catch (error) { if (error.code === 'ENOENT') return; throw error; }
      for (const entry of entries) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.png' || !safeName(entry.name)) continue;
        const source = path.join(this.bundledDirectory, entry.name), sourceInfo = await fs.lstat(source);
        if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink() || sourceInfo.size <= 0 || sourceInfo.size > MAX_BACKGROUND_BYTES) continue;
        try { await fs.copyFile(source, path.join(this.directory, entry.name), constants.COPYFILE_EXCL); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
      }
    })().finally(() => { this.pendingDirectory = null; });
    return this.pendingDirectory;
  }

  async inspect(id) {
    if (!safeName(id) || !BACKGROUND_MIME[path.extname(id).toLowerCase()]) throw Error('Choose a PNG, JPG, WebP, BMP, or GIF in the Backgrounds folder.');
    const file = path.join(this.directory, id), info = await fs.lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw Error('Backgrounds must be regular image files.');
    const [folderPath, filePath] = await Promise.all([fs.realpath(this.directory), fs.realpath(file)]);
    const relative = path.relative(folderPath, filePath);
    if (!relative || path.dirname(relative) !== '.' || path.isAbsolute(relative) || relative === '..') throw Error('The background is outside the Backgrounds folder.');
    if (info.size <= 0 || info.size > MAX_BACKGROUND_BYTES) throw Error('Background images must be between 1 byte and 64 MiB.');
    return { file, info, item: metadata(id, info) };
  }

  async list() {
    await this.ensureDirectory();
    const entries = await fs.readdir(this.directory, { withFileTypes: true }), items = [];
    for (const entry of entries) {
      if (!entry.isFile() || !BACKGROUND_MIME[path.extname(entry.name).toLowerCase()]) continue;
      try { items.push((await this.inspect(entry.name)).item); }
      catch (error) { if (error.code === 'EACCES' || error.code === 'EPERM') throw error; /* A removed, invalid or oversized file is not a usable background. */ }
    }
    items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id));
    return { directory: this.directory, signature: hash(items.map(item => item.signature).join('|')), items };
  }

  async read(id) {
    await this.ensureDirectory();
    const { file, item } = await this.inspect(id);
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size <= 0 || info.size > MAX_BACKGROUND_BYTES) throw Error('Background images must be between 1 byte and 64 MiB.');
      // A bounded read also prevents a concurrently growing file from allocating without limit.
      const buffer = Buffer.alloc(info.size + 1);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
        if (!bytesRead) break;
        offset += bytesRead;
      }
      if (offset !== info.size) throw Error('The background changed while loading. Refresh and try again.');
      return { ...item, ...metadata(id, info), bytes: new Uint8Array(buffer.subarray(0, offset)) };
    } finally { await handle.close(); }
  }
}

module.exports = { BackgroundLibrary, BACKGROUND_MIME, MAX_BACKGROUND_BYTES };
