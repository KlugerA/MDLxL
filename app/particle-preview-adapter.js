import { Matrix4, Vector3 } from 'three';
import { ModelRenderer } from 'war3-model';
import { sampleTrack } from '../src/animation.js';
import { pickParticleSamples } from '../src/particle-handles.js';
import { resetPreviewEffects } from './warcraft-preview-adapter.js';

/** All Particle Editor private access is pinned to war3-model 4.0.1 here. */
export function updateParticlePreview(native, source) {
  if (!native || !source) return;
  for (const family of ['ParticleEmitters2','RibbonEmitters','Helpers']) {
    for (const node of source[family] || []) {
      const target=native.model[family]?.find(item=>item.ObjectId===node.ObjectId);
      if (!target) continue;
      for (const key of Object.keys(target)) if (!Object.hasOwn(node,key)) delete target[key];
      Object.assign(target,structuredClone(node));
    }
  }
}
export function particleStageSnapshot(native,camera,width,height,selectedId,all=false) {
  const project=value=>{const p=new Vector3().fromArray(value).project(camera);return [(p.x+1)*width/2,(1-p.y)*height/2,p.z];};
  const samples=[];let count=0;
  for(const wrapper of native.particlesController?.emitters||[]) {
    count+=wrapper.particles.length;
    if(!all&&wrapper.props.ObjectId!==selectedId)continue;
    const n=all?wrapper.particles.length:Math.min(wrapper.particles.length,24);
    for(let i=0;i<n;i++)for(const [flag,vertices,uv]of [[1,wrapper.headVertices,wrapper.headTexCoords],[2,wrapper.tailVertices,wrapper.tailTexCoords]]) {
      if(!vertices||!(wrapper.type&flag))continue;
      const points=[0,1,2,3].map(k=>project(vertices.subarray(i*12+k*3,i*12+k*3+3)));
      if(points.some(p=>!p.every(Number.isFinite)||p[2]<-1||p[2]>1))continue;
      samples.push({owner:wrapper.props.ObjectId,textureId:wrapper.props.TextureID,filterMode:wrapper.props.FilterMode,kind:flag===1?'sprite':'streak',points,age:1-wrapper.particles[i].lifeSpan/Math.max(.00001,wrapper.props.LifeSpan),uv:Array.from(uv?.subarray(i*8,i*8+8)||[]),color:Array.from(wrapper.colors?.subarray(i*16,i*16+3)||[1,1,1]),opacity:wrapper.colors?.[i*16+3]??1});
    }
  }
  const node=native.model.ParticleEmitters2.find(p=>p.ObjectId===selectedId);let guide=null;
  if(node) {
    const transform=new Matrix4().fromArray(native.rendererData.nodes[node.ObjectId]?.matrix||new Matrix4().elements),pivot=new Vector3().fromArray(node.PivotPoint||[0,0,0]);
    const point=offset=>project(pivot.clone().add(new Vector3(...offset)).applyMatrix4(transform).toArray());
    const value=field=>native.particlesController.interp.animVectorVal(node[field],0);
    const w=value('Width'),l=value('Length'),latitude=value('Latitude');
    // Same local launch distribution as particles.ts: rotate +Z around Y then Z;
    // LineEmitter removes its local X component. No tangent/cone approximation.
    const direction=angle=>{const a=angle*Math.PI/180;return point(node.Flags&131072?[0,60*Math.sin(a),60*Math.cos(a)]:[60*Math.sin(a),0,60*Math.cos(a)]);};
    const low=Math.min(0,latitude),high=Math.max(180,latitude);
    const spreadArc=Array.from({length:181},(_,i)=>{const angle=low+(high-low)*i/180;return {angle,point:direction(angle)};});
    guide={origin:point([0,0,0]),area:[point([-w,-l,0]),point([w,-l,0]),point([w,l,0]),point([-w,l,0])],widthHandle:point([w,0,0]),widthUnit:point([w+1,0,0]),lengthHandle:point([0,l,0]),lengthUnit:point([0,l+1,0]),aim:point([0,0,60]),spread:direction(latitude),spreadArc};
  }
  return {width,height,samples,guide,liveParticles:count,frame:native.getFrame()};
}
const particlePictures=new WeakMap();
export function rememberParticlePicture(native,id,texture,flags=0,compressedPixels) {
  const source=compressedPixels||texture.image;
  if(!source?.width||!source?.height)return;
  let data=source.data;
  if(!data){const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const context=canvas.getContext('2d');context.drawImage(source,0,0);data=context.getImageData(0,0,canvas.width,canvas.height).data;}
  let pictures=particlePictures.get(native);if(!pictures)particlePictures.set(native,pictures=new Map());
  pictures.set(id,{width:source.width,height:source.height,data:new Uint8Array(data),flags});
}
export function pickPreviewParticles(native,camera,width,height,x,y,selectedId) {
  const pictures=new Map(particlePictures.get(native)||[]);
  native.model.Textures.forEach((texture,id)=>{
    if(texture.ReplaceableId!==1&&texture.ReplaceableId!==2)return;
    const size=32,data=new Uint8Array(size*size*4),color=native.rendererData.teamColor||[1,0,0];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const factor=texture.ReplaceableId===2?Math.sin(Math.max(0,Math.min(1,1-Math.hypot((x+.5)/size-.5,(y+.5)/size-.5)*2*1.4))):1,offset=(y*size+x)*4;
      for(let k=0;k<3;k++)data[offset+k]=Math.round(255*color[k]*factor);data[offset+3]=255;
    }
    pictures.set(id,{width:size,height:size,data,flags:0});
  });
  return pickParticleSamples(particleStageSnapshot(native,camera,width,height,selectedId,true).samples,x,y,pictures);
}
export function seededParticleRandom(seed=0x4d444c58) {
  let state=seed>>>0;
  return {next(){state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;},get state(){return state;},set state(value){state=value>>>0;}};
}
/** Scope deterministic randomness to synchronous native simulation, never application UI. */
export function withParticleRandom(random,operation) {
  const prior=Math.random;Math.random=()=>random.next();
  try{return operation();}finally{Math.random=prior;}
}
export function particleEventTimes(model,interval) {
  const times=new Set(interval);
  const walk=value=>{
    if(!value||typeof value!=='object'||ArrayBuffer.isView(value))return;
    if(value.Keys && (value.GlobalSeqId==null||value.GlobalSeqId===-1))for(const key of value.Keys)if(key.Frame>=interval[0]&&key.Frame<=interval[1])times.add(key.Frame);
    for(const child of Object.values(value))walk(child);
  };
  for(const family of ['ParticleEmitters2','RibbonEmitters','Helpers','Bones'])for(const node of model[family]||[])walk(node);
  return [...times].sort((a,b)=>a-b);
}
export function replayParticlePreview(native,frame,sequence,seed=0x4d444c58) {
  const model=native.model,[start,end]=model.Sequences[sequence].Interval,target=Math.min(end,Math.max(start,frame)),random=seededParticleRandom(seed);
  resetPreviewEffects(native);native.setSequence(sequence);native.setFrame(start);
  const events=particleEventTimes(model,[start,target]);
  const update=(step,time)=>{
    const clocks=native.rendererData.globalSequencesFrames;
    for(let i=0;i<model.GlobalSequences.length;i++)if(model.GlobalSequences[i]>0)clocks[i]=(time%model.GlobalSequences[i])-step;
    withParticleRandom(random,()=>native.update(step));
  };
  update(0,start);
  let time=start;
  for(const event of events)while(time<event-1e-7){const step=Math.min(10,event-time);time+=step;update(step,time);}
  native.setFrame(target);
  return random;
}

