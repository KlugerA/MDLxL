import React, { useEffect, useMemo, useRef, useState } from 'react';
import { allNodes } from '../src/animation.js';
import { nodeKind } from '../src/editor-commands.js';
import { applyMovementTransform, constrainMovementVector, movementPlaneAxis, movementRestricted } from '../src/movement.js';
import { movementSelectionSummary } from '../src/movement-selection.js';
import './movement.css';
import ModernIcon from './ModernIcon.jsx';

const titles = { move: 'Move', rotate: 'Rotate', scale: 'Scale' };
const icons = { select: 'sb_selbone', move: 'sb_bonemove', rotate: 'sb_bonerot', scale: 'sb_bonescale' };
const labels = { Bones: 'Bone', Helpers: 'Helper Bone', Attachments: 'Ref Node', Lights: 'Light', ParticleEmitters: 'Particle Emitter', ParticleEmitters2: 'Particle Emitter', ParticleEmitterPopcorns: 'Popcorn Emitter', RibbonEmitters: 'Ribbon Emitter', EventObjects: 'Event Object', CollisionShapes: 'Collision Shape' };
const lockNames = ['Translation', 'Rotation', 'Scaling'];
const formatted = value => Number.isFinite(value) ? String(Number(value.toFixed(4))) : '';

function PositionField({ axis, value, disabled, onCommit }) {
  const [text, setText] = useState(formatted(value)), cancel = useRef(false);
  useEffect(() => setText(formatted(value)), [value]);
  const commit = () => {
    if (cancel.current) { cancel.current = false; return; }
    const next = Number(text);
    if (text.trim() && Number.isFinite(next) && next !== Number(formatted(value)) && !disabled) onCommit(next);
    else setText(formatted(value));
  };
  return <label><span>{axis}</span><input aria-label={`${axis} coordinate`} data-warmkey={`coordinate:${axis}`} type="number" step="any" disabled={disabled} value={text} onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancel.current = true; setText(formatted(value)); event.currentTarget.blur(); } }}/></label>;
}

