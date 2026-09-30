import {sampleTrack} from './animation.js';
/** Choose a useful inspection time from authored activity, without forcing visibility or rate. */
export function activeParticleSample(model){
 let chosen={sequence:0,time:model.Sequences?.[0]?.Interval?.[0]||0,score:-1};
 for(const [sequence,clip]of (model.Sequences||[]).entries()){
  const [start,end]=clip.Interval;if(!(end>start))continue;const candidates=new Set(Array.from({length:8},(_,i)=>start+(end-start)*(i+1)/9));
  for(const p of model.ParticleEmitters2||[])if(p.Squirt)for(const key of p.EmissionRate?.Keys||[])if(key.Vector[0]>0&&key.Frame>=start&&key.Frame<end)candidates.add(Math.min(end,key.Frame+Math.min(120,p.LifeSpan*500)));
  for(const time of candidates){let score=0;
   for(const p of model.ParticleEmitters2||[]){const at=(field,atTime=time)=>{const n=sampleTrack(p[field],atTime,{interval:clip.Interval,globalSequences:model.GlobalSequences,globalTime:atTime,fallback:field==='Visibility'?1:0});return Number(n?.[0]??n);};
    if(p.Squirt&&p.EmissionRate?.Keys){const duration=model.GlobalSequences[p.EmissionRate.GlobalSeqId],phase=duration>0?time%duration:time;for(const key of p.EmissionRate.Keys)if(phase>=key.Frame&&phase-key.Frame<p.LifeSpan*1000&&at('Visibility',key.Frame)>0)score+=Math.max(0,key.Vector[0]);}
    else score+=Math.max(0,at('EmissionRate'))*Math.max(0,p.LifeSpan)*(at('Visibility')>0?1:0);
   }
   for(const r of model.RibbonEmitters||[]){const n=sampleTrack(r.Visibility,time,{interval:clip.Interval,globalSequences:model.GlobalSequences,globalTime:time,fallback:0});if(Number(n?.[0]??n)>0)score+=Math.max(0,r.EmissionRate*r.LifeSpan);}
   if(score>chosen.score)chosen={sequence,time,score};
  }
 }
 return chosen;
}