/** Pinned native CPU simulation. It uses the same controller as the GL preview. */
export function particleTimelineAt(timeline,time) {
  let segment=timeline[0];
  for(const next of timeline){if(next.at>time+1e-8)break;segment=next;}
  const elapsed=Math.max(0,time-segment.at);
  return {frame:segment.frame+elapsed*segment.poseRate,global:segment.global+elapsed*segment.poseRate,fx:segment.fx+elapsed*segment.fxRate,poseRate:segment.poseRate,fxRate:segment.fxRate};
}
function simulationTracks(model) {
  const result=[],seen=new Set();
  const walk=value=>{
    if(!value||typeof value!=='object'||ArrayBuffer.isView(value)||seen.has(value))return;seen.add(value);
    if(value.Keys)result.push(value);
    for(const child of Object.values(value))walk(child);
  };
  for(const family of ['ParticleEmitters2','RibbonEmitters','Helpers','Bones'])for(const node of model[family]||[])walk(node);
  return result;
}
const phaseOf=(time,period)=>((time%period)+period)%period;
function nativeEffectState(native) {
  return {
    particles:(native.particlesController?.emitters||[]).map(e=>({id:e.props.ObjectId,emission:e.emission,squirtFrame:e.squirtFrame,particles:e.particles.map(p=>{const {emitter,...data}=p;return structuredClone(data);})})),
    ribbons:(native.ribbonsController?.emitters||[]).map(e=>({id:e.props.ObjectId,emission:e.emission,creationTimes:e.creationTimes.slice(),vertices:e.vertices?.slice(0,e.creationTimes.length*6)})),
  };
}
function restoreNativeEffectState(native,state) {
  for(const item of state.particles){
    const e=native.particlesController.emitters.find(e=>e.props.ObjectId===item.id);if(!e)continue;
    e.emission=item.emission;e.squirtFrame=item.squirtFrame;e.particles=item.particles.map(p=>({...structuredClone(p),emitter:e}));
    native.particlesController.resizeEmitterBuffers(e,e.particles.length);
  }
  for(const item of state.ribbons){
    const e=native.ribbonsController.emitters.find(e=>e.props.ObjectId===item.id);if(!e)continue;
    native.ribbonsController.resizeEmitterBuffers(e,Math.max(1,item.creationTimes.length));
    e.emission=item.emission;e.creationTimes=item.creationTimes.slice();if(item.vertices)e.vertices.set(item.vertices);
  }
}
export class NativeParticleSimulation {
  constructor(model,sequence=0,{seed=0x4d444c58,timeline}={}) {
    this.native=new ModelRenderer(structuredClone(model));this.sequence=sequence;this.native.setSequence(sequence);
    const start=model.Sequences[sequence].Interval[0];
    this.timeline=structuredClone(timeline||[{at:0,frame:start,global:start,fx:0,poseRate:1,fxRate:1}]);
    this.time=0;this.random=seededParticleRandom(seed);this.seed=seed;this.tracks=simulationTracks(this.native.model);this.burstStamps=new Map();this.checkpoints=[];
    for(const controller of [this.native.particlesController,this.native.ribbonsController])for(const emitter of controller.emitters)emitter.baseCapacity=Math.min(emitter.baseCapacity,256);
    this.step(0,0,true);
  }
  setCamera(position,quaternion){this.native.setCamera(position,quaternion);}
  nextEvent(target) {
    let next=Math.min(target,(Math.floor((this.time+1e-7)/10)+1)*10);
    const current=particleTimelineAt(this.timeline,this.time),model=this.native.model;
    for(const segment of this.timeline)if(segment.at>this.time+1e-7)next=Math.min(next,segment.at);
    if(current.poseRate>0)for(const track of this.tracks) {
      const period=model.GlobalSequences?.[track.GlobalSeqId];
      if(period>0) {
        const phase=phaseOf(current.global,period),wrap=(period-phase)/current.poseRate;
        if(wrap>1e-7)next=Math.min(next,this.time+wrap);
        for(const key of track.Keys){let distance=key.Frame-phase;if(distance<=1e-7)distance+=period;if(distance>1e-7)next=Math.min(next,this.time+distance/current.poseRate);}
      }else for(const key of track.Keys){
        const distance=(key.Frame-current.frame)/current.poseRate;
        if(distance>1e-7)next=Math.min(next,this.time+distance);
      }
    }
    return next;
  }
  step(from,to,events=true,{poseOnly=false}={}) {
    const native=this.native,model=native.model,old=particleTimelineAt(this.timeline,from),current=particleTimelineAt(this.timeline,to);
    const delta=poseOnly?0:Math.max(0,current.fx-old.fx),epsilon=to>from?Math.min(1e-4,(to-from)/2):0;
    const sample=particleTimelineAt(this.timeline,to-epsilon),saved=[];
    const prepare=(frame,global,step)=>{
      native.rendererData.animation=this.sequence;native.rendererData.animationInfo=model.Sequences[this.sequence];
      native.rendererData.frame=frame-step;
      for(let i=0;i<model.GlobalSequences.length;i++)if(model.GlobalSequences[i]>0)native.rendererData.globalSequencesFrames[i]=phaseOf(global,model.GlobalSequences[i])-step;
    };
    const at=(value,fallback,phase)=>sampleTrack(value,phase.frame,{interval:model.Sequences[this.sequence].Interval,globalSequences:model.GlobalSequences,globalTime:phase.global,fallback});
    const run=(step,phase,allowBirths,exactEvents,sampling=phase)=>{
      prepare(phase.frame,phase.global,step);
      for(const [controller,ribbon]of [[native.particlesController,false],[native.ribbonsController,true]])for(const emitter of controller?.emitters||[]){
        const props=emitter.props,visibility=props.Visibility,rate=props.EmissionRate;
        saved.push([props,visibility,rate]);
        const sampledVisibility=at(visibility,ribbon?0:1,sampling);
        props.Visibility=allowBirths?Number(sampledVisibility?.[0]??sampledVisibility):0;
        if(!ribbon&&props.Squirt&&rate?.Keys){
          // Native's "left key changed" heuristic can fire a future first key.
          // Visit actual authored events exactly, including repeated global phases.
          const period=model.GlobalSequences[rate.GlobalSeqId],value=period>0?phaseOf(phase.global,period):phase.frame;
          props.EmissionRate=0;
          if(exactEvents)for(const key of rate.Keys)if(Math.abs(key.Frame-value)<1e-5){
            const stamp=(period>0?Math.floor((phase.global+1e-6)/period):this.sequence)+':'+key.Frame;
            if(this.burstStamps.get(props.ObjectId)!==stamp){
              this.burstStamps.set(props.ObjectId,stamp);
              if(allowBirths&&props.Visibility>0&&key.Vector[0]>0)emitter.emission+=key.Vector[0]*1000;
            }
          }
        }else if(!ribbon&&rate?.Keys){const value=at(rate,0,sampling);props.EmissionRate=Number(value?.[0]??value);}
      }
      const priorNow=Date.now;Date.now=()=>current.fx;
      try{withParticleRandom(this.random,()=>native.update(step));}
      finally{Date.now=priorNow;for(const [props,visibility,rate]of saved.splice(0)){props.Visibility=visibility;props.EmissionRate=rate;}}
    };
    // Integrate the interval using its left-hand visibility/rate at an event,
    // then fire exact event keys without aging their newly born particles.
    if(to>from&&!poseOnly)run(delta,current,current.fxRate>0,false,sample);
    run(0,current,!poseOnly&&current.fxRate>0,events&&!poseOnly);
    this.time=to;
  }
  advance(target,{budgetMs=Infinity,now=()=>performance.now()}={}) {
    if(target<this.time-1e-7)throw Error('Backward particle time requires restoring a checkpoint.');
    const began=now();
    if(this.partialBase&&target>this.time+1e-7){const base=this.partialBase;this.partialBase=null;this.restore(base);}
    while(this.time<target-1e-7){
      const boundary=this.nextEvent(Infinity),next=Math.min(target,boundary);
      if(next<boundary-1e-7)this.partialBase=this.snapshot();
      this.step(this.time,next,true);
      if(this.time-this.lastCheckpoint>=500||this.lastCheckpoint===undefined){
        this.lastCheckpoint=this.time;this.checkpoints.push(this.snapshot());if(this.checkpoints.length>12)this.checkpoints.shift();
      }
      if(now()-began>=budgetMs)return {complete:this.time>=target-1e-7,time:this.time};
    }
    return {complete:true,time:this.time};
  }
  snapshot(){return {time:this.time,random:this.random.state,burstStamps:[...this.burstStamps],phase:particleTimelineAt(this.timeline,this.time),...nativeEffectState(this.native)};}
  restore(snapshot){
    this.partialBase=null;
    restoreNativeEffectState(this.native,snapshot);this.random.state=snapshot.random;this.burstStamps=new Map(snapshot.burstStamps);this.time=snapshot.time;
    this.step(this.time,this.time,false,{poseOnly:true});
  }
  refresh(){this.step(this.time,this.time,false,{poseOnly:true});}
}

