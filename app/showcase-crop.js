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

export const SHOWCASE_CROP_PRESETS = Object.freeze({ square: 1, classic: 4 / 3, wide: 16 / 9, portrait: 3 / 4, hiveMain: 612 / 490 });

/** Center the chosen aspect inside the preview, leaving a little breathing room. */
export function cropPresetRect(width, height, aspect) {
  if (!(width > 0 && height > 0 && aspect > 0)) return null;
  const availableWidth = width * .9, availableHeight = height * .9;
  const cropWidth = Math.min(availableWidth, availableHeight * aspect);
  const cropHeight = cropWidth / aspect;
  const normalizedWidth = cropWidth / width, normalizedHeight = cropHeight / height;
  return { x: (1 - normalizedWidth) / 2, y: (1 - normalizedHeight) / 2, width: normalizedWidth, height: normalizedHeight };
}

// Fit uniformly. A changed viewport or subpixel crop rounding must never stretch a model.
export function containRect(sourceWidth,sourceHeight,width,height){
  const scale=Math.min(width/sourceWidth,height/sourceHeight);
  return {x:(width-sourceWidth*scale)/2,y:(height-sourceHeight*scale)/2,width:sourceWidth*scale,height:sourceHeight*scale};
}
export function recordingDimensions(width,height,crop,maxDimension,aspect){
  const selection=cropPixels(width,height,crop),ratio=aspect||selection.width/selection.height;
  const edge=Math.max(1,maxDimension||Math.max(selection.width,selection.height));
  return ratio>=1?{width:Math.round(edge),height:Math.max(1,Math.round(edge/ratio))}:{width:Math.max(1,Math.round(edge*ratio)),height:Math.round(edge)};
}
