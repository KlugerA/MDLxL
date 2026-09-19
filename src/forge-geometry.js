/** Vector cutouts, bounded exterior offsets, and constrained mesh refinement.
 * Coordinates stay in source-image space until the final mesh conversion. */
import ClipperLib from 'clipper-lib';
import { ShapeUtils, Vector2 } from 'three';

export const signedArea = loop => loop.reduce((sum, p, i) => { const q = loop[(i + 1) % loop.length]; return sum + p[0] * q[1] - p[1] * q[0]; }, 0) / 2;
export const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function pointInside(p, loop) { let yes = false; for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) { const a = loop[i], b = loop[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes; } return yes; }
const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const segmentDistance = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

export function booleanContours(subject, clip, operation, dimension) {
  const scale = 1048576 / dimension, paths = loops => loops.map(loop => loop.map(([x, y]) => ({ X: Math.round(x * scale), Y: Math.round(y * scale) })));
  const worker = new ClipperLib.Clipper(ClipperLib.Clipper.ioStrictlySimple), result = [];
  worker.AddPaths(paths(subject), ClipperLib.PolyType.ptSubject, true);
  worker.AddPaths(paths(clip), ClipperLib.PolyType.ptClip, true);
  worker.Execute({ keep: ClipperLib.ClipType.ctIntersection, add: ClipperLib.ClipType.ctUnion, remove: ClipperLib.ClipType.ctDifference, subtract: ClipperLib.ClipType.ctDifference, invert: ClipperLib.ClipType.ctDifference }[operation] ?? ClipperLib.ClipType.ctUnion, result, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return result.map(loop => loop.map(p => [p.X / scale, p.Y / scale])).filter(loop => Math.abs(signedArea(loop)) > dimension * dimension * 1e-14);
}

export function exteriorFrame(contours, radius, includeHoles, dimension) {
  const scale = 1048576 / dimension;
  const offset = (loops, distance) => {
    const worker = new ClipperLib.ClipperOffset(2, .01 * scale), result = [];
    worker.AddPaths(loops.map(loop => loop.map(([x, y]) => ({ X: Math.round(x * scale), Y: Math.round(y * scale) }))), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    worker.Execute(result, distance * scale);
    return result.map(loop => loop.map(p => [p.X / scale, p.Y / scale]));
  };
  const outer = contours.filter(loop => signedArea(loop) > 0);
  let frame = [];
  for (const loop of outer) frame = booleanContours(frame, booleanContours(offset([loop], radius), [loop], 'remove', dimension), 'add', dimension);
  if (includeHoles) for (const hole of contours.filter(loop => signedArea(loop) < 0)) {
    const positive = [...hole].reverse(); let inset = [], width = radius;
    // Keep an intended hole even when the requested border is wider than it.
    for (let attempt = 0; attempt < 16 && !inset.length; attempt++, width /= 2) inset = offset([positive], -width);
    if (inset.length) frame = booleanContours(frame, booleanContours([positive], inset, 'remove', dimension), 'add', dimension);
  }
  // Overlapping component frames are unioned, then all textured body area is removed.
  return booleanContours(frame, contours, 'remove', dimension);
}

export function polygonGroups(contours) {
  const groups = contours.filter(loop => signedArea(loop) > 0).map(outer => ({ outer, holes: [], area: signedArea(outer) }));
  for (const hole of contours.filter(loop => signedArea(loop) < 0)) {
    const owner = groups.filter(p => pointInside(hole[0], p.outer)).sort((a, b) => a.area - b.area)[0];
    if (owner) owner.holes.push(hole);
  }
  return groups;
}

function triangleQuality(points, face) {
  const [a, b, c] = face.map(i => points[i]), aa = length(b, c), bb = length(c, a), cc = length(a, b);
  if (Math.min(aa, bb, cc) < 1e-12) return 0;
  const angle = (a, b, c) => Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b))));
  return Math.min(angle(aa, bb, cc), angle(bb, cc, aa), angle(cc, aa, bb));
}

/** Flip only unconstrained convex interior diagonals, maximizing the weaker
 * triangle's minimum angle. Perimeter/hole edges can never be crossed. */
function improveDiagonals(points, triangles) {
  for (let pass = 0; pass < 24; pass++) {
    const edges = new Map(), touched = new Set(); let changed = false;
    for (let i = 0; i < triangles.length; i++) for (let k = 0; k < 3; k++) {
      if (touched.has(i)) break;
      const t = triangles[i], a = t[k], b = t[(k + 1) % 3], key = edgeKey(a, b);
      if (!edges.has(key)) { edges.set(key, { i, a, b, c: t[(k + 2) % 3] }); continue; }
      const old = edges.get(key), c = old.c, d = t[(k + 2) % 3];
      if (old.i === i || touched.has(old.i) || !triangles[old.i].includes(a) || !triangles[old.i].includes(b)) continue;
      if (cross(points[c], points[d], points[a]) * cross(points[c], points[d], points[b]) >= -1e-14 || cross(points[a], points[b], points[c]) * cross(points[a], points[b], points[d]) >= -1e-14) continue;
      const next = [[c, d, a], [d, c, b]], quality = Math.min(...next.map(f => triangleQuality(points, f)));
      if (quality > Math.min(triangleQuality(points, triangles[old.i]), triangleQuality(points, t)) + 1e-7) {
        triangles[old.i] = next[0]; triangles[i] = next[1]; touched.add(old.i); touched.add(i); changed = true;
        // Rebuild adjacency after each pass; stale entries must not be reused.
        edges.delete(key); break;
      }
    }
    if (!changed) break;
  }
}

