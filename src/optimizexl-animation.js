import { sampleTrack } from './animation.js';

const same=(a,b)=>a?.length===b?.length&&Array.from(a||[]).every((v,i)=>v===b[i]);
const zero=a=>a&&Array.from(a).every(v=>v===0);
const error=(a,b,rotation)=>{
 if(!rotation)return Math.hypot(...a.map((v,i)=>v-b[i]));
 const dot=Math.abs(a.reduce((n,v,i)=>n+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)||1));
 return 2*Math.acos(Math.min(1,dot))*180/Math.PI;
};
function constantSegment(t,a,b,rotation){
 if(!same(a.Vector,b.Vector))return false;
 if(t.LineType<2)return true;
 return rotation||t.LineType===3?same(a.OutTan,a.Vector)&&same(b.InTan,b.Vector):zero(a.OutTan)&&zero(b.InTan);
}

/** Reduce within each sequence, retaining its first/last authored keys and
 * spline controls. Positive tolerances are checked against the original curve,
 * including the interior of every original segment, never just its key values. */
export function reduceAnimationTrack(model,track,property,tolerance,onRemove){
 if(track.GlobalSeqId!=null&&track.GlobalSeqId!==-1&&track.GlobalSeqId!==0xffffffff)return 0;
 if(![0,1,2,3].includes(track.LineType)||track.Keys.some((k,i,a)=>!Number.isInteger(k.Frame)||i&&k.Frame<=a[i-1].Frame))return 0;
 const rotation=property==='Rotation',transform=['Translation','Rotation','Scaling'].includes(property),width=rotation?4:transform?3:track.Keys[0]?.Vector?.length;
 if(![1,3,4].includes(width))return 0;
 if(track.Keys.some(k=>k.Vector?.length!==width||Array.from(k.Vector).some(v=>!Number.isFinite(v))||track.LineType>=2&&['InTan','OutTan'].some(p=>k[p]?.length!==width||Array.from(k[p]).some(v=>!Number.isFinite(v)))))return 0;
 const baseline=structuredClone(track),fallback=rotation?[0,0,0,1]:property==='Scaling'?[1,1,1]:new Array(width).fill(0);
 // Non-unit quaternion interpolation differs between renderers. Exact constant
 // removal remains valid; approximate reduction requires normalized controls.
 const canApproximate=transform&&tolerance>0&&track.LineType!==0&&(!rotation||track.Keys.every(k=>['Vector',...(track.LineType>=2?['InTan','OutTan']:[])].every(p=>Math.abs(Math.hypot(...k[p])-1)<1e-5)));
 let removed=0;
 for(const [sequence,s]of model.Sequences.entries()){
  const [lo,hi]=s.Interval;
  if(model.Sequences.some((other,i)=>i!==sequence&&other.Interval[0]<=hi&&other.Interval[1]>=lo))continue;
  const original=baseline.Keys.filter(k=>k.Frame>=lo&&k.Frame<=hi);
  const options={interval:s.Interval,fallback,quaternion:rotation};
  const sample=(t,f)=>Array.from(sampleTrack(t,f,options));
  const probes=[];
  if(canApproximate)for(let i=0;i<original.length;i++){
   const start=original[i].Frame,end=original[i+1]?.Frame??start;
   for(let j=0;j<(end>start?32:1);j++){const frame=start+(end-start)*j/32;probes.push({frame,value:sample(baseline,frame)});}
  }
  for(let i=1;i<track.Keys.length-1;){
   const a=track.Keys[i-1],k=track.Keys[i],b=track.Keys[i+1];
   if(a.Frame<lo||b.Frame>hi||k.Frame<=lo||k.Frame>=hi){i++;continue;}
   const exact=track.LineType===0?same(a.Vector,k.Vector):constantSegment(track,a,k,rotation)&&constantSegment(track,k,b,rotation);
   if(!exact&&!canApproximate){i++;continue;}
   track.Keys.splice(i,1);
   const valid=exact||probes.every(p=>p.frame<a.Frame||p.frame>b.Frame||error(p.value,sample(track,p.frame),rotation)<=tolerance*.95);
   if(valid){removed++;onRemove({sequence,frame:k.Frame,from:a.Frame,to:b.Frame});}
   else{track.Keys.splice(i,0,k);i++;}
  }
 }
 return removed;
}
