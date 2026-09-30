import React,{useEffect,useRef,useState} from 'react';
import {textureFromAsset} from './Viewport.jsx';
import {particleBindings,particleSliderDomain,particleValue,primaryParticleFields} from '../src/particle-bindings.js';
import {movementFreeScaleValues} from './movement-overlay.js';
const stages=['Young','Middle','End'];
const colorHex=rgb=>'#'+Array.from(rgb||[1,1,1],v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
export function ParticleSlider({label,field,value,begin,change,finish,cancel,stage,disabled=false,min,max,step='any'}) {
  const down=useRef(false),domain=particleSliderDomain(field,value);
  const start=()=>{if(!down.current){down.current=true;begin(field,stage);}};
  const end=()=>{if(down.current){down.current=false;finish();}};
  return <label className="pe-slider"><span>{label||particleBindings[field]?.label||field}</span><input type="range" aria-label={label||particleBindings[field]?.label||field} title={particleBindings[field]?.units} disabled={disabled} min={min??domain[0]} max={max??domain[1]} step={step} value={Number.isFinite(value)?value:0} onPointerDown={e=>{start();e.currentTarget.setPointerCapture(e.pointerId);}} onChange={e=>{start();change(Number(e.target.value));}} onPointerUp={end} onPointerCancel={()=>{down.current=false;cancel();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();down.current=false;cancel();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))start();}} onKeyUp={end} onBlur={end}/></label>;
}
export function ParticleSample({emitter,asset,stage=1,begin,change,finish,cancel,selected,onSelect}) {
  const canvas=useRef(null),drag=useRef(null),colorGesture=useRef(false),[ready,setReady]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{
    let cancelled=false;setReady(false);
    if(!asset)return;
    textureFromAsset(asset).then(texture=>{
      if(cancelled){texture.dispose();return;}
      const target=canvas.current,ctx=target.getContext('2d'),source=document.createElement('canvas'),image=texture.image;
      source.width=image.width;source.height=image.height;
      if(image.data)source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);
      else source.getContext('2d').drawImage(image,0,0);
      ctx.clearRect(0,0,100,100);
      const size=Math.max(5,Math.min(90,(emitter.ParticleScaling?.[stage]||0)*3)),colors=emitter.SegmentColor?.[stage]||[1,1,1],alpha=(emitter.Alpha?.[stage]??255)/255;
      const columns=Math.max(1,emitter.Columns||1),rows=Math.max(1,emitter.Rows||1),cell=stage===2?emitter.DecayUVAnim?.[1]||0:emitter.LifeSpanUVAnim?.[stage===1?1:0]||0;
      ctx.drawImage(source,(cell%columns)*source.width/columns,Math.floor(cell/columns)*source.height/rows,source.width/columns,source.height/rows,(100-size)/2,(100-size)/2,size,size);
      const pixels=ctx.getImageData(0,0,100,100);
      for(let i=0;i<pixels.data.length;i+=4){for(let k=0;k<3;k++)pixels.data[i+k]*=colors[k];pixels.data[i+3]*=alpha;}
      ctx.putImageData(pixels,0,0);texture.dispose();setReady(true);
    }).catch(()=>setReady(false));return()=>{cancelled=true;};
  },[asset,emitter.ParticleScaling?.[stage],emitter.Alpha?.[stage],...emitter.SegmentColor?.[stage]||[],emitter.Rows,emitter.Columns,...emitter.LifeSpanUVAnim||[],...emitter.DecayUVAnim||[]]);
  const startColor=()=>{if(!colorGesture.current){colorGesture.current=true;begin('SegmentColor',stage);}};
  const endColor=()=>{if(colorGesture.current){colorGesture.current=false;finish();}};
  return <div className={'pe-life-sample'+(selected?' selected':'')}>
    <button className="pe-life-picture" aria-label={'Resize '+stages[stage]+' particle'} onClick={()=>onSelect?.(stage)} onPointerDown={e=>{e.preventDefault();e.currentTarget.focus();onSelect?.(stage);drag.current={x:e.clientX,y:e.clientY,value:emitter.ParticleScaling?.[stage]||0};begin('ParticleScaling',stage);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=drag.current;if(d){const dx=e.clientX-d.x,dy=e.clientY-d.y;if(dx||dy)change((d.value||1)*movementFreeScaleValues(dx,dy)[0]);}}} onPointerUp={()=>{if(drag.current){drag.current=null;finish();}}} onPointerCancel={()=>{drag.current=null;cancel();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();drag.current=null;cancel();}if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();begin('ParticleScaling',stage);change(Math.max(0,(emitter.ParticleScaling?.[stage]||0)+(e.key==='ArrowRight'?1:-1)));finish();}}}><canvas width="100" height="100" ref={canvas}/>{!ready&&<span>Picture unavailable</span>}<i aria-hidden="true">↔</i></button>
    <span>{stages[stage]}</span>
    <input aria-label={stages[stage]+' color'} type="color" value={colorHex(emitter.SegmentColor?.[stage])} onPointerDown={startColor} onChange={e=>{startColor();change([1,3,5].map(i=>parseInt(e.target.value.slice(i,i+2),16)/255));}} onBlur={endColor} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();colorGesture.current=false;cancel();}}}/>
    <ParticleSlider label={stages[stage]+' opacity'} field="Alpha" stage={stage} value={emitter.Alpha?.[stage]??255} min={0} max={255} step={1} {...{change,finish,cancel}} begin={(field,index)=>{if([2,3,4].includes(emitter.FilterMode))setNotice(emitter.FilterMode===4?'Alpha Key uses a cutoff.':'This blend look uses opacity as a cutoff.');begin(field,index);}}/>
    {notice&&<button className="pe-sample-note" onClick={()=>setNotice('')}>{notice} ×</button>}
  </div>;
}
export default function ParticleCluelessControls({model,emitter,frame,sequence,tool,scope,setScope,asset,update,begin,change,finish,cancel,lifeStage=1,setLifeStage}) {
  const options={frame,interval:model.Sequences[sequence]?.Interval,globalSequences:model.GlobalSequences};
  const slider=field=><ParticleSlider key={field} field={field} label={field==='EmissionRate'&&emitter.Squirt?'Burst amount':undefined} value={particleValue(emitter,field,options)} {...{begin,change,finish,cancel}}/>;
  const animated=['Rotation',...primaryParticleFields,'Width','Length','Variation','Visibility'].some(field=>emitter[field]?.Keys);
  return <div className="pe-clueless-controls">
    {animated&&<label className="pe-scope">Edit<select aria-label="Animated edit scope" value={scope} onChange={e=>{cancel();setScope(e.target.value);}}><option value="key">This key</option><option value="track">{tool==='Shape'?'Whole track · offset / rotate':'Whole track · offset'}</option></select></label>}
    {tool==='Basics'&&primaryParticleFields.map(slider)}
    {tool==='Shape'&&<>{['Width','Length','Latitude','Variation','TailLength'].map(slider)}{[0,1,2].map(axis=><ParticleSlider key={'aim'+axis} label={'Aim '+['X','Y','Z'][axis]} field="Rotation" stage={{axis}} value={particleValue(emitter,'Rotation',{...options,axis})} {...{begin,change,finish,cancel}}/>)}</>}
    {tool==='Life'&&<><div className="pe-life-strip">{[0,1,2].map(index=><ParticleSample key={index} stage={index} selected={lifeStage===index} onSelect={setLifeStage} {...{emitter,asset,begin,change,finish,cancel}}/>)}</div><div className="pe-life-marker">{slider('Time')}</div>{slider('LifeSpan')}<ParticleSlider label={stages[lifeStage]+' size'} field="ParticleScaling" stage={lifeStage} value={emitter.ParticleScaling?.[lifeStage]||0} {...{begin,change,finish,cancel}}/></>}
    {tool==='Picture'&&<><ParticleSample {...{emitter,asset,begin,change,finish,cancel}} stage={1} selected/><label>Picture<select aria-label="Picture" value={emitter.TextureID??''} onChange={e=>update('TextureID',Number(e.target.value))}>{model.Textures.map((texture,i)=><option key={i} value={i}>{texture.ReplaceableId?'Team picture':'Picture '+(i+1)}</option>)}</select></label><label>Blend look<select aria-label="Blend look" value={emitter.FilterMode} onChange={e=>update('FilterMode',Number(e.target.value))}>{['Blend','Additive','Modulate','Modulate 2×','Alpha Key'].map((label,i)=><option key={i} value={i}>{label}</option>)}</select></label><label>Draw as<select aria-label="Draw as" value={emitter.FrameFlags} onChange={e=>update('FrameFlags',Number(e.target.value))}><option value={1}>Sprites</option><option value={2}>Streaks</option><option value={3}>Both</option></select></label></>}
    {tool==='Timing'&&<>{slider('Visibility')}{slider('EmissionRate')}{slider('LifeSpan')}<button onClick={()=>update('Flags',emitter.Flags^524288)} aria-pressed={!!(emitter.Flags&524288)}>{emitter.Flags&524288?'Carry particles':'Leave behind'}</button></>}
  </div>;
}
