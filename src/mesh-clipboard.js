import { deleteVertices } from './editor-commands.js';

/** Capture the existing geoset clipboard format without discarding loose vertices.
 * Dependencies stay in the donor and importGeosets copies/remaps the required ones.
 * A nonempty vertex selection never falls back to copying entire checked geosets.
 */
export function captureMeshSelection(model, selection = {}, selectable = Object.keys(selection).map(Number)) {
  const donor = structuredClone(model), indices = [];
  const hasVertexSelection = Object.values(selection).some(ids => Array.from(ids || []).length > 0);
  let vertexCount = 0, triangleCount = 0;
  for (const gi of new Set(selectable)) {
    const geoset = donor.Geosets?.[gi];
    if (!Number.isInteger(gi) || !geoset) continue;
    const count = geoset.Vertices.length / 3;
    if (hasVertexSelection) {
      const keep = new Set(Array.from(selection[gi] || []).filter(index => Number.isInteger(index) && index >= 0 && index < count));
      if (!keep.size) continue;
      deleteVertices(geoset, Array.from({ length: count }, (_, index) => index).filter(index => !keep.has(index)));
    }
    if (!geoset.Vertices.length) continue;
    indices.push(gi);
    vertexCount += geoset.Vertices.length / 3;
    triangleCount += geoset.Faces.length / 3;
  }
  return { model: donor, indices, vertexCount, triangleCount };
}
