import React, { useEffect, useRef } from 'react';
import { movementProperties } from '../src/movement.js';
import './motion-inspector.css';

function explanation(finding) {
  if (finding.space !== 'local') return 'This bone jumps here, possibly because a parent moves. No single responsible key is identified.';
  const surrounding = finding.targets?.find(target => target.role === 'surrounding-holds');
  if (surrounding) {
    return 'Old-pose keys hold until ' + surrounding.time + ' ms and pull back at ' + surrounding.returnTime + ' ms. To spread the movement, select these holding keys. Your pose at ' + surrounding.preserveTime + ' ms and the end poses stay unselected.';
  }
  switch (finding.kind) {
    case 'holding-keys': return 'Repeated old-pose keys hold the movement until ' + finding.time + ' ms, leaving only ' + (finding.end - finding.time) + ' ms for the move. Select the holding keys to edit or delete them. The two end poses stay outside the selection.';
    case 'pose-spike': return 'The bone briefly changes pose and returns. The changed pose or its neighboring keys may be unwanted; the intended movement is uncertain.';
    case 'abrupt-change': return 'The bone jumps to this pose in ' + (finding.end - finding.start) + ' ms. This key may be too close to the previous one.';
    case 'step': return 'This track holds each pose, then jumps to the next. Inspect the key and its existing Controller type setting.';
    default: return 'The movement swings past the key poses here. No single responsible key is identified.';
  }
}

const targetLabel = target => target.keyTimes.length > 1 ? 'Select ' + target.keyTimes.length + ' holding keys'
  : 'Select holding key · ' + target.time + ' ms';

// Context only. Selection and all editing belong to the existing Movement tools.
export default function MotionInspector({ time, selectedNodeIds, mode, motion, onSelect, onReplay, onClose, anchor = 8 }) {
  const closeButton = useRef(null), popup = useRef(null);
  const active = motion.active, desired = active && !!motion.desired[active.signature];
  const outdated = motion.stale || active?.resolved;
  const activeIndex = motion.visible.findIndex(f => f.signature === active?.signature);
  const choose = finding => { motion.setActive(finding); onSelect(finding); };
  useEffect(() => { closeButton.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const cancel = event => {
      if (popup.current?.contains(popup.current.ownerDocument.activeElement)) { event.preventDefault(); onClose(); }
    };
    window.addEventListener('mdlxl-cancel-gesture', cancel);
    return () => window.removeEventListener('mdlxl-cancel-gesture', cancel);
  }, [onClose]);
  if (!active) return null;
  const selected = selectedNodeIds.length === 1 && selectedNodeIds[0] === active.nodeId && movementProperties[mode] === active.property;
  return <section ref={popup} className="motion-inspector" role="dialog" aria-modal="false" aria-label="Motion warning details" style={{ left: 'clamp(8px, ' + anchor + 'px, max(8px, calc(100% - 328px)))' }} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <header><div translate="no"><strong>{active.nodeName}</strong><small>{active.property}</small></div><button ref={closeButton} type="button" aria-label="Close motion warning" onClick={onClose}>×</button></header>
    <div className="motion-body">
      <article aria-label="Selected motion finding" title={outdated ? undefined : active.evidence}><p>{outdated ? motion.stale ? 'Motion changed. Checking again…' : 'This warning no longer appears. Replay to check the movement.' : explanation(active)}</p></article>
      {(active.targets || []).map(target => <button key={target.role} disabled={!!outdated} aria-pressed={selected && Math.round(time) === target.time} onClick={() => {
        onSelect({ nodeId: active.nodeId, property: active.property, time: target.time, selectionKeys: target.keyTimes }); onClose();
      }}>{targetLabel(target)}</button>)}
      <div className="motion-row"><button onClick={() => onReplay(active)}>Replay section</button><button disabled={!!outdated} onClick={() => motion.mark(active, !desired)}>{desired ? 'Restore warning' : 'Mark Desired'}</button></div>
      {motion.visible.length > 1 && <div className="motion-navigation"><button aria-label="Previous warning" title="Previous warning" onClick={() => choose(motion.visible[activeIndex < 0 ? motion.visible.length - 1 : (activeIndex - 1 + motion.visible.length) % motion.visible.length])}>←</button><small>{activeIndex >= 0 ? (activeIndex + 1) + ' / ' + motion.visible.length : 'Warnings'}</small><button aria-label="Next warning" title="Next warning" onClick={() => choose(motion.visible[(activeIndex + 1) % motion.visible.length])}>→</button></div>}
      {motion.error && <p role="alert">{motion.error}</p>}
    </div>
  </section>;
}
