// A UV drag is a shallow model overlay. Its geometry, materials and nodes retain
// their references, so only the existing texture-coordinate buffers need upload.
export function isUVOnlyPreviewChange(before, after) {
  if (!before || !after || before === after || before.Geosets?.length !== after.Geosets?.length) return before === after;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) if (key !== 'Geosets' && before[key] !== after[key]) return false;
  for (let i = 0; i < before.Geosets.length; i++) {
    const left = before.Geosets[i], right = after.Geosets[i];
    if (!left || !right || left.TVertices?.length !== right.TVertices?.length) return false;
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) if (key !== 'TVertices' && left[key] !== right[key]) return false;
    if (left.TVertices.some((uv, channel) => uv.length !== right.TVertices[channel]?.length)) return false;
  }
  return true;
}

/** In Portrait Movement, an empty node selection gives blank-space left drag
 * exclusively to the camera. Selecting a node gives Work back to the rig. */
export function portraitBlankDragRotatesCamera(props, event = {}) {
  return !!props?.portraitMode && (props.cameraMode ?? 'work') === 'work' && !event.altKey && !(props.selectedNodeIds?.length);
}

/** Renderer replacement is not a user camera gesture. Restore both projections
 * and the active camera before drawing the rebuilt UV preview. */
export function restorePreviewCamera(saved, perspective, ortho, controls) {
  perspective.copy(saved.perspective); ortho.copy(saved.ortho);
  const camera = saved.camera === 'ortho' ? ortho : perspective;
  controls.object = camera; controls.target.copy(saved.target); controls.update();
  return camera;
}

const BIND_MATRIX = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** Enter bind pose without rebuilding another complete native renderer. The
 * next animated update restores the authored matrices automatically. */
export function applyRestPoseMatrices(rendererData, restPose) {
  if (!restPose) return false;
  for (const entry of rendererData?.nodes || []) if (entry?.matrix?.length >= 16) entry.matrix.set(BIND_MATRIX);
  return true;
}
