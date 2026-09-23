import { Color } from 'three';

/** Draw editor lines on physical pixels so canvas path antialiasing cannot soften them. */
export function drawPixelLine(context, from, to, { color = '#ffffff', width = 1, ratio = 1, dash = [] } = {}) {
  const clipped = context.canvas?.width && context.canvas?.height
    ? clipLine(from.x * ratio, from.y * ratio, to.x * ratio, to.y * ratio, context.canvas.width, context.canvas.height)
    : [Math.round(from.x * ratio), Math.round(from.y * ratio), Math.round(to.x * ratio), Math.round(to.y * ratio)];
  if (!clipped) return;
  const [x0, y0, x1, y1] = clipped;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const count = Math.max(dx, dy), thickness = Math.max(1, Math.round(width * ratio));
  const pattern = dash.map(value => Math.max(1, Math.round(value * ratio)));
  const cycle = pattern.reduce((sum, value) => sum + value, 0);
  let x = x0, y = y0, error = dx - dy;
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0);
  for (let step = 0; step <= count; step++) {
    const offset = cycle ? step % cycle : 0;
    let phase = 0, on = true;
    for (const segment of pattern) { if (offset < phase + segment) break; phase += segment; on = !on; }
    if (on) {
      context.fillStyle = typeof color === 'function' ? color(count ? step / count : 0) : color;
      context.fillRect(x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness);
    }
    const twice = 2 * error;
    if (twice > -dy) { error -= dy; x += x0 < x1 ? 1 : -1; }
    if (twice < dx) { error += dx; y += y0 < y1 ? 1 : -1; }
  }
  context.restore();
}

const rasters = new WeakMap();

function clipLine(x0, y0, x1, y1, width, height) {
  let start = 0, end = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0], [dx, width - 1 - x0], [-dy, y0], [dy, height - 1 - y0]]) {
    if (!p) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) start = Math.max(start, t);
    else end = Math.min(end, t);
    if (start > end) return null;
  }
  return [Math.round(x0 + dx * start), Math.round(y0 + dy * start), Math.round(x0 + dx * end), Math.round(y0 + dy * end), start, end];
}

/** Batch sharp wire pixels into one canvas upload instead of one fillRect per pixel. */
export function createPixelLineBatch(context) {
  const width = context.canvas.width, height = context.canvas.height;
  let raster = rasters.get(context);
  if (!raster || raster.width !== width || raster.height !== height) {
    raster = { width, height, image: context.createImageData(width, height), priority: new Uint8Array(width * height) };
    rasters.set(context, raster);
  }
  const data = raster.image.data;
  data.fill(0); raster.priority.fill(0);
  const colors = new Map(), patterns = new WeakMap();
  return {
    draw(from, to, { color = '#ffffff', width: lineWidth = 1, ratio = 1, dash = [], opacity = 1, layer = 1, depth = null, hiddenOpacity = opacity, showHidden = true } = {}) {
      const clipped = clipLine(from.x * ratio, from.y * ratio, to.x * ratio, to.y * ratio, width, height);
      if (!clipped) return;
      let [x, y, x1, y1, start, end] = clipped;
      const dx = Math.abs(x1 - x), dy = Math.abs(y1 - y), count = Math.max(dx, dy);
      const thickness = Math.max(1, Math.round(lineWidth * ratio));
      let pattern = patterns.get(dash);
      if (!pattern) { const values = dash.map(value => Math.max(1, Math.round(value * ratio))); pattern = { values, cycle: values.reduce((sum, value) => sum + value, 0) }; patterns.set(dash, pattern); }
      let rgb = colors.get(color);
      if (rgb === undefined) { rgb = new Color(color).getHex(); colors.set(color, rgb); }
      const red = rgb >> 16 & 255, green = rgb >> 8 & 255, blue = rgb & 255;
      const alpha = Math.max(0, Math.min(255, Math.round(opacity * 255)));
      const hiddenAlpha = Math.max(0, Math.min(255, Math.round(hiddenOpacity * 255)));
      let error = dx - dy, group = -1, hidden = false;
      for (let step = 0; step <= count; step++) {
        if (depth) {
          const nextGroup = Math.floor(step / Math.max(1, Math.round(12 * ratio)));
          if (nextGroup !== group) {
            group = nextGroup;
            const fraction = count ? Math.min(1, (step + 6 * ratio) / count) : 0;
            const t = start + (end - start) * fraction;
            hidden = depth.isOccluded({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
          }
        }
        const offset = pattern.cycle ? step % pattern.cycle : 0;
        let phase = 0, on = true;
        for (const segment of pattern.values) { if (offset < phase + segment) break; phase += segment; on = !on; }
        if (on && (!hidden || showHidden)) for (let oy = 0; oy < thickness; oy++) for (let ox = 0; ox < thickness; ox++) {
          const px = x + ox - Math.floor(thickness / 2), py = y + oy - Math.floor(thickness / 2);
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const pixel = py * width + px, rank = depth ? hidden ? 1 : 2 : layer + 1;
          if (raster.priority[pixel] > rank) continue;
          const index = pixel * 4, previous = raster.priority[pixel] === rank ? data[index + 3] : 0;
          raster.priority[pixel] = rank;
          const currentAlpha = hidden ? hiddenAlpha : alpha;
          if (previous && currentAlpha < 255) {
            const retained = previous * (255 - currentAlpha) / 255, total = currentAlpha + retained;
            data[index] = (red * currentAlpha + data[index] * retained) / total;
            data[index + 1] = (green * currentAlpha + data[index + 1] * retained) / total;
            data[index + 2] = (blue * currentAlpha + data[index + 2] * retained) / total;
            data[index + 3] = total;
          } else { data[index] = red; data[index + 1] = green; data[index + 2] = blue; data[index + 3] = currentAlpha; }
        }
        const twice = 2 * error;
        if (twice > -dy) { error -= dy; x += clipped[0] < x1 ? 1 : -1; }
        if (twice < dx) { error += dx; y += clipped[1] < y1 ? 1 : -1; }
      }
    },
    flush() { context.putImageData(raster.image, 0, 0); },
  };
}
