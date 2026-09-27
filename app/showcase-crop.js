const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));

/** A single normalized rectangle is shared by the visible frame and GIF pixels. */
export function cropPixels(width, height, crop) {
  if (!crop) return { x: 0, y: 0, width, height };
  const x = Math.floor(clamp(crop.x) * width), y = Math.floor(clamp(crop.y) * height);
  const right = Math.min(width, Math.max(x + 1, Math.ceil(clamp(crop.x + crop.width) * width)));
  const bottom = Math.min(height, Math.max(y + 1, Math.ceil(clamp(crop.y + crop.height) * height)));
  return { x, y, width: right - x, height: bottom - y };
}

export function cropBetween(start, end) {
  const x = Math.min(clamp(start.x), clamp(end.x)), y = Math.min(clamp(start.y), clamp(end.y));
  return { x, y, width: Math.abs(clamp(end.x) - clamp(start.x)), height: Math.abs(clamp(end.y) - clamp(start.y)) };
}
