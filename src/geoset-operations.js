import { appendGeosetGeometry } from './editor-document.js';
import { gather, updateBounds } from './mesh-tools.js';

const textureSlots = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
const geometryFields = new Set(['Vertices', 'Normals', 'Faces', 'TVertices', 'VertexGroup', 'Groups', 'TotalGroupsCount', 'Tangents', 'SkinWeights', 'PrimitiveTypes', 'PrimitiveCounts', 'MinimumExtent', 'MaximumExtent', 'BoundsRadius', 'Anims', 'MaterialID', 'Name']);

function signature(value) {
  if (ArrayBuffer.isView(value)) return Array.from(value, signature);
  if (Array.isArray(value)) return value.map(signature);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, signature(value[key])]));
  return value;
}
const keyOf = value => JSON.stringify(signature(value));

function materialKey(model, materialId) {
  const material = model.Materials?.[materialId];
  if (!material) return null;
  const resolved = structuredClone(material);
  const texture = id => id == null || id === -1 ? id : model.Textures?.[id] ? { texture: signature(model.Textures[id]) } : { missingTexture: id };
  const resolveSlot = value => {
    if (typeof value === 'number') return texture(value);
    if (!value?.Keys) return value;
    for (const frame of value.Keys) for (const field of ['Vector', 'InTan', 'OutTan']) if (frame[field]) frame[field] = Array.from(frame[field], texture);
    return value;
  };
  for (const layer of resolved.Layers || []) {
    for (const slot of textureSlots) {
      if (layer[slot] !== undefined) layer[slot] = resolveSlot(layer[slot]);
      if (layer._MdxDefaults?.[slot] !== undefined) layer._MdxDefaults[slot] = texture(layer._MdxDefaults[slot]);
    }
    if (layer.TVertexAnimId != null && layer.TVertexAnimId !== -1) layer.TVertexAnimId = { animation: signature(model.TextureAnims?.[layer.TVertexAnimId]) };
  }
  return keyOf(resolved);
}

function appearanceKey(model, index, animations) {
  const g = model.Geosets[index], material = materialKey(model, g.MaterialID);
  if (material == null) return null;
  const metadata = Object.fromEntries(Object.entries(g).filter(([field]) => !geometryFields.has(field)));
  const anims = animations[index].map(animIndex => {
    const { GeosetId, ...anim } = model.GeosetAnims[animIndex];
    return anim;
  });
  return keyOf({ material, metadata, anims, uvSets: g.TVertices.length, tangents: g.Tangents != null, skin: g.SkinWeights != null, extentCount: g.Anims?.length || 0 });
}

function animationIndices(model) {
  const byGeoset = Array.from({ length: model.Geosets.length }, () => []);
  (model.GeosetAnims || []).forEach((anim, index) => byGeoset[anim.GeosetId]?.push(index));
  return byGeoset;
}

function selectedComponents(g, indices, nuclear) {
  const count = g.Vertices.length / 3;
  if (!Number.isInteger(count) || !count || g.Faces.length % 3) throw new Error('A geoset has invalid vertices or triangles.');
  const selected = new Set(indices);
  if ([...selected].some(index => !Number.isInteger(index) || index < 0 || index >= count)) throw new Error('Vertex selection is out of range.');
  const chosen = [], retainedFaces = [], usedByFaces = new Set();
  for (let i = 0; i < g.Faces.length; i += 3) {
    const face = Array.from(g.Faces.subarray(i, i + 3));
    if (face.some(index => index >= count)) throw new Error('A geoset has a triangle with a missing vertex.');
    for (const index of face) usedByFaces.add(index);
    (face.every(index => selected.has(index)) ? chosen : retainedFaces).push(face);
  }
  const parent = chosen.map((_, index) => index);
  const root = index => { while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; } return index; };
  const join = (a, b) => { a = root(a); b = root(b); if (a !== b) parent[b] = a; };
  const vertexOwner = new Map(), edgeOwner = new Map();
  const point = index => Array.from(g.Vertices.subarray(index * 3, index * 3 + 3), value => Math.round(value * 1000)).join(',');
  for (const [faceIndex, face] of chosen.entries()) {
    for (const vertex of face) {
      if (vertexOwner.has(vertex)) join(faceIndex, vertexOwner.get(vertex));
      else vertexOwner.set(vertex, faceIndex);
    }
    if (nuclear) continue;
    for (let side = 0; side < 3; side++) {
      const a = point(face[side]), b = point(face[(side + 1) % 3]);
      const edge = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (edgeOwner.has(edge)) join(faceIndex, edgeOwner.get(edge));
      else edgeOwner.set(edge, faceIndex);
    }
  }
  const parts = new Map();
  for (const [faceIndex, face] of chosen.entries()) {
    const id = root(faceIndex);
    if (!parts.has(id)) parts.set(id, { vertices: new Set(), faces: [] });
    const part = parts.get(id);
    for (const vertex of face) part.vertices.add(vertex);
    part.faces.push(...face);
  }
  for (const vertex of selected) if (!usedByFaces.has(vertex)) parts.set(`loose:${vertex}`, { vertices: new Set([vertex]), faces: [] });
  const retainedVertices = new Set(Array.from({ length: count }, (_, index) => index).filter(index => !selected.has(index)));
  for (const face of retainedFaces) for (const vertex of face) retainedVertices.add(vertex);
  const orderedParts = [...parts.values()].map(part => ({ vertices: [...part.vertices].sort((a, b) => a - b), faces: part.faces })).sort((a, b) => a.vertices[0] - b.vertices[0]);
  return {
    parts: nuclear ? orderedParts : groupSmallDetails(orderedParts),
    retained: { vertices: [...retainedVertices].sort((a, b) => a - b), faces: retainedFaces.flat() },
  };
}

