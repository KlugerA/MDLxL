import { animationTargets, createGeosetAnimations, readAnimationTrack, setAnimationKey } from './animation-tracks.js';
import { nodeGeosets } from './resource-relations.js';
import { editVisibility, visibilityGlobal } from './visibility-editing.js';

export const nodeTypeNames = { Bones: 'Bone', Helpers: 'Helper', Attachments: 'Attachment', Lights: 'Light', ParticleEmitters: 'Model emitter', ParticleEmitters2: 'Particle emitter', ParticleEmitterPopcorns: 'Popcorn emitter', RibbonEmitters: 'Ribbon', EventObjects: 'Event', CollisionShapes: 'Collision' };
export function nodeVisibilityTargets(model, ids) {
  const native = animationTargets(model, { nodeIds: ids }).filter(t => t.property === 'Visibility');
  const nativeIds = new Set(native.map(t => t.id));
  const bones = new Set([...(model.Bones || []), ...(model.Helpers || [])].map(n => n.ObjectId));
  const meshes = [...new Set(ids.filter(id => !nativeIds.has(id) && bones.has(id)).flatMap(id => nodeGeosets(model, id)))];
  return [...native, ...animationTargets(model, { geosetIds: meshes }).filter(t => t.property === 'Alpha')];
}
export function setNodeVisibility(model, ids, { sequenceIndex, globalSeqId = null, frame, range, frames, amount }) {
  const targets = nodeVisibilityTargets(model, ids);
  if (!targets.length) throw Error('This node has no visibility track or bound mesh.');
  if (targets.some(t => visibilityGlobal(readAnimationTrack(model, t)) !== globalSeqId)) throw Error('Choose the clock used by this visibility track.');
  if (!range && !frames) return setAnimationKey(model, targets, frame, amount, sequenceIndex, globalSeqId);
  const prepared = targets.flatMap(target => {
    const value = readAnimationTrack(model, target), selected = frames?.filter(at => value?.Keys?.some(k => k.Frame === at));
    if (frames && !selected.length) return [];
    const owner = target.kind === 'node' ? model.Nodes[target.id] : model.GeosetAnims.find(a => a.GeosetId === target.id);
    return [{ target, track: editVisibility(value, model, { sequenceIndex, range, frames: selected, amount, fallback: owner?._MdxDefaults?.[target.property] ?? 1 }) }];
  });
  for (const { target, track } of prepared) {
    if (target.kind === 'node') model.Nodes[target.id].Visibility = track;
    else { createGeosetAnimations(model, [target.id]); model.GeosetAnims.find(a => a.GeosetId === target.id).Alpha = track; }
  }
  return prepared.length;
}
