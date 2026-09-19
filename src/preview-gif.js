import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.js';

// Encode as frames arrive: one pending indexed frame, never a movie's raw RGBA.
// Its delay is determined by the next capture's actual timestamp, so slow
// machines drop frames without speeding up the exported animation.
export function createPreviewGIF({ repeat = 0, colors = 256, dither = false } = {}) {
  const encoder = GIFEncoder();
  let pending, width, height, frames = 0, finished = false, roundedTime = 0;
  function flush(end) {
    if (!pending) return;
    const roundedEnd = Math.max(roundedTime + 2, Math.round(end / 10));
    let delay = roundedEnd - roundedTime;
    while (delay > 0) {
      const ticks = Math.min(65535, delay);
      encoder.writeFrame(pending.index, width, height, { palette: pending.palette, delay: ticks * 10, repeat, dispose: 1 });
      delay -= ticks; frames++;
    }
    roundedTime = roundedEnd;
  }
  return {
    add(rgba, w, h, time) {
      if (finished) throw Error('Recording has finished.');
      if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 1920 || h > 1920 || rgba.length !== w * h * 4 || !Number.isFinite(time) || time < 0) throw Error('Invalid recording frame.');
      if (pending && (w !== width || h !== height)) throw Error('Recording dimensions changed.');
      if (pending) flush(time);
      width = w; height = h;
      const palette = quantize(rgba, colors === 128 ? 128 : 256, { format: 'rgb565' });
      // Small, fixed ordered dithering softens color bands without frame-to-frame
      // random noise. Keep the original pixels for palette selection.
      let pixels = rgba;
      if (dither) {
        pixels = rgba.slice(); const bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
        for (let y=0;y<h;y++) for(let x=0;x<w;x++) { const amount=(bayer[(y%4)*4+x%4]-7.5)*0.65, p=(y*w+x)*4; for(let c=0;c<3;c++)pixels[p+c]=Math.max(0,Math.min(255,Math.round(pixels[p+c]+amount))); }
      }
      pending = { index: applyPalette(pixels, palette, 'rgb565'), palette };
      return encoder.bytesView().length;
    },
    finish(time) {
      if (finished || !pending) throw Error('No recording frames are available.');
      flush(time); encoder.finish(); finished = true;
      return { bytes: encoder.bytes(), width, height, frames, duration: roundedTime * 10 };
    },
  };
}
