import React, { lazy, Suspense, useEffect, useState } from 'react';
import { textureName } from '../src/resource-relations.js';
const GamePreview = lazy(() => import('./GamePreview.jsx'));

function TexturePreview({ model, materialId, textureId, assets, revision, frame, sequenceIndex, teamColor }) {
  const [preview, setPreview] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true; setPreview(null); setError('');
    const target = textureId == null ? model : { ...model, Materials: [{ Layers: [{ TextureID: textureId, Alpha: 1, FilterMode: 2 }] }] };
    import('./uv-material-preview.js').then(({ renderUVMaterialTexture }) => renderUVMaterialTexture(target, textureId == null ? materialId : 0, assets, { time: frame, sequenceIndex, teamColor })).then(result => { if (active) { setPreview(result); setError(result.warnings.join(' · ')); } }, cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [model, materialId, textureId, assets, revision, frame, sequenceIndex, teamColor]);
  return <figure className="re-texture-preview"><div className="re-checker">{preview?.layerCount > 0 ? <img src={preview.url} alt={textureId == null ? 'Material layers preview' : textureName(model.Textures[textureId])}/> : <span>{error ? 'Texture not loaded' : 'Loading preview…'}</span>}</div><figcaption>{preview?.layerCount > 0 && `${preview.width} × ${preview.height}`}{error && <span>{error}</span>}</figcaption></figure>;
}
function IsolatedMeshPreview({ model, ids, revision, assets, preferences, teamColor, sequenceIndex, frame }) {
  const [open, setOpen] = useState(false), [chosen, setChosen] = useState(ids[0]);
  const id = ids.includes(chosen) ? chosen : ids[0];
  return <details className="re-model-preview" onToggle={event => setOpen(event.currentTarget.open)}><summary>Preview geoset</summary>{open && (id == null ? <p>No geosets.</p> : <>
    {ids.length > 1 && <label className="re-preview-choice">Geoset<select aria-label="Preview geoset" value={id} onChange={event => setChosen(Number(event.target.value))}>{ids.map(i => <option key={i} value={i}>{model.Geosets[i].Name || `Geoset ${i + 1}`}</option>)}</select></label>}
    <div className="re-model-stage" data-isolated-geoset={id}><Suspense fallback={<p>Loading preview…</p>}><GamePreview key={id} model={model} revision={revision} textureAssets={assets} preferences={preferences} teamColor={teamColor} presentation="preview" sequenceIndex={sequenceIndex} time={frame} playing={false} showGrid={false} showAxes={false} showParticles={false} isolatedGeosets={[id]} hiddenGeosets={new Set(model.Geosets.flatMap((_, i) => i === id ? [] : [i]))} mode="textured" view="perspective" overlays={{ bones: false, nodes: false, attachments: false, particles: false, wires: false }} /></Suspense></div>
  </>)}</details>;
}

export default function ResourceDetails({ doc, kind, index, assets, frame, sequenceIndex, preferences, teamColor }) {
  const model = doc.model;
  if (!['Materials','Textures','Geosets'].includes(kind)) return null;
  const materialId = kind === 'Geosets' ? model.Geosets[index]?.MaterialID : index;
  const ids = kind === 'Geosets' ? [index] : model.Geosets.flatMap((g,i) => g.MaterialID === index ? [i] : []);
  return <div className="re-resource-preview"><TexturePreview model={model} materialId={materialId} textureId={kind === 'Textures' ? index : null} assets={assets} revision={doc.revision} frame={frame} sequenceIndex={sequenceIndex} teamColor={teamColor}/>{kind !== 'Textures' && <IsolatedMeshPreview model={model} ids={ids} assets={assets} revision={doc.revision} frame={frame} sequenceIndex={sequenceIndex} preferences={preferences} teamColor={teamColor}/>}</div>;
}
