/** Geometry/UV selection eligibility is independent of visible geosets. */
export function eligibleUVVertices(geoset, indices, hiddenVertices = [], uvSet = 0) {
  const uv = geoset?.TVertices?.[uvSet], count = Math.min((geoset?.Vertices?.length || 0) / 3, (uv?.length || 0) / 2);
  const hidden = new Set(hiddenVertices);
  return [...new Set(indices || [])].filter(index => Number.isInteger(index) && index >= 0 && index < count && !hidden.has(index) && Number.isFinite(uv[index * 2]) && Number.isFinite(uv[index * 2 + 1]));
}

/** Snapshot at UV-maps entry; later UV selection changes can only narrow this set. */
export function captureUVSelection(model, selection, selectedGeosets, hidden = {}) {
  const result = {};
  for (const index of selectedGeosets || []) {
    const ids = eligibleUVVertices(model.Geosets?.[index], selection?.[index], hidden[index]);
    if (ids.length) result[index] = ids;
  }
  return result;
}

/** A UV entry must not follow shifted indices into a replacement geoset. */
export function captureUVGeometryScope(geoset) {
  return { geoset, vertexCount: geoset?.Vertices?.length || 0, faces: Array.from(geoset?.Faces || []), uvLengths: (geoset?.TVertices || []).map(values => values.length) };
}

export function matchesUVGeometryScope(geoset, scope) {
  return !!geoset && scope?.geoset === geoset && scope.vertexCount === geoset.Vertices.length &&
    scope.faces.length === geoset.Faces.length && scope.faces.every((index, offset) => index === geoset.Faces[offset]) &&
    scope.uvLengths.length === geoset.TVertices.length && scope.uvLengths.every((length, set) => length === geoset.TVertices[set].length);
}

/** Only complete eligible triangles belong to the UV editing topology. */
export function eligibleUVFaces(geoset, indices, uvSet = 0) {
  const eligible = new Set(eligibleUVVertices(geoset, indices, [], uvSet)), faces = [];
  for (let offset = 0; offset + 2 < (geoset?.Faces?.length || 0); offset += 3) {
    const triangle = Array.from(geoset.Faces.subarray(offset, offset + 3));
    if (triangle.every(index => eligible.has(index))) faces.push(triangle);
  }
  return faces;
}

/** Commit/preview only the selected eligible coordinates, never an unrelated UV. */
export function restrictUVChange(geoset, uvSet, values, indices) {
  const current = geoset?.TVertices?.[uvSet];
  if (!current || !values || values.length !== current.length) throw new Error('UV coordinates changed structure. Select the UV map again.');
  const next = new Float32Array(current);
  for (const index of eligibleUVVertices(geoset, indices, [], uvSet)) {
    for (let axis = 0; axis < 2; axis++) {
      const value = values[index * 2 + axis];
      if (!Number.isFinite(value) || !Number.isFinite(Math.fround(value))) throw new Error('UV coordinates must be finite.');
      next[index * 2 + axis] = value;
    }
  }
  return next;
}
