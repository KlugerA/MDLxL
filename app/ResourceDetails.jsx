import React, { lazy, Suspense, useEffect, useState } from 'react';
import { TextField, SelectField, Check } from './Fields.jsx';
import VisibilityEditor from './VisibilityEditor.jsx';
import { nodeKind } from '../src/editor-commands.js';
import { createGeosetAnimations } from '../src/animation-tracks.js';
import { blendModes, materialName, materialUsers, textureName, textureUsers, nodeGeosets, geosetBoneIds } from '../src/resource-relations.js';
import { setMaterialLayerTexture } from '../src/material-presets.js';
import { sampleTrack } from '../src/animation.js';
const GamePreview = lazy(() => import('./GamePreview.jsx'));
const visibilityKinds = ['Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'];
const nodeNames = { Bones: 'Bone', Helpers: 'Helper', Attachments: 'Attachment', Lights: 'Light', ParticleEmitters: 'Model particle emitter', ParticleEmitters2: 'Particle emitter', ParticleEmitterPopcorns: 'Popcorn emitter', RibbonEmitters: 'Ribbon emitter', EventObjects: 'Event object', CollisionShapes: 'Collision shape' };

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
function Links({ title = 'Used by', items, select }) {
  return <div className="re-relations"><span>{title}</span><div>{items.length ? items.map(item => <button key={`${item.kind}:${item.index}`} title={`Open ${item.label}`} onClick={() => select(item.kind, item.index)} translate="no">{item.label}</button>) : <small>No references</small>}</div></div>;
}

function IsolatedMeshPreview({ model, ids, revision, assets, preferences, teamColor, sequenceIndex, frame }) {
  const [open, setOpen] = useState(false), [chosen, setChosen] = useState(ids[0]);
  const id = ids.includes(chosen) ? chosen : ids[0];
  return <details className="re-model-preview" onToggle={event => setOpen(event.currentTarget.open)}><summary>Preview isolated mesh</summary>{open && (id == null ? <p>This material has no mesh users.</p> : <>
    {ids.length > 1 && <label className="re-preview-choice">Mesh<select aria-label="Preview geoset" value={id} onChange={event => setChosen(Number(event.target.value))}>{ids.map(i => <option key={i} value={i}>{model.Geosets[i].Name || `Geoset ${i + 1}`}</option>)}</select></label>}
    <p>Only {model.Geosets[id].Name || `Geoset ${id + 1}`} · drag to rotate</p>
    <div className="re-model-stage" data-isolated-geoset={id}><Suspense fallback={<p>Loading preview…</p>}><GamePreview key={id} model={model} revision={revision} textureAssets={assets} preferences={preferences} teamColor={teamColor} presentation="preview" sequenceIndex={sequenceIndex} time={frame} playing={false} showGrid={false} showAxes={false} showParticles={false} isolatedGeosets={[id]} hiddenGeosets={new Set(model.Geosets.flatMap((_, i) => i === id ? [] : [i]))} mode="textured" view="perspective" overlays={{ bones: false, nodes: false, attachments: false, particles: false, wires: false }} /></Suspense></div>
  </>)}</details>;
}

