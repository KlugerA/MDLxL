import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';

// WC3 timestamps are milliseconds. Keys outside the active sequence must never
// leak into it. Quaternion cubic tracks use squad, as in war3-model's renderer.
export function sampleTrack(track, frame, options = {}) {
  const { interval, globalSequences = [], globalTime = frame, fallback = 0, quaternion = false } = options;
  if (track == null) return fallback;
  if (typeof track === 'number' || Array.isArray(track) || ArrayBuffer.isView(track)) return track;
  let from = interval?.[0] ?? -Infinity, to = interval?.[1] ?? Infinity;
  const globalId = track.GlobalSeqId;
  if (Number.isInteger(globalId) && globalId >= 0 && globalSequences[globalId] > 0) {
    to = globalSequences[globalId]; from = 0;
    frame = ((globalTime % to) + to) % to;
  }
  const keys = track.Keys || [];
  let first = 0, last = keys.length - 1;
  while (first <= last && keys[first].Frame < from) first++;
  while (last >= first && keys[last].Frame > to) last--;
  if (first > last) return fallback;
  let left = keys[first], right = left;
  if (frame >= keys[last].Frame) left = right = keys[last];
  else if (frame > left.Frame) {
    let lo = first, hi = last;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (keys[mid].Frame <= frame) lo = mid; else hi = mid; }
    left = keys[lo]; right = keys[hi];
  }
  const a = left.Vector, b = right.Vector;
  const scalar = typeof fallback === 'number';
  if (left === right || track.LineType === 0) return scalar ? a[0] : Array.from(a);
  const t = Math.max(0, Math.min(1, (frame - left.Frame) / (right.Frame - left.Frame)));
  if (quaternion) {
    const qa = new Quaternion().fromArray(a).normalize(), qb = new Quaternion().fromArray(b).normalize();
    if ((track.LineType === 2 || track.LineType === 3) && left.OutTan && right.InTan) {
      const outer = qa.clone().slerp(qb, t);
      const inner = new Quaternion().fromArray(left.OutTan).normalize().slerp(new Quaternion().fromArray(right.InTan).normalize(), t);
      return outer.slerp(inner, 2 * t * (1 - t)).normalize().toArray();
    }
    return qa.slerp(qb, t).normalize().toArray();
  }
  const result = Array.from(a, (v, i) => {
    if ((track.LineType === 2 || track.LineType === 3) && left.OutTan && right.InTan) {
      const out = left.OutTan[i], incoming = right.InTan[i];
      if (track.LineType === 3) return (1 - t) ** 3 * v + 3 * t * (1 - t) ** 2 * out + 3 * t * t * (1 - t) * incoming + t ** 3 * b[i];
      return (2 * t ** 3 - 3 * t * t + 1) * v + (t ** 3 - 2 * t * t + t) * out + (t ** 3 - t * t) * incoming + (-2 * t ** 3 + 3 * t * t) * b[i];
    }
    return v + (b[i] - v) * t;
  });
  return scalar ? result[0] : result;
}

export function allNodes(model) {
  const byId = new Map();
  for (const key of ['Nodes', 'Bones', 'Helpers', 'Attachments', 'EventObjects', 'CollisionShapes', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'Lights', 'RibbonEmitters']) {
    for (const node of model?.[key] || []) if (node && Number.isInteger(node.ObjectId)) byId.set(node.ObjectId, node);
  }
  return [...byId.values()].sort((a, b) => a.ObjectId - b.ObjectId);
}

export function sampleNodeMatrices(model, frame = 0, sequenceIndex = -1, globalTime = frame) {
  const nodes = allNodes(model), byId = new Map(nodes.map(n => [n.ObjectId, n]));
  const matrices = new Map(), visiting = new Set();
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  const bindPose = sequenceIndex < 0 || !interval;
  const options = { interval, globalSequences: model.GlobalSequences, globalTime };
  function resolve(id) {
    if (matrices.has(id)) return matrices.get(id);
    const node = byId.get(id);
    if (!node || visiting.has(id)) return new Matrix4();
    visiting.add(id);
    let matrix = new Matrix4();
    if (!bindPose) {
      const translation = new Vector3().fromArray(sampleTrack(node.Translation, frame, { ...options, fallback: [0, 0, 0] }));
      const rotation = new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { ...options, fallback: [0, 0, 0, 1], quaternion: true }));
      const scale = new Vector3().fromArray(sampleTrack(node.Scaling, frame, { ...options, fallback: [1, 1, 1] }));
      const pivot = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
      matrix.compose(translation, rotation, scale);
      const rotatedPivot = pivot.clone().applyMatrix4(matrix).sub(translation);
      matrix.setPosition(translation.add(pivot).sub(rotatedPivot));
      if (node.Parent != null && byId.has(node.Parent)) {
        let parent = resolve(node.Parent);
        if (node.Flags & 7) {
          const p = new Vector3(), q = new Quaternion(), s = new Vector3();
          parent.decompose(p, q, s);
          if (node.Flags & 1) p.set(0, 0, 0);
          if (node.Flags & 2) q.identity();
          if (node.Flags & 4) s.set(1, 1, 1);
          parent = new Matrix4().compose(p, q, s);
        }
        matrix.premultiply(parent);
      }
    }
    visiting.delete(id); matrices.set(id, matrix); return matrix;
  }
  nodes.forEach(node => resolve(node.ObjectId));
  return matrices;
}

