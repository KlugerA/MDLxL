const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
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
  if (bytes.length < 10 || bytes.length > MAX_CAPTURE_BYTES) throw Error('Capture must be smaller than 256 MB.');
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
// Only renderer-supplied byte buffers use this IPC/memory limit. Native GIFs
// stay on disk and are bounded by the recording store's disk-space budget.
const MAX_CAPTURE_BYTES = 256 * 1024 * 1024;
async function validateGIFFile(file) {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (stat.size < 14) throw Error('FFmpeg did not produce a complete GIF.');
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
  let header, frames = 0, duration = 0;
  try {
    for (let index = 0; index < files.length; index++) {
      const size = await validateGIFFile(files[index]);
      const input = await fs.open(files[index], 'r');
      try {
        // Scan block boundaries in a fixed-size window. Never allocate a whole
        // encoded section, even when a long high-quality take exceeds 256 MB.
        const buffer = Buffer.allocUnsafe(1024 * 1024);
        let offset = 0, windowStart = -1, windowEnd = -1;
        const take = async length => {
          if (offset + length > size) throw Error('Incomplete GIF section.');
          if (offset < windowStart || offset + length > windowEnd) {
            windowStart = offset; let filled = 0;
            while (filled < length) {
              const result = await input.read(buffer, filled, Math.min(buffer.length - filled, size - offset - filled), offset + filled);
              if (!result.bytesRead) throw Error('Incomplete GIF section.');
              filled += result.bytesRead;
            }
            windowEnd = windowStart + filled;
          }
          const result = buffer.subarray(offset - windowStart, offset - windowStart + length);
          offset += length; return result;
        };
        const skip = length => { if (offset + length > size) throw Error('Incomplete GIF section.'); offset += length; };
        const blocks = async () => { for (;;) { const length = (await take(1))[0]; if (!length) return; skip(length); } };
        const logicalScreen = Buffer.from(await take(13));
        const paletteSize = logicalScreen[10] & 128 ? 3 * (1 << ((logicalScreen[10] & 7) + 1)) : 0;
        const sectionHeader = paletteSize ? Buffer.concat([logicalScreen, await take(paletteSize)]) : logicalScreen;
        if (offset >= size) throw Error('Incomplete GIF section palette.');
        if (!header) header = sectionHeader;
        else if (!sectionHeader.subarray(6).equals(header.subarray(6))) throw Error('GIF sections must share their size and palette.');
        let sectionFrames = 0, finished = false;
        const ranges = index === 0 ? [{ start: 0, end: offset }] : [];
        while (offset < size) {
          const start = offset, type = (await take(1))[0];
          let keep = true;
          if (type === 0x3b) { if (offset !== size) throw Error('GIF section has data after its trailer.'); finished = true; break; }
          if (type === 0x21) {
            const label = (await take(1))[0], length = (await take(1))[0];
            const first = await take(length);
            if (label === 0xf9) {
              if (length !== 4) throw Error('Invalid GIF frame control.');
              duration += first.readUInt16LE(1) * 10;
              if ((await take(1))[0] !== 0) throw Error('Invalid GIF frame control.');
            } else {
              if (index > 0 && label === 0xff && first.toString('ascii') === 'NETSCAPE2.0') keep = false;
              if (length) await blocks();
            }
          } else if (type === 0x2c) {
            const descriptor = await take(9), packed = descriptor[8];
            if (sectionFrames === 0 && (descriptor.readUInt16LE(0) || descriptor.readUInt16LE(2) || descriptor.readUInt16LE(4) !== header.readUInt16LE(6) || descriptor.readUInt16LE(6) !== header.readUInt16LE(8))) throw Error('GIF section must start with a complete frame.');
            if (packed & 128) skip(3 * (1 << ((packed & 7) + 1)));
            skip(1); await blocks(); sectionFrames++; frames++;
          } else throw Error('Invalid GIF section block.');
          if (keep) { const previous = ranges.at(-1); if (previous?.end === start) previous.end = offset; else ranges.push({ start, end: offset }); }
        }
        if (!finished || !sectionFrames) throw Error('Incomplete GIF section.');
        for (const range of ranges) {
          for await (const chunk of createReadStream(files[index], { start: range.start, end: range.end - 1, highWaterMark: 1024 * 1024 })) await output.writeFile(chunk);
        }
      } finally { await input.close(); }
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
