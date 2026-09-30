import React,{useEffect,useRef,useState} from 'react';
import {particleAimAngles,particleValue} from '../src/particle-bindings.js';
import {particleAxisMapping,particleSpreadAtPointer} from '../src/particle-handles.js';
import {movementDragAmount,movementFreeScaleValues} from './movement-overlay.js';
export default function ParticleStageTools({snapshot,tool,emitter,options,lifeStage=1,begin,change,finish,cancel,cancelVersion}) {
  const drag=useRef(null),[pinned,setPinned]=useState(null);
  useEffect(()=>{drag.current=null;setPinned(null);},[emitter?.ObjectId,tool,cancelVersion]);
  if(!snapshot||!emitter)return null;
  const {width,height,guide}=snapshot;
  const ribbon=options.family==='RibbonEmitters';
  const samples=snapshot.samples.filter(item=>item.owner===emitter.ObjectId);
  const real=samples.find(item=>item.age>=.2&&item.age<=.7)||samples[0];
  const proxy=real||guide&&{owner:emitter.ObjectId,points:[[-10,-10],[-10,10],[10,-10],[10,10]].map(p=>[guide.origin[0]+p[0],guide.origin[1]+p[1],guide.origin[2]])};
  const sample=pinned||proxy;
  const stage=tool==='Life'?lifeStage:undefined;
  const value=field=>particleValue(emitter,field,{...options,stage:field==='ParticleScaling'?stage:undefined});
  function start(event,field,reference,basis) {
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();
    drag.current={field,x:event.clientX,y:event.clientY,value:value(field),reference:structuredClone(reference),basis:structuredClone(basis),arc:structuredClone(guide?.spreadArc),angles:particleAimAngles(emitter,options),stage};
    if(sample)setPinned(structuredClone(sample));begin(field,field==='ParticleScaling'?stage:undefined);
  }
  function move(event) {
    const d=drag.current;if(!d)return;
    const dx=event.clientX-d.x,dy=event.clientY-d.y;
    if(dx===0&&dy===0)return;
    let next;
    if(d.field==='Rotation'){next=[d.angles[0]-dy,d.angles[1]+dx,d.angles[2]];}
    else if(d.field==='ParticleScaling')next=Math.max(0,(d.value||1)*movementFreeScaleValues(dx,dy)[0]);
    else if(d.field==='Latitude')next=particleSpreadAtPointer(d.arc,d.reference,dx,dy,d.value);
    else {if(!d.basis)return;next=Math.max(0,d.value+movementDragAmount(d.basis,dx,dy,'move'));}
    change(next);
  }
  function end(){if(drag.current){drag.current=null;setPinned(null);finish();}}
  function abort(){drag.current=null;setPinned(null);cancel();}
  const handle=(point,field,label,basis)=>point&&<g role="slider" tabIndex={0} aria-label={label} aria-valuenow={value(field)} onPointerDown={event=>start(event,field,point,basis)} onPointerMove={move} onPointerUp={end} onPointerCancel={abort} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();abort();}
    if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const delta=['ArrowRight','ArrowUp'].includes(event.key)?1:-1;begin(field,field==='ParticleScaling'?stage:undefined);change(field==='Rotation'?value(field)+delta:Math.max(0,value(field)+delta));finish();}
  }}><circle cx={point[0]} cy={point[1]} r="7"/><title>{label}</title></g>;
  return <svg className="pe-stage-tools" viewBox={'0 0 '+width+' '+height} aria-label="Particle stage handles">
    {!ribbon&&(tool==='Basics'||tool==='Life')&&sample&&<g className="pe-size-proxy"><polygon points={[sample.points[0],sample.points[1],sample.points[3],sample.points[2]].map(p=>p.slice(0,2).join(',')).join(' ')}/>{handle(sample.points[2],'ParticleScaling','Resize particle')}<text x={sample.points[0][0]} y={sample.points[0][1]-8}>{pinned?'Pinned sample':tool==='Life'?['Young','Middle','End'][lifeStage]:'Size'}</text></g>}
    {ribbon&&guide?.upper&&guide?.lower&&<g><line x1={guide.lower[0]} y1={guide.lower[1]} x2={guide.upper[0]} y2={guide.upper[1]}/>{handle(guide.upper,'HeightAbove','Ribbon upper edge',particleAxisMapping(guide.upper,guide.upperUnit))}{handle(guide.lower,'HeightBelow','Ribbon lower edge',particleAxisMapping(guide.lower,guide.lowerUnit))}</g>}
    {!ribbon&&tool==='Shape'&&guide?.area&&<g><polygon points={guide.area.map(p=>p.slice(0,2).join(',')).join(' ')}/>
      {handle(guide.widthHandle,'Width','Spawn width handle',particleAxisMapping(guide.widthHandle,guide.widthUnit))}
      {handle(guide.lengthHandle,'Length','Spawn length handle',particleAxisMapping(guide.lengthHandle,guide.lengthUnit))}
      <line x1={guide.origin[0]} y1={guide.origin[1]} x2={guide.aim[0]} y2={guide.aim[1]}/>
      <polyline points={guide.spreadArc.map(item=>item.point.slice(0,2).join(',')).join(' ')}/>
      <line x1={guide.origin[0]} y1={guide.origin[1]} x2={guide.spread[0]} y2={guide.spread[1]}/>
      {handle(guide.spread,'Latitude','Spread handle')}
      {handle(guide.aim,'Rotation','Aim emitter')}
    </g>}
  </svg>;
}
