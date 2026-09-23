import React, { useEffect, useMemo, useRef, useState } from 'react';
import { classicTimelineDomain, classicTimelineTargets, classicPaste, unrestrictedTimelineTargets } from '../src/classic-keyframes.js';
import { timelineTracks, timelineKeys, timelineSections, copyTimelineKeys, copyTimelinePose, setTimelineKeys, clearTimelineKeys } from '../src/keyframe-timeline.js';
import { animationMarkerTimes } from '../src/animation-markers.js';
import { animationTrackId } from '../src/animation-tracks.js';
import './KeyframeTimeline.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** The original compact reel: time selection, with authoring in the controllers. */
export default function KeyframeTimeline({ model, revision, sequenceIndex = -1, globalSeqId = null, time = 0, selectedNodeIds = [], selectedGeosets = [], activeController = 'rotate', highlightKeyframes = true, playing = false, onPlayingChange, onEdit, onSeek, onCommands, onStatus, disabled = false, restrictions = {}, motionFindings = [], motionActive = null, motionControls = null, onMotionFinding, onSelectKey, children }) {
  const [range, setRange] = useState(null), [context, setContext] = useState(null), [draftTime, setDraftTime] = useState('0');
  const [keySelection, setKeySelection] = useState(null);
  const [, refreshClipboard] = useState(0);
  const panel = useRef(null), reel = useRef(null), menu = useRef(null), clipboard = useRef(null), cleanup = useRef(null), editingTime = useRef(false), suppressContext = useRef(false);
  const tracks = useMemo(() => timelineTracks(model), [model, revision]);
  const timing = useMemo(() => {
    const validSequence = model.Sequences?.[sequenceIndex] ? sequenceIndex : -1;
    const validGlobal = Number.isInteger(globalSeqId) && globalSeqId >= 0 && model.GlobalSequences?.[globalSeqId] > 0 ? globalSeqId : null;
    try { return { domain: classicTimelineDomain(model, validSequence, validGlobal) }; }
    catch (error) { return { error: error.message }; }
  }, [model, revision, sequenceIndex, globalSeqId]);
  const domain = timing.domain, domainStamp = `${sequenceIndex}:${globalSeqId}:${domain?.start}:${domain?.end}`;
  const selectionStamp = `${selectedNodeIds.join(',')}|${selectedGeosets.join(',')}`;
  const { targets, copyTargets, poseTargets, keys, copyKeysInDomain, times, timeSet } = useMemo(() => {
    const options = { tracks, nodeIds: selectedNodeIds, geosetIds: selectedGeosets, activeController, highlightKeyframes, domain };
    const authored = domain ? classicTimelineTargets(model, { ...options, highlightKeyframes: false }) : [];
    const selectedTargets = domain ? classicTimelineTargets(model, { ...options, highlightKeyframes: true }) : [];
    const targets = highlightKeyframes ? selectedTargets : authored;
    const selectedBoneTargets = activeController === 'animations' ? selectedTargets : domain ? ['move', 'rotate', 'scale'].flatMap(controller => classicTimelineTargets(model, { ...options, activeController: controller, highlightKeyframes: true })) : [];
    const copyTargets = highlightKeyframes ? [...new Map(selectedBoneTargets.map(target => [target.trackId, target])).values()] : authored;
    const poseTargets = [...new Map((highlightKeyframes ? copyTargets : [...authored, ...selectedTargets]).map(target => [target.trackId, target])).values()];
    const keys = domain ? timelineKeys(model, targets, domain) : [];
    const copyKeysInDomain = domain ? timelineKeys(model, copyTargets, domain) : [];
    // Highlight KF is both a visual filter and a bone-only clipboard scope.
    const timeSet = new Set(highlightKeyframes ? copyKeysInDomain.map(key => key.frame) : domain ? animationMarkerTimes(model, domain, tracks) : []);
    return { targets, copyTargets, poseTargets, keys, copyKeysInDomain, times: [...timeSet].sort((a, b) => a - b), timeSet };
  }, [model, revision, tracks, domain, selectionStamp, activeController, highlightKeyframes]);
  const frame = domain ? Math.round(clamp(time, domain.start, domain.end)) : 0;
  const span = Math.max(1, (domain?.end || 0) - (domain?.start || 0));
  const percent = value => (value - (domain?.start || 0)) / span * 100;
  const selectedKeysById = keySelection && activeController === keySelection.controller && selectedNodeIds.length === 1 && selectedNodeIds[0] === keySelection.nodeId ? keySelection : null;
  const keyMarkers = useMemo(() => times.map(value => <span key={value} data-frame={value} className={`classic-reel-key${motionActive && value >= motionActive.start && value <= motionActive.end ? ' motion-key-highlight' : ''}${selectedKeysById?.frames.has(value) && keys.some(key => key.frame === value && key.trackId === selectedKeysById.trackId) ? ' motion-key-selected' : ''}`} style={{ left: `clamp(0px, ${(value - (domain?.start || 0)) / span * 100}%, calc(100% - 1px))` }}/>), [times, domain, span, motionActive, selectedKeysById, keys]);
  const warningMarkers = useMemo(() => {
    const grouped = new Map();
    const warningTimes = activeController === 'animations' && highlightKeyframes && domain ? new Set(animationMarkerTimes(model, domain, tracks)) : timeSet;
    for (const finding of motionFindings) {
      if (activeController !== 'animations' && highlightKeyframes && !selectedNodeIds.includes(finding.nodeId)) continue;
      // A sampled warning belongs to a relevant, visible stored key, never to an
      // invented key between diamonds. Coincident warnings share one hit target.
      const targetTime = finding.targets?.[0]?.time ?? finding.time;
      const candidates = [targetTime, ...(finding.keyTimes || [])].filter(value => warningTimes.has(value));
      const at = candidates.reduce((best, value) => Math.abs(value - targetTime) < Math.abs(best - targetTime) ? value : best, Infinity);
      if (!Number.isFinite(at)) continue;
      if (!grouped.has(at)) grouped.set(at, []);
      grouped.get(at).push(finding);
    }
    return [...grouped].sort((a, b) => a[0] - b[0]);
  }, [motionFindings, timeSet, selectionStamp, highlightKeyframes, activeController, domain, model, tracks]);
  const hasRange = range && range[0] !== range[1];
  const bounds = selectedKeysById ? [Math.min(...selectedKeysById.frames), Math.max(...selectedKeysById.frames)] : hasRange ? [Math.min(...range), Math.max(...range)] : [frame, frame];
  const mutationTargets = useMemo(() => unrestrictedTimelineTargets(targets, restrictions), [targets, restrictions]);
  const mutationTrackIds = new Set(mutationTargets.map(target => target.trackId));
  const mutationBlocked = disabled || !domain || !mutationTargets.length;

  // Playback displays the live frame directly; only a focused edit owns a draft.
  useEffect(() => { setRange(null); setKeySelection(null); setContext(null); editingTime.current = false; setDraftTime(String(frame)); }, [domainStamp]);
  useEffect(() => { if (keySelection && !selectedKeysById) setKeySelection(null); }, [selectionStamp, activeController]);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => {
    if (!context) return;
    const ownerWindow = panel.current?.ownerDocument?.defaultView || window;
    const dismiss = event => { if (!menu.current?.contains(event.target)) setContext(null); };
    const escape = event => { if (event.key === 'Escape') { setContext(null); panel.current?.focus(); } };
    ownerWindow.addEventListener('pointerdown', dismiss); ownerWindow.addEventListener('keydown', escape);
    return () => { ownerWindow.removeEventListener('pointerdown', dismiss); ownerWindow.removeEventListener('keydown', escape); };
  }, [context]);

  function report(operation) {
    try { return operation(); }
    catch (error) { onStatus?.(error.message, true); return false; }
  }
  function seek(value, extend = false, anchor = frame) {
    if (!domain) return;
    const next = Math.round(clamp(value, domain.start, domain.end));
    setKeySelection(null); setRange(extend ? [anchor, next] : null); setDraftTime(String(next)); onPlayingChange?.(false); onSeek?.(next);
  }
  function selectionAnchor() {
    return hasRange && frame === range[0] ? range[1] : hasRange && frame === range[1] ? range[0] : frame;
  }
  function mutate(label, operation) {
    if (mutationBlocked) { onStatus?.(timing.error || (targets.length && !mutationTargets.length ? 'The selected transform channels are restricted.' : 'Select an object and controller.'), true); return; }
    report(() => {
      onPlayingChange?.(false);
      // The shell catches transaction errors. Retain the original failure so it
      // cannot be mistaken for a successful edit or erase its error message.
      let failure, count = 0;
      const result = onEdit?.(label, timelineSections, current => {
        try { count = operation(current); return count; }
        catch (error) { failure = error; throw error; }
      });
      if (failure) throw failure;
      if (result !== false && result !== undefined) onStatus?.(count ? label : 'No keyframes changed.');
    });
  }
  function selectedKeys(interval = bounds) { return keys.filter(key => selectedKeysById ? key.trackId === selectedKeysById.trackId && selectedKeysById.frames.has(key.frame) : key.frame >= interval[0] && key.frame <= interval[1]); }
  function editableKeys(interval = bounds) { return selectedKeys(interval).filter(key => mutationTrackIds.has(key.trackId)); }
  function copyKeys() {
    if (!domain || !copyTargets.length) { clipboard.current = null; refreshClipboard(value => value + 1); onStatus?.('No stored keys here.'); return; }
    report(() => {
      const selected = selectedKeysById ? selectedKeys() : copyKeysInDomain.filter(key => key.frame >= bounds[0] && key.frame <= bounds[1]);
      clipboard.current = copyTimelineKeys(model, copyTargets, selected, domain, bounds[0]); refreshClipboard(value => value + 1);
      onStatus?.(clipboard.current.count ? `${clipboard.current.count} stored keys copied.` : 'No stored keys here.');
    });
  }
  function copyFrame() {
    if (!domain || !poseTargets.length) { onStatus?.('Select an object and controller.', true); return; }
    report(() => {
      clipboard.current = copyTimelinePose(model, poseTargets, frame, domain); refreshClipboard(value => value + 1);
      onStatus?.('Current frame copied.');
    });
  }
  function previous(extend = false) { const value = times.findLast(value => value < frame); if (value !== undefined) seek(value, extend, selectionAnchor()); }
  function next(extend = false) { const value = times.find(value => value > frame); if (value !== undefined) seek(value, extend, selectionAnchor()); }
  const commands = {
    set: () => mutate('Set keyframes', current => setTimelineKeys(current, mutationTargets, frame, domain)),
    copy: copyKeys, copyPose: copyFrame,
    paste: () => {
      const destinations = unrestrictedTimelineTargets(highlightKeyframes ? copyTargets : targets, restrictions);
      if (disabled || !domain || !destinations.length) { onStatus?.('Select an object and controller.', true); return; }
      report(() => {
        onPlayingChange?.(false);
        let failure, count = 0;
        const result = onEdit?.('Paste keyframes', timelineSections, current => { try { count = classicPaste(current, destinations, clipboard.current, frame, domain); return count; } catch (error) { failure = error; throw error; } });
        if (failure) throw failure;
        if (result !== false && result !== undefined) onStatus?.(count ? 'Paste keyframes' : 'No keyframes changed.');
      });
    },
    delete: () => mutate('Delete keyframes', current => clearTimelineKeys(current, mutationTargets, editableKeys(), domain)),
    clear: () => mutate('Clear keyframes', current => clearTimelineKeys(current, mutationTargets, editableKeys(hasRange ? bounds : [domain.start, domain.end]), domain)),
    selectAll: () => { if (domain) { setKeySelection(null); setRange([domain.start, domain.end]); } },
    // Exact stored-key selection can skip an intended pose between holding keys.
    // Existing copy/delete/undo operations consume this same selection.
    selectKeys: (frames, target) => { setContext(null); setRange(null); setKeySelection(frames.length ? { trackId: animationTrackId(target), nodeId: target.id, controller: ({ Translation: 'move', Rotation: 'rotate', Scaling: 'scale' })[target.property], frames: new Set(frames) } : null); },
    previous, next,
  };
  useEffect(() => { onCommands?.(commands); });
  useEffect(() => () => onCommands?.({}), [onCommands]);

  function commitTime(extend = false) {
    if (!editingTime.current) return;
    editingTime.current = false;
    const value = Number(draftTime);
    if (!domain || !draftTime.trim() || !Number.isFinite(value) || Math.round(value) < domain.start || Math.round(value) > domain.end) {
      setDraftTime(String(frame)); return;
    }
    seek(Math.round(value), extend, selectionAnchor());
  }
  function beginScrub(event) {
    if (!domain || ![0, 2].includes(event.button)) return;
    const ownerWindow = event.currentTarget.ownerDocument.defaultView || window;
    const rect = reel.current.getBoundingClientRect(), upper = event.clientY - rect.top <= rect.height / 2;
    const at = pointer => Math.round(clamp(domain.start + (pointer.clientX - rect.left) / Math.max(1, rect.width) * span, domain.start, domain.end));
    const onCursor = Math.abs(event.clientX - rect.left - (frame - domain.start) / span * rect.width) <= 4;
    if (event.button === 0 && upper && !event.shiftKey && onSelectKey && globalSeqId === null && sequenceIndex >= 0) {
      const nearest = times.reduce((best, value) => Math.abs(value - at(event)) < Math.abs(best - at(event)) ? value : best, Infinity);
      if (Math.abs(nearest - at(event)) / span * rect.width <= 4) {
        const property = ({ move: 'Translation', rotate: 'Rotation', scale: 'Scaling' })[activeController];
        const candidates = tracks.filter(target => target.kind === 'node' && ['Translation','Rotation','Scaling'].includes(target.property) && target.globalSeqId === null && timelineKeys(model, [target], domain).some(key => key.frame === nearest));
        const target = candidates.find(t => selectedNodeIds.includes(t.id) && t.property === property) || candidates.find(t => selectedNodeIds.includes(t.id)) || candidates[0];
        if (target) { event.preventDefault(); setRange(null); onSelectKey({ nodeId: target.id, property: target.property, time: nearest }); return; }
      }
    }
    if (event.button === 2 && (!upper || !onCursor)) return;
    event.preventDefault(); panel.current?.focus({ preventScroll: true }); setContext(null);
    if (!upper) { if (at(event) < frame) previous(event.shiftKey); else next(event.shiftKey); return; }
    const extend = event.shiftKey || event.button === 2, anchor = selectionAnchor();
    if (event.button === 2) suppressContext.current = true;
    seek(at(event), extend, anchor);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const move = pointer => seek(at(pointer), extend || pointer.shiftKey, anchor);
    const end = () => { cleanup.current?.(); cleanup.current = null; };
    cleanup.current?.();
    ownerWindow.addEventListener('pointermove', move); ownerWindow.addEventListener('pointerup', end, { once: true }); ownerWindow.addEventListener('pointercancel', end, { once: true });
    cleanup.current = () => { ownerWindow.removeEventListener('pointermove', move); ownerWindow.removeEventListener('pointerup', end); ownerWindow.removeEventListener('pointercancel', end); };
  }
  function keyboard(event) {
    if (event.target.matches('input,textarea,select,button')) return;
    if (event.key === 'Escape') { setContext(null); setRange(null); setKeySelection(null); return; }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); event.stopPropagation(); (event.key === 'ArrowLeft' ? previous : next)(event.shiftKey);
    }
  }
  function openContext(event) {
    if (event.target.closest('input,button')) return;
    event.preventDefault();
    if (suppressContext.current) { suppressContext.current = false; return; }
    const ownerWindow = event.currentTarget.ownerDocument.defaultView || window;
    setContext({ x: clamp(event.clientX, 0, Math.max(0, ownerWindow.innerWidth - 230)), y: clamp(event.clientY, 0, Math.max(0, ownerWindow.innerHeight - (motionControls ? 265 : 165))) });
  }
  const divisions = Array.from({ length: 11 }, (_, index) => Math.round((domain?.start || 0) + span * index / 10)).filter((value, index, values) => value <= (domain?.end || 0) && values.indexOf(value) === index);
  const canPaste = !!clipboard.current && (clipboard.current.kind === 'pose' || clipboard.current.count > 0);
  const menuItems = context ? [['copy', 'Copy', !keys.length], ['copyPose', 'Copy Frame', !poseTargets.length], ['paste', 'Paste', mutationBlocked || !canPaste], ['delete', 'Delete', mutationBlocked || !editableKeys().length, 'Delete unlocked keys at the current frame or in the selected interval.'], ['clear', 'Clear', mutationBlocked || !keys.some(key => mutationTrackIds.has(key.trackId)), 'Clear unlocked keys in the selected interval, or the whole animation interval when no range is selected.']] : [];

  return <section ref={panel} tabIndex="0" className="keyframe-timeline classic-keyframe-reel" aria-label="Keyframe timeline" data-warmkey-category="Keyframes" onKeyDown={keyboard} onContextMenu={openContext}>
    <button type="button" className="classic-reel-play" aria-label={playing ? 'Stop' : 'Play'} title={playing ? 'Stop' : 'Play'} disabled={!domain} onClick={() => onPlayingChange?.(!playing)}>{playing ? '■' : '▶'}</button>
    <div ref={reel} className="classic-reel-track reel-scale" role="slider" aria-label="Animation frame" aria-valuemin={domain?.start || 0} aria-valuemax={domain?.end || 0} aria-valuenow={frame} onPointerDown={beginScrub}>
      <div className="classic-reel-bar" aria-hidden="true">
        {motionActive && <span className="motion-reel-interval" style={{ left: `${percent(motionActive.start)}%`, width: `${percent(motionActive.end) - percent(motionActive.start)}%` }}/>}
        {hasRange && <span className="classic-reel-selection" data-range-start={bounds[0]} data-range-end={bounds[1]} style={{ left: `${percent(bounds[0])}%`, width: `${percent(bounds[1]) - percent(bounds[0])}%` }}/>}
        {keyMarkers}
        <span className="classic-reel-cursor" style={{ left: `clamp(1px, ${percent(frame)}%, calc(100% - 1px))` }}/>
      </div>
      {warningMarkers.map(([at, findings]) => <button key={at} type="button" data-frame={at} className={`motion-reel-warning${findings.every(f => motionControls?.desired[f.signature]) ? ' motion-reel-desired' : ''}`} aria-pressed={!!motionActive && findings.some(f => f.signature === motionActive.signature)} aria-label={`Motion warning: ${findings.map(f => `${f.nodeName}, ${f.property}, ${f.time} ms, ${f.kind}`).join('; ')}`} title={`${findings.length > 1 ? `${findings.length} motion warnings` : `${findings[0].nodeName} · ${findings[0].property}`} · ${at} ms — click to inspect`} style={{ left: `clamp(6px, ${percent(at)}%, calc(100% - 6px))` }} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setRange(null); setContext(null); onMotionFinding?.(findings[0], event.currentTarget); }}><span aria-hidden="true">◆</span><span className="motion-warning-underline" aria-hidden="true"/></button>)}
      <div className="classic-reel-ruler" aria-hidden="true" translate="no">{divisions.map((value, index) => <span key={value} className={index === divisions.length - 1 ? 'is-last' : ''} style={{ left: `${percent(value)}%` }}>{value}</span>)}</div>
    </div>
    <label className="classic-reel-frame"><span>Frame:</span><input type="number" inputMode="numeric" step="1" min={domain?.start || 0} max={domain?.end || 0} aria-label="Current animation frame" data-warmkey="keyframe:time" translate="no" className={timeSet.has(frame) ? 'is-keyframe' : ''} value={editingTime.current ? draftTime : String(frame)} disabled={!domain} onFocus={() => { setDraftTime(String(frame)); editingTime.current = true; onPlayingChange?.(false); }} onChange={event => { editingTime.current = true; setDraftTime(event.target.value); }} onBlur={() => commitTime()} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitTime(event.shiftKey); }
      if (event.key === 'Escape') { event.preventDefault(); setDraftTime(String(frame)); editingTime.current = false; }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); editingTime.current = false; seek(frame + (event.key === 'ArrowUp' ? 1 : -1), event.shiftKey, selectionAnchor()); }
    }}/></label>
    {context && <div ref={menu} className="classic-reel-menu" role="menu" style={{ left: context.x, top: context.y }}>{menuItems.map(([id, label, unavailable, title]) => <button type="button" role="menuitem" key={id} data-warmkey={`keyframe:${id}`} disabled={unavailable} title={title} onClick={() => { setContext(null); commands[id](); }}>{label}</button>)}{motionControls && <>
      <hr/>
      <button role="menuitem" disabled={motionControls.busy} onClick={() => { setContext(null); motionControls.scan(); }}>Find Motion Irregularities</button>
      <button role="menuitem" disabled={motionControls.busy || !selectedNodeIds.length} onClick={() => { setContext(null); motionControls.scan(selectedNodeIds); }}>Inspect selected bone and parents</button>
      <button role="menuitemcheckbox" aria-checked={motionControls.showDesired} onClick={() => { setContext(null); motionControls.setShowDesired(!motionControls.showDesired); }}>{motionControls.showDesired ? '✓ ' : ''}Show Desired</button>
      {motionControls.error && <p role="alert">{motionControls.error}</p>}
    </>}</div>}
    {children}
  </section>;
}
