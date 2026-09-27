import MaterialProperties from './MaterialProperties.jsx';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import UVEditor from './UVEditor.jsx';
import { combineSelectedUVGeosets, projectUVFromView, relevantUVMaterials, splitSelectedUVGeosets } from '../src/uv-tools.js';
import { MousePointer2, Hand, RotateCw, Maximize2, FlipHorizontal2, FlipVertical2, Unlink2, FoldHorizontal } from 'lucide-react';
import { uvToolState } from '../src/uv-tool-state.js';
import { hiddenUVPreviewGeosets, normalizeUVPreviewDisplay, previewMeshDomain, uvPreviewOverlay } from '../src/uv-preview-display.js';
import { renderUVMaterialTexture } from './uv-material-preview.js';
import { normalizeUVGrid, UV_GRID_SPACING_MAX, UV_GRID_SPACING_MIN, uvGridSpacingFromSlider, uvGridSpacingSliderValue } from '../src/uv-grid.js';
import {
  UV_PREVIEW_DEFAULT, UV_PREVIEW_MAX, UV_PREVIEW_MIN,
  UV_SIDE_DEFAULT, UV_SIDE_MAX, UV_SIDE_MIN, clampUVPreviewPercent, clampUVSidePercent,
  uvPreviewPercentAtPointer, uvSidePercentAtPointer,
} from './uv-workspace-layout.js';
import './uv-workspace.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const unique = values => [...new Set(Array.from(values || []).filter(Number.isSafeInteger))];
const selectedCount = value => Object.values(value || {}).reduce((sum, ids) => sum + (ids?.length || 0), 0);
const LAYOUT_KEYS = { side: 'mdlxl.uv.side-percent', preview: 'mdlxl.uv.preview-percent' };
const STANDARD_PROJECTIONS = [['top','Top'],['bottom','Bottom'],['front','Front'],['back','Back'],['left','Side Left'],['right','Side Right']];
const ANGLED_PROJECTIONS = [
  ['top-front-right','Top Front Right'],['top-front-left','Top Front Left'],['top-back-right','Top Back Right'],['top-back-left','Top Back Left'],
  ['bottom-front-right','Bottom Front Right'],['bottom-front-left','Bottom Front Left'],['bottom-back-right','Bottom Back Right'],['bottom-back-left','Bottom Back Left'],
];
const gridSpacingLabel = value => value < 0.01 ? value.toFixed(4) : value < 1 ? value.toFixed(3) : value.toFixed(2);

function storedLayout(key, fallback, normalize) {
  try { return normalize(localStorage.getItem(key) ?? fallback); } catch { return fallback; }
}

function rememberLayout(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* A locked-down browser can keep the in-session layout. */ }
}

const UV_ICONS = { select: MousePointer2, move: Hand, rotate: RotateCw, scale: Maximize2, mirrorX: FlipHorizontal2, mirrorY: FlipVertical2, uncouple: Unlink2, fold: FoldHorizontal };
function Tool({ action, icon, label, active, disabled, onClick }) {
  const Icon = UV_ICONS[icon];
  return <button type="button" data-warmkey={action} data-warmkey-category="UV" className={`uv-tool${active ? ' active' : ''}`} aria-label={label} title={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick}>{Icon ? <Icon size={20} strokeWidth={1.9} aria-hidden="true"/> : label}</button>;
}

