import { createNode, deleteNode } from './editor-document.js';
import { bindVertices } from './editor-commands.js';

const IDENTITY_BIND_POSE = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

export function selectedVertexCenter(model, selection = {}) {
  const center = [0, 0, 0];
  let count = 0;
  for (const [key, indices] of Object.entries(selection)) {
    const vertices = model.Geosets?.[Number(key)]?.Vertices;
    if (!vertices) continue;
    for (const index of new Set(indices)) {
      if (!Number.isInteger(index) || index < 0 || index * 3 + 2 >= vertices.length) continue;
      for (let axis = 0; axis < 3; axis++) center[axis] += vertices[index * 3 + axis];
      count++;
    }
  }
  return count ? center.map(value => value / count) : center;
}

export function createRigNode(model, type, selection = {}) {
  if (!['Bone', 'Attachment'].includes(type)) throw new Error('Choose Bone or Attachment.');
  const name = type === 'Bone' ? (() => {
    const used = new Set((model.Bones || []).map(bone => bone.Name));
    let index = 0;
    while (used.has(`bone_new${index}`)) index++;
    return `bone_new${index}`;
  })() : 'New Ref';
  // Object IDs remain stable. Extend each bind-pose array at the new ID while
  // leaving every existing inverse matrix in its original slot.
  const bindPoses = model.BindPoses;
  if (bindPoses?.length) model.BindPoses = [];
  let node;
  try { node = createNode(model, type); }
  finally { if (bindPoses?.length) model.BindPoses = bindPoses; }
  for (const pose of bindPoses || []) while (pose.Matrices.length <= node.ObjectId) pose.Matrices.push(new Float32Array(IDENTITY_BIND_POSE));
  node.Name = name;
  node.PivotPoint = new Float32Array(selectedVertexCenter(model, selection));
  model.PivotPoints[node.ObjectId] = node.PivotPoint;
  return node;
}

export function attachToBone(model, childId, parentId) {
  const child = model.Nodes?.[childId], parent = (model.Bones || []).find(bone => bone.ObjectId === parentId);
  if (!child || !parent || childId === parentId) throw new Error('Select one child and a different parent bone.');
  const seen = new Set();
  for (let next = parent; next?.Parent != null; next = model.Nodes?.[next.Parent]) {
    if (seen.has(next.ObjectId)) throw new Error('The parent chain already contains a cycle.');
    seen.add(next.ObjectId);
    if (next.Parent === childId) throw new Error('A bone cannot be parented to its own descendant.');
  }
  child.Parent = parentId;
}

export function detachFromBone(model, childId) {
  const child = model.Nodes?.[childId];
  if (!child || !(model.Bones || []).some(bone => bone.ObjectId === child.Parent)) throw new Error('Select one node with a parent bone.');
  child.Parent = null;
}

function selectedIndices(geoset, indices) {
  const count = (geoset?.Vertices?.length || 0) / 3;
  const ids = [...new Set(indices || [])];
  if (!ids.length || ids.some(id => !Number.isInteger(id) || id < 0 || id >= count)) throw new Error('Select valid vertices first.');
  if (geoset.VertexGroup?.length !== count) throw new Error('Vertex groups do not match the vertex count.');
  if (geoset.SkinWeights?.length && geoset.SkinWeights.length !== count * 8) throw new Error('Skin weights do not match the vertex count.');
  return ids;
}

function groupFor(geoset, boneIds) {
  let index = geoset.Groups.findIndex(group => group.length === boneIds.length && group.every((id, slot) => id === boneIds[slot]));
  if (index < 0) {
    if (geoset.Groups.length >= 256) throw new Error('Classic vertex groups are limited to 256 by the file format.');
    index = geoset.Groups.push(boneIds) - 1;
  }
  return index;
}

