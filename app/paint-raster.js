import { decodeBLP, getBLPImageData } from 'war3-model';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { decodeDds } from '../src/dds.js';
import { decodeBlp2 } from '../src/blp2.js';
import { decodePaintBlp } from '../src/paint-blp.js';
import { createPaintRaster, resizePaintRaster } from '../src/paint-raster.js';

const asBuffer = bytes => bytes instanceof ArrayBuffer ? bytes : bytes?.buffer?.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

async function standardImageRaster(bytes, mime = 'image/png') {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime })), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(bitmap, 0, 0); bitmap.close?.();
  const image = context.getImageData(0, 0, canvas.width, canvas.height); return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

export async function decodePaintImage(bytes, name = 'texture.png') {
  const buffer = asBuffer(bytes), lower = String(name).toLowerCase(); if (!buffer) throw Error('Texture bytes are missing.');
  if(buffer.byteLength>=4&&new DataView(buffer).getUint32(0,true)===0x20534444){const image=decodeDds(buffer);return {...image,data:new Uint8ClampedArray(image.data)};}
  if (lower.endsWith('.blp')) { let image;try{const input=new Uint8Array(buffer);image=input[3]===50?decodeBlp2(buffer):getBLPImageData(decodeBLP(buffer),0);}catch{image=await decodePaintBlp(buffer);}return {width:image.width,height:image.height,data:new Uint8ClampedArray(image.data)}; }
  if (lower.endsWith('.tga')) { const image = new TGALoader().parse(buffer); return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) }; }
  if (lower.endsWith('.dds')) { const image = decodeDds(buffer); return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) }; }
  const mime = lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : lower.endsWith('.webp') ? 'image/webp' : 'image/png'; return standardImageRaster(buffer, mime);
}

export async function paintBaseRaster(asset, resolution, sourceMode = 'current') {
  if (sourceMode === 'primer' || !asset?.bytes) return createPaintRaster(resolution, resolution, [126, 126, 118, 255]);
  const source = await decodePaintImage(asset.bytes, asset.name); return source.width === resolution && source.height === resolution ? source : resizePaintRaster(source, resolution, resolution);
}

export function paintRasterCanvas(raster, existing = null, bounds = null) {
  const canvas = existing || document.createElement('canvas'); if (canvas.width !== raster.width) canvas.width = raster.width; if (canvas.height !== raster.height) canvas.height = raster.height;
  const context = canvas.getContext('2d'),image=new ImageData(raster.data,raster.width,raster.height);if(bounds)context.putImageData(image,0,0,bounds.x,bounds.y,bounds.width,bounds.height);else context.putImageData(image,0,0);return canvas;
}

export async function fetchPaintRaster(url, resolution) {
  const response = await fetch(url); if (!response.ok) throw Error(`Could not load paint material: ${response.status}.`);
  const raster = await decodePaintImage(new Uint8Array(await response.arrayBuffer()), url); return raster.width === resolution && raster.height === resolution ? raster : resizePaintRaster(raster, resolution, resolution);
}
