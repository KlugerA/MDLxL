import React,{useRef} from 'react';
/** The time strip is an authoring proxy; display clipping never rewrites imported values. */
export default function ParticleLifeMarker({value,begin,change,finish,cancel,onSelect}){
 const drag=useRef(null),strip=useRef(null);
 const end=()=>{if(drag.current){drag.current=null;finish();}};
 return <div className="pe-life-axis" ref={strip} aria-label="Particle age"><span>Young</span><span>End</span><button role="slider" aria-label="Middle changeover" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} style={{left:(Math.max(0,Math.min(1,value))*100)+'%'}} onPointerDown={e=>{e.preventDefault();e.currentTarget.focus();onSelect?.(1);begin('Time');drag.current={x:e.clientX,value,width:strip.current.getBoundingClientRect().width};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=drag.current;if(d&&e.clientX!==d.x)change(Math.max(0,Math.min(1,d.value+(e.clientX-d.x)/d.width)));}} onPointerUp={end} onPointerCancel={()=>{drag.current=null;cancel();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();drag.current=null;cancel();}else if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();begin('Time');change(e.key==='Home'?0:e.key==='End'?1:Math.max(0,Math.min(1,value+(e.key==='ArrowRight'?.01:-.01))));finish();}}}>◆<small>Middle</small></button></div>;
}
