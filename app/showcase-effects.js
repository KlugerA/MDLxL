import {sampleTrack} from '../src/animation.js';
const value=v=>typeof v==='number'?v:Number(v?.[0]||0);
const maxValue=track=>typeof track==='number'?track:Math.max(0,...(track?.Keys||[]).map(k=>value(k.Vector)));
// Only a finite visibility burst may extend beyond the motion. Continuous
// global decoration keeps its clock, but must not make an infinite recording.
export function loopEffectTiming(model,index,loops=1,speed=1,globalStart=0,definitions=new Map()){
 const sequence=model.Sequences?.[index];if(!sequence||!(speed>0))return {seconds:0,motionSeconds:0,emissionEnds:{}};
 const [start,end]=sequence.Interval,duration=end-start,motion=duration*loops/speed;
 let finish=motion;const emissionEnds={};
 const globalPeriod=track=>model.GlobalSequences?.[track?.GlobalSeqId]||0;
 const timeKeys=(track,horizon)=>{
  const period=globalPeriod(track),times=[];
  if(period){for(let cycle=Math.floor(globalStart/period);cycle*period<=globalStart+horizon;cycle++)for(const key of track.Keys||[]){const t=cycle*period+key.Frame-globalStart;if(t>=0&&t<=horizon)times.push(t);}}
  else for(let cycle=0;cycle<loops;cycle++)for(const key of track?.Keys||[]){if(key.Frame>=start&&key.Frame<=end)times.push((cycle*duration+key.Frame-start)/speed);}
  return times;
 };
 const sample=(track,t,fallback)=>sampleTrack(track,start+(t>=motion?duration:(t*speed)%duration),{interval:sequence.Interval,globalSequences:model.GlobalSequences,globalTime:globalStart+t,fallback});
 for(const emitter of [...(model.ParticleEmitters||[]),...(model.ParticleEmitters2||[]),...(model.RibbonEmitters||[])]){
  const life=maxValue(emitter.LifeSpan)*1000;if(!(life>0))continue;
  const period=globalPeriod(emitter.Visibility),keys=emitter.Visibility?.Keys||[];
  const finiteGlobal=period&&keys.some(k=>value(k.Vector)<=0)&&keys.some(k=>value(k.Vector)>0);
  const horizon=finiteGlobal?Math.max(motion,Math.ceil((globalStart+motion)/period)*period-globalStart):motion;
  const times=[...new Set([0,motion,horizon,...timeKeys(emitter.Visibility,horizon),...timeKeys(emitter.EmissionRate,horizon)])].filter(t=>t>=0&&t<=horizon).sort((a,b)=>a-b);
  const emitting=t=>sample(emitter.Visibility,t,1)>0&&sample(emitter.EmissionRate,t,0)>0;
  let last=-1;
  if(emitter.Squirt&&emitter.EmissionRate?.Keys){for(const t of timeKeys(emitter.EmissionRate,horizon))if(emitting(t))last=Math.max(last,t);}
  else for(let i=1;i<times.length;i++)if(emitting((times[i-1]+times[i])/2))last=times[i];
  // At the pose boundary, local emission ends while living particles keep aging.
  emissionEnds[emitter.ObjectId]=last;
  if(last>=0)finish=Math.max(finish,last+life);
 }
 for(const event of model.EventObjects||[]){
  const definition=definitions.get(event.Name);if(!(definition?.lifeSpanMs>0))continue;
  const globalId=event.GlobalSeqId??event.GlobalSequenceId,period=model.GlobalSequences?.[globalId];
  for(const frame of event.EventTrack||[]){
   if(period){const trigger=Math.floor((globalStart+motion-frame)/period)*period+frame-globalStart;if(trigger>=0&&trigger<=motion)finish=Math.max(finish,trigger+definition.lifeSpanMs);}
   else if(frame>=start&&frame<=end)finish=Math.max(finish,((loops-1)*duration+frame-start)/speed+definition.lifeSpanMs);
  }
 }
 // Leave one displayed frame after the final particle expires.
 const tail=finish>motion+1e-6;
 return {seconds:Math.max(.02,Math.ceil((finish+(tail?1000/30:0))/10-1e-8)/100),motionSeconds:motion/1000,emissionEnds};
}
export function timeShowcasePlaylist(model,rows,definitions){
 let start=0;
 return rows.map(row=>{
  if(!row.useDuration){start+=Number(row.seconds)||0;return row;}
  const timing=loopEffectTiming(model,row.sequence,row.durationLoops??1,row.speed>0?row.speed:1,start*1000,definitions);
  const extraTime=Math.max(0,Number(row.extraTime)||0),next={...row,...timing,extraTime,seconds:Math.round((timing.seconds+extraTime)*100)/100};
  start+=next.seconds;return next;
 });
}
