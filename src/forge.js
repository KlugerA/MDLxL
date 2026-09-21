/** Local image cutouts and WC3 geometry. Draft operations never mutate the model;
 * commitForge belongs inside EditorDocument.apply so one Forge is one undo step.
 * UVs always address the complete original image, including after crop/cleanup.
 */
import { booleanContours, exteriorFrame, triangulateContours } from './forge-geometry.js';
import { createNode, recalculateNormals, recalculateExtents } from './editor-document.js';
import { rgbToWarcraftColor } from './warcraft-color.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, name, min = 0) => { if (!Number.isFinite(v) || v < min) throw Error(`${name} is outside the allowed range.`); return v; };
function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16777216) throw Error('Use an image with at most 16 million pixels.');
}
export function alphaMask(image, threshold = 1) {
  dimensions(image.width, image.height);
  if (image.data.length !== image.width * image.height * 4) throw Error('The image has invalid pixel data.');
  const mask = Uint8Array.from({ length: image.width * image.height }, (_, i) => image.data[i * 4 + 3] >= threshold ? 1 : 0);
  return attachShape(mask, { type: 'raster', mask, width: image.width, height: image.height });
}
/** Portable classic WC3 texture for browser image formats. Pixels and alpha are
 * lossless; top-left origin keeps the same UV coordinates as the source image. */
