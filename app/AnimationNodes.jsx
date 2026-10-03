import React, { useEffect, useMemo, useRef, useState } from 'react';
import SidebarSection from './SidebarSection.jsx';
import { allNodes } from '../src/animation.js';
import { nodeKind } from '../src/editor-commands.js';
import { readAnimationTrack, sampleAnimationProperty } from '../src/animation-tracks.js';
import { nodeTypeNames, nodeVisibilityTargets, setNodeVisibility } from '../src/node-visibility.js';
import { visibilityGlobal } from '../src/visibility-editing.js';
import './animation-resources.css';

export default function AnimationNodes({ model, revision, selectedNodeIds, onSelectNodes, sequenceIndex, globalSeqId, time, timelineSelection, onWholeAnimation, onThisKey, onTimelineChange, onEdit, onPause, onOpenManager, onOpenEmitter, particlesVisible, onShowParticles, disabled }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('visibility'), [mode, setMode] = useState('Clueless'), [error, setError] = useState('');
  const editPanel = useRef(null), nodeList = useRef(null);
  const nodes = useMemo(() => allNodes(model).map(node => { const type = nodeKind(model, node); return { node, type, visible: ['Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'].includes(type) }; }), [model, revision]);
  const selected = model.Nodes[selectedNodeIds.at(-1)];
  const isEffect = selected && ['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'].includes(nodeKind(model, selected));
  const targets = useMemo(() => nodeVisibilityTargets(model, selectedNodeIds), [model, revision, selectedNodeIds.join(',')]);
  const matching = query.trim().toLowerCase();
  const rows = nodes.filter(({ node, type, visible }) => (matching || filter === 'all' || visible || selectedNodeIds.includes(node.ObjectId)) && (!matching || `${node.Name} ${nodeTypeNames[type]} ${node.ObjectId}`.toLowerCase().includes(matching)));
  const clocks = [...new Set(targets.map(t => visibilityGlobal(readAnimationTrack(model, t))))], clock = clocks[0];
  const clockMismatch = clocks.length > 1 || targets.length > 0 && clock !== globalSeqId;
  const frame = Math.round(time), sequence = model.Sequences[sequenceIndex];
  const values = targets.map(t => Number(sampleAnimationProperty(model, t, frame, sequenceIndex, globalSeqId)));
  const shown = values.length ? values.every(v => v > 0) ? 'On' : values.every(v => v <= 0) ? 'Off' : 'Mixed' : 'No visibility';
  const range = timelineSelection?.range, frames = timelineSelection?.frames;
  const scope = frames?.length ? `${frames.length} selected keys` : range ? `Range ${range[0]}–${range[1]}` : `This key · ${frame} ms`;
  const choose = id => { onSelectNodes([id]); setError(''); };
  useEffect(() => { setError(''); }, [selectedNodeIds.join(','), sequenceIndex, globalSeqId]);
  useEffect(() => { nodeList.current?.querySelector(`[data-node-id="${selectedNodeIds.at(-1)}"]`)?.scrollIntoView({ block: 'nearest' }); editPanel.current?.scrollIntoView({ block: 'nearest' }); }, [selectedNodeIds.join(',')]);
  function apply(amount) {
    let failure;
    onPause();
    try {
      const result = onEdit('Set node visibility', ['Nodes', 'GeosetAnims'], current => {
        try { return setNodeVisibility(current, selectedNodeIds, { sequenceIndex, globalSeqId, frame, range, frames, amount }); }
        catch (cause) { failure = cause; throw cause; }
      });
      setError(failure?.message || (result === false ? 'No visibility change applied.' : ''));
    } catch (cause) { setError(cause.message); }
  }
  return <SidebarSection title="Nodes" className="animation-nodes">
    <div className="an-options"><select aria-label="Node controls mode" value={mode} onChange={e => setMode(e.target.value)}><option>Clueless</option><option>Classic</option></select><select aria-label="Node list filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="visibility">Can show / hide</option><option value="all">All nodes</option></select></div>
    <input type="search" aria-label="Find animation node" placeholder="Find a node…" value={query} onChange={e => setQuery(e.target.value)}/>
    <div ref={nodeList} className="an-list" role="listbox" aria-label="Animation nodes">{rows.map(({ node, type }) => <button data-node-id={node.ObjectId} key={node.ObjectId} type="button" role="option" aria-selected={selectedNodeIds.includes(node.ObjectId)} onClick={() => choose(node.ObjectId)} title={node.Name}><span translate="no">{node.Name || `Node ${node.ObjectId}`}</span><small>{nodeTypeNames[type] || type}</small></button>)}{!rows.length && <p>No matching nodes.</p>}</div>
    {selected ? <div ref={editPanel} className="an-edit" aria-label="Node visibility controls"><strong translate="no">{selected.Name || `Node ${selected.ObjectId}`}</strong><div className="an-state"><span>Visibility</span><b>{shown}</b></div>
      {targets.length ? <><p className="an-scope">{globalSeqId !== null ? `Global loop ${globalSeqId + 1}` : sequence?.Name || 'Choose an animation'} · {scope}</p>
        {clockMismatch ? <p>{clocks.length > 1 ? 'These mesh tracks use different clocks. Open the manager to choose a mesh.' : <><span>This track uses {clock === null ? 'named animations' : `global loop ${clock + 1}`}.</span><button onClick={() => onTimelineChange(clock === null ? Math.max(0, sequenceIndex) : `global:${clock}`)}>Use this clock</button></>}</p> : <><div className="an-scope-buttons"><button onClick={onThisKey}>This key</button><button disabled={!sequence && globalSeqId === null} onClick={onWholeAnimation}>{globalSeqId === null ? 'Whole animation' : 'Whole loop'}</button></div><div className="an-show-hide"><button disabled={disabled || !sequence && globalSeqId === null} onClick={() => apply(1)}>Show</button><button disabled={disabled || !sequence && globalSeqId === null} onClick={() => apply(0)}>Hide</button></div></>}
        {mode === 'Clueless' && <p className="an-help">{targets[0].kind === 'geoset' ? `Controls ${targets.length} bound mesh part${targets.length === 1 ? '' : 's'}. ` : ''}Scrub the bottom timeline to see the pose. Drag a range, then Show or Hide. Ctrl-click keys to pick several.{['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'].includes(nodeKind(model, selected)) && ' Play previews emission; existing particles finish their lifetime.'}</p>}
      </> : <p>This node has no visibility track or bound mesh.</p>}
      {isEffect && <label className="an-particle-preview"><input type="checkbox" checked={particlesVisible} onChange={event => onShowParticles(event.target.checked)}/>Preview particles</label>}<div className="an-links"><button onClick={onOpenManager}>{mode === 'Clueless' ? 'More node settings…' : 'Node Manager…'}</button>{['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'].includes(nodeKind(model, selected)) && <button onClick={() => onOpenEmitter(selected.ObjectId)}>EMTR…</button>}</div>
    </div> : <p className="an-help">Pick a node here or on the model to edit when it appears.</p>}
    {error && <p role="alert" className="an-error">{error}</p>}
  </SidebarSection>;
}
