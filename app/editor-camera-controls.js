import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Euler, Quaternion, Vector3 } from 'three';

/** XYZ Euler angles in world space, in degrees. Editing orbits around the
 * existing target, preserving distance and zoom; roll remains editable. */
export function editorCameraAngles(camera) {
  const euler = new Euler().setFromQuaternion(camera.quaternion, 'XYZ');
  return Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, euler[axis] * 180 / Math.PI]));
}
export function setEditorCameraAngles(camera, target, values) {
  if (!['x', 'y', 'z'].every(axis => Number.isFinite(Number(values?.[axis])))) return false;
  const distance = Math.max(.001, camera.position.distanceTo(target));
  const q = new Quaternion().setFromEuler(new Euler(...['x', 'y', 'z'].map(axis => Number(values[axis]) * Math.PI / 180), 'XYZ'));
  camera.quaternion.copy(q);
  camera.position.copy(target).add(new Vector3(0, 0, distance).applyQuaternion(q));
  camera.up.copy(new Vector3(0, 1, 0).applyQuaternion(q));
  camera.updateMatrixWorld(); return true;
}

export function zoomEditorCamera(camera, zoom) {
  camera.zoom = Math.max(.02, Math.min(100, zoom));
  camera.updateProjectionMatrix();
}

/** Keep the viewing position fixed while zooming. OrbitControls r183 otherwise
 * dollies perspective cameras into the mesh, distorting close work and losing
 * depth precision. Override its two zoom hooks so mouse/touch/key zoom agree. */
export class EditorCameraControls extends OrbitControls {
  update(deltaTime) {
    // OrbitControls caches its up-vector transform at construction. View presets
    // and editable roll change up later, so keep that cached basis synchronized.
    if (this._quat) { this._quat.setFromUnitVectors(this.object.up.clone().normalize(), new Vector3(0, 1, 0)); this._quatInverse.copy(this._quat).invert(); }
    return super.update(deltaTime);
  }
  _dollyIn(scale) { this._projectionZoom(1 / scale); }
  _dollyOut(scale) { this._projectionZoom(scale); }
  _projectionZoom(scale) {
    zoomEditorCamera(this.object, this.object.zoom * scale);
    this.dispatchEvent({ type: 'change' });
  }
  _pan(x, y) {
    const factor = this.object.isPerspectiveCamera ? this.object.zoom : 1;
    super._pan(x / factor, y / factor);
  }
}
