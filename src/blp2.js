/**
 * Browser-safe BLP2 decoding. No DOM, Buffer, WebGL or native dependencies.
 *
 * Format references (independent implementation, no copied decoder code):
 * https://github.com/Kanma/BLPConverter (BLP2 encodings and palette alpha)
 * https://github.com/python-pillow/Pillow/blob/main/src/PIL/BlpImagePlugin.py
 * https://learn.microsoft.com/en-us/windows/win32/direct3d10/d3d10-graphics-programming-guide-resources-block-compression
 *
 * BLP2 uses little-endian fields, BGRA palette/raw pixels, packed low-bit-first
 * alpha planes, and BC1/BC2/BC3 (DXT1/3/5) blocks. Returned rows are top to bottom;
 * RGBA values are straight (not premultiplied) and are not gamma transformed.
 */

const HEADER_BYTES = 148;
const PALETTE_BYTES = 1024;
// An application allocation guard, not a claim about the BLP format's limits.
const MAX_DECODED_BYTES = 256 * 1024 * 1024;

function fail(message) {
  throw new Error(`BLP2: ${message}`);
}

function asBytes(input) {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('BLP2: expected an ArrayBuffer or an ArrayBuffer view');
}

function mipDimensions(width, height, level) {
  const divisor = 2 ** level;
  return [Math.max(1, Math.floor(width / divisor)), Math.max(1, Math.floor(height / divisor))];
}

function requiredBytes(width, height, encoding, alphaDepth, blockBytes) {
  if (encoding === 1) return width * height + Math.ceil(width * height * alphaDepth / 8);
  if (encoding === 3) return width * height * 4;
  return Math.ceil(width / 4) * Math.ceil(height / 4) * blockBytes;
}

function rgb565(value) {
  const r = (value >>> 11) & 31;
  const g = (value >>> 5) & 63;
  const b = value & 31;
  return [(r << 3) | (r >>> 2), (g << 2) | (g >>> 4), (b << 3) | (b >>> 2), 255];
}

function colorTable(view, offset, forceFourColors, hasAlpha) {
  const a = view.getUint16(offset, true);
  const b = view.getUint16(offset + 2, true);
  const colors = [rgb565(a), rgb565(b), [0, 0, 0, 255], [0, 0, 0, 255]];
  if (forceFourColors || a > b) {
    for (let channel = 0; channel < 3; channel += 1) {
      colors[2][channel] = Math.floor((2 * colors[0][channel] + colors[1][channel]) / 3);
      colors[3][channel] = Math.floor((colors[0][channel] + 2 * colors[1][channel]) / 3);
    }
  } else {
    for (let channel = 0; channel < 3; channel += 1) {
      colors[2][channel] = Math.floor((colors[0][channel] + colors[1][channel]) / 2);
    }
    // BC1 RGB uses opaque black here; BC1 RGBA uses transparent black.
    colors[3][3] = hasAlpha ? 0 : 255;
  }
  return colors;
}

function dxt5AlphaTable(a, b) {
  const values = [a, b];
  if (a > b) {
    for (let index = 2; index < 8; index += 1) {
      values.push(Math.floor(((8 - index) * a + (index - 1) * b) / 7));
    }
  } else {
    for (let index = 2; index < 6; index += 1) {
      values.push(Math.floor(((6 - index) * a + (index - 1) * b) / 5));
    }
    values.push(0, 255);
  }
  return values;
}

function decodeBlocks(source, view, start, width, height, alphaDepth, alphaEncoding, blockBytes, output) {
  const blocksWide = Math.ceil(width / 4);
  const blocksHigh = Math.ceil(height / 4);
  let blockOffset = start;
  for (let blockY = 0; blockY < blocksHigh; blockY += 1) {
    for (let blockX = 0; blockX < blocksWide; blockX += 1) {
      const colorOffset = blockOffset + (blockBytes === 16 ? 8 : 0);
      const colors = colorTable(view, colorOffset, blockBytes === 16, alphaDepth !== 0);
      const colorIndices = view.getUint32(colorOffset + 4, true);
      const alphas = alphaEncoding === 7
        ? dxt5AlphaTable(source[blockOffset], source[blockOffset + 1]) : null;

      for (let localY = 0; localY < 4; localY += 1) {
        const y = blockY * 4 + localY;
        if (y >= height) continue;
        for (let localX = 0; localX < 4; localX += 1) {
          const x = blockX * 4 + localX;
          if (x >= width) continue;
          const pixel = localY * 4 + localX;
          const color = colors[(colorIndices >>> (pixel * 2)) & 3];
          let alpha = color[3];
          if (alphaEncoding === 1) {
            alpha = ((source[blockOffset + (pixel >>> 1)] >>> ((pixel & 1) * 4)) & 15) * 17;
          } else if (alphaEncoding === 7) {
            // Three-bit indices can cross byte boundaries. Never coerce the
            // complete 48-bit stream through JavaScript's 32-bit bitwise ops.
            const bit = pixel * 3;
            const byte = bit >>> 3;
            const low = source[blockOffset + 2 + byte];
            const high = byte < 5 ? source[blockOffset + 3 + byte] : 0;
            alpha = alphas[((low | (high << 8)) >>> (bit & 7)) & 7];
          }
          const dest = (y * width + x) * 4;
          output[dest] = color[0];
          output[dest + 1] = color[1];
          output[dest + 2] = color[2];
          output[dest + 3] = alpha;
        }
      }
      blockOffset += blockBytes;
    }
  }
}

