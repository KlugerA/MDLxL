export const DEFAULT_PLAYBACK_SPEED = 100;
export const MIN_PLAYBACK_SPEED = 1;
export const MAX_PLAYBACK_SPEED = 250;

export function clampPlaybackSpeed(value, fallback = DEFAULT_PLAYBACK_SPEED) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(MIN_PLAYBACK_SPEED, Math.min(MAX_PLAYBACK_SPEED, numeric));
}

export function scalePlaybackDelta(delta, speed = DEFAULT_PLAYBACK_SPEED) {
  return Number(delta) * clampPlaybackSpeed(speed) / 100;
}
