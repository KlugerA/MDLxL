const same = (a, b) => JSON.stringify(Array.from(a || [])) === JSON.stringify(Array.from(b || []));
const point = (a, i, n) => Array.from(a.slice(i * n, (i + 1) * n));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const binding = (g, i) => g.Groups[g.VertexGroup[i]] || [];
const normalAngle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.reduce((s, v, i) => s + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b) || 1)))) * 180 / Math.PI;

export function compactVertices(g, representatives, faces) {
  const remap = new Map(representatives.map((v, i) => [v, i]));
  const compact = (a, width) => new a.constructor(representatives.flatMap(i => Array.from(a.slice(i * width, (i + 1) * width))));
  g.Vertices = compact(g.Vertices, 3); g.Normals = compact(g.Normals, 3);
  g.TVertices = g.TVertices.map(uv => compact(uv, 2));
  g.VertexGroup = compact(g.VertexGroup, 1);
  g.Faces = new g.Faces.constructor(Array.from(faces, i => remap.get(i)));
}

export function mergeDuplicateVertices(model, settings) {
  let removed = 0, groups = 0;
  for (const g of model.Geosets) {
    const count = g.Vertices.length / 3, map = [], kept = [], adjacent = Array.from({ length: count }, () => new Set());
    for (let f = 0; f < g.Faces.length; f += 3) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) adjacent[g.Faces[f + i]].add(g.Faces[f + j]);
    const members = new Map();
    for (let i = 0; i < count; i++) {
      const p = point(g.Vertices, i, 3), n = point(g.Normals, i, 3);
      const found = kept.find(j => same(binding(g, i), binding(g, j)) &&
        !members.get(j).some(k => adjacent[i].has(k)) &&
        (settings.position > 0 ? distance(p, point(g.Vertices, j, 3)) <= settings.position : same(p, point(g.Vertices, j, 3))) &&
        (settings.normal > 0 ? normalAngle(n, point(g.Normals, j, 3)) <= settings.normal : same(n, point(g.Normals, j, 3))) &&
        g.TVertices.every(uv => settings.uv > 0 ? distance(point(uv, i, 2), point(uv, j, 2)) <= settings.uv : same(point(uv, i, 2), point(uv, j, 2))));
      const target = found ?? i; map[i] = target;
      if (found === undefined) { kept.push(i); members.set(i, []); }
      members.get(target).push(i);
    }
    removed += count - kept.length;
    compactVertices(g, kept, Array.from(g.Faces, i => map[i]));
    const unique = [], groupMap = [];
    for (const group of g.Groups) { let i = unique.findIndex(other => same(group, other)); if (i < 0) { i = unique.length; unique.push(group); } groupMap.push(i); }
    groups += g.Groups.length - unique.length;
    g.VertexGroup = new g.VertexGroup.constructor(Array.from(g.VertexGroup, i => groupMap[i]));
    g.Groups = unique; g.TotalGroupsCount = unique.reduce((n, group) => n + group.length, 0);
  }
  return { duplicateVertices: removed, duplicateGroups: groups };
}

export function removeUnusedVertices(model) {
  let removed = 0;
  for (const g of model.Geosets) {
    if (!g.Faces.length) continue;
    const kept = [...new Set(g.Faces)].sort((a, b) => a - b);
    removed += g.Vertices.length / 3 - kept.length;
    compactVertices(g, kept, g.Faces);
    const groups = [...new Set(g.VertexGroup)].sort((a, b) => a - b), map = new Map(groups.map((id, i) => [id, i]));
    g.VertexGroup = new g.VertexGroup.constructor(Array.from(g.VertexGroup, id => map.get(id)));
    g.Groups = groups.map(id => g.Groups[id]); g.TotalGroupsCount = g.Groups.reduce((sum, group) => sum + group.length, 0);
  }
  return removed;
}

function cross(a, b, c) { const u = b.map((v, i) => v - a[i]), v = c.map((x, i) => x - a[i]); return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]; }
/** Endpoint edge collapse keeps a complete authored vertex record, never drops
 * arbitrary faces, and rejects folded/degenerate surviving triangles. */
