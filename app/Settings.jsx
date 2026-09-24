import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { DEFAULT_PAINT_APPEARANCE } from '../src/paint-appearance.js';
import { APPLICATION_THEMES } from '../src/preferences.js';
import { LIGHTING_PRESETS } from '../src/preview-lighting.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { assignHotkey, CAMERA_PRESETS, chordFromEvent, DEFAULT_PREFERENCES, DEFAULT_VISUALS, effectiveBindings, formatChord, GRAPHICS_PRESETS, GRID_PRESETS, hotkeyConflicts, normalizePreferences } from '../src/preferences.js';
import { useWarmKeys } from './WarmKeys.jsx';
import { WarmKeySequence, WARMKEY_LEADER } from '../src/warmkey-defaults.js';
import { BUILT_IN_VIEWPORT_PRESETS, MAX_VIEWPORT_BACKGROUND_DATA_LENGTH, MAX_VIEWPORT_PRESETS, viewportPresetById } from '../src/viewport-appearance.js';
import { wireDashArray } from '../src/wire-pattern.js';
import './settings.css';

function Toggle({ id, label, checked, onChange, description }) {
  return <label className="settings-toggle"><input data-warmkey={id} data-warmkey-label={label} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/><span>{label}{description && <small>{description}</small>}</span></label>;
}
function Numeric({ id, label, value, min, max, step = 1, onChange, unit = '' }) {
  return <label className="settings-number"><span>{label}</span><span><input data-warmkey={id} aria-label={label} type="number" min={min} max={max} step={step} value={value} onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber); }}/>{unit}</span></label>;
}
const VISUAL_COLORS = [['background', 'Viewport background'], ['vertex', 'Vertices'], ['selectedVertex', 'Selected vertices'], ['occludedVertex', 'Occluded vertices'], ['wireframe', 'Wireframe lines'], ['occludedWireframe', 'Occluded wireframe'], ['selectedGeometry', 'Selected geometry'], ['gridMinor', 'Minor grid'], ['gridMajor', 'Major grid'], ['axisX', 'X axis'], ['axisY', 'Y axis'], ['axisZ', 'Z axis'], ['keyframe', 'Keyframes'], ['activeKeyframe', 'Active keyframe'], ['bone', 'Bones and helper bones'], ['node', 'Attachment refs and nodes'], ['particle', 'Particle emitters'], ['event', 'Event objects'], ['selection', 'Selection overlay'], ['uvSelection', 'UV live selection']];
const APPEARANCE_HELPER_COLORS = VISUAL_COLORS.filter(([key]) => ['keyframe', 'activeKeyframe', 'bone', 'node', 'particle', 'event', 'selection', 'uvSelection'].includes(key));

function WireLinePreview({ wire, background, label }) {
  const dash = wireDashArray(wire).join(' ');
  return <svg className="settings-appearance-preview settings-wire-preview" viewBox="0 0 96 22" role="img" aria-label={`${label} wire line preview`} focusable="false" style={{backgroundColor:background}}>
    <line x1="6" y1="11" x2="90" y2="11" stroke={wire.color} strokeWidth={wire.thickness} strokeOpacity={wire.opacity} strokeDasharray={dash || undefined} strokeLinecap={wire.style === 'dotted' ? 'round' : 'butt'}/>
  </svg>;
}

function VertexMarkerPreview({ marker, background, label }) {
  const half = marker.size / 2, centerX = 48, centerY = 11;
  const shape = marker.style === 'circle'
    ? <circle cx={centerX} cy={centerY} r={half}/>
    : marker.style === 'diamond'
      ? <polygon points={`${centerX},${centerY - half} ${centerX + half},${centerY} ${centerX},${centerY + half} ${centerX - half},${centerY}`}/>
      : <rect x={centerX - half} y={centerY - half} width={marker.size} height={marker.size}/>;
  return <svg className="settings-appearance-preview settings-marker-preview" viewBox="0 0 96 22" role="img" aria-label={`${label} marker preview`} focusable="false" style={{backgroundColor:background}}>
    <g fill={marker.color}>{shape}</g>
  </svg>;
}

function AssetPreload({ modelPath }) {
  const [status, setStatus] = useState({ state: 'idle' }), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), cancelChoice = useRef(null), trigger = useRef(null);
  const available = !!window.desktop?.textureLibraryPreloadStart;
  const update = next => { if (mounted.current && next) setStatus(previous => previous.updatedAt && next.updatedAt < previous.updatedAt ? previous : next); };
  useEffect(() => {
    mounted.current = true;
    if (!available) return () => { mounted.current = false; };
    const unsubscribe = window.desktop.onTextureLibraryPreloadProgress?.(update);
    window.desktop.textureLibraryPreloadStatus().then(update).catch(cause => { if (mounted.current) setError(cause.message); });
    return () => { mounted.current = false; unsubscribe?.(); };
  }, [available]);
  useEffect(() => { if (confirm) cancelChoice.current?.focus(); }, [confirm]);
  const running = ['indexing', 'running'].includes(status.state);
  const decline = () => { setConfirm(false); trigger.current?.focus(); };
  const request = async cancel => {
    if (busy) return; setBusy(true); setError(''); setConfirm(false);
    try {
      const next=await (cancel ? window.desktop.textureLibraryPreloadCancel({ jobId: status.jobId }) : window.desktop.textureLibraryPreloadStart({ modelPath }));
      update(next);
      if(!cancel && ['indexing','running','complete'].includes(next?.state))void import('./TextureLibrary.jsx').then(module=>module.warmTextureLibrary(modelPath)).catch(()=>{});
    }
    catch (cause) { if (mounted.current) setError(cause.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  const titles = { idle: 'No preload is running.', indexing: 'Finding available textures…', running: 'Preparing texture previews…', complete: 'Asset preload finished.', cancelled: 'Preload stopped. Completed previews are kept.', error: 'Asset preload could not finish.' };
  return <section className="settings-preload" aria-label="Preload Assets">
    <h3>Preload Assets</h3><p>Prepare local texture previews once for faster library browsing. Cached previews remain available after restarting MDLxL.</p>
    <button ref={trigger} data-warmkey="game-data:preload" disabled={!available || running || busy || confirm} onClick={() => setConfirm(true)}>Preload Assets</button>
    {!available && <p className="settings-hint">Asset preloading is available in the desktop app.</p>}
    {confirm && <div className="settings-preload-confirm" role="group" aria-label="Confirm asset preload" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); decline(); } }}>
      <strong>Preload all available asset previews?</strong><p>This reads the available texture library and saves thumbnails locally. The first run can take time and use disk space. You can continue editing or close Settings while it runs. Cancel stops the run and keeps completed previews; a later run reuses them. Imported textures keep their original Warcraft paths.</p>
      <div className="settings-inline-actions"><button disabled={busy} onClick={() => request(false)}>Yes</button><button ref={cancelChoice} onClick={decline}>No</button></div>
    </div>}
    <div className="settings-preload-status" role="status" aria-live="polite">
      <p>{titles[status.state] || titles.idle}</p>
      {(running || status.total > 0) && <><progress aria-label="Asset preload progress" max={Math.max(1, status.total || 0)} value={status.state === 'indexing' ? undefined : Math.min(status.total || 0, status.completed || 0)}/><p>{(status.completed || 0).toLocaleString()} / {(status.total || 0).toLocaleString()} processed · {(status.cached || 0).toLocaleString()} reused · {(status.failed || 0).toLocaleString()} unavailable{status.bytes > 0 ? ` · ${(status.bytes / 1048576).toFixed(1)} MB cached` : ''}</p></>}
      {running && status.current && <code title={status.current}>{status.current}</code>}
    </div>
    {running && <button disabled={busy} onClick={() => request(true)}>Cancel preload</button>}
    {error && <p className="settings-preload-error" role="alert">{error}</p>}
    {status.errors?.length > 0 && <details className="settings-preload-errors"><summary>Unavailable previews ({status.failed || status.errors.length})</summary><ul>{status.errors.slice(0, 12).map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.message || item.path || 'Preview unavailable'}</li>)}</ul><p>Run Preload Assets again to retry unavailable previews.</p></details>}
  </section>;
}

