/** General mesh deformations. Selection is independent of Forge provenance.
 * One shared coordinate box keeps body/trim or multiple selected geosets joined.
 * Call shapeGeosets inside document.apply; previewShape uses independent copies.
 */
import { recalculateNormals, recalculateExtents } from './editor-document.js';
export const SHAPE_TOOLS = ['Bend', 'Warp', 'Dome', 'Wrap', 'Taper'];
export function resolveShapeSelection(model, selectedGeosets, selectionByGeoset = {}) {
  const picked = [...(selectedGeosets || [])].filter(i => model.Geosets?.[i]);
  const hasVertices = picked.some(i => selectionByGeoset[i]?.length);
  return Object.fromEntries(picked.map(i => [i, hasVertices ? [...new Set(selectionByGeoset[i] || [])] : Array.from({ length: model.Geosets[i].Vertices.length / 3 }, (_, j) => j)]).filter(([, ids]) => ids.length));
}
function prepare(model, selection, options) {
  const { tool = 'Bend', axis = 1, amount = 45 } = options;
  if (!SHAPE_TOOLS.includes(tool) || ![0, 1, 2].includes(axis) || !Number.isFinite(amount)) throw Error('Choose a shaping tool, axis and finite amount.');
  if (tool === 'Taper' && amount <= -100) throw Error('Taper must stay above -100% to avoid collapsing vertices.');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; let count = 0;
  for (const [gi, ids] of Object.entries(selection)) {
    const g = model.Geosets?.[gi]; if (!g) throw Error('The selected geoset no longer exists.');
    for (const id of ids) { if (!Number.isInteger(id) || id < 0 || id >= g.Vertices.length / 3) throw Error('Vertex selection is out of range.'); count++; for (let a = 0; a < 3; a++) { const value = g.Vertices[id * 3 + a]; min[a] = Math.min(min[a], value); max[a] = Math.max(max[a], value); } }
  }
  if (!count) throw Error('Select geosets or vertices to shape.');
  const center = min.map((v, i) => (v + max[i]) / 2), span = max.map((v, i) => v - min[i]), u = (axis + 1) % 3, v = (axis + 2) % 3;
  const angle = amount * Math.PI / 180;
  const map = p => {
    if (amount === 0) return [...p];
    const q = p.map((n, i) => n - center[i]), out = [...q], length = span[axis];
    if (tool === 'Dome') {
      const ru = span[u] / 2 || 1, rv = span[v] / 2 || 1, r2 = (q[u] / ru) ** 2 + (q[v] / rv) ** 2;
      out[axis] += amount * Math.max(0, 1 - r2);
    } else {
      if (length < 1e-8) throw Error('The selection has no length on this axis. Choose another axis.');
      if (tool === 'Taper') { const factor = 1 + amount / 100 * (p[axis] - min[axis]) / length; out[u] *= factor; out[v] *= factor; }
      else if (tool === 'Warp') { const a = angle * q[axis] / length, c = Math.cos(a), s = Math.sin(a); out[u] = q[u] * c - q[v] * s; out[v] = q[u] * s + q[v] * c; }
      else {
        const coordinate = tool === 'Bend' ? p[axis] - min[axis] : q[axis], a = angle * coordinate / length, radius = length / angle;
        // At zero curvature the limit is the original geometry. Bend anchors the
        // minimum edge; Wrap centers the arc. Local depth follows its rotation.
        out[axis] = Math.sin(a) * (radius + q[v]) + (tool === 'Bend' ? min[axis] - center[axis] : 0);
        out[v] = Math.cos(a) * (radius + q[v]) - radius;
      }
    }
    return out.map((n, i) => n + center[i]);
  };
  return { map, count };
}
export function shapeGeosets(model, selection, options = {}) {
  const { map } = prepare(model, selection, options), updates = [];
  // A UV/normal split is still one geometric position. Move its copies within
  // this selected geoset together, without enrolling another overlapping part.
  selection = Object.fromEntries(Object.entries(selection).map(([gi, ids]) => {
    const vertices = model.Geosets[gi].Vertices, key = id => `${vertices[id * 3]},${vertices[id * 3 + 1]},${vertices[id * 3 + 2]}`;
    const selectedPositions = new Set(ids.map(key)), expanded = [];
    for (let id = 0; id < vertices.length / 3; id++) if (selectedPositions.has(key(id))) expanded.push(id);
    return [gi, expanded];
  }));
  const count = Object.values(selection).reduce((sum, ids) => sum + ids.length, 0);
  for (const [gi, ids] of Object.entries(selection)) {
    const source = model.Geosets[gi], g = { ...source, Vertices: source.Vertices.slice(), ...(source.Tangents ? { Tangents: source.Tangents.slice() } : {}) };
    for (const id of ids) {
      const p = Array.from(source.Vertices.subarray(id * 3, id * 3 + 3)), out = map(p);
      if (out.some(v => !Number.isFinite(v) || Math.abs(v) > 1e12)) throw Error('The shaping amount produces invalid coordinates.');
      g.Vertices.set(out, id * 3);
      if (g.Tangents) { const e = .001, q = p.map((v, i) => v + source.Tangents[id * 4 + i] * e), moved = map(q), vector = moved.map((v, i) => (v - out[i]) / e), n = Math.hypot(...vector) || 1; g.Tangents.set(vector.map(v => v / n), id * 4); }
    }
    recalculateNormals(g);
    if (g.Tangents) for (let i = 0; i < g.Vertices.length / 3; i++) { const n = Array.from(g.Normals.subarray(i * 3, i * 3 + 3)), t = Array.from(g.Tangents.subarray(i * 4, i * 4 + 3)), dot = n.reduce((s, v, k) => s + v * t[k], 0), projected = t.map((v, k) => v - dot * n[k]), length = Math.hypot(...projected) || 1; g.Tangents.set(projected.map(v => v / length), i * 4); }
    updates.push([gi, g]);
  }
  // Preparation is atomic even when used outside document history.
  for (const [gi, g] of updates) Object.assign(model.Geosets[gi], g);
  recalculateExtents(model); return { vertices: count, geosets: updates.length };
}
export function previewShape(model, selection, options = {}) {
  const preview = { ...model, Info: { ...model.Info }, Geosets: model.Geosets.map(g => ({ ...g })) };
  shapeGeosets(preview, selection, options); return preview;
}
