import React,{useRef,useState} from 'react';
import {installAddon,loadAddons} from '../src/addons.js';
import './addons.css';

export default function Addons({onCommand,isEnabled}) {
  const [error,setError]=useState(''), [open,setOpen]=useState(false), file=useRef();
  const [addons,setAddons]=useState(()=>{try{return loadAddons(localStorage.getItem('mdlxl-addons'));}catch{return [];}});
  const update=next=>{try{localStorage.setItem('mdlxl-addons',JSON.stringify(next));setAddons(next);setError('');}catch(e){setError('Could not save add-ons: '+e.message);}};
  const install=async record=>{try{if(!record)return;if(record.size>100000)throw new Error('Add-on manifest exceeds 100 KB.');const next=installAddon(addons,await record.text());update(next);}catch(e){setError(e.message);}};
  return <div className="addon-menu"><button aria-expanded={open} onClick={()=>setOpen(!open)}>Add-ons</button>{open&&<section aria-label="Add-ons" className="addon-panel">
    <header><strong>Add-ons</strong><button aria-label="Close add-ons" onClick={()=>setOpen(false)}>×</button></header>
    <p>Install a user-created command menu. Enable or disable it below.</p>
    <input hidden ref={file} type="file" accept=".json" onChange={event=>{install(event.target.files[0]);event.target.value='';}}/><button onClick={()=>file.current.click()}>Install manifest…</button>
    {!addons.length&&<p>No add-ons installed.</p>}
    {addons.map(addon=><fieldset key={addon.id}><legend><label><input type="checkbox" checked={addon.enabled} onChange={event=>update(addons.map(item=>item.id===addon.id?{...item,enabled:event.target.checked}:item))}/>{addon.name}</label></legend>{addon.enabled&&addon.actions.map(action=><button key={action.id} disabled={!isEnabled(action.command)} onClick={()=>{try{onCommand(action.command);setOpen(false);}catch(e){setError(e.message);}}}>{action.label}</button>)}<button onClick={()=>update(addons.filter(item=>item.id!==addon.id))}>Remove</button></fieldset>)}
    {error&&<p role="alert">{error}</p>}
    <details><summary>Make an add-on</summary><p>API v1 uses JSON with schema, apiVersion, id, name and actions. Each action names one existing editor command. No startup code runs. See docs/ADDONS.md and the example in Addons.</p></details>
  </section>}</div>;
}
