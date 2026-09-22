/** MDLVis 1.40 frmmain.pas: DoSelect, CheckXYZ, vZoom. */
export function applySelection(previous, found, { shift = false, ctrl = false } = {}) {
  const selected = new Set(shift || ctrl ? previous : []);
  for (const index of found) {
    if (ctrl) selected.delete(index);
    else selected.add(index);
  }
  return [...selected];
}

export function planeAxes(workplane = 'xz') {
  return workplane === 'xy' ? [0, 1] : workplane === 'yz' ? [1, 2] : [0, 2];
}

export function constrainedAxis(workplane = 'xz') {
  return workplane === 'xy' ? 0 : workplane === 'yz' ? 1 : 2;
}

/** Keep a screen-axis latch for one Shift hold. Accumulating only allowed
 * motion lets release/repress continue from the visible position, without
 * restoring the pointer's discarded perpendicular travel. */
export function moveDragPoint(gesture, pointer, shift) {
  if (gesture.shift !== shift) { gesture.shift = shift; gesture.axis = null; }
  const dx = pointer.x - gesture.pointer.x, dy = pointer.y - gesture.pointer.y;
  if (shift && !gesture.axis && (dx || dy)) gesture.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  gesture.point = { ...pointer,
    x: gesture.point.x + (!shift || gesture.axis === 'x' ? dx : 0),
    y: gesture.point.y + (!shift || gesture.axis === 'y' ? dy : 0),
  };
  gesture.pointer = pointer;
  return gesture.point;
}

export function dragScale(horizontalPixels, workplane = 'xz', constrain = false) {
  const factor = Math.max(0, 1 + horizontalPixels / 100);
  if (!constrain) return [factor, factor, factor];
  const scale = [1, 1, 1]; scale[constrainedAxis(workplane)] = factor;
  return scale;
}

/** A marquee can catch any visible part of a vertex marker, not just its center. */
export function marqueeContainsPoint(point, start, end, radius = 0) {
  return point[0] >= Math.min(start.x, end.x) - radius && point[0] <= Math.max(start.x, end.x) + radius && point[1] >= Math.min(start.y, end.y) - radius && point[1] <= Math.max(start.y, end.y) + radius;
}

export function connectedVertices(faces, seeds) {
  const neighbors = new Map();
  for (let i = 0; i + 2 < faces.length; i += 3) {
    const face = [faces[i], faces[i + 1], faces[i + 2]];
    for (const vertex of face) {
      if (!neighbors.has(vertex)) neighbors.set(vertex, new Set());
      for (const neighbor of face) neighbors.get(vertex).add(neighbor);
    }
  }
  const selected = new Set(seeds), queue = [...selected];
  for (let i = 0; i < queue.length; i++) for (const next of neighbors.get(queue[i]) || []) {
    if (!selected.has(next)) { selected.add(next); queue.push(next); }
  }
  return [...selected];
}

export function insideTriangle(point, a, b, c) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-8) return false;
  const u = ((b[0] - point[0]) * (c[1] - point[1]) - (b[1] - point[1]) * (c[0] - point[0])) / area;
  const v = ((c[0] - point[0]) * (a[1] - point[1]) - (c[1] - point[1]) * (a[0] - point[0])) / area;
  const w = 1 - u - v;
  return u >= -1e-7 && v >= -1e-7 && w >= -1e-7;
}
