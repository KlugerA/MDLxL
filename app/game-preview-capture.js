import { backgroundImageRect } from '../src/viewport-appearance.js';

/** Center-cropped source rectangle for the same cover fit used on screen. */
export function backgroundCoverRect(imageWidth, imageHeight, width, height) {
  if (![imageWidth, imageHeight, width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Background and preview dimensions must be positive.');
  const scale = Math.max(width / imageWidth, height / imageHeight), sourceWidth = width / scale, sourceHeight = height / scale;
  return { x: (imageWidth - sourceWidth) / 2, y: (imageHeight - sourceHeight) / 2, width: sourceWidth, height: sourceHeight };
}

export function drawPreviewBackground(context, width, height, image, color = '#ccc', options = {}) {
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
  context.fillStyle = color; context.fillRect(0, 0, width, height);
  if (image) {
    context.globalAlpha = Number.isFinite(options.opacity) ? Math.max(0, Math.min(1, options.opacity)) : 1;
    if (options.display && options.display !== 'fill') {
      const rect = backgroundImageRect(image.naturalWidth || image.width, image.naturalHeight || image.height, width, height, options.display);
      if (rect) context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    } else {
      const rect = backgroundCoverRect(image.naturalWidth || image.width, image.naturalHeight || image.height, width, height);
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
    }
  }
  context.restore();
}

export function composePreviewCapture(backgroundCanvas, modelCanvas, createCanvas = () => document.createElement('canvas')) {
  const snapshot = createCanvas(); snapshot.width = modelCanvas.width; snapshot.height = modelCanvas.height;
  const context = snapshot.getContext('2d');
  if (!context) throw new Error('Could not create a preview capture canvas.');
  context.drawImage(backgroundCanvas, 0, 0, snapshot.width, snapshot.height);
  context.drawImage(modelCanvas, 0, 0, snapshot.width, snapshot.height);
  return snapshot;
}

/** Explicit preview Loop overrides the authored sequence's NonLooping flag. */
export function previewPlaybackStep(interval, frame, delta, loop = true) {
  const [start, end] = interval, duration = end - start;
  const current = Math.min(end, Math.max(start, frame)), elapsed = Math.max(0, Number(delta) || 0);
  if (!elapsed) return { frame: current, elapsed: 0, finished: false };
  if (!(duration > 0)) return { frame: start, elapsed: 0, finished: true };
  if (!loop && current + elapsed >= end) return { frame: start, elapsed: Math.max(0, end - current), finished: true };
  return { frame: loop ? start + ((current - start + elapsed) % duration) : current + elapsed, elapsed, finished: false };
}
