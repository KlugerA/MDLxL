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
import { configureEditorTexture, cameraLeftLight, viewportPixelRatio } from './viewport-quality.js';
import { createRigMarkersGL } from './rig-markers-gl.js';
import { drawModelCameraOverlay } from './model-camera-overlay.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { needsSolidDepthPrepass } from './preview-depth.js';
import { vertexRgbPreviewState } from './vertex-rgb-preview.js';
import { decodeBLP, getBLPImageData } from 'war3-model';
import { advanceSequence, allNodes, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset, skinGeosetNormals } from '../src/animation.js';
import { decodeDds } from '../src/dds.js';
import { decodeBlp2 } from '../src/blp2.js';
import { applySelection, dragScale, insideTriangle, marqueeContainsPoint, planeAxes } from './classic-gestures.js';
import { bindScrollSensitivity, createRenderScheduler, graphicsOptions, pointerDragPoint, pointerSensitivityValue, sensitivityIndicatorStyle, sensitivityIndicatorText } from './viewport-performance.js';
import { viewportOverlayOptions } from './viewport-overlays.js';
import { projectCompassAxes } from './viewport-compass.js';
import { configureWideWirePattern } from '../src/wire-pattern.js';

import { applyViewPreset, applyModelCamera, gridDepthExtent, gridFrameRadius, orthographicHalfHeight, perspectiveFitDistance, updateDepthClipping, modelClipRadius, projectedPlaneTranslation, screenPlaneTranslation } from './viewport-math.js';
import { createViewportGrid } from './viewport-grid.js';
import { visualOptions, viewportAppearanceOptions, gridOptions, cameraBindings } from '../src/preferences.js';
import { backgroundImageRect } from '../src/viewport-appearance.js';
import { QUAD_VIEWS, QUAD_VIEW_OPTIONS, viewWorkplane, viewportRects } from './quad-view.js';
import { viewportPointDepth, viewportPointIndices } from './viewport-point-selection.js';

const COLORS = [0xa9b6c1, 0x8caca8, 0xb9aa94, 0x939bb5, 0xb499a6, 0x9eac8b];
const normalizedPath = path => String(path || '').replaceAll('/', '\\').toLowerCase();
const selectionArray = selection => Array.from(selection || []);
const asBuffer = bytes => bytes instanceof ArrayBuffer ? bytes : bytes?.buffer?.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const sameCompassAxes = (left, right) => left?.length === right?.length && left.every((axis, index) => axis.id === right[index].id && Math.abs(axis.x - right[index].x) < .001 && Math.abs(axis.y - right[index].y) < .001 && Math.abs(axis.depth - right[index].depth) < .001);
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
    if (!pixels) { const bytes = new Uint8Array(buffer); pixels = bytes[0] === 66 && bytes[1] === 76 && bytes[2] === 80 && bytes[3] === 50 ? decodeBlp2(buffer) : getBLPImageData(decodeBLP(buffer), 0); decodedRasterCache.set(asset, pixels); }
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

