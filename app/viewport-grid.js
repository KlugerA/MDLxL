import { Group, CustomBlending, SrcAlphaFactor, OneMinusSrcAlphaFactor } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { gridOptions, visualOptions } from '../src/preferences.js';

export function gridSegments(preferences, workplane = 'xy', showGrid = true, showAxes = true) {
  const grid = gridOptions(preferences), visual = visualOptions(preferences), segments = [];
  const planes = Object.keys(grid.planes).filter(key => grid.planes[key]);
  // Bound generated geometry while retaining the requested extent.
  const stride = Math.max(1, Math.ceil(grid.extent / grid.spacing / 2048));
  const spacing = grid.spacing * stride, count = Math.floor(grid.extent / spacing);
  if (showGrid) for (const plane of planes) {
    const axes = plane === 'yz' ? [1, 2] : plane === 'xz' ? [0, 2] : [0, 1];
    for (let i = -count; i <= count; i++) for (const axis of [0, 1]) {
      const a = [0, 0, 0], b = [0, 0, 0], major = i % grid.majorEvery === 0;
      if (!major && grid.small === false) continue;
      a[axes[axis]] = -grid.extent; b[axes[axis]] = grid.extent;
      a[axes[1 - axis]] = b[axes[1 - axis]] = i * spacing;
      segments.push({ a, b, color: major ? visual.gridMajor : visual.gridMinor, opacity: major ? grid.majorOpacity : grid.opacity, width: visual.lineWidth * (major ? 1.4 : 1) });
    }
  }
  if (showAxes) for (let axis = 0; axis < 3; axis++) if (grid.axes[['x', 'y', 'z'][axis]]) {
    const a = [0, 0, 0], b = [0, 0, 0]; a[axis] = -grid.extent; b[axis] = grid.extent;
    segments.push({ a, b, color: visual[['axisX', 'axisY', 'axisZ'][axis]], opacity: 1, width: 3, kind: 'axis' });
  }
  return segments;
}

export function createViewportGrid() {
  const group = new Group(); let key;
  group.update = (preferences, workplane, showGrid, showAxes, width = 1, height = 1) => {
    const next = JSON.stringify([gridOptions(preferences), visualOptions(preferences), workplane, showGrid, showAxes]);
    for (const item of group.children) item.material.resolution.set(Math.max(1, width), Math.max(1, height));
    if (next === key) return; key = next; group.dispose();
    const batches = new Map();
    for (const line of gridSegments(preferences, workplane, showGrid, showAxes)) {
      const id = `${line.color}|${line.opacity}|${line.width}`;
      if (!batches.has(id)) batches.set(id, { ...line, positions: [] });
      batches.get(id).positions.push(...line.a, ...line.b);
    }
    for (const item of batches.values()) {
      const geometry = new LineSegmentsGeometry().setPositions(item.positions);
      // This is an editor background aid: draw before the model so opaque
      // silhouettes remain clear even when a mesh straddles the grid plane.
      // Custom blending keeps line opacity while remaining in the opaque queue.
      const material = new LineMaterial({ color: item.color, opacity: item.opacity, transparent: false, blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor, linewidth: item.width, worldUnits: false, depthTest: true, depthWrite: false });
      material.resolution.set(Math.max(1, width), Math.max(1, height));
      const lines = new LineSegments2(geometry, material); lines.computeLineDistances(); lines.frustumCulled = false; lines.renderOrder = -2; group.add(lines);
    }
  };
  group.dispose = () => { for (const item of group.children) { item.geometry.dispose(); item.material.dispose(); } group.clear(); };
  return group;
}
