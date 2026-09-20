import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import UVEditor from './UVEditor.jsx';
import { combineUVGeosets, projectUVFromView, relevantUVMaterials, splitCombinedUV } from '../src/uv-tools.js';
import { uvToolState } from '../src/uv-tool-state.js';
import { normalizeUVPreviewDisplay, previewMeshDomain, uvPreviewOverlay } from '../src/uv-preview-display.js';
import { renderUVMaterialTexture } from './uv-material-preview.js';
import { normalizeUVGrid, UV_GRID_SPACING_MAX, UV_GRID_SPACING_MIN, uvGridSpacingFromSlider, uvGridSpacingSliderValue } from '../src/uv-grid.js';
import {
  UV_PREVIEW_DEFAULT, UV_PREVIEW_MAX, UV_PREVIEW_MIN, UV_SELECT_PREVIEW_DEFAULT,
  UV_SIDE_DEFAULT, UV_SIDE_MAX, UV_SIDE_MIN, clampUVPreviewPercent, clampUVSidePercent,
  uvPreviewPercentAtPointer, uvSidePercentAtPointer,
} from './uv-workspace-layout.js';
import './uv-workspace.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const unique = values => [...new Set(Array.from(values || []).filter(Number.isSafeInteger))];
const selectedCount = value => Object.values(value || {}).reduce((sum, ids) => sum + (ids?.length || 0), 0);
const LAYOUT_KEYS = { side: 'mdlxl.uv.side-percent', preview: 'mdlxl.uv.preview-percent', selectPreview: 'mdlxl.uv.select-preview-percent' };
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

function FoldIcon() {
  return <svg className="uv-pixel-icon" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    <rect x="1" y="1" width="14" height="14" fill="#142a91"/><rect x="2" y="2" width="12" height="12" fill="#f5f5f5"/>
    <path d="M3 4h5v8H3z" fill="#b9c9ee"/><path d="M8 4h5v8H8z" fill="#fff"/><path d="M3 3h10v1H3zm0 9h10v1H3zM3 4h1v8H3zm9 0h1v8h-1z" fill="#202020"/>
    <path d="M8 4h1v8H8z" fill="#777"/><path d="M12 4h2v5h-2V7h-2V6h2zM9 5h2v1H9z" fill="#ff00e1"/>
  </svg>;
}

function Tool({ action, icon, iconClass = '', iconNode, label, active, disabled, onClick }) {
  return <button type="button" data-warmkey={action} data-warmkey-category="UV" className={`uv-tool${active ? ' active' : ''}`} aria-label={label} title={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick}>{icon ? <img className={iconClass} src={`./classic/${icon}.png`} alt="" draggable={false}/> : iconNode || label}</button>;
}

