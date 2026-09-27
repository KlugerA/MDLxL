import * as THREE from 'three';

const axis = new THREE.Vector3(0, 0, 1);
const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));

/** The old apparent orbit was the XY offset between the bounds center and model origin. */
export function showcaseOrbitRadius(center, size, percent) {
  const previousRadius = Math.max(Math.hypot(center.x, center.y), Math.hypot(size.x, size.y) / 8);
  return previousRadius * 4 * clamp(percent) / 100;
}

/** Inverse of T(offset) * Rz(angle), applied only to the render camera. */
export function setShowcaseOrbitCamera(source, display, angle, radius, rotation, offset) {
  rotation.setFromAxisAngle(axis, -angle);
  offset.set(radius * (Math.cos(angle) - 1), radius * Math.sin(angle), 0);
  display.copy(source);
  display.position.sub(offset).applyQuaternion(rotation);
  display.quaternion.premultiply(rotation);
  display.updateMatrixWorld();
  return display;
}
