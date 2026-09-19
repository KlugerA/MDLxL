const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function modelBytes(value) {
  const bytes = Buffer.from(value || []);
  if (!bytes.length || bytes.length > 128 * 1024 * 1024) throw Error('Repair requires a nonempty model smaller than 128 MiB.');
  return bytes;
}
async function verifiedWrite(file, bytes) {
  await fs.writeFile(file, bytes, { flag: 'wx' });
  if (!(await fs.readFile(file)).equals(bytes)) throw Error('Repair backup/write verification failed.');
}
async function regularFile(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Repair requires a regular local model file.');
}
async function replaceChecked(file, bytes, expected) {
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    await verifiedWrite(temporary, bytes);
    await regularFile(file);
    if (hash(await fs.readFile(file)) !== expected) throw Error('The model changed on disk. Nothing was overwritten; reopen it before continuing.');
    await fs.rename(temporary, file);
  } finally { await fs.unlink(temporary).catch(() => {}); }
}

// The caller serializes these operations with normal saves. Undo uses an opaque
// receipt, never a renderer-supplied backup path. Backups are retained on disk.
function createGeosetRepairStore(openedPaths) {
  const receipts = new Map();
  return {
    async repair(payload) {
      const file = typeof payload?.path === 'string' ? path.resolve(payload.path) : '';
      if (!file || !openedPaths.has(file) || !['.mdx', '.mdl'].includes(path.extname(file).toLowerCase())) throw Error('Open a local MDL or MDX file before repairing it.');
      const bytes = modelBytes(payload.bytes), before = modelBytes(payload.beforeBytes), expected = modelBytes(payload.expectedDiskBytes);
      await regularFile(file);
      const disk = await fs.readFile(file);
      if (!disk.equals(expected)) throw Error('The model changed on disk. Reopen it before repairing; nothing was overwritten.');
      const id = crypto.randomUUID(), extension = path.extname(file), stem = file.slice(0, -extension.length);
      const backupPath = `${stem}.pre-geoset-repair-${id}${extension}`;
      await verifiedWrite(backupPath, before);
      let diskBackupPath = null;
      if (!before.equals(disk)) {
        diskBackupPath = `${stem}.disk-before-geoset-repair-${id}${extension}`;
        await verifiedWrite(diskBackupPath, disk);
      }
      await replaceChecked(file, bytes, hash(disk));
      receipts.set(id, { file, backupPath, backupHash: hash(before), repairedHash: hash(bytes) });
      return { id, name: path.basename(file), path: file, backupPath, diskBackupPath, bytes };
    },
    async undo(id) {
      const receipt = receipts.get(id);
      if (!receipt) throw Error('This repair Undo is no longer available. The backup file is still retained on disk.');
      await regularFile(receipt.backupPath);
      const bytes = await fs.readFile(receipt.backupPath);
      if (hash(bytes) !== receipt.backupHash) throw Error('The backup changed on disk. Undo was stopped without overwriting the model.');
      await replaceChecked(receipt.file, bytes, receipt.repairedHash);
      receipts.delete(id);
      return { name: path.basename(receipt.file), path: receipt.file, bytes };
    },
  };
}
module.exports = { createGeosetRepairStore };
