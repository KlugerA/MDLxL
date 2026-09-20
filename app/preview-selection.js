import { Vector3 } from 'three';
import { applySelection, insideTriangle } from './classic-gestures.js';

export function projectPreviewGeosets(geosets, camera, width, height) {
  return geosets.map(geo => ({ ...geo, points: Array.from({ length: geo.vertices.length / 3 }, (_, i) => {
    const p = new Vector3().fromArray(geo.vertices, i * 3).project(camera);
    return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, z: p.z, visible: p.z >= -1 && p.z <= 1 };
  }) }));
}

export function pickPreviewGeoset(geosets, x, y) {
  let result = null, depth = Infinity;
  for (const geo of geosets) for (let i = 0; i < geo.faces.length; i += 3) {
    const ids = Array.from(geo.faces.subarray(i, i + 3)), points = ids.map(id => geo.points[id]);
    if (points.some(p => !p?.visible) || !insideTriangle([x, y], ...points.map(p => [p.x, p.y]))) continue;
    const [a, b, c] = points, area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(area) < 1e-9) continue;
    const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / area;
    const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / area;
    const z = u * a.z + v * b.z + (1 - u - v) * c.z;
    if (z < depth) { depth = z; result = { index: geo.index, ids }; }
  }
  return result;
}

export function selectPreviewVertices(geosets, previous, start, end, selectable) {
  const active = selectable == null ? new Set(geosets.map(geo => geo.index)) : new Set(selectable);
  const permitted = geosets.filter(geo => active.has(geo.index));
  const found = Object.fromEntries([...active].map(index => [index, []]));
  const marquee = Math.hypot(end.x - start.x, end.y - start.y) > 5;
  let closest = 7, nearest = null;
  for (const geo of permitted) geo.points.forEach((p, index) => {
    if (!p.visible) return;
    if (marquee) { if (p.x >= Math.min(start.x, end.x) && p.x <= Math.max(start.x, end.x) && p.y >= Math.min(start.y, end.y) && p.y <= Math.max(start.y, end.y)) found[geo.index].push(index); }
    else { const d = Math.hypot(p.x - end.x, p.y - end.y); if (d < closest) { closest = d; nearest = [geo.index, index]; } }
  });
  if (nearest) found[nearest[0]].push(nearest[1]);
  else if (!marquee) { const hit = pickPreviewGeoset(permitted, end.x, end.y); if (hit) found[hit.index].push(...hit.ids); }
  const next = start.shift || start.ctrl ? { ...previous } : {};
  for (const index of active) next[index] = applySelection(Array.from(previous?.[index] || []), found[index] || [], start);
  return next;
}
