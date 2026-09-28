// One native 16 CSS-pixel curved arrow. The OS applies display scaling once;
// the old 32-pixel trace and white outline caused the doubled size/grey fringe.
const rotation = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="black" d="M2 12C-1 5 2 1 8 1s9 4 6 11l2 3h-6V9l2 2c2-5-1-8-4-8s-6 3-4 8l2-2v6H0z"/></svg>';
export const ROTATION_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(rotation)}") 8 8, crosshair`;
export function viewportCursor(cameraMode = 'work', transformMode = 'select', rotating = false) {
  if (rotating || cameraMode === 'rotate' || cameraMode === 'work' && ['rotate', 'rotateNormals', 'rotate-normals'].includes(transformMode)) return ROTATION_CURSOR;
  return cameraMode === 'zoom' ? 'ns-resize' : cameraMode === 'move' ? 'grab' : 'default';
}

// Showcase shows a tool cursor only during its gesture. Both arrow variants
// retain a contrasting edge, including over a changing image/video background.
const showcaseArrows=[false,true].map(light=>{
  const fill=light?'#ffffff':'#161616',stroke=light?'#161616':'#ffffff';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="19" height="23" viewBox="0 0 19 23"><path fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.2" stroke-linejoin="round" d="M2 1v17l4.5-4 3.5 7 3-1.5-3.5-7H16z"/></svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'") 2 1, default';
});
const showcaseRotations=[ROTATION_CURSOR,'url("data:image/svg+xml,'+encodeURIComponent(rotation.replace('fill="black"','fill="white" stroke="#161616" stroke-width=".5"'))+'") 8 8, crosshair'];
export function showcaseCursor(rotating,light) { return (rotating?showcaseRotations:showcaseArrows)[light?1:0]; }
