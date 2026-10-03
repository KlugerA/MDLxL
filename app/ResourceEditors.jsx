import React, { useEffect, useRef, useState } from 'react';
import Inspector from './Inspectors.jsx';
import NodeEventEditor from './NodeEventEditor.jsx';
import { EVENT_TYPES, loadEventCatalog } from './node-event-data.js';
import { Bone, Paperclip, Camera, Volume2, Droplets, Footprints, Lightbulb, Sparkles, Box, Circle, ChevronRight, ChevronDown } from 'lucide-react';
import { Section, SelectField, Check, TrackEditor } from './Fields.jsx';
import { nodeHierarchyRows, visibleNodeRows, relatedResourceIndices } from '../src/node-hierarchy.js';
import { NODE_TYPES, createNode, deleteNode, duplicateGeoset, deleteGeoset, recalculateNormals } from '../src/editor-document.js';
import { makeCube, nodeKind } from '../src/editor-commands.js';
import { displayNumber } from '../src/display-number.js';
import { visitTextureReferences } from '../src/texture-references.js';
import { materialName, textureName } from '../src/resource-relations.js';
import ResourceDetails from './ResourceDetails.jsx';
import useMovableWindow from './useMovableWindow.js';
import './resource-editors.css';
import './resource-managers-xl.css';

const titles = { Materials: 'Material Manager', Textures: 'Texture Manager', Nodes: 'Node Manager', Sequences: 'Sequence Manager', Geosets: 'Geoset Manager', GeosetAnims: 'Geoset Animation Manager', TextureAnims: 'Texture Animation Manager', GlobalSequences: 'Global Sequence Manager' };
const nodeIcons = { Bones: Bone, Helpers: Paperclip, Attachments: Paperclip, EventObjects: Camera, Lights: Lightbulb, ParticleEmitters: Sparkles, ParticleEmitters2: Sparkles, ParticleEmitterPopcorns: Sparkles, RibbonEmitters: Sparkles, CollisionShapes: Box };
const nodeTypeFor = collection => Object.keys(NODE_TYPES).find(type => NODE_TYPES[type][0] === collection);

function resourceRows(model, kind, tree) {
  if (kind !== 'Nodes') return (model?.[kind] || []).map((item, index) => ({ item, index, depth: 0 }));
  return nodeHierarchyRows(model, tree);
}

function resourceName(kind, row) {
  if (kind === 'Textures') return textureName(row.item);
  if (kind === 'Materials') return `Material ${displayNumber(row.index)}`;
  if (kind === 'Geosets') return row.item.Name || `Geoset ${displayNumber(row.index)}`;
  if (kind === 'GeosetAnims') return `Geoset animation ${displayNumber(row.index)} · Geoset ${displayNumber(row.item.GeosetId)}`;
  if (kind === 'TextureAnims') return `Texture animation ${displayNumber(row.index)}`;
  if (kind === 'GlobalSequences') return `Global ${displayNumber(row.index)}: ${row.item} ms`;
  return row.item.Name || `${kind.replace(/s$/, '')} ${displayNumber(row.index)}`;
}

function ensureMaterial(model) {
  if (!model.Textures.length) model.Textures.push({ Image: '', ReplaceableId: 1, Flags: 0 });
  const material = { PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, TextureID: 0, CoordId: 0, Alpha: 1, Shading: 0 }] };
  model.Materials.push(material); return model.Materials.length - 1;
}

