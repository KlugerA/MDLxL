import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const arg = name => { const index = args.indexOf(name); if (index < 0 || !args[index + 1]) throw Error(`${name} requires a path.`); return path.resolve(args[index + 1]); };
const collection = arg('--collection'), output = arg('--out');
const provenance = {
  rubberduck:{author:'rubberduck',license:'CC0 1.0',sourceUrl:'https://opengameart.org/content/60-free-gimp-krita-brushes',archive:'60-free-gimp-and-krita-brushes.zip'},
  elduderino:{author:'ElDuderino',license:'CC0 1.0',sourceUrl:'https://opengameart.org/content/scratch-damaged-paint-brush',archive:'scratch-damaged-paint-brush.zip'},
};
const selections = [
  ['painted_bristle', 'Brushes/painted-style_574BB1D2.gih', 0, provenance.rubberduck],
  ['painted_chisel', 'Brushes/painted-style_574BB1D2.gih', 2, provenance.rubberduck],
  ['painted_scumble', 'Brushes/painted-style_574BB1D2.gih', 4, provenance.rubberduck],
  ['fine_grain', 'Misc/fine-grain_AA4E5565.gih', 0, provenance.rubberduck],
  ['surface_scratches', 'Misc/scratches_D4F54D42.gih', 0, provenance.rubberduck],
  ['armor_cracks', 'Misc/cracks_9CA0DCAE.gih', 0, provenance.rubberduck],
  ['chipped_paint', 'Brushes/Damaged Paint_4438BAED.gih', 0, provenance.elduderino],
  ['scuffed_paint', 'Brushes/Damaged Paint_4438BAED.gih', 5, provenance.elduderino],
];

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => { for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0; });
const crc32 = bytes => { let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8; return (value ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const name = Buffer.from(type), result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); name.copy(result, 4); data.copy(result, 8); result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)), 8 + data.length); return result; }
function encodePng(image) {
  const raw = Buffer.alloc((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y++) Buffer.from(image.data.buffer, image.data.byteOffset + y * image.width * 4, image.width * 4).copy(raw, y * (image.width * 4 + 1) + 1);
  const header = Buffer.alloc(13); header.writeUInt32BE(image.width); header.writeUInt32BE(image.height, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function parseGbr(data, offset = 0) {
  if (offset + 20 > data.length) throw Error('Truncated GBR header.');
  const headerSize = data.readUInt32BE(offset), version = data.readUInt32BE(offset + 4), width = data.readUInt32BE(offset + 8), height = data.readUInt32BE(offset + 12), depth = data.readUInt32BE(offset + 16);
  const minimum = version === 1 ? 20 : 28;
  if (![1, 2].includes(version) || headerSize < minimum || width < 1 || height < 1 || ![1, 4].includes(depth)) throw Error(`Unsupported GBR ${version}/${width}×${height}/${depth}.`);
  if (version === 2 && data.toString('ascii', offset + 20, offset + 24) !== 'GIMP') throw Error('Invalid GBR magic.');
  const end = offset + headerSize + width * height * depth; if (end > data.length) throw Error('Truncated GBR pixels.');
  const pixels = data.subarray(offset + headerSize, end), alpha = new Uint8ClampedArray(width * height);
  for (let pixel = 0; pixel < width * height; pixel++) alpha[pixel] = depth === 1 ? pixels[pixel] : Math.round((pixels[pixel * 4] * .2126 + pixels[pixel * 4 + 1] * .7152 + pixels[pixel * 4 + 2] * .0722) * pixels[pixel * 4 + 3] / 255);
  return { width, height, alpha, end };
}

function parseBrushes(data, extension) {
  let offset = 0, expected = 1;
  if (extension === '.gih') {
    const first = data.indexOf(10, offset), second = data.indexOf(10, first + 1); if (first < 0 || second < 0) throw Error('Invalid GIH header.');
    expected = Number.parseInt(data.toString('utf8', first + 1, second), 10); offset = second + 1;
  }
  const brushes = [];
  while (offset < data.length && brushes.length < expected) { const brush = parseGbr(data, offset); brushes.push(brush); offset = brush.end; }
  if (brushes.length !== expected || offset !== data.length) throw Error(`Expected ${expected} brush cells; decoded ${brushes.length}.`);
  return brushes;
}

function squareTip(source, size = 256) {
  let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (source.alpha[y * source.width + x] > 2) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  if (maxX < minX) throw Error('Brush cell has no visible pixels.');
  const width = maxX - minX + 1, height = maxY - minY + 1, scale = (size * .9) / Math.max(width, height), drawWidth = Math.max(1, Math.round(width * scale)), drawHeight = Math.max(1, Math.round(height * scale));
  const left = Math.floor((size - drawWidth) / 2), top = Math.floor((size - drawHeight) / 2), data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < drawHeight; y++) for (let x = 0; x < drawWidth; x++) {
    const sx = Math.min(maxX, minX + Math.floor((x + .5) * width / drawWidth)), sy = Math.min(maxY, minY + Math.floor((y + .5) * height / drawHeight)), value = source.alpha[sy * source.width + sx], offset = ((top + y) * size + left + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = 255; data[offset + 3] = value;
  }
  return { width: size, height: size, data };
}

await fs.mkdir(output, { recursive: true });
const manifest = { schema: 'mdlxl-paint-brush-tips', version: 1, createdAt: new Date().toISOString(), conversion: 'GIH/GBR grayscale mask to cropped 256×256 RGBA PNG', tips: [] };
for (const [id, relative, cell, sourceProvenance] of selections) {
  const source = path.join(collection, ...relative.split('/')), bytes = await fs.readFile(source), brushes = parseBrushes(bytes, path.extname(source).toLowerCase()), brush = brushes[cell];
  if (!brush) throw Error(`${relative} has no brush cell ${cell}.`);
  const encoded = encodePng(squareTip(brush)), file = `${id}.png`; await fs.writeFile(path.join(output, file), encoded);
  manifest.tips.push({ id, file, sourceFile: relative, sourceCell: cell, provenance:sourceProvenance, sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), outputSha256: crypto.createHash('sha256').update(encoded).digest('hex') });
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built ${manifest.tips.length} curated CC0 brush tips.`);
