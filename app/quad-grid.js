import { Quaternion, Vector3 } from 'three';

/** World-anchored powers of two reveal finer subdivisions as the camera zooms.
 * Orthographic guides fill the editing plane; perspective uses the XY ground. */
export function quadGridLayout(camera, target, width, height, settings, showGrid = true, showAxes = true) {
  const ortho = camera.isOrthographicCamera;
  const halfHeight = ortho ? (camera.top - camera.bottom) / (2 * camera.zoom)
    : camera.position.distanceTo(target) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom;
  const halfWidth = ortho ? (camera.right - camera.left) / (2 * camera.zoom) : halfHeight * width / Math.max(1, height);
  const unitsPerPixel = 2 * halfHeight / Math.max(1, height);
  let step = 2 ** Math.ceil(Math.log2(Math.max(1e-12, unitsPerPixel * settings.spacing)));
  const quaternion = ortho ? camera.quaternion.clone() : new Quaternion();
  const right = new Vector3(1, 0, 0).applyQuaternion(quaternion), up = new Vector3(0, 1, 0).applyQuaternion(quaternion);
  const normal = new Vector3(0, 0, 1).applyQuaternion(quaternion);
  const origin = ortho ? normal.multiplyScalar(target.dot(normal)) : new Vector3();
  const center = [target.dot(right), target.dot(up)], reach = [halfWidth, halfHeight].map(value => value * (ortho ? 1 : 3));
  while (2 * (reach[0] + reach[1]) / step > 1024) step *= 2;
  const range = center.map((value, axis) => [Math.floor((value - reach[axis]) / step) - 1, Math.ceil((value + reach[axis]) / step) + 1]);
  const segments = [];
  for (let axis = 0; axis < 2; axis++) for (let index = range[axis][0]; index <= range[axis][1]; index++) {
    const major = index % settings.majorEvery === 0, isAxis = index === 0 && showAxes;
    if (!isAxis && !(showGrid && settings.enabled)) continue;
    const a = [0, 0, 0], b = [0, 0, 0];
    a[axis] = b[axis] = index * step;
    a[1 - axis] = range[1 - axis][0] * step; b[1 - axis] = range[1 - axis][1] * step;
    segments.push({ a, b, color: isAxis ? settings.axisColor : major ? settings.majorColor : settings.minorColor,
      opacity: isAxis ? 1 : major ? settings.majorOpacity : settings.opacity, width: settings.thickness * (isAxis ? 1.8 : major ? 1.25 : 1) });
  }
  return { segments, quaternion, origin, step, extent: Math.hypot(...reach) + target.length() };
}
