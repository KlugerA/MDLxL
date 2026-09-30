import { MeshoptSimplifier } from './vendor/meshoptimizer-1.3.0/meshopt_simplifier.js';

let prepared = null;

export function prepareMeshDensity() {
  if (!prepared) prepared = (async () => {
    if (!MeshoptSimplifier.supported) throw Error('Triangle reduction requires WebAssembly support.');
    await MeshoptSimplifier.ready;
    return MeshoptSimplifier;
  })();
  return prepared;
}

const clampAmount = value => Math.max(-100, Math.min(100, Math.round(Number(value) || 0)));
const point = (array, index, width) => Array.from(array.slice(index * width, index * width + width));
const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
const normal = values => {
  const length = Math.hypot(...values);
  return length > 1e-12 ? values.map(value => value / length) : [0, 0, 1];
};
const positionKey = (geoset, index) => point(geoset.Vertices, index, 3).map(value => Object.is(value, -0) ? 0 : Math.fround(value)).join(',');
const indexedEdgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

function validateGeoset(geoset) {
  const count = geoset?.Vertices?.length / 3;
  if (!Number.isSafeInteger(count) || !count || !geoset?.Faces?.length || geoset.Faces.length % 3) throw Error('Choose a geoset containing triangles.');
  const streams = [['Normals', 3], ['VertexGroup', 1], ['Tangents', 4], ['SkinWeights', 8]];
  for (const [name, width] of streams) if (geoset[name]?.length && geoset[name].length !== count * width) throw Error(`${name} do not match the geoset vertex count.`);
  for (const uv of geoset.TVertices || []) if (uv.length !== count * 2) throw Error('UV coordinates do not match the geoset vertex count.');
  if (geoset.Faces.some(index => !Number.isSafeInteger(index) || index < 0 || index >= count)) throw Error('The geoset contains an invalid triangle index.');
  if (geoset.VertexGroup?.some(index => !geoset.Groups?.[index])) throw Error('The geoset contains an invalid matrix-group reference.');
  return count;
}

export function densityTargetTriangles(triangles, amount) {
  amount = clampAmount(amount);
  if (amount >= 0) return Math.max(1, Math.round(triangles * (1 + amount * .0106666667)));
  return Math.max(1, Math.round(triangles * (1 + amount * 0.0075)));
}

function updatePrimitiveCounts(geoset) {
  if (geoset.PrimitiveTypes?.length) geoset.PrimitiveTypes = new geoset.PrimitiveTypes.constructor([4]);
  if (geoset.PrimitiveCounts?.length) geoset.PrimitiveCounts = new geoset.PrimitiveCounts.constructor([geoset.Faces.length]);
}

function addClassicGroup(groups, first, second) {
  if (first === second) return first;
  const bones = [...new Set([...(groups[first] || []), ...(groups[second] || [])])].sort((a, b) => a - b);
  let index = groups.findIndex(group => same([...group].sort((a, b) => a - b), bones));
  if (index < 0) {
    if (groups.length >= 256) throw Error('This density would exceed Warcraft III\'s 256 matrix-group limit for one geoset.');
    index = groups.length; groups.push(bones);
  }
  return index;
}

function blendSkin(source, a, b, t = .5) {
  const weights = new Map();
  for (const [index, factor] of [[a, 1 - t], [b, t]]) {
    const offset = index * 8;
    for (let slot = 0; slot < 4; slot++) {
      const weight = source[offset + 4 + slot];
      if (weight) weights.set(source[offset + slot], (weights.get(source[offset + slot]) || 0) + weight * factor);
    }
  }
  const chosen = [...weights].sort((left, right) => right[1] - left[1] || left[0] - right[0]).slice(0, 4);
  const total = chosen.reduce((sum, entry) => sum + entry[1], 0) || 1;
  const exact = chosen.map(([, weight]) => weight * 255 / total), rounded = exact.map(Math.floor);
  let remainder = 255 - rounded.reduce((sum, value) => sum + value, 0);
  for (const index of exact.map((value, index) => [value - rounded[index], index]).sort((a, b) => b[0] - a[0]).map(entry => entry[1])) {
    if (!remainder) break;
    rounded[index]++; remainder--;
  }
  return [...chosen.map(entry => entry[0]), 0, 0, 0, 0].slice(0, 4).concat([...rounded, 0, 0, 0, 0].slice(0, 4));
}

function triangleLongestEdge(geoset, offset) {
  const indices = geoset.Faces.slice(offset, offset + 3);
  let longest = 0;
  for (let edge = 0; edge < 3; edge++) {
    const a = indices[edge], b = indices[(edge + 1) % 3];
    longest = Math.max(longest, Math.hypot(...point(geoset.Vertices, a, 3).map((value, axis) => value - geoset.Vertices[b * 3 + axis])));
  }
  return longest;
}

