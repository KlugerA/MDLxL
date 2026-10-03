import React, { useEffect, useRef, useState } from 'react';
import { SelectField } from './Fields.jsx';
import { EVENT_TYPES, assignEventData, setEventFrame, resolveEventSound } from './node-event-data.js';
import EventSoundTree from './EventSoundTree.jsx';
import EventDecalPreview from './EventDecalPreview.jsx';

export default function NodeEventEditor({ node, model, modelPath, catalog, error: catalogError, edit, frame, onSeek, sequenceIndex, onSequenceChange }) {
  const type = EVENT_TYPES[node.Name?.slice(0,3)] ? node.Name.slice(0,3) : 'SND', id = node.Name?.slice(4);
  const [query, setQuery] = useState(''), [audioSource, setAudioSource] = useState(null), [fileIndex, setFileIndex] = useState(0), [error, setError] = useState('');
  const audio = useRef(null), rows = catalog?.[type] || [], selected = rows.find(row => row.id === id);
  const matches = rows.filter(row => row.label.toLowerCase().includes(query.toLowerCase()));
  const file = selected?.files?.[fileIndex] || selected?.files?.[0];
  const audioUrl = audioSource && audioSource.file === file ? audioSource.url : '';
  useEffect(() => { setFileIndex(0); setError(''); }, [node.ObjectId, node.Name]);
  useEffect(() => {
    let active = true, url;
    setAudioSource(null); setError('');
    if (file) resolveEventSound(window.desktop.resolveEventResources, file, modelPath).then(sound => {
      if (!active) return;
      url = URL.createObjectURL(new Blob([sound.bytes], {type:sound.mime})); setAudioSource({file,url});
    }).catch(cause => { if(active) setError(cause.message); });
    return () => { active=false; if(url) URL.revokeObjectURL(url); };
  }, [file, modelPath]);
  const assign = (nextType, nextId) => edit('Set event data', ['Nodes'], current => assignEventData(current.Nodes[node.ObjectId], nextType, nextId));
  const global = node.GlobalSeqId ?? node.GlobalSequenceId ?? -1;
  return <div className="re-event-editor">
    <SelectField label="Type" value={type} options={Object.entries(EVENT_TYPES).map(([value,label])=>({value,label}))} onChange={next => { setQuery(''); if(catalog?.[next]?.length) assign(next,catalog[next][0].id); }}/>
    <input type="search" aria-label="Search event data" placeholder="Search event data" value={query} onChange={e=>setQuery(e.target.value)}/>
    {type === 'SND' ? <EventSoundTree rows={rows} selectedId={id} query={query} onSelect={next=>assign(type,next)}/> : <select size="7" aria-label="Event data" value={id || ''} onChange={e=>assign(type,e.target.value)}>{!selected && <option value={id || ''}>{id || 'Select event data'}</option>}{matches.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select>}
    {file && <>{selected.files.length > 1 && <SelectField label="Sound file" value={fileIndex} options={selected.files.map((name,value)=>({value,label:name.split(/[\\/]/).at(-1)}))} onChange={v=>setFileIndex(Number(v))}/>}<audio key={file} ref={audio} aria-label="Sound preview" controls preload="auto" src={audioUrl || undefined} onError={()=>{if(audioUrl)setError('Sound format could not be played.');}}/></>}
    {selected?.definition && ['SPL','FPT','UBR'].includes(type) && <EventDecalPreview definition={selected.definition} modelPath={modelPath}/>}
    {(error || catalogError || type === 'SND' && selected && !file) && <p className="field-error" role="alert">{error || catalogError || `Sound definition unavailable: ${selected.label}`}</p>}
    <SelectField label="Global sequence" value={global} options={[{value:-1,label:'None'},...(model.GlobalSequences || []).map((_,value)=>({value,label:String(value+1)}))]} onChange={v=>edit('Set event global sequence',['Nodes'], current=>{const target=current.Nodes[node.ObjectId]; delete target.GlobalSequenceId;if(Number(v)<0)delete target.GlobalSeqId;else target.GlobalSeqId=Number(v);})}/>
    {global < 0 && <SelectField label="Preview animation" value={sequenceIndex} options={model.Sequences.map((seq,value)=>({value,label:seq.Name}))} onChange={v=>onSequenceChange(Number(v))}/>}
    <div className="re-event-frames"><span>Event tracks</span><div>{Array.from(node.EventTrack || []).map(at=><button key={at} aria-label={`Event frame ${at}`} onClick={()=>onSeek(at)}>{at}</button>)}</div><button onClick={()=>edit('Add event track',['Nodes'],current=>setEventFrame(current.Nodes[node.ObjectId],frame,true))}>Add at {frame}</button><button disabled={!Array.from(node.EventTrack || []).includes(frame)} onClick={()=>edit('Remove event track',['Nodes'],current=>setEventFrame(current.Nodes[node.ObjectId],frame,false))}>Remove</button></div>
  </div>;
}