function writeWeights(skin, vertex, influences) {
  const offset = vertex * 8;
  skin.fill(0, offset, offset + 8);
  const total = influences.reduce((sum, item) => sum + item[1], 0);
  if (!total) return;
  let assigned = 0;
  influences.forEach(([id, weight], slot) => {
    const portion = slot === influences.length - 1 ? 255 - assigned : Math.min(255 - assigned, Math.round(weight * 255 / total));
    skin[offset + slot] = id;
    skin[offset + 4 + slot] = portion;
    assigned += portion;
  });
}

export function changeVertexBinding(model, geoset, indices, boneId, mode) {
  const ids = selectedIndices(geoset, indices);
  if (!(model.Bones || []).some(bone => bone.ObjectId === boneId)) throw new Error('Select one bone.');
  if (mode === 'hard') return bindVertices(model, geoset, ids, boneId);
  if (!['soft', 'detach'].includes(mode)) throw new Error('Unknown bone binding tool.');
  const skin = geoset.SkinWeights?.length ? geoset.SkinWeights : null;
  if (skin && boneId > (model.Version >= 1400 ? 65535 : 255)) throw new Error('Bone ID exceeds this skin format.');
  for (const vertex of ids) {
    const group = geoset.Groups[geoset.VertexGroup[vertex]] || [];
    const influences = skin
      ? Array.from({ length: 4 }, (_, slot) => [skin[vertex * 8 + slot], skin[vertex * 8 + 4 + slot]]).filter(([, weight]) => weight > 0)
      : group.map(id => [id, 1]);
    const present = influences.some(([id]) => id === boneId);
    if (mode === 'soft' && !present) {
      if (influences.length >= 4) throw new Error('A vertex supports at most four controlling bones.');
      influences.push([boneId, influences.reduce((sum, [, weight]) => sum + weight, 0) / Math.max(1, influences.length)]);
    }
    if (mode === 'detach') influences.splice(0, influences.length, ...influences.filter(([id]) => id !== boneId));
    const boneIds = [...new Set(influences.map(([id]) => id))];
    geoset.VertexGroup[vertex] = groupFor(geoset, boneIds);
    if (skin) writeWeights(skin, vertex, influences);
  }
  geoset.TotalGroupsCount = geoset.Groups.reduce((sum, group) => sum + group.length, 0);
}

export function deleteRigBone(model, id) {
  if (!(model.Bones || []).some(bone => bone.ObjectId === id)) throw new Error('Select one bone to delete.');
  const children = (model.Nodes || []).filter(node => node?.Parent === id);
  for (const geoset of model.Geosets || []) {
    for (const group of geoset.Groups || []) {
      for (let at = group.indexOf(id); at >= 0; at = group.indexOf(id)) group.splice(at, 1);
    }
    geoset.TotalGroupsCount = (geoset.Groups || []).reduce((sum, group) => sum + group.length, 0);
    const skin = geoset.SkinWeights;
    if (skin?.length) for (let vertex = 0; vertex < skin.length / 8; vertex++) {
      if (![0, 1, 2, 3].some(slot => skin[vertex * 8 + slot] === id && skin[vertex * 8 + 4 + slot] > 0)) continue;
      const influences = Array.from({ length: 4 }, (_, slot) => [skin[vertex * 8 + slot], skin[vertex * 8 + 4 + slot]])
        .filter(([bone, weight]) => bone !== id && weight > 0);
      writeWeights(skin, vertex, influences);
    }
  }
  const bindPoses = model.BindPoses;
  if (bindPoses?.length) model.BindPoses = [];
  let removed;
  try { removed = deleteNode(model, id); }
  finally { if (bindPoses?.length) model.BindPoses = bindPoses; }
  for (const pose of bindPoses || []) {
    if (pose.Matrices[id]) pose.Matrices[id] = new Float32Array(IDENTITY_BIND_POSE);
    while (pose.Matrices.length && !model.Nodes[pose.Matrices.length - 1]) pose.Matrices.pop();
  }
  for (const child of children) child.Parent = null;
  return removed;
}
