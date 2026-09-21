import {createPaintLampObject,paintLampDrag} from './paint-lamps.js';
import {paintRowRanges,acknowledgePaintUpload} from '../src/paint-preview.js';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EditorCameraControls, zoomEditorCamera, editorCameraAngles, setEditorCameraAngles } from './editor-camera-controls.js';
import { previewLighting, configurePreviewLights, applyPreviewMaterialLighting } from './preview-lighting.js';
import { viewportCursor } from './viewport-cursors.js';
import { createPreviewPlatform } from './preview-platform.js';
import { drawPreviewGeometryOverlay, drawPresentationOverlay } from './preview-overlays.js';
import { previewPresentationProps, previewOverlaySettings } from './preview-presentation.js';
import { drawMovementOverlay, projectMovementNodes } from './movement-overlay.js';
import { samplePreviewMatrices } from './preview-pose.js';
import { projectPreviewGeosets, pickPreviewGeoset } from './preview-selection.js';
import { configureEditorTexture, configurePaintTexture, cameraLeftLight, viewportPixelRatio } from './viewport-quality.js';
import { createRigMarkersGL } from './rig-markers-gl.js';
import { drawModelCameraOverlay } from './model-camera-overlay.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { needsSolidDepthPrepass } from './preview-depth.js';
import { decodeBLP, getBLPImageData } from 'war3-model';
import { decodePaintBlp } from '../src/paint-blp.js';
import { advanceSequence, allNodes, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset, skinGeosetNormals } from '../src/animation.js';
import { decodeDds } from '../src/dds.js';
import { decodeBlp2 } from '../src/blp2.js';
import { applySelection, dragScale, insideTriangle, marqueeContainsPoint, planeAxes } from './classic-gestures.js';
import { bindScrollSensitivity, createRenderScheduler, graphicsOptions, pointerDragPoint, pointerSensitivityValue, sensitivityIndicatorStyle, sensitivityIndicatorText } from './viewport-performance.js';
import { viewportOverlayOptions } from './viewport-overlays.js';

import { applyViewPreset, applyModelCamera, updateDepthClipping, modelClipRadius, projectedPlaneTranslation, screenPlaneTranslation } from './viewport-math.js';
import { createViewportGrid } from './viewport-grid.js';
import { visualOptions, viewportAppearanceOptions, gridOptions, cameraBindings } from '../src/preferences.js';
import { backgroundImageRect } from '../src/viewport-appearance.js';
import { viewportPointDepth, viewportPointIndices } from './viewport-point-selection.js';
import { paintOutlinePositions } from '../src/paint-view.js';
import { createPaintLightUniforms, updatePaintLights, applyPaintLightShader } from './paint-lighting.js';

const COLORS = [0xa9b6c1, 0x8caca8, 0xb9aa94, 0x939bb5, 0xb499a6, 0x9eac8b];
const normalizedPath = path => String(path || '').replaceAll('/', '\\').toLowerCase();
const selectionArray = selection => Array.from(selection || []);
const asBuffer = bytes => bytes instanceof ArrayBuffer ? bytes : bytes?.buffer?.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
// Decoding BLP/TGA/DDS and browser images dominates repeated preview startup.
// Assets are immutable within a session, so retain CPU pixels/images while
// each viewport still creates and owns its own disposable GPU texture.
const decodedRasterCache = new WeakMap(), decodedImageCache = new WeakMap();

export async function textureFromAsset(asset, textureInfo = {}) {
  const buffer = asBuffer(asset?.bytes);
  let name = String(asset?.name || textureInfo.Image || '').toLowerCase();
  if (buffer && buffer.byteLength >= 4 && new DataView(buffer).getUint32(0,true) === 0x20534444) name = name.replace(/\.[^.]+$/, '.dds');
  let texture;
  if (buffer && name.endsWith('.blp')) {
    let pixels = decodedRasterCache.get(asset);
    if (!pixels) {try{const bytes=new Uint8Array(buffer);pixels=bytes[3]===50?decodeBlp2(buffer):getBLPImageData(decodeBLP(buffer),0);}catch{pixels=await decodePaintBlp(buffer);}decodedRasterCache.set(asset,pixels);}
    texture = new THREE.DataTexture(new Uint8Array(pixels.data), pixels.width, pixels.height, THREE.RGBAFormat);
    texture.needsUpdate = true;
  } else if (buffer && name.endsWith('.tga')) {
    let pixels = decodedRasterCache.get(asset); if (!pixels) { pixels = new TGALoader().parse(buffer); decodedRasterCache.set(asset, pixels); }
    texture = new THREE.DataTexture(pixels.data, pixels.width, pixels.height, THREE.RGBAFormat);
    texture.needsUpdate = true;
  } else if (buffer && name.endsWith('.dds')) {
    let pixels = decodedRasterCache.get(asset); if (!pixels) { pixels = decodeDds(buffer); decodedRasterCache.set(asset, pixels); }
    texture = new THREE.DataTexture(new Uint8Array(pixels.data), pixels.width, pixels.height, THREE.RGBAFormat);
    texture.needsUpdate = true;
  } else {
    let promise = asset && decodedImageCache.get(asset);
    if (!promise) {
      let url = asset?.url, temporary = false;
      if (!url && buffer) { url = URL.createObjectURL(new Blob([buffer])); temporary = true; }
      if (!url) throw new Error('Texture has no image data');
      promise = new THREE.TextureLoader().loadAsync(url).then(loaded => { const image = loaded.image; loaded.dispose(); return image; }).finally(() => { if (temporary) URL.revokeObjectURL(url); });
      if (asset) decodedImageCache.set(asset, promise);
    }
    try { texture = new THREE.Texture(await promise); texture.needsUpdate = true; }
    catch (cause) { if (asset) decodedImageCache.delete(asset); throw cause; }
  }
  // Warcraft UV origin is at the top of the image. Keep its V coordinates intact.
  texture.flipY = false;
  // Match the classic Warcraft sampler: filter encoded texels, then decode
  // exactly once in the mesh shader. This is independent of silhouette AA.
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = textureInfo.Flags & 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = textureInfo.Flags & 2 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return configureEditorTexture(texture);
}

function makeChecker() {
  const data = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const value = ((x >> 2) + (y >> 2)) % 2 ? 135 : 95, i = (y * 16 + x) * 4;
    data.set([value, value + 5, value + 10, 255], i);
  }
  const texture = new THREE.DataTexture(data, 16, 16);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter; texture.needsUpdate = true;
  return texture;
}

function makeTeamGlow() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const distance = Math.hypot((x + .5) / size - .5, (y + .5) / size - .5) * 2;
    const intensity = Math.round(Math.sin(Math.max(0, Math.min(1, 1 - distance * 1.4))) * 255);
    pixels.set([intensity, intensity, intensity, 255], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size); texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter; return texture;
}

function layerMaterial(layer, shaded = true, paintUniforms = null) {
  const shading = layer.Shading || 0, filter = layer.FilterMode || 0;
  const material = paintUniforms || !shaded || shading & 1 ? new THREE.MeshBasicMaterial() : new THREE.MeshPhongMaterial({ shininess: 9, specular: 0x1c242d });
  material.userData.geosetTint = { value: new THREE.Vector3(1, 1, 1) };
  material.onBeforeCompile = shader => {
    shader.uniforms.uMdlxlGeosetTint = material.userData.geosetTint;
    // Warcraft GeosetRGB multiplies the encoded final color. Applying it to
    // Three's linear material color makes intermediate authored RGB too bright.
    shader.fragmentShader = 'uniform vec3 uMdlxlGeosetTint;\n' + shader.fragmentShader.replace('#include <colorspace_fragment>', '#include <colorspace_fragment>\ngl_FragColor.rgb *= uMdlxlGeosetTint;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\nvec4 sampledDiffuseColor = sRGBTransferEOTF(texture2D(map, vMapUv));\ndiffuseColor *= sampledDiffuseColor;\n#endif');
    // Opposing shared faces can have a zero interpolated normal. Use the face
    // derivative only for this undefined case; never rewrite authored normals.
    if (material.isMeshPhongMaterial) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nif (!(dot(normal, normal) > 1.e-12)) normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));');
    if(paintUniforms)applyPaintLightShader(shader,paintUniforms,!!(shading&1));
  };
  material.customProgramCacheKey=()=>paintUniforms?'citadel-vertex-light-'+(shading&1):'mdlxl-layer';
  material.side = shading & 16 ? THREE.DoubleSide : THREE.FrontSide;
  material.depthTest = !(shading & 64);
  material.depthWrite = !(shading & 128) && filter < 2;
  material.transparent = filter >= 2;
  material.alphaTest = filter === 1 ? 0.75 : 0;
  if (filter === 3) {
    material.blending = THREE.CustomBlending; material.blendSrc = THREE.OneFactor; material.blendDst = THREE.OneFactor;
  } else if (filter === 4) material.blending = THREE.AdditiveBlending;
  else if (filter === 5 || filter === 6) {
    material.blending = THREE.CustomBlending; material.blendSrc = THREE.DstColorFactor; material.blendDst = filter === 6 ? THREE.SrcColorFactor : THREE.ZeroFactor;
  }
  material.userData.layerBlending = material.blending;
  return material;
}