export function encodeForgeTga(image) {
  dimensions(image.width, image.height);
  if (image.width > 65535 || image.height > 65535 || image.data.length !== image.width * image.height * 4) throw Error('The image has invalid pixel data.');
  const bytes = new Uint8Array(18 + image.data.length), view = new DataView(bytes.buffer);
  bytes[2] = 2; view.setUint16(12, image.width, true); view.setUint16(14, image.height, true); bytes[16] = 32; bytes[17] = 40;
  for (let i = 0; i < image.data.length; i += 4) bytes.set([image.data[i + 2], image.data[i + 1], image.data[i], image.data[i + 3]], 18 + i);
  return bytes;
}
export function polygonMask(width, height, points) {
  dimensions(width, height); const mask = new Uint8Array(width * height);
  if (points.length < 3) throw Error('Close a polygon with at least three points.');
  for (let y = 0; y < height; y++) {
    const crosses = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y + .5) !== (b[1] > y + .5)) crosses.push(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    crosses.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crosses.length; i += 2) for (let x = Math.max(0, Math.ceil(crosses[i] - .5)); x < Math.min(width, Math.ceil(crosses[i + 1] - .5)); x++) mask[y * width + x] = 1;
  }
  return attachShape(mask, { type: 'polygon', points: points.map(p => [...p]), width, height });
}
export function magicWand(image, x, y, tolerance = 24, connected = true) {
  const { width, height, data } = image; dimensions(width, height);
  x = clamp(Math.floor(x), 0, width - 1); y = clamp(Math.floor(y), 0, height - 1);
  const mask = new Uint8Array(width * height), seed = (y * width + x) * 4, limit = clamp(tolerance, 0, 255) ** 2 * 4;
  const matches = i => { let d = 0; for (let k = 0; k < 4; k++) d += (data[i * 4 + k] - data[seed + k]) ** 2; return d <= limit; };
  if (!connected) { for (let i = 0; i < mask.length; i++) if (matches(i)) mask[i] = 1; return attachShape(mask, { type: 'raster', mask, width, height }); }
  const queue = new Uint32Array(mask.length), seen = new Uint8Array(mask.length); let head = 0, tail = 1; queue[0] = y * width + x; seen[queue[0]] = 1;
  while (head < tail) {
    const i = queue[head++]; if (!matches(i)) continue; mask[i] = 1;
    const xx = i % width, yy = Math.floor(i / width);
    for (const n of [xx > 0 ? i - 1 : -1, xx < width - 1 ? i + 1 : -1, yy > 0 ? i - width : -1, yy < height - 1 ? i + width : -1]) if (n >= 0 && !seen[n]) { seen[n] = 1; queue[tail++] = n; }
  }
  return attachShape(mask, { type: 'raster', mask, width, height });
}
export function combineMask(current, selected, operation, original = null) {
  if (selected && selected.length !== current.length) throw Error('Mask sizes do not match.');
  if (!['keep', 'remove', 'add', 'subtract', 'invert', 'reset'].includes(operation)) throw Error('Unknown cleanup operation.');
  const result = Uint8Array.from(current, (v, i) => {
    if (operation === 'reset') return original ? original[i] : 1;
    if (operation === 'invert') return original && !original[i] ? 0 : v ? 0 : 1;
    if (operation === 'keep') return v && selected[i] ? 1 : 0;
    if (operation === 'add') return (v || selected[i]) && (!original || original[i]) ? 1 : 0;
    return v && !selected[i] ? 1 : 0;
  });
  const basis = current.forgeShape || selected?.forgeShape || original?.forgeShape;
  if (!basis) return result;
  const { width, height } = basis, shape = mask => mask?.forgeShape || { type: 'raster', mask, width, height };
  let definition;
  if (operation === 'reset') definition = original ? shape(original) : { type: 'polygon', width, height, points: [[0,0],[width,0],[width,height],[0,height]] };
  else if (operation === 'invert') definition = { type: 'boolean', operation: 'remove', a: original ? shape(original) : { type: 'polygon', width, height, points: [[0,0],[width,0],[width,height],[0,height]] }, b: shape(current), width, height };
  else definition = { type: 'boolean', operation, a: shape(current), b: shape(selected), width, height };
  if (operation === 'add' && original) definition = { type: 'boolean', operation: 'keep', a: definition, b: shape(original), width, height };
  return attachShape(result, definition);
}
const area = loop => loop.reduce((sum, p, i) => { const q = loop[(i + 1) % loop.length]; return sum + p[0] * q[1] - p[1] * q[0]; }, 0) / 2;
const pointIn = (p, loop) => { let inside = false; for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) { const a = loop[i], b = loop[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
function segmentDistance(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function simplifyOpen(points, tolerance) {
  const keep = new Set([0, points.length - 1]), stack = [[0, points.length - 1]];
  while (stack.length) { const [a, b] = stack.pop(); let far = tolerance, index = -1; for (let i = a + 1; i < b; i++) { const d = segmentDistance(points[i], points[a], points[b]); if (d > far) { far = d; index = i; } } if (index >= 0) { keep.add(index); stack.push([a, index], [index, b]); } }
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}
function simplifyLoop(loop, tolerance) {
  const straight = loop.filter((p, i) => { const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length]; return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]); });
  if (tolerance <= 0 || straight.length < 5) return straight;
  let far = 1; for (let i = 2; i < straight.length; i++) if (Math.hypot(straight[i][0] - straight[0][0], straight[i][1] - straight[0][1]) > Math.hypot(straight[far][0] - straight[0][0], straight[far][1] - straight[0][1])) far = i;
  const simple = [...simplifyOpen(straight.slice(0, far + 1), tolerance).slice(0, -1), ...simplifyOpen([...straight.slice(far), straight[0]], tolerance).slice(0, -1)];
  if (simple.length < 3 || Math.sign(area(simple)) !== Math.sign(area(straight))) return tolerance > 1e-6 ? simplifyLoop(straight, tolerance / 2) : straight;
  if (simple.length > 1500) return straight;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < simple.length; i++) for (let j = i + 2; j < simple.length; j++) {
    if (i === 0 && j === simple.length - 1) continue;
    const a = simple[i], b = simple[(i + 1) % simple.length], c = simple[j], d = simple[(j + 1) % simple.length];
    if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) continue;
    if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) return tolerance > 1e-6 ? simplifyLoop(straight, tolerance / 2) : straight;
  }
  return simple;
}

