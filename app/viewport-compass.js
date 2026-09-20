import { Quaternion, Vector3 } from 'three';

// Warcraft models use +X as their front and +Z as their up axis. Keeping this
// mapping beside the widget makes a compass click agree with the View menu.
export const COMPASS_AXES = Object.freeze([
  { id: 'x', label: 'X', vector: [1, 0, 0], color: '#e85d57', view: 'front', title: 'Look from +X (front)' },
  { id: 'y', label: 'Y', vector: [0, 1, 0], color: '#53b95b', view: 'left', title: 'Look from +Y (left)' },
  { id: 'z', label: 'Z', vector: [0, 0, 1], color: '#4d8cff', view: 'top', title: 'Look from +Z (top)' },
]);

/** Project world axes into the camera plane for the small viewport compass. */
export function projectCompassAxes(cameraQuaternion = new Quaternion()) {
  const inverse = cameraQuaternion?.clone
    ? cameraQuaternion.clone().invert()
    : new Quaternion().fromArray(cameraQuaternion).invert();
  return COMPASS_AXES.map(axis => {
    const direction = new Vector3().fromArray(axis.vector).applyQuaternion(inverse);
    return { ...axis, x: direction.x, y: -direction.y, depth: direction.z };
  });
}