function layerMaterial(layer, shaded = true) {
  const shading = layer.Shading || 0, filter = layer.FilterMode || 0;
  const material = !shaded || shading & 1 ? new THREE.MeshBasicMaterial() : new THREE.MeshPhongMaterial({ shininess: 9, specular: 0x1c242d });
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
  };
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
  configureWideWirePattern(material, appearance);
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
  const [compassAxes, setCompassAxes] = useState(() => projectCompassAxes());
  const [adjustingSensitivity, setAdjustingSensitivity] = useState(null);
  const cameraMemory = useRef(null);
  const graphics = graphicsOptions(props.preferences);
  const textureSignature = (model?.Textures || []).map(texture => `${texture.Image}|${texture.Flags}|${texture.ReplaceableId}`).join('\n');
  const texturesNeeded = graphics.textures && mode === 'textured';

  useEffect(() => {
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: graphics.antialias, alpha: false, powerPreference: 'high-performance' }); }
    catch (cause) { setError(`The 3D viewport could not start: ${cause.message}. Model data and the other editors remain available.`); return; }
    setError('');
    renderer.setPixelRatio(viewportPixelRatio(graphics, window.devicePixelRatio));
    renderer.setClearColor(0xcccccc); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
    renderer.domElement.tabIndex = 0;
    host.current.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), modelGroup = new THREE.Group();
    scene.add(modelGroup);
    let perspective = new THREE.PerspectiveCamera(42, 1, .2, 1000);
    perspective.up.set(0, 0, 1); perspective.position.set(180, -260, 170);
    let ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, .2, 1000);
    ortho.up.set(0, 0, 1);
    let camera = perspective;
    let surface = document.createElement('div');
    surface.className = 'viewport-input'; surface.tabIndex = 0; host.current.appendChild(surface);
    let controls = new EditorCameraControls(camera, surface);
    controls.enableDamping = false;
    controls.mouseButtons = { LEFT: null, MIDDLE: null, RIGHT: THREE.MOUSE.PAN };
    controls.target.set(0, 0, 45); controls.update();
    const ambient = new THREE.HemisphereLight(0xd4e7ff, 0x52514a, 2.2);
    ambient.position.set(0, 0, 300); scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffeed7, 2.8); key.position.set(200, -280, 350); scene.add(key);
    scene.add(key.target);
    let cameraCanvas, normalCanvas, nodeCanvas, previewCanvas, anchorCanvas, rotating = false;
    let grid = createViewportGrid(); scene.add(grid);
    const rigMarkers = createRigMarkersGL(renderer.getContext()); renderer.resetState();
    const platform = createPreviewPlatform(() => invalidate()); scene.add(platform);
    const backgroundCanvas = document.createElement('canvas'), backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
    backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    const state = { renderer, scene, modelGroup, perspective, ortho, camera, controls, grid, entries: [], nodes: [], textures: new Map(), markerTextures: new Map(), checker: makeChecker(), background: { canvas: backgroundCanvas, texture: backgroundTexture, data: null, image: null, status: 'idle', drawKey: '' }, frame: 0, lastExternalTime: undefined, sequenceIndex: -1, wasPlaying: false, drag: null, anchorCandidate: null, dirty: true, radius: 100, center: new THREE.Vector3(0, 0, 40), loadedSignature: null, selectionKey: '', hoveredGeoset: null, disposed: false };
    runtime.current = state;
    state.teamGlow = makeTeamGlow();
    state.globalTime = 0;
    state.textureSources = new Map();
    const singlePane = { id: 'single', surface, perspective, ortho, camera, controls, grid, view: latest.current.view, center: state.center, radius: state.radius };
    const panes = [singlePane];
    let boundPane = singlePane, activePane = singlePane, quad = false;
    // Only camera/input/overlay state is per pane. Scene, geometry, selection,
    // drag snapshots, textures and the document commit path stay shared.
    function savePane() {
      Object.assign(boundPane, { camera, view: state.appliedView, center: state.center, radius: state.radius, floor: state.floor, cameraCanvas, normalCanvas, nodeCanvas, previewCanvas, anchorCanvas });
    }
    function bindPane(pane) {
      savePane(); boundPane = pane;
      ({ surface, perspective, ortho, camera, controls, grid, cameraCanvas, normalCanvas, nodeCanvas, previewCanvas, anchorCanvas } = pane);
      for (const item of panes) item.grid.visible = item === pane;
      Object.assign(state, { perspective, ortho, camera, controls, grid, appliedView: pane.view, center: pane.center, radius: pane.radius, floor: pane.floor });
    }
    function activatePane(pane) {
      if (down && pane !== activePane) return;
      bindPane(pane); activePane = pane;
      for (const item of panes) item.surface.classList.toggle('active', quad && item === pane);
      latest.current.onActivePaneChange?.(quad ? { id: pane.id, view: pane.view, workplane: viewWorkplane(pane.view) } : null);
      invalidate();
    }
    const invalidate = () => {
      if (boundPane !== activePane) { state.scheduler?.invalidate(); return; }
      if (quad && rotating && camera.isOrthographicCamera && boundPane.view !== 'orthographic') {
        rememberView('orthographic');
        latest.current.onActivePaneChange?.({ id: boundPane.id, view: boundPane.view, workplane: null });
      }
      const nextCompassAxes = projectCompassAxes(camera.quaternion);
      setCompassAxes(previous => sameCompassAxes(previous, nextCompassAxes) ? previous : nextCompassAxes);
      latest.current.onCameraAnglesChange?.(editorCameraAngles(camera)); state.scheduler?.invalidate();
    };
    const markerTexture = style => {
      if (style === 'square') return null;
      if (!state.markerTextures.has(style)) state.markerTextures.set(style, pointMarkerTexture(style));
      return state.markerTextures.get(style);
    };
    function syncViewportBackground(appearance) {
      const config = quad ? appearance.quadView.background : appearance.background, background = state.background;
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
      const width = Math.max(1, Math.round(surface.clientWidth * renderer.getPixelRatio())), height = Math.max(1, Math.round(surface.clientHeight * renderer.getPixelRatio()));
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
    state.refreshCursor = () => { surface.style.cursor = viewportCursor(latest.current.cameraMode, latest.current.rotationNormals ? 'rotateNormals' : latest.current.transformMode, rotating); };
    state.setCameraAngles = values => { if (setEditorCameraAngles(camera, controls.target, values)) { if (quad && camera.isOrthographicCamera) rememberView('orthographic'); controls.update(); activatePane(activePane); } };
    function bindInput(pane) {
      const element = pane.surface;
      const activate = () => activatePane(pane);
      // Capture runs before OrbitControls and sensitivity bindings.
      element.addEventListener('pointerdown', activate, true);
      element.addEventListener('wheel', activate, true);
      element.addEventListener('focus', activate);
      pane.controls.addEventListener('change', invalidate);
      const unbindScroll = bindScrollSensitivity(element, {
        getPreferences: () => latest.current.preferences,
        onChange: value => latest.current.onSensitivityChange?.(value), onIndicator: value => { setAdjustingSensitivity(value); latest.current.onSensitivityIndicator?.(value); },
        onPointerChange: value => latest.current.onPointerSensitivityChange?.(value),
        onWheelModeChange: value => latest.current.onWheelModeChange?.(value),
        // A Wisp left-button wheel gesture is a settings gesture, never a select or transform.
        onPointerAdjustment: () => cancelGesture(),
        onCameraModeToggle: () => latest.current.onCameraModeToggle?.(),
        onWheel: (_event, sensitivity) => { pane.controls.zoomSpeed = sensitivity; },
      });
      element.addEventListener('pointerdown', pointerDown, true);
      element.addEventListener('pointermove', pointerMove);
      element.addEventListener('pointerup', pointerUp);
      element.addEventListener('pointercancel', cancelGesture);
      element.addEventListener('pointerleave', pointerLeave);
      element.addEventListener('contextmenu', contextMenu);
      pane.dispose = () => { unbindScroll(); pane.controls.removeEventListener('change', invalidate); pane.controls.dispose(); element.remove(); };
    }

    function resizePane() {
      const width = Math.max(1, surface.clientWidth), height = Math.max(1, surface.clientHeight);
      perspective.aspect = width / height; perspective.updateProjectionMatrix();
      const p = latest.current, gridVisible = !quad && (p.overlays?.grid ?? !!p.showGrid);
      const framed = gridVisible ? Math.max(state.radius, gridFrameRadius(state.center, gridOptions(p.preferences).extent)) : state.radius;
      const half = orthographicHalfHeight(framed, width / height); ortho.left = -half * width / height; ortho.right = half * width / height; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix();
    }
    function resize() {
      const width = Math.max(1, host.current?.clientWidth || 1), height = Math.max(1, host.current?.clientHeight || 1);
      renderer.setPixelRatio(viewportPixelRatio(graphicsOptions(latest.current.preferences), window.devicePixelRatio));
      renderer.setSize(width, height, false);
      const visible = quad ? panes.slice(1) : [singlePane], rects = viewportRects(width, height, quad);
      for (const pane of panes) pane.surface.style.display = visible.includes(pane) ? 'block' : 'none';
      visible.forEach((pane, index) => {
        pane.rect = rects[index];
        Object.assign(pane.surface.style, Object.fromEntries(Object.entries(pane.rect).map(([key, value]) => [key, value + 'px'])));
        bindPane(pane); resizePane();
      });
      bindPane(activePane); invalidate();
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
      if (bounds.isEmpty()) for (const geo of p.model?.Geosets || []) {
        for (let i = 0; i < geo.Vertices.length; i += 3) bounds.expandByPoint(new THREE.Vector3().fromArray(geo.Vertices, i));
      }
      if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 100));
      bounds.getCenter(state.center); state.radius = Math.max(1, bounds.getSize(new THREE.Vector3()).length() / 2);
      state.floor = bounds.min.z;
      const gridVisible = !quad && (p.overlays?.grid ?? !!p.showGrid);
      const framed = gridVisible ? Math.max(state.radius, gridFrameRadius(state.center, gridOptions(p.preferences).extent)) : state.radius;
      const direction = perspective.position.clone().sub(controls.target).normalize();
      const width = Math.max(1, surface.clientWidth), height = Math.max(1, surface.clientHeight);
      perspective.position.copy(state.center).addScaledVector(direction.lengthSq() ? direction : new THREE.Vector3(1, -1.5, .9).normalize(), perspectiveFitDistance(framed, perspective.fov, width / height));
      controls.target.copy(state.center); perspective.zoom = ortho.zoom = 1;
      resizePane(); setPaneView(quad ? boundPane.view : latest.current.view || 'front');
    };
    function rememberView(next) {
      state.appliedView = boundPane.view = next;
      const select = surface.querySelector('.quad-pane-view');
      if (select) select.value = next;
    }
    function setPaneView(next) {
      rememberView(next);
      if (next === 'perspective') camera = perspective;
      else if (next === 'orthographic') {
        const previous = camera; camera = ortho; camera.position.copy(previous.position); camera.quaternion.copy(previous.quaternion); camera.up.copy(previous.up);
      }
      else {
        const p = latest.current, gridVisible = !quad && (p.overlays?.grid ?? !!p.showGrid);
        const framed = gridVisible ? Math.max(state.radius, gridFrameRadius(state.center, gridOptions(p.preferences).extent)) : state.radius;
        camera = ortho; applyViewPreset(camera, next, controls.target, framed * 4);
      }
      controls.object = camera; controls.enableRotate = true;
      state.camera = camera; boundPane.view = next; boundPane.camera = camera; controls.update(); invalidate();
    }
    state.setView = next => {
      cancelGesture(); setPaneView(next);
      if (quad) activatePane(activePane);
    };
    state.setQuad = enabled => {
      if (quad === !!enabled) return;
      cancelGesture(); savePane(); quad = !!enabled;
      if (quad && panes.length === 1) {
        for (const definition of QUAD_VIEWS) {
          const element = document.createElement('div'); element.className = 'viewport-input quad-pane'; element.tabIndex = 0;
          element.dataset.viewport = definition.id; element.setAttribute('aria-label', definition.label + ' viewport');
          const select = document.createElement('select'); select.className = 'quad-pane-view'; select.setAttribute('aria-label', definition.label + ' pane viewpoint');
          for (const [value, label] of QUAD_VIEW_OPTIONS) { const option = document.createElement('option'); option.value = value; option.textContent = label; select.appendChild(option); }
          select.value = definition.view; element.appendChild(select); host.current.appendChild(element);
          const perspective = singlePane.perspective.clone(), ortho = singlePane.ortho.clone();
          const camera = definition.view === 'perspective' ? perspective : ortho;
          const paneControls = new EditorCameraControls(camera, element); paneControls.enableDamping = false; paneControls.target.copy(singlePane.controls.target);
          const pane = { ...definition, surface: element, perspective, ortho, camera, controls: paneControls, grid: createViewportGrid(), center: singlePane.center.clone(), radius: singlePane.radius, floor: singlePane.floor };
          scene.add(pane.grid);
          select.addEventListener('pointerdown', event => event.stopPropagation());
          select.addEventListener('keydown', event => event.stopPropagation());
          select.addEventListener('wheel', event => event.stopPropagation());
          select.addEventListener('focus', () => activatePane(pane));
          select.addEventListener('change', () => { activatePane(pane); state.setView(select.value); surface.focus(); });
          panes.push(pane); bindInput(pane); bindPane(pane);
          const saved = cameraMemory.current?.panes?.find(item => item.id === pane.id);
          setPaneView(saved?.view || definition.view);
          if (saved) { perspective.copy(saved.perspective); ortho.copy(saved.ortho); controls.target.copy(saved.target); state.center.copy(saved.center); state.radius = saved.radius; controls.update(); }
        }
      }
      activePane = quad ? panes[1] : singlePane;
      bindPane(activePane); resize(); activatePane(activePane);
    };

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let down = null;
    function point(event) { const rect = surface.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height }; }
    function clearHoveredGeoset() {
      if (state.hoveredGeoset === null) return;
      state.hoveredGeoset = null; latest.current.onHoverGeoset?.(null);
    }
    function inspectHoveredGeoset(event) {
      const p = latest.current;
      if (!p.highlightSelection || !p.onHoverGeoset) { clearHoveredGeoset(); return; }
      const end = point(event);
      const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geometry.index.array, vertices: entry.geometry.attributes.position.array }] : []);
      const hit = pickPreviewGeoset(projectPreviewGeosets(geometry, camera, end.width, end.height), end.x, end.y);
      const next = hit?.index ?? null;
      if (state.hoveredGeoset !== next) { state.hoveredGeoset = next; p.onHoverGeoset(next); }
    }
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
    // OrbitControls is used only for navigation. Capture configures it before its handler runs.
    function pointerDown(event) {
      if (down || event.target.closest?.('select')) return;
      clearHoveredGeoset();
      surface.focus();
      const action = cameraAction(event);
      rotating = action === 'rotate'; latest.current.onCameraGestureChange?.(rotating);
      surface.style.cursor = viewportCursor(latest.current.cameraMode, latest.current.rotationNormals ? 'rotateNormals' : latest.current.transformMode, rotating);
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
      controls.enabled = false; surface.setPointerCapture(event.pointerId);
      if (action === 'zoom') { down.zoom = camera.zoom; down.cameraPosition = camera.position.clone(); return; }
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
      state.drag = { ...down, selections: selectedMap, snapshots, pivot, workplane: quad && viewWorkplane(boundPane.view) || p.workplane, workplaneEnabled: quad && camera.isOrthographicCamera ? !!viewWorkplane(boundPane.view) : p.workplaneEnabled !== false, payload: null };
    }
    function translateInPlane(start, end, drag, constrain) {
      if (!drag.workplaneEnabled) return screenPlaneTranslation(camera, drag.pivot, end.width, end.height, end.x - start.x, end.y - start.y, constrain);
      const axes = planeAxes(drag.workplane), center = screenPosition(drag.pivot, end);
      const basis = axes.map(axis => { const value = drag.pivot.clone(); value.setComponent(axis, value.getComponent(axis) + 1); return screenPosition(value, end).sub(center).toArray(); });
      return new THREE.Vector3().fromArray(projectedPlaneTranslation(drag.workplane, basis, end.x - start.x, end.y - start.y, constrain));
    }
    function showBox(value) { setBox({ ...value, left: value.left + (boundPane.rect?.left || 0), top: value.top + (boundPane.rect?.top || 0) }); }
    function pointerMove(event) {
      if (!down) {
        const hoveredPane = panes.find(pane => pane.surface === event.currentTarget);
        if (hoveredPane) bindPane(hoveredPane);
        inspectHoveredGeoset(event); bindPane(activePane); return;
      }
      const rawEnd = point(event), end = down.action === 'select' ? rawEnd : pointerDragPoint(down, rawEnd, down.pointerSensitivity), dx = end.x - down.x, dy = end.y - down.y;
      if (down.action === 'anchor') {
        const distance = Math.hypot(rawEnd.x - down.x, rawEnd.y - down.y);
        if (distance > 5) {
          showBox({ left: Math.min(down.x, rawEnd.x), top: Math.min(down.y, rawEnd.y), width: Math.abs(rawEnd.x - down.x), height: Math.abs(rawEnd.y - down.y) });
          down.anchorCandidate = anchorVertexInMarquee(latest.current, down, rawEnd); state.anchorCandidate = down.anchorCandidate; invalidate();
        } else { setBox(null); down.anchorCandidate = state.anchorCandidate = null; invalidate(); }
        return;
      }
      if (down.action === 'zoom') {
        const factor = Math.exp(-dy * .01);
        zoomEditorCamera(camera, down.zoom * factor);
        controls.update(); return;
      }
      if (down.action === 'select') { if (Math.hypot(dx, dy) > 5) showBox({ left: Math.min(down.x, end.x), top: Math.min(down.y, end.y), width: Math.abs(dx), height: Math.abs(dy) }); return; }
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
        const freePlane = quad && camera.isOrthographicCamera && !drag.workplaneEnabled;
        if (!freePlane && normal.dot(viewDirection) > 0) angle = -angle;
        if (event.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12;
        if (freePlane) {
          // The existing Euler payload also represents rotation about a free view's normal.
          rotation.setFromQuaternion(new THREE.Quaternion().setFromAxisAngle(camera.getWorldDirection(new THREE.Vector3()), angle));
          payload.rotation = [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg);
        } else {
          const degrees = [0, 0, 0]; degrees[axis] = THREE.MathUtils.radToDeg(angle); payload.rotation = degrees;
          rotation.set(degrees[0] * Math.PI / 180, degrees[1] * Math.PI / 180, degrees[2] * Math.PI / 180);
        }
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
      rotating = false; latest.current.onCameraGestureChange?.(false);
      surface.style.cursor = viewportCursor(latest.current.cameraMode, latest.current.rotationNormals ? 'rotateNormals' : latest.current.transformMode);
      const start = down; down = null; setBox(null); controls.enabled = true;
      if (!start) return;
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
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
      rotating = false; latest.current.onCameraGestureChange?.(false);
      const drag = state.drag;
      if (drag) for (const [key, vertices] of Object.entries(drag.snapshots)) {
        const position = state.entries[key]?.geometry.attributes.position;
        if (position) { position.array.set(vertices); position.needsUpdate = true; }
      }
      if (down && surface.hasPointerCapture(down.pointerId)) surface.releasePointerCapture(down.pointerId);
      state.drag = null; state.anchorCandidate = null; down = null; setBox(null); controls.enabled = true; state.dirty = true; invalidate();
    }
    const frameModel = event => { cancelGesture(); state.fit(event.detail?.selection === true); };
    const viewCamera = event => { cancelGesture(); if (quad) activatePane(panes.find(pane => pane.id === 'perspective')); if (applyModelCamera(perspective, controls, event.detail)) { camera = perspective; state.camera = camera; state.appliedView = 'perspective'; invalidate(); } };
    window.addEventListener('mdlxl-view-camera', viewCamera);
    const cancelKey = event => { if (event.key === 'Escape' && down) { cancelGesture(); event.preventDefault(); event.stopPropagation(); } };
    // WarmKeys consumes Escape before viewport key listeners. Its Clear command
    // gives an in-progress drag first refusal through this cancelable event.
    const cancelCommand = event => { if (down) { cancelGesture(); event.preventDefault(); } };
    const contextMenu = event => event.preventDefault();
    const pointerLeave = () => { if (!down) clearHoveredGeoset(); };
    bindInput(singlePane);
    window.addEventListener('mdlvis-frame', frameModel); window.addEventListener('keydown', cancelKey, true);
    window.addEventListener('mdlxl-cancel-gesture', cancelCommand);
    const contextLost = event => { event.preventDefault(); state.scheduler?.dispose(); setError('The graphics context was lost. Reload the editor to restore the viewport. Save your work first.'); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    let callbackTime = performance.now();
    function render(now, delta) {
      const visible = quad ? panes.slice(1) : [singlePane];
      renderer.setScissorTest(quad);
      for (const pane of visible) {
        bindPane(pane);
        const { left, top, width, height } = pane.rect;
        renderer.setViewport(left, host.current.clientHeight - top - height, width, height);
        renderer.setScissor(left, host.current.clientHeight - top - height, width, height);
        if (renderPane(now, delta) === false) { bindPane(activePane); return false; }
      }
      bindPane(activePane);
    }
    function renderPane(now, delta) {
      if (state.disposed) return;
      const p = latest.current, renderGraphics = graphicsOptions(p.preferences), visual = visualOptions(p.preferences), appearance = viewportAppearanceOptions(p.preferences);
      const lighting = previewLighting(p.preferences); configurePreviewLights(ambient, key, lighting);
      surface.style.cursor = viewportCursor(p.cameraMode, p.rotationNormals ? 'rotateNormals' : p.transformMode, rotating);
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
      const clipRadius = modelClipRadius(p.model, state.center, state.radius);
      grid.update(p.preferences, p.workplane, overlays.grid, overlays.axes, surface.clientWidth, surface.clientHeight, quad ? { camera, target: controls.target, settings: appearance.quadView.grid } : null);
      platform.update(p.preferences, state.center, state.radius, state.floor || 0);
      const selectedMap = selections(p), active = editableGeosets(p);
      const selectionKey = `${JSON.stringify(selectedMap, (_, value) => value instanceof Set ? [...value] : value)}|${[...active].join(',')}|${JSON.stringify(p.hiddenVertices, (_, value) => value instanceof Set ? [...value] : value)}|${p.mode}|${p.sequenceIndex}|${p.transformMode}|${JSON.stringify(visual)}`;
      const rgbState = vertexRgbPreviewState(p.model, { enabled: p.rgbPreview, sequenceIndex: p.rgbPreview ? p.rgbPreviewSequenceIndex : p.sequenceIndex, frame: state.frame, globalTime: state.globalTime });
      const previewChanged = state.rgbPreviewSequence !== rgbState.sequenceIndex || state.rgbPreviewFrame !== rgbState.frame;
      const changed = state.dirty || state.nodes.some(node => node.Flags & 120) || p.playing || state.sampledFrame !== state.frame || state.sampledSequence !== p.sequenceIndex || previewChanged || (showMarkers && !state.sampledSkeleton) || state.sampledExplicitOverlays !== overlays.explicit;
      const animOptions = { interval: rgbState.interval, globalSequences: p.model?.GlobalSequences, globalTime: rgbState.globalTime };
      if (changed && p.model && !state.drag) {
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
        state.sampledFrame = state.frame; state.sampledSequence = p.sequenceIndex; state.rgbPreviewSequence = rgbState.sequenceIndex; state.rgbPreviewFrame = rgbState.frame; state.sampledSkeleton = showMarkers; state.sampledExplicitOverlays = overlays.explicit; state.dirty = false;
      }
      const hidden = p.hiddenGeosets instanceof Set ? p.hiddenGeosets : new Set(p.hiddenGeosets || []);
      for (let index = 0; index < state.entries.length; index++) {
        const entry = state.entries[index]; if (!entry) continue;
        const chosen = active.has(index), selection = selectionArray(selectedMap[index]);
        const hovered = p.hoveredGeoset === index;
        const geosetAnim = state.geosetAnims.get(index);
        const alpha = rgbState.sequenceIndex >= 0 ? sampleTrack(geosetAnim?.Alpha, rgbState.frame, { ...animOptions, fallback: 1 }) : typeof geosetAnim?.Alpha === 'number' ? geosetAnim.Alpha : 1;
        entry.group.visible = hovered || (!hidden.has(index) && (alpha > .001 || p.mode !== 'textured'));
        entry.hoverWire.visible = hovered; entry.hoverPoints.visible = hovered;
        const pureWireframe = p.mode === 'wireframe' || p.mode === 'vertices';
        const activeAppearance = chosen ? appearance.selectedGeoset : appearance.otherGeoset;
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
        configureWideLine(entry.wire.material, activeAppearance, surface.clientWidth, surface.clientHeight);
        configureWideLine(entry.hiddenWire.material, activeAppearance, surface.clientWidth, surface.clientHeight, visual.occludedOpacity);
        entry.hoverWire.material.color.set(visual.selectedGeometry); entry.hoverPoints.material.color.set(visual.selectedGeometry);
        for (let layerIndex = 0; layerIndex < entry.meshes.length; layerIndex++) {
          const mesh = entry.meshes[layerIndex], material = mesh.material, layer = entry.layers[layerIndex];
          applyPreviewMaterialLighting(material, lighting);
          mesh.visible = (p.rgbPreview || p.mode !== 'wireframe' && p.mode !== 'vertices') && (p.mode === 'textured' || layerIndex === 0);
          if (p.rgbPreview) entry.depth.visible = false;
          const textureIndex = Math.round(sampleTrack(layer.TextureID, rgbState.frame, { ...animOptions, fallback: 0 }));
          const textureInfo = p.model?.Textures?.[textureIndex];
          const textured = p.mode === 'textured' && renderGraphics.textures;
          const map = !textured || textureInfo?.ReplaceableId === 1 ? null : textureInfo?.ReplaceableId === 2 ? state.teamGlow : state.textures.get(textureIndex) || state.checker;
          if (material.map !== map) { material.map = map; material.needsUpdate = true; }
          material.color.set(textured ? textureInfo?.ReplaceableId === 1 || textureInfo?.ReplaceableId === 2 ? p.teamColor : 0xffffff : COLORS[index % COLORS.length]);
          material.userData.geosetTint.value.set(1, 1, 1);
          if (textured || p.rgbPreview) {
            const sampled = sampleGeosetAnimation(p.model, index, rgbState.frame, rgbState.sequenceIndex, rgbState.globalTime);
            // RGB preview is a tint, including for the untextured Team Color
            // layer. Starting from white here discarded the selected team.
            if (p.rgbPreview) material.color.set(textureInfo?.ReplaceableId === 1 || textureInfo?.ReplaceableId === 2 ? p.teamColor : 0xffffff).multiply(new THREE.Color(...sampled.color));
            else material.userData.geosetTint.value.fromArray(sampled.color);
          }
          material.opacity = textured ? Math.max(0, Math.min(1, alpha * sampleTrack(layer.Alpha, rgbState.frame, { ...animOptions, fallback: 1 }))) : 1;
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
            if (textureAnim && rgbState.sequenceIndex >= 0) {
              const translation = new THREE.Vector3().fromArray(sampleTrack(textureAnim.Translation, rgbState.frame, { ...animOptions, fallback: [0, 0, 0] }));
              const rotation = new THREE.Quaternion().fromArray(sampleTrack(textureAnim.Rotation, rgbState.frame, { ...animOptions, fallback: [0, 0, 0, 1], quaternion: true }));
              const scale = new THREE.Vector3().fromArray(sampleTrack(textureAnim.Scaling, rgbState.frame, { ...animOptions, fallback: [1, 1, 1] }));
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
      updateDepthClipping(camera, state.center, clipRadius, quad ? grid.userData.extent : gridDepthExtent(state.center, gridOptions(p.preferences).extent));
      const light = cameraLeftLight(camera, controls.target, state.radius);
      key.position.copy(light.position); key.target.position.copy(controls.target);
      ambient.position.copy(light.direction);
      try { renderer.render(scene, camera);
        if (p.presentation === 'preview' && previewOverlaySettings(p.previewOverlay).mode !== 'none') {
          if (!previewCanvas) { previewCanvas = document.createElement('canvas'); previewCanvas.dataset.geometryOverlay = ''; previewCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; surface.appendChild(previewCanvas); }
          previewCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); previewCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geoset.Faces, vertices: entry.geometry.attributes.position.array }] : []);
          drawPresentationOverlay(previewCanvas.getContext('2d'), geometry, camera, surface.clientWidth, surface.clientHeight, p.previewOverlay, renderer.getPixelRatio());
        } else if (previewCanvas) { previewCanvas.remove(); previewCanvas = null; }
        if (p.overlays?.normals || p.showNormals) {
          if (!normalCanvas) { normalCanvas = document.createElement('canvas'); normalCanvas.dataset.normalOverlay = ''; normalCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; surface.appendChild(normalCanvas); }
          normalCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); normalCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          const geometry = state.entries.flatMap((entry, index) => entry?.group.visible && active.has(index) ? [{ index, vertices: entry.geometry.attributes.position.array, normals: entry.geometry.attributes.normal.array }] : []);
          drawPreviewGeometryOverlay(normalCanvas.getContext('2d'), geometry, camera, surface.clientWidth, surface.clientHeight, { normals: true, preferences: p.preferences }, state.center, state.radius, renderer.getPixelRatio());
        } else if (normalCanvas) { normalCanvas.remove(); normalCanvas = null; }
        if (showMarkers) {
          if (!nodeCanvas) { nodeCanvas = document.createElement('canvas'); nodeCanvas.dataset.nodeOverlay = ''; nodeCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; surface.appendChild(nodeCanvas); }
          nodeCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); nodeCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          const width = surface.clientWidth, height = surface.clientHeight;
          const nodes = projectMovementNodes(p.model, state.frame, p.sequenceIndex, camera, width, height, state.globalTime, state.matrices);
          const options = { ...overlays, boneLines: true, preferences: p.preferences, glMarkers: true, wireframeMarkers: p.mode === 'wireframe' || p.mode === 'vertices', occludedMarkerEdges: p.mode === 'solid' || p.mode === 'textured' };
          rigMarkers.draw(camera, nodes, p.selectedNodeIds || [], options); renderer.resetState(); renderer.setScissorTest(quad);
          drawMovementOverlay(nodeCanvas.getContext('2d'), nodes, p.selectedNodeIds || [], [], width, height, renderer.getPixelRatio(), options);
        } else if (nodeCanvas) { nodeCanvas.remove(); nodeCanvas = null; }
        if (p.overlays?.cameras ?? p.showCameras) {
          if (!cameraCanvas) { cameraCanvas = document.createElement('canvas'); cameraCanvas.dataset.cameraOverlay = ''; cameraCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; surface.appendChild(cameraCanvas); }
          cameraCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); cameraCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          drawModelCameraOverlay(cameraCanvas.getContext('2d'), p.model || {}, camera, surface.clientWidth, surface.clientHeight, renderer.getPixelRatio(), state.frame, p.sequenceIndex, state.globalTime, state.radius, visual.node);
        } else if (cameraCanvas) { cameraCanvas.remove(); cameraCanvas = null; }
        const overlayPoint = value => {
          const entry = value && state.entries[value.geosetIndex], position = entry?.geometry.attributes.position;
          if (!position || value.vertexIndex < 0 || value.vertexIndex >= position.count || !entry.group.visible) return null;
          const projected = new THREE.Vector3().fromBufferAttribute(position, value.vertexIndex).project(camera);
          return projected.z >= -1 && projected.z <= 1 ? projected : null;
        };
        const anchorPoint = overlayPoint(p.zoomAnchor), candidatePoint = overlayPoint(p.choosingZoomAnchor ? state.anchorCandidate : null);
        if (anchorPoint || candidatePoint) {
          if (!anchorCanvas) { anchorCanvas = document.createElement('canvas'); anchorCanvas.dataset.anchorOverlay = ''; anchorCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2'; surface.appendChild(anchorCanvas); }
          anchorCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); anchorCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          const context = anchorCanvas.getContext('2d'), pixelRatio = renderer.getPixelRatio(), width = surface.clientWidth, height = surface.clientHeight;
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
      savePane();
      const remember = pane => ({ id: pane.id, view: pane.view, perspective: pane.perspective.clone(), ortho: pane.ortho.clone(), target: pane.controls.target.clone(), center: pane.center.clone(), radius: pane.radius });
      cameraMemory.current = { ...remember(singlePane), panes: panes.slice(1).map(remember) };
      state.disposed = true; state.scheduler.dispose(); document.removeEventListener('visibilitychange', state.scheduler.sync); resizeObserver.disconnect(); panes.forEach(pane => { pane.dispose(); pane.grid.dispose(); });
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      window.removeEventListener('mdlvis-frame', frameModel); window.removeEventListener('mdlxl-view-camera', viewCamera); window.removeEventListener('keydown', cancelKey, true);
      window.removeEventListener('mdlxl-cancel-gesture', cancelCommand);
      cameraCanvas?.remove(); normalCanvas?.remove(); nodeCanvas?.remove(); previewCanvas?.remove(); anchorCanvas?.remove(); rigMarkers.dispose(); platform.dispose(); clearGroup(modelGroup); state.textures.forEach(texture => texture.dispose()); state.markerTextures.forEach(texture => texture.dispose()); state.background.texture.dispose(); state.checker.dispose(); state.teamGlow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); runtime.current = null;
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
        const material = layerMaterial(layer, shaded && graphics.lighting); material.polygonOffset = false; material.alphaToCoverage = graphics.antialias;
        const mesh = new THREE.Mesh(layerGeometry, material); mesh.userData.geosetIndex = index; mesh.userData.baseUV = new Float32Array(layerGeometry.attributes.uv.array); mesh.renderOrder = index * 16 + layerIndex; mesh.frustumCulled = false; group.add(mesh); meshes.push(mesh);
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
      updateWideWireGeometry(state.entries[index]);
    }
    const signature = `${model.Info?.Name}|${model.Geosets?.map(g => g.Vertices.length).join(',')}`;
    if (state.loadedSignature === null) {
      state.loadedSignature = signature; state.fit();
      const saved = cameraMemory.current;
      if (saved && (latest.current.quadView || saved.view === latest.current.view)) { state.setView(saved.view); state.perspective.copy(saved.perspective); state.ortho.copy(saved.ortho); state.controls.target.copy(saved.target); state.center.copy(saved.center); state.radius=saved.radius; state.resize(); state.controls.update(); }
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
    const assets = textureAssets instanceof Map ? textureAssets : new Map(Object.entries(textureAssets || {}));
    const normalized = new Map([...assets].map(([path, asset]) => [normalizedPath(path), asset]));
    for (const index of state.textureSources.keys()) if (index >= (model?.Textures?.length || 0)) { state.textures.get(index)?.dispose(); state.textures.delete(index); state.textureSources.delete(index); }
    const failures = [], jobs = (model?.Textures || []).map(async (texture, index) => {
      const path = normalizedPath(texture.Image);
      const asset = normalized.get(path) || normalized.get(path.split('\\').at(-1));
      const key = `${path}|${texture.Flags}|${texture.ReplaceableId}`, previous = state.textureSources.get(index);
      if (previous && previous.asset === asset && previous.key === key) { if (previous.error) failures.push(previous.error); return; }
      state.textures.get(index)?.dispose(); state.textures.delete(index);
      const source = { asset, key }; state.textureSources.set(index, source);
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
  }, [textureSignature, textureAssets, texturesNeeded, graphics.textures, graphics.antialias]);

  useEffect(() => { runtime.current?.setQuad(props.quadView); }, [props.quadView, graphics.antialias]);
  useEffect(() => { if(!props.quadView && runtime.current && runtime.current.appliedView !== view) runtime.current.setView(view); }, [view, props.quadView, graphics.antialias]);
  useEffect(() => { if (props.quadView && props.viewRequest) runtime.current?.setView(props.viewRequest.view); }, [props.viewRequest]);
  useEffect(() => { if (props.cameraAnglesRequest) runtime.current?.setCameraAngles(props.cameraAnglesRequest); }, [props.cameraAnglesRequest]);
  useEffect(() => { runtime.current?.refreshCursor(); }, [cameraMode, transformMode, props.rotationNormals]);
  useEffect(() => { setAdjustingSensitivity(null); }, [props.preferences?.wheelMode]);
  useEffect(() => { const controls = runtime.current?.controls; if (controls) controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(props.preferences?.pointerSensitivity); }, [props.preferences?.pointerSensitivity]);
  useEffect(() => { runtime.current?.resize(); }, [graphics.pixelRatio, showGrid, props.overlays?.grid, props.preferences?.grid]);
  useEffect(() => { runtime.current?.scheduler.sync(); }, [props.presentation, props.previewMode, props.previewOverlay, model, revision, props.hoveredGeoset, selectedGeoset, selectedVertices, props.selectionByGeoset, props.selectableGeosets, hiddenGeosets, props.hiddenVertices, mode, showSkeleton, showGrid, props.showAxes, props.showVertices, props.overlays, props.showCameras, props.preferences, props.rgbPreview, props.rgbPreviewSequenceIndex, workplane, transformMode, props.zoomAnchor, props.choosingZoomAnchor, sequenceIndex, time, playing, teamColor, props.suspended, graphics.maxFps, graphics.pauseWhenHidden, graphics.textures, graphics.lighting]);
  return <div className="viewport" style={{ position: 'relative', width: '100%', height: '100%', minHeight: props.presentation === 'preview' ? 0 : 180, background: '#ccc', overflow: 'hidden' }}>
    <div ref={host} tabIndex={0} aria-label="3D model viewport" style={{ position: 'absolute', inset: 0, outline: 'none', cursor: viewportCursor(cameraMode, transformMode) }} />
    {!props.quadView && props.showOrientationCompass !== false && props.presentation !== 'preview' && <div className="viewport-orientation-compass" aria-label="View orientation" title="View orientation — click an axis to snap the camera" style={{ position: 'absolute', top: 31, left: 4, width: 82, height: 82, zIndex: 3, filter: 'drop-shadow(0 1px 2px #0008)' }}>
      <svg viewBox="0 0 82 82" width="82" height="82" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <circle cx="41" cy="41" r="34" fill="#18202bdd" stroke="#c8d6e8aa" />
        {compassAxes.map(axis => <g key={axis.id} opacity={axis.depth < -.2 ? .48 : 1}><line x1="41" y1="41" x2={41 + axis.x * 25} y2={41 + axis.y * 25} stroke={axis.color} strokeWidth="3" strokeLinecap="round" /><circle cx={41 + axis.x * 25} cy={41 + axis.y * 25} r="7" fill={axis.color} stroke="#fff9" /></g>)}
        <circle cx="41" cy="41" r="5" fill="#e7eef8" stroke="#1b2430" />
      </svg>
      {compassAxes.map(axis => <button key={axis.id} type="button" aria-label={axis.title} title={axis.title} onPointerDown={event => event.stopPropagation()} onClick={() => props.onViewChange?.(axis.view)} style={{ position: 'absolute', left: 41 + axis.x * 25, top: 41 + axis.y * 25, width: 20, height: 20, transform: 'translate(-50%, -50%)', border: 0, borderRadius: '50%', padding: 0, background: 'transparent', color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: '20px', textShadow: '0 1px 1px #000', cursor: 'pointer' }}>{axis.label}</button>)}
    </div>}
    {adjustingSensitivity !== null && <div role="status" style={sensitivityIndicatorStyle}>{sensitivityIndicatorText(adjustingSensitivity)}</div>}
    {textureMessage && <div role="status" style={{ position: 'absolute', bottom: 4, left: 5, color: '#fff0cb', fontSize: 11, pointerEvents: 'none' }}>{textureMessage}</div>}
    {backgroundMessage && <div role="status" style={{ position: 'absolute', top: 4, left: 5, color: '#5b2500', background: '#fff4d6dd', padding: '2px 5px', fontSize: 11, pointerEvents: 'none' }}>{backgroundMessage}</div>}
    {box && <div style={{ position: 'absolute', ...box, border: '1px dotted white', pointerEvents: 'none' }} />}
    {error && <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 30, color: '#300', background: '#ddd', textAlign: 'center', fontSize: 13 }}>{error}</div>}
  </div>;
}
