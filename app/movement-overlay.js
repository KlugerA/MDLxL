import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from '../src/animation.js';
import { movementNodeCategories } from './preview-overlays.js';
import { samplePreviewMatrices } from './preview-pose.js';
import { visualOptions } from '../src/preferences.js';
import { boneHighlightColors, markerStyle } from './rig-markers-gl.js';
import { drawPixelLine } from './pixel-lines.js';

const COLORS = { X: '#fa4343', Y: '#34cf59', Z: '#3588ff' };
const AXES = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const WORKPLANE_NORMALS = { xy: 'Z', xz: 'Y', zx: 'Y', yz: 'X' };
export const MOVEMENT_GIZMO_SCALE = 1;
export function projectMovementNodes(model, frame, sequenceIndex, camera, width, height, globalTime = frame, suppliedMatrices) {
  const matrices = suppliedMatrices || samplePreviewMatrices(model, frame, sequenceIndex, globalTime, camera);
  const lightIds = new Set((model.Lights || []).map(node => node.ObjectId));
  const categories = movementNodeCategories(model);
  return allNodes(model).map(node => {
    const world = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]);
    const matrix = matrices.get(node.ObjectId); if (matrix) world.applyMatrix4(matrix);
    const screen = world.clone().project(camera);
    const rotation = new Quaternion(); matrix?.decompose(new Vector3(), rotation, new Vector3());
    const rgb = lightIds.has(node.ObjectId) ? sampleTrack(node.Color, frame, { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime, fallback: [1, 1, 1] }) : null;
    const displayColor = rgb ? `rgb(${Array.from(rgb, value => Math.round(Math.max(0, Math.min(1, value)) * 255)).join(',')})` : null;
    const refNode = (model.Attachments || []).some(item => item.ObjectId === node.ObjectId);
    const helperNode = (model.Helpers || []).some(item => item.ObjectId === node.ObjectId);
    const eventNode = (model.EventObjects || []).some(item => item.ObjectId === node.ObjectId);
    const unit = camera.isPerspectiveCamera ? 2 * world.distanceTo(camera.position) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / height : (camera.top - camera.bottom) / camera.zoom / height;
    const tetrahedron = refNode ? [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map(vertex => { const p = new Vector3(...vertex).multiplyScalar(unit * 5).add(world).project(camera); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }; }) : null;
    return { node, world, rotation, displayColor, tetrahedron, refNode, helperNode, eventNode, unitsPerPixel: unit, overlayKind: categories.get(node.ObjectId) || 'nodes', x: (screen.x + 1) * width / 2, y: (1 - screen.y) * height / 2, visible: screen.z >= -1 && screen.z <= 1 };
  });
}

export function movementAxisHandles(active, camera, width, height, radius, space = 'local', mode = 'rotate') {
  if (!active?.visible) return [];
  // Keep handles a consistent size at different camera distances and zooms.
  const distance = camera.isPerspectiveCamera ? active.world.distanceTo(camera.position) : radius * 2.6;
  const unit = camera.isPerspectiveCamera ? 2 * distance * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / height : (camera.top - camera.bottom) / camera.zoom / height;
  return Object.entries(AXES).map(([axis, values]) => {
    const direction = new Vector3().fromArray(values);
    if (space === 'local' && mode !== 'scale') direction.applyQuaternion(active.rotation);
    const end = active.world.clone().addScaledVector(direction, unit * 68 * MOVEMENT_GIZMO_SCALE).project(camera);
    let dx = (end.x + 1) * width / 2 - active.x, dy = (1 - end.y) * height / 2 - active.y;
    // An axis facing the camera still gets a usable short handle.
    if (Math.hypot(dx, dy) < 18 * MOVEMENT_GIZMO_SCALE) { dx = axis === 'Z' ? 0 : axis === 'X' ? 25 * MOVEMENT_GIZMO_SCALE : -25 * MOVEMENT_GIZMO_SCALE; dy = axis === 'Z' ? -25 * MOVEMENT_GIZMO_SCALE : 25 * MOVEMENT_GIZMO_SCALE; }
    return { axis, color: COLORS[axis], x: active.x + dx, y: active.y + dy, startX: active.x, startY: active.y, dx, dy, unitsPerPixel: unit };
  });
}