function simplifyTopology(loops, tolerance) {
  const result = loops.map(loop => simplifyLoop(loop, tolerance));
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const intersects = (a,b) => a.some((p,i) => b.some((r,j) => { const q=a[(i+1)%a.length],s=b[(j+1)%b.length]; return cross(p,q,r)*cross(p,q,s)<-1e-10 && cross(r,s,p)*cross(r,s,q)<-1e-10; }));
  for (let iteration=0;iteration<8;iteration++) {
    const bad=new Set();
    for(let i=0;i<loops.length;i++) for(let j=i+1;j<loops.length;j++) if(intersects(result[i],result[j]) || pointIn(result[i][0],result[j])!==pointIn(loops[i][0],loops[j]) || pointIn(result[j][0],result[i])!==pointIn(loops[j][0],loops[i])) {bad.add(i);bad.add(j);}
    if(!bad.size)break;
    for(const i of bad)result[i]=simplifyLoop(loops[i],iteration===7?0:tolerance/Math.pow(2,iteration+1));
  }
  return result;
}
/** Pixel-boundary tracing retains every hole and disconnected island, without
 * decimating the mask. Right turns disambiguate pixels that touch at a corner. */
export function traceMask(mask, width, height, tolerance = 0) {
  dimensions(width, height); if (mask.length !== width * height) throw Error('Mask sizes do not match.');
  const edges = [], starts = new Map(), stride = width + 1;
  const add = (x, y, xx, yy, d) => { const key = y * stride + x, index = edges.length; edges.push({ a: [x, y], b: [xx, yy], d, used: false }); if (!starts.has(key)) starts.set(key, []); starts.get(key).push(index); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) {
    if (!y || !mask[(y - 1) * width + x]) add(x, y, x + 1, y, 0);
    if (x === width - 1 || !mask[y * width + x + 1]) add(x + 1, y, x + 1, y + 1, 1);
    if (y === height - 1 || !mask[(y + 1) * width + x]) add(x + 1, y + 1, x, y + 1, 2);
    if (!x || !mask[y * width + x - 1]) add(x, y + 1, x, y, 3);
  }
  const loops = [];
  for (const first of edges) if (!first.used) {
    const loop = []; let edge = first;
    while (edge && !edge.used) {
      edge.used = true; loop.push(edge.a);
      if (edge.b[0] === first.a[0] && edge.b[1] === first.a[1]) break;
      const candidates = (starts.get(edge.b[1] * stride + edge.b[0]) || []).map(i => edges[i]).filter(e => !e.used), previous = edge.d;
      edge = candidates.sort((a, b) => [1, 0, 3, 2].indexOf((a.d - previous + 4) % 4) - [1, 0, 3, 2].indexOf((b.d - previous + 4) % 4))[0];
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return simplifyTopology(loops, tolerance);
}

/** Typed pixel masks retain the authoritative vector definition. History keeps
 * both together, including boolean operations and exact authored corners. */
function maskSignature(mask) { let hash = 0; for (let i = 0; i < mask.length; i++) if (mask[i]) hash = (hash + Math.imul(i + 1, 2654435761)) | 0; return hash; }
function attachShape(mask, shape) { Object.defineProperty(mask, 'forgeShape', { value: shape, configurable: true }); Object.defineProperty(mask, 'forgeSignature', { value: maskSignature(mask), configurable: true }); return mask; }
export function cropContour(kind, start, end, detail = 0) {
  let x = Math.min(start[0], end[0]), y = Math.min(start[1], end[1]), w = Math.abs(end[0] - start[0]), h = Math.abs(end[1] - start[1]);
  if (kind === 'Square' || kind === 'Circle') { const side = Math.min(w, h); x = end[0] < start[0] ? start[0] - side : start[0]; y = end[1] < start[1] ? start[1] - side : start[1]; w = h = side; }
  if (kind === 'Circle') { const count = 16 + Math.floor(detail * .32); return Array.from({ length: count }, (_, i) => { const a = i / count * Math.PI * 2; return [x + w / 2 + Math.cos(a) * w / 2, y + h / 2 + Math.sin(a) * h / 2]; }); }
  if (kind === 'Triangle') return [[x + w / 2, y], [x + w, y + h], [x, y + h]];
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
export function cropMask(width, height, kind, start, end) {
  const result = polygonMask(width, height, cropContour(kind, start, end, 100));
  if (kind === 'Circle' || kind === 'Square') { const points = cropContour(kind, start, end, 100); start = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))]; end = [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]; }
  return attachShape(result, { type: 'crop', kind, start: [...start], end: [...end], width, height });
}
function shapeContours(shape, detail, toleranceMultiplier = 1) {
  const dimension = Math.max(shape.width, shape.height);
  if (shape.type === 'boolean') return booleanContours(shapeContours(shape.a, detail, toleranceMultiplier), shapeContours(shape.b, detail, toleranceMultiplier), shape.operation, dimension);
  if (shape.type === 'raster') return traceMask(shape.mask, shape.width, shape.height, dimension * (.012 - detail * .00009) * toleranceMultiplier);
  const points = shape.type === 'crop' ? cropContour(shape.kind, shape.start, shape.end, detail) : shape.points;
  return booleanContours([area(points) < 0 ? [...points].reverse() : points], [], 'add', dimension);
}
function surface(contours, width, height, detail, size, thickness, offset = 0, isTrim = false, sharedContours = []) {
  const { points, triangles } = triangulateContours(contours, Math.max(width, height), detail, { support: !isTrim });
  if (!triangles.length) throw Error('The cutout is empty. Keep or add part of the image first.');
  const scale = size / Math.max(width, height), vertices = [], uv = [], faces = [];
  const put = (p, z, texture = [p[0] / width, p[1] / height]) => { const i = vertices.length / 3; vertices.push((p[0] - width / 2) * scale, (height / 2 - p[1]) * scale, z); uv.push(...texture); return i; };
  points.forEach(p => put(p, offset + thickness / 2));
  for (const [a, b, c] of triangles) { const sign = (points[b][0] - points[a][0]) * (points[c][1] - points[a][1]) - (points[b][1] - points[a][1]) * (points[c][0] - points[a][0]); faces.push(...(sign > 0 ? [a, c, b] : [a, b, c])); }
  if (thickness > 0) {
    const n = points.length; points.forEach(p => put(p, offset - thickness / 2)); const front = [...faces];
    for (let i = 0; i < front.length; i += 3) faces.push(front[i] + n, front[i + 2] + n, front[i + 1] + n);
    const boundary = new Map();
    for (let i = 0; i < front.length; i += 3) for (let k = 0; k < 3; k++) { const a = front[i + k], b = front[i + (k + 1) % 3], key = a < b ? a + ':' + b : b + ':' + a; if (boundary.has(key)) boundary.delete(key); else boundary.set(key, [a, b]); }
    // Unwrap each closed wall as a continuous strip. Caps keep their hard seam;
    // adjacent walls share vertices and only the strip closing seam duplicates.
    const outgoing = new Map([...boundary.values()].map(edge => [edge[0], edge[1]]));
    while (outgoing.size) {
      const first = outgoing.keys().next().value, loop = [first]; let p = first;
      do { const next = outgoing.get(p); outgoing.delete(p); if (next === undefined) break; loop.push(next); p = next; } while (p !== first && outgoing.has(p));
      // Matching body/frame depths form one assembled solid: their cap edges
      // meet directly, so an internal wall would add hidden duplicate faces.
      if (sharedContours.length && loop.every(id => sharedContours.some(contour => contour.some((a, i) => segmentDistance(points[id], a, contour[(i + 1) % contour.length]) < Math.max(width, height) * 2e-6)))) continue;
      let distance = 0; const wall = [];
      for (let i = 0; i < loop.length; i++) { if (i) distance += Math.hypot(points[loop[i]][0] - points[loop[i - 1]][0], points[loop[i]][1] - points[loop[i - 1]][1]) * scale; wall.push([put(points[loop[i]], offset + thickness / 2, [distance / size, 0]), put(points[loop[i]], offset - thickness / 2, [distance / size, thickness / size])]); }
      for (let i = 0; i + 1 < wall.length; i++) { const [aa, dd] = wall[i], [bb, cc] = wall[i + 1]; faces.push(aa, cc, bb, aa, dd, cc); }
    }
  }
  if (vertices.length / 3 > 65536) throw Error('This detail exceeds the WC3 vertex limit. Reduce Detail or clean small speckles.');
  const result = { Vertices: new Float32Array(vertices), TVertices: [new Float32Array(uv)], Faces: new Uint16Array(faces) }; recalculateNormals(result); return result;
}
export function buildForgeMesh({ mask, width, height, detail = 35, size = 100, thickness = 0, trim = false, trimWidth = 3, trimThickness = 1, trimOffset = 0, trimHoles = true }) {
  dimensions(width, height); if (!mask || mask.length !== width * height) throw Error('Mask sizes do not match.'); finite(detail, 'Detail'); if (detail > 100) throw Error('Detail is outside the allowed range.'); finite(size, 'Size', .0001); finite(thickness, 'Thickness'); finite(trimWidth, 'Trim width', .0001); finite(trimThickness, 'Trim thickness'); if (!Number.isFinite(trimOffset)) throw Error('Trim offset is outside the allowed range.');
  const dimension = Math.max(width, height), shape = mask.forgeShape && mask.forgeSignature === maskSignature(mask) ? mask.forgeShape : { type: 'raster', mask, width, height };
  const contours = shapeContours(shape, detail);
  const sharedContours = trim && thickness > 0 && thickness === trimThickness && trimOffset === 0 ? contours.filter(loop => trimHoles || area(loop) > 0) : [];
  const body = surface(contours, width, height, detail, size, thickness, 0, false, sharedContours), geosets = [body];
  if (trim) {
    const frame = exteriorFrame(contours, trimWidth * dimension / size, trimHoles, dimension);
    if (frame.length) geosets.push(surface(frame, width, height, detail, size, trimThickness, trimOffset, true, sharedContours));
  }
  return { geosets, contours, width, height, size, vertexCount: geosets.reduce((n, g) => n + g.Vertices.length / 3, 0), triangleCount: geosets.reduce((n, g) => n + g.Faces.length / 3, 0) };
}
/** Tangents follow UV derivatives, with an orthonormal fallback for thickness
 * walls whose original-image UVs are necessarily degenerate across depth. */
