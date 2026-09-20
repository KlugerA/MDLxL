// One native 16 CSS-pixel curved arrow. The OS applies display scaling once;
// the old 32-pixel trace and white outline caused the doubled size/grey fringe.
const rotation = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="black" d="M2 12C-1 5 2 1 8 1s9 4 6 11l2 3h-6V9l2 2c2-5-1-8-4-8s-6 3-4 8l2-2v6H0z"/></svg>';
export const ROTATION_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(rotation)}") 8 8, crosshair`;
export function viewportCursor(cameraMode = 'work', transformMode = 'select', rotating = false) {
  if (rotating || cameraMode === 'rotate' || cameraMode === 'work' && ['rotate', 'rotateNormals', 'rotate-normals'].includes(transformMode)) return ROTATION_CURSOR;
  return cameraMode === 'zoom' ? 'ns-resize' : cameraMode === 'move' ? 'grab' : 'default';
}