export function drawMovementOverlay(context, nodes, selectedIds, handles, width, height, ratio = 1, options = { bones: true, nodes: true, attachments: true, particles: true, boneLines: true }) {
  context.clearRect(0, 0, width * ratio, height * ratio);
  context.save(); context.scale(ratio, ratio);
  const selected = new Set(selectedIds), byId = new Map(nodes.map(point => [point.node.ObjectId, point])), highlights = boneHighlightColors(nodes, selectedIds);
  const visual = visualOptions(options.preferences), boxSize = visual.helperSize * 3;
  for (const point of nodes) {
    const parent = byId.get(point.node.Parent);
    if (!options.boneLines) continue;
    if (!point.visible || !parent?.visible) continue;
    const line = boneConnectionEndpoints(parent, point, visual.helperSize);
    if (!line) continue;
    const appearance = boneConnectionAppearance(parent, point, highlights);
    drawPixelLine(context, line.from, line.to, {
      color: appearance || (progress => { const shade = Math.round(progress * 255); return `rgb(${shade},${shade},${shade})`; }),
      width: appearance ? 6 : 3, ratio,
    });
  }
  for (const point of nodes) if (point.visible && options[point.overlayKind || 'nodes']) {
    const isSelected = selected.has(point.node.ObjectId), emitter = (point.node.Flags & 4096) !== 0;
    const bone = point.overlayKind === 'bones';
    context.fillStyle = point.displayColor || (bone ? highlights.get(point.node.ObjectId) || (byId.get(point.node.Parent)?.overlayKind === 'bones' ? '#4cff59' : '#4cb259') : emitter || point.overlayKind === 'particles' ? visual.particle : point.eventNode ? visual.event : visual.node);
    context.strokeStyle = isSelected ? '#fff14e' : '#17263d'; context.lineWidth = isSelected ? 2.5 : 1.5;
    context.beginPath();
    if (options.glMarkers) { /* Shape rendering shares the mesh's actual GL depth. */ }
    else if (bone || point.helperNode) context.rect(point.x - boxSize / 2, point.y - boxSize / 2, boxSize, boxSize);
    else if (point.tetrahedron) { for (const face of [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) { const [a, b, c] = face.map(index => point.tetrahedron[index]); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.lineTo(a.x, a.y); } }
    else if (emitter) context.rect(point.x - 4.5, point.y - 4.5, 9, 9);
    else context.arc(point.x, point.y, isSelected ? 5 : 4, 0, Math.PI * 2);
    context.fill(); context.stroke();
    if (isSelected) {
      context.font = '11px Tahoma, sans-serif'; context.lineWidth = 3; context.strokeStyle = '#17263d';
      context.strokeText(point.node.Name || `Node ${point.node.ObjectId}`, point.x + 8, point.y - 8);
      context.fillStyle = '#fff'; context.fillText(point.node.Name || `Node ${point.node.ObjectId}`, point.x + 8, point.y - 8);
    }
  }
  for (const handle of handles) {
    context.beginPath(); context.moveTo(handle.startX, handle.startY); context.lineTo(handle.x, handle.y);
    context.strokeStyle = '#162137'; context.lineWidth = 5; context.stroke();
    context.strokeStyle = handle.color; context.lineWidth = 3; context.stroke();
    context.beginPath(); context.arc(handle.x, handle.y, 10, 0, Math.PI * 2); context.fillStyle = handle.color; context.fill();
    context.lineWidth = 1; context.strokeStyle = '#162137'; context.stroke();
    context.font = 'bold 11px Tahoma, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#fff'; context.fillText(handle.axis, handle.x, handle.y);
  }
  context.restore();
}

function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = list => { const out = []; for (const point of list) { while (out.length > 1 && cross(out.at(-2), out.at(-1), point) <= 0) out.pop(); out.push(point); } return out; };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}

/** Connectors occupy their own pixel layer below mesh wires and point overlays.
 * Remove only the projected polyhedron footprints so GL markers remain in front. */
