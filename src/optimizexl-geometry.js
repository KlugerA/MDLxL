import { MeshoptSimplifier } from './vendor/meshoptimizer-1.3.0/meshopt_simplifier.js';
import { excludedGeosets } from './optimizexl-exclusions.js';

let nuclearSimplifier = null;
export async function prepareNuclearReduction() {
  if (!MeshoptSimplifier.supported) throw Error('Nuclear reduction requires WebAssembly support.');
  await MeshoptSimplifier.ready;
  nuclearSimplifier = MeshoptSimplifier;
}

const same = (a, b) => JSON.stringify(Array.from(a || [])) === JSON.stringify(Array.from(b || []));
const point = (a, i, n) => Array.from(a.slice(i * n, (i + 1) * n));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const binding = (g, i) => g.Groups[g.VertexGroup[i]] || [];
const normalAngle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.reduce((s, v, i) => s + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b) || 1)))) * 180 / Math.PI;

export function compactVertices(g, representatives, faces) {
  const remap = new Map(representatives.map((v, i) => [v, i]));
  const compact = (a, width) => new a.constructor(representatives.flatMap(i => Array.from(a.slice(i * width, (i + 1) * width))));
  g.Vertices = compact(g.Vertices, 3); g.Normals = compact(g.Normals, 3);
  g.TVertices = g.TVertices.map(uv => compact(uv, 2));
  g.VertexGroup = compact(g.VertexGroup, 1);
  g.Faces = new g.Faces.constructor(Array.from(faces, i => remap.get(i)));
}

export function mergeDuplicateVertices(model, settings, onChange) {
  let removed = 0, groups = 0;
  const excluded = excludedGeosets(model, settings);
  for (const [index, g] of model.Geosets.entries()) {
    if (excluded.has(index)) continue;
    const count = g.Vertices.length / 3, map = [], kept = [], adjacent = Array.from({ length: count }, () => new Set());
    for (let f = 0; f < g.Faces.length; f += 3) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) adjacent[g.Faces[f + i]].add(g.Faces[f + j]);
    const members = new Map();
    for (let i = 0; i < count; i++) {
      const p = point(g.Vertices, i, 3), n = point(g.Normals, i, 3);
      const found = kept.find(j => same(binding(g, i), binding(g, j)) &&
        !members.get(j).some(k => adjacent[i].has(k)) &&
        (settings.position > 0 ? distance(p, point(g.Vertices, j, 3)) <= settings.position : same(p, point(g.Vertices, j, 3))) &&
        (settings.normal > 0 ? normalAngle(n, point(g.Normals, j, 3)) <= settings.normal : same(n, point(g.Normals, j, 3))) &&
        g.TVertices.every(uv => settings.uv > 0 ? distance(point(uv, i, 2), point(uv, j, 2)) <= settings.uv : same(point(uv, i, 2), point(uv, j, 2))));
      const target = found ?? i; map[i] = target;
      if (found === undefined) { kept.push(i); members.set(i, []); }
      members.get(target).push(i);
    }
    removed += count - kept.length;
    compactVertices(g, kept, Array.from(g.Faces, i => map[i]));
    const unique = [], groupMap = [];
    for (const group of g.Groups) { let i = unique.findIndex(other => same(group, other)); if (i < 0) { i = unique.length; unique.push(group); } groupMap.push(i); }
    groups += g.Groups.length - unique.length;
    if(count!==kept.length||g.Groups.length!==unique.length)onChange?.({geoset:index,vertices:count-kept.length,groups:g.Groups.length-unique.length});
    g.VertexGroup = new g.VertexGroup.constructor(Array.from(g.VertexGroup, i => groupMap[i]));
    g.Groups = unique; g.TotalGroupsCount = unique.reduce((n, group) => n + group.length, 0);
  }
  return { duplicateVertices: removed, duplicateGroups: groups };
}

export function removeUnusedVertices(model, settings = {}, onChange) {
  let removed = 0;
  const excluded = excludedGeosets(model, settings);
  for (const [index, g] of model.Geosets.entries()) {
    if (excluded.has(index)) continue;
    if (!g.Faces.length) continue;
    const kept = [...new Set(g.Faces)].sort((a, b) => a - b);
    const vertices=g.Vertices.length / 3 - kept.length;
    removed += vertices;
    compactVertices(g, kept, g.Faces);
    const groups = [...new Set(g.VertexGroup)].sort((a, b) => a - b), map = new Map(groups.map((id, i) => [id, i]));
    if(vertices||g.Groups.length!==groups.length)onChange?.({geoset:index,vertices,groups:g.Groups.length-groups.length});
    g.VertexGroup = new g.VertexGroup.constructor(Array.from(g.VertexGroup, id => map.get(id)));
    g.Groups = groups.map(id => g.Groups[id]); g.TotalGroupsCount = g.Groups.reduce((sum, group) => sum + group.length, 0);
  }
  return removed;
}

