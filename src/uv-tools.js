import { sampleTrack } from './animation.js';

const finiteIndex = value => Number.isSafeInteger(value) && value >= 0;
const uniqueIndices = values => [...new Set(Array.from(values || []).filter(finiteIndex))];

/** Enable both repeat axes without changing other texture flags or UVs. */
export function enableUVTextureWrapping(model, textureIDs) {
  for (const id of uniqueIndices(textureIDs)) {
    const texture = model.Textures?.[id];
    if (texture && !texture.ReplaceableId && texture.Image?.trim()) texture.Flags = (texture.Flags || 0) | 3;
  }
}

function textureLabel(texture) {
  if (!texture) return 'Missing texture';
  if (texture.ReplaceableId === 1) return 'Team Color';
  if (texture.ReplaceableId === 2) return 'Team Glow';
  return String(texture.Image || 'Unnamed texture').split(/[\\/]/).at(-1);
}

/** Resolve the layers that make up one Warcraft material at the current frame. */
export function uvMaterialLayers(model, materialID, time = 0, sequenceIndex = -1) {
  const material = model?.Materials?.[materialID], interval = model?.Sequences?.[sequenceIndex]?.Interval;
  return (material?.Layers || []).map((layer, layerIndex) => {
    const sampled = sampleTrack(layer.TextureID, time, { interval, globalSequences: model.GlobalSequences, globalTime: time, fallback: -1 });
    const textureID = Math.round(Number(sampled)), texture = model.Textures?.[textureID] || null;
    const coordId = finiteIndex(layer.CoordId) ? layer.CoordId : 0;
    return { materialID, layerIndex, layer, textureID, texture, coordId, label: textureLabel(texture) };
  });
}

/** Only materials used by the current UV working selection are offered. */
export function relevantUVMaterials(model, selectionByGeoset, time = 0, sequenceIndex = -1) {
  const indices = Array.isArray(selectionByGeoset) || selectionByGeoset instanceof Set
    ? uniqueIndices(selectionByGeoset)
    : Object.keys(selectionByGeoset || {}).map(Number).filter(index => selectionByGeoset[index]?.length);
  const grouped = new Map();
  for (const geosetIndex of indices) {
    const geoset = model?.Geosets?.[geosetIndex], materialID = geoset?.MaterialID;
    if (!finiteIndex(materialID) || !model.Materials?.[materialID]) continue;
    const entry = grouped.get(materialID) || { materialID, geosetIndices: [] };
    entry.geosetIndices.push(geosetIndex); grouped.set(materialID, entry);
  }
  return [...grouped.values()].sort((a, b) => a.materialID - b.materialID).map(entry => {
    const layers = uvMaterialLayers(model, entry.materialID, time, sequenceIndex);
    const availableSets = entry.geosetIndices.map(index => model.Geosets[index].TVertices || []);
    const preferred = layers.map(layer => layer.coordId).find(coordId => availableSets.every(sets => sets[coordId]));
    const coordId = preferred ?? availableSets[0]?.findIndex((_, index) => availableSets.every(sets => sets[index])) ?? 0;
    const names = [...new Set(layers.map(layer => layer.label))];
    return { ...entry, layers, coordId: Math.max(0, coordId), label: `Material ${entry.materialID + 1} · ${names.join(' + ') || 'No texture'}` };
  });
}

/** Flatten several geosets that use one material into one temporary UV canvas. */
export function combineUVGeosets(model, geosetIndices, eligibleSelection, selectedSelection, coordId = 0) {
  const refs = [], coordinates = [], faces = [], eligibleVertices = [], selectedVertices = [];
  let offset = 0;
  for (const geosetIndex of uniqueIndices(geosetIndices)) {
    const geoset = model?.Geosets?.[geosetIndex], uv = geoset?.TVertices?.[coordId];
    if (!uv) continue;
    const count = Math.min(geoset.Vertices.length / 3, uv.length / 2), allowed = new Set(uniqueIndices(eligibleSelection?.[geosetIndex]).filter(index => index < count));
    const selected = new Set(uniqueIndices(selectedSelection?.[geosetIndex]).filter(index => allowed.has(index)));
    for (let index = 0; index < count; index++) {
      refs.push({ geosetIndex, vertexIndex: index }); coordinates.push(uv[index * 2], uv[index * 2 + 1]);
      if (allowed.has(index)) eligibleVertices.push(offset + index);
      if (selected.has(index)) selectedVertices.push(offset + index);
    }
    for (const index of geoset.Faces || []) faces.push(offset + Number(index));
    offset += count;
  }
  return {
    refs, eligibleVertices, selectedVertices,
    geoset: {
      Vertices: new Float32Array(offset * 3),
      TVertices: [new Float32Array(coordinates)],
      Faces: new Uint32Array(faces),
    },
  };
}

