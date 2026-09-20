import { Matrix4, Vector3, Quaternion, Color } from 'three';
import { ModelRenderer } from 'war3-model';
import { allNodes, sampleNodeMatrices } from '../src/animation.js';
import { EVENT_TABLE_PATHS, parseEventName, parseSlk, resolveEventDefinition, activeEventInstances, sampleEventDecal } from './event-preview-data.js';
import { parseEventRenderModel } from './event-render-model.js';
import { resetPreviewEffects } from './warcraft-preview-adapter.js';

const pathKey = path => String(path || '').replaceAll('/', '\\').toLowerCase();
const readText = bytes => new TextDecoder().decode(bytes);

function destroyRenderer(native) {
  const destroyShader = native.destroyShaderProgramObject;
  if (destroyShader) native.destroyShaderProgramObject = function (shader) { if (shader) return destroyShader.call(this, shader); };
  try { native.destroy(); } catch (cause) { console.warn('Event renderer cleanup:', cause); }
}

function preserveGLState(gl) {
  const names = ['CURRENT_PROGRAM','VERTEX_ARRAY_BINDING','ARRAY_BUFFER_BINDING','ACTIVE_TEXTURE','DEPTH_WRITEMASK','DEPTH_FUNC','BLEND_SRC_RGB','BLEND_DST_RGB','BLEND_SRC_ALPHA','BLEND_DST_ALPHA','BLEND_EQUATION_RGB','BLEND_EQUATION_ALPHA','POLYGON_OFFSET_FACTOR','POLYGON_OFFSET_UNITS','CULL_FACE_MODE','FRONT_FACE'];
  const state = Object.fromEntries(names.map(name => [name,gl.getParameter(gl[name])]));
  const enabled = [gl.BLEND,gl.DEPTH_TEST,gl.CULL_FACE,gl.POLYGON_OFFSET_FILL].map(name => [name,gl.isEnabled(name)]);
  const textures = [];
  for (let i = 0; i < Math.min(8,gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)); i++) { gl.activeTexture(gl.TEXTURE0+i); textures.push(gl.getParameter(gl.TEXTURE_BINDING_2D)); }
  gl.activeTexture(state.ACTIVE_TEXTURE);
  return () => {
    textures.forEach((texture,i) => { gl.activeTexture(gl.TEXTURE0+i); gl.bindTexture(gl.TEXTURE_2D,texture); }); gl.activeTexture(state.ACTIVE_TEXTURE);
    gl.useProgram(state.CURRENT_PROGRAM); gl.bindVertexArray(state.VERTEX_ARRAY_BINDING); gl.bindBuffer(gl.ARRAY_BUFFER,state.ARRAY_BUFFER_BINDING);
    gl.depthMask(state.DEPTH_WRITEMASK); gl.depthFunc(state.DEPTH_FUNC);
    gl.blendFuncSeparate(state.BLEND_SRC_RGB,state.BLEND_DST_RGB,state.BLEND_SRC_ALPHA,state.BLEND_DST_ALPHA); gl.blendEquationSeparate(state.BLEND_EQUATION_RGB,state.BLEND_EQUATION_ALPHA);
    gl.polygonOffset(state.POLYGON_OFFSET_FACTOR,state.POLYGON_OFFSET_UNITS); gl.cullFace(state.CULL_FACE_MODE); gl.frontFace(state.FRONT_FACE);
    for (const [name,value] of enabled) value ? gl.enable(name) : gl.disable(name);
  };
}

function createDecalRenderer(gl) {
  const compile = (type, source) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message); }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
uniform mat4 transform; uniform vec4 atlas; uniform float extent; out vec2 uv;
void main(){ vec2 p[6]=vec2[6](vec2(-1.,-1.),vec2(1.,-1.),vec2(1.,1.),vec2(-1.,-1.),vec2(1.,1.),vec2(-1.,1.)); vec2 v=p[gl_VertexID]; uv=mix(atlas.xy,atlas.zw,vec2(1.-v.y,1.-v.x)*.5); gl_Position=transform*vec4(v*extent,0.,1.); }`);
  const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float; in vec2 uv; uniform sampler2D image; uniform vec4 tint; out vec4 color;
void main(){color=texture(image,uv)*tint; if(color.a<.001)discard;}`);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const uniforms = Object.fromEntries(['transform', 'atlas', 'extent', 'image', 'tint'].map(name => [name, gl.getUniformLocation(program, name)]));
  const vao = gl.createVertexArray(), projection = new Matrix4();
  return {
    render(texture, item, world, camera) {
      const previous = { program:gl.getParameter(gl.CURRENT_PROGRAM), vao:gl.getParameter(gl.VERTEX_ARRAY_BINDING), active:gl.getParameter(gl.ACTIVE_TEXTURE), depthMask:gl.getParameter(gl.DEPTH_WRITEMASK) };
      gl.activeTexture(gl.TEXTURE0); const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.useProgram(program); gl.bindVertexArray(vao); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
      const mode = item.definition.blendMode;
      if (mode === 0) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      else if (mode === 1) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else if (mode === 2) gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
      else if (mode === 3) gl.blendFunc(gl.DST_COLOR, gl.SRC_COLOR);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      // A decal overlays the ground; bias only this deliberately coplanar quad.
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1);
      const sampled = sampleEventDecal(item.definition, item.ageMs);
      projection.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(world);
      gl.uniformMatrix4fv(uniforms.transform, false, projection.elements); gl.uniform4fv(uniforms.atlas, sampled.uv);
      gl.uniform1f(uniforms.extent, item.definition.scale); gl.uniform1i(uniforms.image, 0); gl.uniform4fv(uniforms.tint, sampled.color);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(previous.depthMask); gl.bindTexture(gl.TEXTURE_2D, previousTexture); gl.activeTexture(previous.active);
      gl.bindVertexArray(previous.vao); gl.useProgram(previous.program);
    },
    dispose() { gl.deleteVertexArray(vao); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); },
  };
}