export default function MovementController({ model, revision = 0, sequenceIndex = -1, time = 0, selectedNodeIds = [], selectionByGeoset = {}, onSelectNodes, onEdit, onVertexTransform, onPlayingChange, transformMode = 'move', onTransformMode, transformSpace = 'local', onTransformSpace, onOpenNodeManager, globalSeqId = null, highlightKeyframes = true, onHighlightKeyframes, disabled = false, restPose = false, multiple, onMultiple, workplaneEnabled = false, onWorkplaneEnabled, workplane = 'xy', onWorkplane, restrictions = {}, onRestrictions }) {
  const [localMultiple, setLocalMultiple] = useState(false), [values, setValues] = useState([0, 0, 0]), [error, setError] = useState('');
  const multiselect = multiple ?? localMultiple;
  const nodes = useMemo(() => allNodes(model), [model, revision]);
  const selected = nodes.filter(node => selectedNodeIds.includes(node.ObjectId));
  const frame = Math.round(time), globalDomain = !restPose && Number.isInteger(globalSeqId) && globalSeqId >= 0;
  const editSequenceIndex = restPose || globalDomain ? -1 : sequenceIndex >= 0 ? sequenceIndex : (model.Sequences || []).findIndex(item => frame >= item.Interval[0] && frame <= item.Interval[1]);
  const summary = useMemo(() => movementSelectionSummary(model, selectedNodeIds, selectionByGeoset, { time: frame, sequenceIndex: editSequenceIndex, restPose }), [model, revision, selectedNodeIds, selectionByGeoset, frame, editSequenceIndex, restPose]);
  const editableNodes = !disabled && !globalDomain && selected.length > 0 && (restPose || editSequenceIndex >= 0);
  const blocked = mode => movementRestricted(mode, restrictions) || restPose && mode !== 'move' && mode !== 'select';
  const normalAxis = workplaneEnabled ? movementPlaneAxis(workplane) : -1;
  useEffect(() => { setValues(transformMode === 'scale' ? [1, 1, 1] : [0, 0, 0]); setError(''); }, [transformMode, restPose]);
  const run = (label, mutate) => {
    if (disabled || globalDomain) return false;
    setError(''); onPlayingChange?.(false);
    try { let cause; const result = onEdit?.(label, restPose ? ['Nodes', 'PivotPoints'] : ['Nodes'], current => { try { return mutate(current); } catch (failure) { cause = failure; throw failure; } }); if (cause) throw cause; if (result === false) { setError('The movement edit could not be applied.'); return false; } return true; }
    catch (cause) { setError(cause.message); return false; }
  };
  const options = { restPose, workplaneEnabled, workplane, restrictions };
  const commitPosition = (index, value) => {
    if (!summary.center || blocked('move')) return;
    const translation = [0, 0, 0]; translation[index] = value - summary.center[index];
    if (summary.source === 'nodes') run(restPose ? 'Move rest-pose pivots' : 'Move bones and nodes', current => applyMovementTransform(current, selectedNodeIds, frame, editSequenceIndex, { ...options, mode: 'move', space: 'world', values: translation }));
    else if (restPose && onVertexTransform) { onPlayingChange?.(false); onVertexTransform({ translation: constrainMovementVector(translation, options), selections: selectionByGeoset }); }
  };
  const apply = () => { if (!blocked(transformMode)) run(`${titles[transformMode]} bones and nodes`, current => applyMovementTransform(current, selectedNodeIds, frame, editSequenceIndex, { ...options, mode: transformMode, space: transformSpace, values })); };
  const chooseNode = event => {
    if (event.target.value === '') { if (!multiselect) onSelectNodes?.([]); return; }
    const id = Number(event.target.value);
    onSelectNodes?.(multiselect ? selectedNodeIds.includes(id) ? selectedNodeIds.filter(value => value !== id) : [...selectedNodeIds, id] : [id]);
  };
  const modeTitle = mode => mode === 'select' ? 'Select' : titles[mode];
  return <section className="movement-controller" aria-label={restPose ? 'Bones controller' : 'Movement controller'} onFocusCapture={event => { if (event.target.matches('input[type="number"]')) onPlayingChange?.(false); }}>
    <details className="movement-object" open><summary><strong>Object:</strong></summary>
      <select className="movement-object-picker" aria-label="Movement bone or node" title={selected.map(node => node.Name || `Node ${node.ObjectId}`).join(', ')} value={selected.length === 1 ? selected[0].ObjectId : ''} onChange={chooseNode}><option value="">{selected.length > 1 ? `${selected.length} objects selected` : 'No selection'}</option>{nodes.map(node => <option key={node.ObjectId} value={node.ObjectId} translate="no">{selectedNodeIds.includes(node.ObjectId) ? '✓ ' : ''}{node.Name || `Node ${node.ObjectId}`}</option>)}</select>
      <div className="movement-object-type">Object type - {selected.length === 1 ? labels[nodeKind(model, selected[0])] || 'Node' : selected.length ? 'Multiple' : '—'}</div>
      <div title="Vertices directly influenced by selected bones; each vertex counted once.">Child Vertices: <output>{summary.childVertexCount}</output></div>
      <div>Selected: <output>{summary.selectedCount}</output></div>
      <div className="movement-section-label">Coordinates:</div>
      <div className="movement-vector" title={summary.source === 'vertices' ? 'Center of the selected vertices' : 'Model-space center of the selected node pivots'}>{['X', 'Y', 'Z'].map((axis, index) => <PositionField key={axis} axis={axis} value={summary.center?.[index]} disabled={disabled || blocked('move') || index === normalAxis || !summary.center || (summary.source === 'nodes' ? !editableNodes : !restPose || !onVertexTransform)} onCommit={value => commitPosition(index, value)}/>)}</div>
      <label className="movement-check"><input type="checkbox" checked={multiselect} onChange={event => { setLocalMultiple(event.target.checked); onMultiple?.(event.target.checked); }}/>Multiselect</label>
    </details>
    <div className="movement-workplane"><label className="movement-check"><input data-warmkey="workplaneEnabled" type="checkbox" checked={workplaneEnabled} onChange={event => onWorkplaneEnabled?.(event.target.checked)}/>Workplane</label><div className="movement-planes" role="group" aria-label="Movement workplane">{[['xy', 'XY'], ['xz', 'ZX'], ['yz', 'YZ']].map(([value, label]) => <label key={value}><input data-warmkey={`plane:${value}`} type="radio" name={`movement-plane-${restPose ? 'bones' : 'animation'}`} checked={(workplane === 'zx' ? 'xz' : workplane) === value} onChange={() => onWorkplane?.(value)}/>{label}</label>)}</div></div>
    <div className="movement-section-label">Tools</div>
    <div className="movement-tools" role="group" aria-label="Movement tool">{['select', 'move', 'rotate', 'scale'].map(mode => <button key={mode} type="button" data-warmkey={mode === 'move' ? 'translate' : mode} title={modeTitle(mode)} aria-label={modeTitle(mode)} aria-pressed={transformMode === mode} disabled={mode !== 'select' && (disabled || blocked(mode))} onClick={() => { if (!blocked(mode)) onTransformMode?.(mode); }}><ModernIcon name={icons[mode]}/></button>)}</div>
    <details className="movement-options"><summary>Options</summary>
      <label className="movement-check" title="Checked: node-local axes. Unchecked: world axes. Workplanes constrain model-space movement separately."><input aria-label="Animating Axis" type="checkbox" checked={transformSpace === 'local' || transformMode === 'scale'} disabled={restPose || transformMode === 'scale'} onChange={event => onTransformSpace?.(event.target.checked ? 'local' : 'world')}/>Animating Axis <small>{transformSpace === 'local' || transformMode === 'scale' ? 'local' : 'world'}</small></label>
      {!restPose && <label className="movement-check"><input type="checkbox" checked={highlightKeyframes} onChange={event => onHighlightKeyframes?.(event.target.checked)}/>Highlight KF</label>}
      <div className="movement-row"><button onClick={() => onSelectNodes?.(nodes.map(node => node.ObjectId))}>All</button><button onClick={() => onSelectNodes?.([])}>Clear</button></div><button onClick={onOpenNodeManager}>Node Manager</button>
      {!restPose && titles[transformMode] && <><div className="movement-section-label">{titles[transformMode]} {transformMode === 'rotate' ? '(degrees)' : transformMode === 'scale' ? '(factor)' : '(offset)'}</div><div className="movement-vector movement-amount">{['X', 'Y', 'Z'].map((axis, index) => <label key={axis}>{axis}<input aria-label={`${titles[transformMode]} ${axis} amount`} type="number" step={transformMode === 'scale' ? '.05' : '1'} disabled={!editableNodes || blocked(transformMode)} value={values[index]} onChange={event => setValues(previous => previous.map((value, i) => i === index ? Number(event.target.value) : value))}/></label>)}</div><button disabled={!editableNodes || blocked(transformMode)} onClick={apply}>Apply {titles[transformMode]}</button></>}
    </details>
    <div className="movement-restrictions" role="group" aria-label="Transform restrictions"><strong>Restrict:</strong>{lockNames.map(name => <label className="movement-check" key={name}><input type="checkbox" checked={!!restrictions[name.toLowerCase()]} onChange={event => onRestrictions?.({ ...restrictions, [name.toLowerCase()]: event.target.checked })}/>{name}</label>)}<button disabled={!lockNames.some(name => restrictions[name.toLowerCase()])} onClick={() => onRestrictions?.({ translation: false, rotation: false, scaling: false })}>Release Restrictions</button></div>
    {selected.length > 0 && !restPose && editSequenceIndex < 0 && <p className="movement-hint">Choose an animation to edit movement.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
