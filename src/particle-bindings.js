import { sampleTrack } from './animation.js';
const descriptions = {
  ParticleScaling: ['Size','float32[3]','world units',false,0,80,'appearance'],
  EmissionRate: ['Amount','float32','particles/second',true,0,150,'births'],
  Latitude: ['Spread','float32','degrees',true,0,180,'births'],
  Speed: ['Speed','float32','world units/second',true,0,300,'births'],
  LifeSpan: ['Lasts','float32','seconds',false,0.01,10,'history'],
  Gravity: ['Rise / Fall','float32','world units/second squared',true,-200,200,'births'],
  Width: ['Spawn width','float32','world units',true,0,100,'births'],
  Length: ['Spawn length','float32','world units',true,0,100,'births'],
  Variation: ['Speed variety','float32','fraction',true,0,1,'births'],
  TailLength: ['Streak length','float32','seconds of velocity',false,0,5,'appearance'],
  Time: ['Changeover','float32','fraction of particle age',false,0,1,'appearance'],
  Visibility: ['Emitting','float32','native visibility',true,0,1,'births'],
};
export const particleBindings = Object.fromEntries(Object.entries(descriptions).map(([field,[label,storage,units,animated,min,max,runtime]])=>[field,{field,label,storage,units,animated,suggested:[min,max],authoredDomain:'finite native values; suggested range is not an import/export clamp',sampling:'native sampleTrack at the latched local/global time',runtime,undo:'one completed gesture',export:'unchanged native field and native track representation'}]));
export const primaryParticleFields = ['ParticleScaling','EmissionRate','Latitude','Speed','LifeSpan','Gravity'];
const clone = value => structuredClone(value);
export function particleValue(emitter, field, {frame=0,interval,globalSequences=[]} = {}) {
  if (field === 'ParticleScaling') return Math.max(0,...Array.from(emitter.ParticleScaling || [0,0,0]));
  const value = emitter[field];
  return typeof value === 'number' ? value : sampleTrack(value,frame,{interval,globalSequences,globalTime:frame,fallback:[field==='Visibility'?1:0]})[0];
}
export function particleSliderDomain(field,value) {
  const [min,max] = particleBindings[field]?.suggested || [0,100];
  return [Math.min(min,Number.isFinite(value)?value:min),Math.max(max,Number.isFinite(value)?value:max)];
}
/** A gesture reads animation and arrays once. Stationary pointers never sample new poses. */
export function beginParticleParameter(emitter, field, options = {}) {
  const baseline = clone(emitter[field]), sampled = particleValue(emitter,field,options);
  const track = baseline?.Keys ? baseline : null;
  const duration = options.globalSequences?.[track?.GlobalSeqId];
  const time = duration > 0 ? ((options.frame||0)%duration+duration)%duration : Math.round(options.frame||0);
  const interval = duration > 0 ? [0,duration] : options.interval;
  const keys = track?.Keys.filter(key => !interval || key.Frame>=interval[0] && key.Frame<=interval[1]) || [];
  const key = [...keys].sort((a,b)=>Math.abs(a.Frame-time)-Math.abs(b.Frame-time))[0];
  const keyTime = key?.Frame ?? time;
  return { field,baseline,sampled,keyTime,options:clone({...options,interval}), value: sampled,
    change(value) {
      if (!Number.isFinite(value)) throw Error('A particle value must be finite.');
      this.value=value;
      if (field === 'ParticleScaling') {
        const values=Array.from(baseline || [0,0,0]), stage=options.stage;
        if (Number.isInteger(stage)) values[stage]=value;
        else if (sampled !== 0) for(let i=0;i<3;i++)values[i]*=value/sampled;
        else values[1]=value;
        return new Float32Array(values);
      }
      if (!track) return value;
      const next=clone(track);
      if (options.scope === 'track') {
        const offset=value-sampled;
        for(const point of next.Keys) if(!interval || point.Frame>=interval[0] && point.Frame<=interval[1]) {
          point.Vector[0]+=offset;
          // Bezier controls are points; Hermite tangents are derivatives.
          if(next.LineType===3) for(const tangent of ['InTan','OutTan'])if(point[tangent])point[tangent][0]+=offset;
        }
      } else {
        let point=next.Keys.find(point=>point.Frame===keyTime);
        if(!point){point={Frame:keyTime,Vector:new Float32Array([value])};if(next.LineType>=2){point.InTan=new Float32Array([next.LineType===2?0:value]);point.OutTan=clone(point.InTan);}next.Keys.push(point);next.Keys.sort((a,b)=>a.Frame-b.Frame);}
        else point.Vector[0]=value;
      }
      return next;
    }
  };
}
/** Document stays committed while a gesture edits only its preview working copy. */
export function createParticleGesture({doc,id,field,options={},commit=(label,sections,mutate)=>doc.apply(label,sections,mutate)}) {
  if(doc.readOnly)throw Error('Read-only model.');
  const emitter=doc.model.ParticleEmitters2.find(node=>node.ObjectId===id);
  if(!emitter)throw Error('Choose an emitter.');
  const parameter=beginParticleParameter(emitter,field,options), revision=doc.revision;
  let next=clone(parameter.baseline), finished=false;
  return {
    parameter,
    update(value){if(finished)throw Error('Gesture already ended.');next=parameter.change(value);return clone(next);},
    cancel(){finished=true;return clone(parameter.baseline);},
    finish(){
      if(finished)return false;finished=true;
      if(doc.revision!==revision)throw Error('The document changed during this gesture.');
      return commit('Change particle '+(particleBindings[field]?.label||field),['Nodes'],model=>{
        const current=model.ParticleEmitters2.find(node=>node.ObjectId===id);
        if(!current)throw Error('Emitter was removed.');current[field]=clone(next);
      });
    }
  };
}