function groupSmallDetails(parts) {
  if (parts.length < 3) return parts;
  const largest = Math.max(...parts.map(part => part.faces.length / 3));
  const threshold = Math.max(12, Math.ceil(largest / 10));
  const substantial = [], details = [];
  for (const part of parts) (part.faces.length / 3 < threshold ? details : substantial).push(part);
  if (details.length < 2) return parts;
  const combined = {
    vertices: [...new Set(details.flatMap(part => part.vertices))].sort((a, b) => a - b),
    faces: details.flatMap(part => part.faces),
  };
  return [...substantial, combined].sort((a, b) => a.vertices[0] - b.vertices[0]);
}

function piece(g, component) {
  const remap = new Map(component.vertices.map((old, index) => [old, index]));
  const result = structuredClone(g);
  Object.assign(result, gather(g, component.vertices));
  result.Faces = new g.Faces.constructor(component.faces.map(index => remap.get(index)));
  result.PrimitiveTypes = result.Faces.length ? Uint32Array.of(4) : new Uint32Array();
  result.PrimitiveCounts = result.Faces.length ? Uint32Array.of(result.Faces.length) : new Uint32Array();
  updateBounds(result);
  return result;
}

function separateSelectedGeosets(model, selectionByGeoset, nuclear) {
  const originalCount = model.Geosets.length, additions = [];
  const anims = animationIndices(model), newAnimations = [], newGliders = [], selection = {}, touched = [];
  for (let index = 0; index < originalCount; index++) {
    const selected = selectionByGeoset?.[index];
    if (!selected?.length) continue;
    const g = model.Geosets[index], { parts, retained } = selectedComponents(g, selected, nuclear);
    if (!parts.length || parts.length === 1 && !retained.vertices.length) continue;
    touched.push(index);
    const keepRemainder = retained.vertices.length > 0;
    model.Geosets[index] = piece(g, keepRemainder ? retained : parts[0]);
    if (!keepRemainder) selection[index] = Array.from({ length: parts[0].vertices.length }, (_, vertex) => vertex);
    for (const part of keepRemainder ? parts : parts.slice(1)) {
      const newIndex = originalCount + additions.length;
      additions.push(piece(g, part));
      selection[newIndex] = Array.from({ length: part.vertices.length }, (_, vertex) => vertex);
      for (const animIndex of anims[index]) newAnimations.push({ ...structuredClone(model.GeosetAnims[animIndex]), GeosetId: newIndex });
      for (const glider of model.Gliders || []) if (glider.GeosetId === index) newGliders.push({ ...structuredClone(glider), GeosetId: newIndex });
    }
  }
  if (!additions.length) return false;
  model.Geosets.push(...additions);
  (model.GeosetAnims ||= []).push(...newAnimations);
  if (newGliders.length) (model.Gliders ||= []).push(...newGliders);
  model.Info.NumGeosets = model.Geosets.length;
  model.Info.NumGeosetAnims = model.GeosetAnims.length;
  return { parts: additions.length, geosetIndices: Object.keys(selection).map(Number), selection, touched };
}

