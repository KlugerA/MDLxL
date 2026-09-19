import { decodeBLP, getBLPImageData } from 'war3-model';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { decodeBlp2 } from './blp2.js';
import { decodeDds } from './dds.js';

/** Thumbnail decoding is isolated from imported assets and renderer textures. */
export function thumbnailPixels(asset) {
  const input = asset?.bytes;
  const buffer = input instanceof ArrayBuffer ? input : ArrayBuffer.isView(input) ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) : null;
  if (!buffer) throw Error('Texture has no image data.');
  const name = String(asset.name || '').toLowerCase(), magic = buffer.byteLength >= 4 ? new DataView(buffer).getUint32(0, true) : 0;
  if (magic === 0x20534444 || name.endsWith('.dds')) return decodeDds(buffer);
  if (magic === 0x32504c42) return decodeBlp2(buffer);
  if (magic === 0x31504c42 || name.endsWith('.blp')) return getBLPImageData(decodeBLP(buffer), 0);
  if (name.endsWith('.tga')) return new TGALoader().parse(buffer);
  return null;
}

export async function decodeTextureThumbnail(asset, maxDimension = 256) {
  if (typeof OffscreenCanvas === 'undefined') throw Error('Background texture previews are unavailable in this browser.');
  let bitmap = null;
  try {
    const pixels = thumbnailPixels(asset);
    let source;
    if (pixels) {
      source = new OffscreenCanvas(pixels.width, pixels.height);
      source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    } else { bitmap = await createImageBitmap(new Blob([asset.bytes])); source = bitmap; }
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)));
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    const png = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let binary = ''; for (let offset = 0; offset < png.length; offset += 8192) binary += String.fromCharCode(...png.subarray(offset, offset + 8192));
    return 'data:image/png;base64,' + btoa(binary);
  } finally { bitmap?.close(); }
}