function UVGridControls({ value, onChange, children }) {
  const [open, setOpen] = useState(false);
  const update = change => onChange({ ...value, ...change });
  return <div className="uv-grid-toolbar" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {children}
    <button type="button" className={value.enabled ? 'active' : ''} aria-pressed={value.enabled} title="Show UV grid" onClick={() => update({ enabled: !value.enabled })}>Grid</button>
    <button type="button" className={value.snap ? 'active' : ''} aria-pressed={value.snap} title="Snap a dragged vertex or coincident vertex stack to grid crossings" onClick={() => update({ snap: !value.snap })}>Snap</button>
    <label className="uv-grid-size"><span>Size</span><input aria-label="UV grid size" type="range" min={Math.log10(UV_GRID_SPACING_MIN)} max={Math.log10(UV_GRID_SPACING_MAX)} step="0.01" value={uvGridSpacingSliderValue(value.spacing)} onChange={event => update({ spacing: uvGridSpacingFromSlider(event.target.value) })}/><output>{gridSpacingLabel(value.spacing)}</output></label>
    <button type="button" aria-haspopup="dialog" aria-expanded={open} title="UV grid settings" onClick={() => setOpen(previous => !previous)}>Settings</button>
    {open && <div className="uv-grid-settings" role="dialog" aria-label="UV grid settings">
      <label><span>Spacing</span><input aria-label="UV grid spacing" type="number" min={UV_GRID_SPACING_MIN} max={UV_GRID_SPACING_MAX} step="0.0001" value={value.spacing} onChange={event => update({ spacing: Number(event.target.value) })}/></label>
      <label><span>Thickness</span><input aria-label="UV grid thickness" type="range" min="0.5" max="6" step="0.25" value={value.thickness} onChange={event => update({ thickness: Number(event.target.value) })}/><output>{value.thickness}px</output></label>
      <label><span>Color</span><input aria-label="UV grid color" type="color" value={value.color} onChange={event => update({ color: event.target.value })}/></label>
      <label><span>Opacity</span><input aria-label="UV grid opacity" type="range" min="0" max="1" step="0.05" value={value.opacity} onChange={event => update({ opacity: Number(event.target.value) })}/><output>{Math.round(value.opacity * 100)}%</output></label>
    </div>}
  </div>;
}

function Splitter({ orientation, label, value, minimum, maximum, defaultValue, onPointerValue, onValue }) {
  const pointer = useRef(null), vertical = orientation === 'vertical';
  const stop = event => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown = event => {
    let next;
    if (event.key === 'Home') next = minimum;
    else if (event.key === 'End') next = maximum;
    else if (vertical && event.key === 'ArrowLeft') next = value + 2;
    else if (vertical && event.key === 'ArrowRight') next = value - 2;
    else if (!vertical && event.key === 'ArrowUp') next = value - 2;
    else if (!vertical && event.key === 'ArrowDown') next = value + 2;
    if (next === undefined) return;
    event.preventDefault(); onValue(next);
  };
  return <div className={`uv-splitter uv-splitter-${vertical ? 'column' : 'row'}`} role="separator" aria-label={label} aria-orientation={orientation}
    aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(value)} tabIndex={0} title={`${label} · drag or use arrow keys · double-click to reset`}
    onDoubleClick={() => onValue(defaultValue)} onKeyDown={keyDown}
    onPointerDown={event => { pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus(); event.preventDefault(); }}
    onPointerMove={event => { if (pointer.current === event.pointerId) { onPointerValue(event); event.preventDefault(); } }} onPointerUp={stop} onPointerCancel={stop}><span/></div>;
}