export function drawBoneConnectors(context, nodes, selectedIds, camera, width, height, ratio = 1, options = {}) {
  context.clearRect(0, 0, width * ratio, height * ratio);
  if (!options.boneLines) return;
  const byId = new Map(nodes.map(point => [point.node.ObjectId, point]));
  const highlights = boneHighlightColors(nodes, selectedIds);
  for (const point of nodes) {
    const parent = byId.get(point.node.Parent);
    if (!point.visible || !parent?.visible) continue;
    const line = boneConnectionEndpoints(parent, point);
    if (!line) continue;
    const appearance = boneConnectionAppearance(parent, point, highlights);
    drawPixelLine(context, line.from, line.to, {
      color: appearance || (progress => { const shade = Math.round(progress * 255); return `rgb(${shade},${shade},${shade})`; }),
      width: appearance ? 6 : 3, ratio,
    });
  }
  const size = visualOptions(options.preferences).helperSize * 1.5;
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalCompositeOperation = 'destination-out';
  for (const point of nodes) {
    if (!point.visible || !options[point.overlayKind || 'nodes']) continue;
    const shape = markerStyle(point, byId, options.preferences, highlights).shape;
    const hull = convexHull(shape.vertices.map(vertex => {
      const p = new Vector3(...vertex).multiplyScalar(point.unitsPerPixel * size).applyQuaternion(point.rotation).add(point.world).project(camera);
      return { x: (p.x + 1) * width * ratio / 2, y: (1 - p.y) * height * ratio / 2 };
    }));
    if (hull.length < 3) continue;
    const minY = Math.max(0, Math.floor(Math.min(...hull.map(p => p.y))));
    const maxY = Math.min(Math.ceil(height * ratio), Math.ceil(Math.max(...hull.map(p => p.y))));
    for (let y = minY; y <= maxY; y++) {
      const crossings = [];
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length], sample = y + .5;
        if (sample >= Math.min(a.y, b.y) && sample < Math.max(a.y, b.y)) crossings.push(a.x + (sample - a.y) * (b.x - a.x) / (b.y - a.y));
      }
      if (crossings.length >= 2) {
        const left = Math.ceil(Math.min(...crossings)), right = Math.floor(Math.max(...crossings));
        if (right >= left) context.fillRect(left, y, right - left + 1, 1);
      }
    }
  }
  context.restore();
}

export function drawAttachGuide(context, nodes, sourceIds, pointer, ratio = 1, time = 0, helperSize = 6) {
  const ids = new Set(Array.isArray(sourceIds) ? sourceIds : [sourceIds]);
  const sources = nodes.filter(point => point.visible && ids.has(point.node.ObjectId));
  if (!sources.length) return;
  context.save(); context.scale(ratio, ratio);
  for (const point of nodes) {
    if (!point.visible || point.overlayKind !== 'bones' || ids.has(point.node.ObjectId)) continue;
    const radius = movementMarkerRadius(point, helperSize);
    context.strokeStyle = '#ffe600'; context.lineWidth = 3;
    context.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  }
  if (pointer) {
    context.strokeStyle = '#ed2626'; context.lineWidth = 3; context.lineCap = 'round';
    context.setLineDash([.1, 8]); context.lineDashOffset = -(time * .035 % 8);
    for (const source of sources) { context.beginPath(); context.moveTo(source.x, source.y); context.lineTo(pointer.x, pointer.y); context.stroke(); }
  }
  context.restore();
}

/** Connect pivots directly, even when their visible markers overlap. */
export function boneConnectionEndpoints(parent, child) {
  if (parent.x === child.x && parent.y === child.y) return null;
  return { from: { x: parent.x, y: parent.y }, to: { x: child.x, y: child.y } };
}

export function movementMarkerRadius(point, helperSize = 6) {
  if (point?.tetrahedron?.length) return Math.max(helperSize * 1.5, ...point.tetrahedron.map(vertex => Math.hypot(vertex.x - point.x, vertex.y - point.y))) + 1;
  // GL cubes and tetrahedrons share corners at (+/-1,+/-1,+/-1).
  if (point?.overlayKind === 'bones' || point?.helperNode || point?.overlayKind === 'attachments' || point?.overlayKind === 'particles' || point?.eventNode) return helperSize * 1.5 * Math.sqrt(3) + 2;
  return Math.max(5, helperSize) + 1;
}