export function reducePolygons(model, settings) {
  const original = model.Geosets.reduce((n, g) => n + g.Faces.length / 3, 0);
  const target = Math.max(model.Geosets.filter(g => g.Faces.length).length, Math.min(original, Math.round(settings.target)));
  let total = original, collapses = 0;
  if (target >= total) return { trianglesBefore: original, trianglesAfter: total, collapses };
  for (const g of model.Geosets) {
    let faces = Array.from({ length: g.Faces.length / 3 }, (_, i) => Array.from(g.Faces.slice(i * 3, i * 3 + 3)));
    const initial = faces.length, goal = Math.max(1, Math.round(initial * target / original));
    const positions = Array.from({ length: g.Vertices.length / 3 }, (_, i) => point(g.Vertices, i, 3));
    const clusters = positions.map((_, i) => [i]);
    const seamVertices = new Set(), positionsToVertices = new Map();
    positions.forEach((p, i) => { const key = p.join(','); const prior = positionsToVertices.get(key) || []; for (const j of prior) if (g.TVertices.some(uv => !same(point(uv,i,2),point(uv,j,2))) || !same(point(g.Normals,i,3),point(g.Normals,j,3))) { seamVertices.add(i); seamVertices.add(j); } prior.push(i); positionsToVertices.set(key, prior); });
    while (faces.length > goal && total > target) {
      const edges = new Map(), incident = new Map();
      faces.forEach((face, fi) => face.forEach((a, j) => { const list = incident.get(a) || []; list.push(fi); incident.set(a,list); const b=face[(j+1)%3],lo=Math.min(a,b),hi=Math.max(a,b),key=lo+':'+hi;const e=edges.get(key)||{a:lo,b:hi,count:0,cost:distance(positions[lo],positions[hi])};e.count++;edges.set(key,e); }));
      const boundary = new Set(); for (const e of edges.values()) if (e.count!==2) { boundary.add(e.a); boundary.add(e.b); }
      const faceKey = face => [...face].sort((a,b)=>a-b).join(':');
      const faceCounts = new Map(); for (const face of faces) { const key=faceKey(face); faceCounts.set(key,(faceCounts.get(key)||0)+1); }
      let best = null;
      for (const e of [...edges.values()].sort((a,b)=>a.cost-b.cost||a.a-b.a||a.b-b.b)) {
        const {a,b}=e;
        if (settings.protectSeams && (boundary.has(a)||boundary.has(b)||seamVertices.has(a)||seamVertices.has(b))) continue;
        if (settings.protectSkin && !same(binding(g,a),binding(g,b))) continue;
        if (settings.protectNormals && normalAngle(point(g.Normals,a,3),point(g.Normals,b,3))>settings.normalLimit) continue;
        if (clusters[b].some(i=>distance(positions[i],positions[a])>settings.error)) continue;
        const affected=[...new Set([...(incident.get(a)||[]),...(incident.get(b)||[])])];let gone=0,valid=true;
        // A tetrahedron collapse can create coincident surviving triangles
        // without flipping either normal. Reject new duplicate faces too.
        const counts = new Map(faceCounts);
        for (const fi of incident.get(b)||[]) { const key=faceKey(faces[fi]); counts.set(key,counts.get(key)-1); }
        for (const fi of incident.get(b)||[]) { const next=faces[fi].map(v=>v===b?a:v); if(new Set(next).size<3)continue;const key=faceKey(next);if(counts.get(key)>0){valid=false;break;}counts.set(key,1); }
        if(!valid)continue;
        for(const fi of affected){const f=faces[fi],next=f.map(v=>v===b?a:v);if(new Set(next).size<3){gone++;continue;}const n=cross(...f.map(v=>positions[v])),nn=cross(...next.map(v=>positions[v]));if(Math.hypot(...nn)<1e-9||n.reduce((s,v,i)=>s+v*nn[i],0)<=0){valid=false;break;}}
        if(!valid||!gone||faces.length-gone<goal||total-gone<target)continue;
        best={a,b,gone};break;
      }
      if(!best)break;
      const {a,b,gone}=best;faces=faces.map(f=>f.map(v=>v===b?a:v)).filter(f=>new Set(f).size===3);clusters[a].push(...clusters[b]);clusters[b]=[];total-=gone;collapses++;
    }
    const flat=faces.flat(),used=[...new Set(flat)].sort((a,b)=>a-b);if(flat.length!==g.Faces.length)compactVertices(g,used,flat);
  }
  return { trianglesBefore: original, trianglesAfter: total, collapses, constrained: total > target };
}
