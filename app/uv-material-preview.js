import { sampleTrack } from '../src/animation.js';
import { uvMaterialLayers } from '../src/uv-tools.js';
import { compositeMaterialPixels } from '../src/uv-material-compositor.js';
import { textureFromAsset } from './Viewport.jsx';

const normalPath = value => String(value || '').replaceAll('/', '\\').toLowerCase();
const decodedAssets = new WeakMap();
const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));

function rgba(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'ff0303';
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
}

async function decodeAsset(asset, textureInfo) {
  if (!asset || typeof asset !== 'object') return null;
  if (!decodedAssets.has(asset)) decodedAssets.set(asset, (async () => {
    const texture = await textureFromAsset(asset, textureInfo);
    try {
      const image = texture.image;
      if (image?.data && image.width > 0 && image.height > 0) return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
      if (!image?.width || !image?.height) throw Error('The texture decoder returned no image.');
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
      return { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data };
    } finally { texture.dispose(); }
  })());
  return decodedAssets.get(asset);
}

function resizePixels(source, width, height) {
  if (source.width === width && source.height === height) return new Uint8ClampedArray(source.data);
  const input = document.createElement('canvas'); input.width = source.width; input.height = source.height;
  input.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(source.data), source.width, source.height), 0, 0);
  const output = document.createElement('canvas'); output.width = width; output.height = height;
  const context = output.getContext('2d', { willReadFrequently: true }); context.imageSmoothingEnabled = true; context.drawImage(input, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function replaceablePixels(id, color, width, height) {
  const data = new Uint8ClampedArray(width * height * 4), [r, g, b] = rgba(color);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    if (id === 2) {
      const distance = Math.hypot((x + .5) / width - .5, (y + .5) / height - .5) * 2;
      const alpha = clampByte(Math.sin(Math.max(0, Math.min(1, 1 - distance * 1.4))) * 255);
      data.set([r, g, b, alpha], offset);
    } else data.set([r, g, b, 255], offset);
  }
  return data;
}

/** Render every layer of the selected WC3 material into the tiled UV backdrop. */
export async function renderUVMaterialTexture(model, materialID, assets, { teamColor = '#ff0303', time = 0, sequenceIndex = -1 } = {}) {
  const map = assets instanceof Map ? assets : new Map(Object.entries(assets || {}));
  const lookup = path => map.get(normalPath(path)) || map.get(normalPath(String(path || '').split(/[\\/]/).at(-1)));
  const layers = uvMaterialLayers(model, materialID, time, sequenceIndex), decoded = [], warnings = [];
  for (const entry of layers) {
    if (entry.texture?.ReplaceableId) { decoded.push({ ...entry, replaceable: entry.texture.ReplaceableId }); continue; }
    const asset = lookup(entry.texture?.Image);
    if (!asset) { warnings.push(`${entry.label} is not loaded`); continue; }
    try { decoded.push({ ...entry, image: await decodeAsset(asset, entry.texture) }); }
    catch (cause) { warnings.push(`${entry.label}: ${cause.message}`); }
  }
  const base = decoded.filter(entry => entry.image).sort((a, b) => b.image.width * b.image.height - a.image.width * a.image.height)[0]?.image;
  const scale = base ? Math.min(1, 2048 / Math.max(base.width, base.height)) : 1;
  const width = Math.max(1, Math.round((base?.width || 256) * scale)), height = Math.max(1, Math.round((base?.height || 256) * scale));
  const interval = model?.Sequences?.[sequenceIndex]?.Interval;
  const prepared = decoded.map(entry => {
    const sampled = sampleTrack(entry.layer.Alpha, time, { interval, globalSequences: model?.GlobalSequences, globalTime: time, fallback: 1 });
    const alpha = Number(Array.isArray(sampled) || ArrayBuffer.isView(sampled) ? sampled[0] : sampled);
    return { pixels: entry.replaceable ? replaceablePixels(entry.replaceable, teamColor, width, height) : resizePixels(entry.image, width, height), filterMode: entry.layer.FilterMode || 0, alpha: Number.isFinite(alpha) ? alpha : 1 };
  });
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(compositeMaterialPixels(prepared, width, height), width, height), 0, 0);
  return { url: canvas.toDataURL('image/png'), width, height, warnings, layerCount: prepared.length };
}