export function pickMovementNode(nodes, x, y, selectedIds = [], threshold = 13) {
  const candidates = nodes.filter(point => point.visible && Math.hypot(point.x - x, point.y - y) <= threshold);
  candidates.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  // Repeated clicks cycle through coincident nodes, so child and emitter pivots
  // remain selectable even when they occupy the same screen position.
  const close = candidates.filter(point => Math.hypot(point.x - x, point.y - y) <= (candidates[0] ? Math.hypot(candidates[0].x - x, candidates[0].y - y) + 2 : 0));
  const current = close.findIndex(point => selectedIds.includes(point.node.ObjectId));
  return close.length ? close[(current + 1) % close.length] : null;
}

export function movementDragAmount(handle, dx, dy, mode, sensitivity = 1) {
  const pixels = (dx * handle.dx + dy * handle.dy) / Math.max(1, Math.hypot(handle.dx, handle.dy)) * sensitivity;
  return mode === 'rotate' ? pixels : mode === 'scale' ? Math.max(.01, Math.exp(pixels / 100)) : pixels * handle.unitsPerPixel;
}

/** Free-space Resize follows the screen gesture: right/up grows and left/down
 * shrinks. Workplane bubbles constrain the two named axes only while Shift is
 * held; otherwise the same gesture is uniform XYZ scaling. */
export function movementFreeScaleValues(dx, dy, { sensitivity = 1, workplaneEnabled = false, workplane = 'xy', shiftKey = false } = {}) {
  const factor = Math.max(.01, Math.exp((Number(dx) - Number(dy)) * Number(sensitivity || 1) / 100));
  const values = [factor, factor, factor];
  if (workplaneEnabled && shiftKey) values[{ xy: 2, xz: 1, zx: 1, yz: 0 }[String(workplane).toLowerCase()] ?? 2] = 1;
  return values;
}

/** Selected-to-descendant links are yellow; the immediate parent-to-selected
 * link is red. Other hierarchy links keep the classic black-to-white fade. */
export function boneConnectionAppearance(parent, child, highlights) {
  const from = highlights?.get(parent?.node?.ObjectId), to = highlights?.get(child?.node?.ObjectId);
  if (to === '#ff0000' && from === '#000000') return '#ff0000';
  if (to === '#ffff00' && (from === '#ff0000' || from === '#ffff00')) return '#ffff00';
  return null;
}

export function movementWorkplaneHandle(workplane = 'xy', unitsPerPixel = 1) {
  const plane = String(workplane).toLowerCase(), vertical = plane === 'xz' || plane === 'zx';
  return { axis: WORKPLANE_NORMALS[plane] || 'Z', dx: vertical ? 0 : 1, dy: vertical ? 1 : 0, unitsPerPixel };
}

/** The projected world-plane basis decides which screen components matter. */
export function movementWorkplanePointer(workplane, dx, dy) {
  return [dx, dy];
}

function pointSegmentDistance(x, y, handle) {
  const dx = handle.x - handle.startX, dy = handle.y - handle.startY, length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((x - handle.startX) * dx + (y - handle.startY) * dy) / length2)) : 0;
  return Math.hypot(x - (handle.startX + dx * t), y - (handle.startY + dy * t));
}

export function pickMovementHandle(handles, x, y, mode, threshold = 10) {
  const distance = handle => mode === 'rotate' ? pointSegmentDistance(x, y, handle) : Math.hypot(handle.x - x, handle.y - y);
  return handles.map(handle => ({ handle, distance: distance(handle) })).filter(hit => hit.distance <= threshold).sort((a, b) => a.distance - b.distance)[0]?.handle || null;
}

export function movementNodeSelection(selectedIds, id, { multiple = false, shift = false, ctrl = false } = {}) {
  const selected = [...new Set(selectedIds || [])];
  if (!multiple) return [id];
  if (ctrl) return selected.filter(value => value !== id);
  if (shift) return selected.includes(id) ? selected : [...selected, id];
  return [id];
}
