import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NumberField } from './Fields.jsx';
import { motionChannels, motionParentChain, motionPose, setMotionPose } from '../src/motion-inspector.js';
import { deleteMovementKeys, movementProperties } from '../src/movement.js';
import './motion-inspector.css';

const modes = Object.fromEntries(Object.entries(movementProperties).map(([mode, property]) => [property, mode]));
const labels = { Translation: 'Position', Rotation: 'Rotation (degrees, XYZ)', Scaling: 'Scale' };
const rounded = value => Number(value.toFixed(4));

// Mounted only by a deliberate warning-marker click. Never owns sidebar space.
export default function MotionInspector({ model, revision, sequenceIndex, globalSeqId, time, selectedNodeIds, mode, motion, onSelect, onSeek, onReplay, onEdit, onPlayingChange, onClose, anchor = 8, disabled, restrictions = {}, livePose }) {
  const [keysOpen, setKeysOpen] = useState(false), [editError, setEditError] = useState('');
  const closeButton = useRef(null), popup = useRef(null);
  const property = movementProperties[mode] || 'Rotation', id = selectedNodeIds.at(-1);
  const storedPose = useMemo(() => motionPose(model, id, property, time, sequenceIndex), [model, revision, id, property, Math.round(time), sequenceIndex]);
  const pose = livePose && livePose.node.ObjectId === id && livePose.property === property ? livePose : storedPose;
  const chain = useMemo(() => motionParentChain(model, id), [model, revision, id]);
  const valid = sequenceIndex >= 0 && globalSeqId === null;
  const blocked = disabled || !valid || !pose || pose.shared || !!livePose || restrictions[property.toLowerCase()];
  const active = motion.active, desired = active && !!motion.desired[active.signature];
  const outdated = motion.stale || active?.resolved;
  const activeIndex = motion.visible.findIndex(f => f.signature === active?.signature);
  const choose = finding => { motion.setActive(finding); onSelect(finding); setEditError(''); };
  const nextIndex = pose?.keys.findIndex(k => k.Frame >= pose.keyTime) ?? -1;
  const at = nextIndex < 0 ? Math.max(0, (pose?.keys.length || 0) - 1) : nextIndex;
  const nearby = pose?.keys.slice(Math.max(0, at - 3), Math.max(7, at + 4)) || [];
  const relevant = active && active.nodeId === id && active.property === property && !outdated;
  const visibleKeys = relevant ? pose?.keys.filter(k => k.Frame >= active.start && k.Frame <= active.end).slice(0, 80) || [] : nearby;
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    // Escape is owned by the existing Clear/cancel-gesture command. Claim it
    // only while this popup has focus, leaving viewport gesture cancellation alone.
    const cancel = event => {
      if (popup.current?.contains(popup.current.ownerDocument.activeElement)) { event.preventDefault(); onClose(); }
    };
    window.addEventListener('mdlxl-cancel-gesture', cancel);
    return () => window.removeEventListener('mdlxl-cancel-gesture', cancel);
  }, [onClose]);
  function mutate(label, action) {
    if (blocked) return;
    onPlayingChange(false); setEditError('');
    try { onEdit(label, ['Nodes'], action, { rethrow: true }); }
    catch (error) { setEditError(error.message); }
  }
  function selectKey(frame) { onSelect({ nodeId: id, property, time: frame }); }
  if (!active) return null;
  return <section ref={popup} className="motion-inspector" role="dialog" aria-modal="false" aria-label="Motion warning details" style={{ left: `clamp(8px, ${anchor}px, max(8px, calc(100% - 368px)))` }} onKeyDown={event => {
    if (event.key === 'Escape' && !event.target.matches('input,select,textarea')) { event.stopPropagation(); onClose(); }
  }}>
    <header><strong translate="no">{active.nodeName} · {active.time} ms</strong><button ref={closeButton} type="button" aria-label="Close motion warning" onClick={onClose}>×</button></header>
    <div className="motion-body">
      <article aria-label="Selected motion finding">
        {outdated ? <p>{motion.stale ? 'Motion changed. Checking again…' : 'This hint no longer appears after your edit.'}</p> : <><p>{active.explanation}</p><small>{active.evidence}</small></>}
      </article>
      <div className="motion-row"><button disabled={!!outdated} onClick={() => onReplay(active)}>Replay section</button><button aria-expanded={keysOpen} onClick={() => { if (!keysOpen) onSelect(active); setKeysOpen(!keysOpen); }}>{keysOpen ? 'Hide Keys' : 'Show Keys'}</button><button disabled={!!outdated} onClick={() => motion.mark(active, !desired)}>{desired ? 'Restore warning' : 'Mark Desired'}</button></div>
      <div className="motion-navigation"><button aria-label="Previous warning" title="Previous warning" disabled={!motion.visible.length} onClick={() => choose(motion.visible[activeIndex < 0 ? motion.visible.length - 1 : (activeIndex - 1 + motion.visible.length) % motion.visible.length])}>←</button><small>{desired ? 'Marked Desired' : activeIndex >= 0 ? `${activeIndex + 1} / ${motion.visible.length}` : 'Motion hint'}</small><button aria-label="Next warning" title="Next warning" disabled={!motion.visible.length} onClick={() => choose(motion.visible[(activeIndex + 1) % motion.visible.length])}>→</button></div>
      {motion.focus && <div className="motion-focus"><label>Replay time<input aria-label="Focused motion time" type="range" min={motion.focus[0]} max={motion.focus[1]} step="1" value={Math.max(motion.focus[0], Math.min(motion.focus[1], Math.round(time)))} onChange={e => onSeek(Number(e.target.value))}/></label><button onClick={() => motion.setFocus(null)}>Full animation</button></div>}
      {keysOpen && pose && valid && <section className="motion-pose" aria-label="Motion key inspector">
        <strong translate="no">{pose.node.Name || `Node ${id}`} · {model.Sequences[sequenceIndex].Name} · {pose.frame} ms</strong>
        <select aria-label="Motion channel" value={property} onChange={e => onSelect({ nodeId: id, property: e.target.value, time: pose.frame })}>{motionChannels.map(p => <option key={p} value={p}>{labels[p]}</option>)}</select>
        <p className={pose.key ? 'motion-key-exists' : 'motion-interpolated'}>{livePose ? 'Posing preview — release to commit.' : pose.shared ? 'Shared global track — inspect here; edit in its global timeline.' : pose.key ? `Stored key at ${pose.keyTime} ms — edits update this key.` : `${pose.keys.length ? 'Interpolated/held pose' : 'Default pose'} — editing creates a key at ${pose.frame} ms.`}</p>
        <small>Interpolation: {['Step (holds until next key)', 'Linear', 'Hermite', 'Bezier'][pose.lineType]}</small>
        <div className="motion-values" onFocusCapture={() => onPlayingChange(false)}>{['X', 'Y', 'Z'].map((axis, i) => <NumberField key={`${id}:${property}:${pose.frame}:${axis}`} label={`Motion ${axis}${property === 'Rotation' ? ' (degrees)' : ''}`} value={rounded(pose.display[i])} disabled={blocked} onChange={value => { const values = [...pose.display]; values[i] = value; mutate(`Set ${pose.node.Name || id} ${property} key`, current => setMotionPose(current, id, property, pose.frame, sequenceIndex, values)); }}/>)}</div>
        <div className="motion-row"><button disabled={!pose.previous || pose.shared} onClick={() => selectKey(pose.previous.Frame)}>← {pose.previous ? `${pose.previous.Frame} ms` : 'No earlier key'}</button><button disabled={!pose.next || pose.shared} onClick={() => selectKey(pose.next.Frame)}>{pose.next ? `${pose.next.Frame} ms` : 'No later key'} →</button></div>
        <div className="motion-key-list" aria-label={relevant ? 'Keys in highlighted interval' : 'Nearby keys'}>{visibleKeys.map(key => <button key={key.Frame} disabled={pose.shared} aria-pressed={key.Frame === pose.keyTime} className={relevant ? 'motion-relevant-key' : ''} onClick={() => selectKey(key.Frame)}>{key.Frame} ms</button>)}</div>
        <button disabled={blocked || !pose.key} onClick={() => mutate('Delete inspected movement key', current => deleteMovementKeys(current, [id], pose.frame, sequenceIndex, modes[property]))}>Delete this key</button>
        {!!chain.length && <details className="motion-chain"><summary>Parent chain</summary>{chain.map(node => <button key={node.ObjectId} onClick={() => onSelect({ nodeId: node.ObjectId, property, time: pose.frame })}>{node.Name || `Node ${node.ObjectId}`}</button>)}</details>}
        {editError && <p role="alert">{editError}</p>}
      </section>}
      {motion.error && <p role="alert">{motion.error}</p>}
    </div>
  </section>;
}