/** Applies classic equal-weight matrix groups or HD's four byte bone weights. */
export function skinGeoset(geoset, matrices, out = new Float32Array(geoset.Vertices.length)) {
  const vertices = geoset.Vertices, skin = geoset.SkinWeights;
  for (let vertex = 0; vertex < vertices.length / 3; vertex++) {
    const start = vertex * 3, x = vertices[start], y = vertices[start + 1], z = vertices[start + 2];
    let px = 0, py = 0, pz = 0, total = 0;
    const hd = skin?.length >= (vertex + 1) * 8;
    const group = hd ? [skin[vertex * 8], skin[vertex * 8 + 1], skin[vertex * 8 + 2], skin[vertex * 8 + 3]] : geoset.Groups?.[geoset.VertexGroup?.[vertex]] || [];
    for (let i = 0; i < group.length; i++) {
      const weight = hd ? skin[vertex * 8 + 4 + i] / 255 : 1;
      if (!weight) continue;
      const m = matrices.get(group[i])?.elements;
      px += (m ? m[0] * x + m[4] * y + m[8] * z + m[12] : x) * weight;
      py += (m ? m[1] * x + m[5] * y + m[9] * z + m[13] : y) * weight;
      pz += (m ? m[2] * x + m[6] * y + m[10] * z + m[14] : z) * weight;
      total += weight;
    }
    out[start] = total ? px / total : x; out[start + 1] = total ? py / total : y; out[start + 2] = total ? pz / total : z;
  }
  return out;
}

/** Keep authored split/smoothed normals while the skeleton deforms the mesh. */
export function skinGeosetNormals(geoset, matrices, out = new Float32Array(geoset.Normals.length)) {
  const normalMatrices = new Map([...matrices].map(([id, matrix]) => [id, new Matrix3().getNormalMatrix(matrix).elements]));
  const normals = geoset.Normals, skin = geoset.SkinWeights;
  for (let vertex = 0; vertex < normals.length / 3; vertex++) {
    const start = vertex * 3, x = normals[start], y = normals[start + 1], z = normals[start + 2];
    let nx = 0, ny = 0, nz = 0, total = 0;
    const hd = skin?.length >= (vertex + 1) * 8;
    const group = hd ? [skin[vertex * 8], skin[vertex * 8 + 1], skin[vertex * 8 + 2], skin[vertex * 8 + 3]] : geoset.Groups?.[geoset.VertexGroup?.[vertex]] || [];
    for (let i = 0; i < group.length; i++) {
      const weight = hd ? skin[vertex * 8 + 4 + i] / 255 : 1;
      if (!weight) continue;
      const m = normalMatrices.get(group[i]);
      nx += (m ? m[0] * x + m[3] * y + m[6] * z : x) * weight;
      ny += (m ? m[1] * x + m[4] * y + m[7] * z : y) * weight;
      nz += (m ? m[2] * x + m[5] * y + m[8] * z : z) * weight;
      total += weight;
    }
    if (!total) { nx = x; ny = y; nz = z; }
    const length = Math.hypot(nx, ny, nz) || 1;
    out[start] = nx / length; out[start + 1] = ny / length; out[start + 2] = nz / length;
  }
  return out;
}

export function advanceSequence(sequence, frame, delta) {
  if (!sequence?.Interval) return frame;
  const [start, end] = sequence.Interval, length = end - start;
  if (length <= 0) return start;
  const next = Math.max(start, frame) + delta;
  if (sequence.NonLooping) return Math.min(end, next);
  return next <= end ? next : start + ((next - start) % length);
}

/** Resolve the authored local sequence at a reel time. MdlVis temporarily
 * evaluates All line frames against that sequence's own interval; otherwise
 * keys from the following sequence become interpolation partners. */
export function localSequenceAtFrame(model, frame, excludedIndex = -1) {
  return (model?.Sequences || []).findIndex((sequence, index) => index !== excludedIndex && sequence?.Interval && frame >= sequence.Interval[0] && frame <= sequence.Interval[1]);
}

/** Shared preview color in editor RGB order; EditorDocument normalizes MDX KGAC. */
export function sampleGeosetAnimation(model, geosetId, frame, sequenceIndex, globalTime = frame) {
  const animation = model.GeosetAnims?.find(item => item.GeosetId === geosetId);
  const options = { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime };
  const unit = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  const color = animation?.Flags & 2 ? sampleTrack(animation.Color, frame, { ...options, fallback: [1, 1, 1] }) : [1, 1, 1];
  return {
    color: Array.from(color, unit),
    alpha: unit(sampleTrack(animation?.Alpha, frame, { ...options, fallback: 1 })),
  };
}

/** Zero disables rarity; 1..40 encode a 1/(rarity + 1) play chance. */
export function setSequenceOptions(model, sequenceIndex, { nonLooping, rarity } = {}) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) throw new Error('Select an animation before editing sequence options.');
  if (nonLooping !== undefined && typeof nonLooping !== 'boolean') throw new Error('Non-looping must be enabled or disabled.');
  if (rarity !== undefined && (!Number.isInteger(rarity) || rarity < 0 || rarity > 40)) throw new Error('Rarity must be a whole number from 0 to 40.');
  if (nonLooping !== undefined) sequence.NonLooping = nonLooping;
  if (rarity !== undefined) sequence.Rarity = rarity;
}
