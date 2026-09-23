import { Vector3, Vector4, Matrix4 } from 'three';
import { createOverlayDepth } from './preview-depth.js';
import { gridSegments } from './viewport-grid.js';
import { visualOptions, viewportAppearanceOptions } from '../src/preferences.js';
import { previewOverlayGeometry, previewOverlaySettings } from './preview-presentation.js';
import { wireDashArray } from '../src/wire-pattern.js';

export function previewOverlayOptions(overlays, showNodes = false) {
  const markers = !!showNodes;
  return {
    bones: overlays?.bones ?? markers, nodes: overlays?.nodes ?? markers,
    attachments: overlays?.attachments ?? markers, particles: overlays?.particles ?? markers,
    boneLines: overlays?.boneLines ?? true,
    wires: overlays?.wires ?? false, vertices: overlays?.vertices ?? false, grid: overlays?.grid ?? false,
    normals: overlays?.normals ?? false, selectedVerticesOnly: overlays?.selectedVerticesOnly ?? false,
  };
}

export function movementNodeCategories(model) {
  const categories = new Map();
  for (const node of model.Bones || []) categories.set(node.ObjectId, 'bones');
  // MDLVis treats Helpers as part of the editable bone hierarchy. This is
  // especially important for the conventional Helper named Bone_Root: its
  // descendants must participate in parent/child highlighting exactly like
  // nodes stored in the Bone chunk.
  for (const node of model.Helpers || []) categories.set(node.ObjectId, 'bones');
  for (const node of model.Attachments || []) categories.set(node.ObjectId, 'attachments');
  for (const collection of ['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters']) for (const node of model[collection] || []) categories.set(node.ObjectId, 'particles');
  return categories;
}

export const visibleMovementPoints = (points, options) => points.filter(point => options[point.overlayKind || 'nodes']);

function canvasLineStyle(context, appearance) {
  context.lineWidth = appearance.thickness; context.strokeStyle = appearance.color;
  context.setLineDash(wireDashArray(appearance));
  context.lineCap = appearance.style === 'dotted' ? 'round' : 'butt';
}

function markerPath(context, point, appearance) {
  const half = appearance.size / 2, x = Math.round(point.x), y = Math.round(point.y);
  if (appearance.style === 'circle') context.arc(x, y, half, 0, Math.PI * 2);
  else if (appearance.style === 'diamond') { context.moveTo(x, y - half); context.lineTo(x + half, y); context.lineTo(x, y + half); context.lineTo(x - half, y); context.closePath(); }
  else context.rect(Math.round(point.x - half), Math.round(point.y - half), appearance.size, appearance.size);
}

const projected = (camera, width, height, values) => {
  const point = new Vector3().fromArray(values).project(camera);
  return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, z: point.z, visible: point.z >= -1 && point.z <= 1 };
};

/** Clip grid segments to the view volume before dividing by W. A long grid
 * crossing the viewport must remain visible when either endpoint is clipped. */
export function projectGridSegment(camera, width, height, from, to) {
  const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const a = new Vector4(...from, 1).applyMatrix4(matrix), b = new Vector4(...to, 1).applyMatrix4(matrix);
  let low = 0, high = 1;
  for (const axis of ['x', 'y', 'z']) for (const sign of [-1, 1]) {
    const first = a.w + sign * a[axis], last = b.w + sign * b[axis];
    if (first < 0 && last < 0) return null;
    if (first < 0) low = Math.max(low, first / (first - last));
    else if (last < 0) high = Math.min(high, first / (first - last));
  }
  if (low > high) return null;
  return [low, high].map(t => { const p = a.clone().lerp(b, t); return { x: (p.x / p.w + 1) * width / 2, y: (1 - p.y / p.w) * height / 2 }; });
}

