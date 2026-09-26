import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import Viewport, { textureFromAsset } from './Viewport.jsx';
import { QUAD_VIEW_OPTIONS } from './quad-view.js';
import {visiblePaintGeosets} from '../src/paint-view.js';
import PaintBoundary from './PaintBoundary.jsx';
import {validatePaintAssignments,repairPaintMaterials} from '../src/paint-materials.js';
import {preparePaintModelCommit,commitPaintModel,adoptCommittedPaintUVs} from '../src/paint-model-integration.js';
import Addons from './Addons.jsx';
import { commitPart } from '../src/bits-and-parts.js';
import { directlyBoundBoneIds } from '../src/binding-inspection.js';
import { attachToBone, changeVertexBinding, createRigNode, deleteRigNode, detachFromBone, renameRigNode, setBoneBillboarded } from '../src/bone-tools.js';
import { builtinTextureAssets } from '../src/builtin-textures.js';
const BitsAndParts = lazy(() => import('./BitsAndParts.jsx'));
const ParticleEditor = lazy(() => import('./ParticleEditor.jsx'));
import UVWorkspace from './UVWorkspace.jsx';
import DetachedWindow from './DetachedWindow.jsx';
import { openDetachedUVWindow } from './detached-window.js';
import { applyApplicationTheme } from './theme.js';
import AnimationPreviewTools from './AnimationPreviewTools.jsx';
import PressedKeys from './PressedKeys.jsx';
import LanguageSwitch from './LanguageSwitch.jsx';
import ModernIcon, { hasModernIcon } from './ModernIcon.jsx';
import { setLanguage, translate } from '../src/localization.js';
import { usePreviewBackgrounds } from './usePreviewBackgrounds.js';
const GamePreview = lazy(() => import('./GamePreview.jsx'));
const ResourceEditor = lazy(() => import('./ResourceEditors.jsx'));
const MovementController = lazy(() => import('./MovementControllerRecomp.jsx'));
const AnimationController = lazy(() => import('./AnimationController.jsx'));
const TextureLibrary = lazy(() => import('./TextureLibrary.jsx'));
const PaintWorkspace = lazy(() => import('./PaintWorkspace.jsx'));
const Forge = lazy(() => import('./Forge.jsx'));
const OptimizeModel = lazy(() => import('./OptimizeModel.jsx'));
import { commitOptimization, OPTIMIZER_SECTIONS } from '../src/model-optimizer.js';
const ShapingDialog = lazy(() => import('./ShapingDialog.jsx'));
const KeyframeTimeline = lazy(() => import('./KeyframeTimeline.jsx'));
const MotionInspector = lazy(() => import('./MotionInspector.jsx'));
import useMotionInspector from './useMotionInspector.js';
import { rememberMotionSave } from '../src/motion-decisions.js';
import { commitForge } from '../src/forge.js';
import { shapeGeosets, SHAPE_TOOLS } from '../src/shaping.js';
import { retainedForgeAssets, forgeExportArchive, isForgeAssetPath, missingForgeAssetPaths } from '../src/forge-assets.js';
import { applyMovementTransform, movementRestricted, constrainMovementVector, movementProperties } from '../src/movement.js';
import { classicTimelineDomain } from '../src/classic-keyframes.js';
import { beginUVPreview, applyUVPreviews, revertUVPreviews, uvPreviewModel, restoreUVPreviews, addLibraryTexture, validateUVPreview, captureUVPreviewGuard, validateUVPreviewGuard, getUVPreviewSelection } from '../src/uv-preview.js';
import { setUVTextureWrapping, uncoupleUVVertices } from '../src/uv-tools.js';
import './modules.css';
import './texture-library.css';
import Settings from './Settings.jsx';
import { installTextureLibraryDecoder } from './asset-preload-client.js';
import { WarmKeysProvider } from './WarmKeys.jsx';
import { normalizePreferences } from '../src/preferences.js';
import { COMMANDS } from '../src/commands.js';
import VIEW_MENU from '../src/view-menu.json';
import { SelectionHistory } from '../src/selection-history.js';
import { EditorDocument, openDocument, importGeosets, deleteGeoset, recalculateExtents, recalculateNormals } from '../src/editor-document.js';
import { separateGeosetsByLoosePart, nuclearSeparateGeosets, mergeSimilarGeosets } from '../src/geoset-operations.js';
import { transformVertices, deleteVertices, addTriangle } from '../src/editor-commands.js';
import { detachFaces, extrudeFaces } from '../src/mesh-tools.js';
import { captureMeshSelection } from '../src/mesh-clipboard.js';
import { captureUVSelection } from '../src/uv-selection.js';
import { collapseVertices, weldSelectedVertices, uncoupleVertices, deleteSelectedFaces, averageSelectedNormals } from '../src/classic-mesh.js';
import { allGeosets, chooseGeosets, initialGeosetSelection, invertGeosets, filterVertexSelection } from '../src/classic-selection.js';
import { TEAM_COLORS } from '../src/team-colors.js';
import { createStarterDocument } from '../src/starter-model.js';
import { bindDropdownWheel } from '../src/dropdown-wheel.js';
import { prepareModelSaveAsync } from './model-save.js';
import { sampleTrack } from '../src/animation.js';
import { buildPaintExportArtifact, buildPaintProjectArtifact } from '../src/paint-export.js';
import { markPaintProjectSaved, restorePaintProject, travelPaintHistory } from '../src/paint-project.js';
import { enumeratePaintTargets, installFreshPaintLayer, paintTargetsForGeoset } from '../src/paint-targets.js';
import { paintMessage } from '../src/paint-messages.js';
import { decodePaintImage } from './paint-raster.js';
import { animationPanelDisplay, clearQuickDisplay, enterMovementDisplay, setEditorDisplay, synchronizeEditorDisplay } from '../src/display-overlays.js';
import { evaluateModelCamera } from './portrait-view.js';
import { setCameraFromCurrentView } from './portrait-camera-edit.js';
import PortraitToolbar from './PortraitToolbar.jsx';
import QuickDisplay from './QuickDisplay.jsx';
import GeosetAnimationRepair from './GeosetAnimationRepair.jsx';
import PortraitSetup from './PortraitSetup.jsx';
import { createPortraitSequence, portraitSequenceIndices } from '../src/sequence-editor.js';
import { scanGeosetAnimationDuplicates, repairGeosetAnimations } from '../src/geoset-animation-repair.js';

const normalize = value => String(value || '').replaceAll('/', '\\').toLowerCase();
const previewBlockedCommands = new Set([...VIEW_MENU.filter(row=>row && !['frame','frameSelection','wireframe','cleanView'].includes(row[1])).map(row=>row[1]),'grid','shaded','showVertices']);
const views = ['orthographic', 'perspective', 'front', 'back', 'left', 'right', 'top', 'bottom'];
const resources = ['Materials', 'Textures', 'Nodes', 'Geosets', 'GeosetAnims', 'Sequences', 'TextureAnims', 'GlobalSequences'];
const teamColors = TEAM_COLORS.map(row => [row.index === null ? row.name : `${row.index} · ${row.name}`, row.rgbHex]);
export function neutralTextColor(hex) {
  const rgb = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  return luminance > .36 ? '#111111' : '#ffffff';
}
const blank = () => openDocument(new TextEncoder().encode('Version { FormatVersion 800, }\nModel "Untitled" { BlendTime 150, MinimumExtent { 0, 0, 0 }, MaximumExtent { 0, 0, 0 }, BoundsRadius 0, }\n'), 'Untitled.mdl');
const newSession = (doc = blank(), path = null, assets = builtinTextureAssets()) => ({ doc, path, assets, uvPreviews: {}, animationDrafts: {}, paintProject: null, paintOriginalModelBytes: null, paintWorkingModel: null, paintWorkingRevision: 0, id: crypto.randomUUID(), checkpoint: 0 });
export async function readInputBytes(file){
  const bytes=typeof file.arrayBuffer==='function'?await file.arrayBuffer():file.bytes;
  if(bytes instanceof ArrayBuffer)return new Uint8Array(bytes);
  if(bytes instanceof Uint8Array)return bytes;
  if(ArrayBuffer.isView(bytes))return new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  throw new Error('The selected file did not provide readable binary data.');
}
function browserRecovery(operation, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mdlvis-classic-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction('drafts', operation === 'put' ? 'readwrite' : 'readonly'), store = tx.objectStore('drafts'); const action = operation === 'put' ? store.put(value) : operation === 'get' ? store.get(value) : store.getAll(); let result; action.onsuccess = () => { result = action.result; }; tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(tx.error); }; };
  });
}
function Tool({ icon, title, onClick, active, disabled, children, flip, action }) {
  return <button data-warmkey={action} type="button" className={`classic-tool${active ? ' active' : ''}`} title={title} aria-label={title} aria-pressed={active === undefined ? undefined : !!active} disabled={disabled} onClick={onClick}>{icon ? hasModernIcon(icon) ? <ModernIcon name={icon} flip={flip}/> : <img src={`./classic/${icon}${/\.(png|gif|svg)$/.test(icon)?'':'.png'}`} alt="" draggable={false} style={flip ? { transform: 'scaleX(-1)' } : undefined}/> : children}</button>;
}
function PressedKeysTool({ active, onClick, icon }) {
  return <button type="button" className="pressed-keys-tool" data-warmkey="pressedKeys" title="Show pressed keys" aria-label="Show pressed keys" aria-pressed={active} onClick={onClick}><img src={icon} alt="" draggable={false}/><span aria-hidden="true"><b>K</b><b>E</b><b>Y</b></span></button>;
}
function Coordinate({ axis, displayAxis=axis, value, disabled, onCommit }) {
  const [text, setText] = useState('0'), cancel = useRef(false);
  useEffect(() => setText(Number.isFinite(value) ? String(Number(value.toFixed(4))) : '0'), [value]);
  const commit = () => { if (cancel.current) { cancel.current = false; return; } const number = Number(text); if (Number.isFinite(number) && number !== Number(value.toFixed(4))) onCommit(number); else setText(String(Number(value.toFixed(4)))); };
  return <label className="field"><span>{displayAxis}</span><input data-warmkey={`coordinate:${axis}`} aria-label={`${axis} coordinate`} type="number" step="any" disabled={disabled} value={text} onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancel.current = true; setText(String(Number(value.toFixed(4)))); event.currentTarget.blur(); } }}/></label>;
}
function Dialog({ title, children, footer, onClose, onWarmKeys }) {
  return <div className="classic-modal"><section data-warmkey-scope="dialog" data-warmkey-prefix={title} className="classic-modal-window" role="dialog" aria-modal="true" aria-label={title}><header><span>{title}</span><div>{onWarmKeys && <button data-warmkey="warmkeys" aria-label="Hotkeys for this dialog" onClick={onWarmKeys}>Keys</button>}<button data-warmkey="close" aria-label={`Close ${title}`} onClick={onClose}>×</button></div></header><div className="classic-modal-body">{children}</div><footer>{footer || <button data-warmkey="app:action:1" onClick={onClose}>Close</button>}</footer></section></div>;
}

