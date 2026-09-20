import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMdl } from '../src/index.js';

test('retains MDL spelling, comments, whitespace, unknown blocks, and bytes', () => {
  const prefix = Buffer.from(
    '// preservation fixture\r\nVersion { FormatVersion 0800, }\r\n' +
    'UnknownExtension "literal \\ path" { Value -1.2500e+02, } // tail\r\n',
    'ascii',
  );
  const input = Buffer.concat([prefix, Buffer.from([0x2f, 0x2f, 0x20, 0xe9, 0x0d, 0x0a])]);
  const document = parseMdl(input);

  assert.equal(document.version, 800);
  assert.equal(document.hasErrors, false);
  assert.ok(document.tokens.some((item) => item.kind === 'line-comment'));
  assert.ok(document.tokens.some((item) => item.kind === 'string'));
  assert.ok(document.tokens.some((item) => item.kind === 'number' && item.raw.toString() === '-1.2500e+02'));
  assert.deepEqual(document.toBytes(), input);
});

test('detects format versions 800, 900, 1000, and 1100', () => {
  for (const version of [800, 900, 1000, 1100]) {
    const document = parseMdl(`Version {\n  FormatVersion ${version},\n}\n`);
    assert.equal(document.version, version);
    assert.equal(document.summary().supportedVersion, true);
  }
});

test('reports but preserves an unterminated string', () => {
  const input = Buffer.from('Version { FormatVersion 800, }\nModel "unfinished');
  const document = parseMdl(input);
  assert.ok(document.diagnostics.some((item) => item.code === 'MDL_UNTERMINATED_STRING'));
  assert.deepEqual(document.toBytes(), input);
});

test('MDL backslashes are literal, including before the closing quote', () => {
  for (const suffix of ['\\', '\\\\']) {
    const path = `Textures${suffix}`;
    const source = `Version { FormatVersion 800, }\nTextures 1 { Bitmap { Image "${path}", } }`;
    const document = parseMdl(source);
    assert.equal(document.hasErrors, false);
    assert.equal(document.tokens.find((t) => t.kind === 'string').raw.toString(), `"${path}"`);
    assert.equal(document.toBytes().toString(), source);
  }
});

test('C-style escaped quotes are not interpreted as embedded MDL quotes', () => {
  const source = 'Version { FormatVersion 800, }\nModel "quoted \\" name" {}';
  const document = parseMdl(source);
  assert.equal(document.tokens.find((t) => t.kind === 'string').raw.toString(), '"quoted \\"');
  assert.equal(document.hasErrors, true);
  assert.equal(document.toBytes().toString(), source);
});

test('block-comment quotes and version words are trivia and remain untouched', () => {
  const source = '/* FormatVersion 1200; " unmatched quote */\nVersion { FormatVersion 800, }';
  const document = parseMdl(source);
  assert.equal(document.hasErrors, false);
  assert.equal(document.version, 800);
  assert.equal(document.toBytes().toString(), source);
});

test('does not mistake a commented FormatVersion for the document version', () => {
  const document = parseMdl('// FormatVersion 1100\nVersion { FormatVersion 900, }');
  assert.equal(document.version, 900);
});

test('warns about missing and unsupported versions without changing bytes', () => {
  const missing = parseMdl('Model "x" {}');
  const unsupportedInput = Buffer.from('Version { FormatVersion 777, }');
  const unsupported = parseMdl(unsupportedInput);

  assert.ok(missing.diagnostics.some((item) => item.code === 'MDL_MISSING_VERSION'));
  assert.ok(unsupported.diagnostics.some((item) => item.code === 'MDL_UNSUPPORTED_VERSION'));
  assert.deepEqual(unsupported.toBytes(), unsupportedInput);
});