/** Cosmetic, posed mesh/grid overlays live outside the clean capture canvas. */
export function drawPreviewGeometryOverlay(context, geosets, camera, width, height, options, center, radius, ratio = 1) {
  context.clearRect(0, 0, width * ratio, height * ratio); context.save(); context.scale(ratio, ratio);
  const visual = visualOptions(options.preferences), appearance = viewportAppearanceOptions(options.preferences);
  const eligible = options.selectableGeosets == null ? null : new Set(options.selectableGeosets);
  const selected = eligible ?? new Set(Number.isInteger(options.selectedGeoset) ? [options.selectedGeoset] : []);
  if (options.grid) for (const line of gridSegments(options.preferences, options.workplane, true, true)) {
    const segment = projectGridSegment(camera, width, height, line.a, line.b);
    if (!segment) continue;
    const [a, b] = segment;
    context.strokeStyle = line.color; context.globalAlpha = line.opacity; context.lineWidth = line.width;
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
  }
  context.globalAlpha = 1;
  if (options.normals) {
    context.beginPath(); context.strokeStyle = '#0000ff'; context.lineWidth = 1;
    for (const geo of geosets.filter(geo => !eligible || eligible.has(geo.index))) for (const [from, to] of normalSegments(geo.vertices, geo.normals, radius * .04)) {
      const segment = projectGridSegment(camera, width, height, from, to); if (!segment) continue;
      context.moveTo(segment[0].x, segment[0].y); context.lineTo(segment[1].x, segment[1].y);
    }
    context.stroke();
  }
  if (options.wires || options.vertices || options.selectedVerticesOnly) {
    const projectedGeosets = geosets.map(({ index, faces, vertices }) => {
      const points = [];
      for (let i = 0; i < vertices.length; i += 3) points.push(projected(camera, width, height, vertices.subarray(i, i + 3)));
      return { index, faces, points };
    });
    const depth = createOverlayDepth(projectedGeosets, width, height);
    if (options.wires) for (const hidden of options.showHiddenWires === false ? [false] : [true, false]) {
      for (const { index, faces, points } of projectedGeosets) {
        const wire = selected.has(index) ? appearance.selectedGeoset : appearance.otherGeoset;
        context.beginPath();
        const seen = new Set();
        for (let i = 0; i < faces.length; i += 3) for (let j = 0; j < 3; j++) {
          const ia = faces[i + j], ib = faces[i + (j + 1) % 3], key = Math.min(ia, ib) + ':' + Math.max(ia, ib);
          if (seen.has(key)) continue; seen.add(key);
          const a = points[ia], b = points[ib]; if (!a?.visible || !b?.visible) continue;
          const count = Math.max(1, Math.min(64, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12)));
          for (let part = 0; part < count; part++) {
            const t = (part + .5) / count, midpoint = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
            if (depth.isOccluded(midpoint) !== hidden) continue;
            context.moveTo(a.x + (b.x - a.x) * part / count, a.y + (b.y - a.y) * part / count);
            context.lineTo(a.x + (b.x - a.x) * (part + 1) / count, a.y + (b.y - a.y) * (part + 1) / count);
          }
        }
        canvasLineStyle(context, wire); context.globalAlpha = wire.opacity * (hidden ? visual.occludedOpacity : 1); context.stroke();
      }
    }
    if (options.vertices) for (const hidden of options.showHiddenVertices ? [true, false] : [false]) {
      context.fillStyle = appearance.unselectedVertex.color; context.globalAlpha = 1;
      context.beginPath();
      for (const { index, points } of projectedGeosets) if (!eligible || eligible.has(index)) for (const point of points) if (point.visible && depth.isOccluded(point) === hidden) {
        markerPath(context, point, appearance.unselectedVertex);
      }
      context.fill();
    }
    if (options.vertices && options.boneVertexColors) for (const color of ['#808080', '#000000']) {
      context.fillStyle = color; context.beginPath();
      for (const { index, points } of projectedGeosets) if (!eligible || eligible.has(index)) {
        for (const [vertex, shade] of options.boneVertexColors.get(index) || []) {
          const point = points[vertex];
          if (shade === color && point?.visible && (options.showHiddenVertices || !depth.isOccluded(point))) markerPath(context, point, appearance.unselectedVertex);
        }
      }
      context.fill();
    }
    context.globalAlpha = 1; context.fillStyle = options.boneVertexColors ? '#ff0000' : appearance.selectedVertex.color; context.beginPath();
    for (const geo of projectedGeosets.filter(geo => !eligible || eligible.has(geo.index))) for (const index of options.selectionByGeoset?.[geo.index] || []) {
      const point = geo.points[index]; if (!point?.visible || !options.showHiddenVertices && depth.isOccluded(point)) continue;
      markerPath(context, point, appearance.selectedVertex);
    }
    context.fill();
  }
  context.globalAlpha = 1; context.setLineDash([]); context.restore();
}