function adaptiveCutRegion(geoset) {
  const stats = Array.from({ length: geoset.Faces.length / 3 }, (_, triangle) => ({ triangle, length: triangleLongestEdge(geoset, triangle * 3) }));
  const ordered = stats.filter(entry => entry.length > 1e-10).sort((a, b) => b.length - a.length || a.triangle - b.triangle);
  let selectedCount = ordered.length, bestGap = 1.75;
  for (let index = 1; index <= Math.floor(ordered.length / 2); index++) {
    const ratio = ordered[index - 1].length / Math.max(ordered[index].length, 1e-10);
    if (ratio > bestGap) { bestGap = ratio; selectedCount = index; }
  }
  const active = new Set((selectedCount < ordered.length ? ordered.slice(0, selectedCount) : ordered).map(entry => entry.triangle));
  const unique = new Map();
  for (const triangle of active) for (const index of geoset.Faces.slice(triangle * 3, triangle * 3 + 3)) unique.set(positionKey(geoset, index), point(geoset.Vertices, index, 3));
  const positions = [...unique.values()];
  const spans = [0, 1, 2].map(axis => Math.max(...positions.map(value => value[axis])) - Math.min(...positions.map(value => value[axis])));
  const axis = spans.indexOf(Math.max(...spans)), span = spans[axis];
  if (!(span > 1e-10)) return { active, axis, lower: 0, upper: 0 };
  const values = positions.map(value => value[axis]).sort((a, b) => a - b), tolerance = Math.max(1e-6, span * .005), clusters = [];
  for (const value of values) {
    const cluster = clusters.at(-1);
    if (!cluster || value - cluster.at(-1) > tolerance) clusters.push([value]);
    else cluster.push(value);
  }
  const center = cluster => cluster.reduce((sum, value) => sum + value, 0) / cluster.length;
  let lower = center(clusters[0]), upper = center(clusters.at(-1));
  if (clusters.length >= 4) {
    const innerLower = center(clusters[1]), innerUpper = center(clusters.at(-2));
    if (innerUpper - innerLower >= span * .35) { lower = innerLower; upper = innerUpper; }
  }
  return { active, axis, lower, upper };
}

