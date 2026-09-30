import {ParticleSlider} from './ParticleCluelessControls.jsx';
import {particleValue} from '../src/particle-bindings.js';
import React,{useRef,useState} from 'react';
import {particleSweepTimes} from '../src/particle-sweep.js';
export function ParticleSweepControls({interval,range,onRange,onWindow,demo,onDemo,context,emitter,options,begin,change,finish,cancel}){
 return <div className="pe-clueless-controls pe-sweep-controls">
  <label>Loop starts<input aria-label="Sweep loop start" type="range" min={interval[0]} max={interval[1]-1} value={range[0]} onChange={e=>onRange([Math.min(Number(e.target.value),range[1]-1),range[1]])}/></label>
  <label>Loop ends<input aria-label="Sweep loop end" type="range" min={interval[0]+1} max={interval[1]} value={range[1]} onChange={e=>onRange([range[0],Math.max(range[0]+1,Number(e.target.value))])}/></label>
  {(options.family==='RibbonEmitters'?['HeightAbove','HeightBelow','LifeSpan']:['ParticleScaling','LifeSpan','Latitude','TailLength']).map(field=><ParticleSlider key={field} field={field} value={particleValue(emitter,field,options)} {...{begin,change,finish,cancel}}/>)}
  <button onClick={onWindow} title="Replace emitting keys in this animation with the selected window">Emit during this window</button>
  {context==='Lab'&&options.family!=='RibbonEmitters'&&<button aria-pressed={demo} onClick={()=>onDemo(!demo)}>Demonstration sweep{demo?' · preview only':''}</button>}
  <small>Drag the marker along the existing path to inspect its timing.</small>
 </div>;
}
export function ParticleSweepOverlay({snapshot,frame,onTime}){
 const [choices,setChoices]=useState([]),drag=useRef(null),points=snapshot?.sweep;
 if(!points?.length)return null;
 const current=points.reduce((best,p)=>Math.abs(p.time-frame)<Math.abs(best.time-frame)?p:best,points[0]);
 const pick=e=>{const rect=e.currentTarget.ownerSVGElement?.getBoundingClientRect()||e.currentTarget.getBoundingClientRect(),x=(e.clientX-rect.left)*snapshot.width/rect.width,y=(e.clientY-rect.top)*snapshot.height/rect.height;
  const next=particleSweepTimes(points,x,y,drag.current?.time??frame);setChoices(next);if(next[0])onTime(Math.round(next[0].time));};
 return <><svg className="pe-stage-tools" viewBox={'0 0 '+snapshot.width+' '+snapshot.height} aria-label="Sweep path">
  <polyline points={points.map(p=>p.point.slice(0,2).join(',')).join(' ')}/>
  <polyline className="pe-sweep-hit" points={points.map(p=>p.point.slice(0,2).join(',')).join(' ')} onPointerDown={e=>{e.preventDefault();e.stopPropagation();drag.current={time:frame};e.currentTarget.setPointerCapture(e.pointerId);pick(e);}} onPointerMove={e=>{if(drag.current)pick(e);}} onPointerUp={()=>{drag.current=null;}}/>
  {points.filter((_,i)=>i%8===0).map(p=><g key={p.time}><circle cx={p.point[0]} cy={p.point[1]} r="3"/>{p.edges&&<line x1={p.edges[0][0]} y1={p.edges[0][1]} x2={p.edges[1][0]} y2={p.edges[1][1]}/>}</g>)}
  <g role="slider" tabIndex={0} aria-label="Sweep time" aria-valuenow={frame} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onTime(Math.round(Math.max(points[0].time,Math.min(points.at(-1).time,frame+(e.key==='ArrowRight'?10:-10)))));}}}><circle cx={current.point[0]} cy={current.point[1]} r="8"/></g>
 </svg>{choices.length>1&&<div className="pe-path-choices" aria-label="Times at path crossing">{choices.map(p=><button key={p.time} onClick={()=>{onTime(Math.round(p.time));setChoices([]);}}>{Math.round(p.time)}</button>)}</div>}</>;
}
