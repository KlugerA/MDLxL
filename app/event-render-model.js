import { parseMDL, parseMDX } from 'war3-model';
import { parseMdx, SUPPORTED_FORMAT_VERSIONS } from '../src/mdx-container.js';
import { validateModel } from '../src/editor-document.js';
import { convertMdxGeosetColorTracks } from '../src/geoset-color-codec.js';

// These particle-scene chunks retain their 1100 layout in 1200. In particular,
// 1200 LITE adds shadowIntensity, which our pinned renderer cannot decode.
// Keep this runtime capability separate from the editor's write-format policy.
// https://github.com/FernandoS27/WhiteoutLib/blob/master/src/whiteout/models/mdx/parser.cpp
const PARTICLE_1200_CHUNKS = new Set(['VERS', 'MODL', 'SEQS', 'GLBS', 'TEXS', 'BONE', 'HELP', 'PIVT', 'PRE2']);
const unsupported = version => new Error(`format ${version} needs a compatible Warcraft renderer`);

/** Decode a private event resource without downgrading its version or bytes. */
export function parseEventRenderModel(input, resourcePath = '') {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  const text = /\.mdl$/i.test(resourcePath);
  let container;
  if (!text) {
    container = parseMdx(bytes);
    if (container.version === 1200) {
      if (container.hasErrors) throw new Error('Event model has damaged MDX chunks.');
      if (container.chunks.some(chunk => (chunk.data.length || !chunk.known) && !PARTICLE_1200_CHUNKS.has(chunk.tag))) {
        throw new Error('Format 1200 event preview currently supports ParticleEmitter2 scenes only.');
      }
      if (container.chunks.filter(chunk => chunk.tag === 'VERS').length !== 1 || container.chunks.find(chunk => chunk.tag === 'VERS')?.data.length !== 4) {
        throw new Error('Event model has an invalid version chunk.');
      }
    } else if (!SUPPORTED_FORMAT_VERSIONS.includes(container.version)) throw unsupported(container.version);
  }
  const model = text ? parseMDL(new TextDecoder().decode(bytes)) : parseMDX(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (!text) model.GeosetAnims = convertMdxGeosetColorTracks(model.GeosetAnims);
  if (model.Version !== 1200) {
    if (!SUPPORTED_FORMAT_VERSIONS.includes(model.Version)) throw unsupported(model.Version);
    return model;
  }
  // Only MDX offers the complete chunk inventory needed to verify this narrow
  // runtime profile. Unsupported geometry/lights remain visible diagnostics.
  if (!container || !model.ParticleEmitters2?.length) throw new Error('Format 1200 event preview currently supports ParticleEmitter2 scenes only.');
  const invalid = validateModel(model).find(item => item.severity === 'error');
  if (invalid) throw new Error(`Invalid event model: ${invalid.message}`);
  for (const emitter of model.ParticleEmitters2) {
    if (![emitter.Rows, emitter.Columns].every(value => Number.isInteger(value) && value > 0)
      || !(emitter.LifeSpan > 0) || ![0, 1, 2, 3, 4].includes(emitter.FilterMode)
      || ![1, 2, 3].includes(emitter.FrameFlags)) throw new Error('Event particle emitter has invalid rendering parameters.');
  }
  return model;
}
