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

function components(g) {
  const count = g.Vertices.length / 3;
  if (!Number.isInteger(count) || !count || g.Faces.length % 3) throw new Error('A geoset has invalid vertices or triangles.');
  const parent = Array.from({ length: count }, (_, index) => index);
  const root = index => { while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; } return index; };
  for (let i = 0; i < g.Faces.length; i += 3) {
    const a = g.Faces[i], b = g.Faces[i + 1], c = g.Faces[i + 2];
    if (a >= count || b >= count || c >= count) throw new Error('A geoset has a triangle with a missing vertex.');
    parent[root(b)] = root(a); parent[root(c)] = root(a);
  }
  const parts = new Map();
  for (let index = 0; index < count; index++) {
    const id = root(index);
    if (!parts.has(id)) parts.set(id, { vertices: [], faces: [] });
    parts.get(id).vertices.push(index);
  }
  for (let i = 0; i < g.Faces.length; i += 3) parts.get(root(g.Faces[i])).faces.push(g.Faces[i], g.Faces[i + 1], g.Faces[i + 2]);
  return [...parts.values()].sort((a, b) => a.vertices[0] - b.vertices[0]);
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

/** Split every geoset into components connected by shared vertex indices. */
export function separateGeosetsByLoosePart(model) {
  const originalCount = model.Geosets.length, additions = [];
  const anims = animationIndices(model), newAnimations = [], newGliders = [];
  for (let index = 0; index < originalCount; index++) {
    const g = model.Geosets[index], parts = components(g);
    if (parts.length < 2) continue;
    model.Geosets[index] = piece(g, parts[0]);
    for (const part of parts.slice(1)) {
      const newIndex = originalCount + additions.length;
      additions.push(piece(g, part));
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
  return { parts: additions.length, geosetIndices: Array.from({ length: model.Geosets.length }, (_, index) => index) };
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
