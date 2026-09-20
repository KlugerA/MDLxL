import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  animationTargets, createGeosetAnimations, sampleAnimationProperty,
  setAnimationKey, setAnimationSequences,
} from '../src/animation-tracks.js';
import { setSequenceOptions } from '../src/animation.js';
import { clampAlphaPercentText } from '../src/animation-controller-inputs.js';
import { wheelOptionIndex } from '../src/dropdown-wheel.js';
import {
  createGlobalSequence, createSequence, deleteGlobalSequence, deleteSequence,
  setGlobalSequenceDuration, setSequenceInterval, setSequenceMoveSpeed, setSequenceName,
} from '../src/sequence-editor.js';
import './AnimationController.css';

const valuesEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const valueArray = value => typeof value === 'number' ? [value] : Array.from(value || []);

function commonValue(model, targets, time, sequenceIndex) {
  try {
    const values = targets.map(target => valueArray(sampleAnimationProperty(model, target, time, sequenceIndex)));
    if (!values.length) return null;
    return values.every(value => valuesEqual(value, values[0])) ? values[0] : null;
  } catch { return null; }
}

const enterBlurs = event => { if (event.key === 'Enter') event.currentTarget.blur(); };

/** Screenshot-faithful Animations toolbox. Movement remains in its own tab. */
export default function AnimationController({
  model, revision = 0, sequenceIndex = -1, globalSeqId = null, time = 0,
  selectedGeosets = [], onEdit, onSeek, onTimelineChange,
  disabled = false,
}) {
  const [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [moveSpeedDrafts, setMoveSpeedDrafts] = useState({});
  const sequenceNameInput = useRef(null), sequenceSelect = useRef(null);
  const globalDomain = Number.isInteger(globalSeqId) && globalSeqId >= 0 && model.GlobalSequences?.[globalSeqId] > 0;
  const sequence = globalDomain ? null : model.Sequences?.[sequenceIndex];
  const frame = Math.round(time);
  const geosetIds = useMemo(() => [...new Set(selectedGeosets)].filter(id => model.Geosets?.[id]), [selectedGeosets.join(','), model.Geosets?.length]);
  const missingGeosets = geosetIds.filter(id => !(model.GeosetAnims || []).some(animation => animation.GeosetId === id));
  const allHaveAnimation = geosetIds.length > 0 && missingGeosets.length === 0;
  const targets = animationTargets(model, { geosetIds });
  const alphaTargets = targets.filter(target => target.property === 'Alpha');
  const colorTargets = targets.filter(target => target.property === 'Color');
  const sampledAlpha = allHaveAnimation ? commonValue(model, alphaTargets, frame, sequenceIndex) : null;
  const sampledColor = allHaveAnimation ? commonValue(model, colorTargets, frame, sequenceIndex) : null;
  const alphaStamp = JSON.stringify(sampledAlpha), colorStamp = JSON.stringify(sampledColor);
  const [alpha, setAlpha] = useState(''), [rgb, setRgb] = useState(['', '', '']);
  const [startText, setStartText] = useState(''), [endText, setEndText] = useState('');
  const [moveSpeedText, setMoveSpeedText] = useState('');
  const [sequenceNameText, setSequenceNameText] = useState('');

  useEffect(() => {
    const stored = moveSpeedDrafts[sequenceIndex];
    setMoveSpeedText(sequence ? String(sequence.MoveSpeed > 0 ? sequence.MoveSpeed : stored ?? 0) : '');
  }, [sequenceIndex, globalSeqId, sequence?.MoveSpeed, revision]);
  useEffect(() => setSequenceNameText(globalDomain ? String(model.GlobalSequences[globalSeqId]) : sequence?.Name ?? (sequenceIndex < 0 ? 'All line' : '')), [sequenceIndex, globalSeqId, globalDomain, sequence?.Name, model.GlobalSequences?.[globalSeqId], revision]);
  useEffect(() => {
    const owner = sequenceNameInput.current?.ownerDocument;
    if (!owner) return;
    const release = event => { const input = sequenceNameInput.current; if (input && owner.activeElement === input && event.target !== input) input.blur(); };
    owner.addEventListener('pointerdown', release, true);
    return () => owner.removeEventListener('pointerdown', release, true);
  }, []);
  useEffect(() => setAlpha(sampledAlpha ? String(Math.round(sampledAlpha[0] * 100)) : ''), [alphaStamp, frame, geosetIds.join(','), revision]);
  useEffect(() => setRgb(sampledColor ? sampledColor.map(value => String(Math.round(value * 255))) : ['', '', '']), [colorStamp, frame, geosetIds.join(','), revision]);
  useEffect(() => {
    if (globalDomain) { setStartText('0'); setEndText(String(model.GlobalSequences[globalSeqId])); }
    else if (sequence?.Interval) { setStartText(String(sequence.Interval[0])); setEndText(String(sequence.Interval[1])); }
    else { setStartText(''); setEndText(''); }
  }, [sequenceIndex, globalSeqId, globalDomain, sequence?.Interval?.[0], sequence?.Interval?.[1], model.GlobalSequences?.[globalSeqId], revision]);

  function commit(label, sections, mutate, success) {
    let cause;
    try {
      const result = onEdit(label, sections, current => {
        try { return mutate(current); } catch (failure) { cause = failure; throw failure; }
      });
      if (cause) throw cause;
      setError(''); setNotice(result === false ? 'Values are already up to date.' : success); return true;
    } catch (failure) { setError(failure.message); setNotice(''); return false; }
  }

  function changeSequence(patch) {
    commit('Edit animation sequence properties', ['Sequences'], current => setSequenceOptions(current, sequenceIndex, patch), 'Sequence properties updated.');
  }

  function commitInterval() {
    if (globalDomain) {
      const duration = Number(endText);
      if (commit('Set global sequence interval', ['GlobalSequences'], current => setGlobalSequenceDuration(current, globalSeqId, duration), 'Global sequence interval updated.')) onSeek?.(Math.max(0, Math.min(duration, frame)));
      else { setStartText('0'); setEndText(String(model.GlobalSequences[globalSeqId])); }
      return;
    }
    if (!sequence) return;
    const start = Number(startText), end = Number(endText);
    if (commit('Set animation frame interval', ['Sequences'], current => setSequenceInterval(current, sequenceIndex, start, end), 'Frame interval updated.')) onSeek?.(Math.max(start, Math.min(end, frame)));
    else { setStartText(String(sequence.Interval[0])); setEndText(String(sequence.Interval[1])); }
  }

  function addSequence() {
    let index = -1, start = 0;
    if (commit('Create animation sequence', ['Sequences', 'Geosets'], current => {
      index = createSequence(current); start = current.Sequences[index].Interval[0]; return index;
    }, 'One-second blank sequence created.')) { onTimelineChange?.(index); onSeek?.(start); }
  }

  function addGlobal() {
    let index = -1;
    if (commit('Create global sequence', ['GlobalSequences'], current => { index = createGlobalSequence(current); return index; }, 'One-second global sequence created.')) {
      onTimelineChange?.(`global:${index}`); onSeek?.(0);
    }
  }

  function removeCurrent() {
    if (globalDomain) {
      if (commit('Delete global sequence and its keyframes', ['GlobalSequences', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras', 'Info'], current => deleteGlobalSequence(current, globalSeqId), 'Global sequence and its keyframes deleted.')) {
        const next = model.GlobalSequences.length ? `global:${Math.min(globalSeqId, model.GlobalSequences.length - 1)}` : model.Sequences.length ? 0 : -1;
        onTimelineChange?.(next);
      }
      return;
    }
    if (!sequence) return;
    if (commit('Delete sequence and its keyframes', ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'TextureAnims', 'Nodes', 'Cameras', 'Info'], current => deleteSequence(current, sequenceIndex), 'Sequence, contained keyframes, and node events deleted.')) {
      setMoveSpeedDrafts(previous => Object.fromEntries(Object.entries(previous).flatMap(([key, value]) => Number(key) < sequenceIndex ? [[key, value]] : Number(key) > sequenceIndex ? [[Number(key) - 1, value]] : [])));
      const next = model.Sequences.length ? Math.min(sequenceIndex, model.Sequences.length - 1) : model.GlobalSequences.length ? 'global:0' : -1;
      onTimelineChange?.(next);
    }
  }

  function createVisibility() {
    commit('Create geoset visibility', ['GeosetAnims', 'Info'], current => createGeosetAnimations(current, missingGeosets), 'Visibility created at 100% alpha.');
  }

  function setVisibility(visible) {
    const value = visible ? 1 : 0;
    setAlpha(visible ? '100' : '0');
    commit('Set geoset visibility keyframe', ['GeosetAnims', 'Info'], current => setAnimationKey(current, alphaTargets, frame, value, sequenceIndex), visible ? 'Selected geosets shown.' : 'Selected geosets hidden.');
  }

  function commitAlpha() {
    if (!sequence || !allHaveAnimation || alpha === '') return;
    const numeric = Number(alpha);
    if (!Number.isFinite(numeric)) { setError('Alpha must be a number from 0 to 100.'); setNotice(''); return; }
    const value = Math.max(0, Math.min(100, numeric));
    setAlpha(String(value));
    commit('Set geoset alpha keyframe', ['GeosetAnims', 'Info'], current => setAnimationKey(current, alphaTargets, frame, value / 100, sequenceIndex), `Alpha set to ${value}%.`);
  }

  function rgbValue() {
    if (rgb.some(value => value.trim() === '' || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 255)) throw new Error('R, G and B must be whole numbers from 0 to 255.');
    return rgb.map(value => Number(value) / 255);
  }

  function commitRgb() {
    if (!sequence || !allHaveAnimation) return;
    let value;
    try { value = rgbValue(); } catch (failure) { setError(failure.message); setNotice(''); return; }
    commit('Set geoset RGB keyframe', ['GeosetAnims', 'Info'], current => setAnimationKey(current, colorTargets, frame, value, sequenceIndex), 'Color tint keyframe updated.');
  }

  function bakeRgb(all) {
    let value;
    try { value = rgbValue(); } catch (failure) { setError(failure.message); setNotice(''); return; }
    commit(all ? 'Bake RGB in all sequences' : 'Bake RGB in selected sequence', ['GeosetAnims', 'Info'],
      current => setAnimationSequences(current, colorTargets, value, all ? null : [sequenceIndex]),
      all ? 'RGB baked at the beginning and end of every sequence.' : 'RGB baked at the beginning and end of this sequence.');
  }

  function toggleMoveSpeed(checked) {
    if (!sequence) return;
    const current = Number(sequence.MoveSpeed) || 0;
    if (!checked && current > 0) setMoveSpeedDrafts(previous => ({ ...previous, [sequenceIndex]: current }));
    const restored = Number(moveSpeedText) > 0 ? Number(moveSpeedText) : Number(moveSpeedDrafts[sequenceIndex]) > 0 ? Number(moveSpeedDrafts[sequenceIndex]) : 1;
    const value = checked ? restored : 0;
    if (commit('Set sequence move speed', ['Sequences'], model => setSequenceMoveSpeed(model, sequenceIndex, value), checked ? 'MoveSpeed enabled.' : 'MoveSpeed disabled.')) setMoveSpeedText(String(checked ? value : restored));
  }

  function commitMoveSpeed() {
    if (!moveApplied || !sequence) return;
    const speed = Number(moveSpeedText);
    if (!Number.isFinite(speed) || speed <= 0) {
      setError('Move speed must be a number greater than 0.'); setNotice(''); setMoveSpeedText(String(sequence.MoveSpeed)); return;
    }
    if (commit('Set sequence move speed', ['Sequences'], current => setSequenceMoveSpeed(current, sequenceIndex, speed), 'MoveSpeed updated.')) setMoveSpeedDrafts(previous => ({ ...previous, [sequenceIndex]: speed }));
  }

  function commitSequenceName() {
    if (!sequence || sequenceNameText === sequence.Name) return;
    if (!commit('Rename animation sequence', ['Sequences'], current => setSequenceName(current, sequenceIndex, sequenceNameText), 'Sequence renamed.')) setSequenceNameText(sequence.Name);
  }

  function wheelSequence(event) {
    const select = sequenceSelect.current;
    if (!select || event.ctrlKey || event.metaKey || !event.deltaY) return;
    event.preventDefault(); event.stopPropagation();
    const index = wheelOptionIndex(select.options, select.selectedIndex, event.deltaY);
    if (index !== select.selectedIndex) onTimelineChange?.(select.options[index].value);
  }

  const noLocalSequence = disabled || !sequence || globalDomain;
  const moveApplied = !globalDomain && !!sequence && Number(sequence.MoveSpeed) > 0;
  const colorBlocked = noLocalSequence || !allHaveAnimation;
  const alphaNumber = alpha === '' ? NaN : Number(alpha);
  const visibleChecked = Number.isFinite(alphaNumber) && alphaNumber > 0;
  const mixedOrPartial = alpha === '' || Number.isFinite(alphaNumber) && alphaNumber !== 0 && alphaNumber !== 100;
  const currentValue = globalDomain ? `global:${globalSeqId}` : sequenceIndex;
  return <section className="animation-controller" aria-label="Animations toolbox">
    <label className="ac-current">Current sequence:<span className="ac-sequence-combo"><input ref={sequenceNameInput} aria-label="Animation sequence name" className={globalDomain ? 'global-sequence-value' : ''} value={sequenceNameText} disabled={!sequence} readOnly={globalDomain || !sequence} onWheel={wheelSequence} onChange={event => setSequenceNameText(event.target.value)} onBlur={commitSequenceName} onKeyDown={enterBlurs}/><select ref={sequenceSelect} data-warmkey="animationSequence" aria-label="Choose animation sequence" value={currentValue} onChange={event => onTimelineChange?.(event.target.value)} title="Choose animation sequence">
      <option value={-1}>All line</option>
      {(model.Sequences || []).map((item, index) => <option key={index} value={index} translate="no">{item.Name}</option>)}
      {(model.GlobalSequences || []).map((duration, index) => <option className="global-sequence-value" style={{ color: '#d00000' }} key={`global:${index}`} value={`global:${index}`}>{duration}</option>)}
    </select></span></label>
    <div className="ac-caption">Sequence properties:</div>
    <div className="ac-properties">
      <label><input type="checkbox" checked={!!sequence && !sequence.NonLooping} disabled={noLocalSequence} onChange={event => changeSequence({ nonLooping: !event.target.checked })}/>Loop</label>
      <label><input type="checkbox" checked={(sequence?.Rarity || 0) > 0} disabled={noLocalSequence} onChange={event => changeSequence({ rarity: event.target.checked ? 1 : 0 })}/>Use Rarity</label>
      <label className="ac-rarity">Rarity =<input aria-label="Sequence rarity" type="number" min="1" max="40" step="1" disabled={noLocalSequence || !(sequence?.Rarity > 0)} value={sequence?.Rarity > 0 ? sequence.Rarity : ''} onChange={event => { if (event.target.value !== '') changeSequence({ rarity: Number(event.target.value) }); }}/></label>
      <label title="Enable the sequence MoveSpeed ground-speed value."><input type="checkbox" checked={moveApplied} disabled={noLocalSequence} onChange={event => toggleMoveSpeed(event.target.checked)}/>Apply Move Speed</label>
      {moveApplied && <label className="ac-move-speed">Speed=<input aria-label="Sequence move speed" type="number" min="0.001" step="any" disabled={noLocalSequence} value={moveSpeedText} onChange={event => setMoveSpeedText(event.target.value)} onBlur={commitMoveSpeed} onKeyDown={enterBlurs}/></label>}
    </div>
    <div className="ac-caption ac-interval-caption">Frame interval:</div>
    <div className={`ac-interval${globalDomain ? ' global-sequence-value' : ''}`}>
      <input aria-label="Sequence first frame" type="number" min="0" step="1" disabled={disabled || !sequence || globalDomain} value={startText} onChange={event => setStartText(event.target.value)} onBlur={commitInterval} onKeyDown={enterBlurs}/><span>–</span>
      <input aria-label="Sequence last frame" type="number" min={globalDomain ? 1 : Math.max(0, Number(startText) || 0)} step="1" disabled={disabled || !sequence && !globalDomain} value={endText} onChange={event => setEndText(event.target.value)} onBlur={commitInterval} onKeyDown={enterBlurs}/>
    </div>
    <div className="ac-sequence-actions"><button disabled={disabled} onClick={addSequence}>Create</button><button disabled={disabled} onClick={addGlobal}>Global</button><button disabled={disabled || !sequence && !globalDomain} onClick={removeCurrent}>Delete</button></div>
    <div className="ac-geoset-animation">
      <div className="ac-visibility"><span>Visibility:</span>{missingGeosets.length ? <button className="ac-create-visibility" disabled={disabled || !geosetIds.length} onClick={createVisibility}>Create Visibility</button> : <label><input type="checkbox" aria-label="Visible at current frame" checked={visibleChecked} ref={input => { if (input) input.indeterminate = mixedOrPartial; }} disabled={colorBlocked} onChange={event => setVisibility(event.target.checked)}/>On</label>}
        <label className="ac-alpha">Alpha:<input aria-label="Visibility alpha percent" type="number" min="0" max="100" step="1" placeholder={geosetIds.length ? 'Mixed' : ''} disabled={colorBlocked} value={alpha} onChange={event => setAlpha(clampAlphaPercentText(event.target.value))} onBlur={commitAlpha} onKeyDown={enterBlurs}/></label>
      </div>
      <div className="ac-color"><span>Color Tint:</span><div className="ac-rgb">{['R', 'G', 'B'].map((label, index) => <label className={`channel-${label.toLowerCase()}`} key={label}>{label}<input aria-label={`Animation ${label}`} type="number" min="0" max="255" step="1" placeholder={geosetIds.length ? 'Mixed' : ''} disabled={colorBlocked} value={rgb[index]} onChange={event => setRgb(previous => previous.map((value, i) => i === index ? event.target.value : value))} onBlur={commitRgb} onKeyDown={enterBlurs}/></label>)}</div></div>
    </div>
    <button disabled={colorBlocked} onClick={() => bakeRgb(false)}>Bake Sequence RGB</button>
    <button disabled={disabled || globalDomain || !model.Sequences?.length || !allHaveAnimation} onClick={() => bakeRgb(true)}>Bake All RGB</button>
    {error && <p className="ac-error" role="alert">{error}</p>}{notice && <p className="ac-notice" role="status">{notice}</p>}
  </section>;
}
