import { Color, Matrix4, Vector3 } from 'three';
import { visualOptions } from '../src/preferences.js';

const CUBE = { vertices: [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]], faces: [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]] };
const TETRA = { vertices: [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]], faces: [[0,2,1],[0,1,3],[0,3,2],[1,2,3]] };

export function boneHighlightColors(nodes, selectedIds) {
  const byId = new Map(nodes.map(point => [point.node.ObjectId, point]));
  const boneIds = new Set(nodes.filter(point => point.overlayKind === 'bones').map(point => point.node.ObjectId));
  const selected = new Set((selectedIds || []).filter(id => boneIds.has(id)));
  if (!selected.size) return new Map();
  const parents = new Set(), children = new Set(), byParent = new Map();
  for (const point of nodes) {
    const list = byParent.get(point.node.Parent) || []; list.push(point.node.ObjectId); byParent.set(point.node.Parent, list);
  }
  for (const id of selected) {
    const parent = byId.get(byId.get(id)?.node.Parent); if (parent && boneIds.has(parent.node.ObjectId)) parents.add(parent.node.ObjectId);
    const pending = [...(byParent.get(id) || [])];
    while (pending.length) { const child = pending.pop(); if (children.has(child)) continue; children.add(child); pending.push(...(byParent.get(child) || [])); }
  }
  const colors = new Map();
  for (const point of nodes) {
    const id = point.node.ObjectId;
    if (selected.has(id)) colors.set(id, '#ff0000');
    else if (parents.has(id) && boneIds.has(id)) colors.set(id, '#000000');
    else if (children.has(id)) colors.set(id, '#ffff00');
    else if (boneIds.has(id)) colors.set(id, null);
  }
  return colors;
}

export function markerStyle(point, byId, preferences, highlightColors = new Map()) {
  const visual = visualOptions(preferences), highlighted = highlightColors.get(point.node.ObjectId);
  if (point.overlayKind === 'attachments') return { shape: TETRA, color: highlighted || visual.node };
  if (point.overlayKind === 'particles') return { shape: TETRA, color: highlighted || visual.particle };
  if (point.overlayKind === 'bones') return { shape: CUBE, color: highlightColors.get(point.node.ObjectId) || visual.bone };
  if (point.helperNode) return { shape: CUBE, color: highlighted || visual.bone };
  if (point.eventNode) return { shape: TETRA, color: highlighted || visual.event };
  return { shape: TETRA, color: highlighted || point.displayColor || visual.node };
}

/** Actual world-space polyhedra, shared by the editor and Warcraft GL contexts. */
export function rigMarkerGeometry(nodes, selectedIds, options = {}) {
  const byId = new Map(nodes.map(point => [point.node.ObjectId, point])), highlights = boneHighlightColors(nodes, selectedIds);
  const triangles = [], edges = [], emphasizedEdges = [], size = visualOptions(options.preferences).helperSize * 3 / 2;
  for (const point of nodes) {
    if (!point.visible || !options[point.overlayKind || 'nodes']) continue;
    const { shape, color } = markerStyle(point, byId, options.preferences, highlights), rgb = new Color(color).convertLinearToSRGB().toArray();
    const points = shape.vertices.map(vertex => new Vector3(...vertex).multiplyScalar(point.unitsPerPixel * size).applyQuaternion(point.rotation).add(point.world));
    const seen = new Set();
    for (const face of shape.faces) {
      // Faces are wound outwards. Light the outward side from the viewer so a
      // cube/polyhedron can never look like its dark interior is facing out.
      const normal = points[face[1]].clone().sub(points[face[0]]).cross(points[face[2]].clone().sub(points[face[0]])).normalize();
      const faceCenter = face.reduce((value, id) => value.add(points[id]), new Vector3()).multiplyScalar(1 / face.length);
      const light = options.cameraPosition ? new Vector3().fromArray(options.cameraPosition).sub(faceCenter).normalize() : new Vector3(-.4,-.5,1).normalize();
      const illumination = .58 + .42 * Math.max(0, normal.dot(light));
      for (let i = 1; i + 1 < face.length; i++) for (const id of [face[0],face[i],face[i+1]]) triangles.push(...points[id].toArray(), ...rgb.map(c => c * illumination));
      for (let i = 0; i < face.length; i++) {
        const a = face[i], b = face[(i+1)%face.length], key = [a,b].sort().join(':');
        if (seen.has(key)) continue; seen.add(key);
        for (const id of [a,b]) edges.push(...points[id].toArray(), ...rgb);
        if (highlights.get(point.node.ObjectId) === '#000000') for (const id of [a,b]) emphasizedEdges.push(...points[id].toArray(), ...rgb);
      }
    }
  }
  return { triangles: new Float32Array(triangles), edges: new Float32Array(edges), emphasizedEdges: new Float32Array(emphasizedEdges) };
}