export default function ResourceDetails({ doc, kind, index, edit, select, assets, frame, sequenceIndex, onSeek, onSequenceChange, preferences, teamColor, onOpenParticleEditor, onImportTexture, onTextureFolder, onEditInAnimations }) {
  const model = doc.model, item = kind === 'Nodes' ? model.Nodes[index] : model[kind]?.[index];
  const [layerIndex, setLayerIndex] = useState(0);
  const visibilityProps = { model, frame, sequenceIndex, onSeek, onSequenceChange, disabled: doc.readOnly };
  const previewProps = { model, assets, revision: doc.revision, frame, sequenceIndex, teamColor };
  const visibility = (target, property, sections, label = 'Visibility', onlyAnimated = false) => <VisibilityEditor key={`${kind}:${index}:${layerIndex}:${property}`} {...visibilityProps} label={label} onlyAnimated={onlyAnimated} value={target?.[property]} fallback={target?._MdxDefaults?.[property] ?? 1} onChange={value => edit(`Set ${label.toLowerCase()}`, sections, () => { target[property] = value; })}/>;
  const modelPreview = ids => <IsolatedMeshPreview {...{model, ids, assets, preferences, teamColor, sequenceIndex, frame}} revision={doc.revision}/>;
  if (!item) return null;
  if (kind === 'Materials') {
    const currentLayer = Math.min(layerIndex, item.Layers.length - 1), layer = item.Layers[currentLayer];
    const users = materialUsers(model, index);
    const textureId = Number(sampleTrack(layer?.TextureID, frame, { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, fallback: 0 }));
    return <fieldset className="re-friendly-fields" disabled={doc.readOnly}><div className="re-resource-intro"><TexturePreview {...previewProps} materialId={index}/><div><h2>Material {index + 1}</h2><p>A stack of texture layers shared by {users.length} model part{users.length === 1 ? '' : 's'}.</p><p className="hint">Changes affect every user below.</p></div></div><Links items={users} select={select}/>{modelPreview(users.filter(u => u.kind === 'Geosets').map(u => u.index))}
      <div className="re-layer-tabs" role="tablist" aria-label="Material layers">{item.Layers.map((l, i) => <button key={i} role="tab" aria-selected={currentLayer === i} onClick={() => setLayerIndex(i)}>Layer {i + 1}<small>{blendModes[l.FilterMode || 0]?.[0] || 'Unknown filter'}</small></button>)}</div>
      {layer && <><SelectField label="Texture" value={textureId} disabled={!!layer.TextureID?.Keys} options={model.Textures.map((t, i) => ({ value: i, label: `${i + 1} · ${textureName(t)}` }))} onChange={id => edit('Set layer texture', ['Materials'], () => setMaterialLayerTexture(item, currentLayer, Number(id)))}/><div className="re-inline-actions"><button onClick={() => select('Textures', textureId)}>Open texture</button>{layer.TextureID?.Keys && <span>Texture changes over time; edit its keys in Advanced properties.</span>}</div><SelectField label="Appearance" value={layer.FilterMode || 0} options={blendModes.map(([label], value) => ({ label, value }))} onChange={mode => edit('Set layer blending', ['Materials'], () => { layer.FilterMode = Number(mode); })}/><p className="re-explanation">{blendModes[layer.FilterMode || 0]?.[1]}</p><div className="re-quick-checks"><Check label="Both sides" value={layer.Shading & 16} onChange={enabled => edit('Set two sided layer', ['Materials'], () => { layer.Shading = enabled ? (layer.Shading || 0) | 16 : (layer.Shading || 0) & ~16; })}/><Check label="Unlit" value={layer.Shading & 1} onChange={enabled => edit('Set unshaded layer', ['Materials'], () => { layer.Shading = enabled ? (layer.Shading || 0) | 1 : (layer.Shading || 0) & ~1; })}/></div>{visibility(layer, 'Alpha', ['Materials'], 'Layer opacity')}</>}
    </fieldset>;
  }
  if (kind === 'Textures') return <fieldset className="re-friendly-fields" disabled={doc.readOnly}><div className="re-resource-intro"><TexturePreview {...previewProps} textureId={index}/><div><h2 translate="no">{textureName(item)}</h2><p>The image used by material layers or particle emitters.</p></div></div><TextField label="Warcraft texture path" value={item.Image} onChange={path => edit('Edit texture path', ['Textures'], () => { item.Image = path; })}/><p className="hint">This is the path Warcraft loads from your map or game data.</p><SelectField label="Texture source" value={item.ReplaceableId || 0} options={[{ value: 0, label: 'Image at the path above' }, { value: 1, label: 'Team color' }, { value: 2, label: 'Team glow' }, ...(item.ReplaceableId > 2 ? [{ value: item.ReplaceableId, label: `Replaceable ${item.ReplaceableId}` }] : [])]} onChange={value => edit('Set texture source', ['Textures'], () => { item.ReplaceableId = Number(value); })}/><div className="re-quick-checks">{[['Repeat horizontally', 1], ['Repeat vertically', 2]].map(([label, bit]) => <Check key={bit} label={label} value={item.Flags & bit} onChange={enabled => edit('Set texture wrapping', ['Textures'], () => { item.Flags = enabled ? (item.Flags || 0) | bit : (item.Flags || 0) & ~bit; })}/>)}</div><Links items={textureUsers(model, index)} select={select}/><div className="re-inline-actions"><button onClick={onImportTexture}>Texture Library…</button><button onClick={onTextureFolder}>Resolve from folder…</button></div></fieldset>;
  if (kind === 'Geosets' || kind === 'GeosetAnims') {
    const id = kind === 'Geosets' ? index : item.GeosetId, geoset = model.Geosets[id];
    const animations = model.GeosetAnims.filter(a => a.GeosetId === id), animation = kind === 'GeosetAnims' ? item : animations[0];
    return <fieldset className="re-friendly-fields" disabled={doc.readOnly}><div className="re-resource-intro"><TexturePreview {...previewProps} materialId={geoset?.MaterialID}/><div><h2 translate="no">{geoset?.Name || `Geoset ${id + 1}`}</h2><p>A mesh part with its own material and visibility.</p><small>{(geoset?.Vertices?.length || 0) / 3} vertices · {(geoset?.Faces?.length || 0) / 3} triangles</small></div></div>{geoset && <><SelectField label="Material" value={geoset.MaterialID} options={model.Materials.map((_, i) => ({ value: i, label: materialName(model, i) }))} onChange={value => edit('Assign material', ['Geosets'], () => { geoset.MaterialID = Number(value); })}/><button onClick={() => select('Materials', geoset.MaterialID)}>Edit this material</button>{modelPreview([id])}</>}
      {animations.length > 1 ? <p className="field-error">This geoset has multiple visibility records. Resolve them in Geoset Animation Manager before editing visibility.</p> : <VisibilityEditor {...visibilityProps} value={animation?.Alpha} fallback={animation?._MdxDefaults?.Alpha ?? 1} onChange={value => edit('Set geoset visibility', ['GeosetAnims'], m => { createGeosetAnimations(m, [id]); m.GeosetAnims.find(a => a.GeosetId === id).Alpha = value; })}/>}
      {geoset && <Links title="Controlled by bones" items={geosetBoneIds(geoset).filter(bone => model.Nodes[bone]).map(bone => ({ kind: 'Nodes', index: bone, label: model.Nodes[bone].Name || `Node ${bone}` }))} select={select}/>}
    </fieldset>;
  }
  if (kind === 'Nodes') {
    const type = nodeKind(model, item), supportsVisibility = visibilityKinds.includes(type);
    const effects = ['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'].includes(type);
    return <fieldset className="re-friendly-fields" disabled={doc.readOnly}><div className="re-node-intro"><small>{nodeNames[type] || type} · Object ID {item.ObjectId}</small><h2 translate="no">{item.Name || `Node ${item.ObjectId}`}</h2></div>{onEditInAnimations && <button className="re-edit-animation" onClick={() => onEditInAnimations(index)}>Edit visibility in Animations →</button>}<TextField label="Name" value={item.Name} onChange={name => edit('Rename node', ['Nodes'], () => { item.Name = name; })}/>{item.Parent != null && model.Nodes[item.Parent] && <Links title="Parent" items={[{ kind: 'Nodes', index: item.Parent, label: model.Nodes[item.Parent].Name || `Node ${item.Parent}` }]} select={select}/>}
      {supportsVisibility ? <><p className="re-explanation">{effects ? 'Visibility switches emission on or off. Particles already emitted finish their lifetime.' : type === 'Lights' ? 'Set when this light is active.' : 'Set when this attached model is shown.'}</p>{visibility(item, 'Visibility', ['Nodes'], 'Visibility', true)}</> : <><p className="re-explanation">{['Bones', 'Helpers'].includes(type) ? 'Bones move geometry. Show or hide the mesh in its geoset visibility track.' : 'This node type has no native visibility track.'}</p><Links title="Geometry controlled by this node" items={nodeGeosets(model, index).map(id => ({ kind: 'Geosets', index: id, label: model.Geosets[id].Name || `Geoset ${id + 1}` }))} select={select}/></>}
      {effects && onOpenParticleEditor && <button onClick={() => onOpenParticleEditor(index)}>Open in EMTR</button>}
    </fieldset>;
  }
  return null;
}
