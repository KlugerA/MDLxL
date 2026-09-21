const EPSILON = 1e-8;
const CHART_ANGLE_COSINE = Math.cos(Math.PI / 3);

function faceNormal(geoset, face) {
  const offset = face * 3, a = geoset.Faces[offset] * 3, b = geoset.Faces[offset + 1] * 3, c = geoset.Faces[offset + 2] * 3;
  const ab = [geoset.Vertices[b] - geoset.Vertices[a], geoset.Vertices[b + 1] - geoset.Vertices[a + 1], geoset.Vertices[b + 2] - geoset.Vertices[a + 2]];
  const ac = [geoset.Vertices[c] - geoset.Vertices[a], geoset.Vertices[c + 1] - geoset.Vertices[a + 1], geoset.Vertices[c + 2] - geoset.Vertices[a + 2]];
  const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]], length = Math.hypot(...normal);
  return length > EPSILON ? normal.map(value => value / length) : [0, 0, 1];
}

function projectionFor(normal) {
  let axis = 0;
  if (Math.abs(normal[1]) > Math.abs(normal[axis])) axis = 1;
  if (Math.abs(normal[2]) > Math.abs(normal[axis])) axis = 2;
  return axis * 2 + (normal[axis] < 0 ? 1 : 0);
}

function projectVertex(geoset, vertex, projection) {
  const offset = vertex * 3, x = geoset.Vertices[offset], y = geoset.Vertices[offset + 1], z = geoset.Vertices[offset + 2];
  switch (projection) {
    case 0: return [y, -z];
    case 1: return [-y, -z];
    case 2: return [x, z];
    case 3: return [-x, z];
    case 4: return [x, -y];
    default: return [-x, -y];
  }
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function faceAdjacency(geoset) {
  const count = geoset.Faces.length / 3, adjacent = Array.from({ length: count }, () => []), edges = new Map();
  for (let face = 0; face < count; face++) for (let side = 0; side < 3; side++) {
    const a = Number(geoset.Faces[face * 3 + side]), b = Number(geoset.Faces[face * 3 + (side + 1) % 3]), key = a < b ? `${a}:${b}` : `${b}:${a}`, previous = edges.get(key);
    if (previous === undefined) edges.set(key, face);
    else if (previous !== face) { adjacent[face].push(previous); adjacent[previous].push(face); }
  }
  return adjacent;
}

function orient(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function strictInside(point, triangle) {
  const values = [orient(triangle[0], triangle[1], point), orient(triangle[1], triangle[2], point), orient(triangle[2], triangle[0], point)];
  return values.every(value => value > EPSILON) || values.every(value => value < -EPSILON);
}
function properCross(a, b, c, d) {
  const abC = orient(a, b, c), abD = orient(a, b, d), cdA = orient(c, d, a), cdB = orient(c, d, b);
  return abC * abD < -EPSILON && cdA * cdB < -EPSILON;
}
function trianglesOverlap(a, b) {
  const bounds = triangle => [Math.min(...triangle.map(p => p[0])), Math.min(...triangle.map(p => p[1])), Math.max(...triangle.map(p => p[0])), Math.max(...triangle.map(p => p[1]))], aa = bounds(a), bb = bounds(b);
  if (aa[2] <= bb[0] + EPSILON || bb[2] <= aa[0] + EPSILON || aa[3] <= bb[1] + EPSILON || bb[3] <= aa[1] + EPSILON) return false;
  const center = triangle => [(triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3, (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3];
  if (strictInside(center(a), b) || strictInside(center(b), a)) return true;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (properCross(a[i], a[(i + 1) % 3], b[j], b[(j + 1) % 3])) return true;
  return false;
}

function finishChart(geoset, geosetIndex, faces, projection) {
  const coordinates = new Map(), triangles = [];
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (const face of faces) {
    const triangle = [];
    for (let corner = 0; corner < 3; corner++) {
      const vertex = Number(geoset.Faces[face * 3 + corner]); let point = coordinates.get(vertex);
      if (!point) { point = projectVertex(geoset, vertex, projection); coordinates.set(vertex, point); minU = Math.min(minU, point[0]); minV = Math.min(minV, point[1]); maxU = Math.max(maxU, point[0]); maxV = Math.max(maxV, point[1]); }
      triangle.push(point);
    }
    triangles.push(triangle);
  }
  return { geosetIndex, faces, projection, coordinates, triangles, minU, minV, width: Math.max(EPSILON, maxU - minU), height: Math.max(EPSILON, maxV - minV) };
}

function hasInternalOverlap(chart) {
  for (let i = 0; i < chart.triangles.length; i++) for (let j = i + 1; j < chart.triangles.length; j++) if (trianglesOverlap(chart.triangles[i], chart.triangles[j])) return true;
  return false;
}

function chartsForGeoset(geoset, geosetIndex) {
  const count = geoset.Faces?.length / 3 || 0, normals = Array.from({ length: count }, (_, face) => faceNormal(geoset, face)), projections = normals.map(projectionFor), adjacent = faceAdjacency(geoset), seen = new Uint8Array(count), charts = [];
  for (let seed = 0; seed < count; seed++) {
    if (seen[seed]) continue;
    const faces = [], queue = [seed]; seen[seed] = 1;
    while (queue.length) {
      const face = queue.pop(); faces.push(face);
      for (const next of adjacent[face]) if (!seen[next] && projections[next] === projections[seed] && dot(normals[next], normals[seed]) >= CHART_ANGLE_COSINE) { seen[next] = 1; queue.push(next); }
    }
    const chart = finishChart(geoset, geosetIndex, faces, projections[seed]);
    if (faces.length > 1 && hasInternalOverlap(chart)) for (const face of faces) charts.push(finishChart(geoset, geosetIndex, [face], projections[face]));
    else charts.push(chart);
  }
  return charts;
}

function intersects(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function contains(a, b) { return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h; }

function splitFreeRectangles(free, used) {
  const result = [];
  for (const rectangle of free) {
    if (!intersects(rectangle, used)) { result.push(rectangle); continue; }
    if (used.x > rectangle.x) result.push({ x: rectangle.x, y: rectangle.y, w: used.x - rectangle.x, h: rectangle.h });
    if (used.x + used.w < rectangle.x + rectangle.w) result.push({ x: used.x + used.w, y: rectangle.y, w: rectangle.x + rectangle.w - used.x - used.w, h: rectangle.h });
    if (used.y > rectangle.y) result.push({ x: rectangle.x, y: rectangle.y, w: rectangle.w, h: used.y - rectangle.y });
    if (used.y + used.h < rectangle.y + rectangle.h) result.push({ x: rectangle.x, y: used.y + used.h, w: rectangle.w, h: rectangle.y + rectangle.h - used.y - used.h });
  }
  return result.filter((rectangle, index, all) => rectangle.w > 0 && rectangle.h > 0 && !all.some((other, otherIndex) => index !== otherIndex && contains(other, rectangle)));
}

function tryPack(charts, resolution, padding, scale) {
  const rectangles = charts.map((chart, index) => ({ chart, index, innerW: Math.max(2, Math.ceil(chart.width * scale)), innerH: Math.max(2, Math.ceil(chart.height * scale)) }))
    .sort((a, b) => Math.max(b.innerW, b.innerH) - Math.max(a.innerW, a.innerH) || b.innerW * b.innerH - a.innerW * a.innerH || a.index - b.index);
  let free = [{ x: 0, y: 0, w: resolution, h: resolution }]; const placements = new Map();
  for (const rectangle of rectangles) {
    let best = null;
    for (const space of free) for (const rotated of [false, true]) {
      const innerW = rotated ? rectangle.innerH : rectangle.innerW, innerH = rotated ? rectangle.innerW : rectangle.innerH, w = innerW + padding * 2, h = innerH + padding * 2;
      if (w > space.w || h > space.h) continue;
      const score = [Math.min(space.w - w, space.h - h), Math.max(space.w - w, space.h - h), space.y, space.x, rotated ? 1 : 0];
      if (!best || score.some((value, i) => value < best.score[i] && score.slice(0, i).every((before, k) => before === best.score[k]))) best = { x: space.x, y: space.y, w, h, innerW, innerH, rotated, score };
    }
    if (!best) return null;
    placements.set(rectangle.chart, best); free = splitFreeRectangles(free, best);
  }
  return placements;
}

function packCharts(charts, resolution, padding) {
  let best = tryPack(charts, resolution, padding, 0);
  if (!best) throw Error(`This model has too many UV islands for a ${resolution}×${resolution} paint texture. Create another material for some geosets.`);
  let low = 0, high = 1, attempt = tryPack(charts, resolution, padding, high);
  while (attempt && high < 1e7) { low = high; best = attempt; high *= 2; attempt = tryPack(charts, resolution, padding, high); }
  for (let step = 0; step < 24; step++) { const middle = (low + high) / 2, packed = tryPack(charts, resolution, padding, middle); if (packed) { low = middle; best = packed; } else high = middle; }
  return { scale: low, placements: best };
}

function copyAttribute(values, sources, stride, sourceCount) {
  if (!ArrayBuffer.isView(values) || values.length !== sourceCount * stride) return values;
  const output = new values.constructor(sources.length * stride);
  sources.forEach((source, index) => output.set(values.subarray(source * stride, source * stride + stride), index * stride));
  return output;
}

function chartUV(chart, placement, scale, resolution, padding, point) {
  const u = (point[0] - chart.minU) * scale, v = (point[1] - chart.minV) * scale;
  return placement.rotated
    ? [(placement.x + padding + v) / resolution, (placement.y + padding + placement.innerH - u) / resolution]
    : [(placement.x + padding + u) / resolution, (placement.y + padding + v) / resolution];
}

function applyAtlasToGeoset(geoset, charts, packed, resolution, padding) {
  const sourceCount = geoset.Vertices.length / 3;
  if ((geoset.TVertices?.length || 0) >= 16) throw Error('A fresh Citadel material needs one free UV set; this geoset already has 16.');
  const sources = Array.from({ length: sourceCount }, (_, index) => index), owners = new Int32Array(sourceCount).fill(-1), faces = new Uint32Array(geoset.Faces.length), uv = [];
  charts.forEach((chart, chartIndex) => {
    const mapped = new Map(), placement = packed.placements.get(chart);
    for (const face of chart.faces) for (let corner = 0; corner < 3; corner++) {
      const faceOffset = face * 3 + corner, source = Number(geoset.Faces[faceOffset]); let target = mapped.get(source);
      if (target === undefined) {
        if (owners[source] < 0) { target = source; owners[source] = chartIndex; }
        else { target = sources.length; sources.push(source); }
        mapped.set(source, target);
        const point = chartUV(chart, placement, packed.scale, resolution, padding, chart.coordinates.get(source)); uv[target * 2] = point[0]; uv[target * 2 + 1] = point[1];
      }
      faces[faceOffset] = target;
    }
  });
  if (sources.length > 65536) throw Error('Fresh UV wrapping would exceed Warcraft III’s 65536-vertex geoset limit. Put this geoset in a simpler model or reduce its seams.');
  for (let vertex = 0; vertex < sourceCount; vertex++) if (uv[vertex * 2] === undefined) { uv[vertex * 2] = .5; uv[vertex * 2 + 1] = .5; }
  const result = { ...geoset };
  result.Vertices = copyAttribute(geoset.Vertices, sources, 3, sourceCount);
  result.Normals = copyAttribute(geoset.Normals, sources, 3, sourceCount);
  result.VertexGroup = copyAttribute(geoset.VertexGroup, sources, 1, sourceCount);
  result.TVertices = (geoset.TVertices || []).map(values => copyAttribute(values, sources, 2, sourceCount));
  if (geoset.Tangents?.length) result.Tangents = copyAttribute(geoset.Tangents, sources, 4, sourceCount);
  if (geoset.SkinWeights?.length) result.SkinWeights = copyAttribute(geoset.SkinWeights, sources, 8, sourceCount);
  result.Faces = new geoset.Faces.constructor(faces);
  result.TVertices.push(new Float32Array(uv));
  return { geoset: result, coordId: result.TVertices.length - 1, addedVertices: sources.length - sourceCount };
}

/** Build one stable, non-overlapping UV atlas for fresh Citadel materials.
 * Original UV sets remain available for the "Paint Current Skin" workflow. */
export function createFreshPaintAtlas(model, geosetIndices, resolution = 256) {
  if (![256, 512].includes(Number(resolution))) throw Error('Fresh paint textures must be 256×256 or 512×512.');
  const indices = [...new Set(geosetIndices)].sort((a, b) => a - b), charts = [];
  for (const index of indices) {
    const geoset = model?.Geosets?.[index];
    if (!geoset?.Vertices?.length || !geoset?.Faces?.length) throw Error(`Geoset ${index + 1} has no paintable triangles.`);
    charts.push(...chartsForGeoset(geoset, index));
  }
  if (!charts.length) throw Error('This model has no paintable triangles.');
  // A one-texel gutter on each chart leaves two texels between UV interiors,
  // enough for the painter's bilinear filter taps. Scaling this border with
  // image size spends nearly the entire atlas on gutters on detailed models.
  const padding = 1, packed = packCharts(charts, resolution, padding), Geosets = [...model.Geosets], coordIds = {}, chartsByGeoset = new Map(); let addedVertices = 0;
  for (const chart of charts) { let list = chartsByGeoset.get(chart.geosetIndex); if (!list) chartsByGeoset.set(chart.geosetIndex, list = []); list.push(chart); }
  for (const index of indices) { const result = applyAtlasToGeoset(model.Geosets[index], chartsByGeoset.get(index), packed, resolution, padding); Geosets[index] = result.geoset; coordIds[index] = result.coordId; addedVertices += result.addedVertices; }
  return { model: { ...model, Geosets }, coordIds, chartCount: charts.length, addedVertices, padding };
}
