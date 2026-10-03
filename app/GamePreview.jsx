import { particlePreviewBounds, installParticleNativeCompatibility, particleSurfaceAnchor, ParticleAuthoringPreview, updateParticlePreview, particleStageSnapshot, rememberParticlePicture, pickPreviewParticles, seededParticleRandom, withParticleRandom, replayParticlePreview } from './particle-preview-adapter.js';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EditorCameraControls, editorCameraAngles, preserveShiftCameraAction, setEditorCameraAngles, zoomEditorCamera } from './editor-camera-controls.js';
import { viewportCursor, showcaseCursor } from './viewport-cursors.js';
import { createPreviewSceneGL } from './preview-scene-gl.js';
import { projectPreviewGeosets, pickPreviewGeoset, selectPreviewUVCoordinates, selectPreviewVertices } from './preview-selection.js';
import { cameraLeftLight, improveNativeTexture, captureDimensions, nativeTeamColor, viewportPixelRatio } from './viewport-quality.js';
import { createRigMarkersGL } from './rig-markers-gl.js';
import { boneVertexHighlights } from '../src/bone-tools.js';
import { billboardCameraCorrection } from './preview-pose.js';
import { drawModelCameraOverlay } from './model-camera-overlay.js';
import { drawCollisionSpheres } from './optimizexl-overlays.js';
import { ModelRenderer } from 'war3-model';
import { advanceShowcaseModel } from './showcase-playback.js';
import { showcaseOrbitRadius, setShowcaseOrbitCamera, showcaseFraming } from './showcase-orbit.js';
import { cropPixels, containRect, recordingDimensions } from './showcase-crop.js';
import { textureFromAsset } from './Viewport.jsx';
import { drawGeosetHighlight } from './geoset-highlight.js';
import { allNodes, localSequenceAtFrame, sampleGeosetAnimation, sampleNodeMatrices, skinGeoset, skinGeosetNormals } from '../src/animation.js';
import { isolateGlobalSequence } from '../src/global-sequence-preview.js';
import { motionPose } from '../src/motion-inspector.js';
import { applyMovementTransform, movementRestricted } from '../src/movement.js';
import { applyPortraitModelTransform } from '../src/portrait-model-control.js';
import { movementBoneVertexCenter } from '../src/movement-selection.js';
import { drawAttachGuide, drawBoneConnectors, drawMovementOverlay, movementAxisHandles, movementDragAmount, movementFreeScaleValues, movementNodeSelection, movementWorkplaneHandle, movementWorkplanePointer, pickMovementHandle, pickMovementNode, projectMovementNodes } from './movement-overlay.js';
import { applyRestPoseMatrices, isUVOnlyPreviewChange, portraitBlankDragRotatesCamera, restorePreviewCamera } from './game-preview-data.js';
import { installWarcraftPreviewAdapter, resetPreviewEffects, previewGeosetTint } from './warcraft-preview-adapter.js';
import { composePreviewCapture, drawPreviewBackground, previewPlaybackStep } from './game-preview-capture.js';
import { createGLPreviewBackground } from './game-preview-background-gl.js';
import { createAnimatedPreviewBackground } from './animated-preview-background.js';
import { createVideoPreviewBackground } from './video-preview-background.js';
import { drawPreviewGeometryOverlay, drawPresentationOverlay, previewOverlayOptions, visibleMovementPoints } from './preview-overlays.js';
import { previewPresentationProps, previewOverlaySettings } from './preview-presentation.js';
import { bindScrollSensitivity, createRenderScheduler, graphicsOptions, pointerSensitivityValue, sensitivityIndicatorStyle, sensitivityIndicatorText } from './viewport-performance.js';

import { createEventPreview } from './event-preview-runtime.js';
import { applyViewPreset, applyModelCamera, gridDepthExtent, gridFrameRadius, orthographicHalfHeight, perspectiveFitDistance, updateDepthClipping, modelClipRadius, projectedPlaneTranslation, screenPlaneTranslation } from './viewport-math.js';
import { visualOptions, viewportAppearanceOptions, gridOptions, cameraBindings } from '../src/preferences.js';
import { decodeDds } from '../src/dds.js';
import { scalePlaybackDelta } from '../src/playback-speed.js';
import { HUMAN_FRAME_CROP, HUMAN_FRAME_SIZE, HUMAN_TILE_LAYOUT, PORTRAIT_ASPECT, PORTRAIT_RECT, applyEvaluatedModelCamera, editorCameraSnapshot, evaluateModelCamera, portraitCaptureLayout } from './portrait-view.js';
import './portrait-view.css';
import ShowcaseLayers from './ShowcaseLayers.jsx';

const pathKey = value => String(value || '').replaceAll('/', '\\').toLowerCase();
let humanFramePromise;
const portraitHasFrame = props => props.portraitMode && props.showcasePortraitFrame !== false;

function textureCanvas(texture) {
  const image = texture?.image, canvas = document.createElement('canvas');
  if (!image?.width || !image?.height) throw Error('A Human console tile could not be decoded.');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (image.data) context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  else context.drawImage(image, 0, 0);
  return canvas;
}

async function loadHumanFrame() {
  if (!window.desktop?.loadHumanPortraitFrame) throw Error('Human UI frame unavailable. Use the complete packaged desktop app, including its resources folder.');
  const records = await window.desktop.loadHumanPortraitFrame();
  const tiles = new Map();
  for (const layout of HUMAN_TILE_LAYOUT) {
    const asset = records.find(record => pathKey(record.name).endsWith(layout.name));
    if (!asset) throw Error(`Human UI frame unavailable. Missing ${layout.name}.`);
    const texture = await textureFromAsset(asset);
    try { tiles.set(layout.name, textureCanvas(texture)); } finally { texture.dispose(); }
  }
  const consoleCanvas = document.createElement('canvas'); consoleCanvas.width = 1024; consoleCanvas.height = 352;
  const context = consoleCanvas.getContext('2d');
  for (const row of HUMAN_TILE_LAYOUT) context.drawImage(tiles.get(row.name), row.sx, row.sy, row.sw, row.sh, row.dx, row.dy, row.dw, row.dh);
  const frame = document.createElement('canvas'); frame.width = HUMAN_FRAME_SIZE; frame.height = HUMAN_FRAME_SIZE;
  frame.getContext('2d').drawImage(consoleCanvas, HUMAN_FRAME_CROP.x, HUMAN_FRAME_CROP.y, HUMAN_FRAME_CROP.width, HUMAN_FRAME_CROP.height, 0, 0, HUMAN_FRAME_SIZE, HUMAN_FRAME_SIZE);
  return { canvas: frame, url: frame.toDataURL('image/png') };
}

function composePortraitCapture(modelCanvas, frameCanvas) {
  const layout = portraitCaptureLayout(modelCanvas.width, modelCanvas.height), snapshot = document.createElement('canvas');
  snapshot.width = snapshot.height = layout.size;
  const context = snapshot.getContext('2d'); context.fillStyle = '#000000'; context.fillRect(0, 0, layout.size, layout.size);
  context.drawImage(modelCanvas, layout.model.x, layout.model.y, layout.model.width, layout.model.height);
  if (frameCanvas) context.drawImage(frameCanvas, 0, 0, layout.size, layout.size);
  return snapshot;
}

function releasePreviewGraphics(native, gl, canvas) {
  // war3-model 4.0.1 destroys HD environment shaders even for SD models,
  // where those shader objects were never created. Guard only missing shaders
  // so the rest of its normal resource cleanup can still run to completion.
  const destroyShader = native?.destroyShaderProgramObject;
  if (typeof destroyShader === 'function') native.destroyShaderProgramObject = function (shader) {
    if (shader) return destroyShader.call(this, shader);
  };
  try { native?.destroy(); }
  catch (cause) { console.warn('Warcraft preview cleanup failed; releasing its graphics context.', cause); }
  finally {
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); }
    finally { canvas.remove(); }
  }
}

