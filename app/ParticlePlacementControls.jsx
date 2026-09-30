import React from 'react';
import {particlePlacementInterval} from '../src/particle-placement.js';
export default function ParticlePlacementControls({model,placement,onChange,onPlace,onCancel,error}) {
 const set=change=>onChange(value=>({...value,...change})),clip=model.Sequences[placement.sequence];
 let notice=error;try{particlePlacementInterval(model,placement);}catch(e){notice=e.message;}if(placement.ribbon?.needsBone&&placement.parent==='')notice='These polygons use more than one bone. Choose the weapon bone.';
 return <div className="pe-placement">
  <strong>{placement.ribbon?'Ribbon from polygons':'Add to model'}</strong>
  {placement.ribbon&&<small>Fitted to {placement.ribbon.polygons} marked polygons. After adding, drag the two ribbon ends to adjust it.</small>}
  <label>Attach to<select aria-label="Attach effect to" value={placement.parent} onChange={e=>set({parent:e.target.value})}><option value="">Model origin</option>{[...model.Bones,...model.Helpers].map(node=><option key={node.ObjectId} value={node.ObjectId}>{node.Name}</option>)}</select></label>
  {clip&&<><label>Animation<select aria-label="Placement animation" value={placement.sequence} onChange={e=>{const sequence=Number(e.target.value);set({sequence,from:model.Sequences[sequence].Interval[0],to:''});}}>{model.Sequences.map((item,i)=><option key={i} value={i}>{item.Name}</option>)}</select></label>
   <div className="pe-placement-range">{[['from','Start'],['to','End']].map(([key,label])=><label key={key}>{label}<input aria-label={'Effect '+label.toLowerCase()} type="number" min={clip.Interval[0]} max={clip.Interval[1]} step="1" value={placement[key]} placeholder={key==='to'?'Choose end':undefined} onChange={e=>set({[key]:e.target.value===''?'':Number(e.target.value)})}/></label>)}</div>
   <small>Scrub the preview and click “End here”, or enter an end frame.</small></>}
  <button disabled={!!notice} onClick={onPlace}>{placement.ribbon?'Add ribbon':'Confirm placement'}</button>{notice&&<small role="status">{notice}</small>}
  {!placement.ribbon&&<details><summary>Position & motion</summary>
   <button disabled={placement.parent===''} onClick={()=>set({position:Array.from(model.Nodes[Number(placement.parent)].PivotPoint||[0,0,0])})}>Snap to attachment pivot</button>
   {['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<input aria-label={'Effect anchor '+axis} type="number" step="any" value={placement.position[i]} onChange={e=>set({position:placement.position.map((v,k)=>k===i?Number(e.target.value):v)})}/></label>)}
   <label>Motion<select aria-label="Effect placement motion" value={placement.motion} onChange={e=>set({motion:e.target.value})}><option value="source">Keep source motion</option><option value="target">Use target attachment motion</option></select></label>
   {clip&&<label><input type="checkbox" checked={placement.fit} onChange={e=>set({fit:e.target.checked})}/>Fit timing to Start / End</label>}
  </details>}
  <button onClick={onCancel}>Cancel placement</button>
 </div>;
}