export function normalSegments(vertices, normals, length) {
  if (!normals || normals.length !== vertices.length) return [];
  const out = [];
  for (let i = 0; i < vertices.length; i += 3) {
    const from = Array.from(vertices.subarray(i, i + 3)), direction = new Vector3().fromArray(normals, i);
    if (!direction.lengthSq()) continue;
    const to = direction.normalize().multiplyScalar(Math.max(.001, length)).add(new Vector3(...from)).toArray();
    out.push([from, to]);
  }
  return out;
}

/** Optional preview-only mesh guides. Canvas lines retain their requested
 * screen width on GL implementations that only support one-pixel lines. */
export function drawPresentationOverlay(context, geosets, camera, width, height, options, ratio = 1) {
  const settings = previewOverlaySettings(options), geometry = previewOverlayGeometry(geosets, options);
  context.clearRect(0, 0, width * ratio, height * ratio);
  context.save(); context.scale(ratio, ratio);
  const drawEdges = items => {
    context.beginPath();
    for (const geo of items) for (const [a, b] of geo.edges) {
      const segment = projectGridSegment(camera, width, height, geo.vertices.subarray(a * 3, a * 3 + 3), geo.vertices.subarray(b * 3, b * 3 + 3));
      if (!segment) continue;
      context.moveTo(segment[0].x, segment[0].y); context.lineTo(segment[1].x, segment[1].y);
    }
    context.stroke();
  };
  const drawPoints = (items, size, outline = false) => {
    context.beginPath();
    for (const geo of items) for (const id of geo.pointIndices) {
      const point = projected(camera, width, height, geo.vertices.subarray(id * 3, id * 3 + 3));
      if (point.visible) context.rect(point.x - size / 2, point.y - size / 2, size, size);
    }
    context.fill(); if (outline) context.stroke();
  };
  context.globalAlpha = 1; context.lineWidth = 1.25 * settings.size;
  context.strokeStyle = settings.mode === 'selection' ? settings.color : '#164d85';
  context.fillStyle = settings.mode === 'selection' ? settings.color : '#086fd1';
  drawEdges(geometry); drawPoints(geometry, 5 * settings.size, settings.interactiveSelection);
  if (settings.interactiveSelection) {
    const selected = previewOverlayGeometry(geosets, { ...options, allMesh: false, highlightSelection: true, interactiveSelection: false });
    if (selected.length) {
      context.globalAlpha = .95; context.strokeStyle = settings.color; context.lineWidth = 2 * settings.size; drawEdges(selected);
      context.globalAlpha = 1; context.fillStyle = settings.color; context.strokeStyle = '#fff'; context.lineWidth = Math.max(1, settings.size);
      drawPoints(selected, 8 * settings.size, true);
    }
  }
  context.globalAlpha = 1; context.restore();
  return { points: geometry.reduce((sum, geo) => sum + geo.pointIndices.length, 0), edges: geometry.reduce((sum, geo) => sum + geo.edges.length, 0) };
}
