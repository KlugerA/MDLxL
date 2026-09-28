import { resetPreviewEffects } from './warcraft-preview-adapter.js';

/** Advance effects in wall time while local pose and global tracks keep separate clocks. */
export function advanceShowcaseModel(native, model, sample, previous) {
  const index = Math.max(0,sample.sequenceIndex), sequence = model.Sequences[index];
  const reset = !previous || previous.revision !== sample.revision || sample.globalTime < previous.globalTime;
  const clocks = native.rendererData.globalSequencesFrames;
  const setClocks = time => { for (let i=0;i<(model.GlobalSequences?.length||0);i++) if(model.GlobalSequences[i]>0) clocks[i]=((time%model.GlobalSequences[i])+model.GlobalSequences[i])%model.GlobalSequences[i]; };
  const setFrame = frame => { native.rendererData.animation=index;native.rendererData.animationInfo=sequence;native.rendererData.frame=frame; };
  if(reset){native.setSequence(index);resetPreviewEffects(native);}else if(previous.segment!==sample.segment)native.setSequence(index);
  const elapsed = previous && sample.globalTime>=previous.globalTime ? sample.globalTime-previous.globalTime : 0;
  const fromLocal = reset || previous.segment!==sample.segment ? sample.localTime || 0 : previous.localTime || 0;
  const toLocal = sample.localTime || 0, [start,end] = sequence.Interval, duration=end-start;
  const update=(step,clipTime)=>{
    const restored=[];
    for(const controller of [native.particlesController,native.ribbonsController])for(const emitter of controller?.emitters||[]){
      const until=sample.emissionEnds?.[emitter.props.ObjectId];
      if(Number.isFinite(until)&&clipTime>until+1e-6){restored.push([emitter.props,emitter.props.EmissionRate]);emitter.props.EmissionRate=0;}
    }
    try{native.update(step);}finally{for(const [props,rate] of restored)props.EmissionRate=rate;}
  };
  let remaining=elapsed;
  while(remaining>1e-7){
    const step=Math.min(20,remaining), fraction=(elapsed-remaining+step)/elapsed;
    const local=fromLocal+(toLocal-fromLocal)*fraction;
    const frame=start+(!(sample.looping ?? !sequence.NonLooping) ? Math.min(duration,local) : duration>0 ? local%duration : 0);
    // Upstream update adds delta before evaluating nodes and effects. Offset only
    // its private local clock so effects age even at 0% animation speed.
    setFrame(frame-step);setClocks(sample.globalTime-remaining);
    update(step,(sample.clipTime||0)-remaining+step);remaining-=step;
  }
  setFrame(sample.sequenceIndex<0?start:sample.frame);setClocks(sample.globalTime);update(0,sample.clipTime||0);
  return sample;
}
