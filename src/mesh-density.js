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

function blendSkin(source, indices, factors) {
  const weights = new Map();
  for (let sourceIndex = 0; sourceIndex < indices.length; sourceIndex++) {
    const index = indices[sourceIndex], factor = factors[sourceIndex];
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

function adaptiveTriangleSet(geoset) {
  const stats = Array.from({ length: geoset.Faces.length / 3 }, (_, triangle) => ({ triangle, length: triangleLongestEdge(geoset, triangle * 3) }));
  const ordered = stats.filter(entry => entry.length > 1e-10).sort((a, b) => b.length - a.length || a.triangle - b.triangle);
  if (!ordered.length) return new Set();
  let selectedCount = ordered.length, bestGap = 1.75, separated = false;
  for (let index = 1; index <= Math.floor(ordered.length / 2); index++) {
    const ratio = ordered[index - 1].length / Math.max(ordered[index].length, 1e-10);
    if (ratio > bestGap) { bestGap = ratio; selectedCount = index; separated = true; }
  }
  const selected = new Set((selectedCount < ordered.length ? ordered.slice(0, selectedCount) : ordered).map(entry => entry.triangle));
  if (!separated && triangleComponents(geoset, selected).some(component => componentReachedGridLimit(geoset, component))) return new Set();
  return selected;
}

function triangleComponents(geoset, active) {
  const edgeTriangles = new Map(), neighbors = new Map([...active].map(triangle => [triangle, new Set()]));
  for (const triangle of active) {
    const indices = geoset.Faces.slice(triangle * 3, triangle * 3 + 3);
    for (let edge = 0; edge < 3; edge++) {
      const key = geometricEdgeKey(geoset, indices[edge], indices[(edge + 1) % 3]), triangles = edgeTriangles.get(key) || [];
      triangles.push(triangle); edgeTriangles.set(key, triangles);
    }
  }
  for (const triangles of edgeTriangles.values()) for (const triangle of triangles) for (const other of triangles) if (other !== triangle) neighbors.get(triangle).add(other);
  const remaining = new Set(active), components = [];
  while (remaining.size) {
    const component = [], queue = [remaining.values().next().value];
    remaining.delete(queue[0]);
    while (queue.length) {
      const triangle = queue.shift(); component.push(triangle);
      for (const other of neighbors.get(triangle)) if (remaining.delete(other)) queue.push(other);
    }
    components.push(component.sort((a, b) => a - b));
  }
  return components;
}

function componentBoundary(geoset, component) {
  const edges = new Map();
  for (const triangle of component) {
    const indices = Array.from(geoset.Faces.slice(triangle * 3, triangle * 3 + 3));
    for (let edge = 0; edge < 3; edge++) {
      const a = indices[edge], b = indices[(edge + 1) % 3], key = geometricEdgeKey(geoset, a, b), existing = edges.get(key);
      if (existing) existing.count++;
      else edges.set(key, { a, b, count: 1 });
    }
  }
  const nodes = new Map();
  const addNeighbor = (index, other) => {
    const key = positionKey(geoset, index), node = nodes.get(key) || { index, neighbors: new Set() };
    node.neighbors.add(positionKey(geoset, other)); nodes.set(key, node);
  };
  for (const edge of edges.values()) if (edge.count === 1) { addNeighbor(edge.a, edge.b); addNeighbor(edge.b, edge.a); }
  if (nodes.size < 3 || [...nodes.values()].some(node => node.neighbors.size !== 2)) throw Error('This surface needs one clean open boundary before it can be arranged into a 2D texture grid.');
  const start = [...nodes.keys()].sort()[0], loop = [], visited = new Set();
  let previous = null, current = start;
  while (!visited.has(current)) {
    visited.add(current); loop.push(nodes.get(current).index);
    const next = [...nodes.get(current).neighbors].find(key => key !== previous);
    previous = current; current = next;
  }
  if (current !== start || visited.size !== nodes.size) throw Error('This surface needs one clean open boundary before it can be arranged into a 2D texture grid.');
  return loop;
}

function componentProjection(geoset, component, boundary) {
  const boundaryPositions = boundary.map(index => point(geoset.Vertices, index, 3)), subtract = (a, b) => a.map((value, axis) => value - b[axis]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
  let longest = null;
  for (let index = 0; index < boundaryPositions.length; index++) {
    const vector = subtract(boundaryPositions[(index + 1) % boundaryPositions.length], boundaryPositions[index]), length = Math.hypot(...vector);
    if (!longest || length > longest.length) longest = { vector, length };
  }
  if (!(longest?.length > 1e-10)) throw Error('This surface is too narrow to form a 2D texture grid.');
  const lengthVector = longest.vector.map(value => value / longest.length), accumulatedNormal = [0, 0, 0];
  for (const triangle of component) {
    const indices = Array.from(geoset.Faces.slice(triangle * 3, triangle * 3 + 3)), a = point(geoset.Vertices, indices[0], 3), b = point(geoset.Vertices, indices[1], 3), c = point(geoset.Vertices, indices[2], 3), triangleNormal = cross(subtract(b, a), subtract(c, a));
    for (let axis = 0; axis < 3; axis++) accumulatedNormal[axis] += triangleNormal[axis];
  }
  if (Math.hypot(...accumulatedNormal) <= 1e-10) throw Error('This surface has no consistent face direction for a 2D texture grid.');
  const surfaceNormal = normal(accumulatedNormal), widthDirection = cross(surfaceNormal, lengthVector);
  if (Math.hypot(...widthDirection) <= 1e-10) throw Error('This surface is too narrow to form a 2D texture grid.');
  const widthVector = normal(widthDirection), origin = boundaryPositions[0];
  const projectPosition = position => [dot(subtract(position, origin), lengthVector), dot(subtract(position, origin), widthVector)], project = index => projectPosition(point(geoset.Vertices, index, 3));
  const polygon = boundaryPositions.map(projectPosition), span = Math.max(...polygon.map(value => value[0])) - Math.min(...polygon.map(value => value[0]));
  if (!(span > 1e-10)) throw Error('This surface is too narrow to form a 2D texture grid.');
  const values = polygon.map(value => value[0]).sort((a, b) => a - b), tolerance = Math.max(1e-6, span * .005), clusters = [];
  for (const value of values) {
    const cluster = clusters.at(-1);
    if (!cluster || value - cluster.at(-1) > tolerance) clusters.push([value]);
    else cluster.push(value);
  }
  const center = cluster => cluster.reduce((sum, value) => sum + value, 0) / cluster.length;
  const lower = center(clusters[0]), upper = center(clusters.at(-1));
  let innerLower = lower, innerUpper = upper;
  if (clusters.length >= 4) {
    const candidateLower = center(clusters[1]), candidateUpper = center(clusters.at(-2));
    if (candidateUpper - candidateLower >= span * .35) { innerLower = candidateLower; innerUpper = candidateUpper; }
  }
  const epsilon = Math.max(1e-7, span * 1e-7);
  const section = x => {
    const hits = [];
    for (let index = 0; index < polygon.length; index++) {
      const a = polygon[index], b = polygon[(index + 1) % polygon.length], distance = b[0] - a[0];
      if (Math.abs(distance) <= epsilon) {
        if (Math.abs(x - a[0]) <= tolerance) hits.push(a[1], b[1]);
      } else if (x >= Math.min(a[0], b[0]) - epsilon && x <= Math.max(a[0], b[0]) + epsilon) {
        const t = Math.max(0, Math.min(1, (x - a[0]) / distance)); hits.push(a[1] + (b[1] - a[1]) * t);
      }
    }
    hits.sort((a, b) => a - b);
    const clean = hits.filter((value, index) => !index || Math.abs(value - hits[index - 1]) > tolerance);
    if (!clean.length) throw Error('This surface cannot be sampled as a clean 2D texture grid.');
    return [clean[0], clean.at(-1)];
  };
  return { polygon, lower, upper, innerLower, innerUpper, section, epsilon, tolerance, project };
}

function componentReachedGridLimit(geoset, component) {
  const boundary = componentBoundary(geoset, component), projection = componentProjection(geoset, component, boundary), records = new Map();
  for (const triangle of component) for (const index of geoset.Faces.slice(triangle * 3, triangle * 3 + 3)) records.set(positionKey(geoset, index), projection.project(index));
  const clusters = values => {
    const sorted = [...values].sort((a, b) => a - b), grouped = [];
    for (const value of sorted) {
      const last = grouped.at(-1);
      if (!last || Math.abs(value - last.at(-1)) > projection.tolerance) grouped.push([value]);
      else last.push(value);
    }
    return grouped.length;
  };
  const points = [...records.values()], x = points.filter(value => value[0] >= projection.innerLower - projection.tolerance && value[0] <= projection.innerUpper + projection.tolerance).map(value => value[0]);
  return clusters(x) >= 7 || clusters(points.map(value => value[1])) >= 7;
}

function gridDimensions(component, level, projection) {
  const { lower, upper, innerLower, innerUpper, section, tolerance } = projection, hasLeft = innerLower - lower > tolerance, hasRight = upper - innerUpper > tolerance;
  const leftWidth = section(lower), rightWidth = section(upper), midpoint = section((innerLower + innerUpper) / 2);
  const width = Math.max(midpoint[1] - midpoint[0], tolerance), length = Math.max(innerUpper - innerLower, tolerance), desired = component.length * (level * 2 + 1);
  const collapsed = values => values[1] - values[0] <= width * .05;
  let best = null;
  for (let rows = 1; rows <= 6; rows++) for (let columns = 1; columns <= 6; columns++) {
    const triangles = 2 * rows * columns + (hasLeft ? (collapsed(leftWidth) ? rows : rows * 2) : 0) + (hasRight ? (collapsed(rightWidth) ? rows : rows * 2) : 0);
    const aspect = (length / columns) / (width / rows), score = Math.abs(triangles - desired) / desired * 2 + Math.abs(Math.log(Math.max(aspect, 1e-8)));
    if (!best || score < best.score - 1e-10 || Math.abs(score - best.score) <= 1e-10 && triangles < best.triangles) best = { rows, columns, triangles, score };
  }
  return best;
}

function barycentric2D(target, a, b, c) {
  const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(denominator) <= 1e-12) return null;
  const first = ((b[1] - c[1]) * (target[0] - c[0]) + (c[0] - b[0]) * (target[1] - c[1])) / denominator;
  const second = ((c[1] - a[1]) * (target[0] - c[0]) + (a[0] - c[0]) * (target[1] - c[1])) / denominator;
  return [first, second, 1 - first - second];
}

function sampledRecord(geoset, component, projection, target, groups) {
  let match = null, best = -Infinity;
  for (const triangle of component) {
    const indices = Array.from(geoset.Faces.slice(triangle * 3, triangle * 3 + 3));
    const projected = indices.map(projection.project);
    const factors = barycentric2D(target, ...projected);
    if (!factors) continue;
    const score = Math.min(...factors);
    if (score >= -1e-4 && score > best) { match = { indices, factors }; best = score; }
  }
  if (!match) throw Error('This surface folds over itself in the grid view. Separate it into a simpler surface and try again.');
  const factors = match.factors.map(value => Math.max(0, value)), total = factors.reduce((sum, value) => sum + value, 0) || 1;
  factors.forEach((value, index) => { factors[index] = value / total; });
  const interpolate = (array, width, normalize = false) => {
    const values = Array.from({ length: width }, (_, componentIndex) => match.indices.reduce((sum, sourceIndex, index) => sum + array[sourceIndex * width + componentIndex] * factors[index], 0));
    return normalize ? normal(values) : values;
  };
  let vertexGroup = null;
  if (geoset.VertexGroup?.length) {
    const used = match.indices.filter((_, index) => factors[index] > 1e-8);
    vertexGroup = geoset.VertexGroup[used[0]];
    for (const index of used.slice(1)) vertexGroup = addClassicGroup(groups, vertexGroup, geoset.VertexGroup[index]);
  }
  const tangentValues = geoset.Tangents?.length ? interpolate(geoset.Tangents, 4) : null;
  const tangent = tangentValues ? [...normal(tangentValues.slice(0, 3)), tangentValues[3] < 0 ? -1 : 1] : null;
  return {
    position: interpolate(geoset.Vertices, 3), normal: geoset.Normals?.length ? interpolate(geoset.Normals, 3, true) : null,
    uvs: (geoset.TVertices || []).map(stream => interpolate(stream, 2)), vertexGroup, tangent,
    skin: geoset.SkinWeights?.length ? blendSkin(geoset.SkinWeights, match.indices, factors) : null,
  };
}

function remeshComponent(geoset, component, level, groups) {
  const boundary = componentBoundary(geoset, component), projection = componentProjection(geoset, component, boundary), dimensions = gridDimensions(component, level, projection);
  const { lower, upper, innerLower, innerUpper, section, tolerance } = projection, columns = [];
  if (innerLower - lower > tolerance) columns.push(lower);
  for (let column = 0; column <= dimensions.columns; column++) columns.push(innerLower + (innerUpper - innerLower) * column / dimensions.columns);
  if (upper - innerUpper > tolerance) columns.push(upper);
  const cache = new Map(), at = (column, row) => {
    const key = `${column}:${row}`, existing = cache.get(key);
    if (existing) return existing;
    const bounds = section(columns[column]), width = bounds[0] + (bounds[1] - bounds[0]) * row / dimensions.rows;
    const entry = { projected: [columns[column], width], record: sampledRecord(geoset, component, projection, [columns[column], width], groups) };
    cache.set(key, entry); return entry;
  };
  const samePoint = (a, b) => Math.hypot(a.projected[0] - b.projected[0], a.projected[1] - b.projected[1]) <= tolerance, triangles = [];
  for (let column = 0; column < columns.length - 1; column++) for (let row = 0; row < dimensions.rows; row++) {
    const corners = [at(column, row), at(column + 1, row), at(column + 1, row + 1), at(column, row + 1)], unique = [];
    for (const corner of corners) if (!unique.some(existing => samePoint(existing, corner))) unique.push(corner);
    if (unique.length === 3) triangles.push(unique.map(entry => entry.record));
    else if (unique.length === 4) {
      triangles.push([corners[0].record, corners[1].record, corners[2].record], [corners[0].record, corners[2].record, corners[3].record]);
    }
  }
  const first = component.map(triangle => Array.from(geoset.Faces.slice(triangle * 3, triangle * 3 + 3))).find(indices => {
    const a = indices.map(projection.project);
    return Math.abs((a[1][0] - a[0][0]) * (a[2][1] - a[0][1]) - (a[1][1] - a[0][1]) * (a[2][0] - a[0][0])) > 1e-10;
  });
  if (first) {
    const a = first.map(projection.project);
    const orientation = (a[1][0] - a[0][0]) * (a[2][1] - a[0][1]) - (a[1][1] - a[0][1]) * (a[2][0] - a[0][0]);
    if (orientation < 0) triangles.forEach(triangle => { [triangle[1], triangle[2]] = [triangle[2], triangle[1]]; });
  }
  return triangles;
}

function sourceRecord(geoset, index) {
  return {
    position: point(geoset.Vertices, index, 3), normal: geoset.Normals?.length ? point(geoset.Normals, index, 3) : null,
    uvs: (geoset.TVertices || []).map(stream => point(stream, index, 2)), vertexGroup: geoset.VertexGroup?.length ? geoset.VertexGroup[index] : null,
    tangent: geoset.Tangents?.length ? point(geoset.Tangents, index, 4) : null, skin: geoset.SkinWeights?.length ? point(geoset.SkinWeights, index, 8) : null,
  };
}

export function densifyGeoset(source, level) {
  validateGeoset(source);
  level = Math.max(0, Math.min(4, Math.round(level)));
  if (!level) return structuredClone(source);
  const geoset = structuredClone(source), groups = geoset.Groups ? geoset.Groups.map(group => [...group]) : [], active = adaptiveTriangleSet(geoset);
  if (!active.size) return geoset;
  const components = triangleComponents(geoset, active), componentByTriangle = new Map(), remeshed = new Map();
  components.forEach((component, index) => component.forEach(triangle => componentByTriangle.set(triangle, index)));
  components.forEach((component, index) => remeshed.set(index, remeshComponent(geoset, component, level, groups)));
  const vertices = [], normals = [], vertexGroups = [], tangents = [], skins = [], uvs = (geoset.TVertices || []).map(() => []), faces = [], written = new Set();
  const append = record => {
    const index = vertices.length / 3; vertices.push(...record.position); faces.push(index);
    if (record.normal) normals.push(...record.normal);
    record.uvs.forEach((values, channel) => uvs[channel].push(...values));
    if (record.vertexGroup !== null) vertexGroups.push(record.vertexGroup);
    if (record.tangent) tangents.push(...record.tangent);
    if (record.skin) skins.push(...record.skin);
  };
  for (let triangle = 0; triangle < geoset.Faces.length / 3; triangle++) {
    const componentIndex = componentByTriangle.get(triangle);
    if (componentIndex === undefined) for (const index of geoset.Faces.slice(triangle * 3, triangle * 3 + 3)) append(sourceRecord(geoset, index));
    else if (!written.has(componentIndex)) {
      written.add(componentIndex);
      for (const replacement of remeshed.get(componentIndex)) replacement.forEach(append);
    }
  }
  if (vertices.length / 3 > 65536) throw Error('This density exceeds Warcraft III\'s 65,536-vertex limit for one geoset.');
  geoset.Vertices = new geoset.Vertices.constructor(vertices);
  if (geoset.Normals?.length) geoset.Normals = new geoset.Normals.constructor(normals);
  if (geoset.VertexGroup?.length) geoset.VertexGroup = new geoset.VertexGroup.constructor(vertexGroups);
  if (geoset.Tangents?.length) geoset.Tangents = new geoset.Tangents.constructor(tangents);
  if (geoset.SkinWeights?.length) geoset.SkinWeights = new geoset.SkinWeights.constructor(skins);
  geoset.TVertices = uvs.map((values, channel) => new geoset.TVertices[channel].constructor(values));
  geoset.Groups = groups;
  if ('TotalGroupsCount' in geoset) geoset.TotalGroupsCount = groups.reduce((sum, group) => sum + group.length, 0);
  geoset.Faces = new geoset.Faces.constructor(faces);
  updatePrimitiveCounts(geoset);
  return geoset;
}

export function maximumDensityAmount(source) {
  validateGeoset(source);
  try {
    let maximum = 0, previous = source.Faces.length;
    for (let level = 1; level <= 4; level++) {
      const faces = densifyGeoset(source, level).Faces.length;
      if (faces !== previous) maximum = level * 25;
      previous = faces;
    }
    return maximum;
  } catch {
    // Keep the control available; the normal preview pass reports the exact
    // unsupported-surface reason instead of crashing the Forge dialog.
    return 100;
  }
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
