import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Section, TextField, NumberField, SelectField, Check, TrackEditor } from './Fields.jsx';
import { createNode, deleteNode } from '../src/editor-document.js';
import { particleAnimatedParameters, particleUVGroups, particleFlags, particleRotationDegrees, setParticleRotationDegrees, particlePreviewModel } from '../src/particle-editing.js';
import './resource-editors.css';
import './particle-editor.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const emptyAssets = new Map();
const labelFor = property => property.replace(/([a-z])([A-Z])/g, '$1 $2');
const colorHex = color => `#${Array.from(color || [1, 1, 1], value => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0')).join('')}`;

/** Dedicated PE2 editor: committed edits share document history and live preview. */
export default function ParticleEditor({ doc, revision = doc?.revision || 0, edit, refresh, modelPath, textureAssets = emptyAssets, preferences, teamColor = 0, selectedNodeId, sequenceIndex = 0, previewFrame = 0, onClose, onNodeChange, onImportTexture }) {
  const model = doc.model;
  const [emitterId, setEmitterId] = useState(() => model.ParticleEmitters2.find(node => node.ObjectId === selectedNodeId)?.ObjectId ?? model.ParticleEmitters2[0]?.ObjectId ?? null);
  const [sequence, setSequence] = useState(model.Sequences?.[sequenceIndex] ? sequenceIndex : model.Sequences?.length ? 0 : -1);
  const [time, setTime] = useState(previewFrame), [playing, setPlaying] = useState(true), [isolate, setIsolate] = useState(false), [message, setMessage] = useState('');
  const [editRevision, setEditRevision] = useState(0), [restart, setRestart] = useState(0);
  const dialog = useRef(null);
  const emitter = model.ParticleEmitters2.find(node => node.ObjectId === emitterId) || null;
  const interval = model.Sequences?.[sequence]?.Interval || [0, 5000], start = interval[0], end = interval[1];
  const frame = Math.max(start, Math.min(end, Math.round(time))), angles = emitter ? particleRotationDegrees(model, emitter, frame, sequence) : [0, 0, 0];
  const preview = useMemo(() => particlePreviewModel(model, emitterId, isolate), [model, revision, editRevision, emitterId, isolate]);
  useEffect(() => { const previous = document.activeElement; dialog.current?.focus(); return () => previous?.focus?.(); }, []);
  useEffect(() => { setTime(value => Math.max(start, Math.min(end, value))); }, [start, end]);
  const choose = id => { setEmitterId(id); onNodeChange?.(id); setMessage(''); };
  const apply = (label, mutate, sections = ['Nodes']) => {
    if (doc.readOnly) return false;
    try {
      let failure;
      const operation = current => { try { return mutate(current || doc.model); } catch (cause) { failure = cause; throw cause; } };
      const result = edit ? edit(label, sections, operation) : doc.apply(label, sections, operation);
      if (failure) throw failure;
      setMessage(result === false ? 'No change applied.' : ''); setEditRevision(value => value + 1); refresh?.(); return result;
    } catch (cause) { setMessage(cause.message); return false; }
  };
  const update = (property, value) => apply(`Set particle ${labelFor(property)}`, current => { const node = current.ParticleEmitters2.find(item => item.ObjectId === emitterId); if (!node) throw new Error('The emitter was removed.'); node[property] = value; });
  const arrayValue = (property, index, value, Type, fallback) => { const values = Array.from(emitter[property] || fallback); values[index] = value; update(property, new Type(values)); };
  const add = () => { const id = apply('Create Particle Emitter 2', current => createNode(current, 'ParticleEmitter2').ObjectId, ['Nodes', 'PivotPoints', 'Info']); if (id !== false) choose(id); };
  const remove = () => { const result = apply('Delete Particle Emitter 2', current => deleteNode(current, emitterId), ['Nodes', 'PivotPoints', 'Info']); if (result !== false) choose(doc.model.ParticleEmitters2[0]?.ObjectId ?? null); };
  return <div className="resource-editor particle-editor" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) onClose?.();
    if (event.key === 'Tab') {
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(element => element.getClientRects().length);
      if (event.shiftKey && [controls[0], dialog.current].includes(document.activeElement)) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }
  }}>
    <section className="re-window pe-window" role="dialog" aria-modal="true" aria-label="Particle Editor" tabIndex={-1} ref={dialog} data-warmkey-scope="dialog" data-warmkey-prefix="particles">
      <header className="re-caption"><span>Particle Editor · Particle Emitter 2</span><button aria-label="Close Particle Editor" className="re-caption-close" onClick={onClose}>×</button></header>
      <div className="pe-toolbar"><label>Emitter<select aria-label="Particle emitter" value={emitterId ?? ''} onChange={event => choose(Number(event.target.value))}>{!emitter && <option value="">Choose or create an emitter</option>}{model.ParticleEmitters2.map(node => <option key={node.ObjectId} value={node.ObjectId} translate="no">{node.Name} · {node.ObjectId}</option>)}</select></label><button onClick={add} disabled={doc.readOnly}>New emitter</button><button onClick={remove} disabled={doc.readOnly || !emitter}>Remove</button></div>
      <div className="pe-body"><div className="pe-preview-pane">
        <div className="pe-preview"><Suspense fallback={<p>Loading particle preview…</p>}><GamePreview presentation="preview" key={restart} model={preview} revision={revision + editRevision} modelPath={modelPath} textureAssets={textureAssets} preferences={preferences} teamColor={teamColor} sequenceIndex={sequence} timelineInterval={[start, end]} time={frame} playing={playing} loop={true} onTimeChange={setTime} onPlayingChange={setPlaying} mode="textured" view="perspective" cameraMode="rotate" showParticles={true} showGrid={true} overlays={{ bones: false, nodes: false, attachments: false, particles: false }} /></Suspense></div>
        <div className="pe-preview-options"><Check label="Isolate emitter" value={isolate} onChange={setIsolate}/><button onClick={() => { setTime(start); setRestart(value => value + 1); }}>Restart preview</button></div>
        <label className="pe-sequence">Animation<select aria-label="Particle preview animation" value={sequence} onChange={event => { setPlaying(false); setSequence(Number(event.target.value)); setTime(model.Sequences[Number(event.target.value)]?.Interval[0] || 0); }}>{!model.Sequences.length && <option value="-1">Preview · 0–5000 ms</option>}{model.Sequences.map((item, index) => <option key={index} value={index} translate="no">{item.Name}</option>)}</select></label>
        <div className="pe-transport"><button onClick={() => setPlaying(value => !value)} disabled={!emitter}>{playing ? 'Pause' : 'Play'}</button><input aria-label="Particle preview playhead" type="range" min={start} max={end} step="1" value={frame} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }}/><label>Frame:<input aria-label="Particle preview frame" type="number" min={start} max={end} step="1" value={frame} onChange={event => { if (event.target.value !== '') { setPlaying(false); setTime(Number(event.target.value)); } }}/></label></div>
        <p className="pe-help">Edit a value, then press Enter or leave the field to see the change. Animate uses this playhead. XYZ rotation is local, in degrees.</p>
      </div><fieldset className="pe-controls inspector-fields" disabled={doc.readOnly} onFocusCapture={event => { if (event.target.closest('.track-editor') || event.target.getAttribute('aria-label')?.startsWith('Rotate ')) setPlaying(false); }}>
        {!emitter ? <p>Create or choose a Particle Emitter 2 to edit its appearance, animation and rotation.</p> : <>
          <Section title="Emitter"><TextField label="Name" value={emitter.Name} onChange={value => update('Name', value)}/><div className="pe-axis-fields">{['X', 'Y', 'Z'].map((axis, index) => <NumberField key={axis} label={`Rotate ${axis} (degrees)`} value={Number(angles[index].toFixed(3))} onChange={value => { const next = [...angles]; next[index] = value; apply(`Rotate particle ${axis}`, current => setParticleRotationDegrees(current, emitterId, frame, sequence, next)); }}/>)}</div><div className="pe-axis-fields">{['X', 'Y', 'Z'].map((axis, index) => <NumberField key={axis} label={`Position ${axis}`} value={emitter.PivotPoint?.[index] || 0} onChange={value => apply(`Move particle ${axis}`, current => { const node = current.ParticleEmitters2.find(item => item.ObjectId === emitterId), next = new Float32Array(node.PivotPoint || [0, 0, 0]); next[index] = value; node.PivotPoint = next; current.PivotPoints[node.ObjectId] = next; }, ['Nodes', 'PivotPoints'])}/>)}</div></Section>
          <Section title="Animated parameters"><div className="pe-parameters">{particleAnimatedParameters.map(property => <TrackEditor key={`${emitterId}:${property}`} label={labelFor(property)} value={emitter[property]} defaultValue={property === 'Visibility' ? 1 : 0} frame={frame} globalSequences={model.GlobalSequences} onChange={value => update(property, value)}/>)}</div></Section>
          <Section title="Rendering"><SelectField label="Texture ID" value={emitter.TextureID ?? ''} options={[{ label: 'No texture', value: '' }, ...model.Textures.map((texture, value) => ({ value, label: `${value} · ${texture.Image || `Replaceable ${texture.ReplaceableId}`}` }))]} onChange={value => update('TextureID', value === '' ? null : Number(value))}/>{onImportTexture && <button onClick={onImportTexture}>Load texture…</button>}<SelectField label="Filter Mode" value={emitter.FilterMode ?? 0} options={['Blend', 'Additive', 'Modulate', 'Modulate 2×', 'Alpha Key'].map((label, value) => ({ label, value }))} onChange={value => update('FilterMode', Number(value))}/></Section>
          <Section title="Segments"><div className="pe-segments">{[0, 1, 2].map(index => <fieldset key={index}><legend>Segment {index + 1}</legend><label className="field"><span>Color</span><input aria-label={`Segment ${index + 1} color`} type="color" value={colorHex(emitter.SegmentColor?.[index])} onChange={event => { const colors = (emitter.SegmentColor || [[1, 1, 1], [1, 1, 1], [1, 1, 1]]).map(value => new Float32Array(value)); colors[index] = new Float32Array([1, 3, 5].map(start => parseInt(event.target.value.slice(start, start + 2), 16) / 255)); update('SegmentColor', colors); }}/></label><NumberField label={`Alpha ${index + 1} (0–255)`} min={0} max={255} step={1} value={emitter.Alpha?.[index] ?? 255} onChange={value => arrayValue('Alpha', index, value, Uint8Array, [255, 255, 0])}/><NumberField label={`Scaling ${index + 1}`} min={0} value={emitter.ParticleScaling?.[index] ?? 1} onChange={value => arrayValue('ParticleScaling', index, value, Float32Array, [1, 1, 1])}/></fieldset>)}</div></Section>
          <Section title="Head and tail animation"><div className="pe-uv-groups">{particleUVGroups.map(([label, property]) => <fieldset key={property}><legend>{label}</legend>{['Start', 'End', 'Repeat'].map((field, index) => <NumberField key={field} label={`${label} ${field}`} min={0} step={1} value={emitter[property]?.[index] ?? (index === 2 ? 1 : 0)} onChange={value => arrayValue(property, index, value, Uint32Array, [0, 0, 1])}/>)}</fieldset>)}</div></Section>
          <Section title="Flags"><div className="checks">{particleFlags.map(([label, bit]) => <Check key={bit} label={label} value={(emitter.Flags || 0) & bit} onChange={value => update('Flags', value ? (emitter.Flags || 0) | bit : (emitter.Flags || 0) & ~bit)}/>)}<span title="Alpha Key is the particle filter mode in MDX; this checkbox and Filter Mode edit the same setting."><Check label="Alpha Key" value={emitter.FilterMode === 4} onChange={value => update('FilterMode', value ? 4 : 0)}/></span><Check label="Squirt" value={emitter.Squirt} onChange={value => update('Squirt', value)}/>{[['Head', 1], ['Tail', 2]].map(([label, bit]) => <Check key={bit} label={label} value={(emitter.FrameFlags || 0) & bit} onChange={value => update('FrameFlags', value ? (emitter.FrameFlags || 0) | bit : (emitter.FrameFlags || 0) & ~bit)}/>)}</div></Section>
          <Section title="Miscellaneous">{['Rows', 'Columns', 'LifeSpan', 'TailLength', 'PriorityPlane', 'ReplaceableId', 'Time'].map(property => <NumberField key={property} label={property === 'ReplaceableId' ? 'Replaceable ID' : labelFor(property)} step={['Rows', 'Columns', 'PriorityPlane', 'ReplaceableId'].includes(property) ? 1 : 'any'} min={['Rows', 'Columns'].includes(property) ? 1 : property === 'PriorityPlane' ? undefined : 0} max={property === 'Time' ? 1 : undefined} value={emitter[property] ?? 0} onChange={value => update(property, value)}/>)}<p className="hint">Time is the fraction of each particle's lifespan spent in the first segment. The preview Frame control chooses animation time.</p></Section>
        </>}
      </fieldset></div><footer className="re-footer"><span className="re-status" role="status">{message || (doc.readOnly ? 'Read-only model.' : 'Edits apply immediately, can be undone, and are saved with the model.')}</span><button onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}
