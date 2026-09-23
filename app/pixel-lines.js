/** Draw editor lines on physical pixels so canvas path antialiasing cannot soften them. */
export function drawPixelLine(context, from, to, { color = '#ffffff', width = 1, ratio = 1, dash = [] } = {}) {
  const x0 = Math.round(from.x * ratio), y0 = Math.round(from.y * ratio);
  const x1 = Math.round(to.x * ratio), y1 = Math.round(to.y * ratio);
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