function clearGroup(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  group.clear(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

function uniqueEdges(faces) {
  const seen = new Set(), edges = [];
  for (let i = 0; i < faces.length; i += 3) for (let corner = 0; corner < 3; corner++) {
    const a = Number(faces[i + corner]), b = Number(faces[i + (corner + 1) % 3]);
    const first = Math.min(a, b), last = Math.max(a, b), key = `${first}:${last}`;
    if (first === last || seen.has(key)) continue;
    seen.add(key); edges.push(first, last);
  }
  return edges;
}

function updateWideWireGeometry(entry) {
  if (!entry?.wireGeometry || !entry.edgeIndices) return;
  const source = entry.geometry.attributes.position.array, positions = new Float32Array(entry.edgeIndices.length * 3);
  for (let edge = 0; edge < entry.edgeIndices.length; edge++) {
    const vertex = entry.edgeIndices[edge], target = edge * 3, from = vertex * 3;
    positions[target] = source[from]; positions[target + 1] = source[from + 1]; positions[target + 2] = source[from + 2];
  }
  entry.wireGeometry.setPositions(positions); entry.wire.computeLineDistances();
}

function configureWideLine(material, appearance, width, height, hiddenOpacity = 1) {
  material.color.set(appearance.color); material.linewidth = appearance.thickness;
  material.opacity = appearance.opacity * hiddenOpacity; material.resolution.set(Math.max(1, width), Math.max(1, height));
  const dashed = appearance.style !== 'solid'; if (material.dashed !== dashed) { material.dashed = dashed; material.needsUpdate = true; }
  material.dashScale = 1; material.dashSize = appearance.style === 'dotted' ? .6 : 4; material.gapSize = appearance.style === 'dotted' ? 2.2 : 2.5;
}

function pointMarkerTexture(style) {
  if (style === 'square') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.beginPath();
  if (style === 'circle') context.arc(16, 16, 14, 0, Math.PI * 2);
  else { context.moveTo(16, 1); context.lineTo(31, 16); context.lineTo(16, 31); context.lineTo(1, 16); context.closePath(); }
  context.fill(); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.NoColorSpace; return texture;
}

function configurePointMaterial(material, appearance, texture) {
  material.color.set(appearance.color); material.size = appearance.size;
  const transparent = !!texture; if (material.map !== texture || material.transparent !== transparent) { material.map = texture; material.transparent = transparent; material.needsUpdate = true; }
  material.alphaTest = texture ? .45 : 0;
}

export default function Viewport(inputProps) {
  const props = previewPresentationProps(inputProps);
  const { model, revision = 0, selectedGeoset = 0, selectedVertices = [], hiddenGeosets, mode = 'vertices', shaded = true, showSkeleton = false, showGrid = true, view = 'front', cameraMode = 'work', workplane = 'xy', transformMode = 'select', sequenceIndex = -1, time = 0, playing = false, teamColor = '#ff0000', textureAssets } = props;
  const host = useRef(null), runtime = useRef(null), latest = useRef(props);
  latest.current = { ...props, selectedGeoset, selectedVertices, mode, showSkeleton, showGrid, view, cameraMode, workplane, transformMode, sequenceIndex, time, playing, teamColor };
  const [error, setError] = useState(''), [textureMessage, setTextureMessage] = useState(''), [backgroundMessage, setBackgroundMessage] = useState(''), [box, setBox] = useState(null);
  const paintCursor = useRef(null);
  const [adjustingSensitivity, setAdjustingSensitivity] = useState(null);
  const cameraMemory = useRef(null);
  const graphics = graphicsOptions(props.preferences);
  const textureSignature = (model?.Textures || []).map(texture => `${texture.Image}|${texture.Flags}|${texture.ReplaceableId}`).join('\n');
  const texturesNeeded = graphics.textures && (mode === 'textured' || props.paintMode);

  useEffect(() => {
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: graphics.antialias, alpha: false, powerPreference: 'high-performance' }); }
    catch (cause) { setError(`The 3D viewport could not start: ${cause.message}. Model data and the other editors remain available.`); return; }
    setError('');
    renderer.setPixelRatio(viewportPixelRatio(graphics, window.devicePixelRatio,latest.current.paintWorkspace));
    renderer.setClearColor(0xcccccc); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
    renderer.domElement.tabIndex = 0;
    host.current.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), modelGroup = new THREE.Group();
    scene.add(modelGroup);
    const perspective = new THREE.PerspectiveCamera(42, 1, .2, 1000);
    perspective.up.set(0, 0, 1); perspective.position.set(180, -260, 170);
    const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, .2, 1000);
    ortho.up.set(0, 0, 1);
    let camera = perspective;
    const controls = new EditorCameraControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.mouseButtons = { LEFT: null, MIDDLE: null, RIGHT: THREE.MOUSE.PAN };
    controls.target.set(0, 0, 45); controls.update();
    const ambient = new THREE.HemisphereLight(0xd4e7ff, 0x52514a, 2.2);
    ambient.position.set(0, 0, 300); scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffeed7, 2.8); key.position.set(200, -280, 350); scene.add(key);
    scene.add(key.target);
    let cameraCanvas, normalCanvas, nodeCanvas, previewCanvas, anchorCanvas, rotating = false;
    const grid = createViewportGrid(); scene.add(grid);
    const rigMarkers = createRigMarkersGL(renderer.getContext()); renderer.resetState();
    const platform = createPreviewPlatform(() => invalidate()); scene.add(platform);
    const backgroundCanvas = document.createElement('canvas'), backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
    backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    const state = { renderer, scene, modelGroup, perspective, ortho, camera, controls, grid, entries: [], nodes: [], textures: new Map(), markerTextures: new Map(), checker: makeChecker(), background: { canvas: backgroundCanvas, texture: backgroundTexture, data: null, image: null, status: 'idle', drawKey: '' }, frame: 0, lastExternalTime: undefined, sequenceIndex: -1, wasPlaying: false, drag: null, anchorCandidate: null, dirty: true, radius: 100, center: new THREE.Vector3(0, 0, 40), loadedSignature: null, selectionKey: '', disposed: false };
    runtime.current = state;
    latest.current.onPaintCameraReady?.(()=>({position:camera.position.toArray(),target:controls.target.toArray(),center:state.center.toArray(),radius:state.radius}));
    if (latest.current.paintWorkspace) {
      state.paintUniforms=createPaintLightUniforms();state.lampMarkers=new THREE.Group();scene.add(state.lampMarkers);
      const geometry = new LineSegmentsGeometry(), material = new LineMaterial({ color: 0x35d9ff, linewidth: 2, depthTest: true, depthWrite: false, transparent: true });
      state.paintOutline = new LineSegments2(geometry, material); state.paintOutline.frustumCulled = false; state.paintOutline.renderOrder = 14000; state.paintOutline.visible = false; scene.add(state.paintOutline);
    }
    state.teamGlow = makeTeamGlow();
    state.globalTime = 0;
    state.textureSources = new Map();
    const invalidate = () => { latest.current.onCameraAnglesChange?.(editorCameraAngles(camera)); state.scheduler?.invalidate(); };
    const markerTexture = style => {
      if (style === 'square') return null;
      if (!state.markerTextures.has(style)) state.markerTextures.set(style, pointMarkerTexture(style));
      return state.markerTextures.get(style);
    };
    function syncViewportBackground(appearance) {
      const config = latest.current.paintBackground || appearance.background, background = state.background;
      if (background.data !== config.imageData) {
        background.data = config.imageData; background.image = null; background.drawKey = ''; setBackgroundMessage('');
        if (config.imageData) {
          const picture = new Image(); background.status = 'loading';
          picture.onload = () => { if (state.disposed || background.data !== config.imageData) return; background.image = picture; background.status = 'ready'; background.drawKey = ''; setBackgroundMessage(''); invalidate(); };
          picture.onerror = () => { if (state.disposed || background.data !== config.imageData) return; background.status = 'failed'; background.image = null; setBackgroundMessage('Background image unavailable; using the preset color.'); invalidate(); };
          picture.src = config.imageData;
        } else background.status = 'idle';
      }
      if (config.type !== 'image' || !background.image) { scene.background = new THREE.Color(config.color); return; }
      const width = Math.max(1, renderer.domElement.width), height = Math.max(1, renderer.domElement.height);
      const key = `${width}|${height}|${config.color}|${config.display}|${config.opacity}`;
      if (background.drawKey !== key) {
        background.canvas.width = width; background.canvas.height = height;
        const context = background.canvas.getContext('2d'); context.globalAlpha = 1; context.fillStyle = config.color; context.fillRect(0, 0, width, height);
        const rect = backgroundImageRect(background.image.naturalWidth || background.image.width, background.image.naturalHeight || background.image.height, width, height, config.display);
        if (rect) { context.globalAlpha = config.opacity; context.drawImage(background.image, rect.x, rect.y, rect.width, rect.height); context.globalAlpha = 1; }
        background.texture.needsUpdate = true; background.drawKey = key;
      }
      scene.background = background.texture;
    }
    state.refreshCursor = () => { const p=latest.current;renderer.domElement.style.cursor=p.paintMode&&!p.paintSelectOnly&&!p.paintDisabled&&p.cameraMode==='work'&&!rotating?'none':viewportCursor(p.cameraMode,p.rotationNormals?'rotateNormals':p.transformMode,rotating); };
    state.setCameraAngles = values => { if (setEditorCameraAngles(camera, controls.target, values)) { controls.update(); invalidate(); } };
    controls.addEventListener('change', invalidate);
    const unbindScroll = bindScrollSensitivity(renderer.domElement, {
      getPreferences: () => latest.current.preferences,
      onChange: value => latest.current.onSensitivityChange?.(value), onIndicator: setAdjustingSensitivity,
      onPointerChange: value => latest.current.onPointerSensitivityChange?.(value),
      onWheelModeChange: value => latest.current.onWheelModeChange?.(value),
      // A Wisp left-button wheel gesture is a settings gesture, never a select or transform.
      onPointerAdjustment: () => cancelGesture(),
      onCameraModeToggle: () => latest.current.onCameraModeToggle?.(),
      onWheel: (_event, sensitivity) => { controls.zoomSpeed = sensitivity; },
    });

    function resize() {
      const width = Math.max(1, host.current?.clientWidth || 1), height = Math.max(1, host.current?.clientHeight || 1);
      renderer.setPixelRatio(viewportPixelRatio(graphicsOptions(latest.current.preferences), window.devicePixelRatio,latest.current.paintWorkspace));
      renderer.setSize(width, height, false); perspective.aspect = width / height; perspective.updateProjectionMatrix();
      const half = state.radius * 1.3; ortho.left = -half * width / height; ortho.right = half * width / height; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix();
      invalidate();
    }
    state.resize = resize;
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host.current); resize();
    state.fit = (selectionOnly = false) => {
      const bounds = new THREE.Box3();
      const p = latest.current;
      if (selectionOnly) {
        const active = editableGeosets(p);
        for (const [key, indices] of Object.entries(selections(p))) {
          const entry = state.entries[key], hidden = new Set(p.hiddenVertices?.[key] || []);
          if (!active.has(Number(key)) || !entry?.group.visible) continue;
          for (const index of selectionArray(indices)) if (index >= 0 && index < entry.geometry.attributes.position.count && !hidden.has(index)) bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(entry.geometry.attributes.position, index));
        }
      }
      if (bounds.isEmpty()) for (const [index, geo] of (p.model?.Geosets || []).entries()) {
        if (p.paintWorkspace && p.hiddenGeosets?.has(index)) continue;
        for (let i = 0; i < geo.Vertices.length; i += 3) bounds.expandByPoint(new THREE.Vector3().fromArray(geo.Vertices, i));
      }
      if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 100));
      bounds.getCenter(state.center); state.radius = Math.max(1, bounds.getSize(new THREE.Vector3()).length() / 2);
      state.floor = bounds.min.z;
      const direction = perspective.position.clone().sub(controls.target).normalize();
      const aspect = Math.max(.1, (host.current?.clientWidth || 1) / (host.current?.clientHeight || 1));
      const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) * Math.min(1, aspect));
      const fitDistance = p.paintWorkspace ? state.radius / Math.sin(halfFov) * 1.08 : state.radius * 3.2;
      perspective.position.copy(state.center).addScaledVector(direction.lengthSq() ? direction : new THREE.Vector3(1, -1.5, .9).normalize(), fitDistance);
      controls.target.copy(state.center); perspective.zoom = ortho.zoom = 1;
      resize(); state.setView(latest.current.view || 'front');
    };
    state.setView = next => {
      state.appliedView = next;
      if (next === 'perspective') camera = perspective;
      else if (next === 'orthographic') {
        const previous = camera; camera = ortho; camera.position.copy(previous.position); camera.quaternion.copy(previous.quaternion); camera.up.copy(previous.up);
      }
      else {
        camera = ortho; applyViewPreset(camera, next, controls.target, state.radius * 4);
      }
      controls.object = camera; controls.enableRotate = true;
      state.camera = camera; controls.update(); invalidate();
    };

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let down = null;
    function point(event) { const rect = renderer.domElement.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height }; }
    function editableGeosets(p) { return p.selectableGeosets == null ? new Set([p.selectedGeoset]) : new Set(p.selectableGeosets); }
    function selections(p) { return p.selectionByGeoset || { [p.selectedGeoset]: selectionArray(p.selectedVertices) }; }
    function screenPosition(value, rect) { const projected = value.clone().project(camera); return new THREE.Vector2((projected.x + 1) * rect.width / 2, (1 - projected.y) * rect.height / 2); }
    function emitSelection(p, next) {
      if (p.onSelectionChange) p.onSelectionChange(next);
      else p.onSelectVertices?.(next[p.selectedGeoset] || []);
    }
    function anchorVertexInMarquee(p, start, end) {
      const active = editableGeosets(p), selected = selections(p), screen = new THREE.Vector3(), radius = Math.max(5, visualOptions(p.preferences).vertexSize / 2);
      let first = null, firstDistance = Infinity;
      for (const geosetIndex of active) {
        const entry = state.entries[geosetIndex], hidden = new Set(p.hiddenVertices?.[geosetIndex] || []);
        if (!entry?.group.visible) continue;
        for (const index of selectionArray(selected[geosetIndex])) {
          if (hidden.has(index) || index < 0 || index >= entry.geometry.attributes.position.count) continue;
          screen.fromBufferAttribute(entry.geometry.attributes.position, index).project(camera); if (screen.z < -1 || screen.z > 1) continue;
          const point = [(screen.x + 1) * end.width / 2, (1 - screen.y) * end.height / 2];
          if (!marqueeContainsPoint(point, start, end, radius)) continue;
          const distance = Math.hypot(point[0] - start.x, point[1] - start.y);
          if (distance < firstDistance) { firstDistance = distance; first = { geosetIndex, vertexIndex: index }; }
        }
      }
      return first;
    }
    function cameraAction(event) {
      const p = latest.current;
      const binding = cameraBindings(p.preferences);
      if (event.button === 2 || event.button === 1) { const action = event.button === 2 ? binding.right : binding.middle; return action === 'pan' ? 'move' : action; }
      if (event.altKey) return 'rotate';
      return p.cameraMode;
    }
    function paintHit(event) {
      const p = latest.current, cursor = point(event);
      pointer.set(cursor.x / cursor.width * 2 - 1, 1 - cursor.y / cursor.height * 2); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(state.entries.flatMap(entry => entry?.meshes.filter(mesh => mesh.visible) || []), false), hit = hits.find(value => value.object.parent?.visible);
      if (!hit) return null;
      const geometry = hit.object.geometry, faceIndex = Number.isInteger(hit.faceIndex) ? hit.faceIndex : 0, index = geometry.index?.array, ids = index ? [index[faceIndex * 3], index[faceIndex * 3 + 1], index[faceIndex * 3 + 2]] : [faceIndex * 3, faceIndex * 3 + 1, faceIndex * 3 + 2];
      const position = geometry.attributes.position, a = new THREE.Vector3().fromBufferAttribute(position, ids[0]), b = new THREE.Vector3().fromBufferAttribute(position, ids[1]), c = new THREE.Vector3().fromBufferAttribute(position, ids[2]), barycentric = new THREE.Vector3();
      const localPoint = hit.object.worldToLocal(hit.point.clone());
      THREE.Triangle.getBarycoord(localPoint, a, b, c, barycentric);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), normal = hit.face?.normal?.clone() || new THREE.Vector3(); normal.transformDirection(hit.object.matrixWorld);
      const textureId = hit.object.userData.textureId, texture = Number.isInteger(textureId) ? p.model?.Textures?.[textureId] : null;
      return {
        geosetIndex: hit.object.userData.geosetIndex, materialId: hit.object.userData.materialId, layerIndex: hit.object.userData.layerIndex, textureId: textureId, coordId: hit.object.userData.coordId,
        textureTarget: { textureId, texturePath: texture?.Image || '', flags: Number(texture?.Flags) || 0 },
        triangle: faceIndex, vertexIds: ids, barycentric: barycentric.toArray(), uv: hit.uv?.toArray() || [0, 0], worldPosition: hit.point.toArray(), normal: normal.toArray(), depth: hit.point.clone().project(camera).z,
        screen: { x: cursor.x, y: cursor.y }, viewport: { width: cursor.width, height: cursor.height }, viewProjectionMatrix: viewProjection.elements.slice(),
      };
    }
    // OrbitControls is used only for navigation. Capture configures it before its handler runs.
    function pointerDown(event) {
      if (down) return;
      host.current?.focus();if(latest.current.paintWorkspace)latest.current.onPaintInteractionChange?.(true);
      const action = cameraAction(event);
      rotating = action === 'rotate'; latest.current.onCameraGestureChange?.(rotating);
      state.refreshCursor();
      controls.enabled = true;
      controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(latest.current.preferences?.pointerSensitivity);
      const binding = cameraBindings(latest.current.preferences), mouseAction = value => value === 'pan' ? THREE.MOUSE.PAN : value === 'rotate' ? THREE.MOUSE.ROTATE : value === 'zoom' ? THREE.MOUSE.DOLLY : null;
      controls.mouseButtons.RIGHT = mouseAction(binding.right); controls.mouseButtons.MIDDLE = mouseAction(binding.middle);
      controls.mouseButtons.LEFT = action === 'move' ? THREE.MOUSE.PAN : action === 'rotate' ? THREE.MOUSE.ROTATE : null;
      if (event.shiftKey && action !== 'work') controls.rotateSpeed = controls.panSpeed *= latest.current.preferences?.fineSensitivity ?? .2;
      if (action === 'move' || action === 'rotate') return;
      if (latest.current.presentation === 'preview' && action !== 'zoom') return;
      if (event.button !== 0) return;
      const p = latest.current, start = point(event);
      down = { ...start, pointerId: event.pointerId, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, pointerSensitivity: pointerSensitivityValue(p.preferences?.pointerSensitivity), action: action === 'zoom' ? 'zoom' : p.transformMode };
      controls.enabled = false; renderer.domElement.setPointerCapture(event.pointerId);
      if (action === 'zoom') { down.zoom = camera.zoom; down.cameraPosition = camera.position.clone(); return; }
      if(p.paintMode&&p.paintSelectOnly&&!p.paintLampPickingDisabled){
        pointer.set(start.x/start.width*2-1,1-start.y/start.height*2);raycaster.setFromCamera(pointer,camera);
        state.lampMarkers?.updateMatrixWorld(true);
        const picked=state.lampMarkers&&raycaster.intersectObjects(state.lampMarkers.children,true).find(hit=>hit.object.userData.lampId);
        if(picked){const id=picked.object.userData.lampId,lamp=p.paintLights?.markers.find(l=>l.id===id);if(lamp){down.action='paintLamp';down.lamp=structuredClone(lamp);down.lampMode=p.paintLampTransform||'move';p.onPaintLampSelect?.(id);return;}}
        p.onPaintLampSelect?.(null);
      }
      if (p.paintMode) {
        down.action = p.paintSelectOnly ? 'paintPick' : 'paint';
        if (p.paintDisabled && !p.paintSelectOnly) return;
        const hit = paintHit(event); down.paintHit = hit;
        if (hit) { if (p.paintSelectOnly) p.onPaintPick?.(hit); else p.onPaintStart?.(hit); }
        return;
      }
      if (p.choosingZoomAnchor) { down.action = 'anchor'; state.anchorCandidate = null; return; }
      if (p.transformMode === 'select' || p.sequenceIndex >= 0 || p.playing || down.ctrl && p.onInspectGeoset) { down.action = 'select'; return; }
      const active = editableGeosets(p), selected = selections(p), snapshots = {}, selectedMap = {}, pivot = new THREE.Vector3(); let count = 0;
      for (const [key, ids] of Object.entries(selected)) {
        const index = Number(key), entry = state.entries[index], invisible = new Set(p.hiddenVertices?.[key] || []);
        if (!active.has(index) || !entry?.group.visible) continue;
        const indices = selectionArray(ids).filter(i => Number.isInteger(i) && i >= 0 && i < entry.geometry.attributes.position.count && !invisible.has(i));
        if (!indices.length) continue;
        selectedMap[index] = indices; snapshots[index] = new Float32Array(entry.geometry.attributes.position.array);
        for (const i of indices) { pivot.add(new THREE.Vector3().fromArray(snapshots[index], i * 3)); count++; }
      }
      if (!count) { down.action = 'select'; return; }
      pivot.multiplyScalar(1 / count);
      const anchor = p.zoomAnchor, anchorIndices = anchor && selectedMap[anchor.geosetIndex];
      if (anchorIndices?.includes(anchor.vertexIndex)) pivot.fromArray(snapshots[anchor.geosetIndex], anchor.vertexIndex * 3);
      down.pivotScreen = screenPosition(pivot, start);
      state.drag = { ...down, selections: selectedMap, snapshots, pivot, workplane: p.workplane, workplaneEnabled: p.workplaneEnabled !== false, payload: null };
    }
    function translateInPlane(start, end, drag, constrain) {
      if (!drag.workplaneEnabled) return screenPlaneTranslation(camera, drag.pivot, end.width, end.height, end.x - start.x, end.y - start.y, constrain);
      const axes = planeAxes(drag.workplane), center = screenPosition(drag.pivot, end);
      const basis = axes.map(axis => { const value = drag.pivot.clone(); value.setComponent(axis, value.getComponent(axis) + 1); return screenPosition(value, end).sub(center).toArray(); });
      return new THREE.Vector3().fromArray(projectedPlaneTranslation(drag.workplane, basis, end.x - start.x, end.y - start.y, constrain));
    }
    function pointerMove(event) {
      if (latest.current.paintMode && paintCursor.current) {
        const cursor = point(event), decal=latest.current.paintDecal, width=decal?.width||Math.max(1,Number(latest.current.paintBrushSize)||1),height=decal?.height||width;
        Object.assign(paintCursor.current.style, { display: latest.current.paintSelectOnly || latest.current.paintDisabled || latest.current.cameraMode!=='work' || event.buttons>1 ? 'none' : 'block', left: `${cursor.x}px`, top: `${cursor.y}px`, width: `${width}px`, height: `${height}px`,transform:`translate(-50%,-50%) rotate(${decal?.angle||0}deg)` });
      }
      if (!down) {
        return;
      }
      const rawEnd = point(event), end = down.action === 'select' ? rawEnd : pointerDragPoint(down, rawEnd, down.pointerSensitivity), dx = end.x - down.x, dy = end.y - down.y;
      // The stroke already owns a fixed camera/depth projection. Pointer motion
      // needs screen coordinates only, not another full-model raycast.
      if (down.action === 'paint') { if (down.paintHit) latest.current.onPaintMove?.({ screen: { x: rawEnd.x, y: rawEnd.y } }); return; }
      if(down.action==='paintLamp'){latest.current.onPaintLampChange?.(down.lamp.id,paintLampDrag(down.lamp,dx,dy,camera,rawEnd.width,rawEnd.height,down.lampMode,down.shift?(latest.current.preferences?.fineSensitivity??.2):1));invalidate();return;}
      if (down.action === 'paintPick') return;
      if (down.action === 'anchor') {
        const distance = Math.hypot(rawEnd.x - down.x, rawEnd.y - down.y);
        if (distance > 5) {
          setBox({ left: Math.min(down.x, rawEnd.x), top: Math.min(down.y, rawEnd.y), width: Math.abs(rawEnd.x - down.x), height: Math.abs(rawEnd.y - down.y) });
          down.anchorCandidate = anchorVertexInMarquee(latest.current, down, rawEnd); state.anchorCandidate = down.anchorCandidate; invalidate();
        } else { setBox(null); down.anchorCandidate = state.anchorCandidate = null; invalidate(); }
        return;
      }
      if (down.action === 'zoom') {
        const factor = Math.exp(-dy * .01);
        zoomEditorCamera(camera, down.zoom * factor);
        controls.update(); return;
      }
      if (down.action === 'select') { if (Math.hypot(dx, dy) > 5) setBox({ left: Math.min(down.x, end.x), top: Math.min(down.y, end.y), width: Math.abs(dx), height: Math.abs(dy) }); return; }
      const drag = state.drag; if (!drag) return;
      const payload = { selections: drag.selections, geosetIndex: latest.current.selectedGeoset, indices: drag.selections[latest.current.selectedGeoset] || [], pivot: drag.pivot.toArray() };
      const rotation = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1), translation = new THREE.Vector3();
      if (drag.action === 'translate') { translation.copy(translateInPlane(down, end, drag, event.shiftKey)); payload.translation = translation.toArray(); }
      if (drag.action === 'scale') { scale.fromArray(dragScale(dx, drag.workplane, event.shiftKey)); payload.scale = scale.toArray(); payload.allowSingularScale = true; }
      if (drag.action === 'rotate') {
        const a = new THREE.Vector2(down.x, down.y).sub(drag.pivotScreen), b = new THREE.Vector2(end.x, end.y).sub(drag.pivotScreen);
        let angle = a.length() > 12 && b.length() > 12 ? Math.atan2(a.x * b.y - a.y * b.x, a.dot(b)) : dx * .01;
        const axis = [0, 1, 2].find(i => !planeAxes(drag.workplane).includes(i));
        const normal = new THREE.Vector3().setComponent(axis, 1), viewDirection = camera.position.clone().sub(controls.target);
        if (normal.dot(viewDirection) > 0) angle = -angle;
        if (event.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12;
        const degrees = [0, 0, 0]; degrees[axis] = THREE.MathUtils.radToDeg(angle); payload.rotation = degrees;
        rotation.set(degrees[0] * Math.PI / 180, degrees[1] * Math.PI / 180, degrees[2] * Math.PI / 180);
      }
      const vertex = new THREE.Vector3();
      for (const [key, indices] of Object.entries(drag.selections)) {
        const entry = state.entries[key], position = entry.geometry.attributes.position; position.array.set(drag.snapshots[key]);
        for (const index of indices) {
          vertex.fromArray(drag.snapshots[key], index * 3).sub(drag.pivot).multiply(scale).applyEuler(rotation).add(drag.pivot).add(translation);
          position.setXYZ(index, vertex.x, vertex.y, vertex.z);
        }
        position.needsUpdate = true; entry.geometry.computeBoundingSphere(); updateWideWireGeometry(entry);
      }
      drag.payload = payload; drag.moved = Math.hypot(dx, dy) > 1;
      invalidate();
    }
    function pointerUp(event) {
      if(latest.current.paintWorkspace)latest.current.onPaintInteractionChange?.(false);
      rotating = false; latest.current.onCameraGestureChange?.(false);
      state.refreshCursor();
      const start = down; down = null; setBox(null); controls.enabled = true;
      if (!start) return;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      const drag = state.drag; state.drag = null;
      if (drag) {
        if (drag.moved && drag.payload) latest.current.onTransform?.(drag.payload);
        state.dirty = true; state.selectionKey = ''; invalidate(); return;
      }
      if (start.action === 'anchor') {
        state.anchorCandidate = null; invalidate();
        if (start.anchorCandidate) latest.current.onChooseZoomAnchor?.(start.anchorCandidate);
        return;
      }
      if (start.action === 'paint') { latest.current.onPaintEnd?.(); invalidate(); return; }
      if (start.action === 'paintPick'||start.action==='paintLamp') return;
      if (start.action !== 'select') return;
      const end = point(event), distance = Math.hypot(end.x - start.x, end.y - start.y), p = latest.current;
      if (distance <= 5 && start.ctrl && p.onInspectGeoset) {
        const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geometry.index.array, vertices: entry.geometry.attributes.position.array }] : []);
        const hit = pickPreviewGeoset(projectPreviewGeosets(geometry, camera, end.width, end.height), end.x, end.y);
        if (hit) p.onInspectGeoset(hit.index);
        return;
      }
      // Source N15/N16 only change rendering: Work still selects vertices in every view.
      if (p.vertexSelection !== false) {
        const editable = editableGeosets(p), previousSelection = selections(p), found = {}, screen = new THREE.Vector3(), marqueeRadius = Math.max(3, visualOptions(p.preferences).vertexSize / 2); let closest = 5, nearest = null;
        for (const geosetIndex of editable) {
          const entry = state.entries[geosetIndex], hidden = new Set(p.hiddenVertices?.[geosetIndex] || []); if (!entry?.group.visible) continue;
          const position = entry.geometry.attributes.position; found[geosetIndex] = [];
          for (let i = 0; i < position.count; i++) {
            if (hidden.has(i)) continue;
            screen.fromBufferAttribute(position, i).project(camera); if (screen.z < -1 || screen.z > 1) continue;
            const x = (screen.x + 1) * end.width / 2, y = (1 - screen.y) * end.height / 2;
            if (distance > 5) { if (marqueeContainsPoint([x, y], start, end, marqueeRadius)) found[geosetIndex].push(i); }
            else { const d = Math.abs(x - end.x) + Math.abs(y - end.y); if (d < closest) { closest = d; nearest = [geosetIndex, i]; } }
          }
        }
        if (nearest) found[nearest[0]].push(nearest[1]);
        else if (distance <= 5) {
          // Editing picks both sides independently of material culling. The
          // shared barycentric-depth picker retains first-face coincident ties.
          const geosets = [...editable].flatMap(index => {
            const entry = state.entries[index], hidden = new Set(p.hiddenVertices?.[index] || []);
            if (!entry?.group.visible) return [];
            const faces = entry.geometry.index?.array || [], visibleFaces = [];
            for (let i = 0; i + 2 < faces.length; i += 3) if (![faces[i], faces[i+1], faces[i+2]].some(id => hidden.has(id))) visibleFaces.push(faces[i], faces[i+1], faces[i+2]);
            return [{ index, vertices: entry.geometry.attributes.position.array, faces: new Uint32Array(visibleFaces) }];
          });
          const hit = pickPreviewGeoset(projectPreviewGeosets(geosets, camera, end.width, end.height), end.x, end.y);
          if (hit) found[hit.index].push(...hit.ids);
        }
        const next = start.shift || start.ctrl ? { ...previousSelection } : {};
        for (const index of editable) next[index] = applySelection(selectionArray(previousSelection[index]), found[index] || [], start);
        emitSelection(p, next);
        return;
      }
      if (distance > 5) return;
      pointer.set(end.x / end.width * 2 - 1, 1 - end.y / end.height * 2); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(state.entries.flatMap(entry => entry?.meshes.filter(m => m.visible) || []), false);
      const hit = hits.find(h => h.object.parent?.visible);
      if (hit) p.onSelectGeoset?.(hit.object.userData.geosetIndex);
    }
    function cancelGesture() {
      if(latest.current.paintWorkspace)latest.current.onPaintInteractionChange?.(false);
      if(down?.action==='paintLamp')latest.current.onPaintLampChange?.(down.lamp.id,{position:down.lamp.position,target:down.lamp.target});
      rotating = false; latest.current.onCameraGestureChange?.(false);
      const drag = state.drag;
      if (drag) for (const [key, vertices] of Object.entries(drag.snapshots)) {
        const position = state.entries[key]?.geometry.attributes.position;
        if (position) { position.array.set(vertices); position.needsUpdate = true; }
      }
      if (down?.action === 'paint') latest.current.onPaintCancel?.();
      state.drag = null; state.anchorCandidate = null; down = null; setBox(null); controls.enabled = true; state.dirty = true; invalidate();
    }
    const frameModel = event => { cancelGesture(); state.fit(event.detail?.selection === true); };
    const viewCamera = event => { cancelGesture(); if (applyModelCamera(perspective, controls, event.detail)) { camera = perspective; state.camera = camera; state.appliedView = 'perspective'; invalidate(); } };
    window.addEventListener('mdlxl-view-camera', viewCamera);
    const cancelKey = event => { if (event.key === 'Escape' && down) { cancelGesture(); event.preventDefault(); } };
    const lampKey = event => {
      const p=latest.current;
      if(!p.paintMode||!p.paintSelectOnly||!p.paintSelectedLamp||down||event.ctrlKey||event.metaKey||event.altKey)return;
      const offset={ArrowLeft:[-12,0,'move'],ArrowRight:[12,0,'move'],ArrowUp:[0,-12,'move'],ArrowDown:[0,12,'move'],PageUp:[0,-12,'depth'],PageDown:[0,12,'depth']}[event.key];
      const lamp=p.paintLights?.markers.find(item=>item.id===p.paintSelectedLamp);
      if(!offset||!lamp)return;
      event.preventDefault();event.stopPropagation();
      p.onPaintLampChange?.(lamp.id,paintLampDrag(lamp,offset[0],offset[1],camera,renderer.domElement.clientWidth,renderer.domElement.clientHeight,offset[2],event.shiftKey?(p.preferences?.fineSensitivity??.2):1));
      invalidate();
    };
    const contextMenu = event => event.preventDefault();
    const paintDragOver=event=>{if(latest.current.paintDecal&&!latest.current.paintDisabled)event.preventDefault();};
    const paintDrop=event=>{if(!latest.current.paintDecal||latest.current.paintDisabled)return;event.preventDefault();const hit=paintHit(event);if(hit)latest.current.onPaintDrop?.(hit);};
    const paintLeave=()=>{if(paintCursor.current)paintCursor.current.style.display='none';};
    renderer.domElement.addEventListener('dragover',paintDragOver);renderer.domElement.addEventListener('drop',paintDrop);renderer.domElement.addEventListener('pointerleave',paintLeave);
    renderer.domElement.addEventListener('pointerdown', pointerDown, true);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', cancelGesture);
    renderer.domElement.addEventListener('contextmenu', contextMenu);
    window.addEventListener('mdlvis-frame', frameModel); window.addEventListener('keydown', cancelKey);
    const lampKeyHost=host.current;lampKeyHost.addEventListener('keydown',lampKey);
    const contextLost = event => { event.preventDefault(); state.scheduler?.dispose(); setError('The graphics context was lost. Reload the editor to restore the viewport. Save your work first.'); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    let callbackTime = performance.now();
    function render(now, delta) {
      if (state.disposed) return;
      const p = latest.current, renderGraphics = graphicsOptions(p.preferences), visual = visualOptions(p.preferences), appearance = viewportAppearanceOptions(p.preferences);
      const lighting = previewLighting(p.preferences); configurePreviewLights(ambient, key, lighting);
      if(state.paintUniforms){
        updatePaintLights(state.paintUniforms,p.paintLights);
        if(state.markerSettings!==p.paintLights||state.selectedLamp!==p.paintSelectedLamp||state.lampColor!==p.paintLampColor){
          state.markerSettings=p.paintLights;state.selectedLamp=p.paintSelectedLamp;state.lampColor=p.paintLampColor;
          const lamps=p.paintLights?.markers||[],ids=new Set(lamps.map(l=>l.id));
          for(const object of [...state.lampMarkers.children])if(!ids.has(object.userData.lampId)){clearGroup(object);state.lampMarkers.remove(object);}
          for(const lamp of lamps){
            let object=state.lampMarkers.children.find(item=>item.userData.lampId===lamp.id);
            if(!object){object=createPaintLampObject(lamp.id);state.lampMarkers.add(object);}
            object.position.fromArray(lamp.position);object.lookAt(new THREE.Vector3().fromArray(lamp.target));object.scale.setScalar(Math.max(3,state.radius*.12));
            object.userData.housing.color.set(lamp.id===p.paintSelectedLamp?(p.paintLampColor||'#ffc34b'):'#73787d');object.userData.bulb.color.set(lamp.enabled?lamp.color:'#444444');
          }
        }
      }
      state.refreshCursor();
      syncViewportBackground(appearance);
      ambient.visible = key.visible = renderGraphics.lighting;
      if (p.sequenceIndex !== state.sequenceIndex || !p.playing || !state.wasPlaying || (p.time !== state.lastExternalTime && Math.abs(p.time - (state.lastReportedFrame ?? -Infinity)) > 1)) state.frame = p.time || 0;
      state.sequenceIndex = p.sequenceIndex; state.lastExternalTime = p.time; state.wasPlaying = p.playing;
      if (p.playing && p.sequenceIndex >= 0) {
        state.globalTime += delta;
        state.frame = advanceSequence(p.model?.Sequences?.[p.sequenceIndex], state.frame, delta);
        if (now - callbackTime > 32) { callbackTime = now; state.lastReportedFrame = state.frame; p.onTimeChange?.(state.frame); }
      }
      const overlays = viewportOverlayOptions(p);
      const showMarkers = overlays.bones || overlays.nodes || overlays.attachments || overlays.particles;
      grid.update(p.preferences, p.workplane, overlays.grid, overlays.axes, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
      platform.update(p.preferences, state.center, state.radius, state.floor || 0);
      const selectedMap = selections(p), active = editableGeosets(p);
      const selectionKey = `${JSON.stringify(selectedMap, (_, value) => value instanceof Set ? [...value] : value)}|${[...active].join(',')}|${JSON.stringify(p.hiddenVertices, (_, value) => value instanceof Set ? [...value] : value)}|${p.mode}|${p.sequenceIndex}|${p.transformMode}|${JSON.stringify(visual)}`;
      const changed = state.dirty || state.nodes.some(node => node.Flags & 120) || p.playing || state.sampledFrame !== state.frame || state.sampledSequence !== p.sequenceIndex || (showMarkers && !state.sampledSkeleton) || state.sampledExplicitOverlays !== overlays.explicit;
      const interval = p.model?.Sequences?.[p.sequenceIndex]?.Interval;
      const animOptions = { interval, globalSequences: p.model?.GlobalSequences, globalTime: state.globalTime };
      if (changed && p.model && !state.drag && !p.paintWorkspace) {
        state.matrices = samplePreviewMatrices(p.model, state.frame, p.sequenceIndex, state.globalTime, camera);
        for (const entry of state.entries) {
          if (!entry) continue;
          const positions = entry.geometry.attributes.position;
          skinGeoset(entry.geoset, state.matrices, positions.array);
          positions.needsUpdate = true; entry.geometry.computeBoundingSphere(); updateWideWireGeometry(entry);
          const normals = entry.geometry.attributes.normal;
          if (entry.geoset.Normals?.length === positions.array.length) {
            skinGeosetNormals(entry.geoset, state.matrices, normals.array);
            normals.needsUpdate = true;
          } else entry.geometry.computeVertexNormals();
        }
        state.sampledFrame = state.frame; state.sampledSequence = p.sequenceIndex; state.sampledSkeleton = showMarkers; state.sampledExplicitOverlays = overlays.explicit; state.dirty = false;
      }
      // Paint is authored in raw rest pose, including when half geometry is
      // clipped. Re-skinning on a paint update wastes CPU and moves its hit map.
      if (p.paintWorkspace) { state.dirty = false; state.sampledFrame = state.frame; state.sampledSequence = p.sequenceIndex; state.sampledExplicitOverlays = overlays.explicit; }
      const hidden = p.hiddenGeosets instanceof Set ? p.hiddenGeosets : new Set(p.hiddenGeosets || []);
      for (let index = 0; index < state.entries.length; index++) {
        const entry = state.entries[index]; if (!entry) continue;
        const chosen = active.has(index), selection = selectionArray(selectedMap[index]);
        const hovered = p.hoveredGeoset === index;
        const geosetAnim = state.geosetAnims.get(index);
        const alpha = p.sequenceIndex >= 0 ? sampleTrack(geosetAnim?.Alpha, state.frame, { ...animOptions, fallback: 1 }) : typeof geosetAnim?.Alpha === 'number' ? geosetAnim.Alpha : 1;
        entry.group.visible = hovered || (!hidden.has(index) && (alpha > .001 || p.mode !== 'textured'));
        entry.hoverWire.visible = hovered; entry.hoverPoints.visible = hovered;
        const pureWireframe = p.mode === 'wireframe' || p.mode === 'vertices';
        const activeAppearance = index === p.selectedGeoset ? appearance.selectedGeoset : appearance.otherGeoset;
        const pointDepth = viewportPointDepth(pureWireframe, appearance.xrayVertices);
        const showPoints = overlays.vertices && chosen, showHiddenPoints = showPoints && pointDepth.showHidden;
        entry.points.visible = entry.selectedPoints.visible = showPoints;
        entry.hiddenPoints.visible = entry.hiddenSelectedPoints.visible = showHiddenPoints;
        configurePointMaterial(entry.points.material, appearance.unselectedVertex, markerTexture(appearance.unselectedVertex.style));
        configurePointMaterial(entry.hiddenPoints.material, appearance.unselectedVertex, markerTexture(appearance.unselectedVertex.style));
        configurePointMaterial(entry.selectedPoints.material, appearance.selectedVertex, markerTexture(appearance.selectedVertex.style));
        configurePointMaterial(entry.hiddenSelectedPoints.material, appearance.selectedVertex, markerTexture(appearance.selectedVertex.style));
        entry.points.material.depthTest = entry.selectedPoints.material.depthTest = pointDepth.depthTest;
        entry.hiddenPoints.material.depthTest = entry.hiddenSelectedPoints.material.depthTest = true;
        entry.wire.visible = pureWireframe || overlays.wires;
        entry.hiddenWire.visible = pureWireframe && visual.occludedOpacity > 0 && activeAppearance.opacity > 0;
        // Textured/solid General View already produces the correct depth from
        // its real materials, including alpha-tested holes and translucent
        // layers. The geometry-only prepass is reserved for modes where those
        // surface meshes are absent; otherwise it turns alpha planes opaque.
        entry.depth.visible = needsSolidDepthPrepass(p.mode);
        configureWideLine(entry.wire.material, activeAppearance, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
        configureWideLine(entry.hiddenWire.material, activeAppearance, renderer.domElement.clientWidth, renderer.domElement.clientHeight, visual.occludedOpacity);
        entry.hoverWire.material.color.set(visual.selectedGeometry); entry.hoverPoints.material.color.set(visual.selectedGeometry);
        for (let layerIndex = 0; layerIndex < entry.meshes.length; layerIndex++) {
          const mesh = entry.meshes[layerIndex], material = mesh.material, layer = entry.layers[layerIndex];
          applyPreviewMaterialLighting(material, lighting);
          mesh.visible = (p.rgbPreview || p.mode !== 'wireframe' && p.mode !== 'vertices') && (p.mode === 'textured' || layerIndex === 0);
          if (p.rgbPreview) entry.depth.visible = false;
          const textureIndex = Math.round(sampleTrack(layer.TextureID, state.frame, { ...animOptions, fallback: 0 }));
          const textureInfo = p.model?.Textures?.[textureIndex];
          const textured = p.mode === 'textured' && renderGraphics.textures;
          const map = !textured || textureInfo?.ReplaceableId === 1 ? null : textureInfo?.ReplaceableId === 2 ? state.teamGlow : state.textures.get(textureIndex) || state.checker;
          if (material.map !== map) { material.map = map; material.needsUpdate = true; }
          material.color.set(textured ? textureInfo?.ReplaceableId === 1 || textureInfo?.ReplaceableId === 2 ? p.teamColor : 0xffffff : COLORS[index % COLORS.length]);
          material.userData.geosetTint.value.set(1, 1, 1);
          if (textured || p.rgbPreview) {
            const rgbSequence = p.rgbPreview ? p.rgbPreviewSequenceIndex : p.sequenceIndex;
            const rgbTime = p.rgbPreview ? (p.model?.Sequences?.[rgbSequence]?.Interval?.[0] ?? 0) : state.frame;
            const sampled = sampleGeosetAnimation(p.model, index, rgbTime, rgbSequence, p.rgbPreview ? rgbTime : state.globalTime);
            if (p.rgbPreview) material.color.set(0xffffff).multiply(new THREE.Color(...sampled.color));
            else material.userData.geosetTint.value.fromArray(sampled.color);
          }
          material.opacity = textured ? Math.max(0, Math.min(1, alpha * sampleTrack(layer.Alpha, state.frame, { ...animOptions, fallback: 1 }))) : 1;
          const transparent = textured && ((layer.FilterMode || 0) >= 2 || material.opacity < 1);
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          // Clockwise faces are culled; counterclockwise winding is front-facing.
          material.side = layer.Shading & 16 ? THREE.DoubleSide : THREE.FrontSide;
          material.depthWrite = !textured || (!(layer.Shading & 128) && (layer.FilterMode || 0) < 2);
          material.blending = textured ? material.userData.layerBlending : THREE.NormalBlending;
          material.alphaTest = textured && layer.FilterMode === 1 ? .75 : 0;
          material.depthTest = !textured || !(layer.Shading & 64);
          if (changed && Number.isInteger(layer.TVertexAnimId) && layer.TVertexAnimId >= 0) {
            const uv = mesh.geometry.attributes.uv, baseUV = mesh.userData.baseUV, textureAnim = p.model?.TextureAnims?.[layer.TVertexAnimId];
            uv.array.set(baseUV);
            if (textureAnim && p.sequenceIndex >= 0) {
              const translation = new THREE.Vector3().fromArray(sampleTrack(textureAnim.Translation, state.frame, { ...animOptions, fallback: [0, 0, 0] }));
              const rotation = new THREE.Quaternion().fromArray(sampleTrack(textureAnim.Rotation, state.frame, { ...animOptions, fallback: [0, 0, 0, 1], quaternion: true }));
              const scale = new THREE.Vector3().fromArray(sampleTrack(textureAnim.Scaling, state.frame, { ...animOptions, fallback: [1, 1, 1] }));
              const transform = new THREE.Matrix4().compose(translation, rotation, scale), value = new THREE.Vector3();
              for (let vertex = 0; vertex < uv.count; vertex++) { value.set(baseUV[vertex * 2], baseUV[vertex * 2 + 1], 0).applyMatrix4(transform); uv.setXY(vertex, value.x, value.y); }
            }
            uv.needsUpdate = true;
          }
        }
        if (selectionKey !== state.selectionKey) {
          if (chosen) {
            const indices = viewportPointIndices(entry.geometry.attributes.position.count, selection, p.hiddenVertices?.[index]);
            entry.points.geometry.setIndex(indices.unselected); entry.hiddenPoints.geometry.setIndex(indices.unselected);
            entry.selectedPoints.geometry.setIndex(indices.selected); entry.hiddenSelectedPoints.geometry.setIndex(indices.selected);
          }
        }
      }
      state.selectionKey = selectionKey;
      controls.update();
      updateDepthClipping(camera, state.center, modelClipRadius(p.model, state.center, state.radius), gridOptions(p.preferences).extent);
      if (state.paintOutline) {
        const outline = state.paintOutline, settings = p.paintOutline, geoset = p.model?.Geosets?.[p.selectedGeoset];
        outline.visible = !!(p.paintMode && settings?.visible && geoset?.Faces?.length && !hidden.has(p.selectedGeoset));
        if (outline.visible) {
          camera.updateMatrixWorld(); const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements, key = matrix.join(',');
          if (state.outlineGeoset !== geoset || state.outlineKey !== key) {
            const positions = paintOutlinePositions(geoset, matrix); outline.geometry.setPositions(positions); state.outlineGeoset = geoset; state.outlineKey = key;
          }
          outline.material.color.set(settings.color); outline.material.linewidth = settings.thickness; outline.material.resolution.set(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
        }
      }
      const light = cameraLeftLight(camera, controls.target, state.radius);
      key.position.copy(light.position); key.target.position.copy(controls.target);
      ambient.position.copy(light.direction);
      try { renderer.render(scene, camera);
        if (p.presentation === 'preview' && previewOverlaySettings(p.previewOverlay).mode !== 'none') {
          if (!previewCanvas) { previewCanvas = document.createElement('canvas'); previewCanvas.dataset.geometryOverlay = ''; previewCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(previewCanvas); }
          previewCanvas.width = renderer.domElement.width; previewCanvas.height = renderer.domElement.height;
          const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geoset.Faces, vertices: entry.geometry.attributes.position.array }] : []);
          drawPresentationOverlay(previewCanvas.getContext('2d'), geometry, camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight, p.previewOverlay, renderer.getPixelRatio());
        } else if (previewCanvas) { previewCanvas.remove(); previewCanvas = null; }
        if (p.overlays?.normals || p.showNormals) {
          if (!normalCanvas) { normalCanvas = document.createElement('canvas'); normalCanvas.dataset.normalOverlay = ''; normalCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(normalCanvas); }
          normalCanvas.width = renderer.domElement.width; normalCanvas.height = renderer.domElement.height;
          const geometry = state.entries.flatMap((entry, index) => entry?.group.visible && active.has(index) ? [{ index, vertices: entry.geometry.attributes.position.array, normals: entry.geometry.attributes.normal.array }] : []);
          drawPreviewGeometryOverlay(normalCanvas.getContext('2d'), geometry, camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight, { normals: true, preferences: p.preferences }, state.center, state.radius, renderer.getPixelRatio());
        } else if (normalCanvas) { normalCanvas.remove(); normalCanvas = null; }
        if (showMarkers) {
          if (!nodeCanvas) { nodeCanvas = document.createElement('canvas'); nodeCanvas.dataset.nodeOverlay = ''; nodeCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(nodeCanvas); }
          nodeCanvas.width = renderer.domElement.width; nodeCanvas.height = renderer.domElement.height;
          const width = renderer.domElement.clientWidth, height = renderer.domElement.clientHeight;
          const nodes = projectMovementNodes(p.model, state.frame, p.sequenceIndex, camera, width, height, state.globalTime, state.matrices);
          const options = { ...overlays, boneLines: true, preferences: p.preferences, glMarkers: true, wireframeMarkers: p.mode === 'wireframe' || p.mode === 'vertices', occludedMarkerEdges: p.mode === 'solid' || p.mode === 'textured' };
          renderer.resetState(); rigMarkers.draw(camera, nodes, p.selectedNodeIds || [], options); renderer.resetState();
          drawMovementOverlay(nodeCanvas.getContext('2d'), nodes, p.selectedNodeIds || [], [], width, height, renderer.getPixelRatio(), options);
        } else if (nodeCanvas) { nodeCanvas.remove(); nodeCanvas = null; }
        if (p.overlays?.cameras ?? p.showCameras) {
          if (!cameraCanvas) { cameraCanvas = document.createElement('canvas'); cameraCanvas.dataset.cameraOverlay = ''; cameraCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(cameraCanvas); }
          cameraCanvas.width = renderer.domElement.width; cameraCanvas.height = renderer.domElement.height;
          drawModelCameraOverlay(cameraCanvas.getContext('2d'), p.model || {}, camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight, renderer.getPixelRatio(), state.frame, p.sequenceIndex, state.globalTime, state.radius, visual.node);
        } else if (cameraCanvas) { cameraCanvas.remove(); cameraCanvas = null; }
        const overlayPoint = value => {
          const entry = value && state.entries[value.geosetIndex], position = entry?.geometry.attributes.position;
          if (!position || value.vertexIndex < 0 || value.vertexIndex >= position.count || !entry.group.visible) return null;
          const projected = new THREE.Vector3().fromBufferAttribute(position, value.vertexIndex).project(camera);
          return projected.z >= -1 && projected.z <= 1 ? projected : null;
        };
        const anchorPoint = overlayPoint(p.zoomAnchor), candidatePoint = overlayPoint(p.choosingZoomAnchor ? state.anchorCandidate : null);
        if (anchorPoint || candidatePoint) {
          if (!anchorCanvas) { anchorCanvas = document.createElement('canvas'); anchorCanvas.dataset.anchorOverlay = ''; anchorCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2'; host.current.appendChild(anchorCanvas); }
          anchorCanvas.width = renderer.domElement.width; anchorCanvas.height = renderer.domElement.height;
          const context = anchorCanvas.getContext('2d'), pixelRatio = renderer.getPixelRatio(), width = renderer.domElement.clientWidth, height = renderer.domElement.clientHeight;
          context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, anchorCanvas.width, anchorCanvas.height);
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); context.fillStyle = '#39ff14';
          if (candidatePoint) {
            context.beginPath(); context.arc((candidatePoint.x + 1) * width / 2, (1 - candidatePoint.y) * height / 2, 7, 0, Math.PI * 2); context.fill();
          }
          if (anchorPoint) {
            context.font = 'bold 12px Tahoma, Arial, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'bottom';
            context.fillText('ANCHOR', (anchorPoint.x + 1) * width / 2, (1 - anchorPoint.y) * height / 2 - 10);
          }
        } else if (anchorCanvas) { anchorCanvas.remove(); anchorCanvas = null; }
      }
      catch (cause) { setError(`Preview error: ${cause.message}`); return false; }
    }
    state.scheduler = createRenderScheduler({ render,
      continuous: () => {
        const p = latest.current, sequence = p.model?.Sequences?.[p.sequenceIndex];
        return p.playing && p.sequenceIndex >= 0 && !(sequence?.NonLooping && state.frame >= sequence.Interval?.[1]);
      },
      paused: () => latest.current.suspended || (document.hidden && graphicsOptions(latest.current.preferences).pauseWhenHidden),
      maxFps: () => graphicsOptions(latest.current.preferences).maxFps,
    });
    document.addEventListener('visibilitychange', state.scheduler.sync);
    state.scheduler.invalidate();
    return () => {
      cameraMemory.current = { view: state.appliedView, perspective: perspective.clone(), ortho: ortho.clone(), target: controls.target.clone(), center: state.center.clone(), radius: state.radius };
      state.paintOutline?.geometry.dispose(); state.paintOutline?.material.dispose();
      if(state.lampMarkers)clearGroup(state.lampMarkers);
      renderer.domElement.removeEventListener('dragover',paintDragOver);renderer.domElement.removeEventListener('drop',paintDrop);renderer.domElement.removeEventListener('pointerleave',paintLeave);
      state.disposed = true; state.scheduler.dispose(); document.removeEventListener('visibilitychange', state.scheduler.sync); unbindScroll(); resizeObserver.disconnect(); controls.removeEventListener('change', invalidate); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown, true); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('pointercancel', cancelGesture); renderer.domElement.removeEventListener('contextmenu', contextMenu);
      window.removeEventListener('mdlvis-frame', frameModel); window.removeEventListener('mdlxl-view-camera', viewCamera); window.removeEventListener('keydown', cancelKey);
      lampKeyHost.removeEventListener('keydown',lampKey);
      cameraCanvas?.remove(); normalCanvas?.remove(); nodeCanvas?.remove(); previewCanvas?.remove(); anchorCanvas?.remove(); rigMarkers.dispose(); platform.dispose(); clearGroup(modelGroup); state.textures.forEach(texture => texture.dispose()); state.markerTextures.forEach(texture => texture.dispose()); state.background.texture.dispose(); state.checker.dispose(); state.teamGlow.dispose(); grid.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); runtime.current = null;
    };
  }, [graphics.antialias]);

  useEffect(() => {
    const state = runtime.current; if (!state) return;
    state.drag = null; clearGroup(state.modelGroup); state.entries = []; state.nodes = allNodes(model || {}); state.selectionKey = ''; state.dirty = true;
    state.geosetAnims = new Map((model?.GeosetAnims || []).map(anim => [anim.GeosetId, anim]));
    state.scheduler?.invalidate();
    if (!model) return;
    for (let index = 0; index < (model.Geosets || []).length; index++) {
      const geoset = model.Geosets[index], group = new THREE.Group(), geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geoset.Vertices), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(geoset.Faces), 1));
      if (geoset.Normals?.length === geoset.Vertices.length) geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geoset.Normals), 3)); else geometry.computeVertexNormals();
      const layers = model.Materials?.[geoset.MaterialID]?.Layers?.length ? model.Materials[geoset.MaterialID].Layers : [{ TextureID: 0, Alpha: 1, Shading: 16 }];
      const meshes = [];
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        const layer = layers[layerIndex], layerGeometry = layerIndex === 0 ? geometry : new THREE.BufferGeometry();
        if (layerIndex) { layerGeometry.setAttribute('position', geometry.attributes.position); layerGeometry.setAttribute('normal', geometry.attributes.normal); layerGeometry.setIndex(geometry.index); }
        const uv = geoset.TVertices?.[layer.CoordId || 0] || geoset.TVertices?.[0];
        layerGeometry.setAttribute('uv', new THREE.BufferAttribute(uv?.length ? new Float32Array(uv) : new Float32Array(geoset.Vertices.length / 3 * 2), 2));
        const material = layerMaterial(layer, shaded && graphics.lighting,state.paintUniforms); material.polygonOffset = false; material.alphaToCoverage = graphics.antialias;
        const mesh = new THREE.Mesh(layerGeometry, material); mesh.userData.geosetIndex = index; mesh.userData.materialId = geoset.MaterialID; mesh.userData.layerIndex = layerIndex; mesh.userData.textureId = Number.isInteger(layer.TextureID) ? layer.TextureID : null; mesh.userData.coordId = layer.CoordId || 0; mesh.userData.baseUV = new Float32Array(layerGeometry.attributes.uv.array); mesh.renderOrder = index * 16 + layerIndex; mesh.frustumCulled = false; group.add(mesh); meshes.push(mesh);
      }
      const depth = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })); depth.renderOrder = -1; depth.frustumCulled = false; group.add(depth);
      const edgeIndices = uniqueEdges(geoset.Faces), wireGeometry = new LineSegmentsGeometry();
      const wire = new LineSegments2(wireGeometry, new LineMaterial({ color: 0xffffff, linewidth: 1, transparent: true, opacity: 1, depthTest: true, depthWrite: false })); wire.renderOrder = 10000; wire.frustumCulled = false; wire.userData.overlay = 'wires'; group.add(wire);
      const hiddenWire = new LineSegments2(wireGeometry, new LineMaterial({ color: 0xffffff, linewidth: 1, transparent: true, opacity: .35, depthTest: true, depthFunc: THREE.GreaterDepth, depthWrite: false })); hiddenWire.renderOrder = 9999; hiddenWire.frustumCulled = false; group.add(hiddenWire);
      const pointGeometry = new THREE.BufferGeometry(); pointGeometry.setAttribute('position', geometry.attributes.position);
      const hiddenPointGeometry = new THREE.BufferGeometry(); hiddenPointGeometry.setAttribute('position', geometry.attributes.position);
      const selectedPointGeometry = new THREE.BufferGeometry(); selectedPointGeometry.setAttribute('position', geometry.attributes.position);
      const hiddenSelectedPointGeometry = new THREE.BufferGeometry(); hiddenSelectedPointGeometry.setAttribute('position', geometry.attributes.position);
      const pointMaterial = options => new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, depthTest: true, depthWrite: false, ...options });
      const points = new THREE.Points(pointGeometry, pointMaterial()); points.frustumCulled = false; points.renderOrder = 11000; points.userData.overlay = 'vertices'; group.add(points);
      const hiddenPoints = new THREE.Points(hiddenPointGeometry, pointMaterial({ depthFunc: THREE.GreaterDepth })); hiddenPoints.frustumCulled = false; hiddenPoints.renderOrder = 10999; group.add(hiddenPoints);
      const selectedPoints = new THREE.Points(selectedPointGeometry, pointMaterial()); selectedPoints.frustumCulled = false; selectedPoints.renderOrder = 11001; selectedPoints.userData.overlay = 'vertices'; group.add(selectedPoints);
      const hiddenSelectedPoints = new THREE.Points(hiddenSelectedPointGeometry, pointMaterial({ depthFunc: THREE.GreaterDepth })); hiddenSelectedPoints.frustumCulled = false; hiddenSelectedPoints.renderOrder = 11000; group.add(hiddenSelectedPoints);
      const hoverWire = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true, depthTest: false, depthWrite: false, transparent: true }));
      hoverWire.renderOrder = 13000; hoverWire.frustumCulled = false; hoverWire.visible = false; group.add(hoverWire);
      const hoverGeometry = new THREE.BufferGeometry(); hoverGeometry.setAttribute('position', geometry.attributes.position);
      const hoverPoints = new THREE.Points(hoverGeometry, new THREE.PointsMaterial({ color: 0x39ff14, size: 6, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }));
      hoverPoints.renderOrder = 13001; hoverPoints.frustumCulled = false; hoverPoints.visible = false; group.add(hoverPoints);
      state.modelGroup.add(group); state.entries[index] = { geoset, group, geometry, meshes, layers, depth, edgeIndices, wireGeometry, wire, hiddenWire, points, hiddenPoints, selectedPoints, hiddenSelectedPoints, hoverWire, hoverPoints };
      if (!props.paintWorkspace) updateWideWireGeometry(state.entries[index]);
    }
    const signature = `${model.Info?.Name}|${model.Geosets?.map(g => g.Vertices.length).join(',')}`;
    if (state.loadedSignature === null) {
      state.loadedSignature = signature; state.fit();
      const saved = cameraMemory.current;
      if (saved && saved.view === latest.current.view) { state.perspective.copy(saved.perspective); state.ortho.copy(saved.ortho); state.controls.target.copy(saved.target); state.center.copy(saved.center); state.radius=saved.radius; state.resize(); state.controls.update(); }
    }
  }, [model, revision, shaded, graphics.lighting, graphics.antialias]);

  useEffect(() => {
    const state = runtime.current; if (!state) return;
    let cancelled = false;
    setTextureMessage('');
    if (!graphics.textures) {
      state.textures.forEach(texture => texture.dispose()); state.textures.clear(); state.textureSources.clear(); state.scheduler?.invalidate(); return;
    }
    // Wireframe, solid and vertex editing do not decode textures. Switching view
    // modes keeps already loaded textures available without loading them again.
    if (!texturesNeeded) return;
    const assets = textureAssets instanceof Map ? textureAssets : new Map(Object.entries(textureAssets || {})), overrides = props.paintTextureOverrides instanceof Map ? props.paintTextureOverrides : new Map(Object.entries(props.paintTextureOverrides || {}));
    const normalized = new Map([...assets].map(([path, asset]) => [normalizedPath(path), asset]));
    for (const index of state.textureSources.keys()) if (index >= (model?.Textures?.length || 0)) { state.textures.get(index)?.dispose(); state.textures.delete(index); state.textureSources.delete(index); }
    const failures = [], jobs = (model?.Textures || []).map(async (texture, index) => {
      const path = normalizedPath(texture.Image);
      const asset = normalized.get(path) || normalized.get(path.split('\\').at(-1));
      const override = overrides.get(index) || overrides.get(String(index));
      const smoothing=props.paintTextureSmoothing!==false;
      const key = override ? `paint|${texture.Flags}|${smoothing}` : `${path}|${texture.Flags}|${texture.ReplaceableId}`, previous = state.textureSources.get(index);
      if (override?.canvas && previous?.canvas === override.canvas && previous.key === key && state.textures.has(index)) {
        if (previous.revision !== override.revision) { previous.revision = override.revision; const loaded=state.textures.get(index);loaded.clearUpdateRanges();if(!override.fullUpload)for(const range of paintRowRanges(override.uploadRows,override.raster.width))loaded.addUpdateRange(range.start,range.count);loaded.needsUpdate=true;state.scheduler?.invalidate(); } return;
      }
      if (previous && previous.asset === asset && previous.key === key) { if (previous.error) failures.push(previous.error); return; }
      state.textures.get(index)?.dispose(); state.textures.delete(index);
      const source = { asset, key, canvas: override?.canvas || null, revision: override?.revision }; state.textureSources.set(index, source);
      if (override?.canvas) {
        const loaded = override.raster?new THREE.DataTexture(override.raster.data,override.raster.width,override.raster.height,THREE.RGBAFormat):new THREE.CanvasTexture(override.canvas);
        loaded.flipY=false;loaded.colorSpace=THREE.NoColorSpace;loaded.wrapS=texture.Flags&1?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;loaded.wrapT=texture.Flags&2?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
        configurePaintTexture(loaded,smoothing);
        if(override.raster)loaded.onUpdate=()=>acknowledgePaintUpload(override);
        state.textures.set(index,loaded);state.scheduler?.invalidate();return;
      }
      if (!asset || texture.ReplaceableId) { state.scheduler?.invalidate(); return; }
      try {
        const loaded = await textureFromAsset(asset, texture);
        if (state.disposed || state.textureSources.get(index) !== source) loaded.dispose();
        else { configureEditorTexture(loaded, state.renderer.capabilities.getMaxAnisotropy()); state.textures.set(index, loaded); state.scheduler?.invalidate(); }
      }
      catch (cause) { source.error = `${texture.Image}: ${cause.message}`; failures.push(source.error); }
    });
    Promise.all(jobs).then(() => { if (!cancelled && failures.length) setTextureMessage(failures.join('; ')); });
    return () => { cancelled = true; };
  }, [textureSignature, textureAssets, texturesNeeded, graphics.textures, graphics.antialias, props.paintTextureOverrides, props.paintTextureRevision, props.paintTextureSmoothing]);

  useEffect(() => { if(runtime.current && runtime.current.appliedView !== view) runtime.current.setView(view); }, [view, graphics.antialias]);
  useEffect(() => { if (props.cameraAnglesRequest) runtime.current?.setCameraAngles(props.cameraAnglesRequest); }, [props.cameraAnglesRequest]);
  useEffect(() => { runtime.current?.refreshCursor(); }, [cameraMode, transformMode, props.rotationNormals]);
  useEffect(() => { setAdjustingSensitivity(null); }, [props.preferences?.wheelMode]);
  useEffect(() => { const controls = runtime.current?.controls; if (controls) controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(props.preferences?.pointerSensitivity); }, [props.preferences?.pointerSensitivity]);
  useEffect(() => { runtime.current?.resize(); }, [graphics.pixelRatio]);
  useEffect(() => { runtime.current?.scheduler.invalidate(); }, [props.paintOutline, props.paintSelectOnly]);
  useEffect(() => { runtime.current?.scheduler.invalidate(); }, [props.paintLights,props.paintBackground,props.paintSelectedLamp,props.paintLampColor]);
  useEffect(() => { runtime.current?.scheduler.sync(); }, [props.presentation, props.previewMode, props.previewOverlay, model, revision, props.hoveredGeoset, selectedGeoset, selectedVertices, props.selectionByGeoset, props.selectableGeosets, hiddenGeosets, props.hiddenVertices, mode, showSkeleton, showGrid, props.showAxes, props.showVertices, props.overlays, props.showCameras, props.preferences, props.rgbPreview, props.rgbPreviewSequenceIndex, workplane, transformMode, props.zoomAnchor, props.choosingZoomAnchor, sequenceIndex, time, playing, teamColor, props.suspended, props.paintTextureRevision, graphics.maxFps, graphics.pauseWhenHidden, graphics.textures, graphics.lighting]);
  return <div className="viewport" style={{ position: 'relative', width: '100%', height: '100%', minHeight: props.presentation === 'preview' ? 0 : 180, background: '#ccc', overflow: 'hidden' }}>
    <div ref={host} tabIndex={0} aria-label="3D model viewport" style={{ position: 'absolute', inset: 0, outline: 'none', cursor: viewportCursor(cameraMode, transformMode) }} />
    {adjustingSensitivity !== null && <div role="status" style={sensitivityIndicatorStyle}>{sensitivityIndicatorText(adjustingSensitivity)}</div>}
    {textureMessage && <div role="status" style={{ position: 'absolute', bottom: 4, left: 5, color: '#fff0cb', fontSize: 11, pointerEvents: 'none' }}>{textureMessage}</div>}
    {backgroundMessage && <div role="status" style={{ position: 'absolute', top: 4, left: 5, color: '#5b2500', background: '#fff4d6dd', padding: '2px 5px', fontSize: 11, pointerEvents: 'none' }}>{backgroundMessage}</div>}
    {box && <div style={{ position: 'absolute', ...box, border: '1px dotted white', pointerEvents: 'none' }} />}
    {props.paintMode && <div ref={paintCursor} aria-hidden="true" style={{display:'none',position:'absolute',pointerEvents:'none',zIndex:5}}><img src={props.paintDecal?.url||props.paintBrushPreview} style={{width:'100%',height:'100%',objectFit:'fill',filter:props.paintDecal?'none':'drop-shadow(0 0 1px #000)',opacity:props.paintDecal?.opacity??1,transform:`scale(${props.paintDecal?.flipX?-1:1},${props.paintDecal?.flipY?-1:1})`}}/></div>}
    {error && <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 30, color: '#300', background: '#ddd', textAlign: 'center', fontSize: 13 }}>{error}</div>}
  </div>;
}