/** Expand a flattened UV canvas back to the model's individual UV arrays. */
export function splitCombinedUV(model, refs, values, coordId = 0) {
  if (!values || values.length !== refs.length * 2) throw Error('Combined UV coordinates changed structure.');
  const changes = new Map();
  for (let index = 0; index < refs.length; index++) {
    const { geosetIndex, vertexIndex } = refs[index], source = model?.Geosets?.[geosetIndex]?.TVertices?.[coordId];
    if (!source) continue;
    if (!changes.has(geosetIndex)) changes.set(geosetIndex, new Float32Array(source));
    const target = changes.get(geosetIndex), u = Number(values[index * 2]), v = Number(values[index * 2 + 1]);
    if (![u, v].every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value)))) throw Error('UV coordinates must be finite.');
    target[vertexIndex * 2] = u; target[vertexIndex * 2 + 1] = v;
  }
  return [...changes].map(([geosetIndex, next]) => ({ geosetIndex, uvSet: coordId, values: next }));
}

export function collapseUVCoordinates(values, indices) {
  const selected = uniqueIndices(indices), next = new Float32Array(values || []);
  if (selected.length < 2) return next;
  const center = [0, 0];
  for (const index of selected) { center[0] += next[index * 2] / selected.length; center[1] += next[index * 2 + 1] / selected.length; }
  for (const index of selected) { next[index * 2] = center[0]; next[index * 2 + 1] = center[1]; }
  return next;
}

/** Fold a UV selection like paper. Symmetric points coincide naturally; other
 * points keep their mirrored distance so the user can finish an imperfect fold. */
export function foldUVCoordinates(values, indices, direction = 'right-to-left') {
  const selected = uniqueIndices(indices), next = new Float32Array(values || []);
  if (selected.length < 2) return next;
  const rules = {
    'right-to-left': { axis: 0, positive: true }, 'left-to-right': { axis: 0, positive: false },
    'bottom-to-top': { axis: 1, positive: true }, 'top-to-bottom': { axis: 1, positive: false },
  };
  const rule = rules[direction]; if (!rule) throw Error('Choose a valid fold direction.');
  let low = Infinity, high = -Infinity;
  for (const index of selected) { const value = next[index * 2 + rule.axis]; low = Math.min(low, value); high = Math.max(high, value); }
  const crease = (low + high) / 2;
  for (const index of selected) {
    const offset = index * 2 + rule.axis, value = next[offset];
    if (rule.positive ? value > crease : value < crease) next[offset] = 2 * crease - value;
  }
  return next;
}

function copyVertexAttribute(source, sourceIndices, stride) {
  if (!source?.length) return source;
  const output = new source.constructor(sourceIndices.length * stride);
  sourceIndices.forEach((sourceIndex, index) => output.set(source.subarray(sourceIndex * stride, sourceIndex * stride + stride), index * stride));
  return output;
}

function transferUVCornerInward(values, faces, corner, weight = 0.8) {
  const faceStart = Math.floor(corner / 3) * 3, localCorner = corner % 3;
  const vertexIndex = faces[corner], firstNeighbor = faces[faceStart + (localCorner + 1) % 3], secondNeighbor = faces[faceStart + (localCorner + 2) % 3];
  const offset = vertexIndex * 2, firstOffset = firstNeighbor * 2, secondOffset = secondNeighbor * 2, neighborWeight = (1 - weight) / 2;
  values[offset] = weight * values[offset] + neighborWeight * values[firstOffset] + neighborWeight * values[secondOffset];
  values[offset + 1] = weight * values[offset + 1] + neighborWeight * values[firstOffset + 1] + neighborWeight * values[secondOffset + 1];
}

