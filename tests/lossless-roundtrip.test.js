import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';

import { parseMdl, parseMdx } from '../src/index.js';

function chunk(tag, payload) {
  const data = Buffer.from(payload);
  const header = Buffer.alloc(8);
  header.write(tag, 0, 4, 'latin1');
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data]);
}

function versionChunk(version) {
  const payload = Buffer.alloc(4);
  payload.writeUInt32LE(version);
  return chunk('VERS', payload);
}

test('MDX lossless container returns an untouched v1800 file byte-for-byte', () => {
  const gliders = Buffer.alloc(12);
  gliders.writeUInt32LE(3, 0);
  gliders.writeUInt32LE(7, 4);
  gliders.writeUInt32LE(11, 8);
  const source = Buffer.concat([
    Buffer.from('MDLX', 'ascii'),
    versionChunk(1800),
    chunk('DILG', gliders),
    chunk('XTRA', Buffer.from([0x00, 0xff, 0x7b, 0x7d, 0x80])),
  ]);

  const document = parseMdx(source);

  assert.equal(document.version, 1800);
  assert.deepEqual(document.chunks.map(({ tag }) => tag), ['VERS', 'DILG', 'XTRA']);
  assert.deepEqual(document.toBytes(), source);
});

test('MDX lossless container retains malformed trailing data for recovery copies', () => {
  const source = Buffer.concat([
    Buffer.from('MDLX', 'ascii'),
    versionChunk(800),
    Buffer.from([0xde, 0xad, 0xbe]),
  ]);

  const document = parseMdx(source);

  assert.equal(document.hasErrors, true);
  assert.deepEqual(document.trailingBytes, Buffer.from([0xde, 0xad, 0xbe]));
  assert.deepEqual(document.toBytes(), source);
});

test('MDL lossless container returns HiveWorkshop and engine dialect text byte-for-byte', () => {
  const source = Buffer.from([
    '// Retain CRLF, comments, community spellings, and engine slot syntax.\r\n',
    'Version { FormatVersion 1100, }\r\n',
    'Materials 1 {\r\n',
    '\tMaterial {\r\n',
    '\t\tSortPrimitives,\r\n',
    '\t\tLayer {\r\n',
    '\t\t\tFilterMode None,\r\n',
    '\t\t\tShaderTypeId 1,\r\n',
    '\t\t\tstatic NormalTextureID 1,\r\n',
    '\t\t\tstatic TextureID 0 <= 0,\r\n',
    '\t\t}\r\n',
    '\t}\r\n',
    '}\r\n',
    'Geoset {\r\n',
    '\tSkinWeights 1 { { 8, 0, 0, 0, 255, 0, 0, 0 }, }\r\n',
    '\tSelectionFlags 12,\r\n',
    '\tLevelOfDetailName "LOD 1",\r\n',
    '}\r\n',
  ].join(''), 'utf8');

  const document = parseMdl(source);

  assert.equal(document.version, 1100);
  assert.deepEqual(document.toBytes(), source);
});
