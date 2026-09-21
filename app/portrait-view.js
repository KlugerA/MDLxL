import { Vector3 } from 'three';
import { sampleTrack } from '../src/animation.js';

export const PORTRAIT_ASPECT = 0.0835 / 0.085;
// WC3's model-camera FOV is converted to vertical projection by the portrait
// path using * .75, not passed directly to a vertical-FOV camera. See
// WarsmashModEngine/handlers/w3x/camera/PortraitCameraManager.java.
export const MODEL_CAMERA_FOV_FACTOR = .75;
export const DEFAULT_MODEL_CAMERA_FOV = Math.PI / 4;
export const HUMAN_FRAME_SIZE = 184;
export const PORTRAIT_RECT = Object.freeze({ x: 8, y: 9, width: 167, height: 170 });
export const HUMAN_TILE_LAYOUT = Object.freeze([
  Object.freeze({ name: 'humanuitile01.dds', sx: 0, sy: 160, sw: 512, sh: 352, dx: 0, dy: 0, dw: 512, dh: 352 }),
  Object.freeze({ name: 'humanuitile02.dds', sx: 0, sy: 212, sw: 512, sh: 300, dx: 512, dy: 52, dw: 512, dh: 300 }),
]);
// Tight native-asset crop: preserve the gold arch and stone surround, omit the
// unused health/mana wells. This changes presentation size, never projection.
export const HUMAN_FRAME_CROP = Object.freeze({ x: 414, y: 116, width: 184, height: 184 });

export function firstPortraitSequenceIndex(model) {
  return (model?.Sequences || []).findIndex(sequence => {
    const name = String(sequence?.Name || '');
    return /portrait/i.test(name);
  });
}

const finiteVector = value => value?.length >= 3 && Array.from(value).slice(0, 3).every(Number.isFinite);
const vector = (value, fallback) => new Vector3().fromArray(finiteVector(value) ? value : fallback);

export function modelCameraSamples(model, source, frame = 0, sequenceIndex = -1, globalTime = frame) {
  const options = { interval: model?.Sequences?.[sequenceIndex]?.Interval, globalSequences: model?.GlobalSequences, globalTime, fallback: [0, 0, 0] };
  return {
    translation: vector(sampleTrack(source?.Translation, frame, options), [0, 0, 0]),
    targetTranslation: vector(sampleTrack(source?.TargetTranslation, frame, options), [0, 0, 0]),
    roll: Number(sampleTrack(source?.Rotation, frame, { ...options, fallback: 0 })) || 0,
  };
}

/** One evaluated MDL/MDX camera representation is shared by every viewport path. */
export function evaluateModelCamera(model, source, frame = 0, sequenceIndex = -1, globalTime = frame) {
  if (!finiteVector(source?.Position) || !finiteVector(source?.TargetPosition)) return null;
  const samples = modelCameraSamples(model, source, frame, sequenceIndex, globalTime);
  const position = vector(source.Position, [0, 0, 0]).add(samples.translation);
  const target = vector(source.TargetPosition, [0, 0, 0]).add(samples.targetTranslation);
  const fieldOfView = Number(source.FieldOfView ?? source.FOV);
  const near = Number(source.NearClip), far = Number(source.FarClip);
  return {
    position: position.toArray(), target: target.toArray(), roll: samples.roll,
    fieldOfView: fieldOfView > 0 && fieldOfView < Math.PI ? fieldOfView : Math.PI / 4,
    near: near > 0 ? near : .2,
    far: far > Math.max(0, near) ? far : Math.max(1000, (near > 0 ? near : .2) + 1),
  };
}

