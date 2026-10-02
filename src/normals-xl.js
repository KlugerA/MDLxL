/** Surface-guided normal repair. Call within EditorDocument.apply for one undo step. */
const EPSILON = 1e-6;
const vector = (array, id) => Array.from(array.slice(id * 3, id * 3 + 3));
const add = (a, b) => a.map((value, axis) => value + b[axis]);
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const scale = (a, factor) => a.map(value => value * factor);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => scale(a, 1 / (Math.hypot(...a) || 1));
const fail = message => { throw new Error('NormalsXL: ' + message); };

function surface(geoset) {
  const g = geoset, count = g?.Vertices?.length / 3;
  if (!Number.isInteger(count) || g.Normals?.length !== count * 3 || !g.Faces || g.Faces.length % 3 ||
      [...g.Vertices, ...g.Normals].some(value => !Number.isFinite(value)) ||
      Array.from(g.Faces).some(id => !Number.isInteger(id) || id < 0 || id >= count))
    fail('the target geometry is no longer available.');
  const positions = Array.from({ length: count }, (_, id) => vector(g.Vertices, id));
  // Match edges across UV/hard-normal seams without welding or moving vertices.
  const positionIds = new Map(), vertexKeys = positions.map(p => {
    const key = p.join(',');
    if (!positionIds.has(key)) positionIds.set(key, positionIds.size);
    return positionIds.get(key);
  });
  const edges = new Map(), indexedEdges = new Map(), triangles = new Map(), faces = [], neighbors = [];
  for (let offset = 0; offset < g.Faces.length; offset += 3) {
    const ids = vector(g.Faces, offset / 3), [a, b, c] = ids.map(id => positions[id]);
    const normal = cross(subtract(b, a), subtract(c, a)), index = faces.length;
    faces.push({ ids, normal: unit(normal), area: Math.hypot(...normal), offset });
    neighbors.push([]);
    // A collapsed triangle has no orientation and must not constrain nearby
    // surfaces. Keep its vertices and winding intact in the repair plan.
    if (!faces[index].area) continue;
    const triangleKey = ids.map(id => vertexKeys[id]).sort((a, b) => a - b).join(':');
    if (!triangles.has(triangleKey)) triangles.set(triangleKey, []);
    triangles.get(triangleKey).push(index);
    for (let edge = 0; edge < 3; edge++) {
      const from = vertexKeys[ids[edge]], to = vertexKeys[ids[(edge + 1) % 3]];
      if (from === to) continue;
      const key = Math.min(from, to) + ':' + Math.max(from, to);
      if (!edges.has(key)) edges.set(key, []);
      const a = ids[edge], b = ids[(edge + 1) % 3], indexedKey = Math.min(a, b) + ':' + Math.max(a, b);
      const item = { face: index, sign: from < to ? 1 : -1, indexedKey };
      edges.get(key).push(item);
      if (!indexedEdges.has(indexedKey)) indexedEdges.set(indexedKey, []);
      indexedEdges.get(indexedKey).push(item);
    }
  }
  // Coincident, oppositely wound triangle copies already provide both sides.
  // Preserve that coverage and correct each vertex's lighting normal against
  // its own incident faces; never collapse both copies onto one outward side.
  for (const pair of triangles.values()) {
    if (pair.length === 2 && dot(faces[pair[0]].normal, faces[pair[1]].normal) < -1 + EPSILON)
      pair.forEach(id => { faces[id].twoSided = true; });
  }
  const connect = (a, b) => {
    if (faces[a.face].twoSided || faces[b.face].twoSided) return;
    const sign = -a.sign * b.sign;
    neighbors[a.face].push([b.face, sign]); neighbors[b.face].push([a.face, sign]);
  };
  // Actual indexed topology takes precedence over coincident positions. Edges
  // with more than two incident faces are analysis boundaries: imposing one
  // orientation on every branch creates conflicts that are not present on the
  // individual sheets. No vertex or triangle is split, removed, or skipped.
  for (const edge of indexedEdges.values()) if (edge.length === 2) connect(...edge);
  // Join only an unambiguous pair of open seam edges. Do not weld overlapping
  // front/back sheets just because they occupy the same geometric edge.
  for (const edge of edges.values()) {
    if (edge.length === 2 && edge.every(item => indexedEdges.get(item.indexedKey).length === 1)) connect(...edge);
  }
  const signs = new Int8Array(faces.length), parts = [], vertexParts = positions.map(() => new Set());
  for (let seed = 0; seed < faces.length; seed++) {
    if (signs[seed]) continue;
    const part = { faces: [seed], vertices: new Set(), valid: true, outward: 0, twoSided: !!faces[seed].twoSided };
    signs[seed] = 1;
    for (let cursor = 0; cursor < part.faces.length; cursor++) {
      const index = part.faces[cursor], face = faces[index];
      face.part = parts.length;
      if (face.area) face.ids.forEach(id => part.vertices.add(id));
      for (const [next, relative] of neighbors[index]) {
        const wanted = signs[index] * relative;
        if (!signs[next]) { signs[next] = wanted; part.faces.push(next); }
        else if (signs[next] !== wanted) part.valid = false;
      }
    }
    // A local center makes the signed volume independent of model translation.
    // For open curved pieces this estimates the outward side; it is not a
    // general inside/outside test for arbitrary open or intersecting geometry.
    const center = part.vertices.size ? scale([...part.vertices].reduce((sum, id) => add(sum, positions[id]), [0,0,0]), 1 / part.vertices.size) : [0,0,0];
    let volume = 0, volumeScale = 0;
    for (const index of part.faces) {
      const face = faces[index], [a, b, c] = face.ids.map(id => subtract(positions[id], center));
      volume += signs[index] * dot(a, cross(b, c));
      volumeScale += face.area * Math.max(Math.hypot(...a), Math.hypot(...b), Math.hypot(...c));
    }
    if (Math.abs(volume) > volumeScale * 1e-8) part.outward = Math.sign(volume);
    part.vertices.forEach(id => vertexParts[id].add(parts.length));
    parts.push(part);
  }
  const normalsFor = orientations => {
    const sums = positions.map(() => [0,0,0]);
    for (let index = 0; index < faces.length; index++) {
      const face = faces[index], normal = scale(face.normal, signs[index] * orientations[face.part]);
      face.ids.forEach(id => { sums[id] = add(sums[id], normal); });
    }
    // Match the editor's authored smoothing: unit face normals, then unit
    // vertex normals. Area weighting changes the accepted trim silhouette.
    return sums.map(unit);
  };
  return { g, faces, parts, signs, vertexParts, normalsFor, count };
}