function copyParticleSimulationToPreview(simulation,native,phase) {
  const source=simulation.native,particles=native.particlesController,ribbons=native.ribbonsController;
  // Evaluate model pose/materials at the displayed time without triggering FX twice.
  const savedParticleUpdate=particles.update,savedRibbonUpdate=ribbons.update;
  particles.update=()=>{};ribbons.update=()=>{};
  native.rendererData.animation=simulation.sequence;native.rendererData.animationInfo=native.model.Sequences[simulation.sequence];native.rendererData.frame=phase.frame;
  for(let i=0;i<native.model.GlobalSequences.length;i++)if(native.model.GlobalSequences[i]>0)native.rendererData.globalSequencesFrames[i]=phaseOf(phase.global,native.model.GlobalSequences[i]);
  try{native.update(0);}finally{particles.update=savedParticleUpdate;ribbons.update=savedRibbonUpdate;}
  for(const from of source.particlesController.emitters){
    const to=particles.emitters.find(e=>e.props.ObjectId===from.props.ObjectId);if(!to)continue;
    // Reserve modest buffers; actual particle count and exported data are never capped here.
    to.baseCapacity=Math.min(to.baseCapacity,256);
    if(to.type!==from.type){
      to.type=from.type;to.capacity=0;
      if(particles.gl)for(const [flag,names]of [[1,['headVertexBuffer','headTexCoordBuffer']],[2,['tailVertexBuffer','tailTexCoordBuffer']]])
        if(to.type&flag)for(const name of names)to[name]||=particles.gl.createBuffer();
    }
    particles.resizeEmitterBuffers(to,Math.max(1,from.particles.length));
    to.emission=from.emission;to.squirtFrame=from.squirtFrame;
    to.particles=from.particles.map(p=>({...p,emitter:to,pos:p.pos.slice(),speed:p.speed.slice()}));
    for(const [field,stride]of [['headVertices',12],['tailVertices',12],['headTexCoords',8],['tailTexCoords',8],['colors',16]])
      if(from[field]&&to[field])to[field].set(from[field].subarray(0,from.particles.length*stride));
  }
  for(const from of source.ribbonsController.emitters){
    const to=ribbons.emitters.find(e=>e.props.ObjectId===from.props.ObjectId);if(!to)continue;
    to.baseCapacity=Math.min(to.baseCapacity,256);ribbons.resizeEmitterBuffers(to,Math.max(1,from.creationTimes.length));
    to.emission=from.emission;to.creationTimes=from.creationTimes.slice();
    if(from.vertices)to.vertices.set(from.vertices.subarray(0,from.creationTimes.length*6));
    if(from.texCoords)to.texCoords.set(from.texCoords.subarray(0,from.creationTimes.length*4));
  }
}
const appearanceParticleFields=new Set(['ParticleScaling','Alpha','SegmentColor','Time','TailLength','FilterMode','Rows','Columns','TextureID','PriorityPlane','ReplaceableId']);
/** Keep the GL instance and last valid FX frame while the newest recipe is replayed. */
export class ParticleAuthoringPreview {
  constructor(native) {
    this.native=native;this.sequence=-1;this.target=0;this.timeline=[];this.simulation=null;this.pending=null;this.revision=0;this.linked=true;this.status={busy:false};
  }
  phase(){return particleTimelineAt(this.timeline,this.target);}
  reset(sequence,frame){
    this.sequence=sequence;const start=this.native.model.Sequences[sequence].Interval[0];
    this.timeline=[{at:0,frame:start,global:start,fx:0,poseRate:1,fxRate:1}];this.target=Math.max(0,frame-start);
    this.pending=new NativeParticleSimulation(this.native.model,sequence,{timeline:this.timeline});this.rates=null;
  }
  updateSource(source,field,id){
    const before=this.native.model.ParticleEmitters2.find(node=>node.ObjectId===id);
    const after=source.ParticleEmitters2.find(node=>node.ObjectId===id);
    const same=field&&before&&after&&JSON.stringify(before[field])===JSON.stringify(after[field]);
    updateParticlePreview(this.native,source);
    if(same||this.sequence<0)return;
    this.revision++;
    if(appearanceParticleFields.has(field)&&this.simulation&&!this.pending){
      updateParticlePreview(this.simulation.native,source);this.simulation.refresh();
    }else {
      this.pending=new NativeParticleSimulation(this.native.model,this.sequence,{timeline:this.timeline});
    }
  }
  advance({sequence,frame,seek=false,elapsed=0,playing=false,animationRate=1,fxRate=animationRate,linked=true,loop=true,range,cameraPosition,cameraQuaternion,budgetMs=5}){
    const clip=this.native.model.Sequences[sequence],start=range?.[0]??clip.Interval[0],end=range?.[1]??clip.Interval[1];
    if(sequence!==this.sequence||seek||linked&&!this.linked)this.reset(sequence,Math.max(start,Math.min(end,frame)));
    this.linked=linked;
    const maximum=Math.max(animationRate,fxRate),poseRate=maximum>0?animationRate/maximum:0,effectRate=maximum>0?fxRate/maximum:0;
    const rates=poseRate+':'+effectRate;
    if(rates!==this.rates){
      const phase=this.phase();this.timeline.push({at:this.target,frame:phase.frame,global:phase.global,fx:phase.fx,poseRate,fxRate:effectRate});
      if(this.simulation)this.simulation.timeline=structuredClone(this.timeline);
      if(this.pending)this.pending.timeline=structuredClone(this.timeline);
      this.rates=rates;
    }
    let ended=false;
    if(playing&&maximum>0)this.target+=Math.max(0,elapsed)*maximum;
    let phase=this.phase();
    if(phase.frame>end+1e-7&&poseRate>0){
      if(loop){
        const next=start+((phase.frame-end)%(end-start));
        this.reset(sequence,next);this.rates=null;
        // Rate changes are inspection history; each focused loop starts coherently.
        if(!linked){const point=this.phase();this.timeline.push({at:this.target,...point,poseRate,fxRate:effectRate});this.pending.timeline=structuredClone(this.timeline);}
      }else {
        this.target-=(phase.frame-end)/poseRate;ended=true;
      }
      phase=this.phase();
    }
    const candidate=this.pending||this.simulation;
    if(cameraPosition&&cameraQuaternion)candidate.setCamera(cameraPosition,cameraQuaternion);
    const result=candidate.advance(this.target,{budgetMs});
    if(result.complete&&this.pending){this.simulation=this.pending;this.pending=null;}
    const visible=this.simulation;
    if(visible){
      if(cameraPosition&&cameraQuaternion)visible.setCamera(cameraPosition,cameraQuaternion);
      if(visible!==candidate&&this.target>=visible.time)visible.advance(this.target,{budgetMs:Math.min(2,budgetMs)});
      visible.refresh();copyParticleSimulationToPreview(visible,this.native,phase);
    }
    this.status={busy:!!this.pending||!result.complete,frame:phase.frame,global:phase.global,fx:phase.fx,ended,liveParticles:visible?.native.particlesController.emitters.reduce((sum,e)=>sum+e.particles.length,0)||0};
    return this.status;
  }
}