/** Actual WC3 event assets on the native preview context. Instances are derived
 * from the authored timeline, with per-instance effects reset when rewinding. */
export function createEventPreview({ gl, model, modelPath, textureAssets, textureFromAsset, invalidate, onWarnings, desktop = window.desktop }) {
  let disposed = false, loaded = false, decals;
  const definitions = new Map(), resources = new Map(), instances = new Map(), textures = new Set(), warnings = [];
  const assets = new Map([...(textureAssets instanceof Map ? textureAssets : new Map(Object.entries(textureAssets || {})))].map(([name, asset]) => [pathKey(name), asset]));
  const warn = message => { warnings.push(message); if (!disposed) onWarnings?.([...warnings]); };
  async function resolve(names) {
    const unique = [...new Set(names.filter(Boolean))], found = new Map();
    for (const name of unique) if (assets.has(pathKey(name))) found.set(pathKey(name), assets.get(pathKey(name)));
    const missing = unique.filter(name => !found.has(pathKey(name)));
    if (missing.length && desktop?.resolveEventResources) for (const record of await desktop.resolveEventResources({ names: missing, path: modelPath })) if (record.bytes) found.set(pathKey(record.name), record);
    return found;
  }
  async function decode(asset, info) {
    const texture = await textureFromAsset(asset, info);
    try {
      if (texture.image?.data) return new ImageData(new Uint8ClampedArray(texture.image.data), texture.image.width, texture.image.height);
      return texture.image;
    } finally { texture.dispose(); }
  }
  async function load() {
    const names = [...new Set((model.EventObjects || []).map(event => event.Name))];
    const recognized = names.filter(name => parseEventName(name));
    if (!recognized.length) { loaded = true; return; }
    if (!desktop?.resolveEventResources) { warn('Event effects need access to their Warcraft game resources.'); loaded = true; return; }
    try {
      const tableRecords = await resolve([...new Set(recognized.map(name => EVENT_TABLE_PATHS[parseEventName(name).type]))]);
      const tables = new Map([...tableRecords].map(([path, record]) => [path, parseSlk(readText(record.bytes))]));
      for (const name of recognized) {
        const definition = resolveEventDefinition(name, tables);
        if (definition) definitions.set(name, definition); else warn(`Event ${name}: its Warcraft event table entry is unavailable.`);
      }
      const records = await resolve([...definitions.values()].map(definition => definition.resourcePath));
      for (const definition of definitions.values()) {
        if (disposed) break;
        const key = pathKey(definition.resourcePath); if (resources.has(key)) { if (definition.type === 'SPN') definition.lifeSpanMs = resources.get(key).lifeSpanMs; continue; }
        const asset = records.get(key);
        if (!asset) { warn(`Event resource unavailable: ${definition.resourcePath}`); continue; }
        try {
          if (definition.type === 'SPN') {
            const source = parseEventRenderModel(asset.bytes, definition.resourcePath);
            if (source.ParticleEmitterPopcorns?.length) warn(`Event ${definition.resourcePath} contains Popcorn effects, which this renderer cannot display.`);
            const nodes = allNodes(source); source.Nodes = []; for (const node of nodes) source.Nodes[node.ObjectId] = node;
            if (!source.Sequences?.length) source.Sequences = [{ Name:'Event', Interval:new Uint32Array([0,1000]), NonLooping:true }];
            const [start, end] = source.Sequences[0].Interval;
            definition.lifeSpanMs = Math.max(1, end - start);
            const images = new Map(), imageRecords = await resolve((source.Textures || []).map(info => info.Image));
            for (const info of source.Textures || []) if (info.Image && !info.ReplaceableId) {
              const imageAsset = imageRecords.get(pathKey(info.Image));
              if (imageAsset) images.set(info.Image, await decode(imageAsset, info));
              else warn(`Event texture unavailable: ${info.Image}`);
            }
            resources.set(key, { source, images, lifeSpanMs:definition.lifeSpanMs });
          } else {
            const image = await decode(asset, { Image:definition.resourcePath });
            if (disposed) break;
            const texture = gl.createTexture(); textures.add(texture);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
            const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            resources.set(key, { texture });
          }
        } catch (cause) { warn(`Event ${definition.resourcePath}: ${cause.message}`); }
      }
    } catch (cause) { warn(`Event resources: ${cause.message}`); }
    loaded = true; if (!disposed) invalidate?.();
  }
  const ready = load();
  function worldAtTrigger(item, frame, sequenceIndex, globalTime) {
    const interval = model.Sequences?.[sequenceIndex]?.Interval || [0,1], duration = interval[1] - interval[0];
    const globalEvent = (item.event.GlobalSeqId ?? item.event.GlobalSequenceId ?? -1) >= 0;
    const triggerPose = globalEvent && duration > 0 ? interval[0] + ((frame - interval[0] - item.ageMs) % duration + duration) % duration : item.triggerFrame;
    const matrices = sampleNodeMatrices(model, triggerPose, sequenceIndex, globalTime - item.ageMs), world = matrices.get(item.event.ObjectId)?.clone() || new Matrix4();
    const pivot = new Vector3().fromArray(item.event.PivotPoint || model.PivotPoints?.[item.event.ObjectId] || [0,0,0]).applyMatrix4(world);
    world.setPosition(pivot);
    if (item.definition.type !== 'SPN') { const rotation = new Quaternion(), scale = new Vector3(); world.decompose(new Vector3(),rotation,scale); world.compose(pivot,rotation,new Vector3(1,1,1)); }
    return world;
  }
  return {
    ready, get isReady() { return loaded; },
    render({ frame, sequenceIndex, globalTime, camera, teamColor }) {
      if (disposed || !loaded) return;
      const restore = preserveGLState(gl);
      try {
      const active = activeEventInstances(model, definitions, { frame, sequenceIndex, globalTime, maxInstances:64 }), keys = new Set(active.map(item => item.key));
      for (const [key, state] of instances) if (!keys.has(key)) { if (state.native) destroyRenderer(state.native); if (state.vao) gl.deleteVertexArray(state.vao); instances.delete(key); }
      for (const item of active) {
        const resource = resources.get(pathKey(item.definition.resourcePath)); if (!resource) continue;
        let state = instances.get(item.key);
        if (!state) {
          state = { world:worldAtTrigger(item,frame,sequenceIndex,globalTime), age:-1 }; instances.set(item.key,state);
          if (resource.source) {
            try {
              state.vao = gl.createVertexArray(); gl.bindVertexArray(state.vao);
              state.native = new ModelRenderer(structuredClone(resource.source)); state.native.initGL(gl); state.native.setSequence(0);
              if (state.native.ribbonsController) {
                const controller = state.native.ribbonsController, update = controller.update; let previous = Date.now();
                controller.update = function(delta) { const now = Date.now(), shift = now - previous - delta; previous = now; for (const emitter of this.emitters || []) for (let i = 0; i < emitter.creationTimes.length; i++) emitter.creationTimes[i] += shift; return update.call(this, delta); };
              }
              for (const [name,image] of resource.images) image.data ? state.native.setTextureImageData(name,[image]) : state.native.setTextureImage(name,image);
            } catch (cause) { if (state.native) destroyRenderer(state.native); state.native = null; state.failed = true; warn(`Event renderer: ${cause.message}`); }
          }
        }
        if (state.failed) continue;
        if (resource.texture) { if (item.ageMs < state.age) state.world = worldAtTrigger(item,frame,sequenceIndex,globalTime); state.age = item.ageMs; decals ||= createDecalRenderer(gl); decals.render(resource.texture,item,state.world,camera); continue; }
        const native = state.native, start = resource.source.Sequences[0].Interval[0];
        if (item.ageMs < state.age || state.age < 0) { resetPreviewEffects(native); native.setFrame(start); state.age = 0; state.world = worldAtTrigger(item,frame,sequenceIndex,globalTime); }
        let remaining = item.ageMs - state.age;
        while (remaining > 1e-6) { const step = Math.min(20,remaining); native.update(step); remaining -= step; }
        native.setFrame(start + item.ageMs); native.update(0); state.age = item.ageMs;
        const inverse = state.world.clone().invert(), position = camera.position.clone().applyMatrix4(inverse);
        const rotation = new Quaternion().setFromRotationMatrix(inverse).multiply(camera.quaternion).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.PI/2));
        native.setCamera(position.toArray(),rotation.toArray());
        const color = new Color(teamColor || '#ff0000'); native.setTeamColor([color.r,color.g,color.b]);
        const matrix = new Matrix4().multiplyMatrices(camera.matrixWorldInverse,state.world);
        gl.bindVertexArray(state.vao); gl.depthFunc(gl.LEQUAL); native.render(matrix.elements,camera.projectionMatrix.elements,{wireframe:false,useEnvironmentMap:false});
      }
      } finally { restore(); }
    },
    dispose() { disposed = true; for (const state of instances.values()) { if (state.native) destroyRenderer(state.native); if (state.vao) gl.deleteVertexArray(state.vao); } instances.clear(); decals?.dispose(); for (const texture of textures) gl.deleteTexture(texture); textures.clear(); },
  };
}