export function densifyGeoset(source, cutCount) {
  validateGeoset(source);
  cutCount = Math.max(0, Math.min(4, Math.round(cutCount)));
  if (!cutCount) return structuredClone(source);
  const geoset = structuredClone(source), groups = geoset.Groups ? geoset.Groups.map(group => [...group]) : [];
  let vertices = Array.from(geoset.Vertices), normals = Array.from(geoset.Normals || []), vertexGroups = Array.from(geoset.VertexGroup || []);
  let tangents = geoset.Tangents?.length ? Array.from(geoset.Tangents) : null, skins = geoset.SkinWeights?.length ? Array.from(geoset.SkinWeights) : null;
  let uvs = (geoset.TVertices || []).map(stream => Array.from(stream));
  const intersections = new Map(), { active, axis, lower, upper } = adaptiveCutRegion(geoset);
  if (!(upper > lower)) return geoset;
  const cuts = Array.from({ length: cutCount }, (_, index) => lower + (upper - lower) * (index + 1) / (cutCount + 1));
  const projection = index => vertices[index * 3 + axis], epsilon = Math.max(1e-7, (upper - lower) * 1e-7);
  const interpolate = (a, b, t, cutIndex) => {
    const key = `${indexedEdgeKey(a, b)}@${cutIndex}`;
    if (intersections.has(key)) return intersections.get(key);
    const index = vertices.length / 3;
    for (let component = 0; component < 3; component++) vertices.push(vertices[a * 3 + component] * (1 - t) + vertices[b * 3 + component] * t);
    if (normals.length) normals.push(...normal([0, 1, 2].map(component => normals[a * 3 + component] * (1 - t) + normals[b * 3 + component] * t)));
    uvs.forEach(stream => stream.push(...[0, 1].map(component => stream[a * 2 + component] * (1 - t) + stream[b * 2 + component] * t)));
    if (tangents) {
      tangents.push(...normal([0, 1, 2].map(component => tangents[a * 4 + component] * (1 - t) + tangents[b * 4 + component] * t)), tangents[a * 4 + 3] * (1 - t) + tangents[b * 4 + 3] * t < 0 ? -1 : 1);
    }
    if (skins) skins.push(...blendSkin(skins, a, b, t));
    if (vertexGroups.length) vertexGroups.push(addClassicGroup(groups, vertexGroups[a], vertexGroups[b]));
    intersections.set(key, index);
    return index;
  };
  const intersection = (a, b, cut, cutIndex) => {
    const from = projection(a), distance = projection(b) - from;
    if (Math.abs(distance) <= epsilon) return a;
    return interpolate(a, b, Math.max(0, Math.min(1, (cut - from) / distance)), cutIndex);
  };
  const cleanPolygon = polygon => {
    const clean = polygon.filter((index, at) => !at || index !== polygon[at - 1]);
    if (clean.length > 1 && clean[0] === clean.at(-1)) clean.pop();
    return clean;
  };
  const clip = (polygon, cut, cutIndex, keepLow) => {
    const output = [];
    let previous = polygon.at(-1), previousInside = keepLow ? projection(previous) <= cut + epsilon : projection(previous) >= cut - epsilon;
    for (const current of polygon) {
      const currentInside = keepLow ? projection(current) <= cut + epsilon : projection(current) >= cut - epsilon;
      if (currentInside !== previousInside) output.push(intersection(previous, current, cut, cutIndex));
      if (currentInside) output.push(current);
      previous = current; previousInside = currentInside;
    }
    return cleanPolygon(output);
  };
  let faces = [];
  for (let offset = 0; offset < geoset.Faces.length; offset += 3) {
    const triangle = offset / 3, original = Array.from(geoset.Faces.slice(offset, offset + 3));
    if (!active.has(triangle)) { faces.push(...original); continue; }
    let polygons = [original];
    cuts.forEach((cut, cutIndex) => {
      const next = [];
      for (const polygon of polygons) {
        const low = clip(polygon, cut, cutIndex, true), high = clip(polygon, cut, cutIndex, false);
        if (low.length >= 3) next.push(low);
        if (high.length >= 3) next.push(high);
      }
      polygons = next;
    });
    for (const polygon of polygons) for (let index = 1; index < polygon.length - 1; index++) faces.push(polygon[0], polygon[index], polygon[index + 1]);
  }
  const sourceIsTriangleCorners = source.Faces.length === source.Vertices.length / 3 && new Set(source.Faces).size === source.Faces.length;
  if (sourceIsTriangleCorners) {
    const gather = (array, width) => faces.flatMap(index => array.slice(index * width, index * width + width));
    vertices = gather(vertices, 3);
    if (normals.length) normals = gather(normals, 3);
    if (vertexGroups.length) vertexGroups = gather(vertexGroups, 1);
    if (tangents) tangents = gather(tangents, 4);
    if (skins) skins = gather(skins, 8);
    uvs = uvs.map(stream => gather(stream, 2));
    faces = faces.map((_, index) => index);
  }
  if (vertices.length / 3 > 65536) throw Error('This density exceeds Warcraft III\'s 65,536-vertex limit for one geoset.');
  geoset.Vertices = new geoset.Vertices.constructor(vertices);
  if (normals.length) geoset.Normals = new geoset.Normals.constructor(normals);
  if (vertexGroups.length) geoset.VertexGroup = new geoset.VertexGroup.constructor(vertexGroups);
  if (tangents) geoset.Tangents = new geoset.Tangents.constructor(tangents);
  if (skins) geoset.SkinWeights = new geoset.SkinWeights.constructor(skins);
  geoset.TVertices = uvs.map((values, channel) => new geoset.TVertices[channel].constructor(values));
  geoset.Groups = groups;
  if ('TotalGroupsCount' in geoset) geoset.TotalGroupsCount = groups.reduce((sum, group) => sum + group.length, 0);
  geoset.Faces = new geoset.Faces.constructor(faces);
  updatePrimitiveCounts(geoset);
  return geoset;
}

function bindingKey(geoset, index) {
  if (geoset.SkinWeights?.length) return point(geoset.SkinWeights, index, 8).join(',');
  return [...(geoset.Groups?.[geoset.VertexGroup?.[index]] || [])].sort((a, b) => a - b).join(',');
}

function simplifierData(geoset) {
  const uvCount = geoset.TVertices?.length || 0, tangentWidth = geoset.Tangents?.length ? 4 : 0, stride = 3 + uvCount * 2 + tangentWidth;
  if (stride > 32) throw Error('Triangle reduction supports up to 12 UV channels when tangents are present, or 14 without tangents.');
  const count = geoset.Vertices.length / 3, values = new Float32Array(count * stride), weights = [1, 1, 1];
  weights.push(...(geoset.TVertices || []).flatMap(() => [2, 2]));
  if (tangentWidth) weights.push(1, 1, 1, .25);
  for (let index = 0; index < count; index++) {
    let offset = index * stride;
    values.set(normal(point(geoset.Normals, index, 3)), offset); offset += 3;
    for (const uv of geoset.TVertices || []) { values.set(uv.subarray(index * 2, index * 2 + 2), offset); offset += 2; }
    if (tangentWidth) values.set(geoset.Tangents.subarray(index * 4, index * 4 + 4), offset);
  }
  return { values, weights, stride };
}

