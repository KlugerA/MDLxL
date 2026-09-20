/** Draw the cosmetic background into the destination before WC3 materials.
 * Additive/modulate layers must see the actual background in their blend target.
 */
export function createGLPreviewBackground(gl) {
  const compile = (type, source) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error); }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
out vec2 uv;
void main(){ vec2 positions[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));vec2 p=positions[gl_VertexID];uv=(p+1.)*.5;gl_Position=vec4(p,0.,1.); }`);
  const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float;in vec2 uv;uniform sampler2D background;out vec4 color;
void main(){ color=vec4(texture(background,uv).rgb,1.); }`);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const error = gl.getProgramInfoLog(program); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); throw new Error(error); }
  const texture = gl.createTexture(), sampler = gl.getUniformLocation(program, 'background');
  let canvas, dirty = true;
  return {
    update(source) { canvas = source; dirty = true; },
    draw() {
      if (!canvas) return;
      const previous = { program: gl.getParameter(gl.CURRENT_PROGRAM), active: gl.getParameter(gl.ACTIVE_TEXTURE), blend: gl.isEnabled(gl.BLEND), depth: gl.isEnabled(gl.DEPTH_TEST), cull: gl.isEnabled(gl.CULL_FACE), depthMask: gl.getParameter(gl.DEPTH_WRITEMASK) };
      gl.activeTexture(gl.TEXTURE0); const priorTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (dirty) {
        const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), premultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply); dirty = false;
      }
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.depthMask(false);
      gl.useProgram(program); gl.uniform1i(sampler, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(previous.program); gl.bindTexture(gl.TEXTURE_2D, priorTexture); gl.activeTexture(previous.active); gl.depthMask(previous.depthMask);
      for (const [name, enabled] of [[gl.BLEND, previous.blend], [gl.DEPTH_TEST, previous.depth], [gl.CULL_FACE, previous.cull]]) enabled ? gl.enable(name) : gl.disable(name);
    },
    dispose() { gl.deleteTexture(texture); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); },
  };
}
