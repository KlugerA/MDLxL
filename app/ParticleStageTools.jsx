import React,{useRef,useState} from 'react';
export default function ParticleStageTools({snapshot,tool,emitter,begin,change,finish,cancel}) {
  const drag=useRef(null),[pinned,setPinned]=useState(null);
  if(!snapshot||!emitter)return null;
  const {width,height,guide}=snapshot,sample=pinned||snapshot.samples[Math.floor(snapshot.samples.length/2)];
  const fieldValue=field=>typeof emitter[field]==='number'?emitter[field]:0;
  function start(event,field,value,pixels=100) {
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();
    drag.current={field,x:event.clientX,y:event.clientY,value,pixels};
    if(sample)setPinned(structuredClone(sample));begin(field);
  }
  function move(event) {
    const d=drag.current;if(!d)return;
    const dx=event.clientX-d.x,dy=event.clientY-d.y;
    if(!dx&&!dy)return;
    const next=d.field==='ParticleScaling'?(d.value||1)*Math.exp((dx-dy)/100):d.value+(dx-dy)/Math.max(1,d.pixels)*Math.max(10,Math.abs(d.value));
    change(Math.max(0,next));
  }
  function end(){if(drag.current){drag.current=null;setPinned(null);finish();}}
  const handle=(point,field,value,label)=><g role="slider" tabIndex={0} aria-label={label} aria-valuenow={value} onPointerDown={event=>start(event,field,value)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null;setPinned(null);cancel();}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();drag.current=null;setPinned(null);cancel();}if(['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();begin(field);change(Math.max(0,value+(event.key==='ArrowRight'?1:-1)));finish();}}}><circle cx={point[0]} cy={point[1]} r="7"/><title>{label}</title></g>;
  return <svg className="pe-stage-tools" viewBox={'0 0 '+width+' '+height} aria-label="Particle stage handles">
    {(tool==='Basics'||tool==='Life')&&sample&&<g className="pe-size-proxy"><polygon points={[sample.points[0],sample.points[1],sample.points[3],sample.points[2]].map(p=>p.slice(0,2).join(',')).join(' ')}/>{handle(sample.points[2],'ParticleScaling',Math.max(...emitter.ParticleScaling),'Resize particle')}<text x={sample.points[0][0]} y={sample.points[0][1]-8}>{pinned?'Pinned sample':'Size'}</text></g>}
    {tool==='Shape'&&guide&&<g><polygon points={guide.area.map(p=>p.slice(0,2).join(',')).join(' ')}/>{handle(guide.area[1],'Width',fieldValue('Width'),'Spawn width')}{handle(guide.area[3],'Length',fieldValue('Length'),'Spawn length')}<line x1={guide.origin[0]} y1={guide.origin[1]} x2={guide.aim[0]} y2={guide.aim[1]}/><path d={'M '+guide.aim.slice(0,2).join(' ')+' L '+guide.origin.slice(0,2).join(' ')+' L '+guide.spread.slice(0,2).join(' ')}/>{handle(guide.spread,'Latitude',fieldValue('Latitude'),'Spread')}</g>}
  </svg>;
}
