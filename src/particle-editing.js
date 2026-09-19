import { Euler, Quaternion } from 'three';
import { sampleTrack } from './animation.js';
import { setKey } from './editor-commands.js';

export const particleAnimatedParameters = ['Visibility', 'EmissionRate', 'Speed', 'Variation', 'Latitude', 'Width', 'Length', 'Gravity'];
export const particleUVGroups = [['Head (Life Span)', 'LifeSpanUVAnim'], ['Head (Decay)', 'DecayUVAnim'], ['Tail (Life Span)', 'TailUVAnim'], ['Tail (Decay)', 'TailDecayUVAnim']];
export const particleFlags = [['Unshaded', 32768], ['Unfogged', 262144], ['Line Emitter', 131072], ['Sort Primitives Far Z', 65536], ['Model Space', 524288], ['XY Quad', 1048576]];

export function particleRotationDegrees(model, emitter, frame, sequenceIndex) {
  const values = sampleTrack(emitter?.Rotation, frame, { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback: [0, 0, 0, 1], quaternion: true });
  return new Euler().setFromQuaternion(new Quaternion().fromArray(values).normalize(), 'XYZ').toArray().slice(0, 3).map(value => value * 180 / Math.PI);
}

/** Absolute local XYZ angles at the playhead; other frames/channels survive. */
export function setParticleRotationDegrees(model, id, frame, sequenceIndex, angles) {
  const emitter = model.ParticleEmitters2?.find(node => node.ObjectId === id);
  if (!emitter) throw new Error('Choose a Particle Emitter 2.');
  if (angles.length !== 3 || angles.some(value => !Number.isFinite(value))) throw new Error('Enter finite X, Y and Z angles.');
  const duration = model.GlobalSequences?.[emitter.Rotation?.GlobalSeqId];
  let time = Math.round(frame);
  if (duration > 0) time = ((time % duration) + duration) % duration;
  else if (model.Sequences?.[sequenceIndex]) { const [start, end] = model.Sequences[sequenceIndex].Interval; time = Math.max(start, Math.min(end, time)); }
  const prior = emitter.Rotation?.Keys?.find(key => key.Frame === time);
  const quaternion = new Quaternion().setFromEuler(new Euler(...angles.map(value => value * Math.PI / 180), 'XYZ')).normalize().toArray();
  setKey(emitter, 'Rotation', time, quaternion, prior ? { inTan: prior.InTan, outTan: prior.OutTan } : {});
  return time;
}

/** Preview is owned temporary state; simulation cannot write into the document. */
export function particlePreviewModel(model, id, isolate = false) {
  const preview = structuredClone(model);
  preview.ParticleEmitters2 = (preview.ParticleEmitters2 || []).filter(node => node.ObjectId === id);
  preview.ParticleEmitters = []; preview.ParticleEmitterPopcorns = []; preview.RibbonEmitters = [];
  if (isolate) { preview.Geosets = []; preview.GeosetAnims = []; }
  return preview;
}
