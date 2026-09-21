export function rgbaColor(value, alpha = 255) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return [value[0] || 0, value[1] || 0, value[2] || 0, value[3] ?? alpha].map((item, index) => Math.max(0, Math.min(255, Math.round(Number(item) || (index === 3 ? alpha : 0)))));
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value || ''));
  if (!match) return [143, 159, 84, alpha];
  const number = Number.parseInt(match[1], 16);
  return [number >> 16, number >> 8 & 255, number & 255, alpha];
}

export function createPaintRaster(width, height = width, fill = [0, 0, 0, 0]) {
  width = Math.max(1, Math.round(width)); height = Math.max(1, Math.round(height));
  const data = new Uint8ClampedArray(width * height * 4), color = rgbaColor(fill, fill?.[3] ?? 0);
  for (let index = 0; index < data.length; index += 4) data.set(color, index);
  return { width, height, data };
}

export function clonePaintRaster(raster) {
  return { width: raster.width, height: raster.height, data: new Uint8ClampedArray(raster.data) };
}

/** Paint sources created from Warcraft textures are colour swatches, not model
 * material layers. Keep every decoded RGB pixel, but discard the source
 * material's cutout/team-colour alpha before applying the user's own crop. */
export function flattenPaintRasterAlpha(raster) {
  const result = clonePaintRaster(raster);
  for (let offset = 3; offset < result.data.length; offset += 4) result.data[offset] = 255;
  return result;
}

/** Recombine only dirty rows into a reusable preview. Export calls omit output/rows.
 * Preserve byte-exact layer rounding and source/eraser alpha semantics. */
export function compositePaintRasters(base, coats, {preserveSourceAlpha=true,alphaMask=null,output=null,rows=null}={}) {
  output ||= clonePaintRaster(base);
  const {width,height}=base, data=output.data, valid=(coats||[]).filter(coat=>coat.visible!==false&&coat.raster?.width===width&&coat.raster?.height===height&&Number(coat.opacity??1)>0);
  const mask=alphaMask?.width===width&&alphaMask?.height===height?alphaMask.data:null;
  for(let y=0;y<height;y++){
    const x0=rows?rows[y*2]:0,x1=rows?rows[y*2+1]:width-1;if(x1<x0)continue;
    const start=(y*width+x0)*4,end=(y*width+x1+1)*4;
    data.set(base.data.subarray(start,end),start);
    for(const coat of valid){
      const source=coat.raster.data,opacity=Math.max(0,Math.min(1,Number(coat.opacity??1)));
      for(let i=start;i<end;i+=4){
        const sa=source[i+3]/255*opacity;if(sa<=0)continue;
        const da=data[i+3]/255,alpha=sa+da*(1-sa),weight=da*(1-sa);
        data[i]=Math.round((source[i]*sa+data[i]*weight)/alpha);
        data[i+1]=Math.round((source[i+1]*sa+data[i+1]*weight)/alpha);
        data[i+2]=Math.round((source[i+2]*sa+data[i+2]*weight)/alpha);
        data[i+3]=Math.round(alpha*255);
      }
    }
    for(let i=start+3;i<end;i+=4){if(preserveSourceAlpha)data[i]=base.data[i];if(mask)data[i]=Math.round(data[i]*mask[i]/255);}
  }
  return output;
}

export function resizePaintRaster(source, width, height = width) {
  const output = createPaintRaster(width, height), sx = source.width / width, sy = source.height / height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const fromX = Math.min(source.width - 1, Math.floor((x + .5) * sx)), fromY = Math.min(source.height - 1, Math.floor((y + .5) * sy));
    output.data.set(source.data.subarray((fromY * source.width + fromX) * 4, (fromY * source.width + fromX) * 4 + 4), (y * width + x) * 4);
  }
  return output;
}

export function rasterRegionDelta(before, after) {
  if (before.width !== after.width || before.height !== after.height) throw Error('Paint history dimensions changed.');
  let minX = before.width, minY = before.height, maxX = -1, maxY = -1;
  for (let y = 0; y < before.height; y++) for (let x = 0; x < before.width; x++) {
    const offset = (y * before.width + x) * 4;
    if (before.data[offset] === after.data[offset] && before.data[offset + 1] === after.data[offset + 1] && before.data[offset + 2] === after.data[offset + 2] && before.data[offset + 3] === after.data[offset + 3]) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < minX) return null;
  const width = maxX - minX + 1, height = maxY - minY + 1, earlier = new Uint8ClampedArray(width * height * 4), later = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const source = ((minY + y) * before.width + minX) * 4, destination = y * width * 4;
    earlier.set(before.data.subarray(source, source + width * 4), destination);
    later.set(after.data.subarray(source, source + width * 4), destination);
  }
  return { x: minX, y: minY, width, height, before: earlier, after: later, byteLength: earlier.byteLength + later.byteLength + 64 };
}

export function applyRasterDelta(raster, delta, side = 'after') {
  const data = delta?.[side];
  if (!(data instanceof Uint8ClampedArray) || delta.x < 0 || delta.y < 0 || delta.x + delta.width > raster.width || delta.y + delta.height > raster.height || data.length !== delta.width * delta.height * 4) throw Error('Invalid paint history entry.');
  for (let y = 0; y < delta.height; y++) {
    const source = y * delta.width * 4, destination = ((delta.y + y) * raster.width + delta.x) * 4;
    raster.data.set(data.subarray(source, source + delta.width * 4), destination);
  }
  return raster;
}

export function fillRasterMask(raster, mask, color, opacity = 1, mode = 'paint') {
  if (!mask || mask.length !== raster.width * raster.height) throw Error('The smart paint mask does not match this texture.');
  const rgba = rgbaColor(color), amount = Math.max(0, Math.min(1, opacity));
  for (let pixel = 0; pixel < mask.length; pixel++) blendPaintPixel(raster.data, pixel * 4, rgba, amount * mask[pixel] / 255, mode);
  return raster;
}

export function blendPaintPixel(data, offset, color, amount, mode = 'paint') {
  amount = Math.max(0, Math.min(1, amount));
  if (amount <= 0) return false;
  const red = data[offset], green = data[offset + 1], blue = data[offset + 2], beforeAlpha = data[offset + 3];
  if (mode === 'erase') data[offset + 3] = Math.round(data[offset + 3] * (1 - amount));
  else {
    const destinationAlpha = data[offset + 3] / 255, sourceAlpha = color[3] / 255 * amount, alpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
    if (alpha > 0) for (let channel = 0; channel < 3; channel++) data[offset + channel] = Math.round((color[channel] * sourceAlpha + data[offset + channel] * destinationAlpha * (1 - sourceAlpha)) / alpha);
    data[offset + 3] = Math.round(alpha * 255);
  }
  return red !== data[offset] || green !== data[offset + 1] || blue !== data[offset + 2] || beforeAlpha !== data[offset + 3];
}
