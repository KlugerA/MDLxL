const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function showcaseDirectory(root, modelName) {
  let name = String(modelName || 'Untitled').split(/[\\/]/).at(-1).replace(/\.(mdl|mdx)$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim();
  if (!name || /^\.+$/.test(name)) name = 'Untitled';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
  return path.join(root, name.slice(0, 120));
}

async function savePreviewCapture(directory, payload) {
  if (!payload || !['png', 'gif'].includes(payload.format)) throw Error('Choose PNG or GIF capture.');
  const bytes = Buffer.from(payload.bytes || []);
  if (bytes.length < 10 || bytes.length > 256 * 1024 * 1024) throw Error('Capture must be smaller than 256 MB.');
  const valid = payload.format === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : ['GIF87a','GIF89a'].includes(bytes.subarray(0, 6).toString('ascii')) && bytes.at(-1) === 0x3b;
  if (!valid) throw Error('Invalid capture image.');
  directory = showcaseDirectory(directory, payload.modelName);
  const modelDirectory = directory;
  if (payload.screenshotBatch !== undefined) {
    if (payload.format !== 'png' || !/^[a-zA-Z0-9-]{1,64}$/.test(payload.screenshotBatch) || !Number.isInteger(payload.shotIndex) || payload.shotIndex < 1 || payload.shotIndex > 20) throw Error('Invalid screenshot batch.');
    directory = showcaseDirectory(directory, path.basename(showcaseDirectory('', payload.animationName || 'Animation')).slice(0, 60) + '-screenshots-' + payload.screenshotBatch);
  }
  await fs.mkdir(directory, { recursive: true });
  const name = `Preview-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}.${payload.format}`;
  const destination = path.join(directory, name);
  try { await fs.writeFile(destination, bytes, { flag: 'wx' }); }
  catch (error) { throw Error(`Could not write Showcase Recordings: ${error.message}`); }
  return { name, path: destination, modelDirectory };
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
// GIF89a blocks: https://www.w3.org/Graphics/GIF/spec-gif89a.txt
// Join sections sharing one global palette without decoding/re-quantizing any
// image. One header, one loop extension and one trailer serve the whole GIF.
async function joinGIFSections(files, destination) {
  const output = await fs.open(destination, 'wx');
  let header, bytes = 0, frames = 0, duration = 0;
  try {
    for (let index = 0; index < files.length; index++) {
      await validateGIFFile(files[index]);
      const data = await fs.readFile(files[index]);
      const headerEnd = 13 + (data[10] & 128 ? 3 * (1 << ((data[10] & 7) + 1)) : 0);
      if (headerEnd >= data.length) throw Error('Incomplete GIF section palette.');
      if (!header) header = Buffer.from(data.subarray(0, headerEnd));
      else if (!data.subarray(6, headerEnd).equals(header.subarray(6))) throw Error('GIF sections must share their size and palette.');
      let offset = headerEnd, sectionFrames = 0, finished = false;
      const ranges = index === 0 ? [{ start: 0, end: headerEnd }] : [];
      const take = length => { if (offset + length > data.length) throw Error('Incomplete GIF section.'); offset += length; };
      const blocks = () => { for (;;) { take(1); const length = data[offset - 1]; if (!length) return; take(length); } };
      while (offset < data.length) {
        const start = offset, type = data[offset++];
        let keep = true;
        if (type === 0x3b) { if (offset !== data.length) throw Error('GIF section has data after its trailer.'); finished = true; break; }
        if (type === 0x21) {
          take(1); const label = data[offset - 1];
          if (label === 0xf9) { if (data[offset] !== 4 || offset + 6 > data.length) throw Error('Invalid GIF frame control.'); duration += data.readUInt16LE(offset + 2) * 10; }
          if (index > 0 && label === 0xff && data.subarray(offset + 1, offset + 12).toString() === 'NETSCAPE2.0') keep = false;
          blocks();
        } else if (type === 0x2c) {
          take(9); const descriptor = offset - 9, packed = data[offset - 1];
          if (sectionFrames === 0 && (data.readUInt16LE(descriptor) || data.readUInt16LE(descriptor + 2) || data.readUInt16LE(descriptor + 4) !== header.readUInt16LE(6) || data.readUInt16LE(descriptor + 6) !== header.readUInt16LE(8))) throw Error('GIF section must start with a complete frame.');
          if (packed & 128) take(3 * (1 << ((packed & 7) + 1)));
          take(1); blocks(); sectionFrames++; frames++;
        } else throw Error('Invalid GIF section block.');
        if (keep) { const previous = ranges.at(-1); if (previous?.end === start) previous.end = offset; else ranges.push({ start, end: offset }); }
      }
      if (!finished || !sectionFrames) throw Error('Incomplete GIF section.');
      for (const range of ranges) {
        bytes += range.end - range.start;
        if (bytes + 1 > MAX_CAPTURE_BYTES) throw Error('Encoded GIF exceeds the 256 MB capture limit.');
        await output.writeFile(data.subarray(range.start, range.end));
      }
    }
    if (!frames) throw Error('GIF contains no frames.');
    await output.writeFile(Buffer.from([0x3b]));
    return { frames, duration };
  } finally { await output.close(); }
}

async function savePreviewCaptureFile(directory, source) {
  const size = await validateGIFFile(source);
  await fs.mkdir(directory, { recursive: true });
  const name = `Preview-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(6).toString('hex')}.gif`;
  const destination = path.join(directory, name);
  // COPYFILE_EXCL preserves unique/no-overwrite semantics, including retries.
  try { await fs.copyFile(source, destination, 1); }
  catch (error) { throw Error(`Could not write Showcase Recordings: ${error.message}`); }
  return { name, path: destination, size };
}
module.exports = { savePreviewCapture, savePreviewCaptureFile, validateGIFFile, MAX_CAPTURE_BYTES, showcaseDirectory, joinGIFSections };
