import React,{Suspense,lazy,useMemo,useRef,useState} from 'react';
import {placeParticleRecipe} from '../src/particle-recipes.js';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
export default function ParticlePlacementStage({doc,recipe,placement,onPosition,textureAssets,preferences,teamColor,onError}){
 const [snapshot,setSnapshot]=useState(null),[surface,setSurface]=useState(false),[time,setTime]=useState(0),[playing,setPlaying]=useState(true),drag=useRef(null);
 const graph=useMemo(()=>{
  try{if(!doc.model.Sequences[placement.sequence])throw Error('Choose a target animation before placing this effect.');const model=structuredClone(doc.model),sourceInterval=Array.from(recipe.native.Sequences[recipe.defaultSequence||0].Interval),targetInterval=Array.from(model.Sequences[placement.sequence].Interval);
   const inserted=placeParticleRecipe(model,recipe,{parent:placement.parent===''?null:Number(placement.parent),sourceInterval,targetInterval,fit:placement.fit,motion:placement.motion});
   return {model,...inserted,interval:targetInterval};
  }catch(error){return {error:error.message};}
 },[doc,doc.revision,recipe,placement.parent,placement.sequence,placement.fit,placement.motion]);
 React.useEffect(()=>{onError?.(graph.error||'');if(graph.interval)setTime(graph.interval[0]+Math.min(800,(graph.interval[1]-graph.interval[0])/2));},[graph]);
 if(graph.error)return <div className="pe-placement-error" role="status">{graph.error}</div>;
 const anchor=graph.model.Helpers.find(n=>n.ObjectId===graph.anchorId);
 anchor.Translation={LineType:0,GlobalSeqId:null,Keys:[{Frame:graph.interval[0],Vector:new Float32Array(placement.position)}]};
 const stop=()=>{drag.current=null;};
 return <>
 <Suspense fallback={<span>Preparing placement…</span>}><GamePreview presentation="preview" model={graph.model} particleAuthoring particleLiveModel={graph.model} particleLiveRevision={placement.position.join(':')} particleLiveField="Translation" particleSelectedId={graph.ids[0]} particleAnchorId={graph.anchorId} onParticleStage={setSnapshot} onParticleSurfacePlace={surface?point=>{onPosition(point);setSurface(false);}:undefined} textureAssets={textureAssets} preferences={preferences} teamColor={teamColor} sequenceIndex={placement.sequence} time={time} onTimeChange={setTime} playing={playing} playbackSpeed={50} showParticles showGrid mode="textured" view="perspective" overlays={{bones:false,nodes:false,particles:false,attachments:false}}/></Suspense>
 {snapshot?.anchor&&<svg className="pe-stage-tools" viewBox={'0 0 '+snapshot.width+' '+snapshot.height} aria-label="Placement ghost"><g role="slider" tabIndex={0} aria-label="Move effect anchor" onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,position:[...placement.position],basis:structuredClone(snapshot.anchor)};}} onPointerMove={e=>{const d=drag.current;if(d)onPosition(d.position.map((v,i)=>v+(e.clientX-d.x)*d.basis.dx[i]+(e.clientY-d.y)*d.basis.dy[i]));}} onPointerUp={stop} onPointerCancel={()=>{if(drag.current)onPosition(drag.current.position);stop();}} onKeyDown={e=>{if(e.key==='Escape'&&drag.current){e.stopPropagation();onPosition(drag.current.position);stop();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();onPosition(placement.position.map((v,i)=>v+(e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0)*snapshot.anchor.dx[i]+(e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0)*snapshot.anchor.dy[i]));}}}><circle cx={snapshot.anchor.point[0]} cy={snapshot.anchor.point[1]} r="10"/><text x={snapshot.anchor.point[0]+14} y={snapshot.anchor.point[1]-12}>Placement ghost</text></g></svg>}
 <div className="pe-placement-overlay"><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause ghost':'Play ghost'}</button><button aria-pressed={surface} onClick={()=>setSurface(v=>!v)}>{surface?'Double-click a surface':'Snap to surface'}</button></div>
 </>;
}
