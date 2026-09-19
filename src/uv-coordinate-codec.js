import { Buffer } from 'buffer';
import { parseMdl } from './mdl-lossless.js';

/** war3-model 4.0.1 parses every TVertices block but writes only set zero.
 * Add the remaining real MDL blocks at the existing serialization boundary.
 */
export function writeMdlUVSets(input, sections, model) {
  const bytes = Buffer.from(input), parts = [];
  let cursor = 0, geosetIndex = 0;
  for (const section of sections) {
    if (section.key !== 'Geosets') continue;
    const sets = model.Geosets[geosetIndex++]?.TVertices || [];
    if (sets.length < 2) continue;
    const tokens = parseMdl(bytes.subarray(section.start, section.end)).tokens.filter(token => !['whitespace', 'line-comment', 'block-comment'].includes(token.kind));
    let depth = 0, existing = 0, close = null;
    for (const token of tokens) {
      const value = token.raw.toString('ascii');
      if (value === '{') depth++;
      if (depth === 1 && value === 'TVertices' && token.kind !== 'string') existing++;
      if (value === '}') { depth--; if (depth === 0) close = token; }
    }
    if (!close || existing >= sets.length) continue;
    const blocks = sets.slice(existing).map(values => {
      if (values.length % 2 || Array.from(values).some(value => !Number.isFinite(value))) throw new Error('Cannot write invalid UV coordinates.');
      const rows = [];
      for (let offset = 0; offset < values.length; offset += 2) rows.push(`\t\t{ ${values[offset]}, ${values[offset + 1]} },`);
      return `\tTVertices ${values.length / 2} {\n${rows.join('\n')}\n\t}\n`;
    }).join('');
    const position = section.start + close.start;
    parts.push(bytes.subarray(cursor, position), Buffer.from(blocks)); cursor = position;
  }
  parts.push(bytes.subarray(cursor)); return Buffer.concat(parts);
}
