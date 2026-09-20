export const UV_SIDE_DEFAULT = 40;
export const UV_SIDE_MIN = 18;
export const UV_SIDE_MAX = 75;
export const UV_PREVIEW_DEFAULT = 62;
export const UV_SELECT_PREVIEW_DEFAULT = 78;
export const UV_PREVIEW_MIN = 28;
export const UV_PREVIEW_MAX = 88;

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const clampUVSidePercent = value => clamp(finite(value, UV_SIDE_DEFAULT), UV_SIDE_MIN, UV_SIDE_MAX);
export const clampUVPreviewPercent = value => clamp(finite(value, UV_PREVIEW_DEFAULT), UV_PREVIEW_MIN, UV_PREVIEW_MAX);

/** Percentage occupied by the right-hand pane. Dynamic pixel limits keep both
 * panes usable while still allowing a genuinely small preview on wide screens. */
export function uvSidePercentAtPointer(clientX, rect) {
  const width = Math.max(1, finite(rect?.width, 1));
  const raw = (finite(rect?.left, 0) + width - finite(clientX, 0)) / width * 100;
  const compact = width <= 900, leftMinimum = compact ? 300 : 360, rightMinimum = compact ? 260 : 300;
  const minimum = Math.max(UV_SIDE_MIN, rightMinimum / width * 100);
  const maximum = Math.min(UV_SIDE_MAX, (width - leftMinimum - 7) / width * 100);
  return clampUVSidePercent(clamp(raw, Math.min(minimum, maximum), Math.max(minimum, maximum)));
}

/** Percentage occupied by the live-preview section within its own side pane. */
export function uvPreviewPercentAtPointer(clientY, rect) {
  const height = Math.max(1, finite(rect?.height, 1));
  const raw = (finite(clientY, 0) - finite(rect?.top, 0)) / height * 100;
  const minimum = Math.max(UV_PREVIEW_MIN, 240 / height * 100);
  return clampUVPreviewPercent(Math.max(minimum, raw));
}
