import { Buffer } from 'buffer';
import { diagnostic } from './diagnostic.js';
import { SUPPORTED_FORMAT_VERSIONS } from './mdx-container.js';

const isWhitespace = (byte) => byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c;
const isDigit = (byte) => byte >= 0x30 && byte <= 0x39;
const isIdentStart = (byte) =>
  (byte >= 0x41 && byte <= 0x5a) ||
  (byte >= 0x61 && byte <= 0x7a) ||
  byte === 0x5f || byte === 0x24;
const isIdentPart = (byte) => isIdentStart(byte) || isDigit(byte) || byte === 0x2e;
const isNumberStart = (bytes, index) => {
  const byte = bytes[index];
  if (isDigit(byte)) return true;
  if (byte === 0x2e) return isDigit(bytes[index + 1]);
  if (byte === 0x2b || byte === 0x2d) {
    return isDigit(bytes[index + 1]) || (bytes[index + 1] === 0x2e && isDigit(bytes[index + 2]));
  }
  return false;
};

function asBuffer(input) {
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  if (Buffer.isBuffer(input)) return Buffer.from(input);
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('Expected a string, Buffer, or Uint8Array');
}

function token(kind, bytes, start, end) {
  return Object.freeze({ kind, start, end, raw: Buffer.from(bytes.subarray(start, end)) });
}

function isTrivia(item) {
  return item.kind === 'whitespace' || item.kind === 'line-comment' || item.kind === 'block-comment';
}

/**
 * Warcraft MDL strings end at the next quote. Backslashes are literal path
 * characters, including the one immediately before a closing quote. This
 * matches MDLVis and war3-model; C/JSON-style escaped quotes are not supported.
 */
export function mdlStringEnd(bytes, start) {
  const end = bytes.indexOf(0x22, start + 1);
  return end < 0 ? -1 : end + 1;
}

function tokenAscii(item) {
  return item.raw.toString('ascii');
}

export class MdlDocument {
  #original;

  constructor(original, tokens, diagnostics, version) {
    this.#original = original;
    this.tokens = tokens;
    this.diagnostics = diagnostics;
    this.version = version;
  }

  get hasErrors() {
    return this.diagnostics.some((item) => item.severity === 'error');
  }

  /** Return the exact input bytes. No formatting or repairs are applied. */
  toBytes() {
    return Buffer.from(this.#original);
  }

  summary() {
    const counts = {};
    for (const item of this.tokens) counts[item.kind] = (counts[item.kind] ?? 0) + 1;
    return {
      format: 'mdl',
      byteLength: this.#original.length,
      version: this.version,
      supportedVersion: SUPPORTED_FORMAT_VERSIONS.includes(this.version),
      tokenCount: this.tokens.length,
      tokenKinds: counts,
      diagnostics: this.diagnostics,
    };
  }
}

export function parseMdl(input) {
  const bytes = asBuffer(input);
  const diagnostics = [];
  const tokens = [];
  let cursor = 0;

  while (cursor < bytes.length) {
    const start = cursor;
    const byte = bytes[cursor];

    if (isWhitespace(byte)) {
      cursor += 1;
      while (cursor < bytes.length && isWhitespace(bytes[cursor])) cursor += 1;
      tokens.push(token('whitespace', bytes, start, cursor));
      continue;
    }

    if (byte === 0x2f && bytes[cursor + 1] === 0x2f) {
      cursor += 2;
      while (cursor < bytes.length && bytes[cursor] !== 0x0a && bytes[cursor] !== 0x0d) cursor += 1;
      tokens.push(token('line-comment', bytes, start, cursor));
      continue;
    }

    if (byte === 0x22) {
      const end = mdlStringEnd(bytes, cursor);
      const terminated = end >= 0;
      cursor = terminated ? end : bytes.length;
      tokens.push(token('string', bytes, start, cursor));
      if (!terminated) {
        diagnostics.push(diagnostic('error', 'MDL_UNTERMINATED_STRING', 'String reaches end of file without a closing quote.', start));
      }
      continue;
    }

    if (byte === 0x2f && bytes[cursor + 1] === 0x2a) {
      const end = bytes.indexOf(Buffer.from('*/'), cursor + 2);
      cursor = end < 0 ? bytes.length : end + 2;
      tokens.push(token('block-comment', bytes, start, cursor));
      if (end < 0) diagnostics.push(diagnostic('error', 'MDL_UNTERMINATED_BLOCK_COMMENT', 'Block comment reaches end of file without a closing */.', start));
      continue;
    }

    if (isIdentStart(byte)) {
      cursor += 1;
      while (cursor < bytes.length && isIdentPart(bytes[cursor])) cursor += 1;
      tokens.push(token('identifier', bytes, start, cursor));
      continue;
    }

    if (isNumberStart(bytes, cursor)) {
      cursor += 1;
      while (cursor < bytes.length) {
        const current = bytes[cursor];
        if (isDigit(current) || current === 0x2e || current === 0x65 || current === 0x45 || current === 0x2b || current === 0x2d) {
          cursor += 1;
        } else {
          break;
        }
      }
      tokens.push(token('number', bytes, start, cursor));
      continue;
    }

    if (byte === 0x7b || byte === 0x7d || byte === 0x2c || byte === 0x3a) {
      cursor += 1;
      tokens.push(token('symbol', bytes, start, cursor));
      continue;
    }

    cursor += 1;
    tokens.push(token('other', bytes, start, cursor));
  }

  const significant = tokens.filter((item) => !isTrivia(item));
  let version = null;
  for (let index = 0; index < significant.length - 1; index += 1) {
    if (significant[index].kind === 'identifier' && tokenAscii(significant[index]) === 'FormatVersion') {
      const candidate = significant[index + 1];
      if (candidate.kind === 'number') {
        const parsed = Number.parseInt(tokenAscii(candidate), 10);
        if (Number.isFinite(parsed)) version = parsed;
      }
      break;
    }
  }

  if (version === null) {
    diagnostics.push(diagnostic('warning', 'MDL_MISSING_VERSION', 'No FormatVersion value was found.', 0));
  } else if (!SUPPORTED_FORMAT_VERSIONS.includes(version)) {
    diagnostics.push(diagnostic(
      'warning',
      'MDL_UNSUPPORTED_VERSION',
      `Format version ${version} is retained but has no semantic decoder yet.`,
      0,
      { version, supportedVersions: SUPPORTED_FORMAT_VERSIONS },
    ));
  }

  return new MdlDocument(bytes, tokens, diagnostics, version);
}
