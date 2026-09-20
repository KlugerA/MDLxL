import { Buffer } from 'buffer';
import { diagnostic } from './diagnostic.js';

const MDX_MAGIC = Buffer.from('MDLX', 'ascii');
export const SUPPORTED_FORMAT_VERSIONS = Object.freeze([800, 900, 1000, 1100, 1200, 1300, 1400, 1600, 1800]);

function asBuffer(input) {
  if (Buffer.isBuffer(input)) return Buffer.from(input);
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('Expected a Buffer or Uint8Array');
}

function tagText(bytes) {
  return bytes.toString('latin1');
}

/**
 * A preservation-oriented view of an MDX container.
 *
 * Chunk payloads are opaque at this layer. That is intentional: a semantic
 * decoder may be added without making the container reader discard chunks it
 * does not understand.
 */
export class MdxDocument {
  #original;

  constructor(original, chunks, trailingBytes, diagnostics, version) {
    this.#original = original;
    this.chunks = chunks;
    this.trailingBytes = trailingBytes;
    this.diagnostics = diagnostics;
    this.version = version;
  }

  get hasErrors() {
    return this.diagnostics.some((item) => item.severity === 'error');
  }

  /** Return the exact input bytes. No canonicalization occurs. */
  toBytes() {
    return Buffer.from(this.#original);
  }

  summary() {
    return {
      format: 'mdx',
      byteLength: this.#original.length,
      magic: this.#original.subarray(0, 4).toString('latin1'),
      version: this.version,
      supportedVersion: SUPPORTED_FORMAT_VERSIONS.includes(this.version),
      chunks: this.chunks.map((chunk) => ({
        tag: chunk.tag,
        offset: chunk.offset,
        declaredSize: chunk.declaredSize,
        actualSize: chunk.data.length,
        complete: chunk.complete,
      })),
      trailingByteLength: this.trailingBytes.length,
      diagnostics: this.diagnostics,
    };
  }
}

export function parseMdx(input) {
  const bytes = asBuffer(input);
  const diagnostics = [];
  const chunks = [];

  if (bytes.length < 4 || !bytes.subarray(0, 4).equals(MDX_MAGIC)) {
    diagnostics.push(diagnostic(
      'error',
      'MDX_INVALID_MAGIC',
      'Expected the four-byte MDLX signature.',
      0,
      { actual: bytes.subarray(0, Math.min(4, bytes.length)).toString('hex') },
    ));
    return new MdxDocument(bytes, chunks, bytes.subarray(Math.min(4, bytes.length)), diagnostics, null);
  }

  let cursor = 4;
  let trailingBytes = Buffer.alloc(0);

  while (cursor < bytes.length) {
    const remaining = bytes.length - cursor;
    if (remaining < 8) {
      trailingBytes = bytes.subarray(cursor);
      diagnostics.push(diagnostic(
        'error',
        'MDX_TRUNCATED_CHUNK_HEADER',
        `A top-level chunk header needs 8 bytes; only ${remaining} remain.`,
        cursor,
        { remaining },
      ));
      break;
    }

    const tagBytes = bytes.subarray(cursor, cursor + 4);
    const declaredSize = bytes.readUInt32LE(cursor + 4);
    const payloadOffset = cursor + 8;
    const available = bytes.length - payloadOffset;
    const actualSize = Math.min(declaredSize, available);
    const complete = actualSize === declaredSize;
    const data = bytes.subarray(payloadOffset, payloadOffset + actualSize);

    chunks.push(Object.freeze({
      tag: tagText(tagBytes),
      tagBytes: Buffer.from(tagBytes),
      offset: cursor,
      payloadOffset,
      declaredSize,
      data: Buffer.from(data),
      complete,
      known: isKnownTopLevelChunk(tagText(tagBytes)),
    }));

    if (!complete) {
      diagnostics.push(diagnostic(
        'error',
        'MDX_TRUNCATED_CHUNK_PAYLOAD',
        `Chunk ${JSON.stringify(tagText(tagBytes))} declares ${declaredSize} bytes but only ${available} remain.`,
        cursor,
        { tag: tagText(tagBytes), declaredSize, available },
      ));
      cursor = bytes.length;
      break;
    }

    cursor = payloadOffset + declaredSize;
  }

  const versionChunks = chunks.filter((chunk) => chunk.tag === 'VERS');
  let version = null;
  if (versionChunks.length === 0) {
    diagnostics.push(diagnostic('warning', 'MDX_MISSING_VERSION', 'No VERS chunk was found.', 4));
  } else {
    if (versionChunks.length > 1) {
      diagnostics.push(diagnostic(
        'warning',
        'MDX_DUPLICATE_VERSION',
        `Found ${versionChunks.length} VERS chunks; the first complete value is reported.`,
        versionChunks[1].offset,
        { count: versionChunks.length },
      ));
    }
    const usable = versionChunks.find((chunk) => chunk.data.length >= 4);
    for (const chunk of versionChunks.filter((item) => item.data.length < 4)) {
      diagnostics.push(diagnostic(
        'error',
        'MDX_SHORT_VERSION_CHUNK',
        'A VERS chunk must contain at least a 32-bit version value.',
        chunk.payloadOffset,
        { actualSize: chunk.data.length },
      ));
    }
    if (usable) version = usable.data.readUInt32LE(0);
  }

  if (version !== null && !SUPPORTED_FORMAT_VERSIONS.includes(version)) {
    diagnostics.push(diagnostic(
      'warning',
      'MDX_UNSUPPORTED_VERSION',
      `Format version ${version} is retained but has no semantic decoder yet.`,
      versionChunks.find((chunk) => chunk.data.length >= 4).payloadOffset,
      { version, supportedVersions: SUPPORTED_FORMAT_VERSIONS },
    ));
  }

  return new MdxDocument(bytes, chunks, trailingBytes, diagnostics, version);
}

export function isKnownTopLevelChunk(tag) {
  return new Set([
    'VERS', 'MODL', 'SEQS', 'GLBS', 'MTLS', 'TEXS', 'TXAN', 'GEOS', 'GEOA',
    'BONE', 'LITE', 'HELP', 'ATCH', 'PIVT', 'PREM', 'PRE2', 'RIBB', 'CAMS',
    'EVTS', 'CLID', 'FAFX', 'BPOS', 'CORN', 'DILG', 'SNDS', 'SNEM', 'MDVI',
  ]).has(tag);
}
