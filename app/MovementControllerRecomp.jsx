import React, { useEffect, useMemo, useRef, useState } from 'react';
import { allNodes } from '../src/animation.js';
import { nodeKind } from '../src/editor-commands.js';
import {
  applyMovementTransform, constrainMovementVector, deleteMovementControllers,
  movementControllerType, movementPlaneAxis, movementProperties, movementRestricted,
  setMovementBezierHandles, setMovementControllerType, setMovementHermiteCurve,
} from '../src/movement.js';
import { movementSelectionSummary } from '../src/movement-selection.js';
import './movement.css';
import ModernIcon from './ModernIcon.jsx';
import BoneToolIcon from './BoneToolIcon.jsx';

const titles = { move: 'Move', rotate: 'Rotate', scale: 'Scale' };
const icons = { select: 'sb_selbone', move: 'sb_bonemove', rotate: 'sb_bonerot', scale: 'sb_bonescale' };
const labels = { Bones: 'Bone', Helpers: 'Helper Bone', Attachments: 'Ref Node', Lights: 'Light', ParticleEmitters: 'Particle Emitter', ParticleEmitters2: 'Particle Emitter', ParticleEmitterPopcorns: 'Popcorn Emitter', RibbonEmitters: 'Ribbon Emitter', EventObjects: 'Event Object', CollisionShapes: 'Collision Shape' };
const lockNames = ['Translation', 'Rotation', 'Scaling'];
const controllerOptions = [['Non-Interp', 0], ['Linear', 1], ['Bezier', 3], ['Hermite', 2]];
const formatted = value => Number.isFinite(value) ? String(Number(value.toFixed(4))) : '';
const vectorText = value => Array.from(value || []).map(number => Number(number.toFixed(5))).join(', ');

function curvePath({ tension, continuity, bias }) {
  const startTangent = (1 - tension) * (1 - continuity) * (1 - bias);
  const endTangent = (1 - tension) * (1 + continuity) * (1 + bias);
  return Array.from({ length: 41 }, (_, index) => {
    const t = index / 40, t2 = t * t, t3 = t2 * t;
    const value = (t3 - 2 * t2 + t) * startTangent + (-2 * t3 + 3 * t2) + (t3 - t2) * endTangent;
    return `${index ? 'L' : 'M'}${8 + t * 84},${47 - value * 36}`;
  }).join(' ');
}

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


