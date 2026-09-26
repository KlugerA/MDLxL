/** Direction-guided reversal. Call within EditorDocument.apply for one undo step.
 * The three references are existing good vertex normals, not triangle corners.
 * Preserve authored slopes: only negate normals in the opposite hemisphere.
 */
const EPSILON = 1e-6;
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
function normalAt(model, reference) {
  const { geosetIndex, vertexIndex } = reference;
  const g = model.Geosets[geosetIndex];
  if (!Number.isInteger(geosetIndex) || !Number.isInteger(vertexIndex) || !g ||
      vertexIndex < 0 || vertexIndex >= g.Vertices.length / 3 || g.Normals?.length !== g.Vertices.length)
    throw new Error('NormalsXL: the reference vertex is no longer available.');
  const normal = Array.from(g.Normals.slice(vertexIndex * 3, vertexIndex * 3 + 3));
  const length = Math.hypot(...normal);
  if (!Number.isFinite(length) || length < EPSILON)
    throw new Error('NormalsXL: choose reference vertices with non-zero normals.');
  return normal.map(value => value / length);
}
export function normalsXLDirection(model, references) {
  if (references?.length !== 3 || new Set(references.map(r => r.geosetIndex + ':' + r.vertexIndex)).size !== 3)
    throw new Error('NormalsXL: select three different vertices with correctly facing normals.');
  const normals = references.map(reference => normalAt(model, reference));
  const sum = [0, 1, 2].map(axis => normals.reduce((value, normal) => value + normal[axis], 0));
  const length = Math.hypot(...sum);
  if (length < EPSILON) throw new Error('NormalsXL: the reference normals cancel out. Pick three facing the desired direction.');
  const direction = sum.map(value => value / length);
  if (normals.some(normal => dot(normal, direction) <= EPSILON))
    throw new Error('NormalsXL: the reference normals disagree. Pick three facing the desired direction.');
  return direction;
}

export function correctNormalsXL(model, selection, references) {
  const direction = normalsXLDirection(model, references), plans = [];
  for (const [key, indices] of Object.entries(selection)) {
    if (!indices.length) continue;
    const g = model.Geosets[key], selected = new Set(indices);
    if (!g || g.Normals?.length !== g.Vertices.length || g.Faces?.length % 3 ||
        [...selected].some(id => !Number.isInteger(id) || id < 0 || id >= g.Vertices.length / 3))
      throw new Error('NormalsXL: the target selection is no longer available.');
    const normals = [], faces = [];
    for (const id of selected) {
      const n = Array.from(g.Normals.slice(id * 3, id * 3 + 3)), length = Math.hypot(...n);
      if (!Number.isFinite(length)) throw new Error('NormalsXL: selected normals contain invalid values.');
      if (length > 0 && dot(n, direction) < -EPSILON * length) normals.push(id);
    }
    // Face winding controls culling independently of lighting normals. Only
    // complete selected triangles may change; never touch a boundary triangle.
    for (let offset = 0; offset < g.Faces.length; offset += 3) {
      const ids = Array.from(g.Faces.slice(offset, offset + 3));
      if (!ids.every(id => selected.has(id))) continue;
      const [a, b, c] = ids.map(id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3)));
      const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis]);
      const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      if (dot(n, direction) < -EPSILON * Math.hypot(...n)) faces.push(offset);
    }
    plans.push({ g, normals, faces });
  }
  let reversedNormals = 0, reversedFaces = 0;
  for (const { g, normals, faces } of plans) {
    for (const id of normals) {
      for (let axis = 0; axis < 3; axis++) g.Normals[id * 3 + axis] *= -1;
      if (g.Tangents?.length) g.Tangents[id * 4 + 3] *= -1;
    }
    for (const offset of faces) [g.Faces[offset + 1], g.Faces[offset + 2]] = [g.Faces[offset + 2], g.Faces[offset + 1]];
    reversedNormals += normals.length; reversedFaces += faces.length;
  }
  return { reversedNormals, reversedFaces, direction };
}
