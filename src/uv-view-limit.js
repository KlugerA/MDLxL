export const DEFAULT_UV_VIEW_TILE_LIMIT = 7;
export const MIN_UV_VIEW_TILE_LIMIT = 7;
export const MAX_UV_VIEW_TILE_LIMIT = 64;

export function normalizeUVViewTileLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_UV_VIEW_TILE_LIMIT;
  return Math.round(Math.max(MIN_UV_VIEW_TILE_LIMIT, Math.min(MAX_UV_VIEW_TILE_LIMIT, number)));
}

export function minimumUVZoom(width, height, unitWidth, unitHeight, tileLimit = DEFAULT_UV_VIEW_TILE_LIMIT) {
  const limit = normalizeUVViewTileLimit(tileLimit);
  const safeWidth = Math.max(1, Number(width) || 1), safeHeight = Math.max(1, Number(height) || 1);
  const safeUnitWidth = Math.max(1, Number(unitWidth) || 1), safeUnitHeight = Math.max(1, Number(unitHeight) || 1);
  return Math.max(0.05, safeWidth / (safeUnitWidth * limit), safeHeight / (safeUnitHeight * limit));
}
