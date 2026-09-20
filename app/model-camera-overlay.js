import { Vector3 } from 'three';
import { projectGridSegment } from './preview-overlays.js';
import { evaluateModelCamera, MODEL_CAMERA_FOV_FACTOR } from './portrait-view.js';

export function modelCameraGizmos(model, frame = 0, sequenceIndex = -1, globalTime = frame, radius = 100, aspect = 4 / 3) {
  return (model.Cameras || []).flatMap((source, index) => {
    const evaluated = evaluateModelCamera(model, source, frame, sequenceIndex, globalTime);
    if (!evaluated) return [];
    const position = new Vector3().fromArray(evaluated.position), target = new Vector3().fromArray(evaluated.target);
    const forward = target.clone().sub(position).normalize();
    if (forward.lengthSq() < .5) forward.set(1, 0, 0);
    const right = new Vector3().crossVectors(forward, Math.abs(forward.z) > .99 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)).normalize();
    const up = new Vector3().crossVectors(right, forward).normalize();
    const roll = evaluated.roll;
    right.applyAxisAngle(forward, Number(roll) || 0); up.applyAxisAngle(forward, Number(roll) || 0);
    const length = Math.max(.1, radius * .2), half = length * Math.tan(evaluated.fieldOfView * MODEL_CAMERA_FOV_FACTOR / 2);
    const front = position.clone().addScaledVector(forward, length);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => front.clone().addScaledVector(right, half * x * aspect).addScaledVector(up, half * y));
    const segments = [[position, target]];
    corners.forEach((corner, i) => segments.push([position, corner], [corner, corners[(i + 1) % 4]]));
    for (const axis of [right, up]) segments.push([target.clone().addScaledVector(axis, length * .1), target.clone().addScaledVector(axis, -length * .1)]);
    return [{ name: source.Name || `Camera ${index}`, position, segments }];
  });
}

/** Model cameras are editor-only markers, never part of a clean capture. */
export function drawModelCameraOverlay(context, model, camera, width, height, ratio, frame, sequence, globalTime, radius, color = '#e9b54a', aspect = 4 / 3) {
  context.clearRect(0, 0, width * ratio, height * ratio); context.save(); context.scale(ratio, ratio);
  context.lineWidth = 1.5; context.strokeStyle = color; context.fillStyle = color; context.font = '12px sans-serif';
  for (const gizmo of modelCameraGizmos(model, frame, sequence, globalTime, radius, aspect)) {
    context.beginPath();
    for (const [from, to] of gizmo.segments) {
      const segment = projectGridSegment(camera, width, height, from.toArray(), to.toArray());
      if (!segment) continue;
      context.moveTo(segment[0].x, segment[0].y); context.lineTo(segment[1].x, segment[1].y);
    }
    context.stroke();
    const p = gizmo.position.clone().project(camera);
    if (p.z >= -1 && p.z <= 1) context.fillText(gizmo.name, (p.x + 1) * width / 2 + 7, (1 - p.y) * height / 2 - 7);
  }
  context.restore();
}
