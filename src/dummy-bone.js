import { createNode, NODE_TYPES } from './editor-document.js';

const nodeCollections = model => Object.values(NODE_TYPES).flatMap(([key]) => model[key] || []);
const validPivot = value => value && value.length === 3 && Array.from(value).every(Number.isFinite);

/**
 * Resolve the one shared rigid-import anchor without silently repurposing a
 * user-authored rig node. Invalid anchors make the surrounding edit fail
 * atomically instead of changing the existing rig behind the user's back.
 */
export function ensureDummyBone(model, { weighted = false } = {}) {
  const named = nodeCollections(model).filter(node => node?.Name === 'DummyBone');
  if (named.length > 1) throw Error('More than one node named DummyBone exists. Rename the extras before importing or forging.');
  let bone = named[0];
  if (bone && !(model.Bones || []).includes(bone)) throw Error('DummyBone exists but is not a Bone. Rename it before importing or forging.');
  if (bone && (!Number.isInteger(bone.ObjectId) || bone.ObjectId < 0 || model.Nodes?.[bone.ObjectId] !== bone)) throw Error('DummyBone has an invalid node reference. Repair the model before importing or forging.');
  if (bone && bone.Parent != null && bone.Parent !== -1) throw Error('DummyBone must be a root bone before it can receive imported objects.');
  if (bone && ((bone.GeosetId != null && bone.GeosetId !== -1) || (bone.GeosetAnimId != null && bone.GeosetAnimId !== -1))) throw Error('DummyBone already owns a geoset or geoset animation. Rename it before importing or forging.');
  if (bone && (!validPivot(bone.PivotPoint) || model.PivotPoints?.[bone.ObjectId] !== bone.PivotPoint)) throw Error('DummyBone has an invalid pivot reference. Repair the model before importing or forging.');
  if (!bone) { bone = createNode(model, 'Bone'); bone.Name = 'DummyBone'; }
  if (weighted) {
    const maximum = model.Version >= 1400 ? 65535 : 255;
    if (bone.ObjectId > maximum) throw Error(`DummyBone must have an object ID from 0 to ${maximum} for weighted geometry.`);
  }
  return bone;
}
