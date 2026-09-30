import React,{useRef} from 'react';
import {ParticleSlider} from './ParticleCluelessControls.jsx';
import {particleValue} from '../src/particle-bindings.js';
import {Section,NumberField,TrackEditor,TextField,SelectField} from './Fields.jsx';
const hex=color=>'#'+Array.from(color,v=>Math.round(Math.min(1,Math.max(0,v))*255).toString(16).padStart(2,'0')).join('');
export default function ParticleRibbonControls({model,emitter,frame,globalTime,sequence,mode,scope,setScope,begin,change,finish,cancel,update}){
 const options={frame,globalTime,interval:model.Sequences[sequence]?.Interval,globalSequences:model.GlobalSequences,family:'RibbonEmitters'},color=particleValue(emitter,'Color',options),colorDrag=useRef(false);
 const slider=(field,label,min,max,step='any')=><ParticleSlider key={field} {...{field,label,begin,change,finish,cancel,min,max,step}} value={particleValue(emitter,field,options)}/>;
 if(mode==='Classic')return <>
  <Section title="Ribbon" open><TextField label="Name" value={emitter.Name} onChange={v=>update('Name',v)}/>{['HeightAbove','HeightBelow','Alpha','TextureSlot','Visibility'].map(field=><TrackEditor key={field} label={field} value={emitter[field]} frame={frame} globalSequences={model.GlobalSequences} defaultValue={field==='Alpha'?1:0} onChange={v=>update(field,v)}/>)}</Section>
  <Section title="Strip and material" open={false}>{['LifeSpan','EmissionRate','Gravity','Rows','Columns','MaterialID'].map(field=><NumberField key={field} label={field} value={emitter[field]} onChange={v=>update(field,v)}/>)}</Section>
  <Section title="Color" open={false}><TrackEditor label="Color" value={emitter.Color} dimensions={3} defaultValue={[1,1,1]} frame={frame} globalSequences={model.GlobalSequences} onChange={v=>update('Color',v)}/></Section>
 </>;
 return <div className="pe-clueless-controls">
  <label className="pe-scope">Edit<select aria-label="Animated edit scope" value={scope} onChange={e=>{cancel();setScope(e.target.value);}}><option value="key">This key</option><option value="track">Whole track · offset</option></select></label>
  {slider('HeightAbove','Upper edge',0,80)}{slider('HeightBelow','Lower edge',0,80)}{slider('LifeSpan','Lasts',.01,10)}{slider('EmissionRate','Amount',0,150,1)}{slider('Alpha','Opacity',0,1)}{slider('Visibility','Emitting',0,1)}
  <details><summary>Strip appearance</summary><label>Color<input aria-label="Ribbon color" type="color" value={hex(color)} onChange={e=>{if(!colorDrag.current){colorDrag.current=true;begin('Color');}change([1,3,5].map(i=>parseInt(e.target.value.slice(i,i+2),16)/255));}} onBlur={()=>{if(colorDrag.current){colorDrag.current=false;finish();}}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();colorDrag.current=false;cancel();}}}/></label><label>Material<select aria-label="Ribbon material" value={emitter.MaterialID} onChange={e=>update('MaterialID',Number(e.target.value))}>{model.Materials.map((_,i)=><option key={i} value={i}>Material {i+1}</option>)}</select></label>{slider('TextureSlot','Picture cell',0,Math.max(0,(emitter.Rows||1)*(emitter.Columns||1)-1),1)}</details>
 </div>;
}
