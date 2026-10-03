import { ModelRenderer } from 'war3-model';

const json=x=>JSON.stringify(x,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
const at=(m,path)=>path.reduce((v,k)=>v[k],m);
const distance=(a,b)=>Math.max(...Array.from(a,(v,i)=>Math.abs(v-b[i])));
const redundant=(keys,i)=>i>0&&i<keys.length-1&&
  Math.max(distance(keys[i-1].Vector,keys[i].Vector),distance(keys[i-1].Vector,keys[i+1].Vector))<.001;
const BUDGET=.001,FIT=.0009;

// Encode a straight segment in the ORIGINAL interpolation type. Only its
// outgoing/incoming controls change; exterior handles retain their ownership.
function straight(a,b,type,rotation){
  if(rotation){a.OutTan=new Float32Array(a.Vector);b.InTan=new Float32Array(b.Vector);}
  else if(type===2){a.OutTan=Float32Array.from(a.Vector,(v,i)=>b.Vector[i]-v);b.InTan=new Float32Array(a.OutTan);}
  else{a.OutTan=Float32Array.from(a.Vector,(v,i)=>v+(b.Vector[i]-v)/3);b.InTan=Float32Array.from(a.Vector,(v,i)=>v+2*(b.Vector[i]-v)/3);}
}

// Separate representation repair, offered only after the existing deletion
// owner has no supported removals left on this track. Resample only the spans
// surrounding remaining notices, never unrelated fast curves or animations.
export function splineTrackProposals(model,entries,existing){
  const out=[];let renderer;
  for(const {track,path}of entries){
    const property=path.at(-1),rotation=property==='Rotation',width=rotation?4:3;
    if(!['Bones','Helpers'].includes(path[0])||!['Translation','Rotation','Scaling'].includes(property)||
      ![2,3].includes(track.LineType)||!(track.GlobalSeqId==null||track.GlobalSeqId===-1||track.GlobalSeqId===0xffffffff))continue;
    const findings=existing.filter(f=>f.kind==='redundantTracks'&&f.path.join('.')===path.join('.'));
    if(!findings.some(f=>f.remaining.length)||existing.some(f=>f.path?.join('.')===path.join('.')&&!f.inspectionOnly))continue;
    const spans=[];let valid=true;
    for(const f of findings){
      const interval=Array.from(model.Sequences[f.sequence].Interval),[lo,hi]=interval;
      if(model.Sequences.some((s,i)=>i!==f.sequence&&s.Interval[0]<=hi&&s.Interval[1]>=lo)){valid=false;break;}
      const keys=track.Keys.filter(k=>k.Frame>=lo&&k.Frame<=hi);
      for(const frame of f.remaining){const i=keys.findIndex(k=>k.Frame===frame);if(i<1||i>=keys.length-1){valid=false;break;}
        const a=keys[i-1].Frame,b=keys[i+1].Frame,last=spans.at(-1);
        if(last&&last.sequence===f.sequence&&a<=last.hi)last.hi=Math.max(last.hi,b);
        else spans.push({sequence:f.sequence,lo:a,hi:b});
      }
    }
    if(!valid||track.Keys.some((k,i)=>!Number.isInteger(k.Frame)||k.Frame<0||i&&k.Frame<=track.Keys[i-1].Frame))continue;
    const affected=track.Keys.filter(k=>spans.some(s=>k.Frame>=s.lo&&k.Frame<=s.hi));
    if(affected.some(k=>['Vector','InTan','OutTan'].some(p=>k[p]?.length!==width||!Array.from(k[p]).every(Number.isFinite)||
      rotation&&Math.abs(Math.hypot(...k[p])-1)>1e-5)))continue;
    renderer ||= new ModelRenderer(structuredClone(model));
    const source={...track,GlobalSeqId:null},candidate=structuredClone(track);
    const sample=(t,frame)=>{renderer.setFrame(frame);const local={...t,GlobalSeqId:null};return new Float32Array(rotation?
      renderer.interp.quat(new Float32Array(4),local):renderer.interp.vec3(new Float32Array(3),local));};
    const matches=(keys,lo,hi)=>{
      const t={...candidate,Keys:keys};
      // Include every integer millisecond and quarters. Finite native curve
      // evidence, not an analytic bound on all times or world-space motion.
      for(let frame=lo;frame<=hi;frame+=.25)if(distance(sample(source,frame),sample(t,frame))>=BUDGET)return false;
      return distance(sample(source,hi),sample(t,hi))<BUDGET;
    };
    for(const span of spans){
      const keys=track.Keys.filter(k=>k.Frame>=span.lo&&k.Frame<=span.hi);
      const baked=[structuredClone(keys[0])];
      function segment(a,b){
        const pair=[{Frame:a,Vector:sample(source,a)},{Frame:b,Vector:sample(source,b)}];straight(...pair,track.LineType,rotation);
        const t={...candidate,Keys:pair};let error=0;
        for(let j=1;j<16;j++)error=Math.max(error,distance(sample(source,a+(b-a)*j/16),sample(t,a+(b-a)*j/16)));
        if(error<FIT){straight(baked.at(-1),pair[1],track.LineType,rotation);baked.push(pair[1]);return true;}
        const mid=Math.floor((a+b)/2);
        return mid>a&&mid<b&&segment(a,mid)&&segment(mid,b);
      }
      for(let i=1;i<keys.length&&valid;i++)valid=segment(keys[i-1].Frame,keys[i].Frame);
      if(!valid||!matches(baked,span.lo,span.hi)){valid=false;break;}
      for(let i=1;i<baked.length-1;){
        if(!redundant(baked,i)){i++;continue;}
        const trial=structuredClone(baked),a=trial[i-1].Frame,b=trial[i+1].Frame;trial.splice(i,1);
        straight(trial[i-1],trial[i],track.LineType,rotation);
        if(matches(trial,a,b)){baked.splice(0,baked.length,...trial);i=Math.max(1,i-1);}else i++;
      }
      if(baked.some((_,i)=>redundant(baked,i))){valid=false;break;}
      // Reuse authored anchor values and exterior handles byte-for-byte.
      baked[0].Vector=new Float32Array(keys[0].Vector);baked[0].InTan=new Float32Array(keys[0].InTan);
      baked.at(-1).Vector=new Float32Array(keys.at(-1).Vector);baked.at(-1).OutTan=new Float32Array(keys.at(-1).OutTan);
      if(!matches(baked,span.lo,span.hi)){valid=false;break;}
      candidate.Keys=candidate.Keys.filter(k=>k.Frame<span.lo||k.Frame>span.hi).concat(baked).sort((a,b)=>a.Frame-b.Frame);
    }
    if(!valid)continue;
    // Original notices must be resolved without introducing new value notices
    // at the joins. The normal checker is still rerun after approval.
    if(findings.some(f=>{const [lo,hi]=model.Sequences[f.sequence].Interval;
      const keys=candidate.Keys.filter(k=>k.Frame>=lo&&k.Frame<=hi);return keys.some((_,i)=>redundant(keys,i));}))continue;
    const first=findings[0];
    out.push({id:`spline:${path.join('.')}`,kind:'splineResample',path,sequence:first.sequence,frame:first.frame,spans,
      signature:json([track,model.Sequences.map(s=>Array.from(s.Interval))]),noticed:findings.flatMap(f=>f.remaining),track:candidate,
      label:`${model[path[0]][path[1]].Name}: preserve curve and clear spline notices`,
      detail:`Resample ${spans.length} affected ${property} span${spans.length===1?'':'s'} using native interpolation, then clear value-redundant keys within a ${BUDGET} component error budget checked at quarter-millisecond samples. Retain exterior handles, other spans and channels. This changes the curve representation and may increase file size.`});
  }
  return out;
}

export function applySplineTrack(model,fix){const owner=at(model,fix.path.slice(0,-1));owner[fix.path.at(-1)]=structuredClone(fix.track);}