function referenceGuide(analyses, references) {
  if (!references?.length || new Set(references.map(r => r.geosetIndex + ':' + r.vertexIndex)).size !== references.length)
    fail('select a vertex with a correctly facing normal.');
  const refs = references.map(reference => {
    const { geosetIndex, vertexIndex } = reference, mesh = analyses(geosetIndex);
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= mesh.count)
      fail('the reference vertex is no longer available.');
    const normal = unit(vector(mesh.g.Normals, vertexIndex));
    if (Math.hypot(...normal) < EPSILON) fail('choose reference vertices with non-zero normals.');
    return { ...reference, mesh, normal };
  });
  let polarity = 0;
  for (const ref of refs) {
    const parts = [...ref.mesh.vertexParts[ref.vertexIndex]];
    if (!parts.length || parts.some(id => !ref.mesh.parts[id].valid)) fail('the reference surface has no consistent orientation.');
    if (parts.some(id => !ref.mesh.parts[id].outward && !ref.mesh.parts[id].twoSided)) continue;
    const local = ref.mesh.normalsFor(ref.mesh.parts.map(part => part.outward || 1))[ref.vertexIndex];
    const agreement = dot(ref.normal, local);
    if (Math.abs(agreement) <= EPSILON) fail('choose reference normals that clearly face into or out of their surface.');
    if (polarity && Math.sign(agreement) !== polarity) fail('the reference normals disagree about inside and outside.');
    polarity = Math.sign(agreement);
  }
  return { refs, polarity: polarity || 1, direction: unit(refs.reduce((sum, ref) => add(sum, ref.normal), [0,0,0])) };
}