// ANGLE commonly clamps GL line width to one pixel. Expand parent edges to
// screen-space quads so their doubled thickness is real on Windows.
export function thickMarkerEdges(edges, camera, width, height, pixels = 2) {
  const out = [];
  for (let i = 0; i < edges.length; i += 12) {
    const a = new Vector3().fromArray(edges, i).project(camera), b = new Vector3().fromArray(edges, i + 6).project(camera);
    if (Math.abs(a.z) > 1 || Math.abs(b.z) > 1) continue;
    const dx = (b.x - a.x) * width, dy = (b.y - a.y) * height, length = Math.hypot(dx, dy);
    if (length < .0001) continue;
    const ox = -dy / length * pixels / width, oy = dx / length * pixels / height;
    const corners = [a.clone().add(new Vector3(ox,oy,0)), a.clone().sub(new Vector3(ox,oy,0)), b.clone().add(new Vector3(ox,oy,0)), b.clone().sub(new Vector3(ox,oy,0))];
    const worldCorners = corners.map(corner => corner.unproject(camera).toArray());
    for (const index of [0,1,2,2,1,3]) out.push(...worldCorners[index], ...edges.slice(i+3,i+6));
  }
  return new Float32Array(out);
}

export function createRigMarkersGL(gl) {
  const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); return shader; };
  const vs = compile(gl.VERTEX_SHADER, '#version 300 es\nin vec3 position; in vec3 color; uniform mat4 transform; out vec3 tint; void main(){gl_Position=transform*vec4(position,1.);tint=color;}');
  const fs = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; in vec3 tint; out vec4 result; void main(){result=vec4(tint,1.);}');
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const buffer = gl.createBuffer(), vao = gl.createVertexArray(), transform = gl.getUniformLocation(program, 'transform');
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, offset] of [['position',0],['color',12]]) { const location = gl.getAttribLocation(program,name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,offset); }
  gl.bindVertexArray(null);
  return {
    draw(camera, nodes, selectedIds, options) {
      const { triangles, edges, emphasizedEdges } = rigMarkerGeometry(nodes, selectedIds, { ...options, cameraPosition: camera.position.toArray() });
      const viewport = gl.getParameter(gl.VIEWPORT);
      const thickEdges = thickMarkerEdges(emphasizedEdges, camera, viewport[2], viewport[3]);
      const drawParentEdges = () => { gl.disable(gl.CULL_FACE); gl.bufferData(gl.ARRAY_BUFFER,thickEdges,gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,thickEdges.length/6); };
      gl.useProgram(program); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.uniformMatrix4fv(transform,false,new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.BLEND); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.depthMask(false);
      if (options.wireframeMarkers) {
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.bufferData(gl.ARRAY_BUFFER,triangles,gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,triangles.length/6);
        if (thickEdges.length) drawParentEdges();
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.bindVertexArray(null); return;
      }
      // Mesh depth splits even partially occluded markers at fragment precision.
      gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.bufferData(gl.ARRAY_BUFFER,triangles,gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,triangles.length/6); gl.depthMask(false);
      if (options.occludedMarkerEdges) {
        gl.bufferData(gl.ARRAY_BUFFER,edges,gl.DYNAMIC_DRAW); gl.lineWidth(1);
        gl.depthFunc(gl.GREATER); gl.drawArrays(gl.LINES,0,edges.length/6);
      }
      if (thickEdges.length) { if (options.occludedMarkerEdges) gl.disable(gl.DEPTH_TEST); else gl.depthFunc(gl.LEQUAL); drawParentEdges(); gl.enable(gl.DEPTH_TEST); }
      gl.depthMask(true); gl.bindVertexArray(null);
    },
    dispose() { gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); },
  };
}