/** MDLVis 1.40 UV Uncouple (unTex.pas): give every selected face corner its
 * own vertex, then move those UVs 20% toward their respective triangle. The
 * active UV set fans apart visibly while the 3D mesh and other UV sets stay
 * unchanged. MDLVis clears the UV selection after this operation. */
export function uncoupleUVVertices(geoset, indices, uvSet = 0) {
  const count = geoset?.Vertices?.length / 3, selected = new Set(uniqueIndices(indices));
  const activeUV = geoset?.TVertices?.[uvSet];
  if (!Number.isInteger(count) || selected.size === 0 || [...selected].some(index => index >= count) || activeUV?.length !== count * 2) throw Error('Select valid UV vertices first.');
  const sources = Array.from({ length: count }, (_, index) => index), faces = new Uint32Array(geoset.Faces), transferCorners = [], created = [];
  for (const source of selected) {
    const corners = [];
    for (let corner = 0; corner < faces.length; corner++) if (faces[corner] === source) corners.push(corner);
    if (!corners.length) continue;
    for (const corner of corners.slice(1)) {
      if (sources.length >= 65536) throw Error('UV uncoupling would exceed the 65536-vertex geoset limit. Split the geoset first.');
      const duplicate = sources.length;
      faces[corner] = duplicate; sources.push(source); created.push(duplicate); transferCorners.push(corner);
    }
    transferCorners.push(corners[0]);
  }
  const added = sources.length - count;
  if (added) {
    geoset.Vertices = copyVertexAttribute(geoset.Vertices, sources, 3);
    geoset.Normals = copyVertexAttribute(geoset.Normals, sources, 3);
    geoset.VertexGroup = copyVertexAttribute(geoset.VertexGroup, sources, 1);
    geoset.TVertices = (geoset.TVertices || []).map(uv => copyVertexAttribute(uv, sources, 2));
    if (geoset.Tangents?.length) geoset.Tangents = copyVertexAttribute(geoset.Tangents, sources, 4);
    if (geoset.SkinWeights?.length) geoset.SkinWeights = copyVertexAttribute(geoset.SkinWeights, sources, 8);
    geoset.Faces = new Uint16Array(faces);
  }
  const movedUV = geoset.TVertices[uvSet];
  for (const corner of transferCorners) transferUVCornerInward(movedUV, faces, corner);
  return { added, created, selection: [] };
}

const transform4 = (matrix, vector) => [0, 1, 2, 3].map(row => matrix[row] * vector[0] + matrix[4 + row] * vector[1] + matrix[8 + row] * vector[2] + matrix[12 + row] * vector[3]);

/** Planar projection from the exact live-preview camera viewport, matching the
 * classic select-view-project workflow. Warcraft V remains top-down. */
export function projectUVFromView(geoset, indices, viewMatrix, projectionMatrix, source = geoset?.TVertices?.[0]) {
  if (![viewMatrix, projectionMatrix].every(matrix => matrix?.length === 16 && Array.from(matrix).every(Number.isFinite))) throw Error('Rotate the live preview before projecting.');
  const selected = uniqueIndices(indices), next = new Float32Array(source || []), count = geoset?.Vertices?.length / 3;
  if (!selected.length || selected.some(index => index >= count || index * 2 + 1 >= next.length)) throw Error('Select valid UV vertices before projecting.');
  for (const index of selected) {
    const point = Array.from(geoset.Vertices.subarray(index * 3, index * 3 + 3));
    const clip = transform4(projectionMatrix, transform4(viewMatrix, [...point, 1]));
    if (!Number.isFinite(clip[3]) || Math.abs(clip[3]) < 1e-8) throw Error('The selected vertices cannot be projected from this view.');
    next[index * 2] = (clip[0] / clip[3] + 1) / 2;
    next[index * 2 + 1] = (1 - clip[1] / clip[3]) / 2;
  }
  return next;
}
