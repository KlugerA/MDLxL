import { Vector3 } from 'three';
import { constrainedAxis, planeAxes } from './classic-gestures.js';
import { applyEvaluatedModelCamera, evaluateModelCamera } from './portrait-view.js';

// Warcraft models face +X and use +Z as up. Top view faces down the screen.
export const VIEW_PRESETS = Object.freeze({
  front: { direction: [1, 0, 0], up: [0, 0, 1] },
  back: { direction: [-1, 0, 0], up: [0, 0, 1] },
  right: { direction: [0, -1, 0], up: [0, 0, 1] },
  left: { direction: [0, 1, 0], up: [0, 0, 1] },
  top: { direction: [0, 0, 1], up: [-1, 0, 0] },
  bottom: { direction: [0, 0, -1], up: [1, 0, 0] },
  'top-front-right': { direction: [1, -1, 1], up: [0, 0, 1] },
  'top-front-left': { direction: [1, 1, 1], up: [0, 0, 1] },
  'top-back-right': { direction: [-1, -1, 1], up: [0, 0, 1] },
  'top-back-left': { direction: [-1, 1, 1], up: [0, 0, 1] },
  'bottom-front-right': { direction: [1, -1, -1], up: [0, 0, 1] },
  'bottom-front-left': { direction: [1, 1, -1], up: [0, 0, 1] },
  'bottom-back-right': { direction: [-1, -1, -1], up: [0, 0, 1] },
  'bottom-back-left': { direction: [-1, 1, -1], up: [0, 0, 1] },
});

export function applyViewPreset(camera, name, target, distance) {
  const preset = VIEW_PRESETS[name] || VIEW_PRESETS.front;
  camera.up.fromArray(preset.up);
  camera.position.copy(target).addScaledVector(new Vector3().fromArray(preset.direction).normalize(), distance);
  camera.lookAt(target); camera.updateMatrixWorld();
}

/** Tighten the depth range as the camera moves, including game-distance zoom. */
export function depthClipRange(distance, radius, extent = radius) {
  const r = Math.max(.001, radius), d = Math.max(0, distance);
  const reach = Math.max(r * 1.75, extent * Math.SQRT2);
  return { near: Math.max(r * .002, d - reach), far: Math.max(d + Math.max(r * 3, reach), r * 4) };
}

/** Grid geometry is centered at world origin while model clipping is centered
 * on the model bounds. Expand only the depth calculation for that offset; the
 * rendered grid retains its configured, finite MDLVis size. */
export function gridDepthExtent(center, extent) {
  const configured = Math.max(1, Number(extent) || 1);
  const offset = typeof center?.length === 'function' ? center.length() : 0;
  const safety = Math.max(1, configured * .02);
  return configured + (offset + safety) / Math.SQRT2;
}

/** Radius around the model focus that contains every corner of every finite
 * grid plane without changing its configured MDLVis size. */
export function gridFrameRadius(center, extent) {
  const configured = Math.max(1, Number(extent) || 1);
  const offset = typeof center?.length === 'function' ? center.length() : 0;
  return configured * Math.SQRT2 + offset;
}

export function orthographicHalfHeight(radius, aspect) {
  return Math.max(1, radius) * 1.3 / Math.min(1, Math.max(.001, Number(aspect) || 1));
}

/** Fit a bounding sphere through the smaller perspective FOV. */
export function perspectiveFitDistance(radius, verticalFovDegrees, aspect) {
  const vertical = Math.max(.001, Number(verticalFovDegrees) || 42) * Math.PI / 180;
  const safeAspect = Math.max(.001, Number(aspect) || 1);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * safeAspect);
  return Math.max(1, radius) * 1.15 / Math.sin(Math.min(vertical, horizontal) / 2);
}

export function updateDepthClipping(camera, center, radius, extent = radius) {
  const distance = center.clone().sub(camera.position).dot(camera.getWorldDirection(new Vector3()));
  const { near, far } = depthClipRange(distance, radius, extent);
  if (camera.near !== near || camera.far !== far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
}

export function modelClipRadius(model, center, radius) {
  let result = radius;
  const extents = [model?.Info, ...(model?.Sequences || []), ...(model?.Geosets || []).flatMap(geo => [geo, ...(geo.Anims || [])])];
  for (const extent of extents) for (const property of ['MinimumExtent', 'MaximumExtent']) {
    const point = extent?.[property];
    if (point?.length >= 3 && Array.from(point).every(Number.isFinite)) result = Math.max(result, new Vector3().fromArray(point).distanceTo(center));
  }
  return result;
}

export function applyModelCamera(camera, controls, source, options = {}) {
  const evaluated = source?.position && source?.target ? source : evaluateModelCamera(options.model || {}, source, options.frame, options.sequenceIndex, options.globalTime);
  return applyEvaluatedModelCamera(camera, controls, evaluated, options.aspect);
}

/** Solve an axis directly BEFORE solving the plane: a near edge-on plane must
 * never amplify its almost-zero determinant into a huge constrained move. */
export function projectedPlaneTranslation(workplane, basis, dx, dy, constrain = false) {
  const axes = planeAxes(workplane), out = [0, 0, 0];
  const projection = i => {
    const [x, y] = basis[i], lengthSq = x * x + y * y;
    return lengthSq > 1e-4 ? (dx * x + dy * y) / lengthSq : 0;
  };
  if (constrain) { const axis = constrainedAxis(workplane); out[axis] = projection(axes.indexOf(axis)); return out; }
  const [[ax, ay], [bx, by]] = basis, determinant = ax * by - ay * bx;
  const product = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (product > 1e-4 && Math.abs(determinant) / product > .04) {
    out[axes[0]] = (dx * by - dy * bx) / determinant;
    out[axes[1]] = (dy * ax - dx * ay) / determinant;
  } else {
    const visible = ax * ax + ay * ay >= bx * bx + by * by ? 0 : 1;
    out[axes[visible]] = projection(visible);
  }
  return out;
}

/** Free mesh dragging uses the view plane through the selection pivot. */
export function screenPlaneTranslation(camera, pivot, width, height, dx, dy, constrain = false) {
  if (constrain) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
  const screen = pivot.clone().project(camera);
  return new Vector3(screen.x + dx * 2 / width, screen.y - dy * 2 / height, screen.z).unproject(camera).sub(pivot);
}
