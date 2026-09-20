import React,{useEffect,useRef,useState} from 'react';
import {PaintTool} from './PaintIcon.jsx';
export default function PaintTextureManager({targets,activeId,onAssign,onRename,onNew,onImport,onAll,disabled}){
  const target=targets.find(t=>t.id===activeId),[name,setName]=useState(target?.paintName||''),editing=useRef(false);
  useEffect(()=>{setName(target?.paintName||target?.label||'');editing.current=false;},[activeId,target?.paintName]);
  function rename(){if(!editing.current)return;editing.current=false;if(name.trim()!==target?.paintName&&onRename(name)===false)setName(target?.paintName||'');}
  function key(e){if(e.key==='Enter'){e.preventDefault();rename();e.currentTarget.blur();}if(e.key==='Escape'){editing.current=false;setName(target?.paintName||'');e.currentTarget.blur();}}
  return <section className="paint-texture-manager"><h3>Texture Name</h3>
    <select aria-label="Texture assignment" value={activeId||''} onChange={e=>onAssign(e.target.value)} disabled={disabled}>{targets.map(t=><option key={t.id} value={t.id}>{t.paintName||t.label}</option>)}</select>
    <div className="paint-name-row"><input aria-label="Texture Name" maxLength={80} value={name} onFocus={()=>{editing.current=true;}} onChange={e=>{editing.current=true;setName(e.target.value);}} onBlur={rename} onKeyDown={key}/><PaintTool icon="new" label="New texture" onClick={onNew}/><PaintTool icon="import" label="Import texture" onClick={onImport}/></div>
    <button className="paint-apply-all" onClick={onAll} disabled={!target||disabled}>Use for whole model</button>
  </section>;
}
