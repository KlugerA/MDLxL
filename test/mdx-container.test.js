import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMdx, SUPPORTED_FORMAT_VERSIONS } from '../src/index.js';

function chunk(tag, payload) {
  const header = Buffer.alloc(8);
  header.write(tag, 0, 4, 'latin1');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

function u32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

test('retains reordered and unknown MDX chunks byte-identically', () => {
  const input = Buffer.concat([
    Buffer.from('MDLX'),
    chunk('ZZZZ', Buffer.from([1, 2, 3])),
    chunk('VERS', u32(800)),
    chunk('MODL', Buffer.from('opaque model payload')),
    chunk('ABCD', Buffer.from([0xff, 0x00])),
  ]);
  const document = parseMdx(input);

  assert.deepEqual(document.chunks.map((item) => item.tag), ['ZZZZ', 'VERS', 'MODL', 'ABCD']);
  assert.equal(document.version, 800);
  assert.equal(document.chunks[0].known, false);
  assert.deepEqual(document.toBytes(), input);
});

test('detects all target format versions', () => {
  for (const version of SUPPORTED_FORMAT_VERSIONS) {
    const input = Buffer.concat([Buffer.from('MDLX'), chunk('VERS', u32(version))]);
    const document = parseMdx(input);
    assert.equal(document.version, version);
    assert.equal(document.summary().supportedVersion, true);
  }
});

test('accepts a no-geoset effect-style container', () => {
  const input = Buffer.concat([
    Buffer.from('MDLX'),
    chunk('VERS', u32(800)),
    chunk('PRE2', Buffer.from([0, 1, 2, 3])),
  ]);
  const document = parseMdx(input);
  assert.equal(document.hasErrors, false);
  assert.equal(document.chunks.some((item) => item.tag === 'GEOS'), false);
});

test('reports a truncated chunk header and retains its bytes', () => {
  const input = Buffer.concat([Buffer.from('MDLX'), Buffer.from('TAIL!')]);
  const document = parseMdx(input);
  assert.equal(document.diagnostics[0].code, 'MDX_TRUNCATED_CHUNK_HEADER');
  assert.deepEqual(document.trailingBytes, Buffer.from('TAIL!'));
  assert.deepEqual(document.toBytes(), input);
});

test('reports a truncated payload without reading out of bounds', () => {
  const header = Buffer.alloc(8);
  header.write('TEST', 0, 4, 'ascii');
  header.writeUInt32LE(50, 4);
  const input = Buffer.concat([Buffer.from('MDLX'), header, Buffer.from([1, 2])]);
  const document = parseMdx(input);
  assert.equal(document.chunks[0].complete, false);
  assert.equal(document.chunks[0].data.length, 2);
  assert.ok(document.diagnostics.some((item) => item.code === 'MDX_TRUNCATED_CHUNK_PAYLOAD'));
  assert.deepEqual(document.toBytes(), input);
});

test('reports invalid magic without losing the original', () => {
  const input = Buffer.from('NOPE and more');
  const document = parseMdx(input);
  assert.equal(document.hasErrors, true);
  assert.equal(document.diagnostics[0].code, 'MDX_INVALID_MAGIC');
  assert.deepEqual(document.toBytes(), input);
});

test('diagnoses duplicate and short VERS chunks', () => {
  const input = Buffer.concat([
    Buffer.from('MDLX'),
    chunk('VERS', Buffer.from([0x20])),
    chunk('VERS', u32(1000)),
  ]);
  const document = parseMdx(input);
  assert.equal(document.version, 1000);
  assert.ok(document.diagnostics.some((item) => item.code === 'MDX_DUPLICATE_VERSION'));
  assert.ok(document.diagnostics.some((item) => item.code === 'MDX_SHORT_VERSION_CHUNK'));
});
