import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TrackEditor } from './Fields.jsx';
import { editVisibility, visibilityAt, visibilityGlobal, visibilityInterval } from '../src/visibility-editing.js';

export default function VisibilityEditor({ model, value, onChange, frame = 0, sequenceIndex = 0, onSeek, onSequenceChange, fallback = 1, label = 'Visibility', disabled = false, onlyAnimated = false }) {
  const global = visibilityGlobal(value), binary = onlyAnimated && label === 'Visibility';
  const displayValue = amount => binary ? amount > 0 ? 'On' : 'Off' : `${Math.round(amount * 100)}%`;
  const [sequence, setSequence] = useState(model.Sequences?.[sequenceIndex] ? sequenceIndex : 0);
  const [selection, setSelection] = useState(null), [amount, setAmount] = useState(100), [error, setError] = useState('');
  const [sequences, setSequences] = useState([]);
  const drag = useRef(null);
  useEffect(() => { if (model.Sequences?.[sequenceIndex]) setSequence(sequenceIndex); }, [sequenceIndex]);
  useEffect(() => { setSelection(null); setError(''); }, [sequence, global]);
  const interval = visibilityInterval(model, value, sequence), valid = interval && Number.isFinite(interval[1]);
  const [start, end] = valid ? interval : [0, 1], span = Math.max(1, end - start);
  const keys = (value?.Keys || []).filter(k => k.Frame >= start && k.Frame <= end);
  const playhead = Math.max(start, Math.min(end, Math.round(frame)));
  const pickSequence = id => { setSequence(id); onSequenceChange?.(id); onSeek?.(model.Sequences[id].Interval[0]); };
  const commit = (opacity, batch = false) => {
    try {
      let next = value;
      if (batch) for (const id of sequences) next = editVisibility(next, model, { sequenceIndex: id, range: Array.from(model.Sequences[id].Interval), amount: opacity, fallback });
      else next = editVisibility(next, model, { sequenceIndex: sequence, ...(selection?.keys ? { frames: selection.keys } : { range: selection?.range || [playhead, playhead] }), amount: opacity, fallback });
      onChange(next); setError('');
    } catch (cause) { setError(cause.message); }
  };
  const position = at => 12 + (at - start) / span * 976;
  const atPointer = event => { const rect = event.currentTarget.getBoundingClientRect(); return Math.max(start, Math.min(end, Math.round(start + ((event.clientX - rect.left) / rect.width * 1000 - 12) / 976 * span))); };
  const plotValue = amount => binary ? amount > 0 ? 1 : 0 : Math.max(0, Math.min(1, amount));
  const point = (at, amount) => `${position(at)},${62 - plotValue(amount) * 40}`;
  const values = value?.LineType === 0 ? [point(start, visibilityAt(value, start, interval, fallback)), ...keys.flatMap((k, i) => [point(k.Frame, keys[Math.max(0, i - 1)].Vector[0]), point(k.Frame, k.Vector[0])]), point(end, visibilityAt(value, end, interval, fallback))].join(' ') : [...new Set([...Array.from({ length: 161 }, (_, i) => start + span * i / 160), ...keys.map(k => k.Frame)])].sort((a, b) => a - b).map(at => point(at, visibilityAt(value, at, interval, fallback))).join(' ');
  const range = selection?.range;
  const chosen = selection?.keys || (range ? keys.filter(k => k.Frame >= range[0] && k.Frame <= range[1]).map(k => k.Frame) : []);
  const wholeLabel = global === null ? 'Whole animation' : 'Whole loop';
  const selectionText = selection?.keys ? `${selection.keys.length} selected key${selection.keys.length === 1 ? '' : 's'}` : range ? range[0] === start && range[1] === end ? wholeLabel : range[0] === range[1] ? `Frame ${range[0]}` : `Frames ${range[0]}–${range[1]}` : `Frame ${playhead}`;
  return <section className="re-visibility" aria-label={`${label} editor`}>
    <div className="re-section-heading"><strong>{label}</strong><span>{displayValue(visibilityAt(value, playhead, interval, fallback))} at playhead</span></div>
    {global !== null ? <p className="re-clock-note">Global loop {global + 1} · {end} ms · shared by every animation</p> : <label className="re-animation-choice">Animation<select aria-label={`${label} animation`} value={sequence} disabled={!model.Sequences?.length} onChange={event => pickSequence(Number(event.target.value))}>{(model.Sequences || []).map((s, i) => <option key={i} value={i} translate="no">{s.Name} · {s.Interval[0]}–{s.Interval[1]}</option>)}</select></label>}
    {valid ? <>
      <svg className="re-visibility-timeline" viewBox="0 0 1000 90" preserveAspectRatio="none" role="group" aria-label={`${label} timeline`} tabIndex={0}
        onPointerDown={event => {
          if (event.button !== 0 || event.target.closest('[data-key]')) return;
          const at = atPointer(event); drag.current = { start: at, x: event.clientX, keys: event.ctrlKey || event.metaKey };
          event.currentTarget.setPointerCapture(event.pointerId); setSelection({ range: [at, at] }); onSeek?.(at);
        }}
        onPointerMove={event => { if (!drag.current) return; const at = atPointer(event), range = [Math.min(at, drag.current.start), Math.max(at, drag.current.start)]; setSelection(drag.current.keys ? { keys: keys.filter(k => k.Frame >= range[0] && k.Frame <= range[1]).map(k => k.Frame) } : { range }); }}
        onPointerUp={event => { if (drag.current) { if (Math.abs(event.clientX - drag.current.x) < 3) { const at = atPointer(event); setSelection({ range: [at, at] }); onSeek?.(at); } drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); event.stopPropagation(); setSelection({ range: [start, end] }); } if (event.key === 'Escape') { event.stopPropagation(); setSelection(null); } }}>
        <line x1="12" y1="62" x2="988" y2="62" className="re-timeline-axis"/>
        {range && <rect x={position(range[0])} y="5" width={Math.max(2, position(range[1]) - position(range[0]))} height="73" className="re-timeline-range"/>}
        <polyline points={values} className="re-visibility-curve"/>
        <line x1={position(playhead)} x2={position(playhead)} y1="4" y2="78" className="re-timeline-playhead"/>
        {keys.map(k => <g key={k.Frame} data-key={k.Frame} role="button" tabIndex={0} aria-label={`${label} key ${k.Frame}: ${displayValue(k.Vector[0])}`} aria-pressed={chosen.includes(k.Frame)} className={`re-visibility-key ${chosen.includes(k.Frame) ? 'selected' : ''}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setSelection(previous => { const ids = event.ctrlKey || event.metaKey ? previous?.keys || [] : []; return { keys: ids.includes(k.Frame) ? ids.filter(at => at !== k.Frame) : [...ids, k.Frame] }; }); onSeek?.(k.Frame); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setSelection({ keys: [k.Frame] }); onSeek?.(k.Frame); } }}>
          <title>{k.Frame} ms · {displayValue(k.Vector[0])}</title><rect x={position(k.Frame) - 8} y="19" width="16" height="52" fill="transparent"/><path d={`M ${position(k.Frame)} 57 l 6 6 l -6 6 l -6 -6 Z`}/>
        </g>)}
      </svg>
      <div className="re-timeline-labels"><span>{start} ms</span><span>{end} ms</span></div>
      <div className="re-visibility-selection"><output aria-live="polite">{selectionText}</output><button onClick={() => setSelection({ range: [start, end] })}>{wholeLabel}</button><button onClick={() => setSelection({ range: [playhead, playhead] })}>At playhead</button></div>
      <div className="re-visibility-actions"><button disabled={disabled || selection?.keys?.length === 0} onClick={() => commit(1)}><Eye size={14}/>Show</button><button disabled={disabled || selection?.keys?.length === 0} onClick={() => commit(0)}><EyeOff size={14}/>Hide</button>{!binary && <><label>Opacity<input aria-label={`${label} opacity percent`} type="number" min="0" max="100" value={amount} onChange={event => setAmount(Number(event.target.value))}/>%</label><button disabled={disabled || selection?.keys?.length === 0} onClick={() => commit(amount / 100)}>Apply</button></>}</div>
      <p className="hint">Drag a time range. Click a diamond to edit a key; Ctrl-click or Ctrl-drag selects several keys. Show / Hide applies to the selection.</p>
      {value?.Keys && value.LineType !== 0 && <p className="re-clock-note">{['Step', 'Linear', 'Hermite', 'Bezier'][value.LineType]} interpolation retained. Range edges switch over 1 ms; selected keys retain the existing fade.</p>}
      {global === null && model.Sequences.length > 1 && <details className="re-batch-visibility"><summary>Several animations…</summary><div className="re-sequence-checks">{model.Sequences.map((s, i) => <label key={i}><input type="checkbox" checked={sequences.includes(i)} onChange={event => setSequences(ids => event.target.checked ? [...ids, i] : ids.filter(id => id !== i))}/><span translate="no">{s.Name}</span></label>)}</div><div className="re-visibility-actions"><button onClick={() => setSequences(model.Sequences.map((_, i) => i))}>Select all</button><button onClick={() => setSequences([])}>Clear</button><button disabled={disabled || !sequences.length} onClick={() => commit(1, true)}>Show in selected</button><button disabled={disabled || !sequences.length} onClick={() => commit(0, true)}>Hide in selected</button></div></details>}
    </> : <p className="hint">{global === null ? 'Add an animation in Sequence Manager to set when this appears.' : 'This track references a missing global sequence. Inspect its timing below.'}</p>}
    <details className="re-advanced-track"><summary>Exact values &amp; interpolation</summary><TrackEditor label={label} value={value} onChange={onChange} frame={playhead} globalSequences={model.GlobalSequences} defaultValue={fallback} onlyAnimated={onlyAnimated}/></details>
    {error && <p className="field-error" role="alert">{error}</p>}
  </section>;
}
