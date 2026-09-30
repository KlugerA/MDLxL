import React,{useRef} from 'react';
import {ParticleSlider} from './ParticleCluelessControls.jsx';
import {particleValue} from '../src/particle-bindings.js';
import {particleBurstTrack} from '../src/particle-sweep.js';
export default function ParticleTimingTool({emitter,options,begin,change,finish,cancel,update,patch,onSeek}){
 const edit=useRef(null),[start,end]=options.interval,global=Number.isInteger(emitter.EmissionRate?.GlobalSeqId)&&emitter.EmissionRate.GlobalSeqId>=0;
 const events=(emitter.EmissionRate?.Keys||[]).filter(k=>k.Frame>=start&&k.Frame<=end&&k.Vector[0]>0),single=emitter.Squirt&&!global&&events.length===1&&emitter.EmissionRate.LineType===0;
 const amount=particleValue(emitter,'EmissionRate',options);
 const place=()=>{try{const at=Math.max(start,Math.min(end-1,Math.round(options.frame)));patch({Squirt:true,EmissionRate:particleBurstTrack(emitter,options.interval,at,Math.max(1,amount))});onSeek?.(Math.min(end,at+120));}catch(error){patch(null,error.message);}};
 const slider=field=><ParticleSlider key={field} field={field} label={field==='EmissionRate'&&emitter.Squirt?'Burst amount':undefined} value={particleValue(emitter,field,options)} {...{begin,change,finish,cancel}}/>;
 return <><div className="pe-timing-mode"><button aria-pressed={!emitter.Squirt} onClick={()=>update('Squirt',false)}>Continuous</button><button aria-pressed={!!emitter.Squirt} onClick={()=>update('Squirt',true)}>Burst</button></div>{slider('EmissionRate')}{emitter.Squirt&&<><button onClick={place} title="Replace amount keys in this animation with one native burst">Place burst at playhead</button>{single&&<ParticleSlider label="Impact moment" field="EmissionRate" min={start} max={end-1} step={1} value={events[0].Frame} begin={()=>{edit.current={node:structuredClone(emitter),amount:events[0].Vector[0],interval:[...options.interval]};begin('EmissionRate',{raw:true});}} change={value=>{const d=edit.current;if(d){change(particleBurstTrack(d.node,d.interval,value,d.amount));onSeek?.(Math.min(end,value+120));}}} finish={()=>{edit.current=null;finish();}} cancel={()=>{edit.current=null;cancel();}}/>}</>}{slider('Visibility')}{slider('LifeSpan')}<button onClick={()=>update('Flags',emitter.Flags^524288)} aria-pressed={!!(emitter.Flags&524288)}>{emitter.Flags&524288?'Carry particles':'Leave behind'}</button></>;
}