function simplifierLocks(geoset) {
  const count = geoset.Vertices.length / 3, locks = new Uint8Array(count), positions = new Map();
  for (let index = 0; index < count; index++) {
    const key = positionKey(geoset, index), peers = positions.get(key) || [];
    for (const other of peers) {
      const seam = bindingKey(geoset, index) !== bindingKey(geoset, other) ||
        !same(point(geoset.Normals, index, 3), point(geoset.Normals, other, 3)) ||
        (geoset.TVertices || []).some(uv => !same(point(uv, index, 2), point(uv, other, 2)));
      if (seam) locks[index] = locks[other] = 1;
    }
    peers.push(index); positions.set(key, peers);
  }
  for (let offset = 0; offset < geoset.Faces.length; offset += 3) for (let edge = 0; edge < 3; edge++) {
    const a = geoset.Faces[offset + edge], b = geoset.Faces[offset + (edge + 1) % 3];
    if (bindingKey(geoset, a) !== bindingKey(geoset, b)) locks[a] = locks[b] = 1;
  }
  return locks;
}

function weldedFaces(geoset) {
  const representatives = new Map(), remap = [];
  for (let index = 0; index < geoset.Vertices.length / 3; index++) {
    const key = JSON.stringify([
      point(geoset.Vertices, index, 3), point(geoset.Normals, index, 3),
      ...(geoset.TVertices || []).map(uv => point(uv, index, 2)),
      geoset.Tangents?.length ? point(geoset.Tangents, index, 4) : null,
      bindingKey(geoset, index),
    ]);
    if (!representatives.has(key)) representatives.set(key, index);
    remap[index] = representatives.get(key);
  }
  return new geoset.Faces.constructor(Array.from(geoset.Faces, index => remap[index]));
}

function compactGeoset(source, faces) {
  const geoset = structuredClone(source), kept = [...new Set(faces)].sort((a, b) => a - b), remap = new Map(kept.map((old, index) => [old, index]));
  const gather = (array, width) => new array.constructor(kept.flatMap(index => Array.from(array.slice(index * width, index * width + width))));
  geoset.Vertices = gather(geoset.Vertices, 3); geoset.Normals = gather(geoset.Normals, 3);
  geoset.TVertices = geoset.TVertices.map(uv => gather(uv, 2));
  geoset.VertexGroup = gather(geoset.VertexGroup, 1);
  if (geoset.Tangents?.length) geoset.Tangents = gather(geoset.Tangents, 4);
  if (geoset.SkinWeights?.length) geoset.SkinWeights = gather(geoset.SkinWeights, 8);
  geoset.Faces = new geoset.Faces.constructor(Array.from(faces, index => remap.get(index)));
  updatePrimitiveCounts(geoset);
  return geoset;
}

export async function reduceGeosetDensity(source, targetTriangles) {
  validateGeoset(source);
  const simplifier = await prepareMeshDensity(), initial = source.Faces.length / 3;
  targetTriangles = Math.max(1, Math.min(initial, Math.round(targetTriangles)));
  if (targetTriangles >= initial) return structuredClone(source);
  const attributes = simplifierData(source), locks = simplifierLocks(source), welded = weldedFaces(source);
  let requested = targetTriangles * 3, margin = 3, faces = welded, error = 0;
  while (requested < welded.length) {
    [faces, error] = simplifier.simplifyWithAttributes(welded, source.Vertices, 3, attributes.values, attributes.stride, attributes.weights, locks, requested, 1, ['RegularizeLight', 'LockBorder']);
    if (faces.length >= targetTriangles * 3) break;
    requested += Math.max(margin, targetTriangles * 3 - faces.length); margin *= 2; faces = welded; error = 0;
  }
  const result = faces.length === source.Faces.length && welded.every((value, index) => value === source.Faces[index]) ? structuredClone(source) : compactGeoset(source, faces);
  result._densityError = error;
  return result;
}

export async function changeGeosetDensity(source, amount) {
  const verticesBefore = validateGeoset(source), trianglesBefore = source.Faces.length / 3, normalized = clampAmount(amount), target = densityTargetTriangles(trianglesBefore, normalized);
  const geoset = normalized > 0 ? densifyGeoset(source, Math.ceil(normalized / 25)) : normalized < 0 ? await reduceGeosetDensity(source, target) : structuredClone(source);
  const densityError = geoset._densityError || 0; delete geoset._densityError;
  const trianglesAfter = geoset.Faces.length / 3;
  return { amount: normalized, geoset, verticesBefore, verticesAfter: geoset.Vertices.length / 3, trianglesBefore, trianglesAfter, targetTriangles: normalized > 0 ? trianglesAfter : target, constrained: normalized < 0 && trianglesAfter > target, densityError };
}