function removeResource(model, kind, index) {
  if (kind === 'Nodes') return deleteNode(model, index);
  if (kind === 'Geosets') return deleteGeoset(model, index);
  if (kind === 'GeosetAnims') {
    model.GeosetAnims.splice(index, 1);
    for (const bone of model.Bones || []) {
      if (bone.GeosetAnimId === index) bone.GeosetAnimId = null;
      else if (bone.GeosetAnimId > index) bone.GeosetAnimId--;
    }
    return;
  }
  if (kind === 'Materials') {
    if (model.Geosets.some(g => g.MaterialID === index) || model.RibbonEmitters.some(n => n.MaterialID === index)) throw new Error('This material is in use. Assign another material to its geosets and ribbons first.');
    model.Materials.splice(index, 1);
    for (const item of [...model.Geosets, ...model.RibbonEmitters]) if (item.MaterialID > index) item.MaterialID--;
    return;
  }
  if (kind === 'Textures') {
    visitTextureReferences(model, value => { if (value === index) throw new Error('This texture is in use by a material or emitter. Replace those references first.'); });
    model.Textures.splice(index, 1);
    visitTextureReferences(model, (value, set) => { if (value > index) set(value - 1); });
    return;
  }
  if (kind === 'TextureAnims') {
    for (const material of model.Materials) for (const layer of material.Layers) if (layer.TVertexAnimId === index) throw new Error('This texture animation is assigned to a material layer. Clear that assignment first.');
    model.TextureAnims.splice(index, 1);
    for (const material of model.Materials) for (const layer of material.Layers) if (layer.TVertexAnimId > index) layer.TVertexAnimId--;
    return;
  }
  if (kind === 'GlobalSequences') throw new Error('Global sequence removal is unavailable while tracks may reference its index.');
  model[kind].splice(index, 1);
}

