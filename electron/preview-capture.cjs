const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

async function savePreviewCapture(directory, payload) {
  if (!payload || !['png', 'gif'].includes(payload.format)) throw Error('Choose PNG or GIF capture.');
  const bytes = Buffer.from(payload.bytes || []);
  if (bytes.length < 10 || bytes.length > 256 * 1024 * 1024) throw Error('Capture must be smaller than 256 MB.');
  const valid = payload.format === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : ['GIF87a','GIF89a'].includes(bytes.subarray(0, 6).toString('ascii')) && bytes.at(-1) === 0x3b;
  if (!valid) throw Error('Invalid capture image.');
  await fs.mkdir(directory, { recursive: true });
  const name = `Preview-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}.${payload.format}`;
  const destination = path.join(directory, name);
  try { await fs.writeFile(destination, bytes, { flag: 'wx' }); }
  catch (error) { throw Error(`Could not write Screenshots: ${error.message}`); }
  return { name, path: destination };
}
const MAX_CAPTURE_BYTES = 256 * 1024 * 1024;
async function validateGIFFile(file) {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (stat.size < 14 || stat.size > MAX_CAPTURE_BYTES) throw Error('Encoded GIF exceeds the 256 MB capture limit or is empty.');
    const head = Buffer.alloc(13), tail = Buffer.alloc(1);
    await handle.read(head, 0, head.length, 0); await handle.read(tail, 0, 1, stat.size - 1);
    if (!['GIF87a','GIF89a'].includes(head.subarray(0,6).toString('ascii')) || !head.readUInt16LE(6) || !head.readUInt16LE(8) || tail[0] !== 0x3b) throw Error('FFmpeg did not produce a complete GIF.');
    return stat.size;
  } finally { await handle.close(); }
}
async function savePreviewCaptureFile(directory, source) {
  const size = await validateGIFFile(source);
  await fs.mkdir(directory, { recursive: true });
  const name = `Preview-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(6).toString('hex')}.gif`;
  const destination = path.join(directory, name);
  // COPYFILE_EXCL preserves unique/no-overwrite semantics, including retries.
  try { await fs.copyFile(source, destination, 1); }
  catch (error) { throw Error(`Could not write Screenshots: ${error.message}`); }
  return { name, path: destination, size };
}
module.exports = { savePreviewCapture, savePreviewCaptureFile, validateGIFFile, MAX_CAPTURE_BYTES };