export function applyEvaluatedModelCamera(camera, controls, evaluated, aspect) {
  if (!evaluated || !finiteVector(evaluated.position) || !finiteVector(evaluated.target)) return false;
  camera.position.fromArray(evaluated.position); controls.target.fromArray(evaluated.target);
  if (camera.position.distanceToSquared(controls.target) < 1e-12) controls.target.x += 1;
  const forward = controls.target.clone().sub(camera.position).normalize();
  const reference = Math.abs(forward.z) > .9999 ? new Vector3(-1, 0, 0) : new Vector3(0, 0, 1);
  const right = new Vector3().crossVectors(forward, reference).normalize();
  camera.up.copy(new Vector3().crossVectors(right, forward).normalize().applyAxisAngle(forward, Number(evaluated.roll) || 0));
  camera.fov = evaluated.fieldOfView * MODEL_CAMERA_FOV_FACTOR * 180 / Math.PI;
  camera.near = evaluated.near; camera.far = evaluated.far;
  if (Number.isFinite(aspect) && aspect > 0) camera.aspect = aspect;
  camera.zoom = 1; camera.lookAt(controls.target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  controls.object = camera; controls.update(); return true;
}

export function editorCameraSnapshot(camera, target, perspectiveCamera = camera) {
  const orthographic = !!camera?.isOrthographicCamera, projectionCamera = orthographic ? perspectiveCamera : camera;
  // An axis view has no FOV. Encode it with the conventional WC3 model-camera
  // FOV and solve distance from its visible height instead of inheriting a
  // stale or already-corrupted camera projection.
  const zoom = orthographic ? 1 : Math.max(.0001, Number(projectionCamera?.zoom) || 1);
  const baseFov = orthographic ? DEFAULT_MODEL_CAMERA_FOV * MODEL_CAMERA_FOV_FACTOR : Math.max(.0001, Number(projectionCamera?.fov) || 42) * Math.PI / 180;
  const effectiveFov = 2 * Math.atan(Math.tan(baseFov / 2) / zoom);
  const position = camera.position.clone(), lookTarget = target.clone();
  const forward = lookTarget.sub(position);
  if (forward.lengthSq() < 1e-12) camera.getWorldDirection(forward);
  forward.normalize();
  const reference = Math.abs(forward.z) > .9999 ? new Vector3(-1, 0, 0) : new Vector3(0, 0, 1);
  const right = new Vector3().crossVectors(forward, reference).normalize();
  const levelUp = new Vector3().crossVectors(right, forward).normalize();
  const viewUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  viewUp.addScaledVector(forward, -viewUp.dot(forward)).normalize();
  const roll = Math.atan2(forward.dot(new Vector3().crossVectors(levelUp, viewUp)), levelUp.dot(viewUp));
  if (orthographic) {
    const halfHeight = Math.abs(Number(camera.top) - Number(camera.bottom)) / (2 * Math.max(.0001, Number(camera.zoom) || 1));
    const distance = halfHeight / Math.max(.000001, Math.tan(effectiveFov / 2));
    position.copy(target).addScaledVector(forward, -distance);
  }
  const distance = position.distanceTo(target);
  let near = Number(projectionCamera?.near), far = Number(projectionCamera?.far);
  if (!(near > 0) || near >= distance) near = Math.max(.1, distance * .01);
  if (!(far > near) || far <= distance) far = Math.max(1000, distance * 10, near + 1);
  return {
    position: position.toArray(), target: target.toArray(),
    roll,
    fieldOfView: effectiveFov / MODEL_CAMERA_FOV_FACTOR,
    near, far,
  };
}

function shiftCameraRoll(track, delta) {
  for (const key of track.Keys || []) {
    key.Vector[0] += delta;
    if (track.LineType === 3) {
      if (key.InTan) key.InTan[0] += delta;
      if (key.OutTan) key.OutTan[0] += delta;
    }
  }
}

function portraitIntervals(model) {
  return (model?.Sequences || []).filter(sequence => /portrait/i.test(String(sequence?.Name || '')) && sequence?.Interval?.length >= 2)
    .map(sequence => [Number(sequence.Interval[0]), Number(sequence.Interval[1])]).filter(interval => interval.every(Number.isFinite));
}

function sharedPortraitRoll(model, source, roll) {
  const intervals = portraitIntervals(model);
  if (!intervals.length) return false;
  const prior = source.Rotation?.Keys ? source.Rotation : null, lineType = Number(prior?.LineType) || 0;
  const insidePortrait = frame => intervals.some(([start, end]) => frame >= start && frame <= end);
  const keys = prior?.GlobalSeqId == null ? (prior?.Keys || []).filter(key => !insidePortrait(key.Frame)) : [];
  const additions = new Map();
  for (const [start, end] of intervals) for (const Frame of new Set([start, end])) {
    const key = { Frame, Vector: Float32Array.of(roll) };
    if (lineType === 2) key.InTan = key.OutTan = Float32Array.of(0);
    if (lineType === 3) key.InTan = key.OutTan = Float32Array.of(roll);
    additions.set(Frame, key);
  }
  source.Rotation = { ...(prior || {}), LineType: lineType, GlobalSeqId: null, Keys: [...keys.filter(key => !additions.has(key.Frame)), ...additions.values()].sort((a, b) => a.Frame - b.Frame) };
  return true;
}

/** Write an evaluated editor view back into the camera's static fields without
 * double-applying animated offsets at this time. Existing roll animation keeps
 * its motion while the complete curve is re-based onto the visible view. */
export function updateModelCameraFromView(model, source, view, frame = 0, sequenceIndex = -1, globalTime = frame, fields = ['position', 'target', 'roll', 'fieldOfView', 'near', 'far']) {
  if (!source || !view) return false;
  const samples = modelCameraSamples(model, source, frame, sequenceIndex, globalTime), selected = new Set(fields);
  if (selected.has('position') && finiteVector(view.position)) source.Position = new Float32Array(new Vector3().fromArray(view.position).sub(samples.translation).toArray());
  if (selected.has('target') && finiteVector(view.target)) source.TargetPosition = new Float32Array(new Vector3().fromArray(view.target).sub(samples.targetTranslation).toArray());
  if (selected.has('roll') && Number.isFinite(Number(view.roll))) {
    const roll = Number(view.roll);
    if (sharedPortraitRoll(model, source, roll)) {
      // Warcraft cameras have no static roll field. Matching keys in every
      // Portrait interval make this one authored view shared by all variants.
    } else if (source.Rotation?.Keys?.length) {
      const difference = roll - samples.roll;
      shiftCameraRoll(source.Rotation, Math.atan2(Math.sin(difference), Math.cos(difference)));
    } else source.Rotation = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: Math.round(frame), Vector: Float32Array.of(roll) }] };
  }
  if (selected.has('fieldOfView') && Number(view.fieldOfView) > 0 && Number(view.fieldOfView) < Math.PI) source.FieldOfView = Number(view.fieldOfView);
  if (selected.has('near') && Number(view.near) > 0 && Number(view.near) < Number(view.far ?? source.FarClip)) source.NearClip = Number(view.near);
  if (selected.has('far') && Number(view.far) > Number(view.near ?? source.NearClip)) source.FarClip = Number(view.far);
  return true;
}

export function portraitCaptureLayout(innerWidth, innerHeight) {
  if (!(innerWidth > 0 && innerHeight > 0)) throw Error('Portrait capture dimensions must be positive.');
  const size = Math.max(1, Math.round(innerHeight * HUMAN_FRAME_SIZE / PORTRAIT_RECT.height));
  return {
    size,
    model: {
      x: size * PORTRAIT_RECT.x / HUMAN_FRAME_SIZE,
      y: size * PORTRAIT_RECT.y / HUMAN_FRAME_SIZE,
      width: size * PORTRAIT_RECT.width / HUMAN_FRAME_SIZE,
      height: size * PORTRAIT_RECT.height / HUMAN_FRAME_SIZE,
    },
  };
}