/** Resource windows share the document's history and preserve native properties. */
export function ResourceEditor({modelPath, onEditVisibility, onWarmKeys, onViewCamera, onOpenParticleEditor, livePreview = false, selectedNodeId, previewFrame, sequenceIndex = 0, onSeek, onSequenceChange, textureAssets, preferences, teamColor, onUndo, onRedo, onNodeChange, onKindChange, kind = 'Materials', doc, edit, refresh, onClose, onImportTexture, onTextureFolder, selectionByGeoset, activeGeoset = 0, inspectedGeoset = activeGeoset, onGeosetChange, onVerticesChange, onSelectionClear }) {
  const initialIndex = () => kind === 'Nodes' && doc?.model?.Nodes[selectedNodeId] ? selectedNodeId : ['Geosets', 'Materials', 'GeosetAnims'].includes(kind) ? relatedResourceIndices(doc?.model, inspectedGeoset, kind)[0] ?? null : 0;
  const [currentKind, setCurrentKind] = useState(kind), [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [nodeType, setNodeType] = useState('Bone'), [tree, setTree] = useState(true), [localSelection, setLocalSelection] = useState({});
  const [collapsed, setCollapsed] = useState(new Set()), [propertiesOpen, setPropertiesOpen] = useState(true), [query, setQuery] = useState('');
  const [frame, setFrame] = useState(Math.round(previewFrame || 0)), [message, setMessage] = useState(''), [, redraw] = useState(0);
  const [managerSequence, setManagerSequence] = useState(doc?.model?.Sequences?.[sequenceIndex] ? sequenceIndex : 0);
  const dialog = useRef(null), list = useRef(null), lastApplySucceeded = useRef(true);
  const movable = useMovableWindow(dialog);
  const [catalog, setCatalog] = useState(null), [catalogError, setCatalogError] = useState('');
  useEffect(() => { if(currentKind !== 'Nodes' || catalog) return; let active=true; loadEventCatalog(modelPath).then(value=>{if(active){setCatalog(value);if(!Object.values(value).some(rows=>rows.length))setCatalogError('Event data not found in the configured game files.');}},cause=>{if(active)setCatalogError(cause.message);});return()=>{active=false;}; }, [currentKind, modelPath, catalog]);
  useEffect(() => { if (kind !== currentKind) { setCurrentKind(kind); setSelectedIndex(initialIndex()); setMessage(''); } }, [kind]);
  useEffect(() => { setCurrentKind(kind); setSelectedIndex(initialIndex()); setLocalSelection({}); setMessage(''); }, [doc]);
  useEffect(() => { if (currentKind === 'Nodes' && doc?.model?.Nodes[selectedNodeId]) { setSelectedIndex(selectedNodeId); setQuery(''); setCollapsed(previous => { const next = new Set(previous); for (const id of nodeHierarchyRows(doc.model).find(row => row.index === selectedNodeId)?.ancestors || []) next.delete(id); return next; }); } }, [selectedNodeId]);
  useEffect(() => { if (['Geosets', 'Materials', 'GeosetAnims'].includes(currentKind)) setSelectedIndex(relatedResourceIndices(doc?.model, inspectedGeoset, currentKind)[0] ?? null); }, [inspectedGeoset, doc]);
  useEffect(() => { if (livePreview && Number.isFinite(previewFrame)) setFrame(Math.round(previewFrame)); }, [previewFrame, livePreview]);
  useEffect(() => { if (doc?.model?.Sequences?.[sequenceIndex]) setManagerSequence(sequenceIndex); }, [sequenceIndex, doc]);
  useEffect(() => { const previous = document.activeElement; dialog.current?.focus(); return () => previous?.focus?.(); }, []);
  useEffect(() => { if (list.current?.contains(document.activeElement)) list.current.querySelector(`[data-node-id="${selectedIndex}"]`)?.focus(); }, [selectedIndex]);
  useEffect(() => { list.current?.querySelector(`[data-${currentKind === 'Nodes' ? 'node-id' : 'resource-index'}="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' }); const properties = dialog.current?.querySelector('.re-properties'); if (properties) properties.scrollTop = 0; }, [selectedIndex, currentKind, tree]);
  const model = doc?.model;
  const friendly = ['Materials', 'Textures', 'Nodes', 'Geosets', 'GeosetAnims'].includes(currentKind);
  const allRows = model ? resourceRows(model, currentKind, tree) : [];
  const matching = query.trim().toLowerCase();
  const rowLabel = row => currentKind === 'Materials' ? materialName(model, row.index) : resourceName(currentKind, row);
  const rows = matching ? allRows.filter(row => `${rowLabel(row)} ${row.item?.Image || ''} ${currentKind === 'Nodes' ? nodeKind(model, row.item) : ''} ${currentKind === 'Nodes' ? row.index : row.index + 1}`.toLowerCase().includes(matching)) : currentKind === 'Nodes' ? visibleNodeRows(allRows, collapsed) : allRows;
  const selected = selectedIndex === null ? null : allRows.find(row => row.index === selectedIndex) || rows[0];
  const relatedIndices = relatedResourceIndices(model, inspectedGeoset, currentKind);
  const toggleBranch = index => setCollapsed(previous => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const title = titles[currentKind] || 'Resource Manager';
  const viewCamera = row => { if (currentKind === 'Cameras' && row) onViewCamera?.(row.item, row.index); };
  const validVertices = (index, ids) => [...new Set(Array.from(ids || []))].filter(id => Number.isInteger(id) && id >= 0 && id < (doc.model.Geosets[index]?.Vertices.length || 0) / 3);
  const vertices = currentKind === 'Geosets' && selected ? validVertices(selected.index, (selectionByGeoset || localSelection)[selected.index]) : [];
  const changeVertices = (index, ids) => {
    if (!doc.model.Geosets[index]) return;
    const next = validVertices(index, ids);
    setLocalSelection(previous => ({ ...previous, [index]: next })); onVerticesChange?.(index, next);
  };
  const clearVertices = index => {
    setLocalSelection(previous => { if (index === undefined) return {}; const next = { ...previous }; delete next[index]; return next; });
    onSelectionClear?.(index);
  };
  const choose = (nextKind, index) => {
    if (nextKind === 'Model') { nextKind = currentKind; index = Math.max(0, Math.min(selectedIndex, resourceRows(doc.model, currentKind, tree).length - 1)); }
    if (nextKind === 'Nodes' && !doc.model.Nodes[index]) index = resourceRows(doc.model, 'Nodes', tree)[0]?.index ?? null;
    setCurrentKind(nextKind); setSelectedIndex(index); setMessage(''); setQuery(''); setPropertiesOpen(true);
    if (nextKind !== currentKind) onKindChange?.(nextKind);
    if (nextKind === 'Geosets' && doc.model.Geosets[index]) onGeosetChange?.(index);
    if (nextKind === 'Nodes' && index !== null) onNodeChange?.(index);
  };
  const apply = (label, sections, operation) => {
    let cause; const previousGeosetCount = doc.model.Geosets.length, sourceGeoset = currentKind === 'Geosets' ? selected?.index : undefined;
    try {
      const guarded = value => { try { return operation(value || doc.model); } catch (error) { cause = error; throw error; } };
      const result = edit ? edit(label, sections, guarded) : doc.apply(label, sections, guarded);
      lastApplySucceeded.current = result !== false;
      if (result !== false) {
        // Structural removal invalidates all later geoset indices. Clear the old map
        // instead of silently applying its vertex indices to different geometry.
        if (doc.model.Geosets.length < previousGeosetCount) clearVertices();
        else if (label === 'Detach selected faces' && Number.isInteger(result)) {
          clearVertices(sourceGeoset);
          changeVertices(result, Array.from({ length: doc.model.Geosets[result].Vertices.length / 3 }, (_, index) => index));
        }
      }
      setMessage(result === false ? (cause?.message || 'No change applied.') : '');
      redraw(value => value + 1); refresh?.(); return result;
    } catch (error) { lastApplySucceeded.current = false; setMessage(error.message); redraw(value => value + 1); refresh?.(); return false; }
  };
  const add = () => {
    const index = apply(`New ${currentKind}`, [currentKind, 'Nodes', 'PivotPoints', 'Info'], m => {
      if (currentKind === 'Nodes') return createNode(m, nodeType).ObjectId;
      if (currentKind === 'Materials') return ensureMaterial(m);
      if (currentKind === 'GeosetAnims') {
        if (!m.Geosets[activeGeoset]) throw new Error('Choose a geoset before creating its animation.');
        const existing = m.GeosetAnims.findIndex(anim => anim.GeosetId === activeGeoset);
        return existing >= 0 ? existing : m.GeosetAnims.push({ GeosetId: activeGeoset, Alpha: 1, Flags: 0 }) - 1;
      }
      if (currentKind === 'Textures') return m.Textures.push({ Image: '', ReplaceableId: 0, Flags: 0 }) - 1;
      if (currentKind === 'Geosets') { if (!m.Materials.length) ensureMaterial(m); if (!m.Bones.length) createNode(m, 'Bone'); const geoset = makeCube(m); recalculateNormals(geoset); return m.Geosets.push(geoset) - 1; }

      if (currentKind === 'Sequences') { const start = Math.max(0, ...m.Sequences.map(sequence => sequence.Interval[1])) + 100; return m.Sequences.push({ Name: 'Stand', Interval: new Uint32Array([start, start + 1000]), NonLooping: false, MoveSpeed: 0, Rarity: 0, MinimumExtent: new Float32Array(m.Info.MinimumExtent), MaximumExtent: new Float32Array(m.Info.MaximumExtent), BoundsRadius: m.Info.BoundsRadius }) - 1; }
      if (currentKind === 'TextureAnims') return m.TextureAnims.push({}) - 1;
      if (currentKind === 'GlobalSequences') return m.GlobalSequences.push(1000) - 1;
      throw new Error('This resource type cannot be created here.');
    });
    if (index !== false) { choose(currentKind, index); if (currentKind === 'Nodes') setPropertiesOpen(true); }
  };
  const clone = () => {
    if (!selected) return;
    const index = apply(`Clone ${currentKind}`, [currentKind, 'Nodes', 'PivotPoints', 'GeosetAnims'], m => {
      if (currentKind === 'Nodes') {
        const copied = structuredClone(selected.item), created = createNode(m, nodeTypeFor(nodeKind(m, selected.item))), id = created.ObjectId;
        for (const key of Object.keys(created)) delete created[key];
        Object.assign(created, copied, { ObjectId: id }); created.PivotPoint = new Float32Array(copied.PivotPoint || [0, 0, 0]);
        m.Nodes[id] = created; m.PivotPoints[id] = created.PivotPoint; return id;
      }
      if (currentKind === 'Geosets') return duplicateGeoset(m, selected.index);
      return m[currentKind].push(structuredClone(selected.item)) - 1;
    });
    if (index !== false) { choose(currentKind, index); if (currentKind === 'Nodes') setPropertiesOpen(true); }
  };
  const remove = () => {
    if (!selected) return;
    const result = apply(`Remove ${currentKind}`, [currentKind, 'Nodes', 'Geosets', 'GeosetAnims', 'Materials', 'PivotPoints'], m => removeResource(m, currentKind, selected.index));
    if (result !== false) {
      const remaining = resourceRows(doc.model, currentKind, tree), next = remaining[Math.max(0, Math.min(remaining.length - 1, rows.indexOf(selected) - 1))];
      if (next) choose(currentKind, next.index); else setSelectedIndex(null);
    }
  };
  const keyDown = event => {
    if ((event.ctrlKey || event.metaKey) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.stopPropagation();
      if (event.key.toLowerCase() === 'y' || event.shiftKey) onRedo?.(); else onUndo?.();
      return;
    }
    if (['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.stopPropagation();
    if (event.key === 'Escape' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) { event.stopPropagation(); onClose?.(); }
    if (event.key === 'Tab' && !livePreview) {
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  const seek = value => { setFrame(value); onSeek?.(value); };
  const changeSequence = value => { setManagerSequence(value); onSequenceChange?.(value); seek(model.Sequences[value].Interval[0]); };
  return <div className={`resource-editor ${friendly ? 're-xl' : ''}`} onKeyDown={keyDown}>
    <section data-warmkey-scope="dialog" data-warmkey-prefix={`resource:${currentKind}`} data-warmkey-category={`${title} controls`} className={`re-window ${currentKind === 'Nodes' ? 're-node-window' : ''} ${propertiesOpen ? 're-properties-open' : ''}`} role="dialog" aria-modal={!livePreview} aria-label={title} tabIndex={-1} ref={dialog} style={movable.style}>
      <header className="re-caption" {...movable.handleProps}><span>{title}</span><div>{onWarmKeys && <button data-warmkey="warmkeys" title="Configure hotkeys for this window" onClick={onWarmKeys}>Hotkeys</button>}<button data-warmkey="close" className="re-caption-close" aria-label={`Close ${title}`} onClick={onClose}>×</button></div></header>
      {friendly && <nav className="re-manager-tabs" aria-label="Resource managers">{['Materials', 'Textures', 'Nodes', 'Geosets'].map(next => <button key={next} disabled={!model} aria-pressed={next === currentKind} onClick={() => choose(next, next === 'Nodes' ? selectedNodeId ?? 0 : relatedResourceIndices(model, inspectedGeoset, next)[0] ?? 0)}>{next}</button>)}</nav>}
      <div className="re-body"><aside className="re-list-pane"><div className="re-list-label">{currentKind}</div>
        {friendly && <input className="re-search" type="search" aria-label={`Search ${currentKind.toLowerCase()}`} placeholder="Search name, type or ID…" value={query} onChange={event => setQuery(event.target.value)}/>}
        <div ref={list} className="re-list" role={currentKind === 'Nodes' && tree ? 'tree' : 'listbox'} aria-label={`${currentKind} list`} onKeyDown={event => {
          const offset = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
          if (offset && rows.length) { event.preventDefault(); const row = rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(selected) + offset))]; choose(currentKind, row.index); }
          if (currentKind === 'Nodes' && tree && selected && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            if (event.key === 'ArrowRight' && selected.hasChildren) { if (collapsed.has(selected.index)) toggleBranch(selected.index); else { const child = rows.find(row => row.ancestors.at(-1) === selected.index); if (child) choose(currentKind, child.index); } }
            else if (event.key === 'ArrowLeft') { if (selected.hasChildren && !collapsed.has(selected.index)) toggleBranch(selected.index); else if (selected.ancestors.length) choose(currentKind, selected.ancestors.at(-1)); }
          }
        }}>
          {rows.map(row => { const nodeType = nodeKind(model, row.item); const Icon = nodeType === 'EventObjects' ? ({SND:Volume2,SPL:Droplets,FPT:Footprints}[row.item.Name?.slice(0,3)] || Circle) : nodeIcons[nodeType] || Circle; return currentKind === 'Nodes' ? <div key={row.index} data-node-id={row.index} data-node-type={nodeKind(model,row.item) === 'EventObjects' ? row.item.Name?.slice(0,3) : nodeKind(model,row.item)} className={`re-tree-row ${selected?.index === row.index ? 're-selected' : ''}`} role={tree ? 'treeitem' : 'option'} aria-level={tree ? row.depth + 1 : undefined} aria-expanded={tree && row.hasChildren ? !collapsed.has(row.index) : undefined} aria-selected={selected?.index === row.index} tabIndex={selected?.index === row.index || !rows.some(item => item.index === selected?.index) && row === rows[0] ? 0 : -1} style={{ paddingLeft: 4 + Math.min(row.depth, 8) * 14 }} title={`${resourceName(currentKind, row)} · ${nodeKind(model, row.item)} ${row.index}`} onClick={() => choose(currentKind, row.index)} onDoubleClick={() => setPropertiesOpen(true)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(currentKind, row.index); setPropertiesOpen(true); } }}>
            {tree && row.ancestors.slice(-8).map((id, level) => <i aria-hidden="true" key={id} className={`re-tree-line ${level === row.depth - 1 ? 're-tree-elbow' : ''} ${row.continuations[level] ? 're-tree-continuing' : ''}`} style={{ left: 12 + level * 14 }}/>) }
            {tree && row.hasChildren ? <button tabIndex={-1} className="re-tree-expander" aria-label={`${collapsed.has(row.index) ? 'Expand' : 'Collapse'} ${row.item.Name}`} onClick={event => { event.stopPropagation(); toggleBranch(row.index); }}>{collapsed.has(row.index) ? <ChevronRight/> : <ChevronDown/>}</button> : <span className="re-tree-spacer"/>}<Icon className="re-node-icon" aria-hidden="true"/><span className="re-node-name" translate={row.item.Name ? 'no' : undefined}>{resourceName(currentKind, row)}</span><small>{nodeKind(model,row.item) === 'EventObjects' ? EVENT_TYPES[row.item.Name?.slice(0,3)] || 'Event' : nodeTypeFor(nodeKind(model,row.item))?.replace(/([a-z])([A-Z0-9])/g, '$1 $2')}</small>
          </div>  : <button data-resource-index={row.index} data-warmkey={`item:${row.index}`} data-warmkey-label={`Choose ${currentKind} item ${displayNumber(row.index)}`} key={row.index} type="button" role="option" aria-selected={selected?.index === row.index} tabIndex={selected?.index === row.index ? 0 : -1} className={`${selected?.index === row.index ? 're-selected' : ''} ${relatedIndices.includes(row.index) ? 're-related' : ''}`} title={currentKind === 'Cameras' ? `${resourceName(currentKind, row)} · double-click to view through camera` : resourceName(currentKind, row)} onClick={() => choose(currentKind, row.index)} onDoubleClick={() => viewCamera(row)}><span translate={row.item?.Name || currentKind === 'Textures' && row.item?.Image ? 'no' : undefined}>{rowLabel(row)}</span><small>{displayNumber(row.index)}</small></button>; })}
          {!rows.length && <div className="re-empty-list">{matching ? 'No matching resources.' : `No ${currentKind.toLowerCase()}.`}</div>}
        </div>
        {currentKind === 'Nodes' && <label className="re-tree-toggle"><input data-warmkey="hierarchy" aria-label="Show hierarchy" type="checkbox" checked={tree} onChange={event => setTree(event.target.checked)}/>Show hierarchy</label>}
        {currentKind === 'Nodes' && <div className="re-list-actions"><button onClick={() => setCollapsed(new Set())}>Expand all</button><button onClick={() => setCollapsed(new Set(allRows.filter(row => row.hasChildren).map(row => row.index)))}>Collapse all</button><button aria-expanded={propertiesOpen} onClick={() => setPropertiesOpen(value => !value)}>Properties</button></div>}
        {currentKind === 'Nodes' && <label className="re-node-type">New node type:<select data-warmkey="nodeType" aria-label="New node type" value={nodeType} onChange={event => setNodeType(event.target.value)}>{Object.keys(NODE_TYPES).filter(type => type !== 'ParticleEmitterPopcorn' || model?.Version >= 900).map(type => <option key={type}>{type}</option>)}</select></label>}
        <div className="re-list-actions"><button data-warmkey="resourceeditors:action:1" onClick={add} disabled={!model || doc.readOnly}>New</button><button data-warmkey="resourceeditors:action:2" onClick={clone} disabled={!selected || doc.readOnly}>Clone</button><button data-warmkey="resourceeditors:action:3" onClick={remove} disabled={!selected || doc.readOnly || currentKind === 'GlobalSequences'}>Remove</button></div>
        {currentKind === 'Cameras' && <button data-warmkey="viewCamera" title="Set the viewport position, target and field of view from this camera" disabled={!selected || !onViewCamera} onClick={() => viewCamera(selected)}>View Through Camera</button>}
              </aside><div className="re-properties" hidden={currentKind === 'Nodes' && !propertiesOpen}>
        {selected && friendly && <ResourceDetails key={`preview:${currentKind}:${selected.index}`} doc={doc} kind={currentKind} index={selected.index} edit={apply} select={choose} assets={textureAssets} frame={frame} sequenceIndex={managerSequence} onSeek={seek} onSequenceChange={changeSequence} preferences={preferences} teamColor={teamColor} onOpenParticleEditor={onOpenParticleEditor} onImportTexture={onImportTexture} onTextureFolder={onTextureFolder}/>}
        {currentKind === 'Nodes' && selected && nodeKind(model, selected.item) === 'EventObjects' && <fieldset className="inspector-fields" disabled={doc.readOnly}><NodeEventEditor key={selected.index} node={selected.item} model={model} modelPath={modelPath} catalog={catalog} error={catalogError} edit={apply} frame={frame} onSeek={seek} sequenceIndex={managerSequence} onSequenceChange={changeSequence}/></fieldset>}

        {selected ? currentKind === 'GeosetAnims' ? <fieldset className="inspector-fields" disabled={doc.readOnly}><Section title="Geoset animation"><SelectField label="Geoset" value={selected.item.GeosetId} options={model.Geosets.map((_, value) => ({ value, label: `Geoset ${displayNumber(value)}` }))} onChange={value => apply('Assign geoset animation', ['GeosetAnims'], m => { m.GeosetAnims[selected.index].GeosetId = Number(value); })}/><Check label="Drop shadow" value={selected.item.Flags & 1} onChange={value => apply('Set geoset shadow', ['GeosetAnims'], m => { const anim = m.GeosetAnims[selected.index]; anim.Flags = value ? (anim.Flags || 0) | 1 : (anim.Flags || 0) & ~1; })}/>{['Color'].map(property => <TrackEditor key={`${selected.index}:${property}`} label={property === 'Alpha' ? 'Visibility' : 'Color (RGB 0–1)'} value={selected.item[property]} dimensions={property === 'Color' ? 3 : 1} defaultValue={property === 'Color' ? [1, 1, 1] : 1} globalSequences={model.GlobalSequences} frame={frame} onChange={value => apply(`Edit geoset ${property}`, ['GeosetAnims'], m => { const anim = m.GeosetAnims[selected.index]; anim[property] = value; if (property === 'Color') anim.Flags = (anim.Flags || 0) | 2; })}/>)}</Section></fieldset> : <Inspector resourceManager onEditVisibility={onEditVisibility} onOpenEmitter={onOpenParticleEditor} key={`properties:${currentKind}:${selected.index}`} doc={doc} selection={{ kind: currentKind, index: selected.index }} edit={apply} select={choose} selectedVertices={vertices} frame={frame} onImportTexture={onImportTexture || (() => setMessage('Texture loading is unavailable in this window.'))} onTextureFolder={onTextureFolder || (() => setMessage('Folder resolution is unavailable in this window.'))} onSelectionClear={() => { if (lastApplySucceeded.current) clearVertices(selected.index); }} onVerticesChange={ids => { if (lastApplySucceeded.current) changeVertices(selected.index, ids); }}/> : <p className="re-empty-properties">{currentKind === 'GeosetAnims' && model?.Geosets?.[inspectedGeoset] ? `Geoset ${displayNumber(inspectedGeoset)} has no geoset-animation record. Click New to create it.` : 'Select an item, or click New.'}</p>}

      </div></div>
      <footer className="re-footer">{friendly && onUndo && <div className="re-history-actions"><button aria-label="Undo manager edit" disabled={!doc.canUndo || doc.readOnly} onClick={onUndo}>Undo</button><button aria-label="Redo manager edit" disabled={!doc.canRedo || doc.readOnly} onClick={onRedo}>Redo</button></div>}<div className="re-status" role="status">{message || (doc?.readOnly ? 'Read-only model.' : '')}</div>{(!friendly || currentKind === 'Nodes' && selected && nodeKind(model,selected.item) === 'EventObjects') && <label className="re-frame">Frame:<input data-warmkey="frame" aria-label="Resource keyframe time" type="number" min="0" step="1" value={frame} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= 0x7fffffff) seek(value); }}/></label>}<button data-warmkey="resourceeditors:action:4" onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}

export default ResourceEditor;
