const fs = require('node:fs/promises');
const path = require('node:path');

class BitsAndPartsLibrary {
  constructor(directory) { this.directory = path.resolve(directory); this.openedPaths = new Set(); }
  async list() {
    await fs.mkdir(this.directory, { recursive: true });
    if ((await fs.lstat(this.directory)).isSymbolicLink()) throw Error('BitsAndParts must be a regular folder.');
    let count = 0;
    const visit = async (directory, depth = 0) => {
      if (depth > 32) throw Error('BitsAndParts folders are nested more than 32 levels deep.');
      const entries = await fs.readdir(directory, { withFileTypes: true }), children = [];
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const full = path.join(directory, entry.name), id = path.relative(this.directory, full).split(path.sep).join('/');
        if (entry.isDirectory()) children.push({ id, name: entry.name, type: 'folder', children: await visit(full, depth + 1) });
        else if (entry.isFile() && /\.(mdl|mdx)$/i.test(entry.name)) children.push({ id, name: entry.name, type: 'model' });
        if (++count > 10000) throw Error('BitsAndParts contains more than 10,000 entries. Split it into smaller libraries.');
      }
      return children.sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || a.name.localeCompare(b.name, undefined, { numeric: true }));
    };
    return { directory: this.directory, name: 'BitsAndParts', children: await visit(this.directory) };
  }
  async read(id) {
    if (typeof id !== 'string' || !id || id.includes('\0') || !/\.(mdl|mdx)$/i.test(id)) throw Error('Choose an MDL or MDX part.');
    const file = path.resolve(this.directory, id), relative = path.relative(this.directory, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('The part must be inside BitsAndParts.');
    const root = await fs.realpath(this.directory), real = await fs.realpath(file), realRelative = path.relative(root, real);
    if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw Error('The part must be inside BitsAndParts.');
    // Reject symlinked paths even when they point back inside the bank.
    let segment = this.directory;
    for (const name of relative.split(path.sep)) { segment = path.join(segment, name); if ((await fs.lstat(segment)).isSymbolicLink()) throw Error('Linked parts are not supported.'); }
    const info = await fs.stat(file);
    if (!info.isFile() || info.size > 128 * 1024 * 1024) throw Error('Choose a readable part smaller than 128 MB.');
    const bytes = await fs.readFile(file); this.openedPaths.add(file);
    return { id, name: path.basename(file), path: file, bytes };
  }
}
module.exports = { BitsAndPartsLibrary };
