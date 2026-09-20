import React, { useEffect, useMemo, useRef, useState } from 'react';
import Viewport, { textureFromAsset } from './Viewport.jsx';
import { openDocument, validateModel } from '../src/editor-document.js';
import { partColorSamples, partColorSources, partPathKey, partTextureIndices, partTextureKey, previewPart, resolvePartColor } from '../src/bits-and-parts.js';
import { encodeForgeTga } from '../src/forge.js';
import './bits-and-parts.css';

function FolderTree({ entries, selected, onSelect }) {
  return <ul>{entries.map(entry => <li key={entry.id}>{entry.type === 'folder' ? <details open><summary>{entry.name}</summary><FolderTree entries={entry.children} selected={selected} onSelect={onSelect}/></details> : <button className={entry.id === selected ? 'selected' : ''} title={entry.id} onClick={() => onSelect(entry)}>{entry.name}</button>}</li>)}</ul>;
}

function browserBank(files) {
  const root = { name: 'BitsAndParts', children: [] }, models = new Map(), assets = new Map();
  for (const file of files) {
    const segments = file.webkitRelativePath.split('/');
    if (segments.shift() !== 'BitsAndParts') throw Error('Choose the folder named BitsAndParts.');
    const id = segments.join('/'); assets.set(partPathKey(id), file);
    if (!/\.(mdl|mdx)$/i.test(id)) continue;
    models.set(id, file); let folder = root, prefix = '';
    for (const name of segments.slice(0, -1)) { prefix += (prefix ? '/' : '') + name; let child = folder.children.find(entry => entry.type === 'folder' && entry.name === name); if (!child) folder.children.push(child = { id: prefix, name, type: 'folder', children: [] }); folder = child; }
    folder.children.push({ id, name: file.name, type: 'model' });
  }
  return { ...root, models, assets };
}

async function portableAsset(asset) {
  let bytes = new Uint8Array(asset.bytes), extension = asset.name.split('.').at(-1).toLowerCase();
  if (bytes.length > 3 && bytes[0] === 68 && bytes[1] === 68 && bytes[2] === 83 && bytes[3] === 32) extension = 'dds';
  const texture = await textureFromAsset(asset); // Decode before committing, including binary formats.
  try {
    if (!['blp', 'dds', 'tga'].includes(extension)) {
      const source = texture.image;
      if (source.data) bytes = encodeForgeTga({ width: source.width, height: source.height, data: source.data });
      else { const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; const context = canvas.getContext('2d'); context.drawImage(source, 0, 0); bytes = encodeForgeTga(context.getImageData(0, 0, canvas.width, canvas.height)); }
      extension = 'tga';
    }
  } finally { texture.dispose(); }
  if (!bytes.length || bytes.length > 64 * 1024 * 1024) throw Error('Part textures must be smaller than 64 MB.');
  const digest = await crypto.subtle.digest('SHA-256', bytes), hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  return { name: `MDLxL_Parts\\${hash}.${extension}`, bytes, source: 'parts' };
}

