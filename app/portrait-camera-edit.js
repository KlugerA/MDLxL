import { recalculateExtents } from '../src/editor-document.js';
import { updateModelCameraFromView } from './portrait-view.js';

/** The single authoring operation: create the first camera, or replace the
 * selected camera's view. Navigation and snapping never call this function. */
export function setCameraFromCurrentView(model, cameraIndex, view, frame = 0, sequenceIndex = -1) {
  if (!view || !['position', 'target'].every(key => view[key]?.length === 3 && Array.from(view[key]).every(Number.isFinite))) throw Error('The model viewport is still loading.');
  model.Cameras ||= [];
  let index = model.Cameras[cameraIndex] ? cameraIndex : model.Cameras.length ? 0 : -1;
  if (index < 0) {
    const camera = { Name: 'Camera 01', Position: new Float32Array(view.position), TargetPosition: new Float32Array(view.target), FieldOfView: view.fieldOfView, NearClip: Math.max(.0001, view.near), FarClip: Math.max(view.far, view.near + .0001) };
    if (Number.isFinite(Number(view.roll))) camera.Rotation = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: Math.round(frame), Vector: Float32Array.of(Number(view.roll)) }] };
    index = model.Cameras.push(camera) - 1;
  } else updateModelCameraFromView(model, model.Cameras[index], view, frame, sequenceIndex, frame);
  recalculateExtents(model);
  return index;
}