export function forgeTangents(g) {
  const count = g.Vertices.length / 3, a = new Float64Array(count * 3), b = new Float64Array(count * 3), uv = g.TVertices[0], result = new Float32Array(count * 4);
  for (let i = 0; i < g.Faces.length; i += 3) {
    const [p, q, r] = g.Faces.subarray(i, i + 3), du1 = uv[q * 2] - uv[p * 2], dv1 = uv[q * 2 + 1] - uv[p * 2 + 1], du2 = uv[r * 2] - uv[p * 2], dv2 = uv[r * 2 + 1] - uv[p * 2 + 1], det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    for (let axis = 0; axis < 3; axis++) { const e1 = g.Vertices[q * 3 + axis] - g.Vertices[p * 3 + axis], e2 = g.Vertices[r * 3 + axis] - g.Vertices[p * 3 + axis], tangent = (e1 * dv2 - e2 * dv1) / det, bitangent = (e2 * du1 - e1 * du2) / det; for (const v of [p, q, r]) { a[v * 3 + axis] += tangent; b[v * 3 + axis] += bitangent; } }
  }
  for (let i = 0; i < count; i++) {
    const n = Array.from(g.Normals.subarray(i * 3, i * 3 + 3)), t = Array.from(a.subarray(i * 3, i * 3 + 3)), dot = t.reduce((sum, value, k) => sum + value * n[k], 0); let projected = t.map((v, k) => v - dot * n[k]), length = Math.hypot(...projected);
    if (length < 1e-10) { const axis = Math.abs(n[0]) < .8 ? [1, 0, 0] : [0, 1, 0], d = axis.reduce((sum, value, k) => sum + value * n[k], 0); projected = axis.map((v, k) => v - d * n[k]); length = Math.hypot(...projected) || 1; }
    projected = projected.map(v => v / length); const cross = [n[1] * projected[2] - n[2] * projected[1], n[2] * projected[0] - n[0] * projected[2], n[0] * projected[1] - n[1] * projected[0]], handedness = cross.reduce((sum, value, k) => sum + value * b[i * 3 + k], 0) < 0 ? -1 : 1;
    result.set([...projected, handedness], i * 4);
  }
  return result;
}
/** Resolve the shared role at the moment an operation commits, never in a preview. */
export function ensureDummyBone(model, { weighted = false } = {}) {
  const matches = (model.Bones || []).filter(node => node.Name === 'DummyBone' && Number.isInteger(node.ObjectId));
  if (matches.length > 1) throw Error('More than one DummyBone exists. Rename the extra bone before importing or forging.');
  let bone = matches[0];
  if (bone && model.Nodes?.[bone.ObjectId] !== bone) throw Error('DummyBone has an invalid node reference. Repair the model before importing or forging.');
  if (weighted) {
    const nextId = Math.max(-1, ...(model.Nodes || []).filter(Boolean).map(node => node.ObjectId), (model.PivotPoints?.length || 0) - 1) + 1;
    if ((bone?.ObjectId ?? nextId) > (model.Version >= 1400 ? 65535 : 255)) throw Error('DummyBone object ID exceeds this weighted skin format.');
  }
  if (!bone) { bone = createNode(model, 'Bone'); bone.Name = 'DummyBone'; }
  // A shared anchor cannot inherit the visibility of one part.
  bone.GeosetId = null; bone.GeosetAnimId = null;
  return bone;
}