export default function MovementController({ model, revision = 0, sequenceIndex = -1, time = 0, selectedNodeIds = [], selectionByGeoset = {}, onSelectNodes, onEdit, onVertexTransform, onPlayingChange, transformMode = 'move', onTransformMode, transformSpace = 'local', onTransformSpace, onOpenNodeManager, globalSeqId = null, onTimelineChange, highlightKeyframes = false, onHighlightKeyframes, disabled = false, restPose = false, multiple, onMultiple, workplaneEnabled = false, onWorkplaneEnabled, workplane = 'xy', onWorkplane, restrictions = {}, onRestrictions, portraitMode = false, portraitCameraIndex = 0, onPortraitCameraIndex, onPortraitNew, onPortraitUpdate, onDeleteBone, onCreateRigNode, onAttach, onDetach, onSoftBind, onHardBind, onDetachVertices, attachActive = false, createOpen = false, onCreateOpen, canDeleteBone = false, canAttach = false, canDetach = false, canBind = false }) {
  const [localMultiple, setLocalMultiple] = useState(false), [values, setValues] = useState([0, 0, 0]), [error, setError] = useState('');
  const [curveOpen, setCurveOpen] = useState(false), [curve, setCurve] = useState({ tension: 0, continuity: 0, bias: 0 });
  const [incoming, setIncoming] = useState(''), [outgoing, setOutgoing] = useState('');
  const multiselect = multiple ?? localMultiple;
  const nodes = useMemo(() => allNodes(model), [model, revision]);
  const selected = nodes.filter(node => selectedNodeIds.includes(node.ObjectId));
  const frame = Math.round(time), globalDomain = !restPose && Number.isInteger(globalSeqId) && globalSeqId >= 0;
  const editSequenceIndex = restPose || globalDomain ? -1 : sequenceIndex >= 0 ? sequenceIndex : (model.Sequences || []).findIndex(item => frame >= item.Interval[0] && frame <= item.Interval[1]);
  const summary = useMemo(() => movementSelectionSummary(model, selectedNodeIds, selectionByGeoset, { time: frame, sequenceIndex: editSequenceIndex, restPose }), [model, revision, selectedNodeIds, selectionByGeoset, frame, editSequenceIndex, restPose]);
  const editableNodes = !disabled && !globalDomain && selected.length > 0 && (restPose || editSequenceIndex >= 0);
  const blocked = mode => movementRestricted(mode, restrictions) || restPose && mode !== 'move' && mode !== 'select';
  const normalAxis = workplaneEnabled ? movementPlaneAxis(workplane) : -1;
  const controllerMode = movementProperties[transformMode] ? transformMode : null;
  const controllerProperty = controllerMode ? movementProperties[controllerMode] : null;
  const controllerType = useMemo(() => selected.length && controllerMode ? movementControllerType(model, selectedNodeIds, controllerMode) : null, [model, revision, selectedNodeIds, selected.length, controllerMode]);
  const selectedKey = selected.length === 1 && controllerProperty ? selected[0][controllerProperty]?.Keys?.find(key => key.Frame === frame) : null;

  useEffect(() => { setValues(transformMode === 'scale' ? [1, 1, 1] : [0, 0, 0]); setError(''); }, [transformMode, restPose]);
  useEffect(() => { setIncoming(vectorText(selectedKey?.InTan || selectedKey?.Vector)); setOutgoing(vectorText(selectedKey?.OutTan || selectedKey?.Vector)); }, [selectedKey, revision, controllerType]);

  const run = (label, mutate) => {
    if (disabled || globalDomain) return false;
    setError(''); onPlayingChange?.(false);
    try {
      let cause;
      const result = onEdit?.(label, restPose ? ['Nodes', 'PivotPoints'] : ['Nodes'], current => { try { return mutate(current); } catch (failure) { cause = failure; throw failure; } });
      if (cause) throw cause;
      // The document returns false for a valid no-op (for example, changing
      // T/C/B on a single constant key). Only thrown validation failures are errors.
      if (result === false) return true;
      return true;
    } catch (cause) { setError(cause.message); return false; }
  };
  const options = { restPose, workplaneEnabled, workplane, restrictions };
  const commitPosition = (index, value) => {
    if (!summary.center || blocked('move')) return;
    const translation = [0, 0, 0]; translation[index] = value - summary.center[index];
    if (summary.source === 'nodes') run(restPose ? 'Move rest-pose pivots' : 'Move bones and nodes', current => applyMovementTransform(current, selectedNodeIds, frame, editSequenceIndex, { ...options, mode: 'move', space: 'world', values: translation }));
    else if (restPose && onVertexTransform) { onPlayingChange?.(false); onVertexTransform({ translation: constrainMovementVector(translation, options), selections: selectionByGeoset }); }
  };
  const coordinateValues = ['rotate', 'scale'].includes(transformMode) ? values : summary.center;
  const coordinateDisabled = index => disabled || index === normalAxis || !coordinateValues || (['move', 'select'].includes(transformMode) ? blocked('move') || !summary.center || (summary.source === 'nodes' ? !editableNodes : !restPose || !onVertexTransform) : !editableNodes || blocked(transformMode));
  const commitCoordinate = (index, value) => {
    if (['move', 'select'].includes(transformMode)) return commitPosition(index, value);
    const transformValues = transformMode === 'scale' ? [1, 1, 1] : [0, 0, 0];
    transformValues[index] = value;
    setValues(previous => previous.map((entry, i) => i === index ? value : entry));
    if (!blocked(transformMode)) run(`${titles[transformMode]} bones and nodes`, current => applyMovementTransform(current, selectedNodeIds, frame, editSequenceIndex, { ...options, mode: transformMode, space: transformSpace, values: transformValues }));
  };
  const chooseNode = event => {
    if (event.target.value === '') { if (!multiselect) onSelectNodes?.([]); return; }
    const id = Number(event.target.value);
    onSelectNodes?.(multiselect ? selectedNodeIds.includes(id) ? selectedNodeIds.filter(value => value !== id) : [...selectedNodeIds, id] : [id]);
  };
  const changeController = lineType => {
    if (!controllerMode) return;
    if (run(`Set ${controllerProperty} controller`, current => setMovementControllerType(current, selectedNodeIds, sequenceIndex, controllerMode, lineType)) && lineType >= 2) { setCurve({ tension: 0, continuity: 0, bias: 0 }); setCurveOpen(true); }
  };
  const commitCurve = next => { setCurve(next); run(`Set ${controllerProperty} Hermite curve`, current => setMovementHermiteCurve(current, selectedNodeIds, sequenceIndex, controllerMode, next)); };
  const parseHandle = text => text.split(',').map(value => Number(value.trim()));
  const commitBezier = () => run(`Edit ${controllerProperty} Bezier handles`, current => setMovementBezierHandles(current, selectedNodeIds, frame, sequenceIndex, controllerMode, { incoming: parseHandle(incoming), outgoing: parseHandle(outgoing) }));
  const modeTitle = mode => mode === 'select' ? 'Select' : titles[mode];
  const selectedName = selected.length === 1 ? selected[0].Name || `Node ${selected[0].ObjectId}` : selected.length ? `${selected.length} objects` : 'No object';

  return <section className="movement-controller" aria-label={restPose ? 'Bones controller' : 'Movement controller'} onFocusCapture={event => { if (event.target.matches('input[type="number"]')) onPlayingChange?.(false); }}>

    {!restPose && <label className="movement-sequence"><strong>Current Sequence:</strong><select data-warmkey="animationSequence" aria-label="Movement current sequence" value={globalSeqId === null ? sequenceIndex : `global:${globalSeqId}`} onChange={event => onTimelineChange?.(event.target.value)}>{!portraitMode && <option value={-1}>All line</option>}{model.Sequences.map((item, index) => (!portraitMode || /portrait/i.test(item.Name || '')) && <option key={index} value={index} translate="no">{item.Name}</option>)}{(!portraitMode ? model.GlobalSequences || [] : []).map((duration, index) => <option key={`global:${index}`} value={`global:${index}`}>Global {index + 1} · {duration} ms</option>)}</select></label>}
    <div className="movement-object"><div className="movement-object-title"><strong>Object:</strong></div>
      <select className="movement-object-picker" aria-label="Movement bone or node" title={selected.map(node => node.Name || `Node ${node.ObjectId}`).join(', ')} value={selected.length === 1 ? selected[0].ObjectId : ''} onChange={chooseNode}><option value="">{selected.length > 1 ? `${selected.length} objects selected` : 'No selection'}</option>{nodes.map(node => <option key={node.ObjectId} value={node.ObjectId} translate="no">{selectedNodeIds.includes(node.ObjectId) ? '✓ ' : ''}{node.Name || `Node ${node.ObjectId}`}</option>)}</select>
      <div className="movement-object-type">Object type - {selected.length === 1 ? labels[nodeKind(model, selected[0])] || 'Node' : selected.length ? 'Multiple' : '—'}</div>
      <div title="Vertices directly influenced by selected bones; each vertex counted once.">Child Vertices: <output>{summary.childVertexCount}</output></div><div>Selected: <output>{summary.selectedCount}</output></div>
      <div className="movement-section-label">Coordinates:</div><div className="movement-vector" title={transformMode === 'rotate' ? 'Rotation delta in degrees' : transformMode === 'scale' ? 'Resize factor' : summary.source === 'vertices' ? 'Center of the selected vertices' : 'Model-space center of the selected node pivots'}>{['X', 'Y', 'Z'].map((axis, index) => <PositionField key={axis} axis={axis} value={coordinateValues?.[index]} disabled={coordinateDisabled(index)} onCommit={value => commitCoordinate(index, value)}/>)}</div>
      <label className="movement-check"><input type="checkbox" checked={multiselect} onChange={event => { setLocalMultiple(event.target.checked); onMultiple?.(event.target.checked); }}/>Multiselect</label>
    </div>
    <div className="movement-workplane"><label className="movement-check"><input data-warmkey="workplaneEnabled" type="checkbox" checked={workplaneEnabled} onChange={event => onWorkplaneEnabled?.(event.target.checked)}/>Workplane</label><div className="movement-planes" role="group" aria-label="Movement workplane">{[['xy', 'XY'], ['xz', 'ZX'], ['yz', 'YZ']].map(([value, label]) => <label key={value}><input data-warmkey={`plane:${value}`} type="radio" name={`movement-plane-${restPose ? 'bones' : 'animation'}`} checked={(workplane === 'zx' ? 'xz' : workplane) === value} onChange={() => onWorkplane?.(value)}/>{label}</label>)}</div></div>
    <div className="movement-section-label">Tools</div>{restPose ? <div className="movement-tools bone-tools" role="group" aria-label="Bones tools">
      <button type="button" data-warmkey="select" title="Select Tool (A)" aria-label="Select Tool" aria-pressed={transformMode === 'select' && !attachActive} onClick={() => onTransformMode?.('select')}><ModernIcon name={icons.select}/></button>
      <button type="button" data-warmkey="translate" title="Move (M/Q)" aria-label="Move" aria-pressed={transformMode === 'move' && !attachActive} disabled={disabled || blocked('move')} onClick={() => onTransformMode?.('move')}><ModernIcon name={icons.move}/></button>
      <button type="button" data-warmkey="Delete vertices" title="Delete bone (Delete)" aria-label="Delete bone" disabled={disabled || !canDeleteBone} onClick={onDeleteBone}><BoneToolIcon kind="delete"/></button>
      <div className="bone-create-anchor"><button type="button" title="Create" aria-label="Create" aria-expanded={createOpen} disabled={disabled} onClick={() => onCreateOpen?.(!createOpen)}><BoneToolIcon kind="create"/></button>{createOpen && <div className="bone-create-menu" role="menu" aria-label="Create bone or attachment"><button role="menuitem" onClick={() => onCreateRigNode?.('Bone')}><BoneToolIcon kind="bone"/>Bone</button><button role="menuitem" onClick={() => onCreateRigNode?.('Attachment')}><BoneToolIcon kind="attachment"/>Attachment</button></div>}</div>
      <button type="button" data-warmkey="Create triangle" title="Attach (T)" aria-label="Attach" aria-pressed={attachActive} disabled={disabled || !canAttach} onClick={onAttach}><BoneToolIcon kind="attach"/></button>
      <button type="button" data-warmkey="bone:detach" title="Detach (D)" aria-label="Detach" disabled={disabled || !canDetach} onClick={onDetach}><BoneToolIcon kind="detach"/></button>
      <button type="button" data-warmkey="Collapse" title="Soft Bind (C)" aria-label="Soft Bind" disabled={disabled || !canBind} onClick={onSoftBind}><BoneToolIcon kind="soft"/></button>
      <button type="button" data-warmkey="rotate" title="Hard Bind (R)" aria-label="Hard Bind" disabled={disabled || !canBind} onClick={onHardBind}><BoneToolIcon kind="hard"/></button>
      <button type="button" data-warmkey="bone:detachVertices" title="Detach Vertices (V)" aria-label="Detach Vertices" disabled={disabled || !canBind} onClick={onDetachVertices}><BoneToolIcon kind="detachVertices"/></button>
    </div> : <div className="movement-tools" role="group" aria-label="Movement tool">{['select', 'move', 'rotate', 'scale'].map(mode => <button key={mode} type="button" data-warmkey={mode === 'move' ? 'translate' : mode} title={modeTitle(mode)} aria-label={modeTitle(mode)} aria-pressed={transformMode === mode} disabled={mode !== 'select' && (disabled || blocked(mode))} onClick={() => { if (!blocked(mode)) onTransformMode?.(mode); }}><ModernIcon name={icons[mode]}/></button>)}</div>}
    <div className="movement-restrictions" role="group" aria-label="Transform restrictions"><strong>Restrict:</strong>{lockNames.map(name => <label className="movement-check" key={name}><input type="checkbox" checked={!!restrictions[name.toLowerCase()]} onChange={event => onRestrictions?.({ ...restrictions, [name.toLowerCase()]: event.target.checked })}/>{name}</label>)}<button disabled={!lockNames.some(name => restrictions[name.toLowerCase()])} onClick={() => onRestrictions?.({ translation: false, rotation: false, scaling: false })}>Release Restrictions</button></div>
    {!restPose && <section className="movement-controller-type" aria-label="Movement controller type"><strong>Controller:</strong><div translate="no">{selectedName}</div><div>{controllerProperty || 'Select a transform tool'}</div><fieldset disabled={disabled || globalDomain || !selected.length || !controllerMode}><legend>Controller type</legend>{controllerOptions.map(([label, lineType]) => <label key={lineType}><input type="radio" name="movement-controller-type" checked={controllerType === lineType} onChange={() => changeController(lineType)}/>{label}</label>)}</fieldset>{controllerType >= 2 && <button onClick={() => setCurveOpen(true)}>Curve Properties…</button>}<label className="movement-check"><input type="checkbox" checked={highlightKeyframes} onChange={event => onHighlightKeyframes?.(event.target.checked)}/>Highlight KF</label><button className="movement-delete-controller" disabled={disabled || globalDomain || !selected.length} onClick={() => run(sequenceIndex < 0 ? 'Delete all movement controllers' : 'Delete movement controllers in sequence', current => deleteMovementControllers(current, selectedNodeIds, sequenceIndex))}>Delete Controller</button></section>}
    {selected.length > 0 && !restPose && editSequenceIndex < 0 && sequenceIndex >= 0 && <p className="movement-hint">Choose an animation to edit movement.</p>}{error && <p role="alert">{error}</p>}
    {curveOpen && controllerType >= 2 && <div className="movement-curve-dialog" role="dialog" aria-modal="false" aria-label="Curve Properties"><header><strong>Curve Properties</strong><button aria-label="Close Curve Properties" onClick={() => setCurveOpen(false)}>×</button></header><div className="movement-curve-graph"><svg viewBox="0 0 100 54" aria-label="Interpolation curve"><line className="curve-axis" x1="50" y1="3" x2="50" y2="51"/><path d={curvePath(curve)}/>{controllerType === 3 && <><line className="curve-handle" x1="8" y1="47" x2="30" y2="32"/><line className="curve-handle" x1="92" y1="11" x2="70" y2="26"/><circle cx="30" cy="32" r="2"/><circle cx="70" cy="26" r="2"/></>}</svg></div>{controllerType === 2 ? <div className="movement-curve-fields">{[['tension', 'Tension:'], ['continuity', 'Continuity:'], ['bias', 'Bias:']].map(([name, label]) => <label key={name}>{label}<input type="number" min="-1" max="1" step="0.05" value={curve[name]} onChange={event => setCurve(previous => ({ ...previous, [name]: Number(event.target.value) }))} onBlur={() => commitCurve(curve)}/></label>)}</div> : <div className="movement-bezier-fields"><p>Edit the selected keyframe's tangent handles.</p><label>Incoming tangent:<input aria-label="Incoming Bezier tangent" value={incoming} onChange={event => setIncoming(event.target.value)}/></label><label>Outgoing tangent:<input aria-label="Outgoing Bezier tangent" value={outgoing} onChange={event => setOutgoing(event.target.value)}/></label><button disabled={!selectedKey} onClick={commitBezier}>Apply Handles</button></div>}</div>}
  </section>;
}
