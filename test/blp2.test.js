import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBlp2 } from '../src/blp2.js';

function blp({ width = 4, height = 4, encoding = 2, alphaDepth = 0, alphaEncoding = 0,
  mips = [new Uint8Array(8)], palette = {}, compact = false } = {}) {
  const start = compact ? 148 : 1172;
  const bytes = new Uint8Array(start + mips.reduce((sum, mip) => sum + (mip?.length ?? 0), 0));
  bytes.set([66, 76, 80, 50]);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 1, true);
  bytes.set([encoding, alphaDepth, alphaEncoding, mips.length > 1 ? 1 : 0], 8);
  view.setUint32(12, width, true);
  view.setUint32(16, height, true);
  for (const [index, rgba] of Object.entries(palette)) {
    bytes.set([rgba[2], rgba[1], rgba[0], rgba[3] ?? 255], 148 + Number(index) * 4);
  }
  let offset = start;
  mips.forEach((mip, level) => {
    if (!mip) return;
    view.setUint32(20 + level * 4, offset, true);
    view.setUint32(84 + level * 4, mip.length, true);
    bytes.set(mip, offset);
    offset += mip.length;
  });
  return bytes;
}

function colorBlock(a = 0xf800, b = 0x001f, indices = 0) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, a, true);
  view.setUint16(2, b, true);
  view.setUint32(4, indices, true);
  return bytes;
}