function orientationsFor(mesh, selected, guide) {
  return mesh.parts.map((part, partIndex) => {
    if (![...part.vertices].some(id => selected.has(id))) return part.outward ? part.outward * guide.polarity : 1;
    if (!part.valid) fail('the selected surface has conflicting winding.');
    if (part.twoSided) return guide.polarity;
    if (part.outward) return part.outward * guide.polarity;
    const refs = guide.refs.filter(ref => ref.mesh === mesh && mesh.vertexParts[ref.vertexIndex].has(partIndex));
    const agreements = refs.map(ref => {
      const local = part.faces.reduce((sum, id) => mesh.faces[id].ids.includes(ref.vertexIndex)
        ? add(sum, scale(mesh.faces[id].normal, mesh.signs[id])) : sum, [0,0,0]);
      return dot(ref.normal, unit(local));
    });
    if (agreements.length) {
      if (agreements.some(value => Math.abs(value) <= EPSILON || value * agreements[0] <= 0))
        fail('the reference normals disagree about this surface.');
      return Math.sign(agreements[0]);
    }
    const sum = part.faces.reduce((normal, id) => add(normal, scale(mesh.faces[id].normal, mesh.signs[id])), [0,0,0]);
    const agreement = dot(unit(sum), guide.direction);
    if (Math.abs(agreement) <= EPSILON) fail('pick reference vertices on the flat surface to choose its side.');
    return Math.sign(agreement);
  });
}

function collapsedNormals(mesh, geometric) {
  const collapsed = new Set(), parallel = (a, b) => Math.abs(dot(a, b)) > 1 - 1e-10;
  for (const part of mesh.parts) {
    if (!part.outward || part.twoSided || !part.valid) continue;
    const ids = [...part.vertices];
    if (ids.some(id => mesh.vertexParts[id].size !== 1)) continue;
    const authored = new Map(ids.map(id => [id, unit(vector(mesh.g.Normals, id))]));
    const unexplained = ids.filter(id => !parallel(authored.get(id), geometric[id]));
    if (unexplained.length < 2) continue;
    const axis = authored.get(unexplained[0]), first = geometric[unexplained[0]];
    // Infer a collapsed field only within this piece, across different local
    // surface directions. Already geometric normals may come from an earlier
    // partial repair. Flat fields and isolated custom slopes stay authored.
    if (Math.hypot(...axis) < EPSILON || !unexplained.every(id => parallel(authored.get(id), axis)) ||
        !unexplained.some(id => Math.abs(dot(first, geometric[id])) < 1 - EPSILON)) continue;
    ids.filter(id => parallel(authored.get(id), axis) && Math.hypot(...geometric[id]) > EPSILON)
      .forEach(id => collapsed.add(id));
  }
  return collapsed;
}

function isGeometricSmoothing(axis, contributions) {
  const matches = sum => Math.abs(dot(unit(sum), axis)) > 1 - 1e-10;
  if (matches(contributions.reduce(add, [0,0,0]))) return true;
  // Recover shared smoothing even when a previous reversal left different
  // connected pieces (or individual normals) inverted. Only accept a geometric
  // explanation of the authored vector, rather than averaging custom slopes.
  // Bound inference work for unusually large ambiguous groups; those retain
  // their authored slopes and still receive individual direction correction.
  let remaining = 4096;
  const search = (index, sum) => {
    if (--remaining < 0) return false;
    if (index === contributions.length) return matches(sum);
    return search(index + 1, add(sum, contributions[index])) || search(index + 1, subtract(sum, contributions[index]));
  };
  return search(1, contributions[0]);
}