function insertPoint(points, triangles, point, epsilon) {
  if (points.some(p => length(p, point) < epsilon)) return false;
  const found = [];
  for (let i = 0; i < triangles.length; i++) {
    const f = triangles[i], s = [cross(points[f[0]], points[f[1]], point), cross(points[f[1]], points[f[2]], point), cross(points[f[2]], points[f[0]], point)];
    if (s.every(v => v > epsilon * epsilon) || s.every(v => v < -epsilon * epsilon)) { found.push(i); break; }
    // Lattice samples on an interior diagonal are inserted conformingly in both faces.
    if (s.every(v => v >= -epsilon * epsilon) || s.every(v => v <= epsilon * epsilon)) found.push(i);
  }
  if (!found.length) return false;
  const n = points.length; points.push(point);
  for (let j = found.length - 1; j >= 0; j--) {
    const face = triangles[found[j]], next = [];
    for (let k = 0; k < 3; k++) if (Math.abs(cross(points[face[k]], points[face[(k + 1) % 3]], point)) > epsilon * epsilon) next.push([face[k], face[(k + 1) % 3], n]);
    triangles.splice(found[j], 1, ...next);
  }
  return true;
}

function conformEdges(points, triangles, epsilon) {
  // Earcut can omit collinear vertices along a bridged hole or a straight
  // subdivided edge. Reinsert them on every incident triangle before extrusion.
  for (let vertex = 0; vertex < points.length; vertex++) {
    const p = points[vertex];
    for (let i = 0; i < triangles.length; i++) {
      const f = triangles[i]; if (f.includes(vertex)) continue;
      for (let k = 0; k < 3; k++) {
        const a = points[f[k]], b = points[f[(k + 1) % 3]], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
        if (t > 1e-7 && t < 1 - 1e-7 && Math.abs(cross(a, b, p)) < epsilon * Math.sqrt(l2)) {
          triangles.splice(i, 1, [f[k], vertex, f[(k + 2) % 3]], [vertex, f[(k + 1) % 3], f[(k + 2) % 3]]); i++; break;
        }
      }
    }
  }
}

export function triangulateContours(contours, dimension, detail, { support = true } = {}) {
  const spacing = dimension / (2 + detail * .14), loops = contours.map(loop => loop.flatMap((p, i) => {
    const q = loop[(i + 1) % loop.length], divisions = detail > 0 ? Math.max(1, Math.ceil(length(p, q) / spacing)) : 1;
    return Array.from({ length: divisions }, (_, k) => [p[0] + (q[0] - p[0]) * k / divisions, p[1] + (q[1] - p[1]) * k / divisions]);
  }));
  const points = [], triangles = [];
  for (const polygon of polygonGroups(loops)) {
    const start = points.length, outer = polygon.outer.map(p => new Vector2(...p)), holes = polygon.holes.map(loop => loop.map(p => new Vector2(...p)));
    const faces = ShapeUtils.triangulateShape(outer, holes); points.push(...outer.map(p => [p.x, p.y]), ...holes.flatMap(loop => loop.map(p => [p.x, p.y]))); triangles.push(...faces.map(face => face.map(i => i + start)));
  }
  conformEdges(points, triangles, dimension * 1e-9);
  improveDiagonals(points, triangles);
  if (support && detail > 0) {
    const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
    const groups = polygonGroups(loops), inside = p => groups.some(g => pointInside(p, g.outer) && !g.holes.some(h => pointInside(p, h)));
    let row = 0;
    for (let y = minY + spacing * .55; y < maxY; y += spacing * Math.sqrt(3) / 2, row++) for (let x = minX + spacing * (.5 + (row % 2) * .5); x < maxX; x += spacing) {
      const p = [x, y];
      if (inside(p) && !loops.some(loop => loop.some((a, i) => segmentDistance(p, a, loop[(i + 1) % loop.length]) < spacing * .28))) insertPoint(points, triangles, p, dimension * 1e-7);
    }
    improveDiagonals(points, triangles);
  }
  if (support && detail === 0 && points.length > 4) {
    // One support in each broad, poorly triangulated region is often more
    // useful than a fan of long diagonals (especially a circle or star).
    for (let iteration = 0; iteration < 8; iteration++) {
      let inserted = false;
      for (const face of [...triangles].sort((a, b) => triangleQuality(points, a) - triangleQuality(points, b))) {
        if (triangleQuality(points, face) >= Math.PI / 9) break;
        const [a, b, c] = face.map(i => points[i]), d = 2 * cross(a, b, c); if (Math.abs(d) < 1e-10) continue;
        const ab = b.map((v, i) => v - a[i]), ac = c.map((v, i) => v - a[i]), b2 = ab[0] ** 2 + ab[1] ** 2, c2 = ac[0] ** 2 + ac[1] ** 2;
        const p = [a[0] + (ac[1] * b2 - ab[1] * c2) / d, a[1] + (ab[0] * c2 - ac[0] * b2) / d];
        if (points.some(q => length(p, q) < dimension * .09) || loops.some(loop => loop.some((a, i) => segmentDistance(p, a, loop[(i + 1) % loop.length]) < dimension * .025))) continue;
        const groups = polygonGroups(loops); if (!groups.some(g => pointInside(p, g.outer) && !g.holes.some(h => pointInside(p, h)))) continue;
        if (insertPoint(points, triangles, p, dimension * 1e-7)) { improveDiagonals(points, triangles); inserted = true; break; }
      }
      if (!inserted) break;
    }
  }
  conformEdges(points, triangles, dimension * 1e-9);
  return { points, triangles: triangles.filter(f => Math.abs(cross(...f.map(i => points[i]))) > dimension * dimension * 1e-14) };
}
