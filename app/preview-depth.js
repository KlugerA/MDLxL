/** Small software depth surface for canvas-only editor overlays. NDC depth is
 * affine across a projected triangle, including perspective projections. */
export const needsSolidDepthPrepass = mode => mode === 'wireframe' || mode === 'vertices';

export function createOverlayDepth(geosets, width, height, resolution = 384) {
  const scale = Math.min(1, resolution / Math.max(width, height));
  const w = Math.max(1, Math.ceil(width * scale)), h = Math.max(1, Math.ceil(height * scale));
  const depth = new Float32Array(w * h); depth.fill(Infinity);
  for (const { faces, points } of geosets) for (let i = 0; i + 2 < faces.length; i += 3) {
    const a = points[faces[i]], b = points[faces[i + 1]], c = points[faces[i + 2]];
    if (!a?.visible || !b?.visible || !c?.visible) continue;
    const ax = a.x * scale, ay = a.y * scale, bx = b.x * scale, by = b.y * scale, cx = c.x * scale, cy = c.y * scale;
    const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(area) < 1e-8) continue;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const u = ((by - cy) * (x + .5 - cx) + (cx - bx) * (y + .5 - cy)) / area;
      const v = ((cy - ay) * (x + .5 - cx) + (ax - cx) * (y + .5 - cy)) / area;
      if (u < 0 || v < 0 || u + v > 1) continue;
      const z = u * a.z + v * b.z + (1 - u - v) * c.z, index = y * w + x;
      if (z < depth[index]) depth[index] = z;
    }
  }
  return {
    isOccluded(point) {
      const x = Math.floor(point.x * scale), y = Math.floor(point.y * scale);
      if (x < 0 || x >= w || y < 0 || y >= h) return false;
      // The nearest four samples reduce silhouette false positives. Bias is
      // deliberately limited to this cosmetic overlay, never mesh geometry.
      let behind = 0, covered = 0;
      for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) {
        const xx = Math.min(w - 1, x + ox), yy = Math.min(h - 1, y + oy), z = depth[yy * w + xx];
        if (Number.isFinite(z)) { covered++; if (point.z > z + .002) behind++; }
      }
      return covered >= 2 && behind === covered;
    },
  };
}
