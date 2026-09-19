import { Buffer } from 'buffer';
import { parseMDL } from 'war3-model';
import { parseMdl } from './mdl-lossless.js';

/**
 * war3-model 4.0.1's MDL Popcorn reader decodes Rotation as FLOAT3, silently
 * dropping quaternion W (and cubic tangent W). Its ordinary Helper reader uses
 * the correct FLOAT4. Decode only this authored controller through that reader;
 * original source bytes and every unrelated Popcorn property stay untouched.
 */
export function restoreMdlPopcornRotations(input, sections, model) {
  const bytes = Buffer.from(input), owners = new Map((model.ParticleEmitterPopcorns || []).map(node => [node.ObjectId, node]));
  if (!owners.size) return;
  for (const section of sections) {
    if (section.key !== 'ParticleEmitterPopcorns') continue;
    const block = bytes.subarray(section.start, section.end);
    const tokens = parseMdl(block).tokens.filter(token => !['whitespace', 'line-comment', 'block-comment'].includes(token.kind));
    const raw = token => token?.raw.toString('utf8');
    let depth = 0, objectId = null, rotation = null;
    for (let i = 0; i < tokens.length; i++) {
      const value = raw(tokens[i]);
      if (value === '{') depth++;
      if (value === '}') depth--;
      if (depth === 1 && value === 'ObjectId') objectId = Number(raw(tokens[i + 1]));
      if (depth === 1 && value === 'Rotation' && raw(tokens[i + 2]) === '{') {
        if (rotation) throw new Error('Popcorn emitter contains duplicate rotation controllers.');
        let nested = 0, end = -1;
        for (let j = i + 2; j < tokens.length; j++) {
          if (raw(tokens[j]) === '{') nested++;
          if (raw(tokens[j]) === '}' && --nested === 0) { end = tokens[j].end; break; }
        }
        if (end < 0) throw new Error('Popcorn rotation controller is incomplete.');
        rotation = block.subarray(tokens[i].start, end).toString('utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
      }
    }
    if (rotation && owners.has(objectId)) {
      const decoded = parseMDL(`Version { FormatVersion 800, } Helper "PopcornRotation" { ObjectId 0, ${rotation} }`);
      owners.get(objectId).Rotation = decoded.Helpers[0].Rotation;
    }
  }
}

/** Popcorn color is RGB in both formats, unlike classic MDL Color fields.
 * Upstream's shared MDL color writer reverses it. Counter that only in its export
 * input, retaining the correct reader and never changing editable values.
 * https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/parsers/mdlx/particleemitterpopcorn.ts
 */
export function prepareMdlPopcornColors(emitters = []) {
  return emitters.map(emitter => {
    const color = structuredClone(emitter.Color);
    if (color?.Keys) for (const key of color.Keys) for (const property of ['Vector', 'InTan', 'OutTan']) key[property]?.reverse();
    else if (Array.isArray(color) || ArrayBuffer.isView(color)) color.reverse();
    return { ...emitter, Color: color };
  });
}