function smoothingNormals(mesh, geometric) {
  const groups = new Map(), repaired = new Map();
  for (let id = 0; id < mesh.count; id++) {
    let normal = unit(vector(mesh.g.Normals, id));
    if (Math.hypot(...normal) < EPSILON || mesh.vertexParts[id].size !== 1 ||
        [...mesh.vertexParts[id]].some(part => mesh.parts[part].twoSided)) continue;
    if (normal.find(value => Math.abs(value) > EPSILON) < 0) normal = scale(normal, -1);
    const key = normal.map(value => (Math.abs(value) < EPSILON ? 0 : value).toFixed(6)).join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  for (const ids of groups.values()) {
    const contributions = new Map();
    for (const id of ids) {
      const part = [...mesh.vertexParts[id]][0];
      contributions.set(part, add(contributions.get(part) || [0,0,0], geometric[id]));
    }
    if (contributions.size < 2) continue;
    const values = [...contributions.values()], normal = unit(values.reduce(add, [0,0,0]));
    // Opposite surfaces may legitimately share an unsigned axis. They are not
    // one smoothing group and must retain their different outward directions.
    if (ids.some(id => dot(normal, geometric[id]) <= EPSILON)) continue;
    if (!isGeometricSmoothing(unit(vector(mesh.g.Normals, ids[0])), values)) continue;
    ids.forEach(id => repaired.set(id, normal));
  }
  return repaired;
}

function tangentFor(g, id, normal, reversed) {
  if (!g.Tangents?.length) return null;
  const tangent = Array.from(g.Tangents.slice(id * 4, id * 4 + 4));
  if (reversed) { tangent[3] *= -1; return tangent; }
  const oldBitangent = scale(cross(unit(vector(g.Normals, id)), tangent), tangent[3]);
  let projected = subtract(tangent.slice(0,3), scale(normal, dot(tangent.slice(0,3), normal)));
  if (Math.hypot(...projected) < EPSILON) {
    const axis = Math.abs(normal[0]) < .9 ? [1,0,0] : [0,1,0];
    projected = subtract(axis, scale(normal, dot(axis, normal)));
  }
  projected = unit(projected);
  return [...projected, dot(cross(normal, projected), oldBitangent) < 0 ? -1 : 1];
}

export function correctNormalsXL(model, selection, references) {
  const cache = new Map();
  const analyses = index => {
    if (!Number.isInteger(index) || !model.Geosets[index]) fail('the target geoset is no longer available.');
    if (!cache.has(index)) cache.set(index, surface(model.Geosets[index]));
    return cache.get(index);
  };
  const guide = referenceGuide(analyses, references), plans = [];
  let reversedNormals = 0, recalculatedNormals = 0, reversedFaces = 0;
  for (const [key, indices] of Object.entries(selection)) {
    if (!indices.length) continue;
    const mesh = analyses(Number(key)), selected = new Set(indices);
    if ([...selected].some(id => !Number.isInteger(id) || id < 0 || id >= mesh.count))
      fail('the target selection is no longer available.');
    const orientations = orientationsFor(mesh, selected, guide), geometric = mesh.normalsFor(orientations);
    const collapsed = collapsedNormals(mesh, geometric), smoothed = smoothingNormals(mesh, geometric), normals = [], faces = [];
    for (const id of selected) {
      const old = vector(mesh.g.Normals, id), length = Math.hypot(...old);
      const target = collapsed.has(id) ? scale(geometric[id], length)
        : smoothed.has(id) ? scale(smoothed.get(id), length)
        : dot(old, geometric[id]) < -EPSILON * length ? scale(old, -1) : old;
      if (Math.hypot(...subtract(old, target)) <= EPSILON * Math.max(1, length)) continue;
      const reversed = Math.hypot(...add(old, target)) <= EPSILON * Math.max(1, length);
      const normal = reversed ? scale(old, -1) : target;
      normals.push({ id, normal, tangent: tangentFor(mesh.g, id, unit(normal), reversed) });
      if (reversed) reversedNormals++; else recalculatedNormals++;
    }
    for (let index = 0; index < mesh.faces.length; index++) {
      const face = mesh.faces[index];
      if (face.area && mesh.signs[index] * orientations[face.part] < 0 && face.ids.every(id => selected.has(id))) faces.push(face.offset);
    }
    reversedFaces += faces.length;
    plans.push({ g: mesh.g, normals, faces });
  }
  // Build every plan before mutation, so invalid references/selections are atomic.
  for (const { g, normals, faces } of plans) {
    for (const { id, normal, tangent } of normals) {
      g.Normals.set(normal, id * 3);
      if (tangent) g.Tangents.set(tangent, id * 4);
    }
    for (const offset of faces) [g.Faces[offset], g.Faces[offset + 2]] = [g.Faces[offset + 2], g.Faces[offset]];
  }
  return { reversedNormals, recalculatedNormals, reversedFaces };
}