function UVGridControls({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const update = change => onChange({ ...value, ...change });
  return <div className="uv-grid-toolbar" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
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

function GeosetPicker({ options, value, attention = false, onChoose, onHover }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.index === value) || null;
  const close = () => { setOpen(false); onHover(null); };
  return <div className="uv-geoset-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <span>Geoset</span><button type="button" className={`uv-geoset-trigger${attention ? ' attention' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => { const next = !open; setOpen(next); onHover(next && selected ? value : null); }}>{selected?.label || 'Choose geoset…'}<span aria-hidden="true">▾</span></button>
    {open && <div className="uv-geoset-menu" role="listbox" aria-label="Select new geoset">{options.map(option => <button type="button" role="option" aria-selected={option.index === value} className={option.index === value ? 'selected' : ''} data-geoset-index={option.index} key={option.index}
      onPointerEnter={() => onHover(option.index)} onFocus={() => onHover(option.index)} onClick={() => { onChoose(option.index); close(); }}>{option.label}</button>)}</div>}
  </div>;
}

export default function UVWorkspace({ model, materialModel = model, previewModel, revision = 0, eligibleSelection = {}, selectionByGeoset = {}, onSelectionChange,
  onWorkingSelectionChange, onUVChanges, onPreviewChanges, onUncouple, onGeosetChange, textureAssets, teamColor, preferences, onPreferences,
  draftCount = 0, onLibrary, onSavePreview, onRevertPreview, previewProps, readOnly = false, onExit }) {
  const [materialID, setMaterialID] = useState(null), [uvTool, setUVTool] = useState('select'), [foldDirection, setFoldDirection] = useState('right-to-left');
  const [selectingNew, setSelectingNew] = useState(false), [selectGeoset, setSelectGeoset] = useState(-1), [selectionDraft, setSelectionDraft] = useState({}), [hoveredGeoset, setHoveredGeoset] = useState(null);
  const [projectionPreset, setProjectionPreset] = useState({ name: '', revision: 0 });
  const [materialPreview, setMaterialPreview] = useState(null), [materialError, setMaterialError] = useState('');
  const [sidePercent, setSidePercent] = useState(() => storedLayout(LAYOUT_KEYS.side, UV_SIDE_DEFAULT, clampUVSidePercent));
  const [previewPercent, setPreviewPercent] = useState(() => storedLayout(LAYOUT_KEYS.preview, UV_PREVIEW_DEFAULT, clampUVPreviewPercent));
  const [selectPreviewPercent, setSelectPreviewPercent] = useState(() => storedLayout(LAYOUT_KEYS.selectPreview, UV_SELECT_PREVIEW_DEFAULT, clampUVPreviewPercent));
  const projectionView = useRef(null), workspaceBody = useRef(null), sidePanel = useRef(null);
  const activePreviewPercent = selectingNew ? selectPreviewPercent : previewPercent;
  const selectionKey = JSON.stringify(selectionByGeoset), eligibilityKey = JSON.stringify(eligibleSelection), draftKey = JSON.stringify(selectionDraft);
  const previewDomain = useMemo(() => previewMeshDomain(model), [model, revision]);
  const geosetOptions = useMemo(() => model.Geosets.flatMap((geoset, index) => geoset?.TVertices?.length ? [{ index, label: `Geoset ${index + 1} · Material ${(geoset.MaterialID ?? 0) + 1}` }] : []), [model, revision]);
  const selectDomain = useMemo(() => selectGeoset >= 0 && previewDomain[selectGeoset] ? { [selectGeoset]: previewDomain[selectGeoset] } : {}, [previewDomain, selectGeoset]);
  // Selecting a new area changes the material backdrop immediately, while the
  // editable UV domain grows only from vertices explicitly picked in 3D.
  const entryDomain = selectingNew && selectGeoset >= 0 ? selectDomain : eligibleSelection;
  const editingDomain = selectingNew ? selectionDraft : eligibleSelection;
  const activeSelection = selectingNew ? selectionDraft : selectionByGeoset;
  const entryDomainKey = selectingNew && selectGeoset >= 0 ? `${selectGeoset}:all` : eligibilityKey;
  const editingDomainKey = selectingNew ? draftKey : eligibilityKey;
  const activeSelectionKey = selectingNew ? draftKey : selectionKey;
  const materialEntries = useMemo(() => relevantUVMaterials(materialModel, entryDomain), [materialModel, revision, entryDomainKey]);
  const current = materialEntries.find(entry => entry.materialID === materialID) || materialEntries[0] || null;

  useEffect(() => {
    if (!current) { setMaterialID(null); return; }
    if (materialID !== current.materialID) setMaterialID(current.materialID);
  }, [current?.materialID, materialID]);

  useEffect(() => { rememberLayout(LAYOUT_KEYS.side, sidePercent); }, [sidePercent]);
  useEffect(() => { rememberLayout(LAYOUT_KEYS.preview, previewPercent); }, [previewPercent]);
  useEffect(() => { rememberLayout(LAYOUT_KEYS.selectPreview, selectPreviewPercent); }, [selectPreviewPercent]);
  useEffect(() => { if (!selectingNew) setHoveredGeoset(null); }, [selectingNew]);

  const materialSelection = useMemo(() => {
    const result = {};
    for (const index of current?.geosetIndices || []) result[index] = unique(activeSelection[index]).filter(id => editingDomain[index]?.includes(id));
    return result;
  }, [current?.materialID, activeSelectionKey, editingDomainKey]);
  const materialSelectionKey = JSON.stringify(materialSelection);
  const combined = useMemo(() => current ? combineUVGeosets(model, current.geosetIndices, editingDomain, materialSelection, current.coordId) : null,
    [model, revision, current?.materialID, current?.coordId, editingDomainKey, materialSelectionKey]);
  const materialSignature = current ? JSON.stringify({ material: materialModel.Materials?.[current.materialID], textures: current.layers.map(layer => layer.texture) }) : '';

  useEffect(() => {
    let cancelled = false; setMaterialError(''); setMaterialPreview(null);
    if (!current || !preferences?.graphics?.textures) return;
    renderUVMaterialTexture(materialModel, current.materialID, textureAssets, { teamColor }).then(value => { if (!cancelled) setMaterialPreview(value); }).catch(cause => { if (!cancelled) setMaterialError(cause.message); });
    return () => { cancelled = true; };
  }, [current?.materialID, materialSignature, textureAssets, teamColor, preferences?.graphics?.textures]);

  const display = normalizeUVPreviewDisplay(preferences?.uvPreviewDisplay), uvGrid = normalizeUVGrid(preferences?.uvGrid), liveView = display.mesh === 'selected';
  // UV-grid preferences belong only to the 2D texture canvas. Keep the 3D
  // renderer's preference object stable while a grid control is adjusted.
  const previewPreferencesInput = { ...(preferences || {}) }; delete previewPreferencesInput.uvGrid;
  const previewPreferencesKey = JSON.stringify(previewPreferencesInput);
  const previewPreferences = useMemo(() => previewPreferencesInput, [previewPreferencesKey]);
  const liveOverlay = selectingNew
    ? { allMesh: true, interactiveSelection: true, highlightSelection: false, size: Math.max(1, display.size), color: preferences?.visuals?.uvSelection, eligibleByGeoset: selectDomain, selectionByGeoset: selectionDraft }
    : uvPreviewOverlay(previewDomain, materialSelection, null, { ...display, mesh: liveView ? 'selected' : 'none' }, preferences?.visuals?.uvSelection);

  const dispatch = (kind, value) => window.dispatchEvent(new CustomEvent('mdlvis-uv-action', { detail: { kind, value } }));
  const chooseMaterial = value => {
    const id = Number(value), entry = materialEntries.find(item => item.materialID === id); setMaterialID(id); setUVTool('select'); onPreviewChanges?.(null);
    if (entry?.geosetIndices.length) onGeosetChange?.(entry.geosetIndices[0], entry.coordId);
  };
  const selectCombined = ids => {
    if (!combined || !current) return;
    const chosen = new Set(ids), next = { ...activeSelection };
    for (const index of current.geosetIndices) next[index] = [];
    combined.refs.forEach((ref, index) => { if (chosen.has(index)) (next[ref.geosetIndex] ||= []).push(ref.vertexIndex); });
    if (selectingNew) setSelectionDraft(next); else onSelectionChange?.(next);
  };
  const applyCombined = (values, preview = false, label = 'Edit UV coordinates') => {
    if (!combined || readOnly || selectingNew) return;
    const changes = splitCombinedUV(model, combined.refs, values, current.coordId);
    (preview ? onPreviewChanges : onUVChanges)?.(changes, label);
  };
  const selectedForCurrent = Object.fromEntries(Object.entries(materialSelection).filter(([, ids]) => ids.length));
  const currentSelectionCount = selectedCount(selectedForCurrent);
  const toolState = uvToolState({ readOnly, selectingNew, selectionCount: currentSelectionCount, draftCount });
  useEffect(() => {
    const action = event => {
      if (selectingNew) return;
      const { kind, value } = event.detail || {};
      if (kind === 'tool' && ['select','move','rotate','scale'].includes(value)) setUVTool(value);
      if (kind === 'uncouple' && toolState.uncouple) onUncouple?.(selectedForCurrent, current?.coordId || 0);
    };
    window.addEventListener('mdlvis-uv-action', action);
    return () => window.removeEventListener('mdlvis-uv-action', action);
  }, [selectingNew, toolState.uncouple, materialSelectionKey, onUncouple]);
  const project = () => {
    const view = projectionView.current; if (!view || readOnly || !selectedCount(selectedForCurrent)) return;
    try {
      const changes = Object.entries(selectedForCurrent).map(([index, ids]) => ({ geosetIndex: Number(index), uvSet: current.coordId,
        values: projectUVFromView(model.Geosets[index], ids, view.viewMatrix, view.projectionMatrix, model.Geosets[index].TVertices[current.coordId]) }));
      onUVChanges?.(changes, 'Project UVs from model view');
    } catch (cause) { setMaterialError(cause.message); }
  };
  const beginSelectNew = () => { if (!geosetOptions.length) return; setHoveredGeoset(null); setSelectGeoset(-1); setSelectionDraft({}); setUVTool('select'); setSelectingNew(true); };
  const changeSelectGeoset = index => { setSelectGeoset(index); setSelectionDraft({ [index]: [] }); setMaterialID(materialModel.Geosets[index]?.MaterialID); onGeosetChange?.(index, relevantUVMaterials(materialModel, { [index]: previewDomain[index] })[0]?.coordId || 0); };
  const finishSelectNew = () => {
    const ids = unique(selectionDraft[selectGeoset]); if (!ids.length) { setMaterialError('Select at least one vertex in the model preview.'); return; }
    const next = { [selectGeoset]: ids }; onWorkingSelectionChange?.(next); onSelectionChange?.(next); onGeosetChange?.(selectGeoset, relevantUVMaterials(materialModel, next)[0]?.coordId || 0); setMaterialID(materialModel.Geosets[selectGeoset].MaterialID); setHoveredGeoset(null); setSelectingNew(false);
  };
  const cancelSelectNew = () => { setHoveredGeoset(null); setSelectGeoset(-1); setSelectionDraft({}); setSelectingNew(false); };
  const clearSelectNew = () => selectGeoset >= 0 && setSelectionDraft({ [selectGeoset]: [] });
  const chooseProjectionPreset = name => { if (name) setProjectionPreset(previous => ({ name, revision: previous.revision + 1 })); };
  const selectNewCount = selectGeoset >= 0 ? unique(selectionDraft[selectGeoset]).length : 0;
  const selectNewPrompt = selectGeoset < 0 ? 'Select a new geoset to work with' : selectNewCount ? 'Confirm Selection?' : 'Select new vertices to work with or a different geoset';
  const setActivePreviewPercent = value => (selectingNew ? setSelectPreviewPercent : setPreviewPercent)(clampUVPreviewPercent(value));
  const changeLiveDisplay = change => onPreferences?.({ ...preferences, uvPreviewDisplay: { ...display, ...change } });
  const changeLiveColor = color => onPreferences?.({ ...preferences, visuals: { ...preferences.visuals, uvSelection: color } });
  const changeUVGrid = value => onPreferences?.({ ...preferences, uvGrid: value });

  return <div className="uv-workspace" aria-label="UV wrapper workspace">
    <header className="uv-workspace-header" style={{ '--uv-side-width': `${sidePercent}%` }}>
      <div className="uv-map-header"><strong>UV Wrapper</strong><UVGridControls value={uvGrid} onChange={changeUVGrid}/></div>
      <div className="uv-header-divider" aria-hidden="true"/>
      <div className="uv-header-actions"><label>Material <select aria-label="UV material" value={current?.materialID ?? ''} disabled={selectingNew} onChange={event => chooseMaterial(event.target.value)}>{materialEntries.map(entry => <option key={entry.materialID} value={entry.materialID}>{entry.label}</option>)}</select></label><span className="uv-material-summary">{current ? `${current.geosetIndices.length} geoset${current.geosetIndices.length === 1 ? '' : 's'} · UV ${current.coordId}` : 'No material for this selection'}</span><button disabled={readOnly} onClick={onLibrary}>Replace Texture…</button>{draftCount > 0 && <><button disabled={readOnly} onClick={onSavePreview}>Save texture</button><button disabled={readOnly} onClick={onRevertPreview}>Revert texture</button></>}<button onClick={onExit}>Exit UV Wrapper</button></div>
    </header>
    {(materialError || materialPreview?.warnings?.length > 0) && <div className="uv-workspace-warning" role="status">{materialError || materialPreview.warnings.join(' · ')}</div>}
    <div ref={workspaceBody} className="uv-workspace-body" style={{ '--uv-side-width': `${sidePercent}%` }}>
      <section className="uv-map-pane" aria-label="UV texture map">
        {combined?.eligibleVertices.length ? <UVEditor key={`${current.materialID}:${current.coordId}`} geoset={combined.geoset} uvSet={0} revision={revision} textureUrl={materialPreview?.url} textureSize={materialPreview ? [materialPreview.width, materialPreview.height] : undefined}
          eligibleVertices={combined.eligibleVertices} selectedVertices={combined.selectedVertices} transformMode={uvTool} cameraMode="work" preferences={preferences} suspended={readOnly || selectingNew}
          uvGrid={uvGrid} showTextureFrame={display.textureFrame} textureFrameColor={preferences?.visuals?.uvSelection}
          onSelectVertices={selectCombined} onChange={values => applyCombined(values)} onPreviewChange={values => values ? applyCombined(values, true) : onPreviewChanges?.(null)} />
          : <div className="classic-empty-view">Select textured vertices before opening the UV wrapper.</div>}
        <div className="uv-texture-caption">{materialPreview?.layerCount ? `${current?.label} · ${materialPreview.layerCount} rendered layer${materialPreview.layerCount === 1 ? '' : 's'} · seamless tiled view` : current?.label || 'No material loaded'}</div>
      </section>
      <Splitter orientation="vertical" label="Resize texture and live-view columns" value={sidePercent} minimum={UV_SIDE_MIN} maximum={UV_SIDE_MAX} defaultValue={UV_SIDE_DEFAULT}
        onValue={value => setSidePercent(clampUVSidePercent(value))} onPointerValue={event => { const rect = workspaceBody.current?.getBoundingClientRect(); if (rect) setSidePercent(uvSidePercentAtPointer(event.clientX, rect)); }}/>
      <aside ref={sidePanel} className={`uv-side-panel${selectingNew ? ' selecting-new' : ''}`} style={{ '--uv-preview-height': `${activePreviewPercent}%`, '--uv-selection-color': preferences?.visuals?.uvSelection || '#ff3030' }}>
        <section className="uv-live-options" aria-label="Live view options"><div className="uv-panel-title"><strong>Live View</strong></div>
          <div className="uv-live-toggles">
            <label><input aria-label="Highlight selected vertices in live preview" type="checkbox" checked={liveView} onChange={event => changeLiveDisplay({ mesh: event.target.checked ? 'selected' : 'none' })}/>Highlight Live</label>
            <label><input aria-label="Highlight texture frame" type="checkbox" checked={display.textureFrame} onChange={event => changeLiveDisplay({ textureFrame: event.target.checked })}/>Highlight Texture Frame</label>
          </div>
          <label className="uv-thickness"><span>Thickness</span><input aria-label="Live selection thickness" type="range" min="0.25" max="3" step="0.25" value={display.size} onChange={event => changeLiveDisplay({ size: Number(event.target.value) })}/><output>{display.size.toFixed(2)}×</output><input className="uv-color-button" aria-label="Live selection and texture-frame color" title="Choose live selection and texture-frame color" type="color" value={preferences?.visuals?.uvSelection || '#ff3030'} onChange={event => changeLiveColor(event.target.value)}/></label>
        </section>
        <section className="uv-live-preview" aria-label={selectingNew ? 'Select new vertices' : 'Live model preview'}>
          <div className="uv-panel-title"><strong>{selectingNew ? selectNewPrompt : 'Live Model Preview'}</strong>{selectingNew && selectNewCount > 0 ? <span className="uv-confirm-selection"><button onClick={finishSelectNew}>Yes</button><button onClick={clearSelectNew}>No</button></span> : selectingNew && <span className="uv-selection-hint">Drag selects · Shift/Ctrl modifies · Alt+drag rotates</span>}</div>
          <div className="uv-preview-canvas"><Suspense fallback={<div className="classic-empty-view">Loading preview…</div>}><GamePreview {...previewProps} preferences={previewPreferences} revision={0} presentation="preview" preserveCameraView={true} interactivePreview={selectingNew} restPose={true} model={previewModel} sequenceIndex={-1} time={0} playing={false} showParticles={false} previewOverlay={liveOverlay}
            selectionByGeoset={selectionDraft} selectableGeosets={selectingNew && selectGeoset >= 0 ? [selectGeoset] : []} onSelectionChange={selectingNew && selectGeoset >= 0 ? next => setSelectionDraft({ [selectGeoset]: unique(next[selectGeoset]) }) : undefined}
            hoveredGeoset={selectingNew ? hoveredGeoset : null} cameraMode={selectingNew ? 'work' : previewProps?.cameraMode} transformMode="select" cameraPresetRequest={projectionPreset} onProjectionViewChange={value => { projectionView.current = value; }} /></Suspense></div>
          <div className="uv-preview-footer">
            {selectingNew ? <><GeosetPicker options={geosetOptions} value={selectGeoset} attention={selectGeoset < 0} onChoose={changeSelectGeoset} onHover={setHoveredGeoset}/><span className="uv-selection-count">{selectNewCount} selected</span><button disabled={!selectNewCount} onClick={finishSelectNew}>Done</button><button onClick={cancelSelectNew}>Cancel</button></>
              : <button onClick={beginSelectNew}>Select New</button>}
          </div>
        </section>
        <Splitter orientation="horizontal" label="Resize live model preview" value={activePreviewPercent} minimum={UV_PREVIEW_MIN} maximum={UV_PREVIEW_MAX} defaultValue={selectingNew ? UV_SELECT_PREVIEW_DEFAULT : UV_PREVIEW_DEFAULT}
          onValue={setActivePreviewPercent} onPointerValue={event => { const rect = sidePanel.current?.getBoundingClientRect(); if (rect) setActivePreviewPercent(uvPreviewPercentAtPointer(event.clientY, rect)); }}/>
        <div className="uv-side-controls">
          <section className="uv-projection" aria-label="UV projection"><div className="uv-panel-title"><strong>Projection</strong></div><p>Rotate the model to the required viewpoint, or choose a standard projection plane.</p><div className="uv-projection-actions"><button disabled={readOnly || selectingNew || !currentSelectionCount} onClick={project}>Project from Current View</button><select aria-label="Standard projection view" defaultValue="" onChange={event => { chooseProjectionPreset(event.target.value); event.target.value = ''; }}><option value="">Standard…</option>{STANDARD_PROJECTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Angled projection view" defaultValue="" onChange={event => { chooseProjectionPreset(event.target.value); event.target.value = ''; }}><option value="">Angled…</option>{ANGLED_PROJECTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div></section>
          <section className="uv-toolbox" aria-label="UV tools"><div className="uv-panel-title"><strong>Tools</strong></div><div className="uv-tool-grid">
            <Tool action="select" icon="sb_select" label="Select" active={uvTool === 'select'} disabled={selectingNew} onClick={() => setUVTool('select')}/>
            <Tool action="translate" icon="sb_move" label="Move" active={uvTool === 'move'} disabled={!toolState.move} onClick={() => setUVTool('move')}/>
            <Tool action="rotate" icon="sb_rot" label="Rotate" active={uvTool === 'rotate'} disabled={!toolState.rotate} onClick={() => setUVTool('rotate')}/>
            <Tool action="scale" icon="sb_zoom" label="Zoom" active={uvTool === 'scale'} disabled={!toolState.scale} onClick={() => setUVTool('scale')}/>
            <Tool action="uv:flip-u" icon="sb_mirror" iconClass="uv-icon-mirror-x" label="Mirror by X" disabled={!toolState.mirror} onClick={() => dispatch('flip-u')}/>
            <Tool action="uv:flip-v" icon="sb_mirror" label="Mirror by Y" disabled={!toolState.mirror} onClick={() => dispatch('flip-v')}/>
            <Tool action="Collapse" label="Collapse" disabled={!toolState.collapse} onClick={() => dispatch('collapse')}/>
            <Tool action="Uncouple" icon="sb_uncouple" label="Uncouple selected face corners" disabled={!toolState.uncouple} onClick={() => onUncouple?.(selectedForCurrent, current?.coordId || 0)}/>
            <div className="uv-fold-control"><Tool action="uv:fold" iconNode={<FoldIcon/>} label="Fold" disabled={!toolState.fold} onClick={() => dispatch('fold', foldDirection)}/><select aria-label="Fold direction" value={foldDirection} onChange={event => setFoldDirection(event.target.value)}><option value="right-to-left">Right → left</option><option value="left-to-right">Left → right</option><option value="bottom-to-top">Bottom → top</option><option value="top-to-bottom">Top → bottom</option></select></div>
          </div></section>
        </div>
      </aside>
    </div>
  </div>;
}
