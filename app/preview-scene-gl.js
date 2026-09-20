import { Color, Matrix4, Vector4 } from 'three';
import { gridSegments } from './viewport-grid.js';
import { platformGeometry, previewPlatformOptions } from './preview-platform.js';

/** Grid is an editor background aid drawn before opaque model surfaces.
 * The display platform is ordinary depth-tested presentation geometry. */
export function createPreviewSceneGL(gl, invalidate = () => {}) {
  const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); return shader; };
  const vs = compile(gl.VERTEX_SHADER, '#version 300 es\nin vec3 position; in vec4 color; in vec2 uv; uniform mat4 transform; uniform bool clipSpace; out vec4 tint; out vec2 coord; void main(){gl_Position=clipSpace?vec4(position,1.):transform*vec4(position,1.);tint=color;coord=uv;}');
  const fs = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; in vec4 tint; in vec2 coord; uniform sampler2D picture; uniform bool textured; out vec4 result; void main(){result=tint*(textured?texture(picture,coord):vec4(1.));}');
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const buffer = gl.createBuffer(), vao = gl.createVertexArray(), texture = gl.createTexture();
  const matrix = gl.getUniformLocation(program, 'transform'), textured = gl.getUniformLocation(program, 'textured'), clipSpace = gl.getUniformLocation(program, 'clipSpace');
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, count, offset] of [['position', 3, 0], ['color', 4, 12], ['uv', 2, 28]]) { const index = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, count, gl.FLOAT, false, 36, offset); }
  gl.bindVertexArray(null);
  let url = '', ready = false, image = null, generation = 0;
  const upload = () => {
    if (!image) return;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    image = null; ready = true;
  };
  return {
    draw(camera, preferences, workplane, showGrid, center, radius, floor, { platformOnly = false, gridOnly = false, showAxes = showGrid } = {}) {
      const config = previewPlatformOptions(preferences);
      if (url !== config.textureUrl) {
        url = config.textureUrl; ready = false; image = null; const token = ++generation;
        if (url) { const img = new Image(); img.onload = () => { if (generation === token) { image = img; invalidate(); } }; img.src = url; }
      }
      gl.useProgram(program); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); upload();
      const transform = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      gl.uniformMatrix4fv(matrix, false, transform.elements); gl.uniform1i(clipSpace, 0);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (config.enabled && !gridOnly) {
        const data = platformGeometry(config, center, radius, floor), color = new Color(config.color), packed = [];
        // Raw GL output is sRGB, unlike Three's linear scene colors.
        color.convertLinearToSRGB();
        for (let i = 0; i < data.vertices.length / 3; i++) packed.push(...data.vertices.subarray(i * 3, i * 3 + 3), color.r, color.g, color.b, 1, ...data.uvs.subarray(i * 2, i * 2 + 2));
        gl.uniform1i(textured, ready ? 1 : 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.depthMask(true); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(packed), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, data.vertices.length / 3);
      }
      if ((showGrid || showAxes) && !platformOnly) {
        const lines = gridSegments(preferences, workplane, showGrid, showAxes), packed = [];
        for (const line of lines.filter(item => item.kind !== 'axis')) { const color = new Color(line.color).convertLinearToSRGB(); for (const position of [line.a, line.b]) packed.push(...position, color.r, color.g, color.b, line.opacity, 0, 0); }
        gl.uniform1i(textured, 0); gl.depthMask(false);
        if (packed.length) { gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(packed), gl.DYNAMIC_DRAW); gl.drawArrays(gl.LINES, 0, packed.length / 9); }
        // Use CSS-pixel dimensions so a three-pixel axis stays three visible
        // pixels on high-DPI displays as well as at every camera range.
        const axes = axisScreenTriangles(lines.filter(item => item.kind === 'axis'), transform, Number(gl.canvas?.clientWidth) || Number(gl.drawingBufferWidth) || 1, Number(gl.canvas?.clientHeight) || Number(gl.drawingBufferHeight) || 1);
        if (axes.length) { gl.uniform1i(clipSpace, 1); gl.bufferData(gl.ARRAY_BUFFER, axes, gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, axes.length / 9); gl.uniform1i(clipSpace, 0); }
      }
      gl.depthMask(true); gl.bindVertexArray(null);
    },
    dispose() { generation++; gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); },
  };
}

/** Convert world-space axes to clipped screen-space quads. WebGL lineWidth is
 * fixed to one pixel on Windows, while these triangles remain exactly 3 px. */
export function axisScreenTriangles(lines, transform, width, height) {
  const packed = [], w = Math.max(1, width), h = Math.max(1, height);
  for (const line of lines || []) {
    const start = new Vector4(...line.a, 1).applyMatrix4(transform), end = new Vector4(...line.b, 1).applyMatrix4(transform);
    let low = 0, high = 1;
    for (const axis of ['x', 'y', 'z']) for (const sign of [-1, 1]) {
      const first = start.w + sign * start[axis], last = end.w + sign * end[axis];
      if (first < 0 && last < 0) { low = 1; high = 0; break; }
      if (first < 0) low = Math.max(low, first / (first - last));
      else if (last < 0) high = Math.min(high, first / (first - last));
    }
    if (low > high) continue;
    const a = start.clone().lerp(end, low), b = start.clone().lerp(end, high);
    const ax = a.x / a.w, ay = a.y / a.w, az = a.z / a.w, bx = b.x / b.w, by = b.y / b.w, bz = b.z / b.w;
    const dx = (bx - ax) * w, dy = (by - ay) * h, length = Math.hypot(dx, dy);
    if (!(length > 1e-7)) continue;
    const half = (line.width || 3) / 2, ox = -dy / length * half * 2 / w, oy = dx / length * half * 2 / h;
    const color = new Color(line.color).convertLinearToSRGB(), vertex = (x, y, z) => [x, y, z, color.r, color.g, color.b, line.opacity, 0, 0];
    packed.push(...vertex(ax + ox, ay + oy, az), ...vertex(ax - ox, ay - oy, az), ...vertex(bx + ox, by + oy, bz), ...vertex(bx + ox, by + oy, bz), ...vertex(ax - ox, ay - oy, az), ...vertex(bx - ox, by - oy, bz));
  }
  return new Float32Array(packed);
}