export default function Settings({ preferences, onChange, onClose, catalog: suppliedCatalog, initialTab = 'mouse', gameDataPath = '', modelPath = null, onChooseGameData, onClearGameData }) {
  const context = useWarmKeys(), catalog = suppliedCatalog || context.catalog;
  const prefs = normalizePreferences(preferences);
  const [tab, setTab] = useState(initialTab), [search, setSearch] = useState(''), [category, setCategory] = useState('All categories');
  const [recording, setRecording] = useState(null), [recorded, setRecorded] = useState(''), [message, setMessage] = useState(''), [resetConfirm, setResetConfirm] = useState(false), [presetName, setPresetName] = useState('');
  const [sequenceCode, setSequenceCode] = useState(null), sequence = useRef(null), sequenceTimer = useRef(null);
  if (!sequence.current) sequence.current = new WarmKeySequence();
  const configInput = useRef(null), platformInput = useRef(null), viewportImageInput = useRef(null), quadImageInput = useRef(null);
  const recorder = useRef(null), panel = useRef(null), previousFocus = useRef(null);
  const bindings = useMemo(() => effectiveBindings(catalog, prefs.hotkeys), [catalog, preferences?.hotkeys]);
  const categories = [...new Set(catalog.map(action => action.category || 'Controls'))].sort();
  const actions = catalog.filter(action => (category === 'All categories' || (action.category || 'Controls') === category) && `${action.label} ${action.id} ${action.category} ${(bindings[action.id] || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.label || a.id).localeCompare(b.label || b.id));
  const conflicts = recorded && recording ? hotkeyConflicts(catalog, prefs.hotkeys, recording.id, recorded) : [];
  const labelFor = id => catalog.find(action => action.id === id)?.label || id;
  const commit = change => onChange(normalizePreferences({ ...prefs, ...change }));
  const graphic = change => commit({ graphics: { ...prefs.graphics, ...change } });
  const visual = change => commit({ visuals: { ...prefs.visuals, ...change } });
  const viewport = change => commit({ viewportPreset: 'custom', viewportAppearance: { ...prefs.viewportAppearance, ...change } });
  const viewportPart = (part, change) => viewport({ [part]: { ...prefs.viewportAppearance[part], ...change } });
  const quadPart = (part, change) => viewportPart('quadView', { [part]: { ...prefs.viewportAppearance.quadView[part], ...change } });
  const grid = change => commit({ grid: { ...prefs.grid, ...change } });
  useEffect(() => {
    previousFocus.current = document.activeElement;
    panel.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus();
    return () => { if (previousFocus.current?.isConnected) previousFocus.current.focus(); };
  }, []);
  useEffect(() => { sequence.current.cancel(); clearTimeout(sequenceTimer.current); setSequenceCode(null); if (recording) recorder.current?.focus(); }, [recording]);
  useEffect(() => () => clearTimeout(sequenceTimer.current), []);
  useEffect(() => { setTab(initialTab); setRecording(null); setMessage(''); }, [initialTab]);
  const startRecording = action => { setRecording(action); setRecorded(''); setMessage(''); setResetConfirm(false); };
  const cancelSequence = () => { if (!sequence.current.active) return; sequence.current.cancel(); clearTimeout(sequenceTimer.current); setSequenceCode(null); setRecorded(''); setMessage('Sequence cancelled. Press a combination or the leader to try again.'); };
  const recordKey = event => {
    event.preventDefault(); event.stopPropagation();
    if (event.repeat) return;
    const key = chordFromEvent(event);
    if (sequence.current.active || key === WARMKEY_LEADER) {
      const next = sequence.current.feed(event);
      clearTimeout(sequenceTimer.current); setSequenceCode(next.pending ? next.code : null); setRecorded(next.chord); setMessage(next.cancelled ? 'Sequence cancelled.' : '');
      if (next.pending) sequenceTimer.current = setTimeout(cancelSequence, sequence.current.timeoutMs);
      return;
    }
    if (key) { setRecorded(key); setMessage(''); }
    else setMessage('Press a key together with any modifiers. Modifier keys alone cannot be assigned.');
  };
  const applyShortcut = replace => {
    const result = assignHotkey(prefs.hotkeys, catalog, recording.id, recorded, { replace });
    if (!result.ok) { setMessage(result.error); return; }
    commit({ hotkeys: result.hotkeys }); setMessage(`${formatChord(recorded)} assigned to ${recording.label || recording.id}.`); setRecording(null); setRecorded('');
  };
  const removeShortcut = (id, chord) => { commit({ hotkeys: { ...prefs.hotkeys, [id]: (bindings[id] || []).filter(key => key !== chord) } }); setMessage(`Removed ${formatChord(chord)} from ${labelFor(id)}.`); };
  const restoreAction = action => {
    const next = { ...prefs.hotkeys }; delete next[action.id];
    const collision = (action.defaultKeys || []).flatMap(chord => hotkeyConflicts(catalog, next, action.id, chord));
    if (collision.length) { setMessage(`Cannot restore ${action.label}: a default shortcut is assigned to ${[...new Set(collision)].map(labelFor).join(', ')}. Clear that assignment first, or use Add shortcut and replace it.`); return; }
    commit({ hotkeys: next }); setMessage(`Restored defaults for ${action.label || action.id}.`);
  };
  const exportSettings = () => {
    const url=URL.createObjectURL(new Blob([JSON.stringify(exportConfiguration(prefs),null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='MDLxL-configuration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const loadConfiguration=async file=>{try{if(!file)return;if(file.size>4000000)throw new Error('Configuration exceeds 4 MB.');const next=importConfiguration(await file.text());const bindings=effectiveBindings(catalog,next.hotkeys),seen=new Map();for(const [id,keys] of Object.entries(bindings))for(const key of keys){if(seen.has(key))throw new Error('Conflicting shortcut '+key+'.');seen.set(key,id);}onChange(next);setMessage('Configuration imported. Portable settings replaced.');}catch(error){setMessage(error.message);}};
  const loadPlatformTexture=async file=>{try{if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2000000)throw new Error('Choose a PNG, JPEG or WebP under 2 MB.');const reader=new FileReader();reader.onload=()=>commit({platform:{...prefs.platform,textureUrl:reader.result}});reader.readAsDataURL(file);}catch(error){setMessage(error.message);}};
  const loadViewportBackground = async (file, quad = false) => {
    try {
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8_000_000) throw new Error('Choose a PNG, JPEG or WebP under 8 MB.');
      const imageData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('The background image could not be read.')); reader.readAsDataURL(file); });
      if (typeof imageData !== 'string' || imageData.length > MAX_VIEWPORT_BACKGROUND_DATA_LENGTH) throw new Error('The encoded background image is too large to save safely.');
      (quad ? quadPart : viewportPart)('background', { type: 'image', imageData, imageName: file.name }); setMessage(`Background image loaded: ${file.name}`);
    } catch (error) { setMessage(error.message); }
  };
  const applyViewportPreset = id => {
    const preset = viewportPresetById(id, prefs.viewportPresets);
    if (!preset) return;
    commit({ viewportPreset: id, viewportAppearance: preset.appearance, ...(preset.theme ? { theme: preset.theme, accent: APPLICATION_THEMES[preset.theme].accent } : {}) }); setMessage(`${preset.name} loaded.`);
  };
  const saveViewportPreset = () => {
    const name = presetName.trim();
    if (!name) { setMessage('Enter a name for the custom viewport preset.'); return; }
    if (prefs.viewportPresets.length >= MAX_VIEWPORT_PRESETS) { setMessage(`You can save up to ${MAX_VIEWPORT_PRESETS} custom viewport presets.`); return; }
    if ([...Object.values(BUILT_IN_VIEWPORT_PRESETS), ...prefs.viewportPresets].some(preset => preset.name.toLowerCase() === name.toLowerCase())) { setMessage('A viewport preset with that name already exists.'); return; }
    const id = `custom-${Date.now().toString(36)}`;
    commit({ viewportPreset: id, viewportPresets: [...prefs.viewportPresets, { id, name, appearance: prefs.viewportAppearance }] });
    setPresetName(''); setMessage(`${name} saved.`);
  };
  const deleteViewportPreset = () => {
    if (!String(prefs.viewportPreset).startsWith('custom-')) return;
    const removed = prefs.viewportPresets.find(preset => preset.id === prefs.viewportPreset);
    commit({ viewportPreset: 'custom', viewportPresets: prefs.viewportPresets.filter(preset => preset.id !== prefs.viewportPreset) });
    setMessage(`${removed?.name || 'Custom preset'} deleted. Current appearance was kept.`);
  };
  const trapFocus = event => {
    if (event.key === 'Escape' && !event.target.closest('[data-warmkey-recording]')) { event.preventDefault(); event.stopPropagation(); if (recording) setRecording(null); else onClose(); return; }
    if (event.key !== 'Tab' || event.target.closest('[data-warmkey-recording]')) return;
    const focusable = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="classic-modal settings-overlay" data-warmkey-scope="settings"><section ref={panel} className="classic-modal-window settings-window" role="dialog" aria-modal="true" aria-label="Settings" data-warmkey-scope="settings" data-warmkey-prefix="settings" data-warmkey-category="Settings" onKeyDown={trapFocus}>
    <header><span>Settings</span><button data-warmkey="close" aria-label="Close Settings" onClick={onClose}>×</button></header>
    <div className="settings-tabs" role="tablist" aria-label="Settings pages">{[['mouse', 'Mouse'], ['warmkeys', 'Hotkeys'], ['graphics', 'Graphics'], ['capture', 'Capture'], ['visuals', 'Appearance'], ['configuration','Configuration'], ['grid', 'Grid'], ['gameData', 'Warcraft III']].map(([id, label]) => <button key={id} id={`settings-tab-${id}`} data-warmkey={`tab:${id}`} role="tab" aria-selected={tab === id} aria-controls={`settings-panel-${id}`} onClick={() => { setTab(id); setRecording(null); setMessage(''); }}>{label}</button>)}</div>
    <div className="classic-modal-body settings-body" role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
      {tab === 'mouse' && <div className="settings-page">
        <h3>Camera controls</h3><p>Choose camera navigation buttons. Left mouse continues to use the active camera or editing tool.</p>
        <div className="settings-inline-actions"><span>Preset:</span><button data-warmkey="mouse:preset:classic" onClick={() => commit(CAMERA_PRESETS.classic)}>Classic MDLVis</button><button data-warmkey="mouse:preset:orbit" onClick={() => commit(CAMERA_PRESETS.orbit)}>Orbit navigation</button></div>
        <div className="settings-graphics-grid">{[['right', 'Right mouse'], ['middle', 'Middle mouse']].map(([key, label]) => <label className="settings-select" key={key}><span>{label}</span><select data-warmkey={`mouse:binding:${key}`} aria-label={`${label} camera action`} value={prefs.cameraBindings[key]} onChange={event => commit({ cameraBindings: { ...prefs.cameraBindings, [key]: event.target.value } })}>{(key === 'middle' ? [['toggle', 'Toggle rotation / work']] : []).concat([['pan', 'Pan'], ['rotate', 'Rotate'], ['zoom', 'Zoom'], ['none', 'No action']]).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}</div>
        <h3>Mouse wheel sensitivity</h3><p>Change how far each wheel step zooms or scrolls in the editors. Changes apply immediately and are remembered.</p>
        <div className="settings-sensitivity"><input data-warmkey="mouse:sensitivity-slider" aria-label="Mouse wheel sensitivity" type="range" min="0.1" max="10" step="0.01" value={prefs.scrollSensitivity} onChange={event => commit({ scrollSensitivity: Number(event.target.value) })}/><label><input data-warmkey="mouse:sensitivity-value" aria-label="Mouse wheel sensitivity value" type="number" min="0.1" max="10" step="0.01" value={prefs.scrollSensitivity} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) commit({ scrollSensitivity: value }); }}/><span>×</span></label></div>
        <div className="settings-range-labels"><span>Precise · 0.1×</span><span>Fast · 10×</span></div>
        <div className="settings-inline-actions" role="group" aria-label="Wheel mode">{[['rotate','Rotation / normal zoom'],['scroll','Peon · Scroll sensitivity'],['pointer','Wisp · Wheel adjusts DPI']].map(([value,label]) => <button key={value} data-warmkey={`mouse:wheel:${value}`} aria-pressed={prefs.wheelMode === value} onClick={() => commit({ wheelMode:value })}>{label}</button>)}</div>
        <p className="settings-hint">Normal mode: wheel zooms; a middle click toggles camera rotation and work mode. Peon: wheel alone adjusts scroll sensitivity. Wisp: wheel alone adjusts DPI. Hold left and scroll for a temporary DPI adjustment without changing the selected toolbar mode. Left then right resets DPI. Right then left resets scroll sensitivity.</p>
        <h3>DPI / pointer sensitivity</h3><p>Adjust 3D camera and editing drag speed inside MDLxL. UV transforms have their own sensitivity below. This multiplier does not change hardware DPI or Windows pointer settings.</p>
        <div className="settings-sensitivity"><input data-warmkey="mouse:pointer-slider" aria-label="MdlVis pointer sensitivity" type="range" min="0.01" max="4" step="0.01" value={prefs.pointerSensitivity} onChange={event => commit({ pointerSensitivity:Number(event.target.value) })}/><label><input data-warmkey="mouse:pointer-value" aria-label="MdlVis pointer sensitivity value" type="number" min="0.01" max="4" step="0.01" value={prefs.pointerSensitivity} onChange={event => { if(Number.isFinite(event.target.valueAsNumber)) commit({ pointerSensitivity:event.target.valueAsNumber }); }}/><span>×</span></label></div>
        <div className="settings-range-labels"><span>Ultra-precise · 0.01×</span><span>Fast · 4×</span></div>
        <Toggle id="mouse:right-scroll-adjust" label="Hold right mouse button + scroll to adjust sensitivity" checked={prefs.rightScrollAdjust} onChange={rightScrollAdjust => commit({ rightScrollAdjust })} description="Wheel up increases sensitivity; wheel down decreases it. Release the right button and the next wheel movement uses the new value. The value stays until you change it."/>
        <div className="settings-graphics-grid"><Numeric id="mouse:fine" label="Fine control multiplier" value={prefs.fineSensitivity} min={0.01} max={1} step={0.01} unit="×" onChange={fineSensitivity => commit({ fineSensitivity })}/><Numeric id="mouse:uv" label="UV transform sensitivity" value={prefs.uvSensitivity} min={0.01} max={4} step={0.01} unit="×" onChange={uvSensitivity => commit({ uvSensitivity })}/></div>
        <p className="settings-hint">UV movement is measured relative to the displayed texture. At 1×, UV vertices follow your pointer. Changing camera DPI leaves UV movement, rotation, and scale unchanged. For fine control, hold Alt when starting a UV drag or Shift while navigating the 3D camera.</p>
        <button data-warmkey="mouse:reset" onClick={() => commit({ ...CAMERA_PRESETS.classic, uvSensitivity: DEFAULT_PREFERENCES.uvSensitivity })}>Restore mouse defaults</button>
      </div>}
      {tab === 'warmkeys' && <div className="settings-page warmkeys-page">
        <h3>Hotkeys</h3><p>Assign a key or combination to commands, buttons, and fields. Hold Alt to show available button shortcuts; remapped combinations appear in full. Field shortcuts focus the field; toggle shortcuts switch it.</p>
        <p>Existing MdlVis shortcuts are preserved. Other controls have default sequences: press <kbd>Ctrl+Alt+Space</kbd>, release the keys, then type the three-character code listed here. Escape cancels. Peon: <kbd>Ctrl+Alt+P</kbd> · Wisp: <kbd>Ctrl+Alt+I</kbd>. You can replace any sequence with a single key or combination.</p>
        <p className="settings-hint">Resource controls appear here when their manager is opened and stay in this list after closing it. Shortcuts act only on available controls in the active window, and leave text entry alone.</p>
        <div className="warmkeys-filter"><input data-warmkey="warmkeys:search" aria-label="Search Hotkeys" placeholder="Search actions or shortcuts…" value={search} onChange={event => setSearch(event.target.value)}/><select data-warmkey="warmkeys:category" aria-label="Hotkeys category" value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select><span>{actions.length} actions</span></div>
        {recording && <div className="warmkeys-recorder" aria-label={`Assign shortcut to ${recording.label || recording.id}`}>
          <strong>Shortcut for {recording.label || recording.id}</strong><div ref={recorder} tabIndex={0} className="warmkeys-capture" data-warmkey-recording="true" aria-label="Press a key combination" onKeyDown={recordKey} onBlur={cancelSequence}>{sequenceCode !== null ? <kbd>{WARMKEY_LEADER} &gt; {sequenceCode.padEnd(3, '·')}</kbd> : recorded ? <kbd>{formatChord(recorded)}</kbd> : 'Press a combination, or Ctrl+Alt+Space followed by three letters or digits'}</div>
          {!!conflicts.length && <p className="warmkeys-conflict">{formatChord(recorded)} is assigned to <strong>{conflicts.map(labelFor).join(', ')}</strong>. Replace removes this key from those actions.</p>}
          <div className="settings-inline-actions"><button disabled={!recorded} onClick={() => applyShortcut(!!conflicts.length)}>{conflicts.length ? 'Replace existing assignment' : 'Assign shortcut'}</button><button onClick={() => { setRecording(null); setRecorded(''); }}>Cancel</button></div>
        </div>}
        <div className="warmkeys-table-wrap"><table className="warmkeys-table"><thead><tr><th>Action</th><th>Shortcut</th><th><span className="settings-sr-only">Change shortcut</span></th></tr></thead><tbody>{actions.map(action => <tr key={action.id}><td><strong>{action.label || action.id}</strong><small title={action.id}>{action.category || 'Controls'}{action.contextual ? ' · when visible' : ''}</small></td><td><div className="warmkeys-chords">{(bindings[action.id] || []).map(chord => <span className="warmkeys-chip" key={chord}><kbd>{formatChord(chord)}</kbd><button aria-label={`Remove ${formatChord(chord)} from ${action.label || action.id}`} onClick={() => removeShortcut(action.id, chord)}>×</button></span>)}{!bindings[action.id]?.length && <span className="settings-muted">Unassigned</span>}</div></td><td><div className="warmkeys-row-actions"><button aria-label={`Assign shortcut to ${action.label || action.id}`} onClick={() => startRecording(action)}>Add shortcut</button><button aria-label={`Restore default shortcuts for ${action.label || action.id}`} onClick={() => restoreAction(action)}>Reset</button></div></td></tr>)}</tbody></table>{!actions.length && <p>No actions match this search.</p>}</div>
        <div className="settings-inline-actions">{resetConfirm ? <><span>Restore every default shortcut and clear custom assignments?</span><button onClick={() => { commit({ hotkeys: {} }); setResetConfirm(false); setRecording(null); setMessage('All Hotkeys restored to defaults.'); }}>Restore all defaults</button><button onClick={() => setResetConfirm(false)}>Cancel</button></> : <button data-warmkey="warmkeys:reset-all" onClick={() => setResetConfirm(true)}>Reset all Hotkeys…</button>}</div>
      </div>}
      {tab === 'graphics' && <div className="settings-page">
        <h3>Preview lighting</h3>
        <label>Setup <select aria-label="Lighting setup" value={prefs.lighting.preset} onChange={event=>commit({lighting:{...prefs.lighting,preset:event.target.value}})}><option value="requested">Requested · 128 / 192 / 0</option><option value="legacy">Previous lighting</option><option value="custom">Custom</option></select></label>
        <div className="settings-graphics-grid">{['ambient','diffuse','specular'].map(channel=><fieldset key={channel}><legend>{channel}</legend>{['R','G','B'].map((axis,i)=><Numeric key={axis} id={`lighting:${channel}:${axis}`} label={`${channel} ${axis}`} value={prefs.lighting[channel][i]} min={0} max={255} onChange={value=>commit({lighting:{...prefs.lighting,preset:'custom',[channel]:prefs.lighting[channel].map((v,j)=>i===j?value:v)}})}/>)}</fieldset>)}</div>
        <Numeric id="lighting:power" label="Specular power" value={prefs.lighting.power} min={0} step={.1} onChange={power=>commit({lighting:{...prefs.lighting,preset:'custom',power}})}/>
        <h3>Display platform</h3><Toggle id="platform:enabled" label="Show platform" checked={prefs.platform.enabled} onChange={enabled=>commit({platform:{...prefs.platform,enabled}})}/>
        <label>Shape <select aria-label="Platform shape" value={prefs.platform.shape} onChange={event=>commit({platform:{...prefs.platform,shape:event.target.value}})}>{['square','disc','hexagon'].map(shape=><option key={shape}>{shape}</option>)}</select></label>
        <Numeric id="platform:size" label="Platform size" value={prefs.platform.size} min={.1} max={10} step={.1} unit="× model radius" onChange={size=>commit({platform:{...prefs.platform,size}})}/><Numeric id="platform:height" label="Platform height" value={prefs.platform.height} min={-100000} max={100000} onChange={height=>commit({platform:{...prefs.platform,height}})}/>
        <label>Platform color <input type="color" aria-label="Platform color" value={prefs.platform.color} onChange={event=>commit({platform:{...prefs.platform,color:event.target.value}})}/></label><input ref={platformInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{loadPlatformTexture(event.target.files[0]);event.target.value='';}}/><button onClick={()=>platformInput.current.click()}>Choose platform texture…</button><button disabled={!prefs.platform.textureUrl} onClick={()=>commit({platform:{...prefs.platform,textureUrl:''}})}>Clear texture</button>
        <h3>Graphical settings</h3><p>Use fewer visual effects to reduce rendering and texture loading work. These preferences do not change the saved model.</p>
        <div className="settings-inline-actions"><span>Preset:</span>{[['fast', 'Fast'], ['balanced', 'Balanced'], ['quality', 'High quality']].map(([id, label]) => <button key={id} data-warmkey={`graphics:preset:${id}`} onClick={() => graphic(GRAPHICS_PRESETS[id])}>{label}</button>)}</div>
        <div className="settings-graphics-grid"><label className="settings-select"><span>Render resolution</span><select data-warmkey="graphics:pixel-ratio" aria-label="Render resolution" value={prefs.graphics.pixelRatio} onChange={event => graphic({ pixelRatio: Number(event.target.value) })}><option value="1">1× · fastest</option><option value="1.5">1.5× · balanced</option><option value="2">2× · sharper</option></select><small>Maximum pixel ratio; lower values reduce GPU work.</small></label><label className="settings-select"><span>Maximum frame rate</span><select data-warmkey="graphics:max-fps" aria-label="Maximum frame rate" value={prefs.graphics.maxFps} onChange={event => graphic({ maxFps: Number(event.target.value) })}><option value="30">30 fps · lower load</option><option value="60">60 fps · balanced</option><option value="120">120 fps · smoother motion</option></select><small>Only active playback or interaction needs continuous frames.</small></label></div>
        <Toggle id="graphics:antialias" label="Smooth edges (antialiasing)" checked={prefs.graphics.antialias} onChange={antialias => graphic({ antialias })} description="Turn off to reduce rendering cost. The viewport refreshes when this changes."/>
        <Toggle id="graphics:textures" label="Load and render textures" checked={prefs.graphics.textures} onChange={textures => graphic({ textures })} description="Turn off for simpler shaded surfaces and fewer image uploads."/>
        <Toggle id="graphics:lighting" label="Lighting and reflections" checked={prefs.graphics.lighting} onChange={lighting => graphic({ lighting })} description="Shaded editor lighting and animation preview environment reflections."/>
        <Toggle id="graphics:particles" label="Particle and ribbon effects" checked={prefs.graphics.particles} onChange={particles => graphic({ particles })} description="Applies to game preview effects."/>
        <Toggle id="graphics:pause-when-hidden" label="Pause rendering and animation when the window is hidden" checked={prefs.graphics.pauseWhenHidden} onChange={pauseWhenHidden => graphic({ pauseWhenHidden })}/>
      </div>}
      {tab === 'capture' && <div className="settings-page">
        <h3>Recording and screenshots</h3><p>Capture the model with its current lighting and background. Resolution follows the viewport aspect ratio.</p>
        <label className="settings-select"><span>Recording frame rate</span><select aria-label="Recording frame rate" value={prefs.capture.fps} onChange={event => commit({capture:{...prefs.capture,fps:Number(event.target.value)}})}>{[10,15,20,24,25,30,50].map(fps=><option key={fps} value={fps}>{fps} FPS</option>)}</select></label>
        <div className="settings-graphics-grid">{[['recordingQuality','Recording quality'],['screenshotQuality','Screenshot quality']].map(([key,label])=><label className="settings-select" key={key}><span>{label}</span><select aria-label={label} value={prefs.capture[key]} onChange={event=>commit({capture:{...prefs.capture,[key]:event.target.value}})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>)}</div>
        <p>GIF: Low 720 px / 128 colors without dithering · Medium 1280 px / 256 colors · High 1920 px / 256 colors. Medium and High use Sierra dithering.</p>
        <p>PNG screenshots: Low 1280 px · Medium 1920 px · High 3840 px. PNG preserves full color without compression loss.</p>
        <p className="settings-hint">GIF uses a shared palette with up to 256 entries, including transparency for optimization. Higher quality needs more processing. Recording preserves elapsed time when capture frames are skipped and uses temporary disk space.</p>
        <Toggle id="capture:pressed-keys" label="Show pressed keys" checked={prefs.showPressedKeys} onChange={showPressedKeys=>commit({showPressedKeys})} description="Display keyboard and mouse combinations for tutorials. Text entered in fields is not shown."/>
        <button onClick={()=>commit({capture:{fps:30,recordingQuality:'medium',screenshotQuality:'medium'}})}>Restore capture defaults</button>
      </div>}
      {tab === 'visuals' && <div className="settings-page">
        <details className="settings-citadel"><summary>Citadel Paint</summary><div className="settings-appearance-grid">
          {[['brushTipLight','Brush tips — light theme'],['brushTipDark','Brush tips — dark themes'],['brushCursor','Brush cursor'],['geosetSelection','Geoset selection'],['geosetBorder','Geoset border'],['lampSelection','Selected lamp']].map(([key,label])=><label className="settings-color" key={key}><span>{label}</span><input type="color" aria-label={'Citadel '+label} value={prefs.citadelPaint[key]} onChange={e=>commit({citadelPaint:{...prefs.citadelPaint,[key]:e.target.value}})}/></label>)}
          <Numeric label="Citadel border thickness" id="citadel:borderThickness" min={1} max={6} value={prefs.citadelPaint.borderThickness} onChange={borderThickness=>commit({citadelPaint:{...prefs.citadelPaint,borderThickness}})}/>
          <button onClick={()=>commit({citadelPaint:DEFAULT_PAINT_APPEARANCE})}>Reset Citadel colours</button>
        </div></details>
        <h3>Viewport appearance</h3><p>Seven built-in presets pair viewport colors with a matching application theme. They never alter model geometry, materials, UVs, animations, or saved MDL/MDX data.</p>
        <label className="settings-select"><span>Viewport preset</span><select aria-label="Viewport appearance preset" value={prefs.viewportPreset} onChange={event => applyViewportPreset(event.target.value)}>
          {Object.values(BUILT_IN_VIEWPORT_PRESETS).map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          {prefs.viewportPreset === 'custom' && <option value="custom">Unsaved custom appearance</option>}
          {prefs.viewportPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select></label>
        <div className="settings-inline-actions"><input aria-label="Custom viewport preset name" value={presetName} maxLength={80} placeholder="Custom preset name" onChange={event => setPresetName(event.target.value)}/><button onClick={saveViewportPreset}>Save as custom preset</button>{String(prefs.viewportPreset).startsWith('custom-') && <button onClick={deleteViewportPreset}>Delete selected preset</button>}</div>
        <fieldset className="settings-appearance-group"><legend>Highlight Geoset</legend>
          <label className="settings-color"><span>Color</span><input type="color" aria-label="Highlight Geoset color" value={prefs.viewportAppearance.geosetHighlight.color} onChange={event => viewportPart('geosetHighlight', { color: event.target.value })}/><code>{prefs.viewportAppearance.geosetHighlight.color}</code></label>
          <label className="settings-select"><span>Type</span><select aria-label="Highlight Geoset type" value={prefs.viewportAppearance.geosetHighlight.type} onChange={event => viewportPart('geosetHighlight', { type: event.target.value })}><option value="wire-vertices">Wireframe with vertices</option><option value="wire">Wireframe without vertices</option><option value="fill">Filled geoset</option></select></label>
          <label><input type="checkbox" checked={prefs.viewportAppearance.geosetHighlight.viaView} disabled={!prefs.viewportAppearance.geosetHighlight.viaSelection} onChange={event => viewportPart('geosetHighlight', { viaView: event.target.checked })}/>Highlight via View</label>
          <label><input type="checkbox" checked={prefs.viewportAppearance.geosetHighlight.viaSelection} disabled={!prefs.viewportAppearance.geosetHighlight.viaView} onChange={event => viewportPart('geosetHighlight', { viaSelection: event.target.checked })}/>Highlight via Selection</label>
        </fieldset>
        <div className="settings-appearance-grid">
          {[['selectedGeoset','Selected geoset'],['otherGeoset','Other visible geosets']].map(([part,label]) => <fieldset className="settings-appearance-group" key={part}><legend>{label}</legend>
            <label className="settings-color"><span>Wire color</span><input type="color" aria-label={`${label} wire color`} value={prefs.viewportAppearance[part].color} onChange={event => viewportPart(part,{color:event.target.value})}/><code>{prefs.viewportAppearance[part].color}</code></label>
            <Numeric id={`appearance:${part}:thickness`} label="Wire thickness" value={prefs.viewportAppearance[part].thickness} min={.5} max={4} step={.25} unit="px" onChange={thickness => viewportPart(part,{thickness})}/>
            <Numeric id={`appearance:${part}:opacity`} label="Wire opacity" value={prefs.viewportAppearance[part].opacity} min={0} max={1} step={.05} onChange={opacity => viewportPart(part,{opacity})}/>
            <label className="settings-select"><span>Wire style</span><select aria-label={`${label} wire style`} value={prefs.viewportAppearance[part].style} onChange={event => viewportPart(part,{style:event.target.value})}><option value="solid">Solid</option><option value="dotted">Dotted</option><option value="dashed">Striped</option></select></label>
            {prefs.viewportAppearance[part].style !== 'solid' && <Numeric id={`appearance:${part}:spacing`} label="Line spacing" value={prefs.viewportAppearance[part].spacing} min={2} max={32} step={1} unit="px" onChange={spacing => viewportPart(part,{spacing})}/>}<WireLinePreview wire={prefs.viewportAppearance[part]} background={prefs.viewportAppearance.background.color} label={label}/>
          </fieldset>)}
          {[['selectedVertex','Selected vertices'],['unselectedVertex','Unselected vertices']].map(([part,label]) => <fieldset className="settings-appearance-group" key={part}><legend>{label}</legend>
            <label className="settings-color"><span>Marker color</span><input type="color" aria-label={`${label} color`} value={prefs.viewportAppearance[part].color} onChange={event => viewportPart(part,{color:event.target.value})}/><code>{prefs.viewportAppearance[part].color}</code></label>
            <Numeric id={`appearance:${part}:size`} label="Marker size" value={prefs.viewportAppearance[part].size} min={2} max={16} step={1} unit="px" onChange={size => viewportPart(part,{size})}/>
            <label className="settings-select"><span>Marker style</span><select aria-label={`${label} marker style`} value={prefs.viewportAppearance[part].style} onChange={event => viewportPart(part,{style:event.target.value})}><option value="square">Square</option><option value="circle">Circle</option><option value="diamond">Diamond</option></select></label>
            <VertexMarkerPreview marker={prefs.viewportAppearance[part]} background={prefs.viewportAppearance.background.color} label={label}/>
          </fieldset>)}
        </div>
        <fieldset className="settings-appearance-group" aria-label="Quadview appearance"><legend>Quadview</legend>
          <p className="settings-hint">A grid for each pane's editing plane. Zooming reveals finer subdivisions; these settings are saved in appearance presets and configuration exports.</p>
          <Toggle id="appearance:quadview:grid" label="Quadview grid" checked={prefs.viewportAppearance.quadView.grid.enabled} onChange={enabled => quadPart('grid', {enabled})}/>
          <div className="settings-color-grid">
            <label className="settings-color"><span>Background</span><input type="color" aria-label="Quadview background color" value={prefs.viewportAppearance.quadView.background.color} onChange={event => quadPart('background', {color:event.target.value})}/></label>
            {[['minorColor','Minor grid'],['majorColor','Major grid'],['axisColor','Origin axes']].map(([key,label]) => <label className="settings-color" key={key}><span>{label}</span><input type="color" aria-label={`Quadview ${label.toLowerCase()} color`} value={prefs.viewportAppearance.quadView.grid[key]} onChange={event => quadPart('grid', {[key]:event.target.value})}/></label>)}
          </div>
          <div className="settings-graphics-grid">
            <Numeric id="appearance:quadview:spacing" label="Quadview minimum cell size" value={prefs.viewportAppearance.quadView.grid.spacing} min={12} max={96} unit="px" onChange={spacing => quadPart('grid', {spacing})}/>
            <Numeric id="appearance:quadview:major" label="Quadview major line every" value={prefs.viewportAppearance.quadView.grid.majorEvery} min={2} max={10} unit="cells" onChange={majorEvery => quadPart('grid', {majorEvery})}/>
            <Numeric id="appearance:quadview:thickness" label="Quadview line thickness" value={prefs.viewportAppearance.quadView.grid.thickness} min={.5} max={4} step={.25} unit="px" onChange={thickness => quadPart('grid', {thickness})}/>
            <Numeric id="appearance:quadview:opacity" label="Quadview minor opacity" value={prefs.viewportAppearance.quadView.grid.opacity} min={0} max={1} step={.05} onChange={opacity => quadPart('grid', {opacity})}/>
            <Numeric id="appearance:quadview:major-opacity" label="Quadview major opacity" value={prefs.viewportAppearance.quadView.grid.majorOpacity} min={0} max={1} step={.05} onChange={majorOpacity => quadPart('grid', {majorOpacity})}/>
          </div>
          <input ref={quadImageInput} hidden type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={event => { loadViewportBackground(event.target.files[0], true); event.target.value=''; }}/>
          <div className="settings-inline-actions"><button onClick={() => quadImageInput.current?.click()}>Choose Quadview background image…</button>{prefs.viewportAppearance.quadView.background.imageData && <button onClick={() => quadPart('background', {type:'color',imageData:'',imageName:''})}>Remove Quadview image</button>}</div>
          {prefs.viewportAppearance.quadView.background.imageData && <div className="settings-graphics-grid"><label>Quadview image display <select aria-label="Quadview image display" value={prefs.viewportAppearance.quadView.background.display} onChange={event => quadPart('background', {display:event.target.value})}>{['fit','fill','stretch','center'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><Numeric id="appearance:quadview:image-opacity" label="Quadview image opacity" value={prefs.viewportAppearance.quadView.background.opacity} min={0} max={1} step={.05} onChange={opacity => quadPart('background', {opacity})}/></div>}
        </fieldset>
        <h3>Viewport background</h3>
        <div className="settings-inline-actions" role="group" aria-label="Viewport background type"><span>Type:</span><button aria-pressed={prefs.viewportAppearance.background.type === 'color'} onClick={() => viewportPart('background',{type:'color'})}>Solid color</button><button aria-pressed={prefs.viewportAppearance.background.type === 'image'} disabled={!prefs.viewportAppearance.background.imageData} onClick={() => viewportPart('background',{type:'image'})}>Image</button></div>
        <label className="settings-color">Fallback color <input type="color" aria-label="Viewport background color" value={prefs.viewportAppearance.background.color} onChange={event => viewportPart('background',{color:event.target.value})}/><code>{prefs.viewportAppearance.background.color}</code></label>
        <input ref={viewportImageInput} hidden type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={event => { loadViewportBackground(event.target.files[0]); event.target.value=''; }}/>
        <div className="settings-inline-actions"><button onClick={() => viewportImageInput.current?.click()}>Choose background image…</button>{prefs.viewportAppearance.background.imageData && <><span className="settings-muted" title={prefs.viewportAppearance.background.imageName}>{prefs.viewportAppearance.background.imageName || 'Saved image'}</span><button onClick={() => viewportPart('background',{type:'color',imageData:'',imageName:''})}>Remove image</button></>}</div>
        {prefs.viewportAppearance.background.imageData && <div className="settings-graphics-grid"><label className="settings-select"><span>Image display</span><select aria-label="Background image display mode" value={prefs.viewportAppearance.background.display} onChange={event => viewportPart('background',{display:event.target.value})}><option value="fit">Fit</option><option value="fill">Fill</option><option value="stretch">Stretch</option><option value="center">Center / actual size</option></select></label><Numeric id="appearance:background:opacity" label="Image opacity" value={prefs.viewportAppearance.background.opacity} min={0} max={1} step={.05} onChange={opacity => viewportPart('background',{opacity})}/></div>}
        <Toggle id="appearance:xray-vertices" label="Show occluded vertices in General View (X-Ray)" checked={prefs.viewportAppearance.xrayVertices} onChange={xrayVertices => viewport({xrayVertices})} description="Off by default: General View hides vertices behind model geometry. Wireframe View remains see-through."/>
        <div className="settings-inline-actions" role="group" aria-label="Application theme"><span>Theme:</span>{Object.entries(APPLICATION_THEMES).map(([value, theme]) => <button key={value} data-warmkey={`appearance:theme:${value}`} aria-pressed={prefs.theme === value} onClick={() => commit({ theme: value, accent: theme.accent })}>{theme.name}</button>)}</div>
        <p className="settings-hint">You can change the theme separately without changing viewport colors. Hold Alt to see shortcut hints.</p>
        <label className="settings-color">UI accent <input type="color" aria-label="UI accent" value={prefs.accent} onChange={event=>commit({accent:event.target.value})}/><code>{prefs.accent}</code></label>
        <div className="settings-graphics-grid"><Numeric id="appearance:panel-width" label="Toolbox width" value={prefs.panelWidth} min={162} max={420} unit="px" onChange={panelWidth=>commit({panelWidth})}/><Numeric id="appearance:panel-scale" label="Toolbox scale" value={prefs.panelScale} min={1} max={1.75} step={.05} unit="×" onChange={panelScale=>commit({panelScale})}/></div>
        <h3>Editor helpers</h3><div className="settings-color-grid">{APPEARANCE_HELPER_COLORS.map(([key, label]) => <label className="settings-color" key={key}><span>{label}</span><input data-warmkey={`appearance:color:${key}`} type="color" aria-label={`${label} color`} value={prefs.visuals[key]} onChange={event => visual({ [key]: event.target.value })}/><code>{prefs.visuals[key]}</code></label>)}</div>
        <div className="settings-graphics-grid">{[['keyframeSize', 'Keyframe marker size', 4, 24, 1, 'px'], ['helperSize', 'Node marker size', 3, 18, 1, 'px'], ['occludedOpacity', 'Hidden wire intensity', 0, 1, 0.05, '']].map(([key, label, min, max, step, unit]) => <Numeric key={key} id={`appearance:size:${key}`} label={label} value={prefs.visuals[key]} min={min} max={max} step={step} unit={unit} onChange={value => visual({ [key]: value })}/>)}</div>
        <button data-warmkey="appearance:reset" onClick={() => commit({ viewportPreset: 'mdlvis-vanilla', viewportAppearance: BUILT_IN_VIEWPORT_PRESETS['mdlvis-vanilla'].appearance, visuals: DEFAULT_VISUALS })}>Restore Lordaeron and helper defaults</button>
      </div>}
      {tab === 'grid' && <div className="settings-page">
        <h3>XYZ grid</h3><p>Configure the grid shared by the 3D viewport and animation preview. Use Display → Grid to show or hide it.</p>
        <div className="settings-inline-actions"><span>Preset:</span>{[['classic', 'Classic'], ['fine', 'Fine'], ['world', 'Large model'], ['xyz', 'Three planes']].map(([key, label]) => <button key={key} data-warmkey={`grid:preset:${key}`} onClick={() => grid(GRID_PRESETS[key])}>{label}</button>)}</div>
        <div className="settings-graphics-grid"><Numeric id="grid:spacing" label="Minor line spacing" value={prefs.grid.spacing} min={0.1} max={4096} step={0.1} unit=" units" onChange={spacing => grid({ spacing })}/><Numeric id="grid:major-every" label="Minor divisions per major line" value={prefs.grid.majorEvery} min={2} max={32} onChange={majorEvery => grid({ majorEvery })}/><Numeric id="grid:extent" label="Extent from origin" value={prefs.grid.extent} min={1} max={16384} unit=" units" onChange={extent => grid({ extent })}/><Numeric id="grid:opacity" label="Minor grid opacity" value={prefs.grid.opacity} min={0} max={1} step={0.05} onChange={opacity => grid({ opacity })}/><Numeric id="grid:major-opacity" label="Major grid opacity" value={prefs.grid.majorOpacity} min={0} max={1} step={0.05} onChange={majorOpacity => grid({ majorOpacity })}/></div>
        <Toggle id="grid:small" label="Small grid" checked={prefs.grid.small} onChange={small => grid({ small })} description="Show the fine lines. The coarse grid remains visible."/>
        <div className="settings-plane-choices"><span>Grid planes:</span>{['xz', 'yz', 'xy'].map(key => <label key={key}><input data-warmkey={`grid:plane:${key}`} aria-label={`Grid ${key.toUpperCase()} plane`} type="checkbox" checked={prefs.grid.planes[key]} onChange={event => grid({ planes: { ...prefs.grid.planes, [key]: event.target.checked } })}/>{key.toUpperCase()}</label>)}</div>
        <div className="settings-plane-choices"><span>Axes:</span>{['x', 'y', 'z'].map(key => <label key={key}><input data-warmkey={`grid:axis:${key}`} aria-label={`Grid ${key.toUpperCase()} axis`} type="checkbox" checked={prefs.grid.axes[key]} onChange={event => grid({ axes: { ...prefs.grid.axes, [key]: event.target.checked } })}/>{key.toUpperCase()}</label>)}</div>
        <div className="settings-color-grid">{VISUAL_COLORS.filter(([key]) => key.startsWith('grid') || key.startsWith('axis')).map(([key, label]) => <label className="settings-color" key={key}><span>{label}</span><input data-warmkey={`grid:color:${key}`} type="color" aria-label={`${label} color`} value={prefs.visuals[key]} onChange={event => visual({ [key]: event.target.value })}/><code>{prefs.visuals[key]}</code></label>)}</div>
      </div>}
      {tab === 'configuration' && <div className="settings-page"><h3>Reusable configuration</h3><p>Export interface colors, toolbox size, input settings, graphics and hotkeys. Import replaces these preferences together; machine paths and model data stay local.</p><input ref={configInput} hidden type="file" accept=".json,application/json" onChange={event=>{loadConfiguration(event.target.files[0]);event.target.value='';}}/><button onClick={exportSettings}>Export configuration…</button><button onClick={()=>configInput.current.click()}>Import configuration…</button><h3>New model</h3><label>Starter format <select aria-label="New model version" value={prefs.newModelVersion} onChange={event=>commit({newModelVersion:Number(event.target.value)})}><option value={800}>MDX800 · Classic</option><option value={1000}>MDX1000 · Reforged</option></select></label><p>New creates Bone_Root and a 64-unit cube with eight vertices and twelve triangles.</p></div>}
      {tab === 'gameData' && <div className="settings-page game-data-page">
        <h3>Warcraft III installation</h3>
        <p>Choose the main Warcraft III installation folder once. MdlVis saves the location in its app profile, then uses it automatically when a model refers to native Warcraft textures.</p>
        {gameDataPath ? <p className="game-data-path"><strong>Saved folder:</strong> <code>{gameDataPath}</code></p> : <p className="settings-hint">Warcraft III is detected automatically when native textures are needed. The detected installation and textures are cached for later launches.</p>}
        <div className="settings-inline-actions"><button data-warmkey="game-data:choose" disabled={!onChooseGameData} onClick={onChooseGameData}>{gameDataPath ? 'Choose a different Warcraft III installation…' : 'Choose Warcraft III installation…'}</button>{gameDataPath && <button data-warmkey="game-data:clear" disabled={!onClearGameData} onClick={onClearGameData}>Forget saved folder</button>}</div>
        <p className="settings-hint">Select the game installation folder, not an individual MPQ file. Choosing another folder replaces the saved location.</p>
        <AssetPreload modelPath={modelPath}/>
      </div>}
      <div className="settings-message" role="status" aria-live="polite">{message}</div>
    </div><footer><span>Changes apply immediately.</span><button data-warmkey="done" onClick={onClose}>Done</button></footer>
  </section></div>;
}