export default function App() {
  useEffect(() => installTextureLibraryDecoder(window.desktop), []);
  const [preferences, setPreferences] = useState(() => { try { return normalizePreferences(JSON.parse(localStorage.getItem('mdlvis-preferences') || '{}')); } catch { return normalizePreferences({}); } });
  setLanguage(preferences.language);
  useEffect(()=>{document.documentElement.lang=preferences.language;},[preferences.language]);
  const [settingsTab, setSettingsTab] = useState(null), [preferencesReady, setPreferencesReady] = useState(!window.desktop);
  const [pressedKeysIcon, setPressedKeysIcon] = useState('./classic/pasbtn-magical-sentry.png');
  useEffect(() => bindDropdownWheel(document), []);
  const textureUrls = useRef(new Set());
  useEffect(() => {
    let cancelled = false, texture;
    window.desktop?.resolveTextures?.({ names: ['ReplaceableTextures\\PassiveButtons\\PASBTNMagicalSentry.blp'] }).then(records => {
      if (!records?.[0] || cancelled) return;
      return textureFromAsset(records[0]).then(value => {
        texture = value; if (cancelled) return;
        const { width, height, data } = value.image, canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d'); if (data) context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0); else context.drawImage(value.image, 0, 0);
        setPressedKeysIcon(canvas.toDataURL('image/png')); value.dispose(); texture = null;
      });
    }).catch(() => {});
    return () => { cancelled = true; texture?.dispose(); };
  }, []);
  const timelineCommands = useRef({});
  const registerTimelineCommands = useCallback(value=>{timelineCommands.current=value;},[]);
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const savedPreferences = useRef(null), preferencesTimer = useRef();
  function changePreferences(next) { const value = normalizePreferences(typeof next === 'function' ? next(preferencesRef.current) : next); preferencesRef.current = value; setPreferences(value); }
  const changeSensitivity = value => changePreferences({ ...preferencesRef.current, scrollSensitivity: value });
  const changePointerSensitivity = value => changePreferences({ ...preferencesRef.current, pointerSensitivity: value });
  const toggleWheelMode = mode => changePreferences(previous => ({ ...previous, wheelMode: previous.wheelMode === mode ? 'rotate' : mode }));
  const toggleCamera = () => setCameraMode(previous => previous === 'work' ? 'rotate' : 'work');
  const toggleMiddleCamera = () => setCameraMode(previous => previous === 'rotate' ? 'work' : 'rotate');
  const [session, setSession] = useState(newSession), [tick, setTick] = useState(0), [status, setStatus] = useState('Ready');
  const [repairReceipt, setRepairReceipt] = useState(null);
  const [mode, setMode] = useState('vertices'), [cameraMode, setCameraMode] = useState('work'), [view, setStoredView] = useState('orthographic'), [portraitView, setPortraitView] = useState('perspective'), [workplane, setWorkplane] = useState('xy');
  const [adjustingInput, setAdjustingInput] = useState(null);
  // Presentation only: Vis must not reset editing, display settings or portrait state.
  const [visUI, setVisUI] = useState(false);
  const [quadView, setQuadView] = useState(false), [activeVertexPane, setActiveVertexPane] = useState(null);
  const [vertexViewRequest, setVertexViewRequest] = useState(null);
  const setView = value => {
    if (quadView && mode === 'vertices') setVertexViewRequest(previous => ({ view: value, revision: (previous?.revision || 0) + 1 }));
    else setStoredView(value);
  };
  const toggleQuadView = () => setQuadView(value => !value);
  const lockedVertexPlane = mode === 'vertices' && quadView ? activeVertexPane?.workplane : null;
  const [cameraAngles, setCameraAngles] = useState({x:0,y:0,z:0}), [cameraAnglesRequest,setCameraAnglesRequest] = useState(null), [cameraGesture,setCameraGesture] = useState(false);
  const [portraitEnabled, setPortraitEnabled] = useState(false), [portraitCameraIndex, setPortraitCameraIndex] = useState(0);
  const [portraitSnapRevision, setPortraitSnapRevision] = useState(0);
  const receiveCameraAngles = useCallback(value => setCameraAngles(previous => ['x','y','z'].some(axis=>Math.abs(previous[axis]-value[axis])>.001)?value:previous), []);
  const cameraProps = {onCameraAnglesChange:receiveCameraAngles,cameraAnglesRequest,onCameraGestureChange:setCameraGesture,onSensitivityIndicator:setAdjustingInput};
  useEffect(()=>setCameraGesture(false),[mode,session.id]);
  const [tool, setTool] = useState('select'), [shaded, setShaded] = useState(true), [teamColor, setTeamColor] = useState('#ff0303'), [renderMode, setRenderMode] = useState('wireframe');
  const [previewRenderModes, setPreviewRenderModes] = useState({});
  const [selectable, setSelectable] = useState(new Set()), [selection, setSelection] = useState({}), [hidden, setHidden] = useState({}), [activeGeoset, setActiveGeoset] = useState(0), [uvSet, setUvSet] = useState(0);
  const [showAllGeosets, setShowAllGeosets] = useState(true);
  const [viewHoveredGeoset, setViewHoveredGeoset] = useState(null), [selectionHoveredGeoset, setSelectionHoveredGeoset] = useState(null);
  useEffect(() => { setViewHoveredGeoset(null); setSelectionHoveredGeoset(null); }, [mode, preferences.highlightSelection, preferences.viewportAppearance.geosetHighlight.viaView, preferences.viewportAppearance.geosetHighlight.viaSelection]);
  const [globalSeqId, setGlobalSeqId] = useState(null), [highlightByPanel, setHighlightByPanel] = useState({ movement: false, animations: false });
  const [sequence, setSequence] = useState(-1), [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [dialog, setDialog] = useState(null), [context, setContext] = useState(null);
  useEffect(()=>setAdjustingInput(null),[mode,settingsTab,dialog?.type]);
  const [animationPanel, setAnimationPanel] = useState('movement'), [selectedNodeIds, setSelectedNodeIds] = useState([]), [movementMode, setMovementMode] = useState('select'), [movementSpace, setMovementSpace] = useState('local'), [showNodes, setShowNodes] = useState(true);
  const [attachSourceIds, setAttachSourceIds] = useState([]), [boneCreateOpen, setBoneCreateOpen] = useState(false);
  const cameraHandoff = useRef(null);
  const cameraSessionId = useRef(session.id);
  if (cameraSessionId.current !== session.id) { cameraSessionId.current = session.id; cameraHandoff.current = null; }
  const portraitModeActive = portraitEnabled && mode === 'animation' && animationPanel === 'movement';
  const cameraRotating = cameraMode === 'rotate' && !lockedVertexPlane || cameraGesture;
  const [workplaneEnabled, setWorkplaneEnabled] = useState(true), [multipleNodes, setMultipleNodes] = useState(false);
  const [restrictions, setRestrictions] = useState({translation:false,rotation:false,scaling:false});
  const rigWorkspace = mode === 'bones' || mode === 'animation' && animationPanel === 'movement';
  const restPose = mode === 'bones', cleanAnimationPreview = mode === 'animation' && animationPanel === 'animations';
  const highlightKeyframes = highlightByPanel[animationPanel];
  const setHighlightKeyframes = value => setHighlightByPanel(previous => ({ ...previous, [animationPanel]: value }));
  const [captureAPI, setCaptureAPI] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [uvEntrySelection, setUVEntrySelection] = useState({}), [uvEntryId,setUVEntryId] = useState(0);
  const [uvWindow, setUVWindow] = useState(null), uvWindowRef = useRef(null);
  const [rgbPreview, setRGBPreview] = useState(false), [rgbSequence, setRGBSequence] = useState(-1);
  const [background, setBackground] = useState(() => localStorage.getItem('mdlvis-preview-background') || '');
  const [cleanViews, setCleanViews] = useState({});
  const [overlayModes, setOverlayModes] = useState(() => {
    const defaults = { vertices: {bones:false,wires:false,nodes:false,attachments:false,particles:false,vertices:true,grid:true,cameras:false,normals:false}, uv:{bones:false,wires:false,nodes:false,attachments:false,particles:false,vertices:true,grid:true,cameras:false,normals:false}, paint:{bones:false,wires:false,nodes:false,attachments:false,particles:false,vertices:false,grid:false,cameras:false,normals:false}, bones:{bones:true,wires:false,nodes:true,attachments:true,particles:true,vertices:true,grid:true,cameras:false,normals:false}, animation:{bones:true,wires:false,nodes:true,attachments:true,particles:true,vertices:false,grid:true,cameras:false,normals:false} };
    try { const saved = JSON.parse(localStorage.getItem('mdlvis-display-overlays') || '{}'); for (const key of Object.keys(defaults)) for (const field of Object.keys(defaults[key])) if (typeof saved[key]?.[field] === 'boolean') defaults[key][field] = saved[key][field]; } catch {}
    return synchronizeEditorDisplay(defaults);
  });
  const cleanView = !!cleanViews[mode], storedOverlays = cleanView ? Object.fromEntries(Object.keys(overlayModes[mode]).map(key => [key, false])) : overlayModes[mode];
  const overlays = storedOverlays.cameras ? { ...storedOverlays, cameras: false } : storedOverlays;
  const panelOverlays = mode === 'animation' ? animationPanelDisplay(overlays, animationPanel) : overlays;
  function changeOverlay(key, value) { const next = setEditorDisplay(overlayModes, mode, key, value); setCleanViews(previous => ({ ...previous, [mode]: false })); setOverlayModes(next); localStorage.setItem('mdlvis-display-overlays', JSON.stringify(next)); }
  const showAxes = !cleanView && !cleanAnimationPreview && Object.values(preferences.grid.axes).some(Boolean);
  const showGrid = overlays.grid, setShowGrid = value => changeOverlay('grid', value), showVertices = overlays.vertices, setShowVertices = value => changeOverlay('vertices', value);
  const portraitOverlays = { ...panelOverlays, grid: false, cameras: false };
  const [liveUV, setLiveUV] = useState(null), [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const liveMovementRevision = useRef(-1);
  const [recoveries, setRecoveries] = useState([]), [historyMB, setHistoryMB] = useState(512), [historySteps, setHistorySteps] = useState(10000), [anchor, setAnchor] = useState(''), [normalAngle, setNormalAngle] = useState(90), [gameDataPath, setGameDataPath] = useState('');
  const [zoomAnchor, setZoomAnchor] = useState(null), [choosingZoomAnchor, setChoosingZoomAnchor] = useState(false);
  const files = useRef(), textures = useRef(), folder = useRef(), clipboard = useRef(null), latest = useRef(), commands = useRef({}), rangeAnchor = useRef(0), settings = useRef({}), textureResolutions = useRef(new WeakMap());
  const doc = session.doc, model = doc.model, geoset = model.Geosets[activeGeoset];
  const inspectingMotion = mode === 'animation' && globalSeqId === null;
  const motion = useMotionInspector(session, sequence, doc.revision, inspectingMotion && sequence >= 0);
  const [motionAnchor, setMotionAnchor] = useState(8);
  const motionOrigin = useRef(null);
  const closeMotion = () => { motion.setActive(null); motion.setFocus(null); motionOrigin.current?.focus({ preventScroll: true }); };
  const sharedMotionChannel = inspectingMotion && model.Nodes?.some(node => {
    const global = node?.[movementProperties[movementMode]]?.GlobalSeqId;
    return selectedNodeIds.includes(node?.ObjectId) && Number.isInteger(global) && global >= 0;
  });
  const seekMotionTime = value => {
    setPlaying(false); setTime(value);
    if (motion.focus && (value < motion.focus[0] || value > motion.focus[1])) motion.setFocus(null);
  };
  const selectMotion = finding => {
    const target = finding.targets?.[0] || { time: finding.time, keyTimes: finding.selectionKeys || [finding.time] };
    const channel = Object.keys(movementProperties).find(mode => movementProperties[mode] === finding.property) || 'rotate';
    selectAnimationPanel('movement');
    seekMotionTime(Math.round(target.time)); setSelectedNodeIds([finding.nodeId]);
    setMovementMode(channel); setTool(channel === 'move' ? 'translate' : channel);
    setHighlightByPanel(previous => ({ ...previous, movement: true }));
    timelineCommands.current.selectKeys?.(target.keyTimes || [target.time], { kind: 'node', id: finding.nodeId, property: finding.property });
    setCameraMode('work');
    setShowNodes(true); setCleanViews(previous => ({ ...previous, animation: false }));
    setOverlayModes(previous => setEditorDisplay(setEditorDisplay(previous, 'animation', 'bones', true), 'animation', 'nodes', true));
  };
  const replayMotion = finding => {
    const interval = model.Sequences[sequence]?.Interval;
    if (!interval) return;
    const padding = Math.max(100, Math.round((finding.end - finding.start) * .2));
    const focus = [Math.max(interval[0], Math.floor(finding.start - padding)), Math.min(interval[1], Math.ceil(finding.end + padding))];
    motion.setFocus(focus); setTime(focus[0]); setPlaying(true);
  };
  const duplicateAnimations = useMemo(() => scanGeosetAnimationDuplicates(model), [model, doc.revision]);
  const repairBlocked = duplicateAnimations.length > 0 || !!repairReceipt;
  useEffect(() => { if (!model.Cameras?.[portraitCameraIndex]) setPortraitCameraIndex(model.Cameras?.length ? 0 : -1); }, [model, doc.revision, portraitCameraIndex]);
  useEffect(() => {
    if (portraitEnabled && (!model.Cameras?.length || !portraitSequenceIndices(model).includes(sequence))) setPortraitEnabled(false);
  }, [model, doc.revision, sequence, portraitEnabled]);
  const paintOriginalModel=useMemo(()=>session.paintOriginalModelBytes?openDocument(session.paintOriginalModelBytes,doc.name).model:model,[session.paintOriginalModelBytes,session.id,model]);
  const animationDomain = useMemo(() => classicTimelineDomain(model, model.Sequences[sequence] ? sequence : -1, model.GlobalSequences?.[globalSeqId] > 0 ? globalSeqId : null), [model, doc.revision, sequence, globalSeqId]);
  useLayoutEffect(() => {
    const missingSequence = sequence >= 0 && !model.Sequences[sequence];
    const missingGlobal = globalSeqId !== null && !(model.GlobalSequences?.[globalSeqId] > 0);
    if (missingSequence || missingGlobal) {
      if (missingSequence) setSequence(-1);
      if (missingGlobal) setGlobalSeqId(null);
      setPlaying(false); setTime(value => Math.max(animationDomain.start, Math.min(animationDomain.end, value)));
    }
  }, [model, doc.revision, sequence, globalSeqId, animationDomain]);
  const selectionHistory = useMemo(() => new SelectionHistory(doc), [doc]);
  const selectionState = { selectable, selection, hidden, activeGeoset, uvSet, selectedNodeIds };
  useLayoutEffect(() => { if (selectionHistory.observe(selectionState)) setTick(value => value + 1); }, [selectionHistory, selectable, selection, hidden, activeGeoset, uvSet, selectedNodeIds, doc.revision]);
  latest.current = { session, doc, model, selection, selectable, hidden, mode, dialog, settingsTab, preferencesReady };
  const refresh = () => setTick(value => value + 1);
  const say = (message, error = false) => setStatus((error ? 'Error: ' : '') + message);
  const selectBackground = value => { setBackground(value); localStorage.setItem('mdlvis-preview-background', value); };
  const backgroundLibrary = usePreviewBackgrounds(mode === 'animation', background, selectBackground, say);
  const {validSelection,selectionCount,centroid,totalVertices,totalFaces,hiddenCount,selectedFaces} = useMemo(() => {
    const validSelection = filterVertexSelection(selection, selectable, model);
  const selectionCount = Object.values(validSelection).reduce((sum, ids) => sum + ids.length, 0);
  const centroid = [0, 0, 0];
  for (const [gi, ids] of Object.entries(validSelection)) for (const id of ids) for (let axis = 0; axis < 3; axis++) centroid[axis] += model.Geosets[gi].Vertices[id * 3 + axis] / (selectionCount || 1);
  const totalVertices = model.Geosets.reduce((sum, g, i) => sum + (selectable.has(i) ? g.Vertices.length / 3 : 0), 0), totalFaces = model.Geosets.reduce((sum, g, i) => sum + (selectable.has(i) ? g.Faces.length / 3 : 0), 0);
  const hiddenCount = Object.entries(hidden).reduce((sum, [gi, ids]) => sum + new Set(ids.filter(i => i < (model.Geosets[gi]?.Vertices.length || 0) / 3)).size, 0);
  let selectedFaces = 0; for (const [gi, ids] of Object.entries(validSelection)) { const picked = new Set(ids), faces = model.Geosets[gi].Faces; for (let i = 0; i < faces.length; i += 3) if (picked.has(faces[i]) && picked.has(faces[i + 1]) && picked.has(faces[i + 2])) selectedFaces++; }
    return {validSelection,selectionCount,centroid,totalVertices,totalFaces,hiddenCount,selectedFaces};
  }, [doc, doc.revision, selection, selectable, hidden]);
  useEffect(() => {
    if (!zoomAnchor) return;
    const anchorGeoset = model.Geosets[zoomAnchor.geosetIndex];
    if (mode !== 'vertices' || tool !== 'scale' || !anchorGeoset || zoomAnchor.vertexIndex < 0 || zoomAnchor.vertexIndex >= anchorGeoset.Vertices.length / 3 || !validSelection[zoomAnchor.geosetIndex]?.includes(zoomAnchor.vertexIndex)) clearZoomAnchor();
  }, [zoomAnchor, mode, tool, model, doc.revision, validSelection]);
  const editable = !doc.readOnly && mode !== 'animation' && mode !== 'paint' && !saving;
  const edit = (label, sections, operation, options = {}) => {
    if (savingRef.current) return false;
    try {
      const ticket = selectionHistory.captureEdit(selectionState), guard = captureUVPreviewGuard(doc.model, session.uvPreviews);
      const result = doc.apply(label, sections, m => { const value = operation(m); validateUVPreviewGuard(m, session.uvPreviews, guard); return value; });
      selectionHistory.recordEdit(ticket, selectionState); refresh(); if (result !== false) say(label); return result;
    } catch (error) { refresh(); say(error.message, true); if(options.rethrow)throw error; return false; }
  };
  const singleRigNode = selectedNodeIds.length === 1 ? model.Nodes?.[selectedNodeIds[0]] : null;
  const selectedBone = singleRigNode && model.Bones.some(bone => bone.ObjectId === singleRigNode.ObjectId) ? singleRigNode : null;
  const parentBone = singleRigNode && model.Bones.some(bone => bone.ObjectId === singleRigNode.Parent);
  const selectedRigNodes = selectedNodeIds.map(id => model.Nodes?.[id]).filter(Boolean);
  const parentedRigNodes = selectedRigNodes.filter(node => model.Bones.some(bone => bone.ObjectId === node.Parent));
  const createBoneOrAttachment = type => {
    if (type === 'Bone' && !selectionCount) captureAPI?.focusPoint?.([0, 0, 0]);
    const created = edit(`Create ${type.toLowerCase()}`, ['Nodes', 'PivotPoints', 'Info'], current => createRigNode(current, type, validSelection));
    setBoneCreateOpen(false);
    if (created && created !== false) setSelectedNodeIds([created.ObjectId]);
  };
  const deleteSelectedNode = () => {
    if (!singleRigNode) return;
    const result = edit('Delete object', ['Nodes', 'PivotPoints', 'Geosets', 'Info'], current => deleteRigNode(current, singleRigNode.ObjectId));
    if (result !== false) { setSelectedNodeIds([]); setAttachSourceIds([]); }
  };
  const renameSelectedNode = (id, value) => edit('Rename object', ['Nodes'], current => renameRigNode(current, id, value));
  const setSelectedBoneBillboarded = (id, enabled) => edit('Set bone billboarded', ['Nodes'], current => setBoneBillboarded(current, id, enabled));
  const beginAttach = () => {
    if (!selectedRigNodes.length || selectedRigNodes.length > 1 && !multipleNodes) return;
    setCameraMode('work'); setMovementMode('select'); setAttachSourceIds(selectedRigNodes.map(node => node.ObjectId));
  };
  const finishAttach = parentId => {
    if (!attachSourceIds.length) return;
    const changed = attachSourceIds.filter(id => model.Nodes?.[id]?.Parent !== parentId);
    if (!changed.length) { setAttachSourceIds([]); return; }
    const result = edit('Attach to parent bone', ['Nodes'], current => changed.forEach(id => attachToBone(current, id, parentId)));
    if (result !== false) setAttachSourceIds([]);
  };
  const detachSelectedNode = () => {
    if (!parentedRigNodes.length || selectedRigNodes.length > 1 && !multipleNodes) return;
    edit('Detach from parent bone', ['Nodes'], current => parentedRigNodes.forEach(node => detachFromBone(current, node.ObjectId)));
  };
  const bindSelectedVertices = kind => {
    if (!selectedBone || !selectionCount) return;
    edit(kind === 'soft' ? 'Soft bind vertices' : kind === 'hard' ? 'Hard bind vertices' : 'Detach vertices from bone', ['Geosets'], current => {
      for (const [index, ids] of Object.entries(validSelection)) if (ids.length) changeVertexBinding(current, current.Geosets[Number(index)], ids, selectedBone.ObjectId, kind);
    });
  };
  // Portrait is a view within Movement: preserve its selection, tools and undo path.
  const enterPortrait = (cameraIndex, sequenceIndex) => {
    setPortraitCameraIndex(cameraIndex); setGlobalSeqId(null);
    setSequence(sequenceIndex); setTime(model.Sequences[sequenceIndex].Interval[0]);
    setRenderMode('textured'); setCleanViews(previous => ({ ...previous, animation: false }));
    setCameraMode('work'); setPortraitView('perspective'); setPortraitEnabled(true); setPlaying(true);
  };
  const enablePortrait = () => {
    const cameraIndex = model.Cameras?.[portraitCameraIndex] ? portraitCameraIndex : model.Cameras?.length ? 0 : -1;
    const portraitSequence = portraitSequenceIndices(model)[0] ?? -1;
    if (cameraIndex < 0 || portraitSequence < 0) {
      setDialog({ type: 'portraitSetup', missingCamera: cameraIndex < 0, missingSequence: portraitSequence < 0 });
      return;
    }
    enterPortrait(cameraIndex, portraitSequence);
  };
  const currentCameraView = () => captureAPI?.cameraView?.();
  const completePortraitSetup = ({ duration, sourceIndex }) => {
    const cameraIndex = model.Cameras?.[portraitCameraIndex] ? portraitCameraIndex : model.Cameras?.length ? 0 : -1;
    if (cameraIndex < 0) throw Error('Use Set Current View to create a camera first.');
    const sequenceIndex = edit('Create Portrait sequence', ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'Nodes', 'Info'], current => createPortraitSequence(current, duration, sourceIndex), { rethrow: true });
    if (sequenceIndex === false) return;
    setDialog(null); enterPortrait(cameraIndex, sequenceIndex);
  };
  const updatePortraitCamera = () => {
    const view = currentCameraView();
    if (!view) { say('The model viewport is still loading.', true); return false; }
    const index = edit('Set camera to current view', ['Cameras', 'Info', 'Geosets'], current => setCameraFromCurrentView(current, portraitCameraIndex, view, time, sequence));
    if (index !== false) { setPortraitCameraIndex(index); setPortraitView('perspective'); }
    return index;
  };
  const setMissingPortraitCamera = () => {
    const index = updatePortraitCamera();
    if (index === false) return;
    if (dialog.missingSequence) setDialog(previous => ({ ...previous, missingCamera: false }));
    else { setDialog(null); enterPortrait(index, portraitSequenceIndices(model)[0]); }
  };
  const clearDisplay = () => {
    const next = clearQuickDisplay(overlayModes, mode);
    setOverlayModes(next); localStorage.setItem('mdlvis-display-overlays', JSON.stringify(next));
    setCleanViews(previous => ({ ...previous, [mode]: false }));
    setShaded(false); showParticlePreview(false);
  };
  const clearZoomAnchor = () => { setZoomAnchor(null); setChoosingZoomAnchor(false); };
  const ensureDetachedUVWindow = () => {
    if (!window.desktop) return true;
    if (uvWindowRef.current && !uvWindowRef.current.closed) { uvWindowRef.current.focus(); return true; }
    const child = openDetachedUVWindow(window);
    if (!child) { say('The UV window could not be opened.', true); return false; }
    uvWindowRef.current = child; setUVWindow(child); return true;
  };
  const selectMode = async next => {
    if (savingRef.current || next === mode) return;
    if (mode === 'paint') { window.dispatchEvent(new CustomEvent('mdlxl-paint-flush')); if (session.paintProject && !await applyPaintToModel()) return; setRenderMode('textured'); setSelectable(new Set(visiblePaintGeosets(paintOriginalModel, activeGeoset))); setShowAllGeosets(false); }
    if (next === 'paint' && session.paintAppliedRevision !== undefined) { session.paintWorkingModel = structuredClone(doc.model); session.paintWorkingRevision++; }
    if (next === 'uv') {
      const entry = captureUVSelection(model, validSelection, selectable, hidden), eligible = Object.keys(entry)[0];
      if (eligible === undefined || !ensureDetachedUVWindow()) return;
      setUVEntrySelection(entry); setUVEntryId(value => value + 1);
      if (!entry[activeGeoset]?.length) { setActiveGeoset(Number(eligible)); setUvSet(0); }
    }
    if (mode === 'uv' && next !== 'uv') { uvWindowRef.current = null; setUVWindow(null); }
    if (next !== 'vertices') clearZoomAnchor();
    if (next !== 'bones') { setAttachSourceIds([]); setBoneCreateOpen(false); }
    if (next === 'bones') {
      setCleanViews(previous => ({ ...previous, bones: false }));
      setOverlayModes(previous => {
        let nextOverlays = previous;
        for (const key of ['bones', 'nodes', 'attachments', 'particles']) nextOverlays = setEditorDisplay(nextOverlays, 'bones', key, true);
        localStorage.setItem('mdlvis-display-overlays', JSON.stringify(nextOverlays));
        return nextOverlays;
      });
    }
    setMode(next); setPlaying(false); setLiveUV(null);
    if (next === 'uv') { setGlobalSeqId(null); setSequence(-1); setTime(0); }
    if (next === 'animation' && mode !== next && sequence < 0 && globalSeqId === null && model.Sequences.length) { setSequence(0); setTime(model.Sequences[0].Interval[0]); }
  };
  const selectAnimationPanel = async panel => {
    if (panel === 'movement') setCleanViews(previous => ({ ...previous, animation: false }));
    if (panel === 'movement') setOverlayModes(previous => {
      const next = { ...previous, animation: enterMovementDisplay(previous.animation) };
      localStorage.setItem('mdlvis-display-overlays', JSON.stringify(next));
      return next;
    });
    if (panel === 'movement' && !selectedNodeIds.length && model.Nodes?.length) setSelectedNodeIds([model.Nodes[0].ObjectId]);
    setAnimationPanel(panel);
    await selectMode('animation');
  };

  const setWorkTool = next => {
    const movement = next === 'translate' ? 'move' : next;
    if (mode === 'uv') { uvAction('tool', movement); return; }
    if (rigWorkspace && (movementRestricted(movement, restrictions) || restPose && !['select','move'].includes(movement))) return;
    if(next!=='scale'||tool==='scale')clearZoomAnchor();
    if (mode === 'bones') setAttachSourceIds([]);
    setTool(next); setCameraMode('work');
    if (rigWorkspace) setMovementMode(movement);
  };
  const selectSequence = index => { if (portraitModeActive && !portraitSequenceIndices(model).includes(index)) return; setGlobalSeqId(null); setSequence(index); setTime(model.Sequences[index]?.Interval[0] || 0); };
  const selectTimeline = value => { if (portraitModeActive && String(value).startsWith('global:')) return; if (String(value).startsWith('global:')) { setGlobalSeqId(Number(value.split(':')[1])); setSequence(-1); setTime(0); } else selectSequence(Number(value)); };
  const showParticlePreview = value => changePreferences(previous => ({ ...previous, graphics: { ...previous.graphics, particles: value } }));
  const texturedModel = useMemo(() => uvPreviewModel(model, session.uvPreviews), [model, doc.revision, session.uvPreviews]);
  const previewModel = useMemo(() => {
    const result = uvPreviewModel(texturedModel, {}, liveUV);
    if (mode !== 'uv' || !uvSet || !result.Geosets[activeGeoset]?.TVertices?.[uvSet]) return result;
    const materialID = result.Geosets[activeGeoset].MaterialID, mapped = { ...result, Geosets: result.Geosets.slice() };
    for (const index of new Set([...Object.keys(uvEntrySelection).map(Number), activeGeoset])) {
      const g = result.Geosets[index]; if (!g || g.MaterialID !== materialID || !g.TVertices?.[uvSet]) continue;
      mapped.Geosets[index] = { ...g, TVertices: g.TVertices.map((value, i) => i === 0 ? g.TVertices[uvSet] : value) };
    }
    return mapped;
  }, [texturedModel, liveUV, mode, uvSet, activeGeoset, uvEntrySelection]);
  const hasUVPreview = Object.keys(session.uvPreviews).length > 0;
  const hasTrackDrafts = Object.keys(session.animationDrafts).length > 0;
  const hasPaintChanges = !!session.paintProject?.dirty;
  const nodeManagerLive = dialog?.type === 'resource' && dialog.kind === 'Nodes' && mode !== 'vertices';
  const previewSuspended = saving || (!!settingsTab && settingsTab !== 'visuals') || (!!dialog && !nodeManagerLive);
  const openLibrary = (preview = mode === 'uv') => setDialog({ type: 'library', preview, host: preview && uvWindowRef.current && !uvWindowRef.current.closed ? 'uv' : 'main', returnTo: dialog?.type === 'resource' ? dialog : null });
  const openParticles = id => { setPlaying(false); setDialog({type:'particles',nodeId:Number.isInteger(id)?id:selectedNodeIds.at(-1)}); };
  const inspectGeoset = index => { if(model.Geosets[index])setActiveGeoset(index); };
  const openNodeManager = () => setDialog({ type: 'resource', kind: 'Nodes' });
  const moveNodes = payload => {
    const change = {...payload, restPose, workplaneEnabled: payload.workplaneEnabled ?? workplaneEnabled, workplane, restrictions};
    if (movementRestricted(payload.mode || movementMode, restrictions)) return false;
    setPlaying(false); if (!restPose) setTime(payload.time ?? time);
    const result = edit(restPose ? 'Move rest-pose nodes' : 'Transform bones and nodes', restPose ? ['Nodes','PivotPoints'] : ['Nodes'], m => applyMovementTransform(m, payload.nodeIds || selectedNodeIds, Math.round(payload.time ?? time), payload.sequenceIndex ?? sequence, change));
    if (result !== false) liveMovementRevision.current = doc.revision;
    return result;
  };
  const chooseSets = next => { setSelectable(next); setSelection(previous => filterVertexSelection(previous, next, doc.model)); setActiveGeoset(previous => next.has(previous) ? previous : next.size ? next.values().next().value : -1); };
  const chooseSet = (index, event, checked) => { const shift = !!(event.shiftKey || event.nativeEvent?.shiftKey), ctrl = !!(event.ctrlKey || event.metaKey || event.nativeEvent?.ctrlKey); const next = chooseGeosets(selectable, index, { shift, ctrl, checked, anchor: rangeAnchor.current, count: model.Geosets.length }); chooseSets(next); if (next.has(index)) setActiveGeoset(index); setUvSet(0); if (!shift) rangeAnchor.current = index; };
  const selectAll = () => { if(mode==='uv')return uvAction('select-all'); if (mode === 'animation' || mode === 'bones') { setSelectedNodeIds(model.Nodes.filter(Boolean).map(node => node.ObjectId)); return; } const next = {}; for (const gi of selectable) { const invisible = new Set(hidden[gi] || []); next[gi] = Array.from({ length: model.Geosets[gi]?.Vertices.length / 3 || 0 }, (_, i) => i).filter(i => !invisible.has(i)); } setSelection(next); };
  const frame = selectionOnly => window.dispatchEvent(new CustomEvent('mdlvis-frame', { detail: { selection: !!selectionOnly } }));
  const isPreviewMode = cleanAnimationPreview || mode==='uv';
  const effectiveRenderMode = isPreviewMode ? (previewRenderModes[mode] || 'textured') : cleanView ? 'textured' : renderMode;
  const setViewRenderMode = next => {
    if (isPreviewMode) setPreviewRenderModes(previous=>({...previous,[mode]:next}));
    else { setRenderMode(next); setCleanViews(previous=>({...previous,[mode]:false})); }
  };
  const toggleTextured = () => { const next=effectiveRenderMode==='textured'?'wireframe':'textured';setViewRenderMode(next);if(!isPreviewMode && next==='textured')changeOverlay('wires',false); };
  const uvAction = (kind, value) => window.dispatchEvent(new CustomEvent('mdlvis-uv-action', { detail: { kind, value } }));

  function releaseUnusedTextureUrls() {
    const keep = new Set([...latest.current.session.assets.values(), ...(clipboard.current?.assets.values() || [])].map(asset=>asset.url));
    for(const url of textureUrls.current) if(!keep.has(url)) {URL.revokeObjectURL(url);textureUrls.current.delete(url);}
  }
  useEffect(() => { releaseUnusedTextureUrls(); },[session, session.assets]);
  useEffect(() => () => {for(const url of textureUrls.current)URL.revokeObjectURL(url);textureUrls.current.clear();},[]);
  const nextTextureResolution = target => {
    const generation = (textureResolutions.current.get(target) || 0) + 1;
    textureResolutions.current.set(target, generation); return generation;
  };
  async function loadTextures(records, target = session, { resolutionGeneration = null, source = 'manual' } = {}) {
    if (resolutionGeneration === null) nextTextureResolution(target);
    const current = () => resolutionGeneration === null || textureResolutions.current.get(target) === resolutionGeneration;
    if (!current()) return 0;
    // Replacing a configured Warcraft folder must also remove old native
    // bytes that the newly selected folder did not provide. User-loaded
    // texture files remain available as explicit overrides.
    const assets = source === 'gameData' ? new Map([...target.assets].filter(([, asset]) => asset.source !== 'gameData')) : new Map(target.assets);
    const createdUrls = []; let count = 0;
    const discard = () => { for (const url of createdUrls) { URL.revokeObjectURL(url); textureUrls.current.delete(url); } };
    for (const record of records || []) {
      try {
        if (!current()) { discard(); return 0; }
        const bytes = await readInputBytes(record), name = record.logicalName || record.texturePath || record.webkitRelativePath || record.name;
        if (!name) continue;
        const asset = { name, bytes, source: isForgeAssetPath(name) ? 'forge' : source }; const mime = /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.webp$/i.test(name) ? 'image/webp' : null;
        if (mime) { asset.url = URL.createObjectURL(new Blob([bytes], { type: mime })); textureUrls.current.add(asset.url); createdUrls.push(asset.url); }
        if (!current()) { discard(); return 0; }
        assets.set(normalize(name), asset); assets.set(normalize(name.split(/[\\/]/).at(-1)), asset); count++;
      } catch (error) { say(`${record.name || 'Texture'}: ${error.message}`, true); }
    }
    if (!current()) { discard(); return 0; }
    target.assets = assets; releaseUnusedTextureUrls(); if (latest.current.session.id === target.id) refresh(); return count;
  }
  async function resolveTextures(target = session) {
    if (!window.desktop?.resolveTextures) return;
    const generation = nextTextureResolution(target);
    try {
      // Keep referenced assets ready for final-model previews even when the
      // work viewport has texture display disabled. This is not library preload.
      const names = target.doc.model.Textures.map(texture => texture.Image).filter(Boolean);
      if (!names.length) return;
      const records = await window.desktop.resolveTextures({ path: target.path, names });
      if (textureResolutions.current.get(target) !== generation) return;
      await loadTextures(records, target, { resolutionGeneration: generation, source: 'gameData' });
    } catch (error) { say(error.message, true); }
  }
  async function checkpoint(target) {
    const envelope = { id: target.id, version: ++target.checkpoint, path: target.path, dirty: target.doc.dirty || Object.keys(target.uvPreviews).length > 0 || Object.keys(target.animationDrafts).length > 0 || !!target.paintProject?.dirty, date: new Date().toISOString(), state: target.doc.captureRecoveryState(), animationDrafts: structuredClone(target.animationDrafts), uvPreviews: structuredClone(target.uvPreviews), paintProject: target.paintProject ? structuredClone(target.paintProject) : null, paintOriginalModelBytes: target.paintOriginalModelBytes ? new Uint8Array(target.paintOriginalModelBytes) : null, paintWorkingModel: target.paintWorkingModel ? structuredClone(target.paintWorkingModel) : null, paintAppliedRevision: target.paintAppliedRevision, forgeAssets: retainedForgeAssets(target.assets) };
    if (window.desktop?.writeRecovery) await window.desktop.writeRecovery(envelope); else await browserRecovery('put', envelope);
  }
  function install(next) {
    setRepairReceipt(null); setPortraitEnabled(false);
    const history = settings.current; next.doc.configureHistory({ budgetBytes: history.historyBudgetBytes ?? 512 * 1024 * 1024, maxSteps: history.historyMaxSteps ?? 10000 });
    setSelectedNodeIds([]); setLiveUV(null);
    const citadelModel=next.doc.model.Textures.some(t=>/^MDLxL_Citadel[\\/]/i.test(t.Image||'')),initialGeosets=initialGeosetSelection(next.doc.model.Geosets.length);setCleanViews({}); setRenderMode(citadelModel?'textured':'wireframe');if(citadelModel)setShowAllGeosets(false);setSelectedNodeIds([]); setSession(next); setSelectable(initialGeosets); setSelection({}); setHidden({}); setActiveGeoset(initialGeosets.size?0:-1); setUvSet(0); setGlobalSeqId(null); setHighlightByPanel({ movement: false, animations: false }); setSequence(-1); setTime(0); setPlaying(false); setMode('vertices'); setDialog(null); rangeAnchor.current = 0; say(next.doc.readOnly ? 'Read-only model; original data retained.' : `Opened ${next.doc.name}`);
    // The boot effect resolves once after installing the initial model and settings.
    if (latest.current.preferencesReady) resolveTextures(next);
  }
  async function loadFile(record) {
    try {
      const bytes=await readInputBytes(record);
      if(/\.mdlxlpaint$/i.test(record.name)){
        const restored=await restorePaintProject(bytes,(png)=>decodePaintImage(png,'layer.png'));
        if(!restored.modelBytes)throw new Error('The paint project does not contain its working model.');
        const opened=openDocument(restored.originalModelBytes||restored.modelBytes,restored.modelName||record.name.replace(/\.mdlxlpaint$/i,'.mdl'));
        if(!opened.model||opened.version==null)throw new Error('The paint project contains no readable model. The current model was kept.');
        const next=newSession(opened,null);next.paintProject=restored.project;next.paintOriginalModelBytes=restored.originalModelBytes;next.paintWorkingModel=openDocument(restored.modelBytes,restored.modelName).model;if(next.paintProject.materialMode){repairPaintMaterials(next.paintProject,opened.model,next.paintWorkingModel);validatePaintAssignments(next.paintProject,next.paintWorkingModel);}install(next);
        if(restored.sourceTextures.length)await loadTextures(restored.sourceTextures,next,{source:'paint-project'});
        setRenderMode('textured');setView('perspective');setMode('paint');say(paintMessage('paint.projectOpened'));refresh();return;
      }
      const opened = openDocument(bytes, record.name); if (!opened.model || opened.version == null) throw new Error('This file has no readable model header. The current model was kept.'); install(newSession(opened, record.path || null));
    } catch (error) { say(error.message, true); }
  }
  function withUnsaved(operation) { if (savingRef.current) return; window.dispatchEvent(new CustomEvent('mdlxl-paint-flush')); if (doc.dirty || hasUVPreview || hasTrackDrafts || session.paintProject?.dirty) setDialog({ type: 'unsaved', operation }); else operation(); }
  async function showRecent() { try { setRecentFiles(await window.desktop.recent()); setDialog({type:'recent'}); } catch(error) { say(error.message,true); } }
  function openRecent(path) { if(repairReceipt)return; withUnsaved(async()=>{try{await loadFile(await window.desktop.openRecent(path));}catch(error){say(error.message,true);}}); }
  async function clearRecent() { try { setRecentFiles(await window.desktop.clearRecent()); say('Recent files history cleared.'); } catch(error) { say(error.message,true); } }
  function open() { withUnsaved(async () => { try { if (window.desktop) { const records = await window.desktop.open(); if (records?.length) await loadFile(records[0]); } else files.current.click(); } catch (error) { say(error.message, true); } }); }
  async function repairDuplicateAnimations(options) {
    if (savingRef.current) return;
    if (!window.desktop?.repairGeosetAnimations || !session.path) throw Error('Save a local MDL or MDX copy first; automatic backup and disk Undo require the desktop build.');
    if (hasUVPreview || hasTrackDrafts || session.paintProject) throw Error('Repair the original model in a separate model session before applying pending UV, animation-text or paint work. That work has not been discarded.');
    savingRef.current = true; setSaving(true);
    try {
      const staged = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ includeHistory: false }));
      const report = staged.apply('Repair duplicate geoset animations', ['GeosetAnims', 'Bones', 'Geosets', 'Info'], m => repairGeosetAnimations(m, options));
      const bytes = staged.serialize(doc.format), reopened = openDocument(bytes, doc.name);
      if (reopened.readOnly || scanGeosetAnimationDuplicates(reopened.model).length) throw Error('Repaired model failed reload verification. No file was changed.');
      await checkpoint(session);
      const result = await window.desktop.repairGeosetAnimations({ path: session.path, bytes, beforeBytes: doc.serialize(doc.format), expectedDiskBytes: doc.originalBytes });
      install(newSession(reopened, result.path, session.assets));
      setRepairReceipt({ ...result, bytes: undefined, report });
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function undoDuplicateRepair() {
    if (savingRef.current || !repairReceipt) return;
    savingRef.current = true; setSaving(true);
    try {
      const result = await window.desktop.undoGeosetRepair(repairReceipt.id);
      install(newSession(openDocument(result.bytes, result.name), result.path, session.assets));
      say('Repair undone. The pre-repair backup was restored; duplicate editing remains paused.');
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function save(saveAs = false, requestedFormat = session.doc.format) {
    if (savingRef.current) return false;
    if (hasTrackDrafts) { setAnimationPanel('animations'); selectMode('animation'); say('Press Bake Text in Animations to apply the edited track text before saving.'); return false; }
    savingRef.current = true; setSaving(true);
    const target = session;
    try {
      const pending = target.uvPreviews;
      const staged = Object.keys(pending).length ? EditorDocument.restoreRecoveryState(target.doc.captureRecoveryState({ includeHistory: false })) : target.doc;
      if (staged !== target.doc) staged.apply('Save UV texture previews', ['Geosets', 'Textures', 'Materials'], m => applyUVPreviews(m, pending));
      // Save As must bring reopened Forge textures along, even before preview
      // resolution completes or when texture rendering is disabled.
      const missing = missingForgeAssetPaths(target.assets, staged.model);
      if (missing.length && window.desktop?.resolveTextures) {
        const records = await window.desktop.resolveTextures({ path: target.path, names: missing });
        await loadTextures(records, target, { source: 'forge' });
      }
      if (missingForgeAssetPaths(target.assets, staged.model).length) throw Error('A Forge texture is missing. Load the model beside its MDLxL_Forge folder, or import the missing texture before saving.');
      const {format,bytes,name} = await prepareModelSaveAsync(staged,requestedFormat,target.doc.name);
      let savedName = name;
      if (window.desktop) { const result = await window.desktop.save({ bytes, name, path: target.path, format, saveAs:saveAs||format!==target.doc.format, forgeAssets:retainedForgeAssets(target.assets,staged.model) }); if (!result) return false; target.path = result.path; savedName = result.name; say(`Saved ${result.name}`); }
      else { const forgeAssets=retainedForgeAssets(target.assets,staged.model), blob=forgeAssets.length?forgeExportArchive(name,bytes,forgeAssets):new Blob([bytes]); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = forgeAssets.length?name.replace(/\.(mdl|mdx)$/i,'')+'.zip':name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); say(`Downloaded ${name}`); }
      if (staged !== target.doc) target.doc.apply('Save UV texture previews', ['Geosets', 'Textures', 'Materials'], m => applyUVPreviews(m, pending));
      // Keep the target document's semantic serialization snapshot. Re-parsing
      // a staged document's bytes can differ in harmless object key order and
      // incorrectly leave an otherwise identical saved texture list dirty.
      if (staged !== target.doc) target.doc.rememberSerializedSnapshot(bytes, staged.model);
      target.uvPreviews = {}; target.doc.markSaved(bytes, savedName);
      try { await rememberMotionSave(target, bytes, target.path, savedName); }
      catch (error) { say(`Model saved; Motion Inspector decisions could not follow this save: ${error.message}`, true); }
      try { await checkpoint(target); } catch (error) { say(`Saved; recovery checkpoint failed: ${error.message}`, true); }
      if (latest.current.session.id === target.id) refresh(); return !target.doc.dirty;
    } catch (error) { say(error.message, true); return false; }
    finally { savingRef.current = false; setSaving(false); }
  }
  const paintArtifactName = extension => `${doc.name.replace(/\.(?:mdl|mdx)$/i,'').replace(/[^a-z0-9_-]+/gi,'-') || 'model'}${extension}`;
  async function writePaintArtifact(blob, name) {
    if (window.desktop?.saveArtifact) return !!(await window.desktop.saveArtifact({name,bytes:new Uint8Array(await blob.arrayBuffer())}));
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
  }
  function paintDocument() {
    const staged=EditorDocument.restoreRecoveryState(doc.captureRecoveryState({includeHistory:false}));
    if(session.paintWorkingModel)staged.model=structuredClone(session.paintWorkingModel);
    return staged;
  }
  async function applyPaintToModel(){
    window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    const value=session.paintProject;if(!value)return true;
    if(savingRef.current||doc.readOnly)return false;
    savingRef.current=true;setSaving(true);
    try{
      repairPaintMaterials(value,paintOriginalModel,session.paintWorkingModel||doc.model);
      const prepared=await preparePaintModelCommit(session.paintWorkingModel||doc.model,value,paintOriginalModel);
      const assets=new Map(session.assets);
      for(const asset of prepared.assets){if(!asset.bytes?.byteLength)throw Error('A painted texture is empty.');assets.set(normalize(asset.name),asset);assets.set(normalize(asset.name.split(/[\\/]/).at(-1)),asset);}
      commitPaintModel(doc,prepared);
      nextTextureResolution(session);session.assets=assets;adoptCommittedPaintUVs(value);
      session.paintWorkingModel=structuredClone(doc.model);session.paintWorkingRevision++;
      session.paintAppliedRevision=value.revision;refresh();
      say('Paint applied to the model. Save the model to keep its BLP textures beside it.');return true;
    }catch(error){say('Could not apply paint: '+error.message,true);return false;}
    finally{savingRef.current=false;setSaving(false);}
  }
  async function savePaintProject(value=session.paintProject) {
    window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    if(!value||savingRef.current)return false;savingRef.current=true;setSaving(true);
    try{const artifact=await buildPaintProjectArtifact(paintDocument(),value,session.assets,session.paintOriginalModelBytes||doc.originalBytes);if(!await writePaintArtifact(artifact,paintArtifactName('.mdlxlpaint')))return false;markPaintProjectSaved(value);refresh();say(paintMessage('paint.projectSaved'));return true;}
    catch(error){say(error.message,true);return false;}finally{savingRef.current=false;setSaving(false);}
  }
  async function exportPaintProject(value=session.paintProject) {
    window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    if(!value||savingRef.current)return false;savingRef.current=true;setSaving(true);
    try{const result=await buildPaintExportArtifact(paintDocument(),value,session.assets,session.paintOriginalModelBytes||doc.originalBytes);if(!await writePaintArtifact(result.archive,paintArtifactName('-warcraft.zip')))return false;markPaintProjectSaved(value);refresh();say(paintMessage('paint.packageSaved'));return true;}
    catch(error){say(error.message,true);return false;}finally{savingRef.current=false;setSaving(false);}
  }
  async function ensurePaintTarget(geosetIndex) {
    const working=session.paintWorkingModel ||= structuredClone(model);
    const existing=paintTargetsForGeoset(enumeratePaintTargets(working),geosetIndex);
    if(existing.length)return enumeratePaintTargets(working);
    const base=doc.name.replace(/\.(?:mdl|mdx)$/i,'').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase()||'model';
    const used=new Set(working.Textures.map(texture=>normalize(texture.Image)));let number=1,imagePath;
    do{imagePath='CitadelPaint/'+base+'_texture_'+(number++)+'.blp';}while(used.has(normalize(imagePath)));
    installFreshPaintLayer(working,geosetIndex,imagePath);session.paintWorkingRevision++;refresh();
    return enumeratePaintTargets(working);
  }
  async function addTexture(asset) {
    if (savingRef.current || doc.readOnly) return;
    if (model.Textures.some(texture => normalize(texture.Image) === normalize(asset.name))) { await loadTextures([asset], session, { source: 'library' }); say('This texture is already in the model.'); return; }
    const result = edit('Add library texture', ['Textures'], m => addLibraryTexture(m, asset));
    if (result !== false) { await loadTextures([asset], session, { source: 'library' }); say(`Added ${asset.name} to the model.`); }
  }
  async function previewTexture(asset) {
    if (savingRef.current || doc.readOnly) return;
    try {
      session.uvPreviews = beginUVPreview(model, session.uvPreviews, mode==='uv'?[activeGeoset]:[...selectable], asset, null);
      await loadTextures([asset], session, { source: 'library' });
      setDialog(null); selectMode('uv'); refresh();
      say('Temporary texture loaded. Save keeps it; Revert restores the earlier UV layout.');
    } catch (error) { say(error.message, true); }
  }
  function finishUVPreview(revert = false) {
    if (revert) {
      try {
        const pending = Object.values(session.uvPreviews);
        for (const draft of pending) validateUVPreview(model, draft);
        if (pending.every(draft => draft.originalUV.every((uv, i) => uv.length === model.Geosets[draft.geosetIndex].TVertices[i]?.length && uv.every((value, n) => value === model.Geosets[draft.geosetIndex].TVertices[i][n])))) {
          session.uvPreviews = {}; setLiveUV(null); refresh(); say('Reverted temporary textures.'); return;
        }
      } catch (error) { say(error.message, true); return; }
    }
    const result = edit(revert ? 'Revert UV texture previews' : 'Save UV texture previews', revert ? ['Geosets'] : ['Geosets','Textures','Materials'], m => revert ? revertUVPreviews(m, session.uvPreviews) : applyUVPreviews(m, session.uvPreviews));
    if (result !== false) { session.uvPreviews = {}; setLiveUV(null); refresh(); }
  }
  const importTextures = async () => { try { if (window.desktop) say(`Loaded ${await loadTextures(await window.desktop.textures())} textures.`); else textures.current.click(); } catch (error) { say(error.message, true); } };
  const textureFolder = async () => { try { if (window.desktop) say(`Loaded ${await loadTextures(await window.desktop.textureFolder(model.Textures.map(t => t.Image)))} textures.`); else folder.current.click(); } catch (error) { say(error.message, true); } };
  const undo = redo => {
    if (savingRef.current) return;
    try {
      if(mode==='paint'){
        window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
        const entry=session.paintProject&&travelPaintHistory(session.paintProject,redo);if(!entry){say(paintMessage(redo?'paint.redoEmpty':'paint.undoEmpty'));return;}
        refresh();say(redo?paintMessage('paint.redo'):paintMessage('paint.undo'));return;
      }
      const guard = captureUVPreviewGuard(doc.model, session.uvPreviews);
      let validBefore = true; try { validateUVPreviewGuard(doc.model, session.uvPreviews); } catch { validBefore = false; }
      const restored = selectionHistory.travel(redo ? 'redo' : 'undo', selectionState);
      if (!restored) return;
      // A cached older document may already have mismatched geometry. Permit
      // travelling back through that history so it can be repaired by Undo.
      if (validBefore) {
        try { validateUVPreviewGuard(doc.model, session.uvPreviews, guard); }
        catch { selectionHistory.travel(redo ? 'undo' : 'redo', restored); refresh(); say('Save or Revert temporary UV textures before undoing a geometry structure change.'); return; }
      }
      setSelection(restored.selection); setHidden(restored.hidden); setSelectable(restored.selectable); setActiveGeoset(restored.activeGeoset); setUvSet(restored.uvSet); if(restored.selectedNodeIds)setSelectedNodeIds(restored.selectedNodeIds); setLiveUV(null); refresh(); say(redo ? 'Redo' : 'Undo');
    } catch (error) { refresh(); say(error.message, true); }
  };
  const transform = payload => { if (restPose) { if (restrictions.translation && payload.translation?.some(value=>value!==0) || restrictions.rotation && payload.rotation?.some(value=>value!==0) || restrictions.scaling && payload.scale?.some(value=>value!==1)) return false; if(payload.translation)payload={...payload,translation:constrainMovementVector(payload.translation,{workplaneEnabled,workplane})}; } const picked = payload.selections || validSelection; const result = edit('Transform vertices', ['Geosets'], m => { for (const [gi, ids] of Object.entries(picked)) if (ids.length) transformVertices(m.Geosets[gi], ids, payload.translation || [0, 0, 0], payload.scale || [1, 1, 1], payload.rotation || [0, 0, 0], payload.pivot || centroid, {allowSingularScale:payload.allowSingularScale===true}); }); return result; };
  function meshAction(name) {
    if (!editable || !selectionCount) return;
    if (mode === 'uv') {
      if (name === 'Mirror') uvAction('flip-u');
      if (name === 'Collapse') uvAction('collapse');
      if (name === 'Uncouple') uvAction('uncouple');
      return;
    }
    const updated = {}, removedGeosets = [], axis = (lockedVertexPlane || workplane) === 'xy' ? 2 : (lockedVertexPlane || workplane) === 'yz' ? 0 : 1;
    const result = edit(name, ['Geosets', 'GeosetAnims', 'Nodes'], m => {
      for (const [key, ids] of Object.entries(validSelection).sort((a, b) => Number(b[0]) - Number(a[0]))) {
        if (!ids.length) continue; const gi = Number(key), g = m.Geosets[gi]; let outcome;
        if (name === 'Delete vertices') { if (ids.length === g.Vertices.length / 3) { deleteGeoset(m, gi); removedGeosets.push(gi); } else deleteVertices(g, ids); }
        else if (name === 'Create triangle') addTriangle(g, ids);
        else if (name === 'Delete triangles') outcome = deleteSelectedFaces(g, ids);
        else if (name === 'Uncouple') outcome = uncoupleVertices(g, ids);
        else if (name === 'Collapse') outcome = collapseVertices(g, ids, centroid);
        else if (name === 'Weld') outcome = weldSelectedVertices(g, ids, centroid);
        else if (name === 'Smooth normals') outcome = averageSelectedNormals(g, ids);
        else if (name === 'Restore normals') recalculateNormals(g);
        else if (name === 'Mirror') { const scale = [1, 1, 1]; scale[axis] = -1; transformVertices(g, ids, [0, 0, 0], scale, [0, 0, 0], centroid); }
        else if (name === 'Extrude') { const delta = [0, 0, 0]; delta[axis] = 10; outcome = { selection: extrudeFaces(g, ids, delta) }; }
        else if (name === 'Detach') { const added = detachFaces(m, gi, ids); updated[added] = Array.from({ length: m.Geosets[added].Vertices.length / 3 }, (_, i) => i); }
        else if (name === 'Reverse normals') { const picked = new Set(ids); for (const id of ids) { for (let a = 0; a < 3; a++) g.Normals[id * 3 + a] *= -1; if (g.Tangents) g.Tangents[id * 4 + 3] *= -1; } for (let i = 0; i < g.Faces.length; i += 3) if ([0, 1, 2].every(a => picked.has(g.Faces[i + a]))) [g.Faces[i + 1], g.Faces[i + 2]] = [g.Faces[i + 2], g.Faces[i + 1]]; }
        else if (name === 'Rotate normals') { const a = (axis + 1) % 3, b = (axis + 2) % 3, angle = normalAngle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle); for (const id of ids) for (const [array, stride] of [[g.Normals, 3], [g.Tangents, 4]]) if (array?.length) { const x = array[id * stride + a], y = array[id * stride + b]; array[id * stride + a] = x * c - y * s; array[id * stride + b] = x * s + y * c; } }
        if (outcome?.selection) updated[gi] = outcome.selection;
      }
    });
    if (result !== false) { if (name !== 'Uncouple') setHidden({}); if (name === 'Delete vertices') {
      const remap = index => index - removedGeosets.filter(removed => removed < index).length;
      const next = new Set([...selectable].filter(index => !removedGeosets.includes(index)).map(remap));
      setSelection({}); setSelectable(next); setActiveGeoset(removedGeosets.includes(activeGeoset) ? next.values().next().value ?? -1 : remap(activeGeoset));
    } else if (Object.keys(updated).length) { setSelection(updated); setSelectable(previous => new Set([...previous, ...Object.keys(updated).map(Number)])); setActiveGeoset(Number(Object.keys(updated)[0])); } if (name === 'Extrude') setWorkTool('translate'); }
  }
  function copy() {
    if (mode === 'animation') return timelineCommands.current.copy?.();
    const captured = captureMeshSelection(model, validSelection, selectable);
    if (!captured.indices.length) { say('Select vertices, triangles or geosets to copy.'); return; }
    clipboard.current = { ...captured, sourceDocument: doc, assets: new Map(session.assets) };
    say(`Copied ${captured.vertexCount} vertices and ${captured.triangleCount} triangles.`); refresh();
  }
  function paste(parent) {
    if (mode === 'animation') return timelineCommands.current.paste?.();
    if (!clipboard.current || doc.readOnly) return;
    const source = clipboard.current, result = edit('Paste geosets', ['Geosets', 'Materials', 'Textures', 'Nodes', 'PivotPoints', 'GeosetAnims', 'GlobalSequences', 'TextureAnims'], m => importGeosets(m, source.model, source.indices, parent, { sameModel: source.sourceDocument === doc, targetGeoset: activeGeoset }));
    if (result !== false) { session.assets = new Map([...source.assets, ...session.assets]); setSelectable(new Set(result.geosetIndices)); setSelection(result.selection || Object.fromEntries(result.geosetIndices.map(gi => [gi, Array.from({ length: doc.model.Geosets[gi].Vertices.length / 3 }, (_, i) => i)]))); setActiveGeoset(result.geosetIndices[0] ?? 0); setDialog(null); say(result.warnings?.join(' ') || 'Pasted geosets.'); refresh(); }
  }
  const hide = () => { setHidden(previous => { const next = { ...previous }; for (const [gi, ids] of Object.entries(validSelection)) next[gi] = [...new Set([...(next[gi] || []), ...ids])]; return next; }); setSelection({}); };
  async function listRecovery() { try { const items = window.desktop?.listRecovery ? await window.desktop.listRecovery() : await browserRecovery('list'); setRecoveries((items || []).map(({ state, ...item }) => ({ ...item, name: item.name || state?.name }))); setDialog({ type: 'recovery' }); } catch (error) { say(error.message, true); } }
  async function restoreRecovery(item) { withUnsaved(async () => { try { const envelope = window.desktop?.readRecovery ? await window.desktop.readRecovery(item.id) : await browserRecovery('get', item.id), restored = newSession(EditorDocument.restoreRecoveryState(envelope.state || envelope), envelope.path || null); restored.id = envelope.id || restored.id; restored.checkpoint = envelope.version || 0; restored.animationDrafts = envelope.animationDrafts || {}; restored.paintProject = envelope.paintProject || null; restored.paintOriginalModelBytes = envelope.paintOriginalModelBytes || null; restored.paintWorkingModel = envelope.paintWorkingModel || null;restored.paintAppliedRevision=envelope.paintAppliedRevision;if(restored.paintProject?.materialMode){const original=restored.paintOriginalModelBytes?openDocument(restored.paintOriginalModelBytes,restored.doc.name).model:restored.doc.model;repairPaintMaterials(restored.paintProject,original,restored.paintWorkingModel||restored.doc.model);validatePaintAssignments(restored.paintProject,restored.paintWorkingModel||restored.doc.model);} for(const asset of envelope.forgeAssets||[]){const record={...asset,source:'forge'};restored.assets.set(normalize(asset.name),record);restored.assets.set(normalize(asset.name.split(/[\\/]/).at(-1)),record);} restored.uvPreviews = restoreUVPreviews(restored.doc.model, envelope.uvPreviews); for (const draft of Object.values(restored.uvPreviews)) { restored.assets.set(normalize(draft.asset.name), draft.asset); restored.assets.set(normalize(draft.asset.name.split(/[\\/]/).at(-1)), draft.asset); } install(restored); say(`Recovered ${restored.doc.name} with undo history${restored.paintProject ? ' and paint coats' : ''}.`); } catch (error) { say(error.message, true); } }); }
  async function gameData() {
    if (!window.desktop?.chooseGameData) { say('Choose a Warcraft III installation folder in the desktop application.'); return; }
    try {
      const next = await window.desktop.chooseGameData();
      if (!next) return;
      settings.current = next;
      setGameDataPath(next.gameData || '');
      await resolveTextures();
      say(next.gameData ? 'Warcraft III installation saved. Native textures will now load automatically.' : 'Warcraft III installation was not changed.');
    } catch (error) { say(error.message, true); }
  }
  async function clearGameData() {
    if (!window.desktop?.clearGameData) return;
    try {
      const next = await window.desktop.clearGameData();
      settings.current = next || settings.current;
      setGameDataPath('');
      await resolveTextures();
      say('Saved Warcraft III installation folder removed.');
    } catch (error) { say(error.message, true); }
  }
  function showHistory() { setHistoryMB(Math.round(doc.historyStats.budgetBytes / 1048576)); setHistorySteps(doc.historyStats.maxSteps); setDialog({ type: 'history' }); }
  async function forgeItem({mesh,asset,texturePath,trimColor}) {
    const result=edit('Forge item',['Geosets','Materials','Textures','Nodes','PivotPoints','GeosetAnims','Info'],m=>commitForge(m,mesh,{texturePath,trimColor}));
    if(result===false)return false;
    await loadTextures([{...asset,name:texturePath}],session,{source:asset.source==='forge'?'forge':'library'});
    if(result.extraAssets?.length) await loadTextures(result.extraAssets,session,{source:'forge'});
    if(mesh.geosets.length>1){const white={name:'Textures\\white.blp',bytes:new Uint8Array([0,0,2,0,0,0,0,0,0,0,0,0,1,0,1,0,32,40,255,255,255,255]),source:'forge-preview'};session.assets.set(normalize('Textures\\white.blp'),{...white,name:'white.tga'});}
    setSelectable(new Set(result.geosetIndices));setSelection(Object.fromEntries(result.geosetIndices.map(i=>[i,Array.from({length:doc.model.Geosets[i].Vertices.length/3},(_,v)=>v)])));setActiveGeoset(result.geosetIndices[0]);setSelectedNodeIds([result.boneId]);selectMode('vertices');setRenderMode('textured');setDialog(null);requestAnimationFrame(()=>frame(false));
    say('Forge item created and attached to DummyBone.');return result;
  }
  async function importPart({source,rgb,texturePaths,assets}) {
    if(latest.current.session!==session || savingRef.current)return false;
    const target=session;
    const result=edit('Import BitsAndParts',['Geosets','Materials','Textures','TextureAnims','GlobalSequences','Nodes','PivotPoints','GeosetAnims','Info'],m=>commitPart(m,source,{rgb,texturePaths}),{rethrow:true});
    if(result===false)return false;
    await loadTextures(assets,target,{source:'forge'});
    if(latest.current.session!==target)return result;
    setSelectable(new Set(result.geosetIndices));setSelection(Object.fromEntries(result.geosetIndices.map(i=>[i,Array.from({length:doc.model.Geosets[i].Vertices.length/3},(_,v)=>v)])));setActiveGeoset(result.geosetIndices[0]);setSelectedNodeIds([result.boneId]);selectMode('vertices');setRenderMode('textured');setDialog(null);requestAnimationFrame(()=>frame(false));
    say('Part imported and attached to DummyBone.');return result;
  }
  commands.current = { 'paint:select':()=>window.dispatchEvent(new CustomEvent('mdlxl-paint-tool',{detail:'select'})), 'paint:draw':()=>window.dispatchEvent(new CustomEvent('mdlxl-paint-tool',{detail:'draw'})), open, recent:showRecent, openRecent, clearRecent, save: () => mode==='paint'?savePaintProject():save(), saveAs: () => mode==='paint'?savePaintProject():setDialog({type:'saveFormat'}), new: () => withUnsaved(() => install(newSession(createStarterDocument(preferences.newModelVersion)))), recovery: listRecovery, gameData, undo: () => undo(false), redo: () => undo(true), copy, paste: () => paste(), pasteSpecial: () => { if (clipboard.current) { setAnchor(''); setDialog({ type: 'pasteSpecial' }); } }, selectAll, clear: () => { if (mode === 'bones' && attachSourceIds.length) { setAttachSourceIds([]); return; } if (mode === 'vertices' && quadView && !window.dispatchEvent(new Event('mdlxl-cancel-gesture', { cancelable: true }))) return; if(mode==='uv')return uvAction('select-none');setSelectedNodeIds([]); setSelection({}); }, history: showHistory, grid: () => setShowGrid(v => !v), frame: toggleTextured, frameSelection: () => setViewRenderMode('solid'), fit: () => frame(false), fitSelection: () => frame(true), vertices: () => selectMode('vertices'), bones: () => {setMovementMode('select');selectMode('bones');}, uv: () => selectMode('uv'), paint: () => {setRenderMode('textured');setView('perspective');selectMode('paint');}, animation: () => selectAnimationPanel('movement'), animations: () => selectAnimationPanel('animations'), textureLibrary: () => openLibrary(), help: () => setDialog({ type: 'help' }), diagnostics: () => setDialog({ type: 'diagnostics' }), about: () => setDialog({ type: 'about' }), ...Object.fromEntries(resources.map(kind => [kind, () => setDialog({ type: 'resource', kind })])), ...Object.fromEntries(views.map(name => [name, () => setView(name)])) };
  Object.assign(commands.current, {
    forge:()=>setDialog({type:'forge'}), optimizeModel:()=>setDialog({type:'optimizeModel'}), bitsAndParts:()=>setDialog({type:'bitsAndParts'}), particles:()=>openParticles(),
    ...Object.fromEntries(SHAPE_TOOLS.map(tool=>['shape:'+tool.toLowerCase(),()=>setDialog({type:'shape',tool})])),
    ...Object.fromEntries(['set','copy','paste','copyPose','delete','clear','selectAll','previous','next'].map(id=>['keyframe:'+id,()=>timelineCommands.current[id]?.()])),
    exit: () => window.desktop?.close?.(), settings: () => setSettingsTab('mouse'), warmkeys: () => setSettingsTab('warmkeys'), graphics: () => setSettingsTab('graphics'), appearanceSettings: () => setSettingsTab('visuals'), configurationSettings: () => setSettingsTab('configuration'), gridSettings: () => setSettingsTab('grid'), gameDataSettings: () => setSettingsTab('gameData'),
    pressedKeys: () => changePreferences(previous=>({...previous,showPressedKeys:!previous.showPressedKeys})), captureSettings:()=>setSettingsTab('capture'),
    importTextures, textureFolder, hide, show: () => setHidden({}),
    cameraToggle: toggleCamera,
    'wheel:scroll': () => toggleWheelMode('scroll'), 'wheel:pointer': () => toggleWheelMode('pointer'), 'wheel:rotate': () => changePreferences(previous => ({ ...previous, wheelMode: 'rotate' })),
    pointerUp: () => changePointerSensitivity(preferencesRef.current.pointerSensitivity * 1.15), pointerDown: () => changePointerSensitivity(preferencesRef.current.pointerSensitivity / 1.15),
    'game-data-rescan': async () => { if (!window.desktop?.rescanGameData) { say('Choose a Warcraft III installation folder in the desktop application.'); return; } try { say('Refreshing Warcraft III texture locations…'); const found = await window.desktop.rescanGameData(); settings.current.gameDataDiscovery = found; await resolveTextures(); say(`Warcraft III texture locations refreshed: ${found.archives?.length || 0} archives available.`); } catch (error) { say(error.message, true); } },
    'grid:small': () => changePreferences(previous=>({...previous,grid:{...previous.grid,small:!previous.grid.small}})),
    ...Object.fromEntries(['xz','yz','xy'].map(plane=>['grid:'+plane,()=>{setShowGrid(true);changePreferences(previous=>({...previous,grid:{...previous.grid,planes:{...previous.grid.planes,[plane]:!previous.grid.planes[plane]}}}));}])),
    axes: () => changePreferences(previous=>{const visible=Object.values(previous.grid.axes).some(Boolean);return {...previous,grid:{...previous.grid,axes:{x:!visible,y:!visible,z:!visible}}};}),
    wireframe: () => setViewRenderMode('wireframe'),
    workplaneEnabled: () => setWorkplaneEnabled(value=>!value),
    normals: () => changeOverlay('normals', value => !value), shaded: () => setShaded(v => !v), showVertices: () => setShowVertices(v => !v), showAllGeosets: () => setShowAllGeosets(v => !v),
    ...Object.fromEntries(['bones','wires','nodes','attachments','particles','cameras'].map(key=>[`display:${key}`,()=>changeOverlay(key,value=>!value)])),
    showParticles: () => showParticlePreview(!preferencesRef.current.graphics.particles),
    cleanView: () => setCleanViews(previous => ({...previous,[mode]:!previous[mode]})),
    geosetsAll: () => chooseSets(allGeosets(model.Geosets.length)), geosetsClear: () => chooseSets(new Set()), geosetsInvert: () => chooseSets(invertGeosets(selectable, model.Geosets.length)),
    invertSelection: () => { if(mode==='uv')return uvAction('select-invert'); const next={}; for(const gi of selectable) { const exclude=new Set([...(validSelection[gi]||[]),...(hidden[gi]||[])]); next[gi]=Array.from({length:model.Geosets[gi]?.Vertices.length/3||0},(_,i)=>i).filter(i=>!exclude.has(i)); } setSelection(next); },
    nextGeoset: () => chooseSets(new Set([(activeGeoset+1)%model.Geosets.length])), previousGeoset: () => chooseSets(new Set([(activeGeoset+model.Geosets.length-1)%model.Geosets.length])),
    nextUV: () => setUvSet(v => (v+1)%(geoset?.TVertices.length||1)),
    convertVersion: () => { if (hasUVPreview || hasTrackDrafts) { say('Apply or revert pending previews before conversion.',true); return; } try { const target=model.Version===800?1000:800; doc.convertVersion(target); refresh(); say('Converted to MDX'+target+'. Undo is available; Save writes the result.'); } catch(error) { refresh(); say(error.message,true); } },
    normalRotate: () => setDialog({type:'normalRotate'}),
    anchorSelect: () => { setChoosingZoomAnchor(true); say('Drag a selection box over one selected vertex.'); },
    play: () => setPlaying(v => !v),
    nextSequence: () => { const ids = portraitModeActive ? portraitSequenceIndices(model) : model.Sequences.map((_, i) => i); if (ids.length) selectSequence(ids[(ids.indexOf(sequence) + 1) % ids.length]); },
    previousSequence: () => { const ids = portraitModeActive ? portraitSequenceIndices(model) : model.Sequences.map((_, i) => i); if (ids.length) selectSequence(ids[(ids.indexOf(sequence) + ids.length - 1) % ids.length]); },
    firstFrame: () => {setPlaying(false);setTime(animationDomain.start);}, lastFrame: () => {setPlaying(false);setTime(animationDomain.end);},
    nextFrame: () => {setPlaying(false);setTime(v=>Math.min(animationDomain.end,Math.round(v)+1));}, previousFrame: () => {setPlaying(false);setTime(v=>Math.max(animationDomain.start,Math.round(v)-1));},
    sensitivityUp: () => changeSensitivity(preferencesRef.current.scrollSensitivity*1.15), sensitivityDown: () => changeSensitivity(preferencesRef.current.scrollSensitivity/1.15),
    ...Object.fromEntries(['work','zoom','rotate','move'].map(v=>['camera:'+v,()=>setCameraMode(v)])),
    ...Object.fromEntries(['select','translate','rotate','scale'].map(v=>[v,()=>mode === 'bones' && v === 'rotate' ? bindSelectedVertices('hard') : setWorkTool(v)])),
    ...Object.fromEntries(['xy','xz','yz'].map(v=>['plane:'+v,()=>setWorkplane(v)])),
    ...Object.fromEntries(['Delete vertices','Create triangle','Delete triangles','Uncouple','Collapse','Weld','Mirror','Extrude','Detach','Reverse normals','Smooth normals','Restore normals'].map(v=>[v,()=>mode === 'bones' && v === 'Delete vertices' ? deleteSelectedNode() : mode === 'bones' && v === 'Create triangle' ? beginAttach() : mode === 'bones' && v === 'Collapse' ? bindSelectedVertices('soft') : mode==='animation' && v==='Collapse' ? timelineCommands.current.copyPose?.() : mode==='animation' && v==='Delete vertices' ? timelineCommands.current.delete?.() : meshAction(v)])),
    'bone:detach': detachSelectedNode,
    'bone:detachVertices': () => bindSelectedVertices('detach'),
    ...Object.fromEntries(['flip-u','flip-v','rotate','fold','select-connected','select-invert'].map(v=>['uv:'+v,()=>uvAction(v)])),
  });
  function commandEnabled(id) {
    if (repairBlocked) return !saving && (id === 'exit' || !repairReceipt && ['open', 'save', 'saveAs'].includes(id));
    if(cleanAnimationPreview && previewBlockedCommands.has(id))return false;
    if(id==='paint')return !doc.readOnly&&!saving&&model.Version===800;
    if(id.startsWith('paint:'))return mode==='paint'&&!doc.readOnly&&!saving;
    if(id==='optimizeModel')return !doc.readOnly&&!saving&&!liveUV&&!Object.keys(session.uvPreviews).length;
    if (mode === 'bones') {
      if (id === 'Delete vertices') return editable && !!singleRigNode;
      if (id === 'Create triangle') return editable && selectedRigNodes.length > 0 && (multipleNodes || selectedRigNodes.length === 1);
      if (id === 'Collapse' || id === 'rotate' || id === 'bone:detachVertices') return editable && !!selectedBone && selectionCount > 0;
      if (id === 'bone:detach') return editable && parentedRigNodes.length > 0 && (multipleNodes || selectedRigNodes.length === 1);
      if (['scale', 'Delete triangles', 'Uncouple', 'Weld', 'Mirror', 'Extrude', 'Detach', 'Reverse normals', 'Smooth normals', 'Restore normals'].includes(id)) return false;
    } else if (id.startsWith('bone:')) return false;
    if (id==='uv') return Object.entries(validSelection).some(([index,ids])=>ids.length && model.Geosets[index]?.TVertices?.length);
    if (id==='anchorSelect') return editable && mode === 'vertices' && tool === 'scale' && selectionCount > 1;
    if (rigWorkspace && ['select','translate','rotate','scale'].includes(id)) return !movementRestricted(id === 'translate' ? 'move' : id, restrictions) && (!restPose || ['select','translate'].includes(id));
    if (id==='exit') return !!window.desktop;
    if (['undo','redo'].includes(id)) return mode==='paint' ? !!session.paintProject?.history?.[id==='undo'?'undo':'redo']?.length : id==='undo'?doc.canUndo:doc.canRedo;
    if (mode === 'animation' && ['Collapse','Delete vertices'].includes(id)) return !doc.readOnly && !saving;
    if(['forge','bitsAndParts','particles','GeosetAnims','convertVersion'].includes(id))return !doc.readOnly&&!saving;
    if(id.startsWith('shape:'))return !doc.readOnly&&!saving&&selectable.size>0;
    if(id.startsWith('keyframe:'))return ['animation','uv'].includes(mode)&&!doc.readOnly&&!saving;
    if(id==='paste'&&mode==='animation')return !doc.readOnly&&!saving;
    if (['paste','pasteSpecial'].includes(id)) return !!clipboard.current && !doc.readOnly && mode!=='animation';
    if (id==='copy') return mode==='animation'||selectable.size>0;
    if (id==='hide') return selectionCount>0;
    if (id==='show') return hiddenCount>0;
    if (['play','firstFrame','lastFrame','nextFrame','previousFrame'].includes(id)) return (mode==='animation' || mode==='uv' && sequence>=0);
    if (['nextSequence','previousSequence'].includes(id)) return (mode==='animation' || mode==='uv') && model.Sequences.length>0;
    if (['nextGeoset','previousGeoset'].includes(id)) return model.Geosets.length>0;
    if (id.startsWith('uv:')) return mode==='uv' && !doc.readOnly;
    if (id==='nextUV') return mode==='uv' && !!geoset;
    if (['normalRotate','Delete vertices','Create triangle','Delete triangles','Uncouple','Collapse','Weld','Mirror','Extrude','Detach','Reverse normals','Smooth normals','Restore normals'].includes(id)) {
      if(!editable || !selectionCount || (mode==='uv' && !['Mirror','Uncouple','Collapse'].includes(id))) return false;
      if(['Collapse','Weld'].includes(id)) return selectionCount>=2;
      if(['Extrude','Detach','Delete triangles'].includes(id)) return selectedFaces>0;
      if(id==='Create triangle') return selectionCount===3 && Object.values(validSelection).filter(ids=>ids.length).length===1;
    }
    return true;
  }
  // Playback time changes do not change available commands or shortcut bindings.
  const settingsCommands = ['settings','warmkeys','graphics','captureSettings','appearanceSettings','configurationSettings','gridSettings','gameDataSettings'];
  const commandCatalog = useMemo(() => COMMANDS.map(command => ({...command,scope:['undo','redo'].includes(command.id)?'global':command.scope,label: mode === 'bones' ? ({ rotate: 'Hard Bind', 'Delete vertices': 'Delete object', 'Create triangle': 'Attach', Collapse: 'Soft Bind' }[command.id] || command.label) : command.label,allowInModal:settingsCommands.includes(command.id),enabled:commandEnabled(command.id)})), [doc, doc.revision, doc.historyStats.undoSteps, doc.historyStats.redoSteps, mode, tool, sequence, validSelection, selectable, hiddenCount, selectionCount, selectedNodeIds, singleRigNode, selectedBone, parentBone, multipleNodes, selectedFaces, geoset, clipboard.current, restrictions, restPose, rigWorkspace, cleanAnimationPreview, saving, repairBlocked, repairReceipt, session.paintProject?.revision]);
  const runCommand = id => { if(commandEnabled(id)) { if(repairBlocked && id==='saveAs') save(true); else commands.current[id]?.(); } };
  const runLatest = useRef(runCommand); runLatest.current = runCommand;


  const editorMenuChecks = {'display:bones':overlays.bones,'display:wires':overlays.wires,'display:nodes':overlays.nodes,'display:attachments':overlays.attachments,'display:particles':overlays.particles,showVertices:overlays.vertices,grid:overlays.grid,'display:cameras':overlays.cameras,normals:overlays.normals,showParticles:preferences.graphics.particles,cleanView,'grid:small':preferences.grid.small,'grid:xz':showGrid&&preferences.grid.planes.xz,'grid:yz':showGrid&&preferences.grid.planes.yz,'grid:xy':showGrid&&preferences.grid.planes.xy,axes:Object.values(preferences.grid.axes).some(Boolean),frameSelection:effectiveRenderMode==='solid',frame:effectiveRenderMode==='textured'};
  const menuChecks=cleanAnimationPreview?{...Object.fromEntries(Object.keys(editorMenuChecks).map(id=>[id,false])),frame:effectiveRenderMode==='textured',frameSelection:effectiveRenderMode==='solid'}:editorMenuChecks;
  useEffect(()=>{window.desktop?.setMenuState?.({readOnly:doc.readOnly,saving,preview:cleanAnimationPreview,checks:menuChecks,uvEnabled:commandEnabled('uv')});},[doc.readOnly,saving,cleanAnimationPreview,JSON.stringify(menuChecks),selectionCount,activeGeoset]);
  useEffect(() => window.desktop?.onMenu(action => { if (action?.action === 'openRecent') { if (!latest.current.dialog && !latest.current.settingsTab) commands.current.openRecent(action.path); return; } if(['exit',...settingsCommands].includes(action) || (!latest.current.dialog && !latest.current.settingsTab)) runLatest.current(action); }), []);
  useEffect(() => { const boot = session.id; window.desktop?.initial?.().then(async initial => { settings.current = initial.settings || {}; setGameDataPath(settings.current.gameData || ''); const persisted=normalizePreferences(settings.current.preferences || preferencesRef.current); savedPreferences.current=JSON.stringify(persisted); changePreferences(persisted); const current = latest.current.session; current.doc.configureHistory({ budgetBytes: settings.current.historyBudgetBytes ?? 512 * 1048576, maxSteps: settings.current.historyMaxSteps ?? 10000 }); setRecoveries(initial.recovery || []); if (initial.model && current.id === boot && !current.doc.dirty) await loadFile(initial.model); else refresh(); setPreferencesReady(true); if(initial.recoveryPrompt && initial.recovery?.length)setDialog({type:'recovery'}); }).catch(error => { setPreferencesReady(true); say(error.message, true); }); }, []);
  useEffect(() => { window.desktop?.setDirty(doc.dirty || hasUVPreview || hasTrackDrafts || hasPaintChanges); document.title = `${doc.dirty || hasUVPreview || hasTrackDrafts || hasPaintChanges ? '* ' : ''}${session.path || doc.name} — MDLxL`; }, [doc, tick, session.path, hasUVPreview, hasTrackDrafts, hasPaintChanges]);
  useEffect(() => { applyApplicationTheme(preferences); }, [preferences]);
  useEffect(() => { const handler = event => { if (latest.current.doc.dirty || Object.keys(latest.current.session.uvPreviews).length || Object.keys(latest.current.session.animationDrafts).length || latest.current.session.paintProject?.dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, []);
  useEffect(() => {
    if (!doc.dirty && doc.revision === 0 && !hasUVPreview && !hasTrackDrafts && session.checkpoint === 0) return;
    const timer = setTimeout(async () => { try { await checkpoint(session); } catch (error) { say(`Recovery checkpoint failed: ${error.message}`, true); } }, 350);
    return () => clearTimeout(timer);
  }, [doc, doc.revision, session, session.uvPreviews, session.animationDrafts]);
  useEffect(() => {
    if(!preferencesReady) return;
    const encoded=JSON.stringify(preferences);
    try { localStorage.setItem('mdlvis-preferences',encoded); } catch(error) { say('Settings could not be stored in this browser: '+error.message,true); }
    if(!window.desktop || savedPreferences.current===encoded)return;
    const timer=preferencesTimer.current=setTimeout(() => { window.desktop.configure({preferences}).then(result => {settings.current=result; savedPreferences.current=encoded;}).catch(error=>say('Settings could not be saved: '+error.message,true)); },200);
    return () => clearTimeout(timer);
  },[preferences,preferencesReady]);
  useEffect(() => window.desktop?.onBeforeClose?.(async () => { const captures=[]; window.dispatchEvent(new CustomEvent('mdlvis-flush-captures',{detail:captures})); await Promise.all(captures); clearTimeout(preferencesTimer.current); if(!latest.current.preferencesReady)return; const current=preferencesRef.current, encoded=JSON.stringify(current); if(savedPreferences.current!==encoded) {await window.desktop.configure({preferences:current});savedPreferences.current=encoded;} }),[]);
  useEffect(() => { if(preferencesReady) resolveTextures(); },[preferencesReady]);


  // NonLooping is a Warcraft III serialization flag. Editor playback loops
  // until the user explicitly pauses it.
  const previewLoop = true;
  const previewSelection = getUVPreviewSelection(model, mode==='uv'?[activeGeoset]:[...selectable]);
  const singleTriangle = Object.values(validSelection).filter(ids => ids.length).length === 1 && selectionCount === 3;
  const toolButton = (icon, name, title = name, condition = selectionCount > 0) => <Tool action={name} icon={icon} title={title} disabled={!editable || !condition || mode === 'uv'} onClick={() => meshAction(name)}/>;
  const cameraPanel = <fieldset className="camera-angle-panel"><legend>Rotate around Axis</legend>{['x','y','z'].map(axis=><Coordinate key={axis} axis={'Camera '+axis.toUpperCase()} displayAxis={axis.toUpperCase()} value={cameraAngles[axis]} onCommit={value=>setCameraAnglesRequest(previous=>({...cameraAngles,[axis]:value,revision:(previous?.revision||0)+1}))}/>)}<small>World XYZ · degrees</small></fieldset>;
  const boundBoneIds=directlyBoundBoneIds(model,validSelection);
  const bindingPanel=<div className="binding-panel"><div className="binding-inspection-title">List of bones connected to selected vertices</div><section className="binding-inspection" aria-label="List of bones connected to selected vertices">{boundBoneIds.map(id=>{const name=model.Nodes.find(node=>node?.ObjectId===id)?.Name||'Bone '+id;return <button type="button" className="binding-bone" aria-pressed={selectedNodeIds.includes(id)} title={`Select ${name} without clearing selected vertices`} key={id} onClick={()=>setSelectedNodeIds([id])}>{name}</button>;})}</section></div>;
  const geosetHighlightLabel='Highlight Geoset';
  const highlightAppearance = preferences.viewportAppearance.geosetHighlight;
  const highlightedFromSelection = !cleanView && preferences.highlightSelection && highlightAppearance.viaSelection ? selectionHoveredGeoset : null;
  const inputStrength = <div className="compact-input-strength" aria-label="Input strengths" title="Adjust in Settings → Mouse, or use the existing input hotkeys"><span className={adjustingInput?.kind === 'pointer' ? 'adjusting' : ''}>DPI {preferences.pointerSensitivity}×</span><span className={adjustingInput?.kind === 'scroll' ? 'adjusting' : ''}>Scroll {preferences.scrollSensitivity}×</span></div>;
  const geosetPicker = <div className="classic-geosets" onContextMenu={event => { event.preventDefault(); setContext({ x: event.clientX, y: event.clientY }); }}><div className="classic-geosets-heading">Geosets</div><div className="geoset-options"><label className="check"><input data-warmkey="showAllGeosets" aria-label="Show all geosets" type="checkbox" checked={showAllGeosets} onChange={event => setShowAllGeosets(event.target.checked)}/>Show all</label><label className="check"><input data-warmkey="highlightSelection" aria-label={geosetHighlightLabel} type="checkbox" checked={preferences.highlightSelection} onChange={event => changePreferences(previous => ({ ...previous, highlightSelection: event.target.checked }))}/>{geosetHighlightLabel}</label></div><div className="classic-selection-actions"><button data-warmkey="geosetsAll" onClick={() => chooseSets(allGeosets(model.Geosets.length))}>All</button><button data-warmkey="geosetsClear" onClick={() => chooseSets(new Set())}>Clear</button><button data-warmkey="geosetsInvert" onClick={() => chooseSets(invertGeosets(selectable, model.Geosets.length))}>Invert</button></div><div className="classic-geoset-list" style={{ '--geoset-rows': Math.max(1, Math.ceil(model.Geosets.length / 4)) }} role="listbox" aria-label="Geosets" aria-multiselectable="true">{model.Geosets.map((g, i) => <div key={i} className={`geoset-row${activeGeoset === i ? ' selected' : ''}${!cleanView && preferences.highlightSelection && highlightAppearance.viaView && viewHoveredGeoset === i ? ' hovered' : ''}`} role="option" aria-selected={selectable.has(i)} ><span className="geoset-hover-target" onMouseEnter={() => setSelectionHoveredGeoset(i)} onMouseLeave={() => setSelectionHoveredGeoset(null)}><input data-warmkey={`geoset:${i}`} type="checkbox" aria-label={`Select geoset ${i}`} checked={selectable.has(i)} onChange={event => chooseSet(i, event, event.target.checked)}/><span>{i + 1}</span></span></div>)}</div></div>;
  const changeGeosetStructure = (label, sections, operation) => {
    let result;
    try { result = edit(label, sections, operation, { rethrow: true }); }
    catch { return; }
    if (result === false) { say('No geosets share compatible materials and RGB.'); return; }
    const remapVertices = previous => {
      const next = {};
      for (const [oldIndex, vertices] of Object.entries(previous)) {
        const newIndex = result.oldToNew[oldIndex];
        if (newIndex === undefined) continue;
        (next[newIndex] ||= []).push(...vertices.map(vertex => vertex + result.vertexOffsets[oldIndex]));
      }
      return next;
    };
    setSelection(remapVertices); setHidden(remapVertices);
    setSelectable(previous => new Set([...previous].map(index => result.oldToNew[index]).filter(index => index !== undefined)));
    setActiveGeoset(previous => result.oldToNew[previous] ?? -1); setUvSet(0); clearZoomAnchor();
    say(`Merged ${result.merged} geosets.`);
  };
  const separateSelectedGeosets = nuclear => {
    const label = nuclear ? 'Nuclear Seperation' : 'Seperate by Loose parts';
    let result;
    try { result = edit(label, ['Geosets', 'GeosetAnims', 'Gliders', 'Info'], current => (nuclear ? nuclearSeparateGeosets : separateGeosetsByLoosePart)(current, validSelection), { rethrow: true }); }
    catch { return; }
    if (result === false) { say('The selected vertices contain no parts to separate.'); return; }
    setSelection(previous => { const next = { ...previous }; for (const index of result.touched) delete next[index]; return { ...next, ...result.selection }; });
    setHidden(previous => { const next = { ...previous }; for (const index of result.touched) delete next[index]; return next; });
    setSelectable(previous => new Set([...previous, ...result.geosetIndices]));
    setActiveGeoset(result.geosetIndices[0] ?? activeGeoset); setUvSet(0); clearZoomAnchor();
    say(`Separated selected geometry into ${result.parts} new geoset${result.parts === 1 ? '' : 's'}.`);
  };
  const commitUVChanges = (changes, label = 'Edit UV coordinates') => {
    setLiveUV(null);
    return edit(label, ['Geosets'], current => {
      for (const change of changes || []) {
        const target = current.Geosets[change.geosetIndex]?.TVertices?.[change.uvSet];
        if (!target || target.length !== change.values?.length) throw Error('The UV map changed structure before the edit could be applied.');
        current.Geosets[change.geosetIndex].TVertices[change.uvSet] = new Float32Array(change.values);
      }
    });
  };
  const uncoupleUVSelection = (currentSelection, coordId = uvSet) => {
    let nextSelection = { ...validSelection }, nextDomain = { ...uvEntrySelection };
    const result = edit('Uncouple UV vertices', ['Geosets'], current => {
      for (const [indexText, ids] of Object.entries(currentSelection || {})) {
        const index = Number(indexText), uncoupled = uncoupleUVVertices(current.Geosets[index], ids, coordId);
        nextSelection[index] = [];
        nextDomain[index] = [...new Set([...(nextDomain[index] || []), ...uncoupled.created])];
      }
    });
    if (result !== false) { setSelection(nextSelection); setUVEntrySelection(nextDomain); setLiveUV(null); }
  };
  const uvWorkspace = (<UVWorkspace key={session.id+':'+uvEntryId} model={model} materialModel={texturedModel} previewModel={previewModel} revision={doc.revision} activeGeoset={activeGeoset} eligibleSelection={uvEntrySelection} selectionByGeoset={validSelection}
        onSelectionChange={next => setSelection(filterVertexSelection(next, new Set(Object.keys(uvEntrySelection).map(Number)), doc.model))}
        onWorkingSelectionChange={next => { const indices = new Set(Object.keys(next).map(Number)); setUVEntrySelection(next); setSelectable(indices); setSelection(filterVertexSelection(next, indices, doc.model)); setHidden({}); setActiveGeoset(indices.values().next().value ?? -1); setLiveUV(null); }}
        onUVChanges={commitUVChanges} onPreviewChanges={changes => setLiveUV(changes?.length ? changes : null)} onUncouple={uncoupleUVSelection}
        onWrappingChange={(textureIDs, enabled) => edit(`${enabled ? 'Enable' : 'Disable'} UV texture wrapping`, ['Textures'], current => setUVTextureWrapping(current, textureIDs, enabled))}
        onGeosetChange={(index, coordId = 0) => { if (index < 0) return; setActiveGeoset(index); setUvSet(coordId); setLiveUV(null); }}
        textureAssets={session.assets} teamColor={teamColor} preferences={preferences} onPreferences={changePreferences} readOnly={doc.readOnly || saving}
        draftCount={Object.keys(session.uvPreviews).length} onLibrary={() => openLibrary(true)} onSavePreview={() => finishUVPreview()} onRevertPreview={() => finishUVPreview(true)} onExit={() => selectMode('vertices')}
        previewProps={{ ...cameraProps, previewMode:previewRenderModes.uv, modelPath:session.path, key: session.id, preferences, onSensitivityChange: changeSensitivity, onPointerSensitivityChange: changePointerSensitivity, onCameraModeToggle: toggleMiddleCamera, suspended: previewSuspended,
          revision: doc.revision, teamColor, textureAssets: session.assets, view, cameraMode }} />);
  const textureLibraryDialog = dialog?.type === 'library' && <Suspense fallback={<div className="classic-modal"><p>Loading texture library…</p></div>}><TextureLibrary model={model} modelPath={session.path} onClose={() => setDialog(dialog.returnTo)} onAddTexture={doc.readOnly ? undefined : addTexture} onPreviewTexture={dialog.preview ? previewTexture : undefined} previewEnabled={dialog.preview && previewSelection.enabled && !doc.readOnly} previewReason={doc.readOnly ? 'This model is read-only.' : previewSelection.reason} onOpenMaterials={() => setDialog({ type: 'resource', kind: 'Materials' })}/></Suspense>;
  const timeline = (<Suspense fallback={<div>Loading keyframes…</div>}><KeyframeTimeline
    motionFindings={inspectingMotion ? motion.visible : []} motionActive={!inspectingMotion || motion.stale || motion.active?.resolved ? null : motion.active}
    motionControls={inspectingMotion && sequence >= 0 && (motion.active || motion.desiredCount > 0) ? motion : null}
    onMotionFinding={(finding, element) => { motionOrigin.current = element; setMotionAnchor(element.getBoundingClientRect().left); motion.setActive(finding); selectMotion(finding); }}
    onKeyClick={mode === 'animation' && animationPanel === 'movement' ? () => { if (motion.active) closeMotion(); } : undefined}
    restrictions={rigWorkspace?restrictions:{}} key={session.id} model={model} revision={doc.revision} sequenceIndex={sequence} time={time} selectedNodeIds={selectedNodeIds} selectedGeosets={[...selectable]} globalSeqId={globalSeqId} highlightKeyframes={highlightKeyframes} playing={playing} onPlayingChange={setPlaying} onStatus={say} activeController={animationPanel==='movement'?movementMode:'animations'} onEdit={edit} onSeek={seekMotionTime} onCommands={registerTimelineCommands} disabled={doc.readOnly||saving} preferences={preferences}>
    {inspectingMotion && animationPanel === 'movement' && motion.active && <Suspense fallback={null}><MotionInspector time={time} selectedNodeIds={selectedNodeIds} mode={movementMode} motion={motion} anchor={motionAnchor} onClose={closeMotion} onSelect={selectMotion} onReplay={replayMotion}/></Suspense>}
  </KeyframeTimeline></Suspense>);
  const activePortrait = portraitModeActive;
  const cameraPortraitActive = activePortrait && !!model.Cameras?.[portraitCameraIndex];
  // Gate BEFORE mounting the timeline/controllers. Their duplicate-owner edit
  // invariant remains strict; malformed models get a choice instead of a crash.
  if (repairBlocked) return <>
    <input ref={files} type="file" accept=".mdl,.mdx,.mdlxlpaint" hidden onChange={event => { if (event.target.files[0]) loadFile(event.target.files[0]); event.target.value = ''; }}/>
    <GeosetAnimationRepair key={session.id} model={model} name={doc.name} groups={duplicateAnimations} receipt={repairReceipt} busy={saving} status={status}
      unavailable={doc.readOnly ? 'This model is read-only; repair is disabled to preserve unsupported data.' : !window.desktop?.repairGeosetAnimations || !session.path ? 'Save a local copy first. Automatic backup and disk Undo require the desktop build.' : hasUVPreview || hasTrackDrafts || session.paintProject ? 'Pending UV, animation-text or paint work is retained. Repair the original model in a separate model session first.' : ''}
      onRepair={repairDuplicateAnimations} onUndo={undoDuplicateRepair} onAccept={() => setRepairReceipt(null)} onOpen={open} onSave={() => save(true)}/>
    {dialog?.type === 'unsaved' && <Dialog title="Save changes?" onClose={() => setDialog(null)} footer={<>
      <button onClick={async () => { const operation = dialog.operation; let saved=!session.paintProject?.dirty||await savePaintProject(); if(saved&&(doc.dirty||hasUVPreview||hasTrackDrafts))saved=await save(); if (saved) { setDialog(null); operation(); } }}>Save</button>
      <button onClick={() => { const operation = dialog.operation; setDialog(null); operation(); }}>Don't save</button>
      <button onClick={() => setDialog(null)}>Cancel</button></>}><p>Save changes to {doc.name} before opening another model?</p></Dialog>}
  </>;
  return <WarmKeysProvider preferences={preferences} catalog={commandCatalog} activeScope={settingsTab?'settings':dialog?'dialog':mode==='paint'?'paint':'editor'} onAction={id=>runLatest.current(id)}><div data-vis-ui={visUI || undefined} data-warmkey-scope={mode==='paint'?'paint':'editor'} className={`classic-app${rigWorkspace?' rig-workspace':''}${mode==='bones'?' bones-workspace':''}${activePortrait?' portrait-workspace':''}${mode==='uv'?' uv-mode':''}${mode==='paint'?' paint-mode':''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const records = [...event.dataTransfer.files], record = records.find(file => /\.(mdl|mdx|mdlxlpaint)$/i.test(file.name)); if (record) withUnsaved(async () => { await loadFile(record); }); else loadTextures(records).catch(error => say(error.message, true)); }} onClick={() => context && setContext(null)}>
    <input hidden ref={files} type="file" accept=".mdl,.mdx,.mdlxlpaint" onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) loadFile(file); }}/><input hidden ref={textures} type="file" accept=".blp,.tga,.dds,.png,.jpg,.jpeg,.webp" multiple onChange={event => { loadTextures([...event.target.files]); event.target.value = ''; }}/><input hidden ref={folder} type="file" webkitdirectory="" multiple onChange={event => loadTextures([...event.target.files])}/>
    {!window.desktop && <nav className="classic-menu">{[['File', [['New', 'new'], ['Open...', 'open'], ['Save', 'save'], ['Save as...', 'saveAs'], ['Recovery...', 'recovery']]], ['Edit', [['Undo', 'undo'], ['Redo', 'redo'], ['Copy', 'copy'], ['Paste', 'paste'], ['Special paste...', 'pasteSpecial'], ['Select all', 'selectAll'], ['Clear selection', 'clear'], ['Undo settings...', 'history'], ['Copy keyframes','keyframe:copy'], ['Copy Frame','keyframe:copyPose'], ['Paste keyframes','keyframe:paste'], ['Delete keyframes','keyframe:delete'], ['Clear keyframes','keyframe:clear']]], ['View', VIEW_MENU], ['Modules', [['Vertices', 'vertices'], ['Bones', 'bones'], ['UV-maps', 'uv'], ['Movement', 'animation'], ['Animations', 'animations']]], ['Shape', SHAPE_TOOLS.map(tool=>[tool,'shape:'+tool.toLowerCase()])], ['Windows', [['Material & Texture Library', 'textureLibrary'], ['Particle Editor', 'particles'], ...resources.map(v => [v, v])]], ['Settings', [['Mouse and general…', 'settings'], ['Keyboard Shortcuts…', 'warmkeys'], ['Graphical settings…', 'graphics'], ['Recording and screenshots…','captureSettings'], ['Appearance…','appearanceSettings'], ['Configuration…','configurationSettings'], ['Grid…','gridSettings'], ['Warcraft III…','gameDataSettings'], null, ['Undo cache…', 'history'], ['Show pressed keys','pressedKeys'], ['Choose Warcraft III folder…','gameData']]], ['Help', [['Help', 'help'], ['Diagnostics', 'diagnostics'], ['About', 'about']]]].map(([name, items]) => <details key={name}><summary>{name}</summary><div role="menu">{items.map((row,index) => { if(!row)return <hr key={index}/>; const [label,action]=row; return <button data-warmkey={action} role={name==='View'?'menuitemcheckbox':'menuitem'} aria-checked={name==='View'?!!menuChecks[action]:undefined} disabled={!commandEnabled(action)} key={action} onClick={event => { event.currentTarget.closest('details').open = false; runLatest.current(action); }}><span>{name==='View'?(menuChecks[action]?'✓ ':'　 '):''}{label}</span>{['frame','frameSelection','normals'].includes(action)&&<kbd>{(preferences.hotkeys[action]||COMMANDS.find(item=>item.id===action)?.defaultKeys||[]).find(key=>key.length===1)||''}</kbd>}</button>;})}</div></details>)}</nav>}
    <div className="classic-toolbar">
      <div className="classic-toolbar-group"><Tool action="new" icon="new-document" title="New" onClick={() => commands.current.new()}/><Tool action="open" icon="sb_open" title="Open" onClick={open}/><Tool action="save" icon="sb_save" title="Save" onClick={() => save()}/></div>
      <div className="classic-toolbar-group">{[['work', 'sb_cross', 'Work mode'], ['zoom', 'sb_zoom', 'Zoom'], ['rotate', 'sb_rot', 'Camera rotation'], ['move', 'sb_move', 'Move camera']].map(([value, icon, title]) => <Tool action={`camera:${value}`} key={value} icon={icon} title={title} active={cameraMode === value} onClick={() => setCameraMode(value)}/>)}</div>
      <div className="classic-toolbar-group"><Tool action="undo" icon="sb_undo" title="Undo" disabled={!commandEnabled('undo')} onClick={() => undo(false)}/><Tool action="redo" icon="sb_undo" flip title="Redo" disabled={!commandEnabled('redo')} onClick={() => undo(true)}/><Tool action="copy" icon="sb_copy" title="Copy" disabled={mode!=='animation'&&!selectable.size} onClick={copy}/><Tool action="paste" icon="sb_paste" title="Paste" disabled={doc.readOnly||(mode!=='animation'&&!clipboard.current)} onClick={() => paste()}/></div>
      <div className="classic-toolbar-group toolbar-visibility"><button aria-pressed={visUI} onClick={() => setVisUI(value => !value)}>{visUI ? 'XL' : 'Vis'}</button><button data-warmkey="hide" onClick={hide} disabled={!selectionCount}>Hide</button><button data-warmkey="show" onClick={() => setHidden({})} disabled={!hiddenCount}>Show</button></div>
      <div className="classic-toolbar-group toolbar-modules"><Tool action="forge" icon="wc3-forge.gif" title="Forge" disabled={doc.readOnly||saving} onClick={()=>setDialog({type:'forge'})}/><Tool action="bitsAndParts" icon="wc3-bits-and-parts" title="BitsAndParts / Clockwork" disabled={doc.readOnly||saving} onClick={()=>setDialog({type:'bitsAndParts'})}/><Tool action="optimizeModel" icon="wc3-optimize" title="Optimize Model" disabled={!commandEnabled('optimizeModel')} onClick={()=>setDialog({type:'optimizeModel'})}/><PressedKeysTool icon={pressedKeysIcon} active={preferences.showPressedKeys} onClick={()=>commands.current.pressedKeys()}/><Tool action="textureLibrary" icon="wc3-library" title="Material and Texture Library" onClick={() => openLibrary()}/></div>

      <Addons onCommand={runCommand} isEnabled={id=>!dialog&&!settingsTab&&commandEnabled(id)}/>
      <button data-warmkey="convertVersion" title="Convert between MDX800 and MDX1000; unsupported data blocks conversion" disabled={doc.readOnly||saving} onClick={()=>commands.current.convertVersion()}>MDX{model.Version} ⇄</button>
      <div className="classic-toolbar-group toolbar-team-color"><label className="team-picker"><select data-warmkey="teamColor" aria-label="Team color" value={teamColor} style={{backgroundColor:teamColor,color:neutralTextColor(teamColor)}} onChange={event => { setTeamColor(event.target.value); setRenderMode('textured'); }}>{teamColors.map(([name,color]) => <option key={color} value={color} style={{backgroundColor:color,color:neutralTextColor(color)}}>{name}</option>)}</select></label></div>
      {mode !== 'uv' && mode !== 'paint' && <QuickDisplay checks={menuChecks} shadows={shaded} cleanAnimationPreview={cleanAnimationPreview} onCommand={runCommand} isEnabled={commandEnabled} onShadows={setShaded} onClear={clearDisplay}/>}
      <LanguageSwitch language={preferences.language} onChange={language=>changePreferences(previous=>({...previous,language}))}/>
    </div>
    <div className="classic-modules" role="group" aria-label="Editor modules">
      <button data-warmkey="vertices" aria-pressed={mode === 'vertices'} onClick={() => selectMode('vertices')}>Vertices</button>
      <button data-warmkey="bones" aria-pressed={mode === 'bones'} onClick={() => commands.current.bones()}>Bones</button>
      <button data-warmkey="animation" aria-pressed={mode === 'animation' && animationPanel === 'movement'} onClick={() => selectAnimationPanel('movement')}>Movement</button>
      <button data-warmkey="animations" aria-pressed={mode === 'animation' && animationPanel === 'animations'} onClick={() => selectAnimationPanel('animations')}>Animations</button>

      <button data-warmkey="paint" aria-pressed={mode === 'paint'} disabled={!commandEnabled('paint')&&mode!=='paint'} onClick={() => commands.current.paint()}>{paintMessage('paint.module')}</button>
      {mode === 'animation' && animationPanel === 'animations' && <AnimationPreviewTools preferences={preferences} active={true} sessionId={session.id} captureAPI={captureAPI} background={background} onBackground={selectBackground} backgrounds={backgroundLibrary.items} onRefreshBackgrounds={backgroundLibrary.refresh} onBackgroundFolder={backgroundLibrary.openFolder} backgroundLoading={backgroundLibrary.loading} loop={previewLoop} onStatus={say}/>}
      {mode === 'vertices' && <><label className="check"><input type="checkbox" aria-label="RGB Preview" checked={rgbPreview} onChange={event=>{setRGBPreview(event.target.checked);if(rgbSequence<0 && model.Sequences.length)setRGBSequence(0);}}/>RGB Preview</label><select aria-label="RGB preview animation" disabled={!rgbPreview} value={rgbSequence} onChange={event=>setRGBSequence(Number(event.target.value))}><option value={-1}>Static RGB</option>{model.Sequences.map((item,index)=><option key={index} value={index}>{item.Name}</option>)}</select></>}
      {inputStrength}
    </div>
    {mode === 'animation' && animationPanel === 'movement' && <PortraitToolbar model={model} active={activePortrait} cameraIndex={portraitCameraIndex} disabled={doc.readOnly || saving} onToggle={() => activePortrait ? setPortraitEnabled(false) : enablePortrait()} onCameraIndex={value => { setPortraitView('perspective'); setPortraitCameraIndex(value); }} onSetView={updatePortraitCamera} onSnap={() => { setPortraitView('perspective'); setPortraitSnapRevision(value => value + 1); }}/>}
    <main className={`classic-workspace${mode === 'vertices' && quadView ? ' quad-workspace' : ''}${mode === 'animation' ? ' animation-workspace' : ''}${mode === 'uv' ? ' uv-immersive' : ''}${mode === 'paint' ? ' paint-immersive' : ''}`} inert={saving || undefined}><section className="classic-view">
      {mode !== 'uv' && mode !== 'paint' && <div className="classic-view-label"><select data-warmkey="viewDirection" aria-label="View direction" value={cameraPortraitActive ? portraitView : mode === 'vertices' && quadView ? activeVertexPane?.view || 'front' : view} onChange={event => cameraPortraitActive ? setPortraitView(event.target.value) : setView(event.target.value)}>{(mode === 'vertices' && quadView ? QUAD_VIEW_OPTIONS : views.map(name => [name, name[0].toUpperCase() + name.slice(1)])).map(([name, label]) => <option key={name} value={name}>{label}</option>)}</select>{!cleanAnimationPreview && <select aria-label="Render mode" value={renderMode} onChange={event=>{setRenderMode(event.target.value);setCleanViews(previous=>({...previous,[mode]:false}));}}><option value="wireframe">Wireframe</option><option value="solid">Surface</option><option value="textured">Textured View</option></select>}{mode === 'vertices' && <button aria-pressed={quadView} onClick={toggleQuadView}>Quad View</button>}<button data-warmkey="fit" title="Fit model" onClick={()=>frame(false)}>Fit</button><button data-warmkey="fitSelection" title="Fit selection" onClick={()=>frame(true)}>Fit selection</button></div>}
      {preferencesReady && mode === 'vertices' && <Viewport cameraHandoff={cameraHandoff} quadView={quadView} viewRequest={vertexViewRequest} onActivePaneChange={setActiveVertexPane} workplaneEnabled={workplaneEnabled} {...cameraProps} rotationNormals={dialog?.type==='normalRotate'} onInspectGeoset={inspectGeoset} onHoverGeoset={setViewHoveredGeoset} highlightSelection={!cleanView && preferences.highlightSelection && highlightAppearance.viaView} onViewChange={setView} preferences={preferences} onSensitivityChange={changeSensitivity} onPointerSensitivityChange={changePointerSensitivity} onCameraModeToggle={toggleMiddleCamera} suspended={!!dialog || (!!settingsTab && settingsTab !== 'visuals')} key={session.id} hoveredGeoset={highlightedFromSelection} model={previewModel} revision={doc.revision} selectedGeoset={activeGeoset} selectedVertices={validSelection[activeGeoset] || []} selectableGeosets={selectable} selectionByGeoset={validSelection} onSelectionChange={next => setSelection(filterVertexSelection(next, selectable, doc.model))} hiddenVertices={hidden} hiddenGeosets={showAllGeosets ? new Set() : new Set([...allGeosets(model.Geosets.length)].filter(i => !selectable.has(i)))} onSelectGeoset={setActiveGeoset} mode={cleanView ? 'textured' : renderMode} overlays={overlays} showVertices={showVertices} showSkeleton={overlays.bones || overlays.nodes || overlays.attachments || overlays.particles} showGrid={showGrid} showAxes={showAxes} shaded={shaded} view={view} cameraMode={cameraMode} workplane={workplane} transformMode={tool} zoomAnchor={zoomAnchor} choosingZoomAnchor={choosingZoomAnchor} onChooseZoomAnchor={next => { if (tool === 'scale' && validSelection[next.geosetIndex]?.includes(next.vertexIndex)) { setZoomAnchor(next); setChoosingZoomAnchor(false); say('Anchor vertex selected.'); } }} rgbPreview={rgbPreview} rgbPreviewSequenceIndex={rgbSequence} sequenceIndex={-1} time={0} playing={false} teamColor={teamColor} textureAssets={session.assets} onTransform={transform}/>}
      {mode === 'uv' && (window.desktop ? <div className="uv-detached-message">UV Wrapper is open in its own window.</div> : uvWorkspace)}
      {preferencesReady && mode === 'paint' && <Suspense fallback={<div className="classic-empty-view">{paintMessage('paint.loading')}</div>}><PaintBoundary key={session.id} onSave={()=>savePaintProject()} onExit={()=>selectMode('vertices')}><PaintWorkspace key={session.id} model={session.paintWorkingModel||model} originalModel={paintOriginalModel} revision={doc.revision+session.paintWorkingRevision} modelName={doc.name} modelPath={session.path} textureAssets={session.assets} project={session.paintProject} activeGeoset={activeGeoset} onGeosetChange={setActiveGeoset} onWorkingModelChange={value=>{session.paintWorkingModel=value;session.paintWorkingRevision++;refresh();}} onProjectChange={value=>{if(!session.paintProject&&value){session.paintOriginalModelBytes=doc.serialize(doc.format);session.paintWorkingModel ||= structuredClone(model);}if(!value){session.paintWorkingModel=null;session.paintWorkingRevision++;delete session.paintAppliedRevision;}session.paintProject=value;refresh();}} onEnsureTarget={ensurePaintTarget} onSaveProject={savePaintProject} onOpenProject={open} onExport={exportPaintProject} onApply={applyPaintToModel} onExit={()=>selectMode('vertices')} onStatus={say} preferences={preferences} cameraProps={{...cameraProps,onWorkMode:()=>setCameraMode('work'),onSensitivityChange:changeSensitivity,onPointerSensitivityChange:changePointerSensitivity,onCameraModeToggle:toggleMiddleCamera}} view={view} cameraMode={cameraMode} teamColor={teamColor} readOnly={doc.readOnly||saving||model.Version!==800}/></PaintBoundary></Suspense>}

      {(mode === 'animation' || mode === 'bones') && <Suspense fallback={<div className="classic-empty-view">Loading model preview…</div>}><GamePreview cameraHandoff={cameraHandoff} attachSourceIds={mode === 'bones' ? attachSourceIds : []} onAttachTarget={finishAttach} onCancelAttach={() => setAttachSourceIds([])} previewMode={previewRenderModes.animation} presentation={cleanAnimationPreview?"preview":"editor"} restPose={restPose} cleanAnimationPreview={cleanAnimationPreview} workplaneEnabled={workplaneEnabled} restrictions={restrictions} multiple={multipleNodes} {...cameraProps} onInspectGeoset={inspectGeoset} onHoverGeoset={setViewHoveredGeoset} highlightSelection={!cleanView && preferences.highlightSelection && highlightAppearance.viaView} selectedGeoset={activeGeoset} selectionByGeoset={validSelection} selectableGeosets={selectable} onSelectionChange={next=>setSelection(filterVertexSelection(next,selectable,doc.model))} hiddenGeosets={showAllGeosets?new Set():new Set([...allGeosets(model.Geosets.length)].filter(i=>!selectable.has(i)))} modelPath={session.path} mode={cleanView ? 'textured' : renderMode} shaded={shaded} showGrid={cameraPortraitActive ? false : showGrid} showAxes={cameraPortraitActive ? false : showAxes} workplane={workplane} backgroundUrl={backgroundLibrary.url} backgroundType={backgroundLibrary.type} onCaptureReady={setCaptureAPI} timelineInterval={[animationDomain.start,animationDomain.end]} overlays={cameraPortraitActive ? portraitOverlays : panelOverlays} loop={previewLoop} hoveredGeoset={highlightedFromSelection} preferences={preferences} onSensitivityChange={changeSensitivity} onPointerSensitivityChange={changePointerSensitivity} onCameraModeToggle={toggleMiddleCamera} suspended={previewSuspended} key={session.id} model={previewModel} revision={doc.revision} sequenceIndex={sequence} time={time} playing={playing} onTimeChange={setTime} onPlayingChange={setPlaying} teamColor={teamColor} textureAssets={session.assets} view={cameraPortraitActive ? portraitView : view} cameraMode={cameraMode}
        portraitMode={activePortrait} portraitCameraIndex={portraitCameraIndex} portraitSnapRevision={portraitSnapRevision} liveMovementRevision={liveMovementRevision.current} playbackRange={inspectingMotion ? motion.focus : null} globalSeqId={globalSeqId} selectedNodeIds={selectedNodeIds} onSelectNodes={setSelectedNodeIds} onNodeTransform={doc.readOnly || saving || sharedMotionChannel || !rigWorkspace || !restPose && globalSeqId !== null ? undefined : moveNodes} showNodes={showNodes} showParticles={preferences.graphics.particles} transformMode={rigWorkspace ? movementMode : 'select'} transformSpace={movementSpace} /></Suspense>}

    </section>{mode !== 'uv' && mode !== 'paint' && <aside className="classic-sidebar">
      {cameraRotating && cameraPanel}
      {!rigWorkspace && mode !== 'animation' && !cameraRotating && <><div className="classic-counts"><div>Vertices: <span>{totalVertices}</span></div><div>Selected: <span>{selectionCount}</span></div><div>Hidden: <span>{hiddenCount}</span></div><div>Triangles: <span>{totalFaces}</span></div><div>Selected: <span>{selectedFaces}</span></div></div>
      <div className="classic-coordinates" data-label={preferences.language === 'zh' ? 'Coords:' : translate('Coords:')}>{['X', 'Y', 'Z'].map((axis, i) => <Coordinate key={axis} axis={axis} value={centroid[i]} disabled={!editable || !selectionCount || mode === 'uv'} onCommit={value => { const translation = [0, 0, 0]; translation[i] = value - centroid[i]; transform({ translation }); }}/>)}</div>
      <fieldset className="classic-planes"><legend><label><input data-warmkey="workplaneEnabled" aria-label="Workplane" type="checkbox" disabled={!!lockedVertexPlane} checked={!!lockedVertexPlane || workplaneEnabled} onChange={event => setWorkplaneEnabled(event.target.checked)}/>Workplane</label></legend>{[['xy', 'XY'], ['xz', 'ZX'], ['yz', 'YZ']].map(([value, label]) => <label key={value}><input data-warmkey={`plane:${value}`} aria-label={`${label} workplane`} type="radio" name="workplane" disabled={!!lockedVertexPlane} checked={(lockedVertexPlane || workplane) === value} onChange={() => setWorkplane(value)}/>{label}</label>)}</fieldset>
      {!cameraRotating && <div className="classic-tools">{[['select', 'sb_select', 'Select'], ['translate', 'sb_move', 'Move'], ['rotate', 'sb_rot', 'Rotate'], ['scale', 'sb_zoom', 'Resize']].map(([value, icon, title]) => <Tool action={value} key={value} icon={icon} title={title} active={tool === value} onClick={() => setWorkTool(value)}/>)}<Tool action="normalRotate" icon="sb_nrot" title="Rotate normals" disabled={!editable || !selectionCount || mode === 'uv'} onClick={() => setDialog({ type: 'normalRotate' })}/>
        {toolButton('sb_del', 'Delete vertices', 'Delete vertices')}{toolButton('sb_uncouple', 'Uncouple', 'Uncouple vertices')}<Tool action="Mirror" icon="sb_mirror" title="Mirror in workplane" disabled={!editable || !selectionCount} onClick={() => mode === 'uv' ? uvAction('flip-u') : meshAction('Mirror')}/>{toolButton('b_extrude', 'Extrude', 'Extrude 10 units, then move', selectedFaces > 0)}{toolButton('b_detach', 'Detach', 'Detach as new geoset', selectedFaces > 0)}
        {toolButton('sb_triangle', 'Create triangle', 'Create triangle', singleTriangle)}{toolButton('sb_deltr', 'Delete triangles', 'Delete selected triangles', selectedFaces > 0)}<button data-warmkey="Collapse" className="classic-tool classic-collapse span-2" title="Collapse points" disabled={!editable || selectionCount < 2 || mode === 'uv'} onClick={() => meshAction('Collapse')}>Collapse</button><button data-warmkey="Weld" className="classic-tool classic-weld" title="Weld points; retains last selected vertex attributes" disabled={!editable || selectionCount < 2 || mode === 'uv'} onClick={() => meshAction('Weld')}>Weld</button>
        <Tool action="Reverse normals" title="Reverse normals" disabled={!editable || !selectionCount || mode === 'uv'} onClick={() => meshAction('Reverse normals')}>−1</Tool>{toolButton('sb_nsmooth', 'Smooth normals', 'Average selected normals')}{toolButton('sb_nrestore', 'Restore normals', 'Recalculate geoset normals')}<button data-warmkey="uv" className="classic-tool classic-uv-button uv-button" title="UV maps" disabled={!commandEnabled('uv')} onClick={() => selectMode('uv')}>UV-maps</button>
      </div>}
      </>}
      {mode === 'bones' && !cameraRotating && <Suspense fallback={<p>Loading controller…</p>}><MovementController restPose={restPose} selectionByGeoset={validSelection} workplaneEnabled={workplaneEnabled} onWorkplaneEnabled={setWorkplaneEnabled} workplane={workplane} onWorkplane={setWorkplane} restrictions={restrictions} onRestrictions={setRestrictions} multiple={multipleNodes} onMultiple={setMultipleNodes} onVertexTransform={transform} globalSeqId={restPose ? null : globalSeqId} onTimelineChange={selectTimeline} highlightKeyframes={highlightKeyframes} onHighlightKeyframes={setHighlightKeyframes} preferences={preferences} disabled={doc.readOnly || saving} key={session.id} model={model} revision={doc.revision} sequenceIndex={sequence} time={time} selectedNodeIds={selectedNodeIds} onSelectNodes={setSelectedNodeIds} onEdit={edit} onSeek={setTime} onSequenceChange={selectSequence} playing={playing} onPlayingChange={setPlaying} transformMode={movementMode} onTransformMode={value => setWorkTool(value==='move'?'translate':value)} transformSpace={movementSpace} onTransformSpace={setMovementSpace} showNodes={showNodes} onShowNodes={setShowNodes} showParticles={preferences.graphics.particles} onShowParticles={showParticlePreview} onOpenNodeManager={openNodeManager} onDeleteNode={deleteSelectedNode} onRenameNode={renameSelectedNode} onBillboarded={setSelectedBoneBillboarded} onCreateRigNode={createBoneOrAttachment} onAttach={beginAttach} onDetach={detachSelectedNode} onSoftBind={() => bindSelectedVertices('soft')} onHardBind={() => bindSelectedVertices('hard')} onDetachVertices={() => bindSelectedVertices('detach')} attachActive={attachSourceIds.length > 0} createOpen={boneCreateOpen} onCreateOpen={setBoneCreateOpen} canDeleteNode={!!singleRigNode} canAttach={selectedRigNodes.length > 0 && (multipleNodes || selectedRigNodes.length === 1)} canDetach={parentedRigNodes.length > 0 && (multipleNodes || selectedRigNodes.length === 1)} canBind={!!selectedBone && selectionCount > 0} /></Suspense>}
      {mode === 'animation' && !cameraRotating && <Suspense fallback={<p>Loading controller…</p>}>

        {animationPanel === 'movement' ? !cameraRotating && <MovementController restPose={restPose} selectionByGeoset={validSelection} workplaneEnabled={workplaneEnabled} onWorkplaneEnabled={setWorkplaneEnabled} workplane={workplane} onWorkplane={setWorkplane} restrictions={restrictions} onRestrictions={setRestrictions} multiple={multipleNodes} onMultiple={setMultipleNodes} onVertexTransform={transform} globalSeqId={restPose ? null : globalSeqId} onTimelineChange={selectTimeline} highlightKeyframes={highlightKeyframes} onHighlightKeyframes={setHighlightKeyframes} preferences={preferences} disabled={doc.readOnly || saving} key={session.id} model={model} revision={doc.revision} sequenceIndex={sequence} time={time} selectedNodeIds={selectedNodeIds} onSelectNodes={setSelectedNodeIds} onEdit={edit} onSeek={setTime} onSequenceChange={selectSequence} playing={playing} onPlayingChange={setPlaying} transformMode={movementMode} onTransformMode={value => setWorkTool(value==='move'?'translate':value)} transformSpace={movementSpace} onTransformSpace={setMovementSpace} showNodes={showNodes} onShowNodes={setShowNodes} showParticles={preferences.graphics.particles} onShowParticles={showParticlePreview} onOpenNodeManager={openNodeManager} portraitMode={activePortrait} /> : <>
          <AnimationController globalSeqId={globalSeqId} key={session.id} model={model} revision={doc.revision} sequenceIndex={sequence} time={time} selectedGeosets={[...selectable]} onEdit={edit} onTimelineChange={selectTimeline} onSeek={value => { setPlaying(false); setTime(value); }} disabled={doc.readOnly || saving} />
          {geosetPicker}

        </>}
      </Suspense>}
      {mode === 'vertices' && !cameraRotating && <div className="classic-geoset-operations"><button disabled={!editable || !selectionCount} onClick={() => separateSelectedGeosets(false)}>Seperate by Loose parts</button><button disabled={!editable || !selectionCount} onClick={() => separateSelectedGeosets(true)}>Nuclear Seperation</button><button disabled={!editable || !selectionCount} onClick={() => changeGeosetStructure('Merge geosets', ['Geosets', 'GeosetAnims', 'Bones', 'Gliders', 'Info'], current => mergeSimilarGeosets(current, validSelection))}>Merge Geosets</button></div>}
      {(mode !== 'animation' || animationPanel === 'movement' || cameraRotating) && geosetPicker}
      {rigWorkspace && bindingPanel}
    </aside>}</main>
    {mode==='animation' && timeline}
    <div className="classic-status" role="status"><span>{saving ? 'Saving…' : status}</span><span>{doc.dirty || hasUVPreview || hasTrackDrafts ? 'Modified · ' : hasPaintChanges ? 'Paint preset unsaved · ' : ''}{activePortrait ? `Human UI portrait simulation · ${model.Cameras?.[portraitCameraIndex]?.Name || 'no camera'}` : mode === 'paint' ? paintMessage('paint.hint') : mode === 'vertices' ? 'Vertex editor (F1)' : mode === 'uv' ? 'UV editor (F2)' : mode === 'bones' ? 'Bones · Rest pose' : animationPanel === 'movement' ? 'Movement (F3)' : 'Animations'}</span></div>
    {mode === 'uv' && window.desktop && uvWindow && <DetachedWindow childWindow={uvWindow} title="MDLxL — UV Wrapper" preferences={preferences} onClose={() => { uvWindowRef.current = null; setUVWindow(null); if (latest.current.mode === 'uv') selectMode('vertices'); }}>{uvWorkspace}{dialog?.host === 'uv' && textureLibraryDialog}</DetachedWindow>}
    {dialog?.type === 'portraitSetup' && <PortraitSetup model={model} missingCamera={dialog.missingCamera} missingSequence={dialog.missingSequence} sourceIndex={sequence >= 0 ? sequence : model.Sequences.length ? 0 : -1} disabled={doc.readOnly || saving} onCreate={completePortraitSetup} onSetCamera={setMissingPortraitCamera} onClose={() => setDialog(null)}/>}
    {dialog?.type==='forge' && <Suspense fallback={<div className="classic-modal">Loading Forge…</div>}><Forge preferences={preferences} model={model} modelPath={session.path} onClose={()=>setDialog(null)} onCommit={forgeItem}/></Suspense>}
    {dialog?.type==='bitsAndParts' && <Suspense fallback={<div className="classic-modal">Loading BitsAndParts…</div>}><BitsAndParts model={model} preferences={preferences} textureAssets={session.assets} teamColor={teamColor} onClose={()=>setDialog(null)} onCommit={importPart}/></Suspense>}
    {dialog?.type==='particles' && <Suspense fallback={<div className="classic-modal">Loading Particle Editor…</div>}><ParticleEditor doc={doc} revision={doc.revision} edit={edit} refresh={refresh} modelPath={session.path} textureAssets={session.assets} preferences={preferences} teamColor={teamColor} selectedNodeId={dialog.nodeId} sequenceIndex={sequence} previewFrame={time} onClose={()=>setDialog(null)} onNodeChange={id=>setSelectedNodeIds(id==null?[]:[id])}/></Suspense>}
    {dialog?.type==='shape' && <Suspense fallback={<div className="classic-modal">Loading shaping tools…</div>}><ShapingDialog model={model} selectedGeosets={[...selectable]} selectionByGeoset={validSelection} initialTool={dialog.tool} onClose={()=>setDialog(null)} onApply={(options,selection)=>edit('Shape geosets',['Geosets','Info'],m=>shapeGeosets(m,selection,options))}/></Suspense>}
    {dialog?.type==='saveFormat' && <Dialog title="Save as" onClose={()=>setDialog(null)} footer={<><button disabled={saving} onClick={async()=>{if(await save(true,'mdx'))setDialog(null);}}>Save MDX…</button><button disabled={saving} onClick={async()=>{if(await save(true,'mdl'))setDialog(null);}}>Save MDL…</button><button disabled={saving} onClick={()=>setDialog(null)}>Cancel</button></>}><p>Model version: {model.Version}</p><p>MDX saves the binary model. MDL saves editable text. Both preserve supported model data; unsupported conversion is blocked before writing.</p></Dialog>}
    {dialog?.type === 'recent' && <Dialog title="Recent Files" onClose={()=>setDialog(null)} footer={<><button disabled={!recentFiles.length} onClick={clearRecent}>Clear History</button><button onClick={()=>setDialog(null)}>Close</button></>}>{recentFiles.length ? recentFiles.map(path=><button key={path} title={path} onClick={()=>{setDialog(null);openRecent(path);}} style={{display:'block',width:'100%',textAlign:'left',overflowWrap:'anywhere'}}>{path}</button>) : <p>No recent files.</p>}</Dialog>}
    {context && <div className="classic-context" role="menu" style={{ position: 'fixed', left: Math.min(context.x, window.innerWidth - 140), top: Math.min(context.y, window.innerHeight - 110) }}>{[['Select all geosets', () => chooseSets(allGeosets(model.Geosets.length))], ['Clear geosets', () => chooseSets(new Set())], ['Invert geosets', () => chooseSets(invertGeosets(selectable, model.Geosets.length))], ['Show all vertices', () => setHidden({})]].map(([label, run]) => <button data-warmkey={({'Select all geosets':'geosetsAll','Clear geosets':'geosetsClear','Invert geosets':'geosetsInvert','Show all vertices':'show'})[label]} role="menuitem" key={label} onClick={run}>{label}</button>)}</div>}
    {dialog?.type === 'resource' && <div className={nodeManagerLive ? 'live-node-manager' : undefined}><Suspense fallback={<div className="classic-modal"><div className="classic-modal-window">Loading resource editor…</div></div>}><ResourceEditor onOpenParticleEditor={openParticles} onViewCamera={(camera,index) => { const evaluated=evaluateModelCamera(model,camera,time,sequence,time); setView('perspective'); setDialog(null); if(evaluated)requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('mdlxl-view-camera',{detail:evaluated}))); }} selectedNodeId={selectedNodeIds.at(-1)} previewFrame={time} livePreview={nodeManagerLive} onNodeChange={id => setSelectedNodeIds([id])} onWarmKeys={()=>setSettingsTab('warmkeys')} kind={dialog.kind} doc={doc} edit={edit} refresh={refresh} onClose={() => setDialog(null)} onImportTexture={() => openLibrary()} onTextureFolder={textureFolder} selectionByGeoset={validSelection} activeGeoset={activeGeoset} onGeosetChange={index => { setSelectable(previous => new Set([...previous, index])); setActiveGeoset(index); setUvSet(0); }} onVerticesChange={(index, ids) => { if (!doc.model.Geosets[index]) return; setSelection(previous => ({ ...previous, [index]: ids })); setSelectable(previous => new Set([...previous, index])); setActiveGeoset(index); setHidden(previous => ({ ...previous, [index]: [] })); }} onSelectionClear={index => { if (index === undefined) { setSelection({}); setHidden({}); setSelectable(allGeosets(doc.model.Geosets.length)); setActiveGeoset(previous => Math.min(previous, doc.model.Geosets.length - 1)); } else { setSelection(previous => { const next = { ...previous }; delete next[index]; return next; }); setHidden(previous => ({ ...previous, [index]: [] })); } }}/></Suspense></div>}
    {dialog?.type === 'library' && dialog.host !== 'uv' && textureLibraryDialog}
    {dialog?.type === 'unsaved' && <Dialog onWarmKeys={()=>setSettingsTab('warmkeys')} title="Save changes?" onClose={() => setDialog(null)} footer={<><button data-warmkey="app:action:3" onClick={async () => { const operation = dialog.operation; let saved=!session.paintProject?.dirty||await savePaintProject(); if(saved&&doc.dirty)saved=await save(); if (saved) { setDialog(null); operation(); } }}>Save</button><button data-warmkey="app:action:4" onClick={() => { const operation = dialog.operation; setDialog(null); operation(); }}>Don't save</button><button data-warmkey="app:action:5" onClick={() => setDialog(null)}>Cancel</button></>}><p>{session.paintProject?.dirty ? <>Save the editable paint preset for {doc.name} before opening another model?{doc.dirty&&<> The model changes will also be saved.</>}</> : <>Save changes to {doc.name} before opening another model?</>}</p></Dialog>}
    {dialog?.type === 'history' && <Dialog onWarmKeys={()=>setSettingsTab('warmkeys')} title="Undo settings" onClose={() => setDialog(null)} footer={<><button data-warmkey="app:action:6" onClick={async () => { try { const options = { budgetBytes: Math.round(historyMB * 1048576), maxSteps: historySteps }; if (!Number.isInteger(historyMB) || historyMB < 64 || historyMB > 4096 || !Number.isInteger(historySteps) || historySteps < 10 || historySteps > 100000) throw new Error("Use 64–4096 MB and 10–100000 steps."); await window.desktop?.configure?.({ historyBudgetBytes: options.budgetBytes, historyMaxSteps: options.maxSteps }); doc.configureHistory(options); settings.current = { ...settings.current, historyBudgetBytes: options.budgetBytes, historyMaxSteps: options.maxSteps }; setDialog(null); refresh(); } catch (error) { say(error.message, true); } }}>Apply</button><button data-warmkey="app:action:7" onClick={() => setDialog(null)}>Close</button></>}><label>Memory limit (MB) <input data-warmkey="app:field:1" aria-label="Undo memory limit MB" type="number" min="64" max="4096" step="1" value={historyMB} onChange={event => setHistoryMB(Number(event.target.value))}/></label><label>Maximum steps <input data-warmkey="app:field:2" aria-label="Maximum undo steps" type="number" min="10" max="100000" step="1" value={historySteps} onChange={event => setHistorySteps(Number(event.target.value))}/></label><p>{doc.historyStats.undoSteps} undo / {doc.historyStats.redoSteps} redo · {(doc.historyStats.usedBytes / 1048576).toFixed(1)} MB used.</p><p>Oldest steps are discarded when a limit is reached. Recovery includes the retained history.</p></Dialog>}
    {dialog?.type === 'recovery' && <Dialog onWarmKeys={()=>setSettingsTab('warmkeys')} title="Recovery" onClose={() => setDialog(null)}>{recoveries.length ? recoveries.map(item => <button data-warmkey={`restore:${item.id}`} key={item.id} onClick={() => restoreRecovery(item)}>{item.name || item.id} · {item.date ? new Date(item.date).toLocaleString() : 'Saved draft'}</button>) : <p>No recovery drafts.</p>}</Dialog>}
    {dialog?.type === 'pasteSpecial' && <Dialog onWarmKeys={()=>setSettingsTab('warmkeys')} title="Special paste" onClose={() => setDialog(null)} footer={<><button data-warmkey="app:action:9" onClick={() => paste(anchor === '' ? null : Number(anchor))}>Paste</button><button data-warmkey="app:action:10" onClick={() => setDialog(null)}>Close</button></>}><label>Parent for imported roots <select data-warmkey="app:field:3" value={anchor} onChange={event => setAnchor(event.target.value)}><option value="">Preserve donor roots</option>{model.Bones.map(node => <option key={node.ObjectId} value={node.ObjectId}>{node.Name}</option>)}</select></label><p>Copies geosets and their dependencies. Animation keys retain their donor frame times.</p></Dialog>}
    {dialog?.type === 'normalRotate' && <Dialog onWarmKeys={()=>setSettingsTab('warmkeys')} title="Rotate normals" onClose={() => setDialog(null)} footer={<><button data-warmkey="app:action:11" onClick={() => { if (Number.isFinite(normalAngle)) { meshAction('Rotate normals'); setDialog(null); } }}>Apply</button><button data-warmkey="app:action:12" onClick={() => setDialog(null)}>Close</button></>}><label>Angle around workplane normal (degrees) <input data-warmkey="app:field:4" type="number" step="any" value={normalAngle} onChange={event => setNormalAngle(Number(event.target.value))}/></label></Dialog>}
    {dialog?.type === 'diagnostics' && <Dialog onWarmKeys={()=>setSettingsTab('warmkeys')} title="Model diagnostics" onClose={() => setDialog(null)}>{doc.diagnostics.length ? doc.diagnostics.map((item, i) => <p key={i}><b>{item.severity}: </b>{item.message}</p>) : <p>No model diagnostics.</p>}</Dialog>}
    {dialog?.type === 'help' && <Dialog onWarmKeys={()=>setSettingsTab('warmkeys')} title="MDLxL help" onClose={() => setDialog(null)}><p>Default Hotkeys (customize in Settings): F1 vertices · F2 selected UV maps · F3 Movement. Bones edits the unanimated rig. Animations edits visibility and RGB; BAKE applies current visibility and RGB across the selected animation; ALL applies them across every animation. Bake Text applies edited text tracks. A select · M/Q move · R rotate · Z scale. W switches between work and camera rotation. F toggles Textured View on and off; S selects Surface. Wireframe remains available beside the view direction. Use View / Fit to frame the model.</p><p>Geoset checkboxes control which meshes can be selected. Only checkboxes change selection; Shift checks a range. All, Clear and Invert act on the geoset list. Hide/Show affects editor visibility only.</p><p>T creates a triangle from three selected points. U uncouples, C collapses and B welds points. Welding retains the last selected vertex's UVs and binding. Copy remains available after opening another model.</p><p>Windows opens the material, texture and node managers. Changes can be undone. Untouched saves preserve original bytes; edited sections regenerate through the codec.</p></Dialog>}
    {dialog?.type === 'about' && <Dialog onWarmKeys={()=>setSettingsTab('warmkeys')} title="About MDLxL" onClose={() => setDialog(null)}><p>MDLxL model editor.</p><p>Based on the original 1.41 form layout, with integrated material/node editing and recoverable undo history. The original application is unchanged.</p><p>Format 1200 remains read-only. Model and rendering compatibility still require Warcraft testing.</p></Dialog>}
    {dialog?.type === 'optimizeModel' && <Suspense fallback={<div className="classic-empty-view">Analyzing model…</div>}><OptimizeModel doc={doc} onClose={()=>setDialog(null)} onApply={result=>{const applied=edit('Optimize Model',OPTIMIZER_SECTIONS,m=>commitOptimization(m,result,doc),{rethrow:true});if(applied!==false){setSelection({});setHidden({});setUVEntrySelection({});if(mode==='uv')selectMode('vertices');say('Optimization complete. Save or Save As to write the optimized model.');}return applied;}}/></Suspense>}
    {settingsTab && <Settings modelPath={session.path} preferences={preferences} initialTab={settingsTab} gameDataPath={gameDataPath} onChooseGameData={window.desktop?.chooseGameData ? gameData : undefined} onClearGameData={window.desktop?.clearGameData ? clearGameData : undefined} onChange={changePreferences} onClose={()=>setSettingsTab(null)}/>}
    <PressedKeys enabled={preferences.showPressedKeys}/>
  </div></WarmKeysProvider>;
}