export default function BitsAndParts({ model, preferences, textureAssets = new Map(), teamColor = '#ff0000', onClose, onCommit }) {
  const [bank, setBank] = useState(null), [part, setPart] = useState(null), [assets, setAssets] = useState(new Map()), [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [missing, setMissing] = useState([]);
  const [useColor, setUseColor] = useState(false), [sequence, setSequence] = useState(''), [colorRecord, setColorRecord] = useState(''), [sampleFrame, setSampleFrame] = useState(''), [playing, setPlaying] = useState(false);
  const generation = useRef(0), picker = useRef(), dialog = useRef();
  const refresh = async () => { if (!window.desktop?.listParts) return; setBusy(true); setError(''); try { setBank(await window.desktop.listParts()); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  useEffect(() => { refresh(); dialog.current?.focus(); return () => { generation.current++; }; }, []);
  const choose = async entry => {
    const request = ++generation.current;
    setSelected(entry.id); setPart(null); setAssets(new Map()); setUseColor(false); setSequence(''); setColorRecord(''); setSampleFrame(''); setPlaying(false); setMissing([]); setBusy(true); setError('');
    try {
      const record = window.desktop?.readPart ? await window.desktop.readPart(entry.id) : { name: entry.name, bytes: new Uint8Array(await bank.models.get(entry.id).arrayBuffer()) };
      const document = openDocument(record.bytes, record.name);
      if (document.readOnly || validateModel(document.model).some(issue => issue.severity === 'error')) throw Error('This part is unreadable or contains invalid references. Repair it before importing.');
      if (!document.model.Geosets.length) throw Error('This part has no geosets.');
      const names = partTextureIndices(document.model).map(index => document.model.Textures[index]).filter(texture => !texture.ReplaceableId && texture.Image).map(texture => texture.Image);
      let records = [];
      if (window.desktop?.resolveTextures) records = await window.desktop.resolveTextures({ path: record.path, names });
      else for (const name of names) { const relative = entry.id.split('/').slice(0, -1).concat(name.replaceAll('\\', '/')).join('/'), file = bank.assets.get(partPathKey(relative)) || bank.assets.get(partPathKey(name)); if (file) records.push({ name, bytes: new Uint8Array(await file.arrayBuffer()) }); }
      const loaded = new Map();
      for (const record of records) { const name = record.logicalName || record.texturePath || record.name; loaded.set(partPathKey(name), { ...record, name }); }
      // Existing destination assets can satisfy equivalent dependency records.
      for (const name of names) if (!loaded.has(partPathKey(name)) && textureAssets.has(partPathKey(name))) loaded.set(partPathKey(name), textureAssets.get(partPathKey(name)));
      if (generation.current !== request) return;
      setMissing(names.filter(name => !loaded.has(partPathKey(name)))); setAssets(loaded); setPart({ ...record, model: document.model });
    } catch (error) { if (generation.current === request) setError(error.message); }
    finally { if (generation.current === request) setBusy(false); }
  };
  const choices = useMemo(() => part && sequence !== '' ? partColorSources(part.model, Number(sequence)) : [], [part, sequence]);
  const colorSamples = useMemo(() => part && sequence !== '' ? partColorSamples(part.model, Number(sequence)) : [], [part, sequence]);
  const sample = useMemo(() => {
    if (!useColor || !part || sequence === '' || colorRecord === '' || sampleFrame === '') return null;
    try { return resolvePartColor(part.model, { sequenceIndex: Number(sequence), recordIndex: Number(colorRecord), frame: Number(sampleFrame) }); } catch { return null; }
  }, [part, useColor, sequence, colorRecord, sampleFrame]);
  const preview = useMemo(() => part ? previewPart(part.model, sample) : null, [part, sample]);
  const interval = sequence === '' ? undefined : part?.model.Sequences?.[Number(sequence)]?.Interval;
  const importPart = async () => {
    if (!part || busy || (useColor && !sample)) return;
    const request = generation.current;
    setBusy(true); setError('');
    try {
      const texturePaths = {}, portable = [];
      for (const index of partTextureIndices(part.model)) {
        const texture = part.model.Textures[index];
        if (texture.ReplaceableId || !texture.Image) continue;
        if (model.Textures.some(existing => partTextureKey(existing) === partTextureKey(texture))) continue;
        const asset = assets.get(partPathKey(texture.Image));
        if (!asset) throw Error(`Missing texture: ${texture.Image}. Place it beside the source part or configure its Warcraft data folder.`);
        const prepared = await portableAsset(asset); texturePaths[index] = prepared.name; portable.push(prepared);
      }
      if (generation.current !== request) return;
      const result = await onCommit({ source: part.model, rgb: useColor ? sample : null, texturePaths, assets: portable });
      if (generation.current === request && result !== false) onClose();
    } catch (error) { if (generation.current === request) setError(error.message); }
    finally { if (generation.current === request) setBusy(false); }
  };
  return <div className="parts-overlay" onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); } }}><section className="parts-dialog" role="dialog" aria-modal="true" aria-label="BitsAndParts" tabIndex={-1} ref={dialog}>
    <header><h2>BitsAndParts</h2><button onClick={onClose} disabled={busy} aria-label="Close BitsAndParts">✕</button></header>
    <div className="parts-body"><aside aria-label="Parts folders and files"><div className="parts-bank-tools"><strong>BitsAndParts</strong>{window.desktop?.listParts ? <><button disabled={busy} onClick={refresh}>Refresh</button><button onClick={() => window.desktop.openPartsFolder().catch(error => setError(error.message))}>Open folder</button></> : <button onClick={() => picker.current.click()}>Choose folder</button>}</div>
      {bank?.children.length ? <FolderTree entries={bank.children} selected={selected} onSelect={choose}/> : <p>Store MDL and MDX parts here. Nested folders such as helms/horns stay organized.</p>}
      {bank?.directory && <small className="parts-directory" title={bank.directory}>{bank.directory}</small>}
      <input hidden ref={picker} type="file" webkitdirectory="" multiple onChange={event => { try { setBank(browserBank([...event.target.files])); setError(''); } catch (error) { setError(error.message); } event.target.value = ''; }}/>
    </aside><main><div className="parts-preview">{preview ? <Viewport presentation="preview" model={preview} preferences={preferences} revision={0} textureAssets={assets} teamColor={teamColor} mode="textured" view="perspective" cameraMode="free" showGrid={false} showSkeleton={false} showVertices={false} overlays={{}} selectedGeoset={-1} sequenceIndex={sequence === '' ? -1 : Number(sequence)} time={sampleFrame === '' ? interval?.[0] || 0 : Number(sampleFrame)} playing={playing} shaded/> : <p>{busy ? 'Loading preview…' : 'Select a part to preview it.'}</p>}</div>
      {part && <><strong className="parts-filename">{part.name} · {part.model.Geosets.length} geosets</strong><p className="parts-note">Import the whole part at its original coordinates and scale, attached to DummyBone. Source rig motion is not imported.</p>
      <label><input type="checkbox" checked={useColor} onChange={event => { setUseColor(event.target.checked); setColorRecord(''); setSampleFrame(''); }}/> Use an RGB from a source animation</label>
      <div className="parts-color-controls"><label>Animation<select aria-label="Source animation" value={sequence} onChange={event => { setSequence(event.target.value); setColorRecord(''); setSampleFrame(''); }}><option value="">Choose animation</option>{part.model.Sequences.map((item, index) => <option key={index} value={index}>{item.Name}</option>)}</select></label><button disabled={sequence === ''} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause preview' : 'Play preview'}</button></div>
      {useColor && <><div className="parts-color-controls"><label>Source RGB key<select aria-label="Source RGB key" value={colorSamples.some(item => String(item.recordIndex) === colorRecord && String(item.frame) === sampleFrame) ? `${colorRecord}/${sampleFrame}` : ''} onChange={event => { if (!event.target.value) return; const [record, frame] = event.target.value.split('/'); setColorRecord(record); setSampleFrame(frame); }}><option value="">Choose a displayed RGB key, or sample below</option>{colorSamples.map(item => <option key={`${item.recordIndex}/${item.frame}`} value={`${item.recordIndex}/${item.frame}`}>Geoset {item.geosetIndex} · frame {item.frame} · RGB {item.rgb.map(value => Math.round(value * 255)).join(', ')}</option>)}</select></label></div><div className="parts-color-controls"><label>Color source<select aria-label="Source geoset color" value={colorRecord} onChange={event => setColorRecord(event.target.value)}><option value="">Choose geoset color</option>{choices.map(item => <option key={item.recordIndex} value={item.recordIndex}>Geoset {item.geosetIndex} · record {item.recordIndex}{item.global ? ' · global color track' : item.animated ? ' · animated color' : ' · static color'}</option>)}</select></label><label>Sample frame<input aria-label="Color sample frame" type="number" min={interval?.[0]} max={interval?.[1]} placeholder={interval ? `${interval[0]}–${interval[1]}` : 'Choose animation'} value={sampleFrame} onChange={event => setSampleFrame(event.target.value)}/></label></div>
      {interval && <div className="parts-color-controls"><span>Choose a frame explicitly:</span><button onClick={() => setSampleFrame(String(interval[0]))}>Start {interval[0]}</button><button onClick={() => setSampleFrame(String(interval[1]))}>End {interval[1]}</button></div>}
      {sample ? <div className="parts-rgb"><i style={{ background: `rgb(${sample.map(value => Math.round(value * 255)).join(',')})` }}/>RGB {sample.map(value => Math.round(value * 255)).join(', ')} · applied to the whole part; alpha is preserved.</div> : <p className="parts-note">{sequence !== '' && !choices.length ? 'This animation has no usable source color.' : 'Choose an animation, geoset color and sample frame to preview one RGB.'}</p>}</>}
      {missing.length > 0 && <p className="parts-warning">Unavailable textures: {missing.join(', ')}. Import requires these textures unless an equivalent dependency already exists.</p>}
      {part.model.Version !== model.Version && <p className="parts-warning">Source format {part.model.Version}; destination format {model.Version}. Convert a copy to the destination format before import.</p>}</>}
    </main></div>{error && <div className="parts-error" role="alert">{error}</div>}<footer><span>Color choices affect only this import. Alpha tracks keep source frame times.</span><button onClick={onClose} disabled={busy}>Cancel</button><button className="parts-import" disabled={!part || busy || (useColor && !sample) || part?.model.Version !== model.Version} onClick={importPart}>{busy ? 'Working…' : 'Import whole part'}</button></footer>
  </section></div>;
}
