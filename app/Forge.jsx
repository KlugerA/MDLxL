import React, { useEffect, useMemo, useRef, useState } from 'react';
import { alphaMask, buildForgeMesh, combineMask, cropContour, cropMask, encodeForgeTga, magicWand, polygonMask } from '../src/forge.js';
import { textureFromAsset } from './Viewport.jsx';
import TextureLibrary from './TextureLibrary.jsx';
import ForgePreview from './ForgePreview.jsx';
import './forge.css';

async function readImage(asset) {
  const texture = await textureFromAsset(asset);
  try {
    const source = texture.image;
    if (source.width * source.height > 16777216) throw Error('Use an image with at most 16 million pixels.');
    if (source.data) return { width: source.width, height: source.height, data: new Uint8ClampedArray(source.data) };
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally { texture.dispose(); }
}
function MaskEditor({ image, mask, selected, points, setPoints, closed, setClosed, tool, cropShape, tolerance, connected, onSelected, onCrop, onBeginEdit, onBeginPolygon }) {
  const host = useRef(), canvas = useRef(), drag = useRef(), [size, setSize] = useState([600, 400]), [zoom, setZoom] = useState(1), [pan, setPan] = useState([0, 0]);
  const layers = useMemo(() => {
    if (!image) return null;
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    const overlay = document.createElement('canvas'); overlay.width = image.width; overlay.height = image.height;
    const pixels = new Uint8ClampedArray(image.width * image.height * 4);
    for (let i = 0; i < mask.length; i++) if (selected?.[i]) pixels.set([65, 170, 245, 140], i * 4); else if (!mask[i]) pixels.set([20, 22, 26, 210], i * 4);
    overlay.getContext('2d').putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
    return { source, overlay };
  }, [image, mask, selected]);
  useEffect(() => { const element = host.current; const observer = new ResizeObserver(() => { if (host.current !== element || !element.isConnected) return; setSize([element.clientWidth, element.clientHeight]); }); observer.observe(element); return () => observer.disconnect(); }, []);
  useEffect(() => { setZoom(1); setPan([0, 0]); }, [image]);
  const scale = image ? Math.min((size[0] - 32) / image.width, (size[1] - 32) / image.height) * zoom : 1;
  const origin = image ? [(size[0] - image.width * scale) / 2 + pan[0], (size[1] - image.height * scale) / 2 + pan[1]] : [0, 0];
  const local = e => { const r = canvas.current.getBoundingClientRect(); return [(e.clientX - r.left - origin[0]) / scale, (e.clientY - r.top - origin[1]) / scale]; };
  const clampPoint = p => [Math.max(0, Math.min(image.width, p[0])), Math.max(0, Math.min(image.height, p[1]))];
  useEffect(() => {
    const node = canvas.current, ratio = Math.min(devicePixelRatio, 2); node.width = Math.round(size[0] * ratio); node.height = Math.round(size[1] * ratio);
    const ctx = node.getContext('2d'); ctx.scale(ratio, ratio); ctx.fillStyle = '#222a32'; ctx.fillRect(0, 0, ...size);
    for (let y = 0; y < size[1]; y += 16) for (let x = 0; x < size[0]; x += 16) if ((x / 16 + y / 16) % 2) { ctx.fillStyle = '#29323b'; ctx.fillRect(x, y, 16, 16); }
    if (!image || !layers) return;
    ctx.save(); ctx.translate(...origin); ctx.scale(scale, scale); ctx.imageSmoothingEnabled = zoom < 4;
    ctx.drawImage(layers.source, 0, 0); ctx.drawImage(layers.overlay, 0, 0);
    if (points.length) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); if (closed) ctx.closePath(); ctx.strokeStyle = '#73d8ff'; ctx.lineWidth = 2 / scale; ctx.stroke(); const handles = tool === 'Crop' ? [[Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))], [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]] : points; if (tool === 'Crop') { ctx.setLineDash([4 / scale, 4 / scale]); ctx.strokeRect(handles[0][0], handles[0][1], handles[1][0] - handles[0][0], handles[1][1] - handles[0][1]); ctx.setLineDash([]); } handles.forEach((p, i) => { ctx.fillStyle = i ? '#f7fbff' : '#ffc66d'; ctx.beginPath(); ctx.arc(...p, 4 / scale, 0, Math.PI * 2); ctx.fill(); }); }
    ctx.restore();
  }, [image, layers, size, zoom, pan, points, closed]);
  const down = e => {
    if (!image) return; e.preventDefault(); canvas.current.setPointerCapture(e.pointerId);
    if (tool === 'Pan' || e.button === 1 || e.button === 2) { drag.current = { type: 'pan', start: [e.clientX, e.clientY], pan }; return; }
    const p = clampPoint(local(e)); onBeginEdit();
    if (tool === 'Wand') { onSelected(magicWand(image, ...p, tolerance, connected)); setPoints([]); setClosed(false); }
    else if (tool === 'Crop') {
      const old = selected?.forgeShape?.type === 'crop' && selected.forgeShape.kind === cropShape ? selected.forgeShape : null;
      const near = old ? [old.start, old.end].findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) * scale < 12) : -1;
      const inside = old && p[0] >= Math.min(old.start[0], old.end[0]) && p[0] <= Math.max(old.start[0], old.end[0]) && p[1] >= Math.min(old.start[1], old.end[1]) && p[1] <= Math.max(old.start[1], old.end[1]);
      drag.current = { type: 'crop', mode: near >= 0 ? 'resize' : inside ? 'move' : 'new', near, anchor: p, start: old && (near >= 0 || inside) ? [...old.start] : p, end: old && (near >= 0 || inside) ? [...old.end] : p };
      setPoints(cropContour(cropShape, drag.current.start, drag.current.end, 100)); setClosed(true);
    }
    else {
      const near = points.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) * scale < 9);
      if (near === 0 && !closed && points.length >= 3) { setClosed(true); onSelected(polygonMask(image.width, image.height, points)); }
      else if (near >= 0) drag.current = { type: 'point', index: near };
      else { if (closed || !points.length) onBeginPolygon(); setPoints(closed ? [p] : [...points, p]); setClosed(false); onSelected(null); }
    }
  };
  const move = e => {
    if (!drag.current || !image) return; const d = drag.current;
    if (d.type === 'pan') { setPan([d.pan[0] + e.clientX - d.start[0], d.pan[1] + e.clientY - d.start[1]]); return; }
    const p = clampPoint(local(e));
    if (d.type === 'crop') {
      let start = d.start, end = d.end;
      if (d.mode === 'move') {
        const delta = p.map((v, i) => Math.max(-Math.min(d.start[i], d.end[i]), Math.min((i ? image.height : image.width) - Math.max(d.start[i], d.end[i]), v - d.anchor[i])));
        start = d.start.map((v, i) => v + delta[i]); end = d.end.map((v, i) => v + delta[i]);
      } else if (d.mode === 'resize' && d.near === 0) start = p;
      else end = p;
      d.next = { start, end }; setPoints(cropContour(cropShape, start, end, 100));
    }
    else { const next = points.map((v, i) => i === d.index ? p : v); setPoints(next); if (closed) onSelected(polygonMask(image.width, image.height, next)); }
  };
  const up = () => { const d = drag.current; if (d?.type === 'crop') { const { start, end } = d.next || d; if (Math.abs(start[0] - end[0]) >= 1 && Math.abs(start[1] - end[1]) >= 1) onCrop(cropMask(image.width, image.height, cropShape, start, end)); } drag.current = null; };
  return <div className="forge-image-stage"><div className="forge-zoom"><button onClick={() => setZoom(z => Math.max(.25, z / 1.3))} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(24, z * 1.3))} aria-label="Zoom in">+</button><button onClick={() => { setZoom(1); setPan([0, 0]); }}>Fit image</button></div><div ref={host} className="forge-image-host"><canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} onContextMenu={e => e.preventDefault()} onWheel={e => { e.stopPropagation(); setZoom(z => Math.max(.25, Math.min(24, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))); }} aria-label="Image cleanup canvas"/>{!image && <div className="forge-empty">Load an image to crop and clean its silhouette.</div>}</div></div>;
}
const DEFAULTS = { detail: 35, size: 100, thickness: 0, trim: false, trimWidth: 3, trimThickness: 1, trimOffset: 0, trimHoles: true };
export default function Forge({ model, modelPath, preferences, onClose, onCommit }) {
  const [asset, setAsset] = useState(null), [image, setImage] = useState(null), [mask, setMask] = useState(null), [selected, setSelected] = useState(null), [points, setPoints] = useState([]), [closed, setClosed] = useState(false), [tool, setTool] = useState('Polygon'), [tolerance, setTolerance] = useState(24), [connected, setConnected] = useState(true), [selectionMode, setSelectionMode] = useState('Replace'), [settings, setSettings] = useState(DEFAULTS), [wire, setWire] = useState(false), [trimColor, setTrimColor] = useState('#cca64d'), [library, setLibrary] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [texturePath, setTexturePath] = useState(''), [undoCount, setUndoCount] = useState(0), [preview, setPreview] = useState({ mesh: null, error: '' }), [updating, setUpdating] = useState(false);
  const input = useRef(), history = useRef([]), draftHistory = useRef([]), original = useRef(), generation = useRef(0), dialog = useRef(), selectionBase = useRef(null);
  const [draftCount, setDraftCount] = useState(0);
  const [cropShape, setCropShape] = useState('Rectangle'), [checker, setChecker] = useState(false);
  const rememberDraft = () => { draftHistory.current.push({ points, closed, selected, selectionBase: selectionBase.current }); if (draftHistory.current.length > 30) draftHistory.current.shift(); setDraftCount(draftHistory.current.length); };
  const setting = (key, value) => setSettings(s => ({ ...s, [key]: value }));
  const pushMask = next => { history.current.push(mask); const cap = Math.max(2, Math.min(30, Math.floor(48 * 1024 * 1024 / Math.max(1, mask.length)))); if (history.current.length > cap) history.current.shift(); setMask(next); setUndoCount(history.current.length); };
  const clearSelection = () => { setSelected(null); setPoints([]); setClosed(false); selectionBase.current = null; draftHistory.current = []; setDraftCount(0); };
  const load = async incoming => {
    setBusy(true); setError('');
    try {
      const decoded = await readImage(incoming), initial = alphaMask(decoded);
      const bundled = incoming.source === 'forge' || incoming.source === 'custom';
      let path = incoming.name || 'Forge.png';
      if (bundled) {
        if (!/\.(blp|dds|tga)$/i.test(path)) { incoming = { ...incoming, bytes: encodeForgeTga(decoded) }; path = path.replace(/\.[^.]+$/, '') + '.tga'; }
        const bytes = incoming.bytes instanceof ArrayBuffer ? incoming.bytes : incoming.bytes.buffer.slice(incoming.bytes.byteOffset, incoming.bytes.byteOffset + incoming.bytes.byteLength);
        if (bytes.byteLength > 64 * 1024 * 1024) throw Error('Forge textures must be smaller than 64 MB. Resize the source image.');
        const digest = await crypto.subtle.digest('SHA-256', bytes), hash = Array.from(new Uint8Array(digest).slice(0, 10), n => n.toString(16).padStart(2, '0')).join('');
        const safe = path.split(/[\\/]/).at(-1).replace(/[^a-zA-Z0-9_.-]/g, '_'), dot = safe.lastIndexOf('.');
        path = 'MDLxL_Forge\\' + hash + '-' + safe.slice(0, dot).slice(0, 150) + safe.slice(dot);
      }
      setAsset({ ...incoming, name: path, source: bundled ? 'forge' : 'library' }); setImage(decoded); original.current = initial; setMask(initial); setPreview({ mesh: null, error: '' }); clearSelection(); history.current = []; setUndoCount(0); setTexturePath(path); setLibrary(false);
    }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!image || !mask) return; const id = ++generation.current; setUpdating(true);
    const timer = setTimeout(() => { try { const mesh = buildForgeMesh({ ...settings, mask, width: image.width, height: image.height }); if (generation.current === id) setPreview({ mesh, error: '' }); } catch (error) { if (generation.current === id) setPreview({ mesh: null, error: error.message }); } finally { if (generation.current === id) setUpdating(false); } }, 100);
    return () => { clearTimeout(timer); };
  }, [image, mask, settings]);
  const selectMask = next => { if (!next) { if (selectionMode === 'Replace') setSelected(null); return; } const base = next.forgeShape?.type === 'polygon' ? selectionBase.current : selected; if (!base || selectionMode === 'Replace') setSelected(next); else setSelected(combineMask(base, next, selectionMode === 'Add' ? 'add' : 'subtract')); };
  const operate = operation => { if (!mask) return; if (!selected && !['invert', 'reset'].includes(operation)) return; pushMask(combineMask(mask, selected, operation, original.current)); clearSelection(); };
  const undo = () => { const draft = draftHistory.current.pop(); if (draft) { setPoints(draft.points); setClosed(draft.closed); setSelected(draft.selected); selectionBase.current = draft.selectionBase; setDraftCount(draftHistory.current.length); return; } const previous = history.current.pop(); if (previous) { setMask(previous); setUndoCount(history.current.length); clearSelection(); } };
  const forge = async () => { if (!preview.mesh || updating || busy) return; setBusy(true); setError(''); try { const rgb = [1, 3, 5].map(i => parseInt(trimColor.slice(i, i + 2), 16) / 255); const result = await onCommit({ mesh: preview.mesh, asset: { ...asset, name: texturePath }, texturePath, trimColor: rgb }); if (result !== false) onClose(); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  const keys = e => {
    e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); if (points.length || selected) clearSelection(); else if (!busy) onClose(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); undo(); }
    if (e.key === 'Tab') { const elements = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(el => el.getClientRects().length), first = elements[0], last = elements.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
  };
  return <div className="forge-overlay" onKeyDown={keys}><section ref={dialog} className="forge-dialog" role="dialog" aria-modal="true" aria-label="Forge"><header><img src="./classic/wc3-forge.gif" alt=""/><div><h2>Forge</h2><span>Image → cutout → mesh</span></div><button onClick={onClose} disabled={busy} aria-label="Close Forge">✕</button></header>
    <div className="forge-source"><button autoFocus disabled={busy} onClick={() => input.current.click()}>Load from PC</button><input ref={input} type="file" accept="image/*,.blp,.tga,.dds" hidden onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) await load({ name: file.name, bytes: await file.arrayBuffer(), source: 'custom' }); }}/><button disabled={busy} onClick={() => setLibrary(true)}>Texture library</button><span>{asset?.name || 'No image loaded'}</span>{image && <small>{image.width} × {image.height}</small>}</div>
    <div className="forge-body"><section className="forge-cleanup"><h3>Crop &amp; clean</h3><div className="forge-tools">{['Polygon', 'Wand', 'Crop', 'Pan'].map(t => <button key={t} className={tool === t ? 'active' : ''} aria-pressed={tool === t} onClick={() => { setTool(t); clearSelection(); }}>{t === 'Wand' ? 'Magic wand' : t}</button>)}<button disabled={!undoCount && !draftCount} onClick={undo}>Undo</button></div>
      <div className="forge-clean-options">{tool === 'Crop' && <><label>Crop shape<select value={cropShape} onChange={e => { setCropShape(e.target.value); clearSelection(); }}>{['Rectangle', 'Square', 'Circle', 'Triangle'].map(v => <option key={v}>{v}</option>)}</select></label><button disabled={!selected} onClick={() => operate('keep')}>Apply crop</button></>}<label>Selection<select value={selectionMode} onChange={e => setSelectionMode(e.target.value)}>{['Replace', 'Add', 'Subtract'].map(v => <option key={v}>{v}</option>)}</select></label>{tool === 'Wand' && <><label>Tolerance<input type="range" min="0" max="255" value={tolerance} onChange={e => setTolerance(+e.target.value)}/><span>{tolerance}</span></label><label className="forge-check"><input type="checkbox" checked={connected} onChange={e => setConnected(e.target.checked)}/>Connected only</label></>}</div>
      <MaskEditor cropShape={cropShape} image={image} mask={mask} selected={selected} points={points} setPoints={setPoints} closed={closed} setClosed={setClosed} tool={tool} tolerance={tolerance} connected={connected} onSelected={selectMask} onBeginEdit={rememberDraft} onBeginPolygon={() => { selectionBase.current = selected; }} onCrop={next => setSelected(next)}/>
      <div className="forge-mask-actions">{[['keep', 'Keep'], ['remove', 'Remove'], ['add', 'Restore'], ['subtract', 'Subtract'], ['invert', 'Invert'], ['reset', 'Reset']].map(([action, label]) => <button key={action} disabled={!mask || !selected && !['invert', 'reset'].includes(action)} onClick={() => operate(action)}>{label}</button>)}</div><div className="forge-polygon-actions"><button disabled={points.length < 3 || closed} onClick={() => { rememberDraft(); setClosed(true); selectMask(polygonMask(image.width, image.height, points)); }}>Close polygon</button><button disabled={!points.length && !selected} onClick={clearSelection}>Cancel selection</button></div><p className="forge-hint">Polygon: close the outline, then Keep or Remove. Crop: drag bounds, move inside or resize at the bounds, then Apply crop. Scroll to zoom; middle or right drag to pan.</p></section>
      <section className="forge-mesh"><div className="forge-preview-heading"><h3>Mesh preview</h3><label className="forge-check"><input type="checkbox" checked={checker} onChange={e => setChecker(e.target.checked)}/>Checker</label><label className="forge-check"><input type="checkbox" checked={wire} onChange={e => setWire(e.target.checked)}/>Wireframe</label></div><div className="forge-preview-row"><ForgePreview checker={checker} preferences={preferences} geosets={preview.mesh?.geosets || []} image={image} wire={wire} trimColor={trimColor}/><label className="forge-detail">Detail<input type="range" min="0" max="100" value={settings.detail} onChange={e => setting('detail', +e.target.value)} aria-label="Mesh detail"/><strong>{settings.detail}</strong><span>Smooth</span><small>Rough</small></label></div>
      <div className="forge-counts" aria-live="polite">{updating ? 'Updating preview…' : preview.mesh ? `${preview.mesh.vertexCount.toLocaleString()} vertices · ${preview.mesh.triangleCount.toLocaleString()} triangles · ${preview.mesh.geosets.length} geosets` : 'Preview appears after loading an image.'}</div>
      <div className="forge-size"><label>Size<input type="number" min="0.01" max="100000" step="1" value={settings.size} onChange={e => setting('size', +e.target.value)}/></label><label>Thickness<input type="number" min="0" step="0.5" value={settings.thickness} onChange={e => setting('thickness', +e.target.value)}/></label></div>
      <fieldset className="forge-trim"><legend><label className="forge-check"><input type="checkbox" checked={settings.trim} onChange={e => setting('trim', e.target.checked)}/>TRIM</label></legend><div><label>Width<input type="number" min="0.01" step="0.5" disabled={!settings.trim} value={settings.trimWidth} onChange={e => setting('trimWidth', +e.target.value)}/></label><label>Thickness<input type="number" min="0" step="0.5" disabled={!settings.trim} value={settings.trimThickness} onChange={e => setting('trimThickness', +e.target.value)}/></label><label>Offset<input type="number" step="0.1" disabled={!settings.trim} value={settings.trimOffset} onChange={e => setting('trimOffset', +e.target.value)}/></label><label>Color<input type="color" disabled={!settings.trim} value={trimColor} onChange={e => setTrimColor(e.target.value)}/></label></div><label className="forge-check"><input type="checkbox" disabled={!settings.trim} checked={settings.trimHoles} onChange={e => setting('trimHoles', e.target.checked)}/>Include hole borders</label><small>Width extends outward. Offset 0 centers trim on the body. Trim is a separate geoset.</small></fieldset>
      <label className="forge-texture-path">Texture path<input value={texturePath} readOnly placeholder="Textures\\MyImage.blp" disabled={!image}/></label><p className="forge-hint">UV coordinates keep the original image layout. All forged pieces attach to DummyBone.</p></section></div>
    {(error || preview.error) && <div role="alert" className="forge-error">{error || preview.error}</div>}<footer><span>Local image processing</span><button onClick={onClose} disabled={busy}>Cancel</button><button className="forge-primary" disabled={!preview.mesh || updating || busy || !texturePath.trim()} onClick={forge}>{busy ? 'Working…' : 'FORGE'}</button></footer>
  </section>{library && <TextureLibrary model={model} modelPath={modelPath} onClose={() => setLibrary(false)} onSelectTexture={load} selectLabel="Use in Forge"/>}</div>;
}

