import { sampleTrack, sampleGeosetAnimation } from '../src/animation.js';
import { previewLighting } from '../src/preview-lighting.js';

/** war3-model 4.0.1 omits geoset RGB and fractional alpha in its mesh shader. */
export function patchWarcraftMeshFragmentShader(source) {
  if (!source.includes('uniform mat3 uTVertexAnim;') || !source.includes('uniform float uWireframe;')) return source;
  const output = source.includes('out vec4 FragColor;') ? 'FragColor' : source.includes('gl_FragColor') ? 'gl_FragColor' : null;
  if (!output) return source;
  const hd = source.includes('uniform vec3 uLightPos;');
  const legacyLighting = hd
    ? `    if (uMdlxlLighting < .5) ${output}.rgb = pow(baseColor.rgb, vec3(1. / gamma));\n`
    : `    if (uMdlxlLighting > .5) ${output}.rgb *= .55 + .45 * max(0., dot(normalize(vNormal), normalize(uMdlxlLightDirection)));\n`;
  const lighting = `    if (uMdlxlSurface > .5) { ${output}.rgb = vec3(.663, .714, .757); ${hd ? 'baseColor.rgb = mdlxlDecodeSRGB(vec3(.663, .714, .757));' : ''} }\n    ${hd ? '' : `if (uMdlxlPortrait > .5) { if (uMdlxlLighting > .5) ${output}.rgb *= vMdlxlPortraitLight; } else `}if (uMdlxlLegacy > .5) {\n${legacyLighting}    } else if (uMdlxlLighting > .5) {
        vec3 inspectionNormal = ${hd ? 'normal' : 'vNormal'};
        inspectionNormal = dot(inspectionNormal, inspectionNormal) > 1.e-12 ? normalize(inspectionNormal) : normalize(uMdlxlViewDirection);
        ${hd ? '// HD normal mapping already accounts for face orientation.' : 'if (!gl_FrontFacing) inspectionNormal = -inspectionNormal;'}
        vec3 inspectionLight = normalize(uMdlxlLightDirection);
        float inspectionDiffuse = max(0., dot(inspectionNormal, inspectionLight));
        vec3 inspectionHalf = normalize(inspectionLight + normalize(uMdlxlViewDirection));
        float inspectionSpecular = inspectionDiffuse > 0. ? pow(max(0., dot(inspectionNormal, inspectionHalf)), max(.0001, uMdlxlPower)) : 0.;
        vec3 inspectionBase = ${hd ? 'baseColor.rgb' : `mdlxlDecodeSRGB(max(${output}.rgb, vec3(0.)))`};
        ${output}.rgb = mdlxlEncodeSRGB(max(inspectionBase * (uMdlxlAmbient + uMdlxlDiffuse * inspectionDiffuse) + uMdlxlSpecular * inspectionSpecular, vec3(0.)));
    }${hd ? ` else { ${output}.rgb = pow(baseColor.rgb, vec3(1. / gamma)); }` : ''}\n`;
  // This renderer uses WebGL2, but upstream SD shaders still use GLSL 100.
  // Upgrade both stages so derivatives are available without a WebGL1 extension.
  const header = source.startsWith('#version 300 es') ? '' : '#version 300 es\nprecision highp float;\nout vec4 mdlxlFragmentColor;\n#define gl_FragColor mdlxlFragmentColor\n';
  if (header) source = source.replace(/\bvarying\b/g, 'in').replace(/\btexture2D\b/g, 'texture').replace(/\btextureCube\b/g, 'texture');
  return header + source.replace('precision mediump float;', 'precision highp float;')
    .replace(/void main\s*\(/, `${hd ? '' : 'uniform float uMdlxlPortrait;\nin float vMdlxlPortraitLight;\n'}void main(`)
    .replace(/void main\s*\(/, `vec3 mdlxlDecodeSRGB(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(vec3(.04045), c)); }\nvec3 mdlxlEncodeSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(vec3(.0031308), c)); }\nvoid main(`)
    .replace('uniform float uWireframe;', 'uniform float uWireframe;\nuniform vec4 uMdlvisGeosetTint;\nuniform float uMdlxlLighting;\nuniform vec3 uMdlxlLightDirection;\nuniform float uMdlxlCoverage;\nuniform float uMdlxlSurface;\nuniform vec3 uMdlxlAmbient;\nuniform vec3 uMdlxlDiffuse;\nuniform vec3 uMdlxlSpecular;\nuniform float uMdlxlPower;\nuniform float uMdlxlLegacy;\nuniform vec3 uMdlxlViewDirection;')
    .replace(/if \((?:gl_FragColor|FragColor)\[3\] < uDiscardAlphaLevel\) \{\s*discard;\s*}/, `if (uDiscardAlphaLevel > 0. && uMdlxlCoverage > .5) {\n        float edge = max(fwidth(${output}.a), .001);\n        ${output}.a = smoothstep(uDiscardAlphaLevel - edge, uDiscardAlphaLevel + edge, ${output}.a);\n        if (${output}.a <= 0.) discard;\n    } else if (${output}.a < uDiscardAlphaLevel) { discard; }`)
    .replace(/}\s*$/, `${lighting}    ${output} *= uMdlvisGeosetTint;\n}\n`);
}

/** The upstream SD vertex shader skins positions but leaves normals in bind pose. */
export function patchWarcraftMeshVertexShader(source) {
  if (source.includes('aNormal') && source.includes('uMVMatrix') && source.includes('vTextureCoord') && !source.startsWith('#version 300 es')) source = '#version 300 es\n' + source.replace(/\battribute\b/g, 'in').replace(/\bvarying\b/g, 'out');
  if (!source.includes('aGroup') || !source.includes('vNormal = aNormal;')) return source;
  return source.replace(/void main\s*\(/, 'uniform vec3 uMdlxlLightDirection;\nout float vMdlxlPortraitLight;\nvoid main(')
    .replace('vNormal = aNormal;', `vec3 posedNormal = mat3(uNodesMatrices[int(aGroup[0])]) * aNormal;
    if (aGroup[1] < \${MAX_NODES}.) posedNormal += mat3(uNodesMatrices[int(aGroup[1])]) * aNormal;
    if (aGroup[2] < \${MAX_NODES}.) posedNormal += mat3(uNodesMatrices[int(aGroup[2])]) * aNormal;
    if (aGroup[3] < \${MAX_NODES}.) posedNormal += mat3(uNodesMatrices[int(aGroup[3])]) * aNormal;
    vNormal = normalize(posedNormal);
    // Classic portrait lighting is vertex-lit, clamped, and multiplied directly
    // into texture RGB (not the editor's linear/sRGB inspection lighting).
    vMdlxlPortraitLight = clamp(.3 + max(0., dot(vNormal, normalize(uMdlxlLightDirection))), 0., 1.);`.replaceAll('${MAX_NODES}', /uNodesMatrices\[(\d+)\]/.exec(source)?.[1] || '256'));
}

export function previewGeosetTint(model, geosetIndex, layer, frame, sequenceIndex, globalTime = frame) {
  const options = { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime };
  const evaluated = sampleGeosetAnimation(model, geosetIndex, frame, sequenceIndex, globalTime), rgb = evaluated.color;
  const alpha = Math.max(0, Math.min(1, evaluated.alpha * sampleTrack(layer?.Alpha, frame, { ...options, fallback: 1 })));
  return [...Array.from(rgb, value => Math.max(0, Math.min(1, value)) * (layer?.FilterMode === 3 ? alpha : 1)), alpha];
}

export function resetPreviewEffects(native) {
  for (const emitter of native.particlesController?.emitters || []) {
    emitter.particles.length = 0; emitter.emission = 0; emitter.squirtFrame = -1;
  }
  for (const emitter of native.ribbonsController?.emitters || []) { emitter.creationTimes.length = 0; emitter.emission = 0; }
}

/** All hooks belong to this preview's private WebGL context, not global GL. */
export function installWarcraftPreviewAdapter(gl, model, getClock) {
  const original = { shaderSource: gl.shaderSource, bindBuffer: gl.bindBuffer, useProgram: gl.useProgram, drawElements: gl.drawElements };
  gl.shaderSource = function (shader, source) { return original.shaderSource.call(this, shader, patchWarcraftMeshVertexShader(patchWarcraftMeshFragmentShader(source))); };
  let native, location, lightingLocation, lightDirectionLocation, portraitLocation, coverageLocation, surfaceLocation, lightUniforms, activeProgram, elementBuffer, activeLayer, byIndexBuffer, setLayerProps, setLayerPropsHD, renderRibbons, updateRibbons;
  return {
    ready(renderer) {
      native = renderer; gl.shaderSource = original.shaderSource;
      location = gl.getUniformLocation(native.shaderProgram, 'uMdlvisGeosetTint');
      lightingLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlLighting');
      lightDirectionLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlLightDirection');
      portraitLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlPortrait');
      coverageLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlCoverage');
      surfaceLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlSurface');
      lightUniforms = Object.fromEntries(['Ambient', 'Diffuse', 'Specular', 'Power', 'Legacy', 'ViewDirection'].map(name => [name, gl.getUniformLocation(native.shaderProgram, `uMdlxl${name}`)]));
      if (!location) throw new Error('The Warcraft preview shader is incompatible with geoset color editing.');
      byIndexBuffer = new Map(native.indexBuffer.map((buffer, index) => [buffer, index]));
      setLayerProps = native.setLayerProps; setLayerPropsHD = native.setLayerPropsHD;
      native.setLayerProps = function (layer, textureID) { activeLayer = layer; return setLayerProps.call(this, layer, textureID); };
      native.setLayerPropsHD = function (materialID, layers) { activeLayer = layers[0]; return setLayerPropsHD.call(this, materialID, layers); };
      if (native.ribbonsController) {
        updateRibbons = native.ribbonsController.update;
        let ribbonWallClock = Date.now();
        native.ribbonsController.update = function (delta) {
          const now = Date.now(), adjustment = now - ribbonWallClock - delta; ribbonWallClock = now;
          // Upstream ribbons use wall-clock birth times. Shift those times so
          // their ages advance only by the simulated delta, including pause.
          for (const emitter of this.emitters || []) for (let i = 0; i < emitter.creationTimes.length; i++) emitter.creationTimes[i] += adjustment;
          return updateRibbons.call(this, delta);
        };
        renderRibbons = native.ribbonsController.render;
        native.ribbonsController.render = function (...args) {
          const { frame, sequenceIndex, globalTime } = getClock(), replacements = [];
          for (const emitter of this.emitters || []) if (emitter.props.Color?.Keys) {
            const color = emitter.props.Color; replacements.push([emitter.props, color]);
            emitter.props.Color = new Float32Array(sampleTrack(color, frame, { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime, fallback: [1, 1, 1] }));
          }
          try { return renderRibbons.apply(this, args); }
          finally { for (const [props, color] of replacements) props.Color = color; }
        };
      }
      gl.useProgram = function (program) { activeProgram = program; return original.useProgram.call(this, program); };
      gl.bindBuffer = function (target, buffer) { if (target === this.ELEMENT_ARRAY_BUFFER) elementBuffer = buffer; return original.bindBuffer.call(this, target, buffer); };
      gl.drawElements = function (...args) {
        const geosetIndex = activeProgram === native.shaderProgram ? byIndexBuffer.get(elementBuffer) : undefined;
        if (geosetIndex !== undefined) {
          if (getClock().hiddenGeosets?.has?.(geosetIndex) || Array.isArray(getClock().hiddenGeosets) && getClock().hiddenGeosets.includes(geosetIndex)) return;
          const surface = getClock().surface;
          if (surface && activeLayer !== model.Materials?.[model.Geosets[geosetIndex].MaterialID]?.Layers?.[0]) return;
          if (surfaceLocation) this.uniform1f(surfaceLocation, surface ? 1 : 0);
          const { frame, sequenceIndex, globalTime } = getClock();
          const tint = previewGeosetTint(model, geosetIndex, activeLayer, frame, sequenceIndex, globalTime);
          if (tint[3] <= 1e-6) return;
          this.uniform4fv(location, tint);
          if (lightingLocation) this.uniform1f(lightingLocation, getClock().lighting !== false && !(activeLayer?.Shading & 1) ? 1 : 0);
          if (portraitLocation) this.uniform1f(portraitLocation, getClock().portrait ? 1 : 0);
          if (lightDirectionLocation) this.uniform3fv(lightDirectionLocation, getClock().lightDirection || [-.65, .55, 1]);
          const lighting = previewLighting(getClock().preferences);
          for (const name of ['Ambient', 'Diffuse', 'Specular']) if (lightUniforms[name]) this.uniform3fv(lightUniforms[name], lighting[name.toLowerCase()]);
          if (lightUniforms.Power) this.uniform1f(lightUniforms.Power, lighting.power);
          if (lightUniforms.Legacy) this.uniform1f(lightUniforms.Legacy, lighting.preset === 'legacy' ? 1 : 0);
          if (lightUniforms.ViewDirection) this.uniform3fv(lightUniforms.ViewDirection, getClock().viewDirection || [0, 0, 1]);
          const coverage = activeLayer?.FilterMode === 1 && !!gl.getContextAttributes()?.antialias;
          if (coverageLocation) this.uniform1f(coverageLocation, coverage ? 1 : 0);
          if (coverage) this.enable(this.SAMPLE_ALPHA_TO_COVERAGE);
          else this.disable(this.SAMPLE_ALPHA_TO_COVERAGE);
          if (tint[3] < .999999 && (activeLayer?.FilterMode ?? 0) <= 1) {
            this.enable(this.BLEND); this.blendFuncSeparate(this.SRC_ALPHA, this.ONE_MINUS_SRC_ALPHA, this.ONE, this.ONE_MINUS_SRC_ALPHA); this.depthMask(false);
          }
        }
        try { return original.drawElements.apply(this, args); }
        finally { if (geosetIndex !== undefined) this.disable(this.SAMPLE_ALPHA_TO_COVERAGE); }
      };
    },
    dispose() {
      Object.assign(gl, original);
      if (native && setLayerProps) native.setLayerProps = setLayerProps;
      if (native && setLayerPropsHD) native.setLayerPropsHD = setLayerPropsHD;
      if (native?.ribbonsController && renderRibbons) native.ribbonsController.render = renderRibbons;
      if (native?.ribbonsController && updateRibbons) native.ribbonsController.update = updateRibbons;
    },
  };
}
