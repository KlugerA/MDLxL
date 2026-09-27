import { Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, skinGeoset } from './animation.js';

/** Count each directly influenced vertex once, including positive HD weights. */
export function movementChildVertexCount(model, ids = []) {
  const bones = new Set((model.Bones || []).filter(node => ids.includes(node.ObjectId)).map(node => node.ObjectId));
  let count = 0;
  for (const geo of model.Geosets || []) {
    const vertices = (geo.Vertices?.length || 0) / 3, skin = geo.SkinWeights;
    for (let vertex = 0; vertex < vertices; vertex++) {
      const bound = skin?.length === vertices * 8
        ? [0, 1, 2, 3].some(slot => skin[vertex * 8 + slot + 4] > 0 && bones.has(skin[vertex * 8 + slot]))
        : (geo.Groups?.[geo.VertexGroup?.[vertex]] || []).some(id => bones.has(id));
      if (bound) count++;
    }
  }
  return count;
}

/** Center of the visible vertices bound directly to one bone. The average
 * influence is used to compensate mixed-weight skinning when the bone moves. */
export function movementBoneVertexCenter(model, boneId, matrices) {
  const center = new Vector3();
  let count = 0, influence = 0;
  for (const geo of model.Geosets || []) {
    const vertices = (geo.Vertices?.length || 0) / 3, skin = geo.SkinWeights;
    const bound = [];
    for (let vertex = 0; vertex < vertices; vertex++) {
      let weight = 0;
      if (skin?.length === vertices * 8) {
        let total = 0;
        for (let slot = 0; slot < 4; slot++) {
          const value = skin[vertex * 8 + slot + 4];
          total += value;
          if (skin[vertex * 8 + slot] === boneId) weight += value;
        }
        weight = total ? weight / total : 0;
      } else {
        const group = geo.Groups?.[geo.VertexGroup?.[vertex]] || [];
        weight = group.length ? group.filter(id => id === boneId).length / group.length : 0;
      }
      if (!weight) continue;
      bound.push([vertex, weight]);
    }
    if (!bound.length) continue;
    const posed = skinGeoset(geo, matrices);
    for (const [vertex, weight] of bound) {
      center.add(new Vector3().fromArray(posed, vertex * 3));
      influence += weight; count++;
    }
  }
  return count ? { center: center.divideScalar(count), influence: influence / count } : null;
}

/** Arithmetic selection centroid, matching the existing vertex transform pivot. */
export function movementSelectionSummary(model, ids = [], selectionByGeoset = {}, { time = 0, sequenceIndex = -1, restPose = false } = {}) {
  const selected = allNodes(model).filter(node => ids.includes(node.ObjectId));
  const matrices = sampleNodeMatrices(model, restPose ? 0 : time, restPose ? -1 : sequenceIndex, restPose ? 0 : time);
  let selectedCount = 0;
  const vertexCenter = new Vector3();
  for (const [index, selection] of Object.entries(selectionByGeoset || {})) {
    const geo = model.Geosets?.[Number(index)];
    if (!geo?.Vertices) continue;
    const vertices = restPose || sequenceIndex < 0 ? geo.Vertices : skinGeoset(geo, matrices);
    for (const vertex of new Set(selection || [])) {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex * 3 + 2 >= vertices.length) continue;
      vertexCenter.add(new Vector3().fromArray(vertices, vertex * 3)); selectedCount++;
    }
  }
  if (selectedCount) vertexCenter.divideScalar(selectedCount);
  const center = new Vector3();
  for (const node of selected) {
    const point = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]);
    const matrix = matrices.get(node.ObjectId); if (matrix) point.applyMatrix4(matrix);
    center.add(point);
  }
  if (selected.length) center.divideScalar(selected.length);
  else center.copy(vertexCenter);
  return { selectedCount, childVertexCount: movementChildVertexCount(model, ids), center: selected.length || selectedCount ? center.toArray() : null, source: selected.length ? 'nodes' : selectedCount ? 'vertices' : null };
}
