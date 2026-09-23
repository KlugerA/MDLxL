import { VIEW_PRESETS } from './viewport-math.js';
import { planeAxes } from './classic-gestures.js';

// Keep editing planes derived from the same presets used by the View menu.
export function viewWorkplane(view) {
  const direction = VIEW_PRESETS[view]?.direction;
  if (!direction || direction.filter(value => value !== 0).length !== 1) return null;
  const depth = direction.findIndex(value => value !== 0);
  return ['xy', 'xz', 'yz'].find(plane => !planeAxes(plane).includes(depth));
}

export const QUAD_VIEWS = Object.freeze([
  { id: 'front', label: 'Front', view: 'front' },
  { id: 'top', label: 'Top', view: 'top' },
  { id: 'side', label: 'Side', view: 'right' },
  { id: 'perspective', label: 'Perspective', view: 'perspective' },
]);

export const QUAD_VIEW_OPTIONS = Object.freeze([
  ...Object.keys(VIEW_PRESETS).filter(view => viewWorkplane(view)).map(view => [view, view[0].toUpperCase() + view.slice(1)]),
  ['perspective', 'Perspective'],
]);

export function viewportRects(width, height, quad) {
  if (!quad) return [{ left: 0, top: 0, width, height }];
  const x = Math.floor(width / 2), y = Math.floor(height / 2);
  return [
    { left: 0, top: 0, width: x, height: y },
    { left: x, top: 0, width: width - x, height: y },
    { left: 0, top: y, width: x, height: height - y },
    { left: x, top: y, width: width - x, height: height - y },
  ];
}