function join(...parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function pixels(result) {
  return Array.from({ length: result.width * result.height }, (_, index) =>
    [...result.data.slice(index * 4, index * 4 + 4)]);
}

test('palette entries are BGRA; zero-depth alpha ignores palette alpha and input stays unchanged', () => {
  const input = blp({ width: 2, height: 1, encoding: 1, mips: [Uint8Array.of(0, 255)],
    palette: { 0: [12, 34, 56, 0], 255: [90, 80, 70, 2] } });
  const original = input.slice();
  const result = decodeBlp2(input);
  assert.ok(result.data instanceof Uint8ClampedArray);
  assert.deepEqual(pixels(result), [[12, 34, 56, 255], [90, 80, 70, 255]]);
  assert.deepEqual(input, original);
});

test('one-bit alpha is low-bit-first and crosses bytes without row padding', () => {
  const input = blp({ width: 5, height: 2, encoding: 1, alphaDepth: 1,
    mips: [join(new Uint8Array(10), Uint8Array.of(0b10100101, 0b00000010))] });
  assert.deepEqual(pixels(decodeBlp2(input)).map(pixel => pixel[3]),
    [255, 0, 255, 0, 0, 255, 0, 255, 0, 255]);
});

test('four-bit alpha uses low nibble first and handles an odd pixel count', () => {
  const input = blp({ width: 3, height: 1, encoding: 1, alphaDepth: 4,
    mips: [Uint8Array.of(0, 0, 0, 0xf1, 0x08)] });
  assert.deepEqual(pixels(decodeBlp2(input)).map(pixel => pixel[3]), [17, 255, 136]);
});

test('eight-bit palette alpha is a separate plane', () => {
  const input = blp({ width: 2, height: 2, encoding: 1, alphaDepth: 8,
    mips: [Uint8Array.of(1, 1, 1, 1, 0, 63, 128, 255)], palette: { 1: [7, 8, 9, 111] } });
  assert.deepEqual(pixels(decodeBlp2(input)), [[7, 8, 9, 0], [7, 8, 9, 63], [7, 8, 9, 128], [7, 8, 9, 255]]);
});

test('DXT1 decodes RGB565 endpoints and both interpolated colors in scan order', () => {
  const result = decodeBlp2(blp({ mips: [colorBlock(0xf800, 0x001f, 0xe4e4e4e4)] }));
  assert.deepEqual(pixels(result).slice(0, 4), [[255, 0, 0, 255], [0, 0, 255, 255], [170, 0, 85, 255], [85, 0, 170, 255]]);
  assert.deepEqual(pixels(result).slice(12), pixels(result).slice(0, 4));
});

test('DXT1 three-color mode has midpoint and transparent or opaque black according to alpha depth', () => {
  const mip = colorBlock(0, 0xffff, 0xffffffff);
  assert.deepEqual(pixels(decodeBlp2(blp({ alphaDepth: 1, mips: [mip] })))[15], [0, 0, 0, 0]);
  assert.deepEqual(pixels(decodeBlp2(blp({ alphaDepth: 0, mips: [mip] })))[15], [0, 0, 0, 255]);
  assert.deepEqual(pixels(decodeBlp2(blp({ mips: [colorBlock(0, 0xffff, 0xaaaaaaaa)] })))[0], [127, 127, 127, 255]);
});

test('DXT3 decodes all explicit alpha nibbles and forces four colors even when endpoint0 <= endpoint1', () => {
  const alpha = Uint8Array.of(0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe);
  const input = blp({ alphaDepth: 4, alphaEncoding: 1, mips: [join(alpha, colorBlock(0, 0xffff, 0xffffffff))] });
  const actual = pixels(decodeBlp2(input));
  assert.deepEqual(actual.map(pixel => pixel[3]), Array.from({ length: 16 }, (_, i) => i * 17));
  assert.deepEqual(actual[0].slice(0, 3), [170, 170, 170]);
  input[9] = 8;
  assert.deepEqual(pixels(decodeBlp2(input)), actual);
});

function alphaBlock(a, b, codes) {
  // An exact-integer 48-bit fixture, independent of the decoder's byte-window extraction.
  let packed = 0n;
  codes.forEach((code, index) => { packed |= BigInt(code) << BigInt(index * 3); });
  const bytes = Uint8Array.of(a, b, 0, 0, 0, 0, 0, 0);
  for (let byte = 0; byte < 6; byte += 1) bytes[byte + 2] = Number((packed >> BigInt(byte * 8)) & 255n);
  return bytes;
}

for (const [a, b, expected] of [[255, 0, [255, 0, 218, 182, 145, 109, 72, 36]], [0, 255, [0, 255, 51, 102, 153, 204, 0, 255]]]) {
  test(`DXT5 alpha interpolation ${a > b ? 'eight-value' : 'six-value'} mode includes cross-byte and high 48-bit indices`, () => {
    const codes = [0, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1, 0];
    const input = blp({ alphaDepth: 8, alphaEncoding: 7,
      mips: [join(alphaBlock(a, b, codes), colorBlock(0, 0xffff, 0xaaaaaaaa))] });
    const actual = pixels(decodeBlp2(input));
    assert.deepEqual(actual.map(pixel => pixel[3]), codes.map(code => expected[code]));
    assert.deepEqual(actual[0].slice(0, 3), [85, 85, 85]);
  });
}

test('multiple DXT blocks preserve row stride and clip physical padding', () => {
  const input = blp({ width: 5, height: 5,
    mips: [join(colorBlock(0xf800), colorBlock(0x07e0), colorBlock(0x001f), colorBlock(0xffff))] });
  const actual = pixels(decodeBlp2(input));
  assert.equal(actual.length, 25);
  assert.deepEqual(actual[0], [255, 0, 0, 255]);
  assert.deepEqual(actual[4], [0, 255, 0, 255]);
  assert.deepEqual(actual[5], [255, 0, 0, 255]);
  assert.deepEqual(actual[20], [0, 0, 255, 255]);
  assert.deepEqual(actual[24], [255, 255, 255, 255]);
});

test('mip dimensions halve independently and clamp to one; compact DXT header is supported', () => {
  const input = blp({ width: 4, height: 2, compact: true,
    mips: [colorBlock(0xf800), colorBlock(0x07e0), colorBlock(0x001f)] });
  assert.deepEqual(decodeBlp2(input, 1), { width: 2, height: 1, data: new Uint8ClampedArray([0, 255, 0, 255, 0, 255, 0, 255]) });
  assert.deepEqual(pixels(decodeBlp2(input, 2)), [[0, 0, 255, 255]]);
  assert.throws(() => decodeBlp2(input, 3), /not stored/);
});

test('raw BGRA supports straight alpha, alpha-free pixels and offset views', () => {
  const input = blp({ width: 2, height: 1, encoding: 3, alphaDepth: 8,
    mips: [Uint8Array.of(30, 20, 10, 50, 60, 70, 80, 90)] });
  const wrapped = new Uint8Array(input.length + 19);
  wrapped.set(input, 7);
  assert.deepEqual(pixels(decodeBlp2(new DataView(wrapped.buffer, 7, input.length))), [[10, 20, 30, 50], [80, 70, 60, 90]]);
  input[9] = 0;
  assert.deepEqual(pixels(decodeBlp2(input.buffer)), [[10, 20, 30, 255], [80, 70, 60, 255]]);
});

test('rejects invalid input, magic, header, type, dimensions and mip index', () => {
  assert.throws(() => decodeBlp2('BLP2'), TypeError);
  assert.throws(() => decodeBlp2(new Uint8Array(147)), /truncated header/);
  const valid = blp();
  for (const level of [-1, 16, 1.5, NaN, Infinity]) assert.throws(() => decodeBlp2(valid, level), /mip level/);
  for (const [offset, value, pattern] of [[0, 0, /magic/], [4, 0, /type/], [12, 0, /width and height/], [16, 0, /width and height/]]) {
    const input = valid.slice();
    new DataView(input.buffer).setUint32(offset, value, true);
    assert.throws(() => decodeBlp2(input), pattern);
  }
});

test('rejects unsupported and contradictory encoding fields', () => {
  for (const [encoding, depth, alphaEncoding, pattern] of [[4, 0, 0, /unsupported encoding/], [1, 2, 0, /alpha depth/], [2, 8, 0, /DXT alpha/], [2, 8, 5, /DXT alpha/], [2, 1, 7, /DXT alpha/], [3, 4, 0, /BGRA alpha/]]) {
    const input = blp();
    input.set([encoding, depth, alphaEncoding], 8);
    assert.throws(() => decodeBlp2(input), pattern);
  }
});

test('rejects truncated palette, packed alpha, DXT block and raw pixels', () => {
  assert.throws(() => decodeBlp2(blp({ encoding: 1 }).subarray(0, 1171)), /truncated.*palette/);
  for (const options of [
    { width: 1, height: 1, encoding: 1, alphaDepth: 1, mips: [Uint8Array.of(0)] },
    { mips: [new Uint8Array(7)] },
    { alphaDepth: 8, alphaEncoding: 7, mips: [new Uint8Array(15)] },
    { width: 1, height: 1, encoding: 3, alphaDepth: 8, mips: [new Uint8Array(3)] },
  ]) assert.throws(() => decodeBlp2(blp(options)), /payload is truncated/);
});

test('range checks cannot read outside a view or into header/palette; validate even unselected mips', () => {
  const valid = blp();
  for (const [field, value, pattern] of [[20, 0, /incomplete/], [20, 100, /overlaps/], [20, 0xffffffff, /outside/], [84, 0xffffffff, /outside/], [84, 0, /incomplete/], [24, 999999, /incomplete/]]) {
    const input = valid.slice();
    new DataView(input.buffer).setUint32(field, value, true);
    assert.throws(() => decodeBlp2(input), pattern);
  }
  const input = valid.slice();
  const view = new DataView(input.buffer);
  view.setUint32(24, 0xfffffff0, true);
  view.setUint32(88, 16, true);
  assert.throws(() => decodeBlp2(input), /mip 1 range is outside/);
  assert.throws(() => decodeBlp2(valid.subarray(0, valid.length - 1)), /outside/);
  const huge = valid.slice();
  new DataView(huge.buffer).setUint32(12, 0xffffffff, true);
  new DataView(huge.buffer).setUint32(16, 0xffffffff, true);
  assert.throws(() => decodeBlp2(huge), /truncated/);
});
