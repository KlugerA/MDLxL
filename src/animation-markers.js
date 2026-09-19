import { timelineTracks, timelineKeys } from './keyframe-timeline.js';

/** Display context is independent of the selected controller used for editing.
 * Local sequence keys stay local; a global clock shows only its own keys.
 */
export function animationMarkerTimes(model, domain, tracks = timelineTracks(model)) {
  const emitters = new Set(['ParticleEmitters','ParticleEmitters2','ParticleEmitterPopcorns','RibbonEmitters']
    .flatMap(key => (model[key] || []).map(node => node.ObjectId)));
  const visible = tracks.filter(track => track.globalSeqId === domain.globalSeqId &&
    (track.kind === 'geoset' || track.kind === 'node' &&
      (['Translation','Rotation','Scaling'].includes(track.property) || emitters.has(track.id))));
  return [...new Set(timelineKeys(model, visible, domain).map(key => key.frame))].sort((a,b) => a-b);
}