function nuclearLocks(g, settings) {
  const count = g.Vertices.length / 3, locks = new Uint8Array(count);
  for (let f = 0; f < g.Faces.length; f += 3) for (let edge = 0; edge < 3; edge++) {
    const a = g.Faces[f + edge], b = g.Faces[f + (edge + 1) % 3];
    if (settings.protectSkin && !same(binding(g,a),binding(g,b)) ||
        settings.protectNormals && normalAngle(point(g.Normals,a,3),point(g.Normals,b,3)) > settings.normalLimit) locks[a] = locks[b] = 1;
  }
  // Position welding inside the simplifier must never join coincident records
  // belonging to different bones, even if those records have no shared edge.
  if (settings.protectSkin) {
    const positions = new Map();
    for (let i = 0; i < count; i++) {
      const key = point(g.Vertices,i,3).join(','), previous = positions.get(key) || [];
      for (const j of previous) if (!same(binding(g,i),binding(g,j))) locks[i] = locks[j] = 1;
      previous.push(i); positions.set(key, previous);
    }
  }
  return locks;
}

function nuclearAttributes(g) {
  const stride = 3 + g.TVertices.length * 2;
  // Upstream supports at most 32 attributes. Retain unusually wide streams
  // instead of silently ignoring UV channels in the quality calculation.
  if (stride > 32) throw Error('Nuclear reduction supports up to 14 UV channels per geoset.');
  const values = new Float32Array(g.Vertices.length / 3 * stride);
  for (let i = 0; i < g.Vertices.length / 3; i++) {
    const normal = point(g.Normals,i,3), length = Math.hypot(...normal) || 1;
    values.set(normal.map(v=>v/length), i * stride);
    g.TVertices.forEach((uv, channel)=>values.set(uv.subarray(i*2,i*2+2), i*stride+3+channel*2));
  }
  return { values, stride, weights: [1,1,1,...g.TVertices.flatMap(()=>[2,2])] };
}

/** Attribute-aware quadric simplification. Only triangle connectivity changes;
 * retained positions, normals, UVs and bindings remain authored records. */
export function reducePolygons(model, settings) {
  const excluded = excludedGeosets(model, settings);
  const original = model.Geosets.reduce((n, g) => n + g.Faces.length / 3, 0);
  const target = Math.max(model.Geosets.filter(g => g.Faces.length).length, Math.min(original, Math.round(settings.target)));
  let total = original, removedVertices = 0, maxAppearanceError = 0;
  if (target >= total) return { trianglesBefore: original, trianglesAfter: total, removedVertices, maxAppearanceError };
  if (!nuclearSimplifier) throw Error('Wait for the Nuclear simplifier to initialize.');
  if (!Number.isFinite(settings.error) || settings.error < 0) throw Error('The appearance error must be a non-negative number.');
  for (const [index, g] of model.Geosets.entries()) {
    if (excluded.has(index)) continue;
    const initial = g.Faces.length / 3;
    if (initial <= 1) continue;
    const goal = Math.max(1, Math.ceil(initial * target / original)), attributes = nuclearAttributes(g);
    const flags = ['RegularizeLight'];
    if (settings.protectSeams) flags.push('LockBorder'); else flags.push('Permissive');
    const locks = nuclearLocks(g,settings);
    let faces = g.Faces, error = 0, requested = goal * 3, margin = 3;
    // An edge collapse can remove multiple triangles at once. Upstream's
    // target is approximate; raise it when a batch crosses our lower bound.
    while (requested < g.Faces.length) {
      [faces, error] = nuclearSimplifier.simplifyWithAttributes(
        g.Faces, g.Vertices, 3, attributes.values, attributes.stride, attributes.weights,
        locks, requested, settings.error, flags,
      );
      if (faces.length >= goal * 3) break;
      requested += Math.max(margin, goal * 3 - faces.length); margin *= 2;
      faces = g.Faces; error = 0;
    }
    if (faces.length === g.Faces.length) continue;
    const kept = [...new Set(faces)].sort((a,b)=>a-b);
    total -= initial - faces.length / 3; removedVertices += g.Vertices.length / 3 - kept.length;
    maxAppearanceError = Math.max(maxAppearanceError, error);
    compactVertices(g, kept, faces);
  }
  return { trianglesBefore: original, trianglesAfter: total, removedVertices, maxAppearanceError, constrained: total > target };
}
