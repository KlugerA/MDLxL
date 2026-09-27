import { sampleTrack } from './animation.js';

/** Freeze every other animation domain at time zero in a renderer-only model. */
export function isolateGlobalSequence(model, globalSeqId) {
  if (!(model.GlobalSequences?.[globalSeqId] > 0)) return model;
  const seen = new Set();
  function visit(owner) {
    if (!owner || typeof owner !== 'object' || ArrayBuffer.isView(owner) || seen.has(owner)) return;
    seen.add(owner);
    for (const [property, value] of Object.entries(owner)) {
      if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) continue;
      if (Array.isArray(value.Keys) && value.GlobalSeqId !== globalSeqId && value.Keys.length) {
        const first = value.Keys[0].Vector;
        const fallback = first.length === 1 ? first[0] : Array.from(first);
        const sampled = owner._MdxDefaults?.[property] ?? sampleTrack(value, 0, { globalSequences: model.GlobalSequences, fallback, quaternion: property === 'Rotation' });
        owner[property] = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: typeof sampled === 'number' ? [sampled] : Array.from(sampled) }] };
      } else visit(value);
    }
  }
  visit(model);
  return model;
}
