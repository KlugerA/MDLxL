import { sampleTrack } from './animation.js';

const json = value => JSON.stringify(value,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
const local = t => t.GlobalSeqId == null || t.GlobalSeqId === -1 || t.GlobalSeqId === 0xffffffff;
const distance = (a,b) => Math.max(...Array.from(a,(v,i)=>Math.abs(v-b[i])));
// The pinned Hive checker calls an interior key unused when every component
// differs from BOTH neighbors by less than .001. Controls still need checking.
function redundant(keys,i) {
  const a=keys[i-1]?.Vector,b=keys[i]?.Vector,c=keys[i+1]?.Vector;
  return a?.length && a.length===b?.length && a.length===c?.length &&
    Math.max(distance(a,b),distance(a,c)) < .001;
}
function safeCurve(baseline,candidate,property,interval,lo,hi) {
  const rotation=property==='Rotation',keys=baseline.Keys.filter(k=>k.Frame>=lo&&k.Frame<=hi);
  const width=keys[0]?.Vector?.length;
  if(![0,1,2,3].includes(baseline.LineType)||![1,3,4].includes(width))return false;
  const parts=['Vector',...(baseline.LineType>=2?['InTan','OutTan']:[])];
  if(keys.some(k=>parts.some(p=>k[p]?.length!==width||!Array.from(k[p]).every(Number.isFinite)||
    rotation&&Math.abs(Math.hypot(...k[p])-1)>1e-5)))return false;
  const options={interval,fallback:new Array(width).fill(0),quaternion:rotation};
  for(let i=0;i<keys.length;i++) {
    const a=keys[i].Frame,b=keys[i+1]?.Frame??a;
    for(let j=0;j<=32;j++){
      const frame=a+(b-a)*j/32;
      if(distance(sampleTrack(baseline,frame,options),sampleTrack(candidate,frame,options))>=.001)return false;
    }
  }
  return true;
}

/** One owner per track/domain. Re-evaluate neighbors after each removal, but
 * always compare the resulting curve with the original evidence. */
export function redundantTrackProposals(model,entries) {
  const out=[];
  for(const {track,path}of entries){
    const global=!local(track),duration=model.GlobalSequences[track.GlobalSeqId];
    const domains=global?(duration>0?[{interval:[0,duration],sequence:0,global:track.GlobalSeqId}]:[]):
      model.Sequences.map((s,sequence)=>({interval:Array.from(s.Interval),sequence}));
    for(const domain of domains){
      const [lo,hi]=domain.interval,keys=track.Keys.filter(k=>k.Frame>=lo&&k.Frame<=hi);
      const noticed=keys.filter((_,i)=>i>0&&i<keys.length-1&&redundant(keys,i)).map(k=>k.Frame);
      if(!noticed.length)continue;
      const overlaps=!global&&model.Sequences.some((s,i)=>i!==domain.sequence&&s.Interval[0]<=hi&&s.Interval[1]>=lo);
      const baseline={...structuredClone(track),GlobalSeqId:null,Keys:structuredClone(keys)},candidate=structuredClone(baseline),frames=[];
      if(!overlaps&&keys.every((k,i)=>!i||k.Frame>keys[i-1].Frame)){
        for(let i=1;i<candidate.Keys.length-1;){
          if(!redundant(candidate.Keys,i)){i++;continue;}
          const a=candidate.Keys[i-1],k=candidate.Keys[i],b=candidate.Keys[i+1];candidate.Keys.splice(i,1);
          if(safeCurve(baseline,candidate,path.at(-1),domain.interval,a.Frame,b.Frame)){
            frames.push(k.Frame);i=Math.max(1,i-1);
          }else{candidate.Keys.splice(i,0,k);i++;}
        }
      }
      const name=global?`Global sequence ${domain.global+1}`:model.Sequences[domain.sequence].Name;
      const remaining=noticed.filter(f=>!frames.includes(f));
      out.push({id:`redundant:${path.join('.')}:${global?'global'+domain.global:domain.sequence}`,kind:'redundantTracks',path,
        sequence:domain.sequence,frame:global?(model.Sequences[0]?.Interval[0]||0):noticed[0],globalSequence:global?domain.global:null,
        frames,noticed,remaining,signature:json([track,domain.interval]),...(frames.length?{}:{inspectionOnly:true}),
        label:`${name}: ${frames.length||noticed.length} redundant ${path.at(-1)} key${(frames.length||noticed.length)===1?'':'s'}`,
        detail:frames.length?`Remove ${frames.length} Hive-redundant keys after checking the surrounding curve against the original. ${remaining.length?`${remaining.length} other notices need manual review.`:'Keep the first and last keys and every other animation.'}`:
          'Hive flags similar values, but overlapping animations, invalid controls or the intervening curve prevent this removal. Review manually.'});
    }
  }
  return out;
}

export function applyRedundantTrack(model,fix){let t=model;for(const p of fix.path)t=t[p];const frames=new Set(fix.frames);t.Keys=t.Keys.filter(k=>!frames.has(k.Frame));}