export function commitForge(model, mesh, { texturePath, trimColor = [0.8, 0.65, 0.3] } = {}) {
  if (!texturePath || !String(texturePath).trim()) throw Error('Choose an image before forging.');
  if (!mesh?.geosets?.length || mesh.geosets.some(g => !g.Faces?.length || g.Vertices.length / 3 > 65536)) throw Error('Generate a valid preview before forging.');
  if (!Array.isArray(trimColor) || trimColor.length !== 3 || trimColor.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw Error('Trim color must contain three values from 0 to 1.');
  const hd = (model.Geosets || []).some(g => g.SkinWeights?.length), extraAssets = [];
  if (hd && model.Version < 900) throw Error('Weighted Forge geometry requires model format 900 or newer.');
  const bone = ensureDummyBone(model, { weighted: hd });
  const pathKey = p => String(p).replaceAll('/', '\\').toLowerCase();
  model.Textures ||= []; model.Materials ||= []; model.Geosets ||= []; model.GeosetAnims ||= [];
  let textureId = model.Textures.findIndex(t => pathKey(t.Image) === pathKey(texturePath));
  if (textureId < 0) { textureId = model.Textures.length; model.Textures.push({ Image: texturePath, ReplaceableId: 0, Flags: 0 }); }
  const auxiliary = (name, rgba) => {
    const image = `MDLxL_Forge\\mdlxl-${name}-v1.tga`; let id = model.Textures.findIndex(t => pathKey(t.Image) === pathKey(image));
    if (id < 0) { id = model.Textures.length; model.Textures.push({ Image: image, ReplaceableId: 0, Flags: 0 }); }
    extraAssets.push({ name: image, bytes: encodeForgeTga({ width: 1, height: 1, data: new Uint8Array(rgba) }), source: 'forge' }); return id;
  };
  // HD materials consume distinct diffuse / normal / ORM / emissive slots.
  // Neutral generated maps are portable and never borrow another mesh's surface.
  // Reforged uses inverted tangent-space normals; flat is #7f7f00.
  const normalId = hd ? auxiliary('flat-normal', [127, 127, 0, 255]) : null, ormId = hd ? auxiliary('neutral-orm', [255, 255, 0, 0]) : null, emissiveId = hd ? auxiliary('black-emissive', [0, 0, 0, 255]) : null;
  const material = (diffuse, filterMode) => {
    const layer = id => ({ FilterMode: filterMode, Shading: 16, TextureID: id, TVertexAnimId: null, CoordId: 0, Alpha: 1 });
    if (!hd) return { PriorityPlane: 0, RenderMode: 0, Layers: [layer(diffuse)] };
    if (model.Version >= 1100) return { PriorityPlane: 0, RenderMode: 0, Layers: [{ ...layer(diffuse), ShaderTypeId: 1, NormalTextureID: normalId, ORMTextureID: ormId, EmissiveTextureID: emissiveId }] };
    return { PriorityPlane: 0, RenderMode: 0, Shader: 'Shader_HD_DefaultUnit', Layers: [layer(diffuse), layer(normalId), layer(ormId), layer(emissiveId)] };
  };
  const materialId = model.Materials.length;
  model.Materials.push(material(textureId, 1));
  // White.blp is a stock Warcraft texture, so colored trim has no external asset dependency.
  let trimMaterialId = materialId;
  if (mesh.geosets.length > 1) {
    let white = model.Textures.findIndex(t => pathKey(t.Image) === 'textures\\white.blp');
    if (white < 0) { white = model.Textures.length; model.Textures.push({ Image: 'Textures\\white.blp', ReplaceableId: 0, Flags: 0 }); }
    trimMaterialId = model.Materials.length; model.Materials.push(material(white, 0));
  }
  const geosetIndices = [];
  for (const [i, source] of mesh.geosets.entries()) {
    const index = model.Geosets.length, g = { ...structuredClone(source), VertexGroup: new Uint8Array(source.Vertices.length / 3), Groups: [[bone.ObjectId]], TotalGroupsCount: 1, MaterialID: i ? trimMaterialId : materialId, SelectionGroup: 0, Unselectable: false, Anims: [] };
    // The codec's missing-LOD default becomes -1 on MDX save; the native
    // renderer displays LOD0. Preserve Forge visibility across reopening.
    if (model.Version >= 900) g.LevelOfDetail = 0;
    if (hd) { g.SkinWeights = new (model.Version >= 1400 ? Uint16Array : Uint8Array)(g.Vertices.length / 3 * 8); for (let v = 0; v < g.Vertices.length / 3; v++) g.SkinWeights.set([bone.ObjectId, 0, 0, 0, 255, 0, 0, 0], v * 8); g.Tangents = forgeTangents(g); }
    model.Geosets.push(g); geosetIndices.push(index);
    if (i) model.GeosetAnims.push({ GeosetId: index, Flags: 2, Alpha: 1, Color: rgbToWarcraftColor(trimColor) });
  }
  recalculateExtents(model);
  for (const i of geosetIndices) model.Geosets[i].Anims = (model.Sequences || []).map(() => ({ MinimumExtent: model.Geosets[i].MinimumExtent.slice(), MaximumExtent: model.Geosets[i].MaximumExtent.slice(), BoundsRadius: model.Geosets[i].BoundsRadius }));
  if (model.Info) { model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims.length; model.Info.NumBones = model.Bones.length; }
  return { geosetIndices, boneId: bone.ObjectId, textureId, extraAssets };
}