export default function UVWorkspace({ model, materialModel = model, previewModel, revision = 0, activeGeoset = -1, eligibleSelection = {}, selectionByGeoset = {}, onSelectionChange,
  onPreviewSelectionChange, onUVChanges, onPreviewChanges, onUncouple, onGeosetChange, onWrappingChange, onMaterialPreset, textureAssets, teamColor, preferences, onPreferences,
  draftCount = 0, onLibrary, onSavePreview, onRevertPreview, previewProps, readOnly = false, onExit }) {
  const [materialID, setMaterialID] = useState(null), [uvTool, setUVTool] = useState('select'), [axis, setAxis] = useState(null), [foldDirection, setFoldDirection] = useState('right-to-left');
  const [showOnlySelected, setShowOnlySelected] = useState(false), [hideRGB, setHideRGB] = useState(false), [showVerticles, setShowVerticles] = useState(false);
  const [projectionPreset, setProjectionPreset] = useState({ name: '', revision: 0 });
  const [materialPreview, setMaterialPreview] = useState(null), [materialError, setMaterialError] = useState('');
  const [sidePercent, setSidePercent] = useState(() => storedLayout(LAYOUT_KEYS.side, UV_SIDE_DEFAULT, clampUVSidePercent));
  const [previewPercent, setPreviewPercent] = useState(() => storedLayout(LAYOUT_KEYS.preview, UV_PREVIEW_DEFAULT, clampUVPreviewPercent));
  const [rightHeaderHeight, setRightHeaderHeight] = useState(69);
  const projectionView = useRef(null), workspaceBody = useRef(null), sidePanel = useRef(null), header = useRef(null);
  const activePreviewPercent = previewPercent;
  const selectionKey = JSON.stringify(selectionByGeoset), eligibilityKey = JSON.stringify(eligibleSelection);
  const previewDomain = useMemo(() => previewMeshDomain(model), [model, revision]);
  const materialEntries = useMemo(() => relevantUVMaterials(materialModel, eligibleSelection), [materialModel, revision, eligibilityKey]);
  const current = materialEntries.find(entry => entry.materialID === materialID) || materialEntries[0] || null;
  const imageLayers = (current?.layers || []).filter(({ texture }) => texture && !texture.ReplaceableId && texture.Image?.trim());
  const wrappingEnabled = imageLayers.length > 0 && imageLayers.every(({ texture }) => (texture.Flags & 3) === 3);
  // UV drags keep the renderer alive; material and texture changes must reload it.
  const previewWrappingRevision = JSON.stringify({ materials: previewModel?.Materials, textures: previewModel?.Textures });

  useEffect(() => {
    if (!current) { setMaterialID(null); return; }
    if (materialID !== current.materialID) setMaterialID(current.materialID);
  }, [current?.materialID, materialID]);

  useEffect(() => { rememberLayout(LAYOUT_KEYS.side, sidePercent); }, [sidePercent]);
  useEffect(() => { rememberLayout(LAYOUT_KEYS.preview, previewPercent); }, [previewPercent]);
  useEffect(() => {
    const element = header.current, ownerWindow = element?.ownerDocument.defaultView;
    if (!element || !ownerWindow?.ResizeObserver) return;
    const measure = () => setRightHeaderHeight(Math.ceil(element.getBoundingClientRect().height));
    const observer = new ownerWindow.ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);

  const allSelected = useMemo(() => Object.fromEntries(Object.entries(selectionByGeoset).map(([index, ids]) => [index, unique(ids).filter(id => eligibleSelection[index]?.includes(id))])), [selectionKey, eligibilityKey]);
  const allEligible = useMemo(() => Object.fromEntries(materialEntries.flatMap(entry => entry.geosetIndices.map(index => {
    const uv = model.Geosets[index]?.TVertices?.[entry.coordId] || [];
    return [index, (previewDomain[index] || []).filter(id => id * 2 + 1 < uv.length && Number.isFinite(uv[id * 2]) && Number.isFinite(uv[id * 2 + 1]))];
  }))), [materialEntries, model, previewDomain]);
  const combined = useMemo(() => combineSelectedUVGeosets(model, eligibleSelection, allSelected, materialEntries),
    [model, revision, eligibilityKey, selectionKey, materialEntries]);
  const materialSignature = current ? JSON.stringify({ material: materialModel.Materials?.[current.materialID], textures: current.layers.map(layer => layer.texture) }) : '';

  useEffect(() => {
    let cancelled = false; setMaterialError(''); setMaterialPreview(null);
    if (!current || !preferences?.graphics?.textures) return;
    renderUVMaterialTexture(materialModel, current.materialID, textureAssets, { teamColor }).then(value => { if (!cancelled) setMaterialPreview(value); }).catch(cause => { if (!cancelled) setMaterialError(cause.message); });
    return () => { cancelled = true; };
  }, [current?.materialID, materialSignature, textureAssets, teamColor, preferences?.graphics?.textures]);

  const display = normalizeUVPreviewDisplay(preferences?.uvPreviewDisplay), uvGrid = normalizeUVGrid(preferences?.uvGrid), liveView = display.mesh === 'selected';
  const selectedGeosets = Object.keys(eligibleSelection).filter(index => eligibleSelection[index]?.length).map(Number);
  const rgbTarget = selectedGeosets.includes(activeGeoset) ? activeGeoset : selectedGeosets[0] ?? -1;
  const hiddenPreviewGeosets = hiddenUVPreviewGeosets(model, eligibleSelection, showOnlySelected);
  // UV-grid preferences belong only to the 2D texture canvas. Keep the 3D
  // renderer's preference object stable while a grid control is adjusted.
  const previewPreferencesInput = { ...(preferences || {}) }; delete previewPreferencesInput.uvGrid;
  const previewPreferencesKey = JSON.stringify(previewPreferencesInput);
  const previewPreferences = useMemo(() => previewPreferencesInput, [previewPreferencesKey]);
  const liveOverlay = showVerticles
    ? { allMesh: true, interactiveSelection: true, highlightSelection: false, size: display.size, color: preferences?.visuals?.uvSelection, eligibleByGeoset: allEligible, selectionByGeoset: allSelected }
    : uvPreviewOverlay(previewDomain, allSelected, null, { ...display, mesh: liveView ? 'selected' : 'none' }, preferences?.visuals?.uvSelection);

  const dispatch = (kind, value) => window.dispatchEvent(new CustomEvent('mdlvis-uv-action', { detail: { kind, value } }));
  const chooseMaterial = value => {
    const id = Number(value), entry = materialEntries.find(item => item.materialID === id); setMaterialID(id); setUVTool('select'); onPreviewChanges?.(null);
    if (entry?.geosetIndices.length) onGeosetChange?.(entry.geosetIndices[0], entry.coordId);
  };
  const selectCombined = ids => {
    if (!combined) return;
    const chosen = new Set(ids), next = { ...selectionByGeoset };
    for (const index of Object.keys(eligibleSelection)) next[index] = [];
    combined.refs.forEach((ref, index) => { if (chosen.has(index)) (next[ref.geosetIndex] ||= []).push(ref.vertexIndex); });
    onSelectionChange?.(next);
  };
  const applyCombined = (values, preview = false, label = 'Edit UV coordinates') => {
    if (!combined || readOnly) return;
    const changes = splitSelectedUVGeosets(model, combined.refs, values);
    (preview ? onPreviewChanges : onUVChanges)?.(changes, label);
  };
  const toolState = uvToolState({ readOnly, selectionCount: selectedCount(allSelected), draftCount });
  useEffect(() => {
    const body = workspaceBody.current;
    if (!body) return;
    const trackPointer = event => {
      body.dataset.pointerRegion = event.target.closest('.uv-live-preview') ? 'preview' :
        event.target.closest('.uv-map-pane') ? 'map' : '';
    };
    const clearPointer = () => { body.dataset.pointerRegion = ''; };
    body.addEventListener('pointermove', trackPointer, true);
    body.addEventListener('pointerdown', trackPointer, true);
    body.addEventListener('pointerleave', clearPointer);
    return () => {
      body.removeEventListener('pointermove', trackPointer, true);
      body.removeEventListener('pointerdown', trackPointer, true);
      body.removeEventListener('pointerleave', clearPointer);
    };
  }, []);
  useEffect(() => {
    const action = event => {
      const { kind, value } = event.detail || {};
      if (kind === 'tool' && ['select','move','rotate','scale'].includes(value)) setUVTool(value);
      if (kind === 'uncouple' && toolState.uncouple) onUncouple?.(Object.fromEntries(Object.entries(allSelected).filter(([, ids]) => ids.length)), Object.fromEntries(materialEntries.flatMap(entry => entry.geosetIndices.map(index => [index, entry.coordId]))));
    };
    window.addEventListener('mdlvis-uv-action', action);
    return () => window.removeEventListener('mdlvis-uv-action', action);
  }, [toolState.uncouple, selectionKey, materialEntries, onUncouple]);
  const project = () => {
    const view = projectionView.current; if (!view || readOnly || !selectedCount(allSelected)) return;
    try {
      const changes = Object.entries(allSelected).filter(([, ids]) => ids.length).map(([index, ids]) => {
        const uvSet = materialEntries.find(entry => entry.geosetIndices.includes(Number(index)))?.coordId ?? 0;
        return { geosetIndex: Number(index), uvSet,
          values: projectUVFromView(model.Geosets[index], ids, view.viewMatrix, view.projectionMatrix, model.Geosets[index].TVertices[uvSet]) };
      });
      onUVChanges?.(changes, 'Project UVs from model view');
    } catch (cause) { setMaterialError(cause.message); }
  };
  const chooseProjectionPreset = name => { if (name) setProjectionPreset(previous => ({ name, revision: previous.revision + 1 })); };
  const setActivePreviewPercent = value => setPreviewPercent(clampUVPreviewPercent(value));
  const changeLiveDisplay = change => onPreferences?.({ ...preferences, uvPreviewDisplay: { ...preferences?.uvPreviewDisplay, ...display, ...change } });
  const changeLiveColor = color => onPreferences?.({ ...preferences, visuals: { ...preferences.visuals, uvSelection: color } });
  const changeUVGrid = value => onPreferences?.({ ...preferences, uvGrid: value });

  return <div className="uv-workspace" aria-label="UV wrapper workspace">
    <header ref={header} className="uv-workspace-header" style={{ '--uv-side-width': `${sidePercent}%` }}>
      <div className="uv-map-header"><strong>UV Wrapper</strong><UVGridControls value={uvGrid} onChange={changeUVGrid}>
        <button type="button" disabled={readOnly || !onWrappingChange || !imageLayers.length}
          title="Toggle Wrap U and Wrap V for this material's image textures. Applies to all uses of these textures."
          onClick={() => onWrappingChange?.([...new Set(imageLayers.map(layer => layer.textureID))], !wrappingEnabled)}>{wrappingEnabled ? 'Disable Wrapping' : 'Enable Wrapping'}</button>
      </UVGridControls></div>
      <div className="uv-header-divider" aria-hidden="true"/>
      <div className="uv-header-actions"><button disabled={readOnly} onClick={onLibrary}>Replace Texture…</button>{draftCount > 0 && <><button disabled={readOnly} onClick={onSavePreview}>Save texture</button><button disabled={readOnly} onClick={onRevertPreview}>Revert texture</button></>}<button onClick={onExit}>Exit UV Wrapper</button></div>
      <div className="uv-material-controls"><label><select aria-label="UV material" value={current?.materialID ?? ''} onChange={event => chooseMaterial(event.target.value)}>{materialEntries.map(entry => <option key={entry.materialID} value={entry.materialID}>{entry.label}</option>)}</select></label><MaterialProperties model={model} materialID={current?.materialID} disabled={readOnly} onChange={onMaterialPreset} compact/></div>
    </header>
    {(materialError || materialPreview?.warnings?.length > 0) && <div className="uv-workspace-warning" role="status">{materialError || materialPreview.warnings.join(' · ')}</div>}
    <div ref={workspaceBody} className="uv-workspace-body" style={{ '--uv-side-width': `${sidePercent}%`, '--uv-right-header-height': `${rightHeaderHeight}px` }}>
      <section className="uv-map-pane" aria-label="UV texture map">
        {combined?.eligibleVertices.length ? <UVEditor key="selected-geosets" geoset={combined.geoset} uvSet={0} revision={revision} textureUrl={materialPreview?.url} textureSize={materialPreview ? [materialPreview.width, materialPreview.height] : undefined}
          eligibleVertices={combined.eligibleVertices} selectedVertices={combined.selectedVertices} transformMode={uvTool} cameraMode="work" preferences={preferences} suspended={readOnly} axis={axis}
          uvGrid={uvGrid} snapTextureFrame={display.snapTextureFrame} showTextureFrame={display.textureFrame} textureFrameColor={preferences?.visuals?.uvSelection}
          onSelectVertices={selectCombined} onChange={values => applyCombined(values)} onPreviewChange={values => values ? applyCombined(values, true) : onPreviewChanges?.(null)} />
          : <div className="classic-empty-view">Select textured vertices before opening the UV wrapper.</div>}
        <div className="uv-texture-caption">{materialPreview?.layerCount ? `${current?.label} · ${materialPreview.layerCount} rendered layer${materialPreview.layerCount === 1 ? '' : 's'} · seamless tiled view` : current?.label || 'No material loaded'}</div>
      </section>
      <Splitter orientation="vertical" label="Resize texture and live-view columns" value={sidePercent} minimum={UV_SIDE_MIN} maximum={UV_SIDE_MAX} defaultValue={UV_SIDE_DEFAULT}
        onValue={value => setSidePercent(clampUVSidePercent(value))} onPointerValue={event => { const rect = workspaceBody.current?.getBoundingClientRect(); if (rect) setSidePercent(uvSidePercentAtPointer(event.clientX, rect)); }}/>
      <aside ref={sidePanel} className="uv-side-panel" style={{ '--uv-preview-height': `${activePreviewPercent}%`, '--uv-selection-color': preferences?.visuals?.uvSelection || '#4cff59' }}>
        <section className="uv-live-options" aria-label="Live view options"><div className="uv-panel-title"><strong>Live View</strong></div>
          <div className="uv-live-toggles">
            <label><input aria-label="Highlight selected vertices in live preview" type="checkbox" checked={liveView} onChange={event => changeLiveDisplay({ mesh: event.target.checked ? 'selected' : 'none' })}/>Highlight Live</label>
            <label><input aria-label="Highlight texture frame" type="checkbox" checked={display.textureFrame} onChange={event => changeLiveDisplay({ textureFrame: event.target.checked })}/>Highlight Texture Frame</label><label><input aria-label="Snap to texture frame" type="checkbox" checked={display.snapTextureFrame} onChange={event => changeLiveDisplay({ snapTextureFrame: event.target.checked })}/>Snap to texture frame</label>
          </div>
          <label className="uv-thickness"><span>Thickness</span><input aria-label="Live selection thickness" type="range" min="0.25" max="3" step="0.25" value={display.size} onChange={event => changeLiveDisplay({ size: Number(event.target.value) })}/><output>{display.size.toFixed(2)}×</output><input className="uv-color-button" aria-label="Live selection and texture-frame color" title="Choose live selection and texture-frame color" type="color" value={preferences?.visuals?.uvSelection || '#4cff59'} onChange={event => changeLiveColor(event.target.value)}/></label>
        </section>
        <section className="uv-live-preview" aria-label="Live model preview">
          <div className="uv-panel-title"><strong>Live Model Preview</strong></div>
          <div className="uv-preview-canvas"><Suspense fallback={<div className="classic-empty-view">Loading preview…</div>}><GamePreview {...previewProps} preferences={previewPreferences} revision={previewWrappingRevision} uvRevision={revision} presentation="preview" preserveCameraView={true} interactivePreview={!!current} restPose={true} model={previewModel} sequenceIndex={-1} time={0} playing={false} showParticles={false} previewOverlay={liveOverlay}
            uvOnlySelected={showOnlySelected} hiddenGeosets={hiddenPreviewGeosets} hideRgbGeoset={hideRGB && rgbTarget >= 0 ? rgbTarget : null}
            selectionByGeoset={selectionByGeoset} selectableGeosets={Object.keys(eligibleSelection).map(Number)}
            previewSelectionMode={showVerticles ? 'vertices' : 'polygons'} previewEligibleByGeoset={allEligible}
            onSelectionChange={onPreviewSelectionChange}
            cameraMode="rotate" transformMode="select" cameraPresetRequest={projectionPreset} onProjectionViewChange={value => { projectionView.current = value; }} /></Suspense></div>
          <div className="uv-preview-footer">
            <button aria-label="Live Select" aria-pressed={showVerticles} disabled={!current} onClick={() => setShowVerticles(value => !value)}>Live Select</button><button aria-label="Selected Only" aria-pressed={showOnlySelected} disabled={!selectedGeosets.length} onClick={() => setShowOnlySelected(value => !value)}>Selected Only</button><button aria-pressed={hideRGB} disabled={rgbTarget < 0} onClick={() => setHideRGB(value => !value)}>Hide RGB</button>
          </div>
        </section>
        <Splitter orientation="horizontal" label="Resize live model preview" value={activePreviewPercent} minimum={UV_PREVIEW_MIN} maximum={UV_PREVIEW_MAX} defaultValue={UV_PREVIEW_DEFAULT}
          onValue={setActivePreviewPercent} onPointerValue={event => { const rect = sidePanel.current?.getBoundingClientRect(); if (rect) setActivePreviewPercent(uvPreviewPercentAtPointer(event.clientY, rect)); }}/>
        <div className="uv-side-controls">
          <section className="uv-projection" aria-label="UV projection"><div className="uv-panel-title"><strong>Projection</strong></div><p>Rotate the model to the required viewpoint, or choose a standard projection plane.</p><div className="uv-projection-actions"><button disabled={readOnly || !selectedCount(allSelected)} onClick={project}>Project from Current View</button><select aria-label="Standard projection view" defaultValue="" onChange={event => { chooseProjectionPreset(event.target.value); event.target.value = ''; }}><option value="">Standard…</option>{STANDARD_PROJECTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Angled projection view" defaultValue="" onChange={event => { chooseProjectionPreset(event.target.value); event.target.value = ''; }}><option value="">Angled…</option>{ANGLED_PROJECTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div></section>
          <section className="uv-toolbox" aria-label="UV tools"><div className="uv-panel-title"><strong>Tools</strong><div className="uv-axis-controls" role="group" aria-label="UV axis when Shift is held">{['X','Y'].map(value => <button key={value} type="button" aria-label={`UV ${value} axis`} aria-pressed={axis === value} onClick={() => setAxis(previous => previous === value ? null : value)}>{value}</button>)}</div></div><div className="uv-tool-grid">
            <Tool action="select" icon="select" label="Select" active={uvTool === 'select'} onClick={() => setUVTool('select')}/>
            <Tool action="translate" icon="move" label="Move" active={uvTool === 'move'} disabled={!toolState.move} onClick={() => setUVTool('move')}/>
            <Tool action="rotate" icon="rotate" label="Rotate" active={uvTool === 'rotate'} disabled={!toolState.rotate} onClick={() => setUVTool('rotate')}/>
            <Tool action="scale" icon="scale" label="Zoom" active={uvTool === 'scale'} disabled={!toolState.scale} onClick={() => setUVTool('scale')}/>
            <Tool action="uv:flip-u" icon="mirrorX" label="Mirror by X" disabled={!toolState.mirror} onClick={() => dispatch('flip-u')}/>
            <Tool action="uv:flip-v" icon="mirrorY" label="Mirror by Y" disabled={!toolState.mirror} onClick={() => dispatch('flip-v')}/>
            <Tool action="Uncouple" icon="uncouple" label="Uncouple selected face corners" disabled={!toolState.uncouple} onClick={() => onUncouple?.(Object.fromEntries(Object.entries(allSelected).filter(([, ids]) => ids.length)), Object.fromEntries(materialEntries.flatMap(entry => entry.geosetIndices.map(index => [index, entry.coordId]))))}/>
            <div className="uv-fold-control"><Tool action="uv:fold" icon="fold" label="Fold" disabled={!toolState.fold} onClick={() => dispatch('fold', foldDirection)}/><select aria-label="Fold direction" value={foldDirection} onChange={event => setFoldDirection(event.target.value)}><option value="right-to-left">Right → left</option><option value="left-to-right">Left → right</option><option value="bottom-to-top">Bottom → top</option><option value="top-to-bottom">Top → bottom</option></select></div>
          </div></section>
        </div>
      </aside>
    </div>
  </div>;
}
