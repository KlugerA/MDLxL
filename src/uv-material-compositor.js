const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));

/** DOM-free reference compositor for Warcraft III material filter modes. */
export function compositeMaterialPixels(layers, width, height) {
  const output = new Uint8ClampedArray(width * height * 4);
  for (const layer of layers || []) {
    if (!layer?.pixels || layer.pixels.length !== output.length) continue;
    const filter = Number(layer.filterMode) || 0;
    const opacity = Math.max(0, Math.min(1, Number.isFinite(layer.alpha) ? layer.alpha : 1));
    for (let offset = 0; offset < output.length; offset += 4) {
      const sr = layer.pixels[offset] / 255;
      const sg = layer.pixels[offset + 1] / 255;
      const sb = layer.pixels[offset + 2] / 255;
      const sa = layer.pixels[offset + 3] / 255 * opacity;
      const da = output[offset + 3] / 255;
      let dr = output[offset] / 255;
      let dg = output[offset + 1] / 255;
      let db = output[offset + 2] / 255;
      let a = da;
      if (filter === 1) {
        if (sa < .75) continue;
        [dr, dg, db, a] = [sr, sg, sb, 1];
      } else if (filter === 0 && opacity >= .999999) {
        [dr, dg, db, a] = [sr, sg, sb, 1];
      } else if (filter <= 2) {
        const outAlpha = sa + da * (1 - sa), divisor = outAlpha || 1;
        dr = (sr * sa + dr * da * (1 - sa)) / divisor;
        dg = (sg * sa + dg * da * (1 - sa)) / divisor;
        db = (sb * sa + db * da * (1 - sa)) / divisor;
        a = outAlpha;
      } else if (filter === 3) {
        dr += sr; dg += sg; db += sb; a = Math.max(da, sa);
      } else if (filter === 4) {
        dr += sr * sa; dg += sg * sa; db += sb * sa; a = Math.max(da, sa);
      } else if (filter === 5 || filter === 6) {
        if (!da) { dr = dg = db = 1; a = 1; }
        const factor = filter === 6 ? 2 : 1;
        dr *= sr * factor; dg *= sg * factor; db *= sb * factor; a = Math.max(a, sa);
      }
      output[offset] = clampByte(dr * 255);
      output[offset + 1] = clampByte(dg * 255);
      output[offset + 2] = clampByte(db * 255);
      output[offset + 3] = clampByte(a * 255);
    }
  }
  return output;
}
