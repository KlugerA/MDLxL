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
