/** Capture dimensions refer to the long edge, keeping the viewport aspect ratio. */
export const CAPTURE_QUALITIES = Object.freeze({
  low: Object.freeze({ gifSize: 720, screenshotSize: 1280, colors: 128, dither: false }),
  medium: Object.freeze({ gifSize: 1280, screenshotSize: 1920, colors: 256, dither: true }),
  high: Object.freeze({ gifSize: 1920, screenshotSize: 3840, colors: 256, dither: true }),
});
export const DEFAULT_CAPTURE = Object.freeze({ fps: 30, recordingQuality: 'medium', screenshotQuality: 'medium' });
export function normalizeCapture(value = {}) {
  return { fps: [10,15,20,24,25,30,50].includes(Number(value?.fps)) ? Number(value.fps) : 30,
    recordingQuality: Object.hasOwn(CAPTURE_QUALITIES, value?.recordingQuality) ? value.recordingQuality : 'medium',
    screenshotQuality: Object.hasOwn(CAPTURE_QUALITIES, value?.screenshotQuality) ? value.screenshotQuality : 'medium' };
}
export function captureDimensions(width, height, longEdge) {
  if (![width, height, longEdge].every(n => Number.isFinite(n) && n > 0)) throw Error('Capture dimensions must be positive.');
  const scale = longEdge / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
