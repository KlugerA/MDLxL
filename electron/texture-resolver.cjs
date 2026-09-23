const fs = require('node:fs/promises');
const path = require('node:path');
const { Mpq } = require('./mpq.cjs');
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'blp', 'tga', 'dds'];
const unique = values => [...new Map(values.filter(Boolean).map(value => [path.resolve(value).toLowerCase(), path.resolve(value)])).values()];

class TextureResolver {
  constructor({ openArchive = file => Mpq.open(file), readFile = file => fs.readFile(file), stat = file => fs.stat(file), warn = message => console.warn(message), maxBytes = 256 * 1024 * 1024, maxReaders = 16, casc = null } = {}) {
    Object.assign(this, { openArchive, readFile, stat, warn, maxBytes, maxReaders, casc });
    this.readers = new Map(); this.cache = new Map(); this.warnings = new Set(); this.bytes = 0; this.closing = new Set();
  }
  warning(key, message) {
    if (this.warnings.has(key)) return;
    // A malformed asset should neither abort the batch nor flood the log.
    if (this.warnings.size < 100) { this.warnings.add(key); this.warn('Texture lookup: ' + message); }
  }
  acquire(file) {
    if (!this.readers.has(file)) this.readers.set(file, { active: 0, reader: Promise.resolve().then(() => this.openArchive(file)).catch(error => {
      if (error.code !== 'ENOENT') this.warning(file, path.basename(file) + ': ' + error.message);
      return null;
    }) });
    const entry = this.readers.get(file); this.readers.delete(file); this.readers.set(file, entry); entry.active++;
    return entry;
  }
  trimReaders() {
    for (const [file, entry] of this.readers) {
      if (this.readers.size <= this.maxReaders) break;
      if (entry.active) continue;
      this.readers.delete(file);
      const operation = entry.reader.then(reader => reader?.close()).catch(() => {});
      this.closing.add(operation); operation.finally(() => this.closing.delete(operation));
    }
  }
  async loose(name, roots) {
    const relative = name.replace(/[\\/]+/g, path.sep);
    for (const folder of roots) for (const candidate of unique([path.resolve(folder, relative), path.resolve(folder, path.basename(relative))])) {
        if (!candidate.toLowerCase().startsWith(folder.toLowerCase() + path.sep)) continue;
        try {
          const info = await this.stat(candidate);
          if (!info.isFile() || info.size > 64 * 1024 * 1024) continue;
          return await this.readFile(candidate);
        } catch (error) { if (!['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) this.warning(candidate, path.basename(candidate) + ': ' + error.message); }
    }
    return null;
  }
  async archived(name, files) {
    if (!files.length) return null;
    const cacheKey = JSON.stringify(files) + '|' + name.toLowerCase();
    if (this.cache.has(cacheKey)) {
      const bytes = this.cache.get(cacheKey); this.cache.delete(cacheKey); this.cache.set(cacheKey, bytes); return bytes;
    }
    let bytes = null;
    for (const file of files) {
      const entry = this.acquire(file);
      try { const reader = await entry.reader; if (!reader) continue; bytes = await reader.read(name); if (bytes) break; }
      catch (error) { this.warning(file + '|' + name, path.basename(file) + ': ' + name + ': ' + error.message); }
      finally { entry.active--; this.trimReaders(); }
    }
    if (this.cache.has(cacheKey)) this.bytes -= this.cache.get(cacheKey)?.length || 0;
    this.cache.set(cacheKey, bytes); this.bytes += bytes?.length || 0;
    while ((this.bytes > this.maxBytes || this.cache.size > 4096) && this.cache.size > 1) {
      const key = this.cache.keys().next().value; this.bytes -= this.cache.get(key)?.length || 0; this.cache.delete(key);
    }
    return bytes;
  }
  async resolve(names, { folders = [], archives = [], fallbackFolders = [], fallbackArchives = [], cascFolders = [], fallbackCascFolders = [] } = {}, extensions = IMAGE_EXTENSIONS) {
    if (!Array.isArray(names)) throw Error('Missing texture paths.');
    const sources = [{ folders: unique(folders), archives: unique(archives), cascFolders }, { folders: unique(fallbackFolders), archives: unique(fallbackArchives), cascFolders: fallbackCascFolders }];
    const found = [];
    for (const name of [...new Set(names)].slice(0, 4096)) {
      if (typeof name !== 'string' || !name || name.includes('\0') || !extensions.includes(path.extname(name).slice(1).toLowerCase())) continue;
      // A fully qualified native module path is an explicit CASC choice. Do
      // not substitute a same-named custom file beside the model for it.
      const nativeModule = /\.w3mod:/i.test(name);
      const nativeName = nativeModule && !/^war3\.w3mod:/i.test(name) ? 'war3.w3mod:' + name : name;
      let bytes = null;
      for (const source of sources) {
        bytes = (!nativeModule && (await this.loose(name, source.folders) || await this.archived(name, source.archives))) || await this.casc?.read(nativeName, source.cascFolders);
        // Reforged can keep event models exclusively in an SD/HD module. This
        // endpoint is also used for them; image lookup retains its own order.
        if (!bytes && !nativeModule && /\.(mdx|mdl)$/i.test(name) && this.casc) {
          for (const module of ['_sd','_hd']) {
            bytes = await this.casc.read(`war3.w3mod:${module}.w3mod:${name}`, source.cascFolders);
            if (bytes) break;
          }
        }
        if (bytes) break;
      }
      if (bytes) found.push({ name, bytes });
    }
    return found;
  }
  async close() {
    await this.casc?.close();
    const readers = [...this.readers.values()]; this.readers.clear(); this.cache.clear(); this.warnings.clear(); this.bytes = 0;
    await Promise.allSettled([...this.closing, ...readers.map(async entry => (await entry.reader)?.close())]);
  }
}

module.exports = { TextureResolver, IMAGE_EXTENSIONS };
