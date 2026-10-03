import React, { useMemo, useState } from 'react';
import Viewport from './Viewport.jsx';
import { collectedPartModel, currentPartPresets, partPathKey, partTextureIndices, previewPart, serializeCollectedPart } from '../src/bits-and-parts.js';
import { validateModel } from '../src/editor-document.js';

export default function CollectBit({ source, preferences, textureAssets, teamColor, prepareAsset, onClose, onSaved }) {
  const [name, setName] = useState(''), [importCurrent, setImportCurrent] = useState(false), [presets, setPresets] = useState([]);
  const [creating, setCreating] = useState(false), [rgb, setRgb] = useState([255, 255, 255]), [presetName, setPresetName] = useState(''), [selected, setSelected] = useState(-1);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const currentPresets = useMemo(() => currentPartPresets(source), [source]);
  const allPresets = [...(importCurrent ? currentPresets : []), ...presets];
  const preview = useMemo(() => previewPart(source, creating ? rgb.map(value => value / 255) : allPresets[selected]?.rgb), [source, creating, rgb, presets, importCurrent, selected]);
  const addPreset = () => {
    const label = presetName.trim();
    if (!label) { setError('Name the RGB animation.'); return; }
    if (allPresets.some(preset => preset.name.toLowerCase() === label.toLowerCase())) { setError('RGB animation names must be unique.'); return; }
    setPresets(previous => [...previous, { name: label, rgb: rgb.map(value => value / 255) }]); setSelected(allPresets.length); setCreating(false); setError('');
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const model = collectedPartModel(source, { name, importCurrent, presets }), assets = [];
      for (const index of partTextureIndices(model)) {
        const texture = model.Textures[index];
        if (texture.ReplaceableId || !texture.Image) continue;
        const asset = textureAssets.get(partPathKey(texture.Image));
        if (!asset) throw Error(`Missing texture: ${texture.Image}. Load it before collecting this Bit.`);
        const prepared = await prepareAsset(asset); texture.Image = prepared.name;
        if (!assets.some(existing => existing.name === prepared.name)) assets.push(prepared);
      }
      const issues = validateModel(model).filter(issue => issue.severity === 'error');
      if (issues.length) throw Error(issues[0].message);
      const result = await window.desktop.savePart({ name: name.trim(), bytes: serializeCollectedPart(model), assets });
      await onSaved(result);
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  return <div className="parts-overlay" onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); } }}><section className="parts-dialog parts-collect-dialog" role="dialog" aria-modal="true" aria-label="Collect Bit">
    <header><h2>Collect Bit</h2><button onClick={onClose} disabled={busy} aria-label="Close Collect Bit">✕</button></header>
    <div className="parts-body"><aside>
      <label className="parts-collect-name">Bit name<input autoFocus aria-label="Bit name" value={name} onChange={event => setName(event.target.value)}/></label>
      <p className="parts-note">{source.Geosets.length} geosets · {source.Geosets.reduce((count, geoset) => count + geoset.Vertices.length / 3, 0)} selected vertices</p>
      <p>Add RGB presets?</p><button aria-pressed={importCurrent} disabled={busy || !currentPresets.length} onClick={() => { setImportCurrent(value => !value); setSelected(-1); setCreating(false); setError(''); }}>Import from current</button>
      {importCurrent && <p className="parts-note">RGB keys from current animations become constant presets for the whole Bit.</p>}
      <button disabled={busy} onClick={() => { setCreating(true); setRgb([255, 255, 255]); setPresetName(''); setError(''); }}>Create new</button>
      <ul>{allPresets.map((preset, index) => <li key={index}><button className={selected === index && !creating ? 'selected' : ''} onClick={() => { setSelected(index); setCreating(false); }}>{preset.name} · RGB {preset.rgb.map(value => Math.round(value * 255)).join(', ')}</button></li>)}</ul>
    </aside><main><div className="parts-preview"><Viewport presentation="preview" model={preview} preferences={preferences} revision={0} textureAssets={textureAssets} teamColor={teamColor} mode="textured" view="perspective" cameraMode="free" showGrid={false} showSkeleton={false} showVertices={false} overlays={{}} selectedGeoset={-1} sequenceIndex={-1} time={0} playing={false} shaded/></div>
      {creating && <><div className="parts-color-controls"><label>Animation name<input aria-label="RGB animation name" value={presetName} onChange={event => setPresetName(event.target.value)}/></label></div>
        <div className="parts-collect-rgb">{['R', 'G', 'B'].map((label, index) => <label key={label}>{label}<input aria-label={`${label} slider`} type="range" min="0" max="255" value={rgb[index]} onChange={event => setRgb(previous => previous.map((value, channel) => channel === index ? Number(event.target.value) : value))}/><input aria-label={`${label} value`} type="number" min="0" max="255" value={rgb[index]} onChange={event => setRgb(previous => previous.map((value, channel) => channel === index ? Math.max(0, Math.min(255, Number(event.target.value))) : value))}/></label>)}</div>
        <button disabled={busy} onClick={addPreset}>Add RGB animation</button></>}
      <p className="parts-note">Every new RGB preset is baked into its own animation for the whole Bit. Save without adding presets to collect the geometry alone.</p>
    </main></div>{error && <div className="parts-error" role="alert">{error}</div>}<footer><span>Saved in BitsAndParts with its textures.</span><button onClick={onClose} disabled={busy}>Cancel</button><button className="parts-import" disabled={busy || !name.trim() || creating} onClick={save}>{busy ? 'Saving…' : 'Save Bit'}</button></footer>
  </section></div>;
}
