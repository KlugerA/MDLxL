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
const geometricEdgeKey = (geoset, a, b) => [positionKey(geoset, a), positionKey(geoset, b)].sort().join('|');
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
  if (amount >= 0) return Math.max(1, Math.round(triangles * (1 + amount * 0.03)));
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

function blendSkin(source, a, b) {
  const weights = new Map();
  for (const [index, factor] of [[a, .5], [b, .5]]) {
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

function splitSelectedEdges(source, selected) {
  const geoset = structuredClone(source), count = validateGeoset(geoset), groups = geoset.Groups ? geoset.Groups.map(group => [...group]) : [];
  const vertices = Array.from(geoset.Vertices), normals = Array.from(geoset.Normals || []), vertexGroups = Array.from(geoset.VertexGroup || []);
  const tangents = geoset.Tangents?.length ? Array.from(geoset.Tangents) : null;
  const skins = geoset.SkinWeights?.length ? Array.from(geoset.SkinWeights) : null;
  const uvs = (geoset.TVertices || []).map(stream => Array.from(stream)), midpointByEdge = new Map();
  const midpoint = (a, b) => {
    const key = indexedEdgeKey(a, b);
    if (midpointByEdge.has(key)) return midpointByEdge.get(key);
    const index = vertices.length / 3;
    for (let axis = 0; axis < 3; axis++) vertices.push((geoset.Vertices[a * 3 + axis] + geoset.Vertices[b * 3 + axis]) / 2);
    if (normals.length) normals.push(...normal([0, 1, 2].map(axis => geoset.Normals[a * 3 + axis] + geoset.Normals[b * 3 + axis])));
    uvs.forEach((stream, channel) => stream.push(...[0, 1].map(axis => (geoset.TVertices[channel][a * 2 + axis] + geoset.TVertices[channel][b * 2 + axis]) / 2)));
    if (tangents) {
      const xyz = normal([0, 1, 2].map(axis => geoset.Tangents[a * 4 + axis] + geoset.Tangents[b * 4 + axis]));
      tangents.push(...xyz, geoset.Tangents[a * 4 + 3] + geoset.Tangents[b * 4 + 3] < 0 ? -1 : 1);
    }
    if (skins) skins.push(...blendSkin(geoset.SkinWeights, a, b));
    if (vertexGroups.length) vertexGroups.push(addClassicGroup(groups, geoset.VertexGroup[a], geoset.VertexGroup[b]));
    midpointByEdge.set(key, index);
    return index;
  };
  const faces = [];
  for (let offset = 0; offset < geoset.Faces.length; offset += 3) {
    const [a, b, c] = geoset.Faces.slice(offset, offset + 3), ab = selected.has(geometricEdgeKey(geoset, a, b)), bc = selected.has(geometricEdgeKey(geoset, b, c)), ca = selected.has(geometricEdgeKey(geoset, c, a));
    const mask = (ab ? 1 : 0) | (bc ? 2 : 0) | (ca ? 4 : 0);
    if (!mask) { faces.push(a, b, c); continue; }
    const mab = ab ? midpoint(a, b) : -1, mbc = bc ? midpoint(b, c) : -1, mca = ca ? midpoint(c, a) : -1;
    if (mask === 1) faces.push(a, mab, c, mab, b, c);
    else if (mask === 2) faces.push(b, mbc, a, mbc, c, a);
    else if (mask === 4) faces.push(c, mca, b, mca, a, b);
    else if (mask === 3) faces.push(b, mbc, mab, a, mab, mbc, a, mbc, c);
    else if (mask === 5) faces.push(a, mab, mca, b, c, mca, b, mca, mab);
    else if (mask === 6) faces.push(c, mca, mbc, a, b, mbc, a, mbc, mca);
    else faces.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
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

function edgeBuckets(geoset) {
  const edges = new Map();
  for (let offset = 0; offset < geoset.Faces.length; offset += 3) for (let edge = 0; edge < 3; edge++) {
    const a = geoset.Faces[offset + edge], b = geoset.Faces[offset + (edge + 1) % 3], key = geometricEdgeKey(geoset, a, b);
    if (!edges.has(key)) edges.set(key, { key, length: Math.hypot(...point(geoset.Vertices, a, 3).map((value, axis) => value - geoset.Vertices[b * 3 + axis])), uses: 0 });
    edges.get(key).uses++;
  }
  const ordered = [...edges.values()].filter(edge => edge.length > 1e-10).sort((a, b) => b.length - a.length || a.key.localeCompare(b.key)), buckets = [];
  for (const edge of ordered) {
    const last = buckets.at(-1), tolerance = Math.max(1e-7, edge.length * 1e-5);
    if (!last || Math.abs(last.length - edge.length) > tolerance) buckets.push({ length: edge.length, edges: [edge], increment: edge.uses });
    else { last.edges.push(edge); last.increment += edge.uses; }
  }
  return buckets;
}

export function densifyGeoset(source, targetTriangles) {
  validateGeoset(source);
  let geoset = structuredClone(source), triangles = geoset.Faces.length / 3;
  targetTriangles = Math.max(triangles, Math.min(triangles * 4, Math.round(targetTriangles)));
  for (let pass = 0; pass < 8 && triangles < targetTriangles; pass++) {
    const selected = new Set(); let projected = triangles;
    for (const bucket of edgeBuckets(geoset)) {
      const next = projected + bucket.increment;
      if (selected.size && next > targetTriangles && Math.abs(targetTriangles - projected) <= Math.abs(next - targetTriangles)) break;
      bucket.edges.forEach(edge => selected.add(edge.key)); projected = next;
      if (projected >= targetTriangles) break;
    }
    if (!selected.size) break;
    const next = splitSelectedEdges(geoset, selected);
    if (next.Faces.length === geoset.Faces.length) break;
    geoset = next; triangles = geoset.Faces.length / 3;
  }
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
  const geoset = normalized > 0 ? densifyGeoset(source, target) : normalized < 0 ? await reduceGeosetDensity(source, target) : structuredClone(source);
  const densityError = geoset._densityError || 0; delete geoset._densityError;
  return { amount: normalized, geoset, verticesBefore, verticesAfter: geoset.Vertices.length / 3, trianglesBefore, trianglesAfter: geoset.Faces.length / 3, targetTriangles: target, constrained: normalized < 0 && geoset.Faces.length / 3 > target, densityError };
}
