import React, { useMemo, useRef, useState } from 'react';
import { NumberField } from './Fields.jsx';
import { motionChannels, motionParentChain, motionPose, setMotionPose } from '../src/motion-inspector.js';
import { deleteMovementKeys, movementProperties } from '../src/movement.js';
import './motion-inspector.css';

const modes = Object.fromEntries(Object.entries(movementProperties).map(([mode, property]) => [property, mode]));
const labels = { Translation: 'Position', Rotation: 'Rotation (degrees, XYZ)', Scaling: 'Scale' };
const rounded = value => Number(value.toFixed(4));

export default function MotionInspector({ model, revision, sequenceIndex, globalSeqId, time, selectedNodeIds, mode, motion, onSelect, onSeek, onReplay, onEdit, onPlayingChange, disabled, restrictions = {}, livePose }) {
  const [selectedOnly, setSelectedOnly] = useState(false), [keysOpen, setKeysOpen] = useState(true), [editError, setEditError] = useState('');
  const keyList = useRef(null);
  const property = movementProperties[mode] || 'Rotation', id = selectedNodeIds.at(-1);
  const storedPose = useMemo(() => motionPose(model, id, property, time, sequenceIndex), [model, revision, id, property, Math.round(time), sequenceIndex]);
  const pose = livePose?.node.ObjectId === id && livePose.property === property ? livePose : storedPose;
  const chain = useMemo(() => motionParentChain(model, id), [model, revision, id]);
  const valid = sequenceIndex >= 0 && globalSeqId === null;
  const blocked = disabled || !valid || !pose || pose.shared || !!livePose || restrictions[property.toLowerCase()];
  const active = motion.active, desired = active && !!motion.desired[active.signature];
  const activeIndex = motion.visible.findIndex(f => f.signature === active?.signature);
  const choose = finding => { motion.setActive(finding); onSelect(finding); setKeysOpen(true); setEditError(''); };
  const nextIndex = pose?.keys.findIndex(k => k.Frame >= pose.keyTime) ?? -1;
  const at = nextIndex < 0 ? Math.max(0, (pose?.keys.length || 0) - 1) : nextIndex;
  const nearby = pose?.keys.slice(Math.max(0, at - 3), Math.max(7, at + 4)) || [];
  const relevant = active && active.nodeId === id && active.property === property && !motion.stale;
  const visibleKeys = relevant ? pose?.keys.filter(k => k.Frame >= active.start && k.Frame <= active.end).slice(0, 80) || [] : nearby;
  function mutate(label, action) {
    if (blocked) return;
    onPlayingChange(false); setEditError('');
    try { onEdit(label, ['Nodes'], action, { rethrow: true }); }
    catch (error) { setEditError(error.message); }
  }
  function selectKey(frame) { onSelect({ nodeId: id, property, time: frame }); }
  return <details className="motion-inspector" open>
    <summary>Motion Inspector</summary>
    <div className="motion-body">
      <button disabled={!valid || motion.busy || selectedOnly && !selectedNodeIds.length} onClick={() => motion.scan(selectedOnly ? selectedNodeIds : null)}>Find Motion Irregularities</button>
      <label className="motion-check"><input type="checkbox" checked={selectedOnly} disabled={!selectedNodeIds.length && !selectedOnly} onChange={e => setSelectedOnly(e.target.checked)}/>Selected bone and parents</label>
      {!valid && <p>Choose a local animation in Movement to inspect motion.</p>}
      {motion.busy && <div role="status">Scanning{motion.progress ? ` ${motion.progress.completed}/${motion.progress.total} nodes` : '…'} <button onClick={motion.cancel}>Cancel</button></div>}
      {motion.error && <p role="alert">{motion.error}</p>}
      {motion.result && <>
        <p>{motion.stale ? 'Animation changed. Rescan to refresh hints and Desired decisions.' : `${motion.visible.length} inspection hints · ${motion.desiredCount || 0} desired`}</p>
        <label className="motion-check"><input type="checkbox" checked={motion.showDesired} onChange={e => motion.setShowDesired(e.target.checked)}/>Show Desired</label>
        <div className="motion-row"><button disabled={!motion.visible.length} onClick={() => choose(motion.visible[activeIndex < 0 ? motion.visible.length - 1 : (activeIndex - 1 + motion.visible.length) % motion.visible.length])}>Previous warning</button><button disabled={!motion.visible.length} onClick={() => choose(motion.visible[(activeIndex + 1) % motion.visible.length])}>Next warning</button></div>
        <div className="motion-results" aria-label="Motion findings">{motion.visible.map(finding => <button key={finding.signature} aria-pressed={active?.signature === finding.signature} className={motion.desired[finding.signature] ? 'motion-desired' : 'motion-warning'} onClick={() => choose(finding)}><span>{motion.desired[finding.signature] ? '✓' : '⚠'} {finding.nodeName} · {finding.time} ms</span><small>{finding.kind.replaceAll('-', ' ')} · {finding.property} · {finding.space === 'local' ? 'local track' : 'model space'}</small></button>)}</div>
        {motion.result.notes.map(note => <p key={note}>{note}</p>)}
      </>}
      {active && <article className="motion-explanation" aria-label="Selected motion finding">
        <strong>{active.nodeName} · {active.property}</strong><p>{active.explanation}</p><p>{active.evidence}</p>
        <div className="motion-row"><button disabled={!!motion.stale} onClick={() => { choose(active); setKeysOpen(true); requestAnimationFrame(() => keyList.current?.scrollIntoView({ block: 'nearest' })); }}>Show Keys</button><button disabled={!!motion.stale} onClick={() => motion.mark(active, !desired)}>{desired ? 'Restore warning' : 'Mark Desired'}</button></div>
        <button disabled={!!motion.stale} onClick={() => onReplay(active)}>Replay section</button>
      </article>}
      {motion.focus && <div className="motion-focus"><label>Focused time (ms)<input aria-label="Focused motion time" type="range" min={motion.focus[0]} max={motion.focus[1]} step="1" value={Math.max(motion.focus[0], Math.min(motion.focus[1], Math.round(time)))} onChange={e => onSeek(Number(e.target.value))}/></label><span>{motion.focus[0]}–{motion.focus[1]} ms</span><button onClick={() => motion.setFocus(null)}>Full animation</button></div>}
      {pose && valid && <section className="motion-pose" aria-label="Motion key inspector">
        <strong translate="no">{pose.node.Name || `Node ${id}`}</strong><div translate="no">{model.Sequences[sequenceIndex].Name} · {pose.frame} ms</div>
        <label>Channel<select aria-label="Motion channel" value={property} onChange={e => onSelect({ nodeId: id, property: e.target.value, time: pose.frame })}>{motionChannels.map(p => <option key={p} value={p}>{labels[p]}</option>)}</select></label>
        <p className={pose.key ? 'motion-key-exists' : 'motion-interpolated'}>{livePose ? 'Posing preview — release to commit one undoable edit.' : pose.shared ? 'Shared global track — inspect here; edit in its global timeline.' : pose.key ? `Stored key at ${pose.keyTime} ms — edits update this key.` : `${pose.keys.length ? 'Interpolated/held pose' : 'Default pose'} — editing creates a key at ${pose.frame} ms.`}</p>
        <div>Interpolation: <strong>{['Step (holds until next key)', 'Linear', 'Hermite', 'Bezier'][pose.lineType]}</strong></div>
        <div className="motion-values" onFocusCapture={() => onPlayingChange(false)}>{['X', 'Y', 'Z'].map((axis, i) => <NumberField key={`${id}:${property}:${pose.frame}:${axis}`} label={`Motion ${axis}${property === 'Rotation' ? ' (degrees)' : ''}`} value={rounded(pose.display[i])} disabled={blocked} onChange={value => { const values = [...pose.display]; values[i] = value; mutate(`Set ${pose.node.Name || id} ${property} key`, current => setMotionPose(current, id, property, pose.frame, sequenceIndex, values)); }}/>)}</div>
        <small>Local values. Move / Rotate / Scale in the viewport edits this time and channel. Curve handles are preserved.</small>
        <div className="motion-row"><button disabled={!pose.previous || pose.shared} onClick={() => selectKey(pose.previous.Frame)}>← {pose.previous ? `${pose.previous.Frame} ms` : 'No earlier key'}</button><button disabled={!pose.next || pose.shared} onClick={() => selectKey(pose.next.Frame)}>{pose.next ? `${pose.next.Frame} ms` : 'No later key'} →</button></div>
        <button disabled={blocked || !pose.key} onClick={() => mutate('Delete inspected movement key', current => deleteMovementKeys(current, [id], pose.frame, sequenceIndex, modes[property]))}>Delete this key</button>
        <details ref={keyList} open={keysOpen} onToggle={e => setKeysOpen(e.currentTarget.open)}><summary>{relevant ? 'Keys in highlighted interval' : 'Nearby keys'}</summary>
          <div className="motion-key-list">{visibleKeys.map(key => <button key={key.Frame} disabled={pose.shared} aria-pressed={key.Frame === pose.keyTime} className={relevant ? 'motion-relevant-key' : ''} onClick={() => selectKey(key.Frame)}>{key.Frame} ms</button>)}</div>
          {relevant && <small>{active.start}–{active.end} ms highlighted together; list shows up to 80 keys. Use neighboring-key arrows for more.</small>}
        </details>
        {!!chain.length && <div className="motion-chain"><small>Selected node → parent chain</small>{chain.map(node => <button key={node.ObjectId} onClick={() => onSelect({ nodeId: node.ObjectId, property, time: pose.frame })}>{node.Name || `Node ${node.ObjectId}`}</button>)}</div>}
        {editError && <p role="alert">{editError}</p>}
      </section>}
      {!pose && valid && <p>Select a bone in Movement or click a warning to inspect its keys.</p>}
      <small>Hints can describe intentional motion. Desired decisions stay in this editor profile, outside model files.</small>
    </div>
  </details>;
}