/**
 * Decode one stored BLP2 mipmap into straight RGBA pixels.
 *
 * Supports palette alpha 0/1/4/8, DXT1 alpha 0/1, DXT3 alpha 4/8,
 * DXT5 alpha 8, and raw BGRA alpha 0/8. Unknown/contradictory encodings,
 * truncated data, out-of-file mip entries and unsafe allocations throw.
 * Non-power-of-two dimensions can be decoded for inspection; no game-format
 * validation, UV flip, conversion or mip generation is performed here.
 *
 * @param {ArrayBuffer|ArrayBufferView} bytes
 * @param {number} [mipLevel=0] Stored mip slot, 0 through 15.
 * @returns {{width:number,height:number,data:Uint8ClampedArray}}
 */
export function decodeBlp2(bytes, mipLevel = 0) {
  const source = asBytes(bytes);
  if (!Number.isInteger(mipLevel) || mipLevel < 0 || mipLevel > 15) {
    fail('mip level must be an integer from 0 through 15');
  }
  if (source.byteLength < HEADER_BYTES) fail('truncated header (need 148 bytes)');
  if (source[0] !== 66 || source[1] !== 76 || source[2] !== 80 || source[3] !== 50) {
    fail('invalid magic; expected BLP2');
  }
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  if (view.getUint32(4, true) !== 1) fail('unsupported type; only type 1 BLP2 is supported');
  const encoding = source[8];
  const alphaDepth = source[9];
  const alphaEncoding = source[10];
  if (![1, 2, 3].includes(encoding)) fail(`unsupported encoding ${encoding}`);
  if (![0, 1, 4, 8].includes(alphaDepth)) fail(`unsupported alpha depth ${alphaDepth}`);
  let blockBytes = 0;
  if (encoding === 2) {
    if (alphaEncoding === 0 && (alphaDepth === 0 || alphaDepth === 1)) blockBytes = 8;
    else if (alphaEncoding === 1 && (alphaDepth === 4 || alphaDepth === 8)) blockBytes = 16;
    else if (alphaEncoding === 7 && alphaDepth === 8) blockBytes = 16;
    else fail(`unsupported DXT alpha encoding/depth ${alphaEncoding}/${alphaDepth}`);
  }
  if (encoding === 3 && alphaDepth !== 0 && alphaDepth !== 8) {
    fail(`unsupported BGRA alpha depth ${alphaDepth}`);
  }
  const fullWidth = view.getUint32(12, true);
  const fullHeight = view.getUint32(16, true);
  if (!fullWidth || !fullHeight) fail('width and height must be greater than zero');
  const payloadStart = HEADER_BYTES + (encoding === 1 ? PALETTE_BYTES : 0);
  if (source.byteLength < payloadStart) fail('truncated 256-entry BGRA palette');

  // Validate every declared range before decoding; padding in a stored range
  // is allowed, but payloads cannot overlap header/palette or exceed the view.
  // The hasMipmaps byte is deliberately advisory: actual offsets select mips.
  for (let level = 0; level < 16; level += 1) {
    const offset = view.getUint32(20 + level * 4, true);
    const size = view.getUint32(84 + level * 4, true);
    if (offset === 0 && size === 0) continue;
    if (!offset || !size) fail(`mip ${level} has an incomplete offset/size pair`);
    if (offset < payloadStart) fail(`mip ${level} overlaps the header or palette`);
    if (offset > source.byteLength || size > source.byteLength - offset) {
      fail(`mip ${level} range is outside the supplied bytes`);
    }
    const [mipWidth, mipHeight] = mipDimensions(fullWidth, fullHeight, level);
    const expected = requiredBytes(mipWidth, mipHeight, encoding, alphaDepth, blockBytes);
    if (!Number.isSafeInteger(expected) || size < expected) {
      fail(`mip ${level} payload is truncated (needs ${expected} bytes, has ${size})`);
    }
  }

  const start = view.getUint32(20 + mipLevel * 4, true);
  if (!start) fail(`mip ${mipLevel} is not stored`);
  const [width, height] = mipDimensions(fullWidth, fullHeight, mipLevel);
  const pixelCount = width * height;
  const outputBytes = pixelCount * 4;
  if (!Number.isSafeInteger(outputBytes) || outputBytes > MAX_DECODED_BYTES) {
    fail('decoded mip exceeds the 256 MiB application allocation limit');
  }
  const data = new Uint8ClampedArray(outputBytes);
  if (encoding === 1) {
    const alphaStart = start + pixelCount;
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const palette = HEADER_BYTES + source[start + pixel] * 4;
      const dest = pixel * 4;
      data[dest] = source[palette + 2];
      data[dest + 1] = source[palette + 1];
      data[dest + 2] = source[palette];
      let alpha = 255;
      if (alphaDepth === 8) alpha = source[alphaStart + pixel];
      else if (alphaDepth === 4) alpha = ((source[alphaStart + (pixel >>> 1)] >>> ((pixel & 1) * 4)) & 15) * 17;
      else if (alphaDepth === 1) alpha = ((source[alphaStart + (pixel >>> 3)] >>> (pixel & 7)) & 1) * 255;
      data[dest + 3] = alpha;
    }
  } else if (encoding === 3) {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const dest = pixel * 4;
      const src = start + dest;
      data[dest] = source[src + 2];
      data[dest + 1] = source[src + 1];
      data[dest + 2] = source[src];
      data[dest + 3] = alphaDepth === 8 ? source[src + 3] : 255;
    }
  } else {
    decodeBlocks(source, view, start, width, height, alphaDepth, alphaEncoding, blockBytes, data);
  }
  return { width, height, data };
}