/** Upstream Warcraft renderer runs on its own GL canvas; editing is separate. */
export default function GamePreview(inputProps) {
  const presentationProps = previewPresentationProps(inputProps);
  // Portrait keeps the v4 camera/frame path and normal Movement editing props.
  const props = presentationProps;
  if (props.showcase) props.portraitMode = !!props.showcasePortraitMode;
  const { model, revision = 0, sequenceIndex = -1, textureAssets, view = 'perspective' } = props;
  const root = useRef(null), host = useRef(null), stage = useRef(null), layerAPI = useRef(null), runtime = useRef(null), latest = useRef(props); latest.current = props;
  const [error, setError] = useState(''), [warnings, setWarnings] = useState([]), [eventWarnings, setEventWarnings] = useState([]), [adjustingSensitivity, setAdjustingSensitivity] = useState(null), [gestureLabel, setGestureLabel] = useState('');
  const [backgroundError, setBackgroundError] = useState('');
  const [selectionBox, setSelectionBox] = useState(null);
  const [portraitSize, setPortraitSize] = useState(256), [portraitFrameVersion, setPortraitFrameVersion] = useState(0);
  const portraitFrame = useRef({ status: 'idle', canvas: null, url: '', error: '', promise: Promise.resolve() });
  const backgroundState = useRef({ url: null, status: 'ready', image: null, promise: Promise.resolve() });
  const layerComposite = useRef(null);
  const cameraMemory = useRef(null);
  const rendererSource = useRef({ input: null, build: null });
  if (rendererSource.current.input !== model) {
    if (!isUVOnlyPreviewChange(rendererSource.current.input, model)) rendererSource.current.build = model;
    rendererSource.current.input = model;
  }
  const rendererModel = rendererSource.current.build;
  const rendererRevisionState = useRef({ seen: revision, stable: revision });
  if (rendererRevisionState.current.seen !== revision) {
    rendererRevisionState.current.seen = revision;
    // A completed viewport bone drag already changed the owned renderer model.
    // Do not destroy/recreate WebGL (black flash) just to install the same keys.
    if (props.liveMovementRevision !== revision) rendererRevisionState.current.stable = revision;
  }
  const rendererRevision = rendererRevisionState.current.stable;
  const graphics = { ...graphicsOptions(props.preferences), ...(props.portraitMode ? { lighting: true, textures: true } : {}) };
  const viewportBackground = viewportAppearanceOptions(props.preferences).background;
  const appearanceBackgroundUrl = props.backgroundUrl || (viewportBackground.type === 'image' ? viewportBackground.imageData : '');
  const appearanceBackgroundType = props.backgroundUrl ? props.backgroundType : appearanceBackgroundUrl ? appearanceBackgroundUrl.slice(5, appearanceBackgroundUrl.indexOf(';')) : '';
  const globalPreviewId = !props.restPose && Number.isInteger(props.globalSeqId) && model?.GlobalSequences?.[props.globalSeqId] > 0 ? props.globalSeqId : null;
  // Equal comparison panes can occupy half a CSS pixel. Align the complete
  // render surface (including hover/collision overlays) to physical pixels.
  useLayoutEffect(() => {
    if (!props.pixelAligned || !root.current || props.portraitMode) return;
    const element=root.current, stage=element.querySelector('.game-preview-stage'), owner=element.ownerDocument.defaultView;
    const align=()=>{
      const r=element.getBoundingClientRect(), dpr=owner.devicePixelRatio||1;
      Object.assign(stage.style,{left:`${Math.ceil(r.x*dpr-1e-6)/dpr-r.x}px`,top:`${Math.ceil(r.y*dpr-1e-6)/dpr-r.y}px`,right:'auto',bottom:'auto',width:`${Math.max(1,Math.floor(r.width*dpr)-1)/dpr}px`,height:`${Math.max(1,Math.floor(r.height*dpr)-1)/dpr}px`});
    };
    const observer=new owner.ResizeObserver(align);observer.observe(element);owner.addEventListener('resize',align);align();
    return()=>{observer.disconnect();owner.removeEventListener('resize',align);for(const key of ['left','top','right','bottom','width','height'])stage.style[key]='';};
  },[props.pixelAligned,props.portraitMode]);
  const timelineStart = sequenceIndex < 0 ? globalPreviewId !== null ? 0 : Number(props.timelineInterval?.[0]) : NaN;
  const timelineEnd = sequenceIndex < 0 ? globalPreviewId !== null ? model.GlobalSequences[globalPreviewId] : Number(props.timelineInterval?.[1]) : NaN;

  useEffect(() => {
    if (!portraitHasFrame(props) || !root.current) return;
    const PreviewResizeObserver = root.current.ownerDocument.defaultView?.ResizeObserver || ResizeObserver;
    const resize = () => {
      const width = root.current?.clientWidth || 1, height = root.current?.clientHeight || 1;
      setPortraitSize(Math.max(1, Math.floor(Math.min(width - 16, height - 16))));
    };
    const observer = new PreviewResizeObserver(resize); observer.observe(root.current); resize(); return () => observer.disconnect();
  }, [props.portraitMode, props.showcasePortraitFrame]);

  useEffect(() => {
    if (!(portraitHasFrame(props) || props.preparePortraitFrame) || portraitFrame.current.status !== 'idle') return;
    const entry = portraitFrame.current = { status: 'loading', canvas: null, url: '', error: '', promise: null };
    humanFramePromise ||= loadHumanFrame().catch(error => { humanFramePromise = null; throw error; });
    entry.promise = humanFramePromise.then(result => { if (portraitFrame.current !== entry) return; Object.assign(entry, result, { status: 'ready' }); setPortraitFrameVersion(value => value + 1); })
      .catch(error => { if (portraitFrame.current !== entry) return; entry.status = 'failed'; entry.error = error.message; setPortraitFrameVersion(value => value + 1); });
  }, [props.portraitMode, props.showcasePortraitFrame, props.preparePortraitFrame]);

  useEffect(() => {
    setBackgroundError('');
    const url = appearanceBackgroundUrl;
    if (!url) {
      backgroundState.current = { url: null, status: 'ready', image: null, promise: Promise.resolve() };
      runtime.current?.drawBackground(); runtime.current?.scheduler.invalidate(); return;
    }
    let resolve, reject, active = true;
    const entry = { url, status: 'loading', image: null, promise: new Promise((yes, no) => { resolve = yes; reject = no; }) };
    entry.promise.catch(() => {}); backgroundState.current = entry;
    if (appearanceBackgroundType?.startsWith('video/')) {
      const animation = createVideoPreviewBackground(url, {
        getTrim: () => latest.current.backgroundTrim,
        onMetadata: duration => latest.current.onBackgroundMetadata?.(duration),
        onFrame: image => { if (!active) return; entry.status = 'ready'; entry.image = image; resolve(); runtime.current?.drawBackground(); runtime.current?.scheduler.invalidate(); },
        onError: cause => { if (!active) return; entry.status = 'failed'; entry.error = cause; setBackgroundError(cause.message); reject(cause); },
      });
      entry.animation = animation;
      return () => { active = false; animation.dispose(); resolve(); };
    }
    if (appearanceBackgroundType === 'image/gif' || /\.gif(?:[?#]|$)/i.test(url)) {
      const animation = createAnimatedPreviewBackground(url, {
        onFrame: image => { if (!active) return; entry.status = 'ready'; entry.image = image; resolve(); runtime.current?.drawBackground(); runtime.current?.scheduler.invalidate(); },
        onError: cause => { if (!active) return; entry.status = 'failed'; entry.error = cause; setBackgroundError(cause.message); reject(cause); },
      });
      entry.animation = animation;
      runtime.current?.drawBackground();
      return () => { active = false; animation.dispose(); resolve(); };
    }
    const picture = new Image();
    if (/^https?:/i.test(url) && new URL(url, window.location.href).origin !== window.location.origin) picture.crossOrigin = 'anonymous';
    picture.onload = () => { if (!active) return; entry.status = 'ready'; entry.image = picture; resolve(); runtime.current?.drawBackground(); runtime.current?.scheduler.invalidate(); };
    picture.onerror = () => { if (!active) return; entry.status = 'failed'; entry.error = new Error('The selected preview background could not be loaded.'); setBackgroundError(entry.error.message); reject(entry.error); runtime.current?.drawBackground(); };
    picture.src = url; runtime.current?.drawBackground();
    return () => { active = false; picture.onload = null; picture.onerror = null; resolve(); };
  }, [appearanceBackgroundUrl, appearanceBackgroundType]);
  useEffect(() => { backgroundState.current.animation?.setRange?.(); }, [props.backgroundTrim?.start, props.backgroundTrim?.end]);

  useEffect(() => {
    if (!model || !host.current) return;
    const ownerDocument = host.current.ownerDocument, ownerWindow = ownerDocument.defaultView || window, detachedPreview = ownerDocument !== document;
    const requestPreviewFrame = detachedPreview
      ? callback => ownerWindow.setTimeout(() => callback(ownerWindow.performance.now()), 16)
      : ownerWindow.requestAnimationFrame.bind(ownerWindow);
    const cancelPreviewFrame = detachedPreview ? ownerWindow.clearTimeout.bind(ownerWindow) : ownerWindow.cancelAnimationFrame.bind(ownerWindow);
    const backgroundCanvas = ownerDocument.createElement('canvas'); backgroundCanvas.dataset.previewBackground = ''; backgroundCanvas.style.cssText = 'position:absolute;z-index:0;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(backgroundCanvas);
    const canvas = ownerDocument.createElement('canvas'); canvas.dataset.cleanModelCanvas = ''; canvas.style.cssText = 'position:relative;z-index:1;width:100%;height:100%;display:block;touch-action:none;outline:none'; canvas.tabIndex = 0;
    host.current.appendChild(canvas);
    const gl = canvas.getContext('webgl2', { antialias: graphicsOptions(latest.current.preferences).antialias, alpha: false, premultipliedAlpha: false });
    if (!gl) { setError('This preview needs WebGL 2. The geometry editor remains available.'); canvas.remove(); backgroundCanvas.remove(); return; }
    let native, disposed = false, observer, scheduler, hoverCanvas, connectorCanvas, nodeCanvas, geometryCanvas, cameraCanvas, nodePoints = [], nodeHandles = [], nodeGesture = null, selectionGesture = null, posedGeosets = [], posedGeometryCache = null, rotating = false, portraitBackup = null, cameraGestureStart = null, attachPointer = null;
    const cursorSampler=latest.current.showcase?ownerDocument.createElement('canvas'):null;
    const cursorContext=cursorSampler?.getContext('2d',{willReadFrequently:true});
    let cursorPixels=null,cursorPoint={x:.5,y:.5};
    const portraitFraming=new THREE.Vector2();
    const colorLuminance=color=>{const c=new THREE.Color(color);return c.r*.2126+c.g*.7152+c.b*.0722;};
    const cursorFor = (p, active = rotating) => {
      if(!p.showcase)return p.previewSelectionMode&&!active?'default':viewportCursor(p.cameraMode,p.transformMode,active);
      let light=colorLuminance(p.portraitMode?'#000000':viewportAppearanceOptions(p.preferences).background.color);
      if(cursorPixels&&!p.portraitMode){
        const x=Math.max(0,Math.min(cursorSampler.width-1,Math.floor(cursorPoint.x*cursorSampler.width))),y=Math.max(0,Math.min(cursorSampler.height-1,Math.floor(cursorPoint.y*cursorSampler.height))),i=(y*cursorSampler.width+x)*4;
        light=[.2126,.7152,.0722].reduce((sum,weight,index)=>sum+weight*(cursorPixels[i+index]/255)**2.2,0);
      }
      const crop=p.showcaseCrop;
      if(crop&&(cursorPoint.x<crop.x||cursorPoint.x>crop.x+crop.width||cursorPoint.y<crop.y||cursorPoint.y>crop.y+crop.height))light*=.19;
      return showcaseCursor(active,light<.36);
    };
    const rememberShowcasePointer=event=>{
      if(!latest.current.showcase)return;
      const rect=canvas.getBoundingClientRect();cursorPoint={x:(event.clientX-rect.left)/Math.max(1,rect.width),y:(event.clientY-rect.top)/Math.max(1,rect.height)};
    };
    const endShowcaseCursor=()=>{
      if(!latest.current.showcase)return;
      rotating=false;latest.current.onCameraGestureChange?.(false);canvas.style.cursor=cursorFor(latest.current);
    };
    const invalidate = () => scheduler?.invalidate();
    const ownedModel = structuredClone(rendererModel);
    ownedModel.Nodes = []; for (const node of allNodes(ownedModel)) ownedModel.Nodes[node.ObjectId] = node;
    // Global editing plays only its own tracks; the authored model is untouched.
    if (globalPreviewId !== null) isolateGlobalSequence(ownedModel, globalPreviewId);
    // Marker categories retain emitter membership even when effect simulation is
    // disabled; the shared node objects still receive the same live poses.
    const markerModel = { ...ownedModel };
    const hasBillboardedNodes = allNodes(ownedModel).some(node => (node.Flags || 0) & 120);
    // Only the renderer's private clone changes; saved model data remains intact.
    const particlesEnabled = props.showParticles ?? graphics.particles;
    if (!particlesEnabled) { ownedModel.ParticleEmitters = []; ownedModel.ParticleEmitters2 = []; ownedModel.ParticleEmitterPopcorns = []; ownedModel.RibbonEmitters = []; }
    if (!graphics.lighting) for (const material of ownedModel.Materials || []) for (const layer of material.Layers || []) layer.Shading = (layer.Shading || 0) | 1;
    if (!ownedModel.Sequences.length) ownedModel.Sequences = [{ Name: 'Static', Interval: new Uint32Array([0, 1000]), NonLooping: true }];
    // An editor-wide reel spans gaps and multiple saved sequences. This range
    // belongs only to the renderer clone and is never serialized to the model.
    const timelineSequenceIndex = Number.isFinite(timelineStart) && Number.isFinite(timelineEnd) && timelineStart >= 0 && timelineEnd > timelineStart
      ? ownedModel.Sequences.push({ Name: 'Editor timeline', Interval: new Uint32Array([timelineStart, timelineEnd]), NonLooping: true }) - 1 : -1;
    const turntableCamera = new THREE.PerspectiveCamera();
    const turntableRotation = new THREE.Quaternion(), turntableOffset = new THREE.Vector3();
    let displayCamera;
    const displayLight = () => new THREE.Vector3(...(latest.current.showcaseLight === 'portrait' ? [.3,-.3,.25] : [-.65,.55,1])).applyQuaternion(turntableRotation);
    const previewAdapter = installWarcraftPreviewAdapter(gl, ownedModel, () => ({ frame: native.getFrame(), sequenceIndex: native.getSequence(), globalTime: globalClock,
      // Installed UI\\MiscData.txt [Light] Direction=0.3,0.3,-0.25;
      // the classic portrait scene maps this to (y,-x,-z), in model space.
      portrait: !!latest.current.portraitMode || !!latest.current.showcase && latest.current.showcaseLight === 'portrait',
      lightDirection: latest.current.portraitMode ? [.3,-.3,.25] : latest.current.showcase ? displayLight().toArray() : cameraLeftLight(camera, controls.target, radius).direction.toArray(),
      viewDirection: (displayCamera || camera).getWorldDirection(new THREE.Vector3()).negate().toArray(), preferences: latest.current.preferences, hiddenGeosets: latest.current.hiddenGeosets, hideRgbGeoset: latest.current.hideRgbGeoset, surface: latest.current.mode === 'solid', lighting: latest.current.portraitMode || (latest.current.showcase ? latest.current.showcaseLight !== 'none' : latest.current.shaded !== false && graphicsOptions(latest.current.preferences).lighting) }));
    try {
      native = new ModelRenderer(ownedModel); installParticleNativeCompatibility(native); native.initGL(gl); previewAdapter.ready(native);
      // Layered WC3 materials redraw the same triangles at identical depth.
      // WebGL's default LESS would discard diffuse layers over team color.
      gl.depthFunc(gl.LEQUAL);
    }
    catch (cause) { setError(`Warcraft preview could not load this model: ${cause.message}`); previewAdapter.dispose(); releasePreviewGraphics(native, gl, canvas); backgroundCanvas.remove(); return; }
    let particleRandom=seededParticleRandom(),particleReportAt=0,particleStatusKey='',particleReportKey='';
    const particleAuthor=latest.current.particleAuthoring?new ParticleAuthoringPreview(native):null;
    const nativeBackground = createGLPreviewBackground(gl);
    const presentation = createPreviewSceneGL(gl, invalidate);
    const rigMarkers = createRigMarkersGL(gl);
    setError(''); setWarnings([]);
    const perspective = new THREE.PerspectiveCamera(42, 1, .2, 1000); perspective.up.set(0, 0, 1);
    const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, .2, 1000); ortho.up.set(0, 0, 1);
    let camera = perspective;
    const controls = new EditorCameraControls(camera, canvas);
    controls.keepWorldUp=()=>!!latest.current.showcase&&!latest.current.portraitMode;
    controls.lockScreenAxis=!!latest.current.showcase; controls.enableDamping = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: null, RIGHT: THREE.MOUSE.PAN };
    let projectionKey = '';
    const reportProjectionView = () => {
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      const viewMatrix = Array.from(camera.matrixWorldInverse.elements), projectionMatrix = Array.from(camera.projectionMatrix.elements);
      const key = [...viewMatrix, ...projectionMatrix].map(value => value.toFixed(6)).join(',');
      if (key !== projectionKey) { projectionKey = key; latest.current.onProjectionViewChange?.({ viewMatrix, projectionMatrix }); }
    };
    let syncingCamera = false, compareRegistered = false, collisionCanvas = null, externalSeek;
    const snapshotCamera = () => ({ camera: camera === ortho ? 'ortho' : 'perspective', perspective: perspective.clone(), ortho: ortho.clone(), target: controls.target.clone() });
    const receiveCamera = saved => { syncingCamera = true; camera = restorePreviewCamera(saved, perspective, ortho, controls); resize(); reportProjectionView(); invalidate(); syncingCamera = false; };
    const cameraChanged = () => {
      latest.current.onCameraAnglesChange?.(editorCameraAngles(camera)); reportProjectionView(); invalidate();
      const bus = latest.current.compareCamera;
      if (bus && compareRegistered && !syncingCamera) { bus.saved = snapshotCamera(); for (const receive of bus.listeners) if (receive !== receiveCamera) receive(bus.saved); }
    };
    controls.addEventListener('change', cameraChanged);
    let leftGesture = null, previewSelectHeld = false;
    const cancelPreviewGesture = () => {
      if (nodeGesture) {
        restoreGestureTracks(nodeGesture); nodeGesture.adjusted = true; setGestureLabel(''); invalidate(); return;
      }
      if (!leftGesture || leftGesture.adjusted) return;
      // Wisp uses the same held-left gesture as the editor canvases. Restore
      // the camera before the DPI adjustment so a small pointer motion cannot
      // also rotate or pan the animation preview.
      camera.position.copy(leftGesture.position); camera.quaternion.copy(leftGesture.quaternion);
      camera.zoom = leftGesture.zoom; camera.updateProjectionMatrix(); controls.target.copy(leftGesture.target);
      controls.update(); leftGesture.adjusted = true; invalidate();
    };
    const suppressAdjustedMove = event => {
      if (leftGesture?.adjusted && leftGesture.id === event.pointerId) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const finishLeftGesture = event => {
      if (event.type === 'pointercancel') { leftGesture = null; return; }
      if (event.button !== 0 || leftGesture?.id !== event.pointerId) return;
      leftGesture = null;
    };
    const unbindScroll = bindScrollSensitivity(canvas, {
      getPreferences: () => latest.current.preferences,
      onChange: value => latest.current.onSensitivityChange?.(value), onIndicator: value => { setAdjustingSensitivity(value); latest.current.onSensitivityIndicator?.(value); },
      onPointerChange: value => latest.current.onPointerSensitivityChange?.(value),
      onWheelModeChange: value => latest.current.onWheelModeChange?.(value),
      onPointerAdjustment: cancelPreviewGesture,
      onCameraModeToggle: () => latest.current.onCameraModeToggle?.(),
      onWheel: (_event, sensitivity) => { controls.zoomSpeed = sensitivity; },
    });
    const movementSequence = (p, frame) => {
      if (p.restPose) return -1;
      if (Number.isInteger(p.globalSeqId) && p.globalSeqId >= 0) return -1;
      const sequences = p.model.Sequences || [];
      return sequences[p.sequenceIndex] ? p.sequenceIndex : sequences.findIndex(item => frame >= item.Interval[0] && frame <= item.Interval[1]);
    };
    const pointerDown = event => {
      canvas.focus();
      const p = latest.current;
      if (p.suspended) return;
      rememberShowcasePointer(event);
      canvas.style.cursor = cursorFor(p);
      const work = (p.cameraMode ?? 'work') === 'work' && !event.altKey;
      const portraitCameraDrag = portraitBlankDragRotatesCamera(p, event);
      const pickable = nodePoints;
      if (event.button === 0 && p.attachSourceIds?.length) {
        const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        attachPointer = { x, y };
        const target = pickMovementNode(pickable.filter(point => point.overlayKind === 'bones' && !p.attachSourceIds.includes(point.node.ObjectId)), x, y);
        if (target) p.onAttachTarget?.(target.node.ObjectId);
        invalidate(); event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (event.button === 0 && work && !(event.ctrlKey && p.onInspectGeoset) && pickable.length) {
        const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        const editSequence = movementSequence(p, Math.round(native.getFrame()));
        const picked = pickMovementNode(pickable, x, y, p.selectedNodeIds,13,p.transformMode==='move');
        const active = p.transformMode==='move'&&picked?picked:pickable.find(point => point.node.ObjectId === p.selectedNodeIds?.at(-1));
        const editable = p.onNodeTransform && (!p.restPose || p.transformMode === 'move') && !movementRestricted(p.transformMode || 'rotate', p.restrictions) && (p.restPose || editSequence >= 0);
        const directMove=!!picked&&editable&&p.transformMode==='move',screenMove=directMove&&!p.workplaneEnabled;
        const workplaneDrag = active && editable && p.workplaneEnabled && ['move', 'rotate'].includes(p.transformMode) && (directMove||!picked || p.selectedNodeIds?.includes(picked.node.ObjectId));
        const axisHandle = active && editable && !p.workplaneEnabled ? pickMovementHandle(nodeHandles, x, y, p.transformMode) : null;
        const freeScaleDrag = active && editable && p.transformMode === 'scale' && !picked && !axisHandle;
        const handle = active && editable && (workplaneDrag ? movementWorkplaneHandle(p.workplane, active.unitsPerPixel) : axisHandle || freeScaleDrag || screenMove ? axisHandle || { axis: 'XYZ', free: true, dx: 1, dy: -1, unitsPerPixel: active.unitsPerPixel } : null);
        if (handle) {
          const ids = directMove&&!p.selectedNodeIds?.includes(picked.node.ObjectId)?[picked.node.ObjectId]:[...(p.selectedNodeIds || [])], snapshots = new Map();
          if(directMove)p.onSelectNodes?.(ids);
          for (const node of allNodes(ownedModel)) if (ids.includes(node.ObjectId)) snapshots.set(node.ObjectId, structuredClone({ Translation: node.Translation, Rotation: node.Rotation, Scaling: node.Scaling, PivotPoint: node.PivotPoint }));
          nodeGesture = { id: event.pointerId, x, y, handle, ids, snapshots, frame: Math.round(native.getFrame()), sequence: editSequence, mode: p.transformMode || 'rotate', space: p.transformSpace || 'local', rotateOnOwnAxis: !!p.rotateOnOwnAxis, amount: p.transformMode === 'scale' ? 1 : 0, moved: false };
          posedGeometryCache = null;
          Object.assign(nodeGesture, { restPose: !!p.restPose, workplaneEnabled: !!p.workplaneEnabled, workplane: p.workplane, pivotPoints: structuredClone(ownedModel.PivotPoints), origin: active.world.clone() });
          if (workplaneDrag && p.transformMode === 'move') {
            const axes = p.workplane === 'yz' ? [1,2] : ['xz','zx'].includes(p.workplane) ? [0,2] : [0,1];
            const origin = active.world.clone().project(camera);
            nodeGesture.basis = axes.map(axis => { const end = active.world.clone().add(new THREE.Vector3().setComponent(axis,1)).project(camera); return [(end.x-origin.x)*rect.width/2, (origin.y-end.y)*rect.height/2]; });
            nodeGesture.space = 'world';
          }
          if (p.transformMode === 'move' || p.transformMode === 'scale') nodeGesture.space = 'world';
          if (workplaneDrag && p.transformMode === 'rotate') nodeGesture.space = 'world';
          nodeGesture.workplaneDrag = workplaneDrag; nodeGesture.freeScaleDrag = freeScaleDrag;nodeGesture.screenMove=screenMove;
          controls.enabled = false; canvas.style.cursor = viewportCursor('work', nodeGesture.mode); p.onPlayingChange?.(false); canvas.setPointerCapture(event.pointerId);
          event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (picked && p.onSelectNodes) {
          const ids = p.selectedNodeIds || [], id = picked.node.ObjectId;
          p.onSelectNodes(movementNodeSelection(ids, id, { multiple: p.multiple, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey }));
          event.preventDefault(); event.stopImmediatePropagation(); return;
        }
      }
      if (event.button === 0 && work && !portraitCameraDrag && !p.previewSelectionMode && (p.onSelectionChange || p.onSelectNodes || p.onInspectGeoset)) {
        const rect = canvas.getBoundingClientRect();
        selectionGesture = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey };
        controls.enabled = false; canvas.setPointerCapture(event.pointerId);
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (event.button === 0 && p.previewSelectionMode && p.onSelectionChange && previewSelectHeld) {
        const rect = canvas.getBoundingClientRect();
        selectionGesture = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top,
          shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, uv: true };
        controls.enabled = false;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (event.button === 0) leftGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, alt: event.altKey,
        position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls.target.clone(), zoom: camera.zoom, adjusted: false };
      const binding = cameraBindings(p.preferences), mouseAction = value => value === 'pan' ? THREE.MOUSE.PAN : value === 'rotate' ? THREE.MOUSE.ROTATE : value === 'zoom' ? THREE.MOUSE.DOLLY : null;
      controls.mouseButtons.RIGHT = preserveShiftCameraAction(mouseAction(binding.right), event); controls.mouseButtons.MIDDLE = preserveShiftCameraAction(mouseAction(binding.middle), event);
      const action = event.altKey || portraitCameraDrag ? 'rotate' : p.cameraMode ?? 'rotate';
      const buttonAction=event.button===0?(action==='move'?'pan':action):event.button===1?binding.middle:binding.right;
      rotating = p.showcase ? controls.enabled && controls.enableRotate && ((event.ctrlKey||event.metaKey)?buttonAction==='pan':buttonAction==='rotate')
        : event.button === 0 ? action === 'rotate' : event.button === 1 ? binding.middle === 'rotate' : binding.right === 'rotate';
      p.onCameraGestureChange?.(rotating); canvas.style.cursor = cursorFor(p);
      controls.mouseButtons.LEFT = preserveShiftCameraAction(mouseAction(action === 'move' ? 'pan' : action), event);
      controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(p.preferences?.pointerSensitivity) * (event.shiftKey && !p.showcase ? p.preferences?.fineSensitivity ?? .2 : 1);
    };
    function restoreGestureTracks(gesture) {
      if (gesture.restPose) ownedModel.PivotPoints = structuredClone(gesture.pivotPoints);
      for (const node of allNodes(ownedModel)) {
        const original = gesture.snapshots.get(node.ObjectId); if (!original) continue;
        for (const property of ['Translation', 'Rotation', 'Scaling', 'PivotPoint']) {
          if (original[property] === undefined) delete node[property]; else node[property] = structuredClone(original[property]);
        }
      }
    }
    const nodePointerMove = event => {
      const p = latest.current;
      rememberShowcasePointer(event);
      if(p.showcase&&rotating&&!event.buttons)endShowcaseCursor();
      if (p.attachSourceIds?.length) {
        const rect = canvas.getBoundingClientRect();
        attachPointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        canvas.style.cursor = 'crosshair'; invalidate(); return;
      }
      if (selectionGesture?.id === event.pointerId) {
        const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        if (Math.hypot(x - selectionGesture.x, y - selectionGesture.y) > 5) setSelectionBox({ left: Math.min(x, selectionGesture.x), top: Math.min(y, selectionGesture.y), width: Math.abs(x - selectionGesture.x), height: Math.abs(y - selectionGesture.y) });
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (!nodeGesture) {
        const pickable = nodePoints;
        if (!pickable.length || rotating || (p.cameraMode ?? 'work') !== 'work') { canvas.style.cursor = cursorFor(p); return; }
        const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        const overHandle = pickMovementHandle(nodeHandles, x, y, p.transformMode);
        canvas.style.cursor = overHandle || p.workplaneEnabled && ['move', 'rotate', 'scale'].includes(p.transformMode) || p.transformMode === 'scale' && p.selectedNodeIds?.length ? viewportCursor('work', p.transformMode) : pickMovementNode(pickable, x, y) ? 'pointer' : viewportCursor(p.cameraMode, p.transformMode);
        return;
      }
      if (event.pointerId !== nodeGesture.id) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (nodeGesture.adjusted) return;
      if (movementRestricted(nodeGesture.mode, p.restrictions)) { restoreGestureTracks(nodeGesture); nodeGesture.adjusted = true; invalidate(); return; }
      const rect = canvas.getBoundingClientRect(), dx = event.clientX - rect.left - nodeGesture.x, dy = event.clientY - rect.top - nodeGesture.y;
      if (Math.hypot(dx, dy) < 2 && !nodeGesture.moved) return;
      const [dragX, dragY] = nodeGesture.workplaneDrag ? movementWorkplanePointer(nodeGesture.workplane, dx, dy) : [dx, dy];
      nodeGesture.moved = true;
      if (nodeGesture.freeScaleDrag) {
        nodeGesture.values = movementFreeScaleValues(dx, dy, { sensitivity: pointerSensitivityValue(p.preferences?.pointerSensitivity), workplaneEnabled: nodeGesture.workplaneEnabled, workplane: nodeGesture.workplane, shiftKey: event.shiftKey });
        nodeGesture.amount = Math.max(...nodeGesture.values); nodeGesture.scaleConstrained = nodeGesture.workplaneEnabled && event.shiftKey;
      } else nodeGesture.amount = nodeGesture.basis ? 0 : movementDragAmount(nodeGesture.handle, dragX, dragY, nodeGesture.mode, pointerSensitivityValue(p.preferences?.pointerSensitivity));
      if (nodeGesture.basis) nodeGesture.values = projectedPlaneTranslation(nodeGesture.workplane, nodeGesture.basis, dragX * pointerSensitivityValue(p.preferences?.pointerSensitivity), dragY * pointerSensitivityValue(p.preferences?.pointerSensitivity), event.shiftKey);
      if(nodeGesture.screenMove)nodeGesture.values=screenPlaneTranslation(camera,nodeGesture.origin,rect.width,rect.height,dx*pointerSensitivityValue(p.preferences?.pointerSensitivity),dy*pointerSensitivityValue(p.preferences?.pointerSensitivity),event.shiftKey).toArray();
      if (event.shiftKey && !nodeGesture.freeScaleDrag) nodeGesture.amount = nodeGesture.mode === 'rotate' ? Math.round(nodeGesture.amount / 5) * 5 : nodeGesture.mode === 'move' ? Math.round(nodeGesture.amount) : Math.round(nodeGesture.amount * 20) / 20 || .05;
      restoreGestureTracks(nodeGesture);
      try {
        const transform = p.controlModel && ['move', 'rotate'].includes(nodeGesture.mode) ? applyPortraitModelTransform : applyMovementTransform;
        transform(ownedModel, nodeGesture.ids, nodeGesture.frame, nodeGesture.sequence, { mode: nodeGesture.mode, space: nodeGesture.space, rotateOnOwnAxis: nodeGesture.rotateOnOwnAxis, axis: nodeGesture.handle.axis, amount: nodeGesture.amount, values: nodeGesture.values, restPose: nodeGesture.restPose, workplaneEnabled: nodeGesture.mode === 'scale' ? nodeGesture.scaleConstrained : nodeGesture.workplaneEnabled, workplane: nodeGesture.workplane, restrictions: p.restrictions });
        if (!nodeGesture.restPose) p.onNodePosePreview?.(motionPose(ownedModel, nodeGesture.ids.at(-1), ({ move: 'Translation', rotate: 'Rotation', scale: 'Scaling' })[nodeGesture.mode], nodeGesture.frame, nodeGesture.sequence));
        const axisLabel = nodeGesture.freeScaleDrag && nodeGesture.scaleConstrained ? String(nodeGesture.workplane).toUpperCase().replace('XZ', 'ZX') : nodeGesture.handle.axis;
        setGestureLabel(`${nodeGesture.mode[0].toUpperCase() + nodeGesture.mode.slice(1)} ${axisLabel}: ${nodeGesture.amount.toFixed(2)}${nodeGesture.mode === 'rotate' ? '°' : nodeGesture.mode === 'scale' ? '×' : ''}`);
      } catch (cause) { restoreGestureTracks(nodeGesture); setGestureLabel(cause.message); }
      canvas.style.cursor = viewportCursor('work', nodeGesture.mode); invalidate();
    };
    const finishNodeGesture = event => {
      rotating = false; latest.current.onCameraGestureChange?.(false); canvas.style.cursor = cursorFor(latest.current);
      if (selectionGesture?.id === event.pointerId) {
        const start = selectionGesture; selectionGesture = null; setSelectionBox(null); controls.enabled = true;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.type === 'pointercancel') return;
        const p = latest.current, rect = canvas.getBoundingClientRect(), end = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        if (start.uv && (!previewSelectHeld || end.x < 0 || end.y < 0 || end.x > rect.width || end.y > rect.height)) return;
        const geometry = projectPreviewGeosets(posedGeosets, camera, rect.width, rect.height);
        if (start.uv) {
          const point = Math.hypot(end.x - start.x, end.y - start.y) <= 5 ? { x: start.x, y: start.y } : end;
          p.onSelectionChange?.(selectPreviewUVCoordinates(geometry, p.selectionByGeoset || {}, start, point,
            p.previewEligibleByGeoset, p.previewSelectionMode === 'vertices', rect.width, rect.height));
        } else if (start.ctrl && p.onInspectGeoset && Math.hypot(end.x - start.x, end.y - start.y) <= 5) {
          const hit = pickPreviewGeoset(geometry, end.x, end.y); if (hit) p.onInspectGeoset(hit.index);
        } else {
          p.onSelectionChange?.(selectPreviewVertices(geometry, p.selectionByGeoset || {}, start, end, p.selectableGeosets, {
            visibleOnly: p.restPose && p.mode === 'textured' && p.grabThrough === false,
            width: rect.width,
            height: rect.height,
          }));
        }
        invalidate(); return;
      }
      if (!nodeGesture || event.pointerId !== nodeGesture.id) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const gesture = nodeGesture; nodeGesture = null; controls.enabled = true; canvas.style.cursor = cursorFor(latest.current); setGestureLabel('');
      posedGeometryCache = null;
      latest.current.onNodePosePreview?.(null);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (event.type === 'pointercancel' || !gesture.moved || gesture.adjusted || movementRestricted(gesture.mode, latest.current.restrictions)) restoreGestureTracks(gesture);
      else {
        try { const result = latest.current.onNodeTransform?.({ mode: gesture.mode, space: gesture.space, rotateOnOwnAxis: gesture.rotateOnOwnAxis, axis: gesture.handle.axis, amount: gesture.amount, values: gesture.values, restPose: gesture.restPose, workplaneEnabled: gesture.mode === 'scale' ? gesture.scaleConstrained : gesture.workplaneEnabled, workplane: gesture.workplane, restrictions: latest.current.restrictions, time: gesture.frame, sequenceIndex: gesture.sequence, nodeIds: gesture.ids }); if (result === false) restoreGestureTracks(gesture); }
        catch (cause) { restoreGestureTracks(gesture); setError(cause.message); }
      }
      invalidate();
    };
    const cancelNodeGesture = event => {
      if (event.key === 'Escape' && latest.current.attachSourceIds?.length) {
        latest.current.onCancelAttach?.(); event.preventDefault(); event.stopImmediatePropagation(); invalidate(); return;
      }
      if (event.key === 'Escape' && selectionGesture) finishNodeGesture({ pointerId: selectionGesture.id, type: 'pointercancel', preventDefault: () => event.preventDefault(), stopImmediatePropagation: () => event.stopImmediatePropagation() });
      if (event.key === 'Escape' && nodeGesture) { finishNodeGesture({ pointerId: nodeGesture.id, type: 'pointercancel', preventDefault: () => event.preventDefault(), stopImmediatePropagation: () => event.stopImmediatePropagation() }); }
    };
    const pickParticle=event=>{const p=latest.current;if(event.button!==0)return;if(p.onParticleSurfacePlace){const rect=canvas.getBoundingClientRect(),point=particleSurfaceAnchor(native,displayCamera||camera,rect.width,rect.height,event.clientX-rect.left,event.clientY-rect.top,p.particleAnchorId);if(point){event.preventDefault();event.stopImmediatePropagation();p.onParticleSurfacePlace(point);}return;}if(!p.onParticlePick)return;const rect=canvas.getBoundingClientRect(),hits=pickPreviewParticles(native,displayCamera||camera,rect.width,rect.height,event.clientX-rect.left,event.clientY-rect.top,p.particleSelectedId,p.hiddenGeosets);if(hits.length){event.preventDefault();event.stopImmediatePropagation();const current=hits.findIndex(h=>h.owner===p.particleSelectedId);p.onParticlePick(hits[(current+1)%hits.length].owner,hits.map(h=>h.owner));}};
    canvas.addEventListener('dblclick',pickParticle,true);
    canvas.addEventListener('pointermove', nodePointerMove, true); canvas.addEventListener('pointerup', finishNodeGesture, true); canvas.addEventListener('pointercancel', finishNodeGesture, true); canvas.addEventListener('keydown', cancelNodeGesture, true);
    canvas.addEventListener('lostpointercapture', endShowcaseCursor);
    canvas.addEventListener('pointerdown', pointerDown, true); canvas.addEventListener('pointermove', suppressAdjustedMove, true); canvas.addEventListener('pointerup', finishLeftGesture, true); canvas.addEventListener('pointercancel', finishLeftGesture, true);
    const previewKeyDown = event => {
      if(event.key==='Shift')controls.shiftScreenDrag(event.shiftKey);
      if (event.key?.toLowerCase() === 'a' && !event.ctrlKey && !event.metaKey && !event.altKey &&
          !event.target?.closest?.('input, textarea, select, [contenteditable="true"]') &&
          (!latest.current.previewSelectionMode || canvas.closest('.uv-workspace-body')?.dataset.pointerRegion === 'preview')) previewSelectHeld = true;
    };
    const previewKeyUp = event => {
      if(event.key==='Shift')controls.shiftScreenDrag(event.shiftKey);
      if (event.key?.toLowerCase() !== 'a') return;
      previewSelectHeld = false;
      if (selectionGesture?.uv) finishNodeGesture({ pointerId: selectionGesture.id, type: 'pointercancel', preventDefault() {}, stopImmediatePropagation() {} });
    };
    const previewWindowBlur = () => { previewSelectHeld = false; controls.screenDrag=null; endShowcaseCursor(); };
    ownerWindow.addEventListener('keydown', previewKeyDown, true);
    ownerWindow.addEventListener('keyup', previewKeyUp, true);
    ownerWindow.addEventListener('blur', previewWindowBlur);
    let viewHoveredGeoset = null;
    const hoverGeoset = event => {
      const p = latest.current;
      const rect = canvas.getBoundingClientRect();
      const hit = p.highlightSelection && !nodeGesture && !selectionGesture && p.onHoverGeoset
        ? pickPreviewGeoset(projectPreviewGeosets(posedGeosets, camera, rect.width, rect.height), event.clientX - rect.left, event.clientY - rect.top)
        : null;
      const next = hit?.index ?? null;
      if (viewHoveredGeoset !== next) { viewHoveredGeoset = next; p.onHoverGeoset?.(next); }
    };
    const leaveGeoset = () => { if (viewHoveredGeoset !== null) { viewHoveredGeoset = null; latest.current.onHoverGeoset?.(null); } };
    canvas.addEventListener('pointermove', hoverGeoset); canvas.addEventListener('pointerleave', leaveGeoset);
    const bounds = new THREE.Box3(), point = new THREE.Vector3();
    for (const [index, geo] of ownedModel.Geosets.entries()) if (!props.isolatedGeosets || props.isolatedGeosets.includes(index)) for (let i = 0; i < geo.Vertices.length; i += 3) bounds.expandByPoint(point.fromArray(geo.Vertices, i));
    if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 100));
    const center = bounds.getCenter(new THREE.Vector3()), boundsSize = bounds.getSize(new THREE.Vector3());
    let radius = Math.max(1, boundsSize.length() / 2);
    const fitRadius = () => {
      const p = latest.current, gridVisible = p.overlays?.grid ?? !!p.showGrid;
      if (p.previewSelectionMode || p.particleAuthoring) return radius;
      return gridVisible ? Math.max(radius, gridFrameRadius(center, gridOptions(p.preferences).extent)) : radius;
    };
    function drawBackground() {
      if (backgroundCanvas.width !== canvas.width) backgroundCanvas.width = canvas.width;
      if (backgroundCanvas.height !== canvas.height) backgroundCanvas.height = canvas.height;
      const current = latest.current, appearance = viewportAppearanceOptions(current.preferences).background;
      drawPreviewBackground(backgroundCanvas.getContext('2d'), canvas.width, canvas.height, current.portraitMode ? null : backgroundState.current.image, current.portraitMode ? '#000000' : appearance.color, current.portraitMode ? { type: 'color', color: '#000000', display: 'fill', opacity: 1 } : current.backgroundUrl ? { display: 'fill', opacity: 1 } : appearance);
      nativeBackground.update(backgroundCanvas);
      if(cursorSampler){
        cursorPixels=null;
        if(!current.portraitMode&&backgroundState.current.image){
          cursorSampler.width=24;cursorSampler.height=Math.max(1,Math.min(64,Math.round(24*canvas.height/canvas.width)));
          drawPreviewBackground(cursorContext,cursorSampler.width,cursorSampler.height,backgroundState.current.image,appearance.color,current.backgroundUrl?{display:'fill',opacity:1}:appearance);
          cursorPixels=cursorContext.getImageData(0,0,cursorSampler.width,cursorSampler.height).data;
        }
        canvas.style.cursor=cursorFor(current);
        if(root.current)root.current.style.cursor=showcaseCursor(false,colorLuminance(appearance.color)<.36);
      }
    }
    function resize() {
      const rect=latest.current.pixelAligned?host.current?.getBoundingClientRect():null;
      const width = Math.max(1, rect?.width || host.current?.clientWidth || 1), height = Math.max(1, rect?.height || host.current?.clientHeight || 1), pixelRatio = latest.current.showcase ? graphicsOptions(latest.current.preferences).pixelRatio : viewportPixelRatio(graphicsOptions(latest.current.preferences), ownerWindow.devicePixelRatio);
      canvas.height = Math.round(height * pixelRatio); canvas.width = portraitHasFrame(latest.current) ? Math.round(canvas.height * PORTRAIT_ASPECT) : Math.round(width * pixelRatio); gl.viewport(0, 0, canvas.width, canvas.height);
      perspective.aspect = portraitHasFrame(latest.current) ? PORTRAIT_ASPECT : width / height; perspective.updateProjectionMatrix();
      const aspect = portraitHasFrame(latest.current) ? PORTRAIT_ASPECT : width / height;
      const half = orthographicHalfHeight(radius, aspect);
      ortho.left = -half * aspect; ortho.right = -ortho.left; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix();
      drawBackground(); reportProjectionView();
      scheduler?.resize();
    }
    function setView(next) {
      state.appliedView = next;
      const previous = camera;
      camera = next === 'perspective' ? perspective : ortho;
      if (next === 'orthographic') { camera.position.copy(previous.position); camera.quaternion.copy(previous.quaternion); camera.up.copy(previous.up); }
      else if (next !== 'perspective') {
        applyViewPreset(camera, next, controls.target, fitRadius() * 4);
      }
      controls.object = camera; controls.enableRotate = true;
      if (state.portraitActive) { controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; }
      controls.update();
      if (state.portraitActive) controls.minPolarAngle = controls.maxPolarAngle = controls.getPolarAngle();
      reportProjectionView(); invalidate();
      if (state.portraitActive) { state.cameraDetached = true; latest.current.onPlayingChange?.(false); }
    }
    const viewCamera = event => { if (latest.current.suspended)return;if (applyModelCamera(perspective, controls, event.detail)) { camera = perspective; state.appliedView = 'perspective'; invalidate(); } };
    window.addEventListener('mdlxl-view-camera', viewCamera);
    function fit({ initialize = false } = {}) {
      if (state.portraitActive || (latest.current.suspended && !initialize)) return;
      const width = Math.max(1, host.current?.clientWidth || 1), height = Math.max(1, host.current?.clientHeight || 1);
      const effect=latest.current.particleAuthoring&&!initialize?particlePreviewBounds(native,{selectedId:latest.current.particleSelectedId,sweepRange:latest.current.particleSweepRange,camera,hiddenGeosets:latest.current.hiddenGeosets}):null,fitCenter=effect?new THREE.Vector3(...effect.center):center;
      perspective.position.copy(fitCenter).add(new THREE.Vector3(1, -1.5, .9).normalize().multiplyScalar(perspectiveFitDistance(effect?.radius||fitRadius(), perspective.fov, width / height)));
      controls.target.copy(fitCenter); perspective.zoom = ortho.zoom = 1; resize(); setView(latest.current.view || 'perspective');
    }
    function centerShowcaseModel(crop, fullOrbit = false, horizontal = 1, vertical = 1) {
      const p=latest.current;if(!p.showcase)return;
      const x=crop?crop.x+crop.width/2:.5,y=crop?crop.y+crop.height/2:.5;
      if(p.portraitMode){
        // Reframe the authored portrait projection; its animated camera stays owned by the model.
        portraitFraming.set(x-.5,y-.5);invalidate();return;
      }
      // The unit is anchored to its own Z rotation axis, not the outline of
      // its weapon, glow, particles, or current animation pose. Use the fixed
      // model mid-height so centering also remains stable through an orbit.
      const anchor=new THREE.Vector3(0,0,center.z).add(turntableOffset);
      const matrices=new Map((native.rendererData?.nodes||[]).flatMap((node,index)=>node?.matrix?[[index,new THREE.Matrix4().fromArray(node.matrix)]]:[]));
      const points=[],hidden=new Set(p.hiddenGeosets||[]);
      for(let index=0;index<ownedModel.Geosets.length;index++){
        const geoset=ownedModel.Geosets[index],layers=ownedModel.Materials[geoset.MaterialID]?.Layers||[];
        if(hidden.has(index)||!layers.some(layer=>previewGeosetTint(ownedModel,index,layer,native.getFrame(),native.getSequence(),globalClock)[3]>.001))continue;
        const vertices=skinGeoset(geoset,matrices);
        for(const id of new Set(geoset.Faces))points.push(new THREE.Vector3().fromArray(vertices,id*3));
      }
      // Include the currently drawn particle/ribbon geometry, not buffer capacity
      // or future emissions. The animation pose and clocks remain untouched.
      for(const emitter of native.particlesController?.emitters||[]){
        for(const vertices of [emitter.headVertices,emitter.tailVertices])if(vertices)
          for(let i=0;i<emitter.particles.length*12;i+=3)points.push(new THREE.Vector3().fromArray(vertices,i));
      }
      for(const emitter of native.ribbonsController?.emitters||[]){
        if(emitter.vertices)for(let i=0;i<emitter.creationTimes.length*6;i+=3)points.push(new THREE.Vector3().fromArray(emitter.vertices,i));
      }
      if(points.length){
        const framing=showcaseFraming(camera,points,anchor,{crop,width:canvas.width,height:canvas.height,angle:showcaseSample?.angle||0,radius:showcaseOrbitRadius(center,boundsSize,p.showcaseRadius),fullOrbit});
        zoomEditorCamera(camera,framing.zoom);
        camera.position.addScaledVector(framing.back,framing.retreat);controls.target.addScaledVector(framing.back,framing.retreat);
      }
      camera.updateMatrixWorld();camera.updateProjectionMatrix();
      const projected=anchor.clone().project(camera);
      const dx=(x-(projected.x+1)/2)*canvas.width,dy=(y-(1-projected.y)/2)*canvas.height;
      const translation=screenPlaneTranslation(camera,anchor,canvas.width,canvas.height,dx,dy);
      if(points.length&&(horizontal!==1||vertical!==1)){
        const frame=crop||{x:0,y:0,width:1,height:1},angle=showcaseSample?.angle||0,r=showcaseOrbitRadius(center,boundsSize,p.showcaseRadius),c=Math.cos(angle),s=Math.sin(angle);
        const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
        const edgeX=horizontal===0?frame.x+1/canvas.width:frame.x+frame.width-1/canvas.width;
        const edgeY=vertical===0?frame.y+1/canvas.height:frame.y+frame.height-1/canvas.height;
        let shiftX=horizontal===0?-Infinity:Infinity,shiftY=vertical===0?Infinity:-Infinity;
        // Solve edge placement at each vertex's own depth: close weapons must
        // not skew the unit's center or make perspective alignment overshoot.
        for(const point of points){
          const world=new THREE.Vector3((point.x+r)*c-point.y*s-r,(point.x+r)*s+point.y*c,point.z),q=world.clone().project(camera);
          const movement=screenPlaneTranslation(camera,world,canvas.width,canvas.height,(edgeX-(q.x+1)/2)*canvas.width,(edgeY-(1-q.y)/2)*canvas.height);
          shiftX=horizontal===0?Math.max(shiftX,movement.dot(right)):Math.min(shiftX,movement.dot(right));
          shiftY=vertical===0?Math.min(shiftY,movement.dot(up)):Math.max(shiftY,movement.dot(up));
        }
        if(horizontal!==1)translation.addScaledVector(right,shiftX-translation.dot(right));
        if(vertical!==1)translation.addScaledVector(up,shiftY-translation.dot(up));
      }
      // Pan both ends of the view together, preserving angle and zoom.
      camera.position.sub(translation);controls.target.sub(translation);controls.update();
      cameraChanged();
    }

    function updateUV(nextModel) {
      const priorBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      for (let i = 0; i < ownedModel.Geosets.length; i++) {
        const next = nextModel.Geosets?.[i]?.TVertices, geo = ownedModel.Geosets[i];
        if (!next || next[0]?.length !== geo.TVertices[0]?.length) continue;
        geo.TVertices = next.map(uv => new Float32Array(uv));
        const buffer = native.texCoordBuffer?.[i];
        if (buffer) { gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, geo.TVertices[0]); }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, priorBuffer); invalidate();
    }
    const setCameraPreset = name => {
      camera = ortho; state.appliedView = name; applyViewPreset(camera, name, controls.target, fitRadius() * 4);
      controls.object = camera; controls.enableRotate = true; controls.update(); reportProjectionView(); invalidate();
    };
    function enterPortrait(evaluated) {
      if (!portraitBackup) portraitBackup = { perspective: perspective.clone(), ortho: ortho.clone(), target: controls.target.clone(), camera: camera === ortho ? 'ortho' : 'perspective', appliedView: state.appliedView, minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle };
      state.portraitActive = true; state.cameraDetached = false; state.appliedView = 'perspective'; camera = perspective; controls.object = camera; controls.enableRotate = true;
      controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
      if (evaluated) applyEvaluatedModelCamera(camera, controls, evaluated, PORTRAIT_ASPECT);
      controls.minPolarAngle = controls.maxPolarAngle = controls.getPolarAngle();
      resize(); reportProjectionView(); invalidate();
    }
    function exitPortrait() {
      if (!portraitBackup) { state.portraitActive = false; resize(); return; }
      perspective.copy(portraitBackup.perspective); ortho.copy(portraitBackup.ortho); controls.target.copy(portraitBackup.target);
      camera = portraitBackup.camera === 'ortho' ? ortho : perspective; controls.object = camera; state.appliedView = portraitBackup.appliedView;
      controls.minPolarAngle = portraitBackup.minPolarAngle; controls.maxPolarAngle = portraitBackup.maxPolarAngle;
      portraitBackup = null; state.portraitActive = false; controls.update(); resize(); reportProjectionView(); invalidate();
    }
    const cameraStarted = () => {
      const p = latest.current;
      if (!p.portraitMode || !state.portraitActive) return;
      cameraGestureStart = { position: camera.position.clone(), target: controls.target.clone(), snapshot: editorCameraSnapshot(camera, controls.target) };
      state.cameraEditing = true; state.cameraDetached = true; p.onPlayingChange?.(false);
    };
    const cameraEnded = () => {
      endShowcaseCursor();
      const p = latest.current, started = cameraGestureStart; cameraGestureStart = null;
      if (!started || !p.portraitMode || !state.portraitActive) { state.cameraEditing = false; return; }
      // Keep the navigated projection unchanged. Set Current View converts it
      // back to WC3 camera units exactly once.
      state.cameraEditing = false; reportProjectionView(); invalidate();
    };
    controls.addEventListener('start', cameraStarted); controls.addEventListener('end', cameraEnded);
    const state = { native, controls, particleSourceModel:rendererModel, updateParticles: (source,field,id)=>{if(particleAuthor)particleAuthor.updateSource(source,field,id);else updateParticlePreview(native,source);invalidate();}, setView, setCameraPreset, fit, resize, updateUV, drawBackground, enterPortrait, exitPortrait, portraitActive: false, cameraEditing: false, cameraDetached: false, cameraView: () => editorCameraSnapshot(camera, controls.target, perspective), refreshCursor: () => { canvas.style.cursor = cursorFor(latest.current); }, setCameraAngles: values => { if (state.portraitActive || latest.current.suspended) return; if (setEditorCameraAngles(camera, controls.target, values)) { controls.update(); cameraChanged(); } } }; runtime.current = state;
    observer = new ownerWindow.ResizeObserver(resize); observer.observe(host.current);
    const saved = cameraMemory.current || latest.current.cameraHandoff?.current;
    // UV edits may rebuild geometry/materials, but never own the user's view.
    // Preserve the active projection as well as its orbit, pan and zoom; an
    // angled/standard projection need not equal the outer editor's view prop.
    if (saved && (latest.current.preserveCameraView || latest.current.cameraHandoff?.current === saved)) {
      camera = restorePreviewCamera(saved, perspective, ortho, controls);
      state.appliedView = latest.current.view || saved.view; resize(); reportProjectionView();
    } else {
      fit({ initialize: true });
      if (saved && saved.view === view) { camera = restorePreviewCamera(saved, perspective, ortho, controls); reportProjectionView(); }
    }
    if (latest.current.portraitMode) enterPortrait(evaluateModelCamera(model, model?.Cameras?.[latest.current.portraitCameraIndex], latest.current.time, sequenceIndex, latest.current.time));
    const compareCamera = latest.current.compareCamera;
    if (compareCamera) { if (compareCamera.saved) receiveCamera(compareCamera.saved); else compareCamera.saved = snapshotCamera(); compareCamera.listeners.add(receiveCamera); compareRegistered = true; }
    const checker = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const value = ((x >> 1) + (y >> 1)) % 2 ? 135 : 90; checker.set([value, value, value, 255], (y * 8 + x) * 4); }
    const assets = textureAssets instanceof Map ? textureAssets : new Map(Object.entries(textureAssets || {}));
    const normalized = new Map([...assets].map(([path, asset]) => [pathKey(path), asset]));
    const failures = []; let missing = 0;
    setEventWarnings([]);
    const eventPreview = createEventPreview({ gl, model:particlesEnabled ? ownedModel : { ...ownedModel, EventObjects:[] }, modelPath:props.modelPath, textureAssets, textureFromAsset, invalidate, onWarnings:setEventWarnings });
    if (particlesEnabled && (ownedModel.ParticleEmitters?.length || ownedModel.ParticleEmitterPopcorns?.length)) failures.push('Sprite particles and ribbons are previewed. External model / Popcorn effects are preserved but need a Warcraft effects renderer.');
    let texturesReady = false;
    const jobs = ownedModel.Textures.map(async (info,textureId) => {
      if (!info.Image || info.ReplaceableId === 1 || info.ReplaceableId === 2) return;
      // A deterministic placeholder also prevents absent samplers in HD materials.
      native.setTextureImageData(info.Image, [new ImageData(graphics.textures ? checker.slice() : new Uint8ClampedArray(8 * 8 * 4).fill(255), 8, 8)]);
      if (!graphics.textures) return;
      const normalizedPath = pathKey(info.Image);
      const asset = normalized.get(normalizedPath) || normalized.get(normalizedPath.split('\\').at(-1));
      if (!asset) { missing++; return; }
      let texture;
      try {
        texture = await textureFromAsset(asset, info); if (disposed) return;
        if (texture.isCompressedTexture) {
          const ext = gl.getExtension('WEBGL_compressed_texture_s3tc');
          if (!ext) throw new Error('DDS compression is unavailable on this graphics device');
          const formats = new Map([[THREE.RGB_S3TC_DXT1_Format, ext.COMPRESSED_RGB_S3TC_DXT1_EXT], [THREE.RGBA_S3TC_DXT1_Format, ext.COMPRESSED_RGBA_S3TC_DXT1_EXT], [THREE.RGBA_S3TC_DXT3_Format, ext.COMPRESSED_RGBA_S3TC_DXT3_EXT], [THREE.RGBA_S3TC_DXT5_Format, ext.COMPRESSED_RGBA_S3TC_DXT5_EXT]]);
          const format = formats.get(texture.format); if (!format) throw new Error('This DDS compression format is unsupported');
          // Use the top mip: the upstream API then sets a complete texture.
          const mip = texture.mipmaps[0], bytes = new Uint8Array(mip.data);
          native.setTextureCompressedImage(info.Image, format, bytes.buffer, { images: [{ offset: 0, length: bytes.length, shape: { width: mip.width, height: mip.height } }] });
        } else if (texture.image?.data) {
          const image = texture.image; native.setTextureImageData(info.Image, [new ImageData(new Uint8ClampedArray(image.data), image.width, image.height)]);
        } else native.setTextureImage(info.Image, texture.image);
        if(latest.current.particleAuthoring||latest.current.onParticlePick)rememberParticlePicture(native,textureId,texture,info.Flags,texture.isCompressedTexture?decodeDds(asset.bytes):undefined);
        if (!texture.isCompressedTexture) improveNativeTexture(gl, native, info.Image, graphics);
      } catch (cause) { failures.push(`${info.Image}: ${cause.message}`); }
      finally { texture?.dispose(); if (!disposed) invalidate(); }
    });
    const texturePromise = Promise.all(jobs).then(() => { texturesReady = true; if (!disposed) setWarnings([...(missing ? [`${missing} textures unresolved · load the model's texture files`] : []), ...failures]); });
    let reportAt = performance.now(), activeSequence = -99, externalFrame, reportedFrame, lastPlaying = false, globalClock = 0, playbackStopped = false;
    let showcaseSample, recordingSink = null;
    const color = new THREE.Color(), cameraQuaternion = new THREE.Quaternion();
    function setPreviewFrame(frame) {
      native.setFrame(frame);
      if (activeSequence === timelineSequenceIndex && timelineSequenceIndex >= 0) {
        // Upstream setFrame selects the first saved sequence containing a time.
        // Keep the private reel active even when it overlaps a saved sequence.
        native.rendererData.animation = timelineSequenceIndex;
        native.rendererData.animationInfo = ownedModel.Sequences[timelineSequenceIndex];
        native.rendererData.frame = frame;
      }
    }
    function useAuthoredSequenceInterval(frame) {
      if (activeSequence !== timelineSequenceIndex || timelineSequenceIndex < 0) return activeSequence;
      if (globalPreviewId !== null) return timelineSequenceIndex;
      const authored = localSequenceAtFrame(ownedModel, frame, timelineSequenceIndex);
      const index = authored >= 0 ? authored : timelineSequenceIndex;
      native.rendererData.animation = index;
      native.rendererData.animationInfo = ownedModel.Sequences[index];
      native.rendererData.frame = frame;
      return index;
    }
    function render(now, delta, { captureOnly = false } = {}) {
      if (disposed) return;
      const p = latest.current;
      const sharedGlobals = !p.showcase && p.syncPlayback && Number.isFinite(p.playbackGlobalTime);
      let showcaseNext;
      if (p.showcase) {
        showcaseNext = p.showcase.sample(captureOnly ? 0 : delta);
        p.sequenceIndex = showcaseNext.sequenceIndex; p.time = showcaseNext.frame;
      }
      const selected = p.restPose ? 0 : p.sequenceIndex < 0 && timelineSequenceIndex >= 0 ? timelineSequenceIndex : Math.max(0, Math.min(ownedModel.Sequences.length - 1, p.sequenceIndex ?? 0));
      const sequence = ownedModel.Sequences[selected];
      // Restrict playback only. Keep the authored sequence interval for evaluation,
      // so the focus edges never change interpolation partners or model data.
      const range = p.playbackRange;
      const focus = !p.restPose && p.sequenceIndex >= 0 && range?.[1] > sequence.Interval[0] && range?.[0] < sequence.Interval[1] ? range : null;
      const start = focus ? Math.max(sequence.Interval[0], focus[0]) : sequence.Interval[0];
      const end = focus ? Math.min(sequence.Interval[1], focus[1]) : sequence.Interval[1];
      const sequenceChanged = activeSequence !== selected;
      if (sequenceChanged && !p.showcase) { native.setSequence(selected); activeSequence = selected; }
      // A previous All-line frame is left configured with its authored local
      // interval for rendering. Restore the private reel before advancing so
      // playback can cross sequence gaps without looping at a local endpoint.
      if (selected === timelineSequenceIndex && timelineSequenceIndex >= 0) {
        native.rendererData.animation = timelineSequenceIndex;
        native.rendererData.animationInfo = sequence;
      }
      const userSeek = !p.showcase && (p.syncPlayback ? p.seekId !== externalSeek || (!sharedGlobals && p.time < externalFrame) : p.time !== externalFrame && Math.abs((p.time || 0) - (reportedFrame ?? -Infinity)) > 1);
      externalSeek = p.seekId;
      if (sequenceChanged || userSeek || p.playing && !lastPlaying) playbackStopped = false;
      if (!p.showcase && (sequenceChanged || userSeek)) resetPreviewEffects(native);
      const requestedSeek = p.syncPlayback ? sequenceChanged || userSeek || (!sharedGlobals && !p.playbackRunning) : sequenceChanged || userSeek || !p.playing || !lastPlaying;
      if (!p.showcase && (nodeGesture || requestedSeek)) {
        const frame = p.restPose ? start : nodeGesture?.frame ?? Math.min(end, Math.max(start, p.time ?? start));
        setPreviewFrame(frame); globalClock = sharedGlobals ? p.playbackGlobalTime : frame;
        // The pinned upstream renderer exposes no public global-sequence seek.
        // Synchronize its existing clock array so timeline scrubbing and the
        // editable skeleton agree on the same global pose.
        const clocks = native.rendererData?.globalSequencesFrames;
        if (clocks) for (let i = 0; i < (ownedModel.GlobalSequences?.length || 0); i++) {
          const duration = ownedModel.GlobalSequences[i]; if (duration > 0) clocks[i] = ((globalClock % duration) + duration) % duration;
        }
      }
      externalFrame = p.time; lastPlaying = p.playing;
      let playback = p.syncPlayback ? { frame: Math.min(end, Math.max(start, p.time ?? start)), elapsed: requestedSeek ? 0 : sharedGlobals ? Math.max(0,p.playbackGlobalTime-globalClock) : Math.max(0, Math.min(end,p.time)-native.getFrame()), finished: false } : previewPlaybackStep([start, end], native.getFrame(), p.playing && !p.restPose && !nodeGesture && !playbackStopped && !captureOnly ? scalePlaybackDelta(delta, p.playbackSpeed) : 0, p.loop !== false);
      const dt = p.showcase ? 0 : playback.elapsed;
      globalClock = sharedGlobals ? p.playbackGlobalTime : globalClock + dt;
      const updateNative = (step, globalFrame = globalClock) => {
        // OptimizeXL supplies one continuous clock for both views. Seed the
        // clock before update, which advances it before evaluating nodes and
        // effects. Preserve the wrap remainder the upstream increment drops.
        if (sharedGlobals) for (let i = 0; i < (ownedModel.GlobalSequences?.length || 0); i++) {
          const duration = ownedModel.GlobalSequences[i];
          if (duration > 0) native.rendererData.globalSequencesFrames[i] = ((globalFrame % duration) + duration) % duration - step;
        }
        if(latest.current.particleAuthoring)withParticleRandom(particleRandom,()=>native.update(step));else native.update(step);
      };
      controls.update();
      displayCamera = camera;
      if (p.showcase && !p.portraitMode) {
        // The model origin is the rotation axis. Radius adds an explicit path;
        // the navigated camera and its projection remain exactly as placed.
        displayCamera = setShowcaseOrbitCamera(camera, turntableCamera, showcaseNext.angle,
          showcaseOrbitRadius(center, boundsSize, p.showcaseRadius), turntableRotation, turntableOffset);
      }
      let poseSequence = selected;
      try {
        // Narrow particle/ribbon visibility windows must survive a slow frame.
        // Substep effects during long frames rather than jumping over their keys.
        if (p.showcase) {
          showcaseSample = advanceShowcaseModel(native, ownedModel, showcaseNext, showcaseSample);
          activeSequence = selected; globalClock = showcaseSample.globalTime;
        } else if(particleAuthor) {
          const quaternion=displayCamera.quaternion.clone().multiply(billboardCameraCorrection);
          const status=particleAuthor.advance({sequence:selected,frame:p.time??start,seek:sequenceChanged||userSeek,elapsed:captureOnly?0:delta,playing:p.playing&&!captureOnly,animationRate:Math.max(0,(p.playbackSpeed??100)/100),fxRate:Math.max(0,(p.particleFxSpeed??p.playbackSpeed??100)/100),linked:p.particleLinked!==false,loop:p.loop!==false,range:[start,end],cameraPosition:displayCamera.position.toArray(),cameraQuaternion:quaternion.toArray()});
          globalClock=status.global;playback={frame:status.frame,elapsed:0,finished:false};
          const statusKey=String(status.busy)+':'+(status.error||'');if(statusKey!==particleStatusKey){particleStatusKey=statusKey;p.onParticleStatus?.(status);}
          if(status.ended&&p.playing)p.onPlayingChange?.(false);
          if(status.busy)invalidate();
        } else if (dt > 0) {
          let remaining = dt;
          while (remaining > 1e-7) {
            if (native.getFrame() >= end) setPreviewFrame(start);
            const step = Math.min(particlesEnabled && dt > 33 ? 20 : remaining, remaining, end - native.getFrame());
            if (!(step > 0)) break;
            updateNative(step, globalClock - remaining + step); remaining -= step;
          }
        } else updateNative(0);
        if (!p.showcase && playback.finished) {
          playbackStopped = true; setPreviewFrame(start); globalClock = start; resetPreviewEffects(native);
          const clocks = native.rendererData?.globalSequencesFrames;
          if (clocks) for (let i = 0; i < (ownedModel.GlobalSequences?.length || 0); i++) { const duration = ownedModel.GlobalSequences[i]; if (duration > 0) clocks[i] = start % duration; }
          updateNative(0);
        } else if (!p.showcase && Math.abs(native.getFrame() - playback.frame) > 1e-5) { setPreviewFrame(playback.frame); updateNative(0); }
        poseSequence = useAuthoredSequenceInterval(native.getFrame());
        if (poseSequence !== selected) updateNative(0);
        applyRestPoseMatrices(native.rendererData, p.restPose);
        if (p.isolatedGeosets && (sequenceChanged || userSeek)) {
          const matrices = new Map((native.rendererData.nodes || []).flatMap((node, index) => node?.matrix ? [[index, new THREE.Matrix4().fromArray(node.matrix)]] : []));
          bounds.makeEmpty();
          for (const index of p.isolatedGeosets) {
            const geoset = ownedModel.Geosets[index]; if (!geoset) continue;
            const vertices = skinGeoset(geoset, matrices);
            for (let i = 0; i < vertices.length; i += 3) bounds.expandByPoint(point.fromArray(vertices, i));
          }
          if (!bounds.isEmpty()) { bounds.getCenter(center); bounds.getSize(boundsSize); radius = Math.max(1, boundsSize.length() / 2); fit(); }
        }
        if (p.portraitMode && !state.cameraEditing && !state.cameraDetached) {
          const evaluated = evaluateModelCamera(p.model, p.model?.Cameras?.[p.portraitCameraIndex], native.getFrame(), poseSequence, globalClock);
          if (evaluated) {
            const view = p.showcasePortraitFrame === false ? {...evaluated,fieldOfView:evaluated.fieldOfView / Math.max(.5,Number(p.showcasePortraitZoom || 100)/100)} : evaluated;
            applyEvaluatedModelCamera(camera, controls, view, portraitHasFrame(p) ? PORTRAIT_ASPECT : canvas.width/canvas.height);
            if(p.showcase){
              if(!portraitHasFrame(p)&&(portraitFraming.x||portraitFraming.y))camera.setViewOffset(canvas.width,canvas.height,-portraitFraming.x*canvas.width,-portraitFraming.y*canvas.height,canvas.width,canvas.height);
              else if(camera.view?.enabled)camera.clearViewOffset();
            }
          }
        } else if (!p.portraitMode) {
          const clipRadius = modelClipRadius(ownedModel, center, radius);
          updateDepthClipping(camera, center, clipRadius, gridDepthExtent(center, gridOptions(p.preferences).extent));
        }
        camera.updateMatrixWorld(); camera.updateProjectionMatrix();
        // Depth changes belong to the real projection, never to orbit framing.
        if (p.showcase) {
          displayCamera.projectionMatrix.copy(camera.projectionMatrix);
          displayCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
        }
        cameraQuaternion.copy(displayCamera.quaternion).multiply(billboardCameraCorrection);
        native.setCamera(displayCamera.position.toArray(), cameraQuaternion.toArray());
        native.setTeamColor(nativeTeamColor(p.teamColor || '#ed3333'));
        native.setLightPosition(p.showcase ? displayLight().normalize().multiplyScalar(radius*10).add(center).toArray() : cameraLeftLight(camera, controls.target, radius).position.toArray());
        const background = new THREE.Color(p.portraitMode ? '#000000' : visualOptions(p.preferences).background).convertLinearToSRGB();
        gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(background.r, background.g, background.b, 1); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (!p.portraitMode || p.showcase) nativeBackground.draw();
        if (!captureOnly) presentation.draw(camera, p.preferences, p.workplane, p.overlays?.grid ?? !!p.showGrid, center, radius, bounds.min.z, { gridOnly: true, showAxes: p.showAxes ?? p.overlays?.axes ?? !!p.showGrid });
        const wireframe = !captureOnly && (p.mode === 'wireframe' || p.mode === 'vertices');
        if (wireframe) gl.colorMask(false, false, false, false);
        try {
          native.render(displayCamera.matrixWorldInverse.elements, displayCamera.projectionMatrix.elements, { wireframe: false, useEnvironmentMap: p.shaded !== false && graphics.lighting });
          if(p.onParticleStage){
            // A paused view may draw only once after a seek, edit or camera change.
            // Publish that pose immediately; playback still uses the normal report rate.
            const reportKey=p.playing?'':[native.getFrame(),p.particleSelectedId,p.particleLiveRevision,particleStatusKey,canvas.width,canvas.height,...displayCamera.matrixWorldInverse.elements,...displayCamera.projectionMatrix.elements].join(':');
            if(now-particleReportAt>60||reportKey!==particleReportKey){particleReportAt=now;particleReportKey=reportKey;p.onParticleStage(particleStageSnapshot(native,displayCamera,canvas.clientWidth,canvas.clientHeight,p.particleSelectedId,false,{sweepRange:p.particleSweepRange,anchorId:p.particleAnchorId}));}
          }
        }
        finally { gl.colorMask(true, true, true, true); }
        if (!wireframe) eventPreview.render({ frame:native.getFrame(), sequenceIndex:poseSequence, globalTime:globalClock, playback:p.showcase?showcaseSample:undefined, camera:displayCamera, teamColor:p.teamColor });
        if (!captureOnly && !p.portraitMode) presentation.draw(camera, p.preferences, p.workplane, false, center, radius, bounds.min.z, { platformOnly: true });
      } catch (cause) { setError(`Warcraft preview error: ${cause.message}`); return false; }
      if (!captureOnly) {
      if (p.showCollisionSpheres) {
        if (!collisionCanvas) { collisionCanvas = ownerDocument.createElement('canvas'); collisionCanvas.dataset.collisionOverlay = ''; collisionCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:30'; host.current.appendChild(collisionCanvas); }
        collisionCanvas.width=canvas.width; collisionCanvas.height=canvas.height;
        drawCollisionSpheres(collisionCanvas.getContext('2d'),ownedModel,camera,native,canvas.width,canvas.height);
      } else if (collisionCanvas) { collisionCanvas.remove(); collisionCanvas=null; }
      const overlayOptions = { ...previewOverlayOptions(p.overlays, p.showNodes), preferences: p.preferences, workplane: p.workplane };
      overlayOptions.selectableGeosets = p.selectableGeosets ?? [];
      overlayOptions.grid = false;
      overlayOptions.normals ||= !!p.showNormals;
      overlayOptions.selectionByGeoset = p.selectionByGeoset;
      if (p.restPose) overlayOptions.boneVertexColors = boneVertexHighlights(ownedModel, p.selectedNodeIds || []);
      overlayOptions.selectedGeoset = p.selectedGeoset;
      overlayOptions.wires ||= p.mode === 'wireframe' || p.mode === 'vertices';
      overlayOptions.showHiddenWires = p.mode === 'wireframe' || p.mode === 'vertices';
      overlayOptions.showHiddenVertices = p.mode === 'wireframe' || p.mode === 'vertices' || viewportAppearanceOptions(p.preferences).xrayVertices || p.mode === 'textured' && p.grabThrough === true;
      overlayOptions.vertices ||= p.mode === 'vertices';
      let poseMatrices;
      const getPoseMatrices = () => poseMatrices ||= new Map((native.rendererData?.nodes || []).flatMap((node, index) => node?.matrix ? [[index, new THREE.Matrix4().fromArray(node.matrix)]] : []));
      const hidden = new Set(p.hiddenGeosets || []);
      const presentationGuides = p.presentation === 'preview' && previewOverlaySettings(p.previewOverlay).mode !== 'none';
      const needsGeometry = presentationGuides || p.onSelectionChange || p.onSelectNodes || p.onInspectGeoset || p.highlightSelection && p.onHoverGeoset || overlayOptions.normals || overlayOptions.wires || overlayOptions.vertices || Object.values(p.selectionByGeoset || {}).some(ids => ids.length || ids.size);
      if (needsGeometry) {
        const cacheable = !p.playing && !nodeGesture && !hasBillboardedNodes;
        const cacheKey = `${native.getFrame()}:${poseSequence}:${globalClock}:${!!p.restPose}:${!!overlayOptions.normals}`;
        if (!cacheable || posedGeometryCache?.key !== cacheKey) {
          const geosets = ownedModel.Geosets.flatMap((geo, index) => sampleGeosetAnimation(ownedModel, index, native.getFrame(), poseSequence, globalClock).alpha > .001 ? [{ index, faces: geo.Faces, vertices: skinGeoset(geo, getPoseMatrices()), normals: overlayOptions.normals && geo.Normals?.length === geo.Vertices.length ? skinGeosetNormals(geo, getPoseMatrices()) : null }] : []);
          posedGeometryCache = cacheable ? { key: cacheKey, geosets } : null;
          posedGeosets = geosets.filter(geo => !hidden.has(geo.index));
        } else posedGeosets = posedGeometryCache.geosets.filter(geo => !hidden.has(geo.index));
      } else posedGeosets = [];
      const hovered = p.hoveredGeoset == null ? null : ownedModel.Geosets[p.hoveredGeoset];
      if (hovered) {
        if (!hoverCanvas) { hoverCanvas=ownerDocument.createElement('canvas'); hoverCanvas.dataset.geosetOverlay=''; hoverCanvas.style.cssText='position:absolute;z-index:10;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(hoverCanvas); }
        if (hoverCanvas.width !== canvas.width) hoverCanvas.width = canvas.width;
        if (hoverCanvas.height !== canvas.height) hoverCanvas.height = canvas.height;
        const matrices=getPoseMatrices();
        drawGeosetHighlight(hoverCanvas.getContext('2d'),hovered.Faces,skinGeoset(hovered,matrices),camera,canvas.width,canvas.height,viewportAppearanceOptions(p.preferences).geosetHighlight);
      } else if (hoverCanvas) { hoverCanvas.remove(); hoverCanvas=null; }
      if (presentationGuides || overlayOptions.normals || overlayOptions.wires || overlayOptions.vertices || Object.values(p.selectionByGeoset || {}).some(ids => ids.length || ids.size)) {
        if (!geometryCanvas) { geometryCanvas = ownerDocument.createElement('canvas'); geometryCanvas.dataset.geometryOverlay = ''; geometryCanvas.style.cssText = 'position:absolute;z-index:20;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(geometryCanvas); }
        if (geometryCanvas.width !== canvas.width) geometryCanvas.width = canvas.width;
        if (geometryCanvas.height !== canvas.height) geometryCanvas.height = canvas.height;
        if (presentationGuides) drawPresentationOverlay(geometryCanvas.getContext('2d'), posedGeosets, camera, canvas.clientWidth, canvas.clientHeight, p.previewOverlay, canvas.width / Math.max(1, canvas.clientWidth));
        else drawPreviewGeometryOverlay(geometryCanvas.getContext('2d'), posedGeosets, camera, canvas.clientWidth, canvas.clientHeight, overlayOptions, center, radius, canvas.width / Math.max(1, canvas.clientWidth));
      } else if (geometryCanvas) { geometryCanvas.remove(); geometryCanvas = null; }
      if (p.overlays?.cameras ?? p.showCameras) {
        if (!cameraCanvas) { cameraCanvas = ownerDocument.createElement('canvas'); cameraCanvas.dataset.cameraOverlay = ''; cameraCanvas.style.cssText = 'position:absolute;z-index:30;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(cameraCanvas); }
        if (cameraCanvas.width !== canvas.width) cameraCanvas.width = canvas.width;
        if (cameraCanvas.height !== canvas.height) cameraCanvas.height = canvas.height;
        drawModelCameraOverlay(cameraCanvas.getContext('2d'), ownedModel, camera, canvas.clientWidth, canvas.clientHeight, canvas.width / Math.max(1, canvas.clientWidth), native.getFrame(), poseSequence, globalClock, radius, visualOptions(p.preferences).node, p.portraitMode ? PORTRAIT_ASPECT : 4 / 3);
      } else if (cameraCanvas) { cameraCanvas.remove(); cameraCanvas = null; }
      const selectedControls = !!p.onNodeTransform && !!p.selectedNodeIds?.length && ['move', 'rotate', 'scale'].includes(p.transformMode);
      if (overlayOptions.bones || overlayOptions.boneLines || overlayOptions.nodes || overlayOptions.attachments || overlayOptions.particles || selectedControls) {
        if (!connectorCanvas) { connectorCanvas = ownerDocument.createElement('canvas'); connectorCanvas.dataset.connectorOverlay = ''; connectorCanvas.style.cssText = 'position:absolute;z-index:15;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(connectorCanvas); }
        if (connectorCanvas.width !== canvas.width) connectorCanvas.width = canvas.width;
        if (connectorCanvas.height !== canvas.height) connectorCanvas.height = canvas.height;
        if (!nodeCanvas) { nodeCanvas = ownerDocument.createElement('canvas'); nodeCanvas.dataset.nodeOverlay = ''; nodeCanvas.style.cssText = 'position:absolute;z-index:40;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(nodeCanvas); }
        if (nodeCanvas.width !== canvas.width) nodeCanvas.width = canvas.width;
        if (nodeCanvas.height !== canvas.height) nodeCanvas.height = canvas.height;
        const width = canvas.clientWidth, height = canvas.clientHeight;
        const projectedNodes = projectMovementNodes(markerModel, native.getFrame(), poseSequence, camera, width, height, globalClock, getPoseMatrices());
        nodePoints = visibleMovementPoints(projectedNodes, overlayOptions);
        const selectedPoint = projectedNodes.find(point => point.node.ObjectId === p.selectedNodeIds?.at(-1));
        if (selectedControls && selectedPoint && !nodePoints.includes(selectedPoint)) nodePoints.push(selectedPoint);
        const active = nodePoints.find(point => point.node.ObjectId === p.selectedNodeIds?.at(-1));
        const handleMode = p.transformMode || 'rotate', workplaneHidesHandles = p.workplaneEnabled && ['move', 'rotate', 'scale'].includes(handleMode);
        let handleAnchor = active;
        if (active && handleMode === 'rotate' && p.rotateOnOwnAxis) {
          const ownCenter = movementBoneVertexCenter(ownedModel, active.node.ObjectId, getPoseMatrices());
          if (ownCenter) {
            const screen = ownCenter.center.clone().project(camera);
            handleAnchor = { ...active, world: ownCenter.center, x: (screen.x + 1) * width / 2, y: (1 - screen.y) * height / 2, visible: screen.z >= -1 && screen.z <= 1 };
          }
        }
        nodeHandles = p.onNodeTransform && (!p.restPose || handleMode === 'move') && !workplaneHidesHandles && !movementRestricted(handleMode, p.restrictions) && ['move', 'rotate', 'scale'].includes(handleMode) && (p.restPose || movementSequence(p, Math.round(native.getFrame())) >= 0) ? movementAxisHandles(handleAnchor, camera, width, height, radius, handleMode === 'rotate' ? p.transformSpace || 'local' : 'world', handleMode) : [];
        const markerOptions = { ...overlayOptions, wireframeMarkers: p.mode === 'wireframe' || p.mode === 'vertices', occludedMarkerEdges: p.mode === 'solid' || p.mode === 'textured' };
        rigMarkers.draw(camera, projectedNodes, p.selectedNodeIds || [], markerOptions);
        drawBoneConnectors(connectorCanvas.getContext('2d'), projectedNodes, p.selectedNodeIds || [], camera, width, height, canvas.width / Math.max(1, width), { ...markerOptions, preferences: p.preferences });
        drawMovementOverlay(nodeCanvas.getContext('2d'), projectedNodes, p.selectedNodeIds || [], nodeHandles, width, height, canvas.width / Math.max(1, width), { ...markerOptions, boneLines: false, glMarkers: true });
        if (p.attachSourceIds?.length) drawAttachGuide(nodeCanvas.getContext('2d'), projectedNodes, p.attachSourceIds, attachPointer, canvas.width / Math.max(1, width), now, visualOptions(p.preferences).helperSize);
      } else { nodePoints = []; nodeHandles = []; if (nodeCanvas) { nodeCanvas.remove(); nodeCanvas = null; } if (connectorCanvas) { connectorCanvas.remove(); connectorCanvas = null; } }
      }
      if (!captureOnly && playback.finished) { reportAt = now; reportedFrame = start; p.onTimeChange?.(start); p.onPlayingChange?.(false); }
      else if (!captureOnly && p.playing && !playbackStopped && now - reportAt > 32) { reportAt = now; reportedFrame = native.getFrame(); p.onTimeChange?.(reportedFrame); }
      layerAPI.current?.draw(showcaseSample?.globalTime || 0, {time:showcaseSample?.presentationTime || 0,enabled:!!p.showcase?.recording || !!p.showcasePlaying});
      if (!captureOnly && recordingSink) recordingSink(showcaseSample?.presentationTime || 0);
    }
    const contextLost = event => { event.preventDefault(); scheduler?.dispose(); setError('The graphics context was lost. Reopen this preview to restore it.'); };
    scheduler = state.scheduler = createRenderScheduler({ render,
      continuous: () => {
        return !!latest.current.showcase?.playing || !!latest.current.attachSourceIds?.length || latest.current.playing && !latest.current.restPose && !playbackStopped;
      },
      // Electron may report an owned about:blank window as hidden during focus
      // transfer. Only the main-document preview uses hidden-tab suspension;
      // a detached preview must always be allowed to paint its first frame.
      paused: () => latest.current.suspended || (ownerDocument === document && ownerDocument.hidden && graphicsOptions(latest.current.preferences).pauseWhenHidden),
      maxFps: () => graphicsOptions(latest.current.preferences).maxFps,
      request: requestPreviewFrame,
      cancel: cancelPreviewFrame,
    });
    state.captureApi = {
      get isReady() { return !disposed && texturesReady && (!particleAuthor || particleAuthor.simulation && !particleAuthor.status.busy) && eventPreview.isReady && backgroundState.current.status === 'ready' && layerAPI.current?.isReady !== false && (!portraitHasFrame(latest.current) || portraitFrame.current.status !== 'loading'); },
      cameraView() { return state.cameraView(); },
      showcaseView() { return {camera:state.cameraView(),anchor:[0,0,center.z],radius,portraitFraming:portraitFraming.toArray()}; },
      restoreShowcaseView(saved) {
        portraitFraming.fromArray(saved.portraitFraming||[0,0]);
        if(latest.current.portraitMode){state.cameraDetached=false;invalidate();return;}
        const origin=saved.anchor||[0,0,center.z],scale=radius/(saved.radius||radius),anchor=[0,0,center.z];
        const view={...saved.camera,position:saved.camera.position.map((v,i)=>anchor[i]+(v-origin[i])*scale),target:saved.camera.target.map((v,i)=>anchor[i]+(v-origin[i])*scale)};
        camera=perspective;controls.object=camera;state.cameraDetached=true;
        applyEvaluatedModelCamera(camera,controls,view,canvas.width/canvas.height);invalidate();
      },
      invalidate() { state.scheduler.invalidate(); },
      fit() { fit(); },
      centerModel(crop) { centerShowcaseModel(crop); },
      maximalZoom(crop) { centerShowcaseModel(crop,true); },
      alignModel(crop,x,y) { centerShowcaseModel(crop,false,x,y); },
      realignModel() {
        if(!latest.current.showcase||latest.current.portraitMode)return;
        camera.up.set(0,0,1);controls.minPolarAngle=.0001;controls.maxPolarAngle=Math.PI-.0001;
        controls.update();cameraChanged();
      },
      setCameraView(view) { camera = perspective; controls.object = camera; state.cameraDetached = true; applyEvaluatedModelCamera(camera, controls, view, canvas.width / canvas.height); invalidate(); },
      modelCenter() { return center.toArray(); },
      effectDefinitions() { return eventPreview.definitions; },
      recordingDimensions({crop,maxDimension,aspect}={}) {
        resize();
        const source=portraitHasFrame(latest.current)?composePortraitCapture(canvas,portraitFrame.current.canvas):canvas;
        return recordingDimensions(source.width,source.height,crop,maxDimension,aspect);
      },
      async prepareRecording() {
        // Prepare the animation without changing the current framing or zoom.
        latest.current.showcase?.begin(state.cameraView(), { center: center.toArray() });
        render(performance.now(), 0, { captureOnly: true });
        await new Promise(resolve => requestPreviewFrame(resolve));
        await state.captureApi.whenReady();
        backgroundState.current.animation?.pause(); layerAPI.current?.pause();
        await Promise.all([backgroundState.current.animation?.seek?.(0), layerAPI.current?.seek(0)]);
      },
      beginRecording(options = {}) {
        latest.current.showcase?.begin(state.cameraView(), { ...options, center: center.toArray() });
        recordingSink = options.onFrame || null;
        if (options.live) { backgroundState.current.animation?.resume(); layerAPI.current?.resume(); }
        else { backgroundState.current.animation?.pause(); layerAPI.current?.pause(); }
        render(performance.now(), 0); state.scheduler.sync();
      },
      freezeRecording(time) {
        recordingSink = null; latest.current.showcase?.freeze(time);
        backgroundState.current.animation?.pause(); layerAPI.current?.pause(); render(performance.now(), 0); state.scheduler.sync();
      },
      endRecording() { recordingSink = null; latest.current.showcase?.end(); backgroundState.current.animation?.resume(); layerAPI.current?.resume(); invalidate(); },
      async seekRecordingFrame(time) {
        await Promise.all([backgroundState.current.animation?.seek?.(time / 1000), layerAPI.current?.seek(time / 1000)]);
        latest.current.showcase?.seekRecording(time); drawBackground();
        if (render(performance.now(), 0, { captureOnly: true }) === false) throw Error('The animation preview could not render a recording frame.');
      },
      recordingFrame(time, options) { latest.current.showcase?.seekRecording(time); render(performance.now(), 0, { captureOnly: true }); return state.captureApi.captureFrame(options); },
      copyVisibleFrame(destination, crop) {
        const context = destination.getContext('2d');
        let source = portraitHasFrame(latest.current) ? composePortraitCapture(canvas, portraitFrame.current.canvas) : canvas;
        if (latest.current.showcaseLayers?.length) {
          if (source === canvas) {
            const composite = layerComposite.current ||= document.createElement('canvas');
            if (composite.width !== source.width) composite.width=source.width;
            if (composite.height !== source.height) composite.height=source.height;
            composite.getContext('2d').drawImage(source,0,0); source=composite;
          }
          layerAPI.current?.paint(source.getContext('2d'),source.width,source.height,showcaseSample?.globalTime || 0,{time:showcaseSample?.presentationTime || 0,enabled:true});
        }
        const selection = cropPixels(source.width,source.height,crop);
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
        const fitted=containRect(selection.width,selection.height,destination.width,destination.height);
        context.fillStyle=latest.current.portraitMode?'#000000':viewportAppearanceOptions(latest.current.preferences).background.color;
        context.fillRect(0,0,destination.width,destination.height);
        context.drawImage(source,selection.x,selection.y,selection.width,selection.height,fitted.x,fitted.y,fitted.width,fitted.height);
      },
      playbackState() { return showcaseSample; },
      focusPoint(values) {
        const next = new THREE.Vector3().fromArray(values), offset = next.clone().sub(controls.target);
        perspective.position.add(offset); ortho.position.add(offset); controls.target.copy(next);
        controls.update(); invalidate();
      },
      async whenReady() {
        while (!disposed) {
          const entry = backgroundState.current, human = portraitFrame.current, layers = layerAPI.current; await Promise.all([entry.promise, texturePromise, eventPreview.ready, layers?.whenReady(), (portraitHasFrame(latest.current) || latest.current.preparePortraitFrame) ? human.promise : undefined]);
          if (disposed) break;
          if (entry === backgroundState.current && layers === layerAPI.current && (!portraitHasFrame(latest.current) || human === portraitFrame.current)) { if (entry.status === 'failed') throw entry.error; if(particleAuthor?.status.error)throw Error(particleAuthor.status.error);if(particleAuthor&&(!particleAuthor.simulation||particleAuthor.status.busy)){render(performance.now(),0,{captureOnly:true});await new Promise(resolve=>setTimeout(resolve,0));continue;} return; }
        }
        throw new Error('This animation preview is no longer open.');
      },
      captureFrame({ maxDimension } = {}) {
        if (disposed) throw new Error('This animation preview is no longer open.');
        if (!texturesReady || !eventPreview.isReady) throw new Error('The model preview textures or event effects are still loading.');
        const background = backgroundState.current;
        if (background.status === 'failed') throw background.error;
        if (background.status !== 'ready') throw new Error('The selected preview background is still loading.');
        const saved = { width: canvas.width, height: canvas.height };
        const limits = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        const requestedDimension = portraitHasFrame(latest.current) && Number(maxDimension) > 0 ? Number(maxDimension) * PORTRAIT_RECT.height / HUMAN_FRAME_SIZE : maxDimension;
        const dimensions = captureDimensions(saved.width, saved.height, requestedDimension, Math.min(8192, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...limits));
        try {
          canvas.width = dimensions.width; canvas.height = dimensions.height; drawBackground();
          if (render(performance.now(), 0, { captureOnly: true }) === false) throw new Error('The animation preview could not render a capture.');
          const captured = composePreviewCapture(backgroundCanvas, canvas);
          const result = portraitHasFrame(latest.current) ? composePortraitCapture(captured, portraitFrame.current.canvas) : captured;
          layerAPI.current?.paint(result.getContext('2d'),result.width,result.height,showcaseSample?.globalTime || 0,{time:showcaseSample?.presentationTime || 0,enabled:true});
          return result;
        } finally {
          canvas.width = saved.width; canvas.height = saved.height; drawBackground();
          render(performance.now(), 0); state.scheduler.invalidate();
        }
      },
    };
    latest.current.onCaptureReady?.(state.captureApi);
    ownerDocument.addEventListener('visibilitychange', scheduler.sync);
    window.addEventListener('mdlvis-frame', fit);
    canvas.addEventListener('webglcontextlost', contextLost); scheduler.invalidate();
    return () => {
      cameraMemory.current = portraitBackup
        ? { camera:portraitBackup.camera, view:portraitBackup.appliedView, perspective:portraitBackup.perspective.clone(), ortho:portraitBackup.ortho.clone(), target:portraitBackup.target.clone() }
        : { camera:camera === ortho ? 'ortho' : 'perspective', view:state.appliedView, perspective:perspective.clone(), ortho:ortho.clone(), target:controls.target.clone() };
      if (latest.current.cameraHandoff) latest.current.cameraHandoff.current = cameraMemory.current;
      compareCamera?.listeners.delete(receiveCamera); collisionCanvas?.remove();
      disposed = true; canvas.removeEventListener('dblclick',pickParticle,true); leaveGeoset(); canvas.removeEventListener('pointermove', hoverGeoset); canvas.removeEventListener('pointerleave', leaveGeoset); latest.current.onCaptureReady?.(null); backgroundCanvas.remove(); hoverCanvas?.remove(); connectorCanvas?.remove(); nodeCanvas?.remove(); geometryCanvas?.remove(); cameraCanvas?.remove(); scheduler.dispose(); ownerDocument.removeEventListener('visibilitychange', scheduler.sync); window.removeEventListener('mdlvis-frame', fit); window.removeEventListener('mdlxl-view-camera', viewCamera); unbindScroll(); observer?.disconnect(); ownerWindow.removeEventListener('keydown', previewKeyDown, true); ownerWindow.removeEventListener('keyup', previewKeyUp, true); ownerWindow.removeEventListener('blur', previewWindowBlur); canvas.removeEventListener('lostpointercapture', endShowcaseCursor); canvas.removeEventListener('pointerdown', pointerDown, true); canvas.removeEventListener('pointermove', suppressAdjustedMove, true); canvas.removeEventListener('pointerup', finishLeftGesture, true); canvas.removeEventListener('pointercancel', finishLeftGesture, true); canvas.removeEventListener('pointermove', nodePointerMove, true); canvas.removeEventListener('pointerup', finishNodeGesture, true); canvas.removeEventListener('pointercancel', finishNodeGesture, true); canvas.removeEventListener('keydown', cancelNodeGesture, true); controls.removeEventListener('change', cameraChanged); controls.removeEventListener('start', cameraStarted); controls.removeEventListener('end', cameraEnded); controls.dispose(); canvas.removeEventListener('webglcontextlost', contextLost); runtime.current = null; rigMarkers.dispose(); presentation.dispose(); nativeBackground.dispose(); eventPreview.dispose(); previewAdapter.dispose(); releasePreviewGraphics(native, gl, canvas);
    };
  }, [rendererModel, rendererRevision, textureAssets, props.isolatedGeosets?.join(','), props.modelPath, graphics.antialias, graphics.anisotropy, graphics.textureFiltering, graphics.particles, props.showParticles, graphics.lighting, graphics.textures, timelineStart, timelineEnd, globalPreviewId]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    if (!props.portraitMode) { current.exitPortrait(); return; }
    const evaluated = evaluateModelCamera(model, model?.Cameras?.[props.portraitCameraIndex], props.time, sequenceIndex, props.time);
    current.enterPortrait(evaluated);
  }, [props.portraitMode, props.portraitCameraIndex, props.portraitSnapRevision, model, rendererRevision]);
  // Context/recipe replacement rebuilds in the passive effect above. Do not apply
  // its hierarchy to the old runtime during this earlier layout-effect phase.
  useLayoutEffect(()=>{const current=runtime.current;if(props.particleLiveModel&&current?.particleSourceModel===rendererModel)current.updateParticles(props.particleLiveModel,props.particleLiveField,props.particleSelectedId);},[props.particleLiveModel,props.particleLiveRevision,rendererModel]);
  useEffect(() => { if(runtime.current && runtime.current.appliedView !== view) runtime.current.setView(view); }, [view]);
  useEffect(() => { if (props.cameraPresetRequest?.name) runtime.current?.setCameraPreset(props.cameraPresetRequest.name); }, [props.cameraPresetRequest?.revision]);
  useEffect(() => { runtime.current?.refreshCursor(); }, [props.cameraMode, props.transformMode, props.showcaseCrop]);
  useEffect(() => { if (props.cameraAnglesRequest) runtime.current?.setCameraAngles(props.cameraAnglesRequest); }, [props.cameraAnglesRequest]);
  useEffect(() => { setAdjustingSensitivity(null); }, [props.preferences?.wheelMode]);
  useEffect(() => { const controls = runtime.current?.controls; if (controls) controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(props.preferences?.pointerSensitivity); }, [props.preferences?.pointerSensitivity]);
  useEffect(() => { runtime.current?.resize(); }, [graphics.pixelRatio, props.showGrid, props.overlays?.grid, props.preferences?.grid]);
  useEffect(() => { runtime.current?.drawBackground(); }, [props.preferences?.visuals?.background, props.preferences?.viewportAppearance?.background]);
  useEffect(() => { props.onCaptureReady?.(runtime.current?.captureApi || null); }, [props.onCaptureReady]);
  useEffect(() => { if (model) runtime.current?.updateUV(model); }, [model, revision, props.uvRevision]);

  useEffect(() => { runtime.current?.scheduler.sync(); }, [props.showcasePlaying, props.showcaseConfig, props.playbackRange, props.presentation, props.previewMode, props.previewOverlay, props.restPose, props.cleanAnimationPreview, props.restrictions, props.workplaneEnabled, props.selectableGeosets, props.multiple, props.showAxes, props.selectionByGeoset, props.hiddenGeosets, props.hideRgbGeoset, props.cameraMode, props.hoveredGeoset, props.mode, props.shaded, props.showGrid, props.workplane, props.preferences, props.grabThrough, props.showNodes, props.overlays, props.showCameras, props.selectedNodeIds, props.attachSourceIds, props.transformMode, props.transformSpace, props.rotateOnOwnAxis, props.playbackSpeed, props.playing, props.loop, props.time, sequenceIndex, props.globalSeqId, props.teamColor, props.suspended, graphics.maxFps, graphics.pauseWhenHidden]);

  useEffect(() => { runtime.current?.scheduler.sync(); }, [props.showCollisionSpheres, props.seekId, props.playbackRunning, props.playbackGlobalTime]);
  const marqueeColor = previewOverlaySettings(props.previewOverlay).color;
  const frame = portraitFrame.current, portrait = !!props.portraitMode, framed = portraitHasFrame(props), hasCamera = !!model?.Cameras?.[props.portraitCameraIndex];
  return <div ref={root} className={`game-preview-root${framed ? ' portrait-preview-root' : ''}`} style={{ minHeight: props.presentation === 'preview' ? 0 : 180, background: props.showcase && portrait ? viewportBackground.color : undefined }}>
    <div ref={stage} className={`game-preview-stage${framed ? ' portrait-preview-stage' : ''}`} style={framed ? { width: portraitSize, height: portraitSize } : undefined}>
      <div ref={host} className={`game-preview-surface${framed ? ' portrait-model-surface' : ''}`} />
      {selectionBox && <div className={`game-preview-selection-layer${framed ? ' portrait-model-surface' : ''}`}><div data-selection-marquee="" style={{ position: 'absolute', zIndex: 90, pointerEvents: 'none', boxSizing: 'border-box', border: `1px dashed ${marqueeColor}`, background: `${marqueeColor}24`, boxShadow: '0 0 0 1px #fff', ...selectionBox }} /></div>}
      {framed && frame.status === 'ready' && <img className="portrait-human-frame" src={frame.url} alt="" aria-hidden="true" data-frame-version={portraitFrameVersion}/>}
      {props.showcase && <ShowcaseLayers ref={layerAPI} grid={props.showcaseGrid} gridDensity={props.showcaseGridDensity} crop={props.showcaseCrop} layers={props.showcaseLayers} activeId={props.showcaseActiveLayer} editing={props.showcaseLayerEditing} onSelect={props.onShowcaseLayerSelect} onChange={props.onShowcaseLayerChange} onError={props.onShowcaseLayerError} onInvalidate={()=>runtime.current?.scheduler.invalidate()}/>}
      {portrait && !hasCamera && <div className="portrait-message" role="status">Create or select a camera to view the portrait</div>}
      {framed && frame.status === 'loading' && <div className="portrait-frame-status" role="status">Loading Human UI frame from installed Warcraft III data…</div>}
      {framed && frame.status === 'failed' && <div className="portrait-frame-status portrait-frame-error" role="status">{frame.error}</div>}
    </div>
    {adjustingSensitivity !== null && <div role="status" style={sensitivityIndicatorStyle}>{sensitivityIndicatorText(adjustingSensitivity)}</div>}
    {gestureLabel && <div role="status" style={{ position:'absolute', top:8, left:8, padding:'4px 7px', background:'#182638', color:'#fff', fontSize:12 }}>{gestureLabel}</div>}
    {warnings.length>0&&<div role="status" style={{position:'absolute',bottom:3,left:4,fontSize:11,color:'#500'}}>{warnings.join(' ')}</div>}
    {eventWarnings.length > 0 && <div role="status" style={{position:'absolute',bottom:20,left:4,fontSize:11,color:'#753d12',maxWidth:'95%'}}>{eventWarnings.join(' ')}</div>}
    {backgroundError && <div role="status" style={{ position:'absolute', top:3, left:4, fontSize:11, color:'#700' }}>{backgroundError}</div>}
    {error && <div role="alert" style={{ position: 'absolute', inset: 0, background: '#ddd', display: 'grid', placeItems: 'center', padding: 20, color: '#300', textAlign: 'center',fontSize:11 }}>{error}</div>}
  </div>;
}
