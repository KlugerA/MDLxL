import { Vector3 } from 'three';
import { applySelection, insideTriangle } from './classic-gestures.js';
import { createOverlayDepth } from './preview-depth.js';

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

/** Pick the UVs of a visible face, or the visible vertex markers when shown.
 * The UV workspace's entry selection is the editing boundary. */
export function selectPreviewUVCoordinates(geosets, previous, start, end, eligibleByGeoset, showVertices, width, height) {
  const allowed = new Map(Object.entries(eligibleByGeoset || {}).map(([index, ids]) => [Number(index), new Set(ids)]));
  const pickable = geosets.filter(geo => allowed.has(geo.index));
  const polygons = showVertices ? [] : pickable.map(geo => {
    const faces = [];
    for (let offset = 0; offset + 2 < geo.faces.length; offset += 3) {
      const ids = Array.from(geo.faces.subarray(offset, offset + 3));
      if (ids.every(id => allowed.get(geo.index).has(id))) faces.push(...ids);
    }
    return { ...geo, faces: new Uint32Array(faces) };
  });
  const found = new Map([...allowed.keys()].map(index => [index, new Set()]));
  const marquee = Math.hypot(end.x - start.x, end.y - start.y) > 5;
  const depth = marquee && !showVertices ? createOverlayDepth(polygons, width, height) : null;
  if (showVertices) {
    let nearest = null, distance = 7;
    for (const geo of pickable) {
      const eligible = allowed.get(geo.index);
      for (const index of eligible) {
        const point = geo.points[index];
        if (!point?.visible) continue;
        if (marquee) {
          if (point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x) && point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y)) found.get(geo.index).add(index);
        } else {
          const next = Math.hypot(point.x - end.x, point.y - end.y);
          if (next < distance) { distance = next; nearest = [geo.index, index]; }
        }
      }
    }
    if (nearest) found.get(nearest[0]).add(nearest[1]);
  } else if (marquee) {
    for (const geo of polygons) {
      for (let offset = 0; offset + 2 < geo.faces.length; offset += 3) {
        const ids = Array.from(geo.faces.subarray(offset, offset + 3));
        const points = ids.map(id => geo.points[id]);
        if (points.some(point => !point?.visible)) continue;
        const center = { x: points.reduce((sum, point) => sum + point.x, 0) / 3, y: points.reduce((sum, point) => sum + point.y, 0) / 3, z: points.reduce((sum, point) => sum + point.z, 0) / 3 };
        if (depth.isOccluded(center) || center.x < Math.min(start.x, end.x) || center.x > Math.max(start.x, end.x) || center.y < Math.min(start.y, end.y) || center.y > Math.max(start.y, end.y)) continue;
        ids.forEach(id => found.get(geo.index).add(id));
      }
    }
  } else {
    const hit = pickPreviewGeoset(polygons, end.x, end.y);
    if (hit && hit.ids.every(id => allowed.get(hit.index)?.has(id))) hit.ids.forEach(id => found.get(hit.index).add(id));
  }
  const next = { ...previous };
  for (const [index, ids] of found) next[index] = applySelection(previous?.[index] || [], ids, start);
  return next;
}
