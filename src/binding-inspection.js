/** Actual, nonzero direct influences only; ancestry does not add a binding. */
export function directlyBoundBoneIds(model, selectionByGeoset = {}) {
  const bones = new Set((model?.Bones || []).map(node => node.ObjectId)), result = new Set();
  for (const [index, vertices] of Object.entries(selectionByGeoset || {})) {
    const geoset = model?.Geosets?.[Number(index)];
    if (!geoset) continue;
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights;
    for (const vertex of vertices || []) {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= count) continue;
      if (skin?.length === count * 8) {
        for (let slot = 0; slot < 4; slot++) {
          const id = skin[vertex * 8 + slot];
          if (skin[vertex * 8 + slot + 4] > 0 && bones.has(id)) result.add(id);
        }
      } else for (const id of geoset.Groups?.[geoset.VertexGroup?.[vertex]] || []) if (bones.has(id)) result.add(id);
    }
  }
  return [...result].sort((a, b) => a - b);
}
