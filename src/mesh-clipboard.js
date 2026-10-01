import { deleteVertices } from './editor-commands.js';
import { sampleGeosetAnimation } from './animation.js';

/** Capture the existing geoset clipboard format without discarding loose vertices.
 * Dependencies stay in the donor and importGeosets copies/remaps the required ones.
 * A nonempty vertex selection never falls back to copying entire checked geosets.
 */
export function captureMeshSelection(model, selection = {}, selectable = Object.keys(selection).map(Number), { rgbPreview = false, rgbSequence = -1 } = {}) {
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
  const frame = model.Sequences?.[rgbSequence]?.Interval?.[0] ?? 0;
  const rgbByGeoset = rgbPreview ? Object.fromEntries(indices.map(index => [index, sampleGeosetAnimation(model, index, frame, rgbSequence, frame).color])) : null;
  return { kind: 'mesh', model: donor, indices, vertexCount, triangleCount, rgbByGeoset };
}

/** Freeze the RGB Preview seen at copy time while preserving every alpha field. */
export function applyMeshClipboardColors(model, geosetMap, rgbByGeoset) {
  if (!rgbByGeoset) return;
  model.GeosetAnims ||= [];
  for (const [sourceIndex, color] of Object.entries(rgbByGeoset)) {
    const geosetId = geosetMap?.[sourceIndex];
    if (!Number.isInteger(geosetId) || !model.Geosets?.[geosetId]) throw Error('Pasted RGB preview no longer matches its geometry.');
    if (!Array.isArray(color) || color.length !== 3 || color.some(value => !Number.isFinite(value) || value < 0 || value > 1)) throw Error('Pasted RGB preview contains an invalid color.');
    const matches = model.GeosetAnims.filter(animation => animation.GeosetId === geosetId);
    if (!matches.length) matches.push(model.GeosetAnims[model.GeosetAnims.push({ GeosetId: geosetId, Flags: 2, Alpha: 1 }) - 1]);
    for (const animation of matches) { animation.Color = new Float32Array(color); animation.Flags = (animation.Flags || 0) | 2; }
  }
}
