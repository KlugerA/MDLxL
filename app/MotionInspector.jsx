import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motionPose } from '../src/motion-inspector.js';
import { deleteMovementKeys, movementProperties } from '../src/movement.js';
import './motion-inspector.css';

const modes = Object.fromEntries(Object.entries(movementProperties).map(([mode, property]) => [property, mode]));
const keyKinds = new Set(['holding-keys', 'pose-spike', 'abrupt-change', 'step']);

function explanation(finding) {
  if (finding.space !== 'local') return 'This bone jumps here, possibly because a parent moves. No single bad key is identified.';
  switch (finding.kind) {
    case 'pose-spike': return finding.property === 'Rotation'
      ? 'This key briefly turns the bone, then the next key turns it back. Delete it if that twitch is unwanted.'
      : 'This key briefly moves the bone away, then the next key brings it back. Delete it if that twitch is unwanted.';
    case 'holding-keys': return `This key keeps the old pose until ${finding.time} ms, leaving only ${finding.end - finding.time} ms for the move. Delete it if that hold is unwanted.`;
    case 'abrupt-change': return `The bone jumps to this pose in ${finding.end - finding.start} ms. This key may be too close to the previous one.`;
    case 'step': return 'This track holds each pose, then jumps to the next. This key is where it switches.';
    default: return 'The movement swings past the key poses here. No single bad key is identified.';
  }
}

// Mounted only by a deliberate warning-marker click. Never owns sidebar space.
export default function MotionInspector({ model, revision, sequenceIndex, globalSeqId, selectedNodeIds, mode, motion, onSelect, onReplay, onEdit, onPlayingChange, onClose, anchor = 8, disabled, restrictions = {}, livePose }) {
  const [editError, setEditError] = useState('');
  const closeButton = useRef(null), popup = useRef(null);
  const active = motion.active, desired = active && !!motion.desired[active.signature];
  // Bind deletion to the identified key, never the moving playback cursor or
  // the surrounding keys which only supply evidence for the warning.
  const pose = useMemo(() => active && motionPose(model, active.nodeId, active.property, active.time, sequenceIndex), [model, revision, active, sequenceIndex]);
  const identifiesKey = active?.space === 'local' && keyKinds.has(active.kind);
  const valid = sequenceIndex >= 0 && globalSeqId === null;
  const outdated = motion.stale || active?.resolved;
  const selected = selectedNodeIds.length === 1 && selectedNodeIds[0] === active?.nodeId && movementProperties[mode] === active?.property;
  const blocked = disabled || !valid || !identifiesKey || !selected || !pose?.key || pose.shared || !!livePose || outdated || restrictions[active?.property.toLowerCase()];
  const activeIndex = motion.visible.findIndex(f => f.signature === active?.signature);
  const choose = finding => { motion.setActive(finding); onSelect(finding); setEditError(''); };
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
  function deleteKey() {
    if (blocked) return;
    onPlayingChange(false); setEditError('');
    onSelect(active);
    try { onEdit('Delete inspected movement key', ['Nodes'], current => deleteMovementKeys(current, [active.nodeId], active.time, sequenceIndex, modes[active.property]), { rethrow: true }); }
    catch (error) { setEditError(error.message); }
  }
  if (!active) return null;
  return <section ref={popup} className="motion-inspector" role="dialog" aria-modal="false" aria-label="Motion warning details" style={{ left: `clamp(8px, ${anchor}px, max(8px, calc(100% - 328px)))` }} onKeyDown={event => {
    if (event.key === 'Escape' && !event.target.matches('input,select,textarea')) { event.stopPropagation(); onClose(); }
  }}>
    <header><div translate="no"><strong>{active.nodeName}</strong><small>{active.property} · {active.time} ms</small></div><button ref={closeButton} type="button" aria-label="Close motion warning" onClick={onClose}>×</button></header>
    <div className="motion-body">
      <article aria-label="Selected motion finding" title={outdated ? undefined : active.evidence}>
        <p>{identifiesKey && pose && !pose.key ? 'Key deleted. Replay to check the movement.' : outdated ? motion.stale ? 'Motion changed. Checking again…' : 'This key no longer has a warning.' : explanation(active)}</p>
      </article>
      {identifiesKey && <button disabled={!!blocked} onClick={deleteKey}>Delete selected key</button>}
      <div className="motion-row"><button onClick={() => onReplay(active)}>Replay section</button><button disabled={!!outdated} onClick={() => motion.mark(active, !desired)}>{desired ? 'Restore warning' : 'Mark Desired'}</button></div>
      {motion.visible.length > 1 && <div className="motion-navigation"><button aria-label="Previous warning" title="Previous warning" onClick={() => choose(motion.visible[activeIndex < 0 ? motion.visible.length - 1 : (activeIndex - 1 + motion.visible.length) % motion.visible.length])}>←</button><small>{activeIndex >= 0 ? `${activeIndex + 1} / ${motion.visible.length}` : 'Warnings'}</small><button aria-label="Next warning" title="Next warning" onClick={() => choose(motion.visible[(activeIndex + 1) % motion.visible.length])}>→</button></div>}
      {editError && <p role="alert">{editError}</p>}
      {motion.error && <p role="alert">{motion.error}</p>}
    </div>
  </section>;
}
