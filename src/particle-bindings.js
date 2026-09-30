import { Euler, Quaternion } from 'three';
import { sampleTrack } from './animation.js';
import { setKey } from './editor-commands.js';
const descriptions = {
  ParticleScaling: ['Size','float32[3]','world units',false,0,80,'appearance'],
  EmissionRate: ['Amount','float32','particles/second; particles/burst with Squirt',true,0,150,'births'],
  Latitude: ['Spread','float32','degrees',true,0,180,'births'],
  Speed: ['Speed','float32','world units/second',true,0,300,'births'],
  LifeSpan: ['Lasts','float32','seconds',false,0.01,10,'history'],
  Gravity: ['Rise / Fall','float32','world units/second squared',true,-200,200,'births'],
  Width: ['Spawn width','float32','local X half extent',true,0,100,'births'],
  Length: ['Spawn length','float32','local Y half extent',true,0,100,'births'],
  Variation: ['Speed variety','float32','fraction',true,0,1,'births'],
  TailLength: ['Streak length','float32','seconds of velocity',false,0,5,'appearance'],
  Time: ['Changeover','float32','fraction of particle age',false,0,1,'appearance'],
  Visibility: ['Emitting','float32','native visibility',true,0,1,'births'],
  HeightAbove:['Upper edge','float32','local Y offset',true,0,80,'history'],
  HeightBelow:['Lower edge','float32','local Y offset',true,0,80,'history'],
  Color:['Color','float32[3]','RGB tint',true,0,1,'appearance'],
  MaterialID:['Material','uint32 reference','material index',false,0,0,'appearance'],
  TextureSlot:['Picture cell','uint32','ribbon atlas cell',true,0,16,'appearance'],
  Rotation: ['Aim','float32 quaternion','degrees shown; native quaternion track',true,-180,180,'births'],
  Alpha: ['Opacity','uint8[3]','0–255 per life stage',false,0,255,'appearance'],
  SegmentColor: ['Color','float32[3][3]','RGB tint per life stage',false,0,1,'appearance'],
  TextureID:['Picture','uint32 reference','texture resource index',false,0,0,'texture'],
  Rows:['Picture rows','uint32','sprite sheet rows',false,1,16,'appearance'],
  Columns:['Picture columns','uint32','sprite sheet columns',false,1,16,'appearance'],
  FilterMode:['Blend look','uint32 enum','native PE2 blend mode 0–4',false,0,4,'appearance'],
  FrameFlags:['Draw as','uint32 flags','sprite bit 1, streak bit 2',false,0,3,'structure'],
  Flags:['Options','uint32 flags','native node and PE2 bits',false,0,0,'structure'],
  Squirt:['Burst','uint32 boolean','native key-triggered emission',false,0,1,'history'],
  PriorityPlane:['Draw order','int32','native draw plane',false,-10,10,'appearance'],
  ReplaceableId:['Team picture','uint32','source-defined replacement',false,0,2,'texture'],
  ...Object.fromEntries(['LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim'].map(field=>[field,['Picture frames','uint32[3]','first cell, last cell, repeat count',false,0,0,'appearance']])),
};
export const particleBindings = Object.fromEntries(Object.entries(descriptions).map(([field,[label,storage,units,animated,min,max,runtime]])=>[field,{field,label,storage,units,animated,suggested:[min,max],authoredDomain:'finite native values; suggested range is not an import/export clamp',sampling:'native sampleTrack at the latched local/global time; static arrays by selected life stage',runtime,undo:'one completed gesture',export:'unchanged native field and native track representation'}]));
export const primaryParticleFields = ['ParticleScaling','EmissionRate','Latitude','Speed','LifeSpan','Gravity'];
const clone = value => structuredClone(value);
export function particleAimAngles(emitter,options={}) {
  const value=sampleTrack(emitter.Rotation,options.frame||0,{...options,globalTime:options.globalTime??options.frame??0,fallback:[0,0,0,1],quaternion:true});
  return new Euler().setFromQuaternion(new Quaternion().fromArray(value).normalize(),'XYZ').toArray().slice(0,3).map(v=>v*180/Math.PI);
}
export function particleValue(emitter, field, options={}) {
  const {frame=0,interval,globalSequences=[],stage,axis=1}=options;
  if (field === 'ParticleScaling') return Number.isInteger(stage)?emitter.ParticleScaling?.[stage]||0:Math.max(0,...Array.from(emitter.ParticleScaling || [0,0,0]));
  if (field === 'Alpha'&&options.family!=='RibbonEmitters') return emitter.Alpha?.[stage??1]??255;
  if (field === 'SegmentColor') return Array.from(emitter.SegmentColor?.[stage??1]||[1,1,1]);
  if(field==='Color')return Array.from(sampleTrack(emitter.Color,frame,{interval,globalSequences,globalTime:options.globalTime??frame,fallback:[1,1,1]}));
  if (field === 'Rotation') return particleAimAngles(emitter,options)[axis];
  const value = emitter[field];
  if(field==='EmissionRate'&&emitter.Squirt&&value?.Keys){const duration=globalSequences[value.GlobalSeqId],time=duration>0?(options.globalTime??frame)%duration:frame,range=duration>0?[0,duration]:interval;const events=value.Keys.filter(k=>k.Vector[0]>0&&(!range||k.Frame>=range[0]&&k.Frame<=range[1]));const key=events.sort((a,b)=>Math.abs(a.Frame-time)-Math.abs(b.Frame-time))[0];if(key)return key.Vector[0];}
  const sampled=typeof value==='number'?value:sampleTrack(value,frame,{interval,globalSequences,globalTime:options.globalTime??frame,fallback:[field==='Visibility'?1:0]});
  return typeof sampled==='number'?sampled:sampled[0];
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
  const time = duration > 0 ? ((options.globalTime??options.frame??0)%duration+duration)%duration : Math.round(options.frame||0);
  const interval = duration > 0 ? [0,duration] : options.interval;
  let keys = track?.Keys.filter(key => !interval || key.Frame>=interval[0] && key.Frame<=interval[1]) || [];
  if(field==='EmissionRate'&&emitter.Squirt&&keys.some(k=>k.Vector[0]>0))keys=keys.filter(k=>k.Vector[0]>0);
  const key = [...keys].sort((a,b)=>Math.abs(a.Frame-time)-Math.abs(b.Frame-time))[0];
  const keyTime = key?.Frame ?? time,angles=field==='Rotation'?particleAimAngles(emitter,options):null;
  return { field,baseline,sampled,keyTime,angles,options:clone({...options,interval}), value: sampled,
    change(value) {
      const components=Array.isArray(value)||ArrayBuffer.isView(value)?Array.from(value):[value];
      if (components.some(n=>!Number.isFinite(n))) throw Error('A particle value must be finite.');
      this.value=clone(value);
      if(field==='SegmentColor'){
        if(components.length!==3)throw Error('Color needs RGB components.');
        const result=clone(baseline);result[options.stage??1]=new Float32Array(components);return result;
      }
      if(field==='Alpha'&&options.family!=='RibbonEmitters'){
        if(value<0||value>255)throw Error('Opacity is outside its native range.');
        const result=new Uint8Array(baseline);result[options.stage??1]=Math.round(value);return result;
      }
      if(field==='Rotation'){
        const nextAngles=components.length===3?components:angles.map((v,i)=>i===(options.axis??1)?value:v);
        const quaternion=new Quaternion().setFromEuler(new Euler(...nextAngles.map(v=>v*Math.PI/180),'XYZ')).normalize();
        const result={Rotation:clone(track)};
        if(options.scope==='track'&&track){
          const base=new Quaternion().setFromEuler(new Euler(...angles.map(v=>v*Math.PI/180),'XYZ'));
          const delta=quaternion.clone().multiply(base.invert());
          for(const point of result.Rotation.Keys)if(!interval||point.Frame>=interval[0]&&point.Frame<=interval[1])
            for(const property of ['Vector','InTan','OutTan'])if(point[property])point[property]=new Float32Array(delta.clone().multiply(new Quaternion().fromArray(point[property])).normalize().toArray());
        }else {
          const prior=track?.Keys.find(p=>p.Frame===keyTime);
          setKey(result,'Rotation',keyTime,quaternion.toArray(),prior?{inTan:prior.InTan,outTan:prior.OutTan}:{});
        }
        return result.Rotation;
      }
      if (field === 'ParticleScaling') {
        const values=Array.from(baseline || [0,0,0]), stage=options.stage;
        if (Number.isInteger(stage)) values[stage]=value;
        else if (sampled !== 0) for(let i=0;i<3;i++)values[i]*=value/sampled;
        else values[1]=value;
        return new Float32Array(values);
      }
      if (!track) return field==='Color'?new Float32Array(components):value;
      const next=clone(track);
      if (options.scope === 'track') {
        const offsets=components.map((v,i)=>v-(Array.isArray(sampled)?sampled[i]:sampled));
        for(const point of next.Keys) if(!interval || point.Frame>=interval[0] && point.Frame<=interval[1]) {
          if(field==='EmissionRate'&&emitter.Squirt&&point.Vector[0]===0)continue;
          for(let i=0;i<components.length;i++)point.Vector[i]+=offsets[i];
          // Bezier controls are points; Hermite tangents are derivatives.
          if(next.LineType===3) for(const tangent of ['InTan','OutTan'])if(point[tangent])for(let i=0;i<components.length;i++)point[tangent][i]+=offsets[i];
        }
      } else {
        let point=next.Keys.find(point=>point.Frame===keyTime);
        if(!point){point={Frame:keyTime,Vector:new Float32Array(components)};if(next.LineType>=2){point.InTan=new Float32Array(components.map(v=>next.LineType===2?0:v));point.OutTan=clone(point.InTan);}next.Keys.push(point);next.Keys.sort((a,b)=>a.Frame-b.Frame);}
        else for(let i=0;i<components.length;i++)point.Vector[i]=components[i];
      }
      return next;
    }
  };
}
/** Document stays committed while a gesture edits only its preview working copy. */
export function createParticleGesture({doc,id,field,options={},commit=(label,sections,mutate)=>doc.apply(label,sections,mutate)}) {
  if(doc.readOnly)throw Error('Read-only model.');
  const family=options.family||'ParticleEmitters2';
  const emitter=doc.model[family].find(node=>node.ObjectId===id);
  if(!emitter)throw Error('Choose an emitter.');
  const parameter=beginParticleParameter(emitter,field,options), revision=doc.revision;
  let next=clone(parameter.baseline), finished=false;
  return {
    parameter,
    update(value){if(finished)throw Error('Gesture already ended.');next=options.raw?clone(value):parameter.change(value);return clone(next);},
    cancel(){finished=true;return clone(parameter.baseline);},
    finish(){
      if(finished)return false;finished=true;
      if(doc.revision!==revision)throw Error('The document changed during this gesture.');
      return commit('Change particle '+(particleBindings[field]?.label||field),['Nodes'],model=>{
        const current=model[family].find(node=>node.ObjectId===id);
        if(!current)throw Error('Emitter was removed.');
        if(next===undefined)delete current[field];else current[field]=clone(next);
      });
    }
  };
}
