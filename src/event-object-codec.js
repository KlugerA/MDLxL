import { Buffer } from 'buffer';
import { parseMdl } from './mdl-lossless.js';
import { parseMdx } from './mdx-container.js';

// war3-model 4.0.1 drops KEVT's global-sequence field and cannot parse the
// equivalent MDL EventTrack property. Keep that real format field at our boundary.
// https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/eventobject.ts
function eventTrackTokens(input) {
  const bytes = Buffer.from(input), tokens = parseMdl(bytes).tokens.filter(token => !['whitespace', 'line-comment', 'block-comment'].includes(token.kind));
  const raw = token => token?.raw.toString('utf8');
  let objectId = null, globalSeqId = null, trackOpen = null, remove = null, depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], value = raw(token);
    if (value === '{') depth++;
    if (value === '}') depth--;
    if (depth === 1 && value === 'ObjectId') objectId = Number(raw(tokens[i + 1]));
    if (depth === 1 && value === 'EventTrack' && raw(tokens[i + 2]) === '{') {
      trackOpen = tokens[i + 2];
      for (let j = i + 3; j < tokens.length && raw(tokens[j]) !== '}'; j++) if (raw(tokens[j]) === 'GlobalSeqId') {
        if (remove) throw new Error('EventTrack contains more than one GlobalSeqId.');
        const id = Number(raw(tokens[j + 1]));
        if (!Number.isInteger(id) || id < 0 || id > 0x7fffffff || raw(tokens[j + 2]) !== ',') throw new Error('EventTrack GlobalSeqId must be a non-negative integer.');
        globalSeqId = id; remove = { start: tokens[j].start, end: tokens[j + 2].end };
      }
    }
  }
  return { bytes, objectId, globalSeqId, trackOpen, remove };
}

/** Input is one EventObject block, as selected by the existing section scanner. */
export function prepareMdlEventObject(input) {
  const { bytes, objectId, globalSeqId, remove } = eventTrackTokens(input);
  return { objectId, globalSeqId, bytes: remove ? Buffer.concat([bytes.subarray(0, remove.start), Buffer.from(' '), bytes.subarray(remove.end)]) : bytes };
}

export function writeMdlEventGlobalSequences(generated, sections, model) {
  const bytes = Buffer.from(generated), byId = new Map((model.EventObjects || []).map(event => [event.ObjectId, event]));
  const parts = []; let cursor = 0;
  for (const section of sections) {
    if (section.key !== 'EventObjects') continue;
    const block = bytes.subarray(section.start, section.end), { objectId, trackOpen } = eventTrackTokens(block);
    const id = byId.get(objectId)?.GlobalSeqId;
    if (!Number.isInteger(id) || id < 0 || !trackOpen) continue;
    const position = section.start + trackOpen.end;
    parts.push(bytes.subarray(cursor, position), Buffer.from(`\n\t\tGlobalSeqId ${id},`)); cursor = position;
  }
  parts.push(bytes.subarray(cursor)); return Buffer.concat(parts);
}

function visitMdxEventTracks(bytes, visitor) {
  for (const chunk of parseMdx(bytes).chunks) if (chunk.tag === 'EVTS') {
    const end = chunk.payloadOffset + chunk.declaredSize;
    for (let cursor = chunk.payloadOffset; cursor < end;) {
      if (cursor + 96 > end) throw new Error('Truncated EventObject node.');
      const nodeSize = bytes.readUInt32LE(cursor), track = cursor + nodeSize;
      if (nodeSize < 96 || track + 12 > end || bytes.toString('ascii', track, track + 4) !== 'KEVT') throw new Error('Invalid EventObject track layout.');
      const count = bytes.readUInt32LE(track + 4), next = track + 12 + count * 4;
      if (next > end) throw new Error('Truncated EventObject track.');
      visitor({ objectId: bytes.readInt32LE(cursor + 84), globalSeqId: bytes.readInt32LE(track + 8), offset: track + 8 });
      cursor = next;
    }
  }
}

export function restoreMdxEventGlobalSequences(input, model) {
  const bytes = Buffer.from(input), byId = new Map((model.EventObjects || []).map(event => [event.ObjectId, event]));
  visitMdxEventTracks(bytes, ({ objectId, globalSeqId }) => {
    const event = byId.get(objectId);
    if (event && globalSeqId >= 0) event.GlobalSeqId = globalSeqId;
  });
}

export function writeMdxEventGlobalSequences(input, model) {
  const bytes = Buffer.from(input), byId = new Map((model.EventObjects || []).map(event => [event.ObjectId, event]));
  visitMdxEventTracks(bytes, ({ objectId, offset }) => {
    const id = byId.get(objectId)?.GlobalSeqId;
    bytes.writeInt32LE(Number.isInteger(id) && id >= 0 ? id : -1, offset);
  });
  return bytes;
}