/** Join selected triangles across matching geometric edges, including unwelded seams. */
export function separateGeosetsByLoosePart(model, selectionByGeoset) {
  return separateSelectedGeosets(model, selectionByGeoset, false);
}

/** Preserve the former shared-vertex-index split for explicitly selected geometry. */
export function nuclearSeparateGeosets(model, selectionByGeoset) {
  return separateSelectedGeosets(model, selectionByGeoset, true);
}

function unionAnimatedExtents(target, source) {
  for (let index = 0; index < (target.Anims?.length || 0); index++) {
    const a = target.Anims[index], b = source.Anims[index];
    for (let axis = 0; axis < 3; axis++) {
      a.MinimumExtent[axis] = Math.min(a.MinimumExtent[axis], b.MinimumExtent[axis]);
      a.MaximumExtent[axis] = Math.max(a.MaximumExtent[axis], b.MaximumExtent[axis]);
    }
    a.BoundsRadius = Math.max(a.BoundsRadius, b.BoundsRadius, Math.hypot(...a.MaximumExtent.map((value, axis) => value - a.MinimumExtent[axis])) / 2);
  }
}

function canAppend(target, source) {
  if (target.Vertices.length / 3 + source.Vertices.length / 3 > 65536) return false;
  const groups = target.Groups.map(group => keyOf(group));
  for (const groupId of new Set(source.VertexGroup)) {
    const group = source.Groups[groupId];
    if (!group) return false;
    const key = keyOf(group);
    if (!groups.includes(key)) groups.push(key);
  }
  return groups.length <= 256;
}

/** Merge only geosets with equivalent material, RGB/visibility and mesh settings. */
export function mergeSimilarGeosets(model) {
  const original = model.Geosets, animations = animationIndices(model);
  const byKey = new Map(), leaders = original.map((_, index) => index), targets = new Set();
  for (let index = 0; index < original.length; index++) {
    const key = appearanceKey(model, index, animations);
    if (key == null) continue;
    const candidates = byKey.get(key) || [];
    const leader = candidates.find(other => canAppend(original[other], original[index]));
    if (leader === undefined) { candidates.push(index); byKey.set(key, candidates); continue; }
    appendGeosetGeometry(original[leader], original[index]);
    unionAnimatedExtents(original[leader], original[index]);
    original[leader].PrimitiveTypes = Uint32Array.of(4);
    original[leader].PrimitiveCounts = Uint32Array.of(original[leader].Faces.length);
    leaders[index] = leader;
    targets.add(leader);
  }
  if (!targets.size) return false;
  const oldToNew = new Map(), kept = [];
  for (let index = 0; index < original.length; index++) if (leaders[index] === index) { oldToNew.set(index, kept.length); kept.push(original[index]); }
  for (let index = 0; index < original.length; index++) oldToNew.set(index, oldToNew.get(leaders[index]));
  const oldAnimToNew = new Map(), keptAnimations = [];
  (model.GeosetAnims || []).forEach((anim, index) => {
    if (leaders[anim.GeosetId] !== anim.GeosetId) return;
    oldAnimToNew.set(index, keptAnimations.length);
    anim.GeosetId = oldToNew.get(anim.GeosetId);
    keptAnimations.push(anim);
  });
  for (let index = 0; index < original.length; index++) if (leaders[index] !== index) animations[index].forEach((oldAnim, position) => oldAnimToNew.set(oldAnim, oldAnimToNew.get(animations[leaders[index]][position])));
  model.Geosets = kept;
  model.GeosetAnims = keptAnimations;
  for (const bone of model.Bones || []) {
    if (oldToNew.has(bone.GeosetId)) bone.GeosetId = oldToNew.get(bone.GeosetId);
    if (oldAnimToNew.has(bone.GeosetAnimId)) bone.GeosetAnimId = oldAnimToNew.get(bone.GeosetAnimId);
  }
  for (const glider of model.Gliders || []) if (oldToNew.has(glider.GeosetId)) glider.GeosetId = oldToNew.get(glider.GeosetId);
  model.Info.NumGeosets = kept.length;
  model.Info.NumGeosetAnims = keptAnimations.length;
  return { merged: original.length - kept.length, geosetIndices: [...targets].map(index => oldToNew.get(index)) };
}
