import { Matrix4, Vector3, Vector2, Raycaster } from 'three';
import { ModelRenderer } from 'war3-model';
import { particleSweepPath } from '../src/particle-sweep.js';
import { samplePreviewMatrices } from './preview-pose.js';
import { screenPlaneTranslation } from './viewport-math.js';
import { sampleTrack, skinGeoset, sampleGeosetAnimation } from '../src/animation.js';
import { pickParticleSamples } from '../src/particle-handles.js';
import { resetPreviewEffects } from './warcraft-preview-adapter.js';


const compatibleParticleRuntimes=new WeakSet();
/** Source audit: pinned 4.0.1 ignores ModelSpace and UV repeat, and divides atlas rows by Rows.
 * Model-space local integration and exclusive-end interval semantics are cross-checked
 * against mdx-m3-viewer/particle2.ts and shaders/particles.vert.ts. Game validation is separate.
 */
export function particleAtlasFrame(range,progress,columns,rows){
 const [first=0,end=0,repeat=1]=range||[],count=end-first;
 const offset=count>0?((Math.floor(count*repeat*(Number.isFinite(progress)?progress:0))%count)+count)%count:0;
 return Math.min(Math.max(0,columns*rows-1),first+offset);
}
export function installParticleNativeCompatibility(native){
 if(compatibleParticleRuntimes.has(native))return;compatibleParticleRuntimes.add(native);
 const particles=native.particlesController,create=particles.createParticle,buffers=particles.updateParticleBuffers;
 const identity=new Matrix4().elements,point=new Vector3(),velocity=new Vector3(),origin=new Vector3(),matrix=new Matrix4(),positionValues=new Float32Array(3),velocityValues=new Float32Array(3);
 particles.createParticle=function(emitter,transform){return create.call(this,emitter,emitter.props.Flags&524288?identity:transform);};
 particles.updateParticleBuffers=function(particle,index,emitter){
   if(!(emitter.props.Flags&524288))return buffers.call(this,particle,index,emitter);
   const position=particle.pos,speed=particle.speed;matrix.fromArray(native.rendererData.nodes[emitter.props.ObjectId].matrix);
   point.fromArray(position).applyMatrix4(matrix);origin.set(0,0,0).applyMatrix4(matrix);velocity.fromArray(speed).applyMatrix4(matrix).sub(origin);
   positionValues.set(point.toArray());velocityValues.set(velocity.toArray());particle.pos=positionValues;particle.speed=velocityValues;
   try{return buffers.call(this,particle,index,emitter);}finally{particle.pos=position;particle.speed=speed;}
 };
 particles.updateParticleTexCoordsByType=function(index,emitter,early,progress,type){
   const props=emitter.props,columns=props.Columns,rows=props.Rows,range=type===2?(early?props.TailUVAnim:props.TailDecayUVAnim):(early?props.LifeSpanUVAnim:props.DecayUVAnim);
   const target=type===2?emitter.tailTexCoords:emitter.headTexCoords;if(!target||!(columns>0&&rows>0))return;
   const cell=particleAtlasFrame(range,progress,columns,rows),x=cell%columns,y=Math.floor(cell/columns);
   target.set([x/columns,y/rows,x/columns,(y+1)/rows,(x+1)/columns,y/rows,(x+1)/columns,(y+1)/rows],index*8);
 };
 // Native PE2 ReplaceableId overrides its texture reference, and is independent of other emitters sharing that picture.
 const layer=particles.setLayerProps;
 particles.setLayerProps=function(emitter){
  const id=emitter.props.TextureID,replacement=emitter.props.ReplaceableId,original=this.rendererData.model.Textures[id];
  if(replacement===1||replacement===2)this.rendererData.model.Textures[id]={Image:'',ReplaceableId:replacement,Flags:original?.Flags||0};
  try{return layer.call(this,emitter);}finally{if(replacement===1||replacement===2)this.rendererData.model.Textures[id]=original;}
 };
 const ribbons=native.ribbonsController,uv=ribbons.updateEmitterTexCoords;
 ribbons.updateEmitterTexCoords=function(emitter,now){
   uv.call(this,emitter,now);const rows=emitter.props.Rows,columns=emitter.props.Columns;if(!(rows>0&&columns>0))return;
   const cell=this.interp.animVectorVal(emitter.props.TextureSlot,0),y=Math.floor(cell/columns)/rows;
   for(let i=0;i<emitter.creationTimes.length;i++){emitter.texCoords[i*4+1]=y;emitter.texCoords[i*4+3]=y+1/rows;}
 };
}

/** All Particle Editor private access is pinned to war3-model 4.0.1 here. */
export function updateParticlePreview(native, source) {
  if (!native || !source) return;
  for (const family of ['ParticleEmitters2','RibbonEmitters','Helpers']) {
    for (const node of source[family] || []) {
      const target=native.model[family]?.find(item=>item.ObjectId===node.ObjectId);
      if (!target) continue;
      for (const key of Object.keys(target)) if (!Object.hasOwn(node,key)) delete target[key];
      Object.assign(target,structuredClone(node));
      if(native.model.__particleDemoParents?.[node.ObjectId]!=null)target.Parent=native.model.__particleDemoParents[node.ObjectId];
    }
  }
  sweepCache.delete(native);
}
const sweepCache=new WeakMap();
export function particleStageSnapshot(native,camera,width,height,selectedId,all=false,options={}) {
  const project=value=>{const world=new Vector3().fromArray(value),depth=camera.isPerspectiveCamera?-world.clone().applyMatrix4(camera.matrixWorldInverse).z:1,p=world.project(camera);return [(p.x+1)*width/2,(1-p.y)*height/2,p.z,1/depth];};
  const samples=[];let count=0;
  for(const wrapper of native.particlesController?.emitters||[]) {
    count+=wrapper.particles.length;
    if(!all&&wrapper.props.ObjectId!==selectedId)continue;
    const n=all?wrapper.particles.length:Math.min(wrapper.particles.length,24);
    for(let i=0;i<n;i++)for(const [flag,vertices,uv]of [[1,wrapper.headVertices,wrapper.headTexCoords],[2,wrapper.tailVertices,wrapper.tailTexCoords]]) {
      if(!vertices||!(wrapper.type&flag))continue;
      const points=[0,1,2,3].map(k=>project(vertices.subarray(i*12+k*3,i*12+k*3+3)));
      if(points.some(p=>!p.every(Number.isFinite)||p[2]<-1||p[2]>1))continue;
      samples.push({owner:wrapper.props.ObjectId,textureId:[1,2].includes(wrapper.props.ReplaceableId)?'replacement:'+wrapper.props.ReplaceableId:wrapper.props.TextureID,filterMode:wrapper.props.FilterMode,kind:flag===1?'sprite':'streak',points,age:1-wrapper.particles[i].lifeSpan/Math.max(.00001,wrapper.props.LifeSpan),uv:Array.from(uv?.subarray(i*8,i*8+8)||[]),color:Array.from(wrapper.colors?.subarray(i*16,i*16+3)||[1,1,1]),opacity:wrapper.colors?.[i*16+3]??1});
    }
  }
  for(const wrapper of native.ribbonsController?.emitters||[]){
    if(!all&&wrapper.props.ObjectId!==selectedId)continue;
    const material=native.model.Materials[wrapper.props.MaterialID],at=(value,fallback)=>sampleTrack(value,native.getFrame(),{interval:native.model.Sequences[native.getSequence()]?.Interval,globalSequences:native.model.GlobalSequences,globalTime:native.rendererData.globalSequencesFrames[value?.GlobalSeqId]??native.getFrame(),fallback});
    for(const layer of material?.Layers||[]){const textureId=Number(at(layer.TextureID,0)),color=Array.from(at(wrapper.props.Color,[1,1,1])),opacity=Number(at(wrapper.props.Alpha,1))*Number(at(layer.Alpha,1)),n=all?wrapper.creationTimes.length:Math.min(wrapper.creationTimes.length,25);
      for(let i=1;i<n;i++){const offsets=[(i-1)*6,(i-1)*6+3,i*6,i*6+3],points=offsets.map(offset=>project(wrapper.vertices.subarray(offset,offset+3)));if(points.some(p=>!p.every(Number.isFinite)||p[2]<-1||p[2]>1))continue;
        samples.push({owner:wrapper.props.ObjectId,textureId,filterMode:[4,4,0,1,1,2,3][layer.FilterMode]??0,opaque:layer.FilterMode===0,kind:'ribbon',points,uv:Array.from(wrapper.texCoords.subarray((i-1)*4,(i+1)*4)),color,opacity});
      }
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

  const ribbon=native.model.RibbonEmitters.find(p=>p.ObjectId===selectedId);
  if(ribbon){
    const transform=new Matrix4().fromArray(native.rendererData.nodes[ribbon.ObjectId]?.matrix||new Matrix4().elements);
    const point=offset=>project(new Vector3().fromArray(ribbon.PivotPoint||[0,0,0]).add(new Vector3(...offset)).applyMatrix4(transform).toArray());
    const at=field=>native.ribbonsController.interp.animVectorVal(ribbon[field],0),above=at('HeightAbove'),below=at('HeightBelow');
    guide={origin:point([0,0,0]),upper:point([0,above,0]),upperUnit:point([0,above+1,0]),lower:point([0,-below,0]),lowerUnit:point([0,-below-1,0])};
  }
  let sweep;
  if(options.sweepRange){
    const key=selectedId+':'+native.getSequence()+':'+options.sweepRange.join(':');let cached=sweepCache.get(native);
    if(cached?.key!==key){cached={key,path:particleSweepPath(native.model,selectedId,native.getSequence(),options.sweepRange,camera)};sweepCache.set(native,cached);}
    sweep=cached.path.map(p=>({...p,point:project(p.world)}));
    if(ribbon)for(const p of sweep.filter((_,i)=>i%8===0)){
      const matrix=samplePreviewMatrices(native.model,p.time,native.getSequence(),p.time,camera).get(selectedId),at=field=>sampleTrack(ribbon[field],p.time,{interval:native.model.Sequences[native.getSequence()].Interval,globalSequences:native.model.GlobalSequences,globalTime:p.time,fallback:0});
      p.edges=[-at('HeightBelow'),at('HeightAbove')].map(y=>project(new Vector3().fromArray(ribbon.PivotPoint).add(new Vector3(0,y,0)).applyMatrix4(matrix).toArray()));
    }
  }
  let anchor;
  const anchorNode=native.model.Nodes?.[options.anchorId];
  if(anchorNode){
    const world=new Vector3().fromArray(anchorNode.PivotPoint||[0,0,0]).applyMatrix4(new Matrix4().fromArray(native.rendererData.nodes[options.anchorId].matrix));
    const parentMatrix=anchorNode.Parent==null?new Matrix4():new Matrix4().fromArray(native.rendererData.nodes[anchorNode.Parent].matrix),inverse=parentMatrix.clone();
    if(Math.abs(inverse.determinant())>1e-10){inverse.invert();const local=world.clone().applyMatrix4(inverse);anchor={point:project(world.toArray()),dx:world.clone().add(screenPlaneTranslation(camera,world,width,height,1,0)).applyMatrix4(inverse).sub(local).toArray(),dy:world.clone().add(screenPlaneTranslation(camera,world,width,height,0,1)).applyMatrix4(inverse).sub(local).toArray()};}
  }
  return {width,height,samples,guide,sweep,anchor,liveParticles:count,frame:native.getFrame()};

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
  const replacements=[...native.model.Textures.map((texture,id)=>[texture,id]),...native.model.ParticleEmitters2.filter(p=>[1,2].includes(p.ReplaceableId)).map(p=>[{ReplaceableId:p.ReplaceableId},'replacement:'+p.ReplaceableId])];
  replacements.forEach(([texture,id])=>{
    if(texture.ReplaceableId!==1&&texture.ReplaceableId!==2)return;
    const size=32,data=new Uint8Array(size*size*4),color=native.rendererData.teamColor||[1,0,0];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const factor=texture.ReplaceableId===2?Math.sin(Math.max(0,Math.min(1,1-Math.hypot((x+.5)/size-.5,(y+.5)/size-.5)*2*1.4))):1,offset=(y*size+x)*4;
      for(let k=0;k<3;k++)data[offset+k]=Math.round(255*color[k]*factor);data[offset+3]=255;
    }
    pictures.set(id,{width:size,height:size,data,flags:0});
  });
  const depth=particleOpaqueDepth(native,camera,width,height,x,y);
  return pickParticleSamples(particleStageSnapshot(native,camera,width,height,selectedId,true).samples,x,y,pictures,depth);
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
export class ParticlePreviewBudgetError extends Error {constructor(limit){super('Preview paused at the '+limit.toLocaleString('en-US')+' live-particle budget. Authored values are unchanged.');this.name='ParticlePreviewBudgetError';this.limit=limit;}}
export class NativeParticleSimulation {
  constructor(model,sequence=0,{seed=0x4d444c58,timeline,maxLive=12000}={}) {
    this.maxLive=maxLive;this.native=new ModelRenderer(structuredClone(model));installParticleNativeCompatibility(this.native);this.sequence=sequence;this.native.setSequence(sequence);
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
          if(exactEvents)for(const key of rate.Keys)if(Math.abs(key.Frame-value)<1e-5||(period>0&&phase.global>0&&Math.abs(value)<1e-5&&Math.abs(key.Frame-period)<1e-5)){
            const stamp=period>0?Math.floor((phase.global+1e-6)/period)-(key.Frame===period?1:0):this.sequence;
            const identity=props.ObjectId+':'+key.Frame;
            if(this.burstStamps.get(identity)!==stamp){
              this.burstStamps.set(identity,stamp);
              if(allowBirths&&props.Visibility>0&&key.Vector[0]>0)emitter.emission+=key.Vector[0]*1000;
            }
          }
        }else if(!ribbon&&rate?.Keys){const value=at(rate,0,sampling);props.EmissionRate=Number(value?.[0]??value);}
      }
      const priorNow=Date.now;Date.now=()=>current.fx;
      try{
        let projected=0;
        for(const e of native.particlesController.emitters)projected+=e.particles.length+(e.props.Visibility>0?Math.max(0,Math.floor((e.emission+Number(e.props.EmissionRate||0)*step)/1000)):0);
        for(const e of native.ribbonsController.emitters)projected+=e.creationTimes.length+(e.props.Visibility>0?1:0);
        if(!Number.isFinite(projected)||projected>this.maxLive)throw new ParticlePreviewBudgetError(this.maxLive);
        withParticleRandom(this.random,()=>native.update(step));
      }
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
const appearanceParticleFields=new Set(['ParticleScaling','Alpha','SegmentColor','Time','TailLength','FilterMode','Rows','Columns','TextureID','PriorityPlane','ReplaceableId','Color','MaterialID','TextureSlot']);
/** Keep the GL instance and last valid FX frame while the newest recipe is replayed. */
export class ParticleAuthoringPreview {
  constructor(native) {
    this.native=native;this.sequence=-1;this.target=0;this.timeline=[];this.simulation=null;this.pending=null;this.revision=0;this.linked=true;this.status={busy:false};
  }
  makeSimulation(){this.limit=null;try{return new NativeParticleSimulation(this.native.model,this.sequence,{timeline:this.timeline});}catch(error){if(!(error instanceof ParticlePreviewBudgetError))throw error;this.limit=error;return null;}}
  phase(){return particleTimelineAt(this.timeline,this.target);}
  reset(sequence,frame){
    this.sequence=sequence;const start=this.native.model.Sequences[sequence].Interval[0];
    this.timeline=[{at:0,frame:start,global:start,fx:0,poseRate:1,fxRate:1}];this.target=Math.max(0,frame-start);
    this.pending=this.makeSimulation();this.rates=null;
  }
  updateSource(source,field,id){
    const before=[...this.native.model.ParticleEmitters2,...this.native.model.RibbonEmitters].find(node=>node.ObjectId===id);
    const after=[...source.ParticleEmitters2,...source.RibbonEmitters].find(node=>node.ObjectId===id);
    const same=field&&before&&after&&JSON.stringify(before[field])===JSON.stringify(after[field]);
    updateParticlePreview(this.native,source);
    if(same||this.sequence<0)return;
    this.revision++;
    if(appearanceParticleFields.has(field)&&this.simulation&&!this.pending){
      updateParticlePreview(this.simulation.native,source);this.simulation.refresh();
    }else {
      this.pending=this.makeSimulation();
    }
  }
  advance({sequence,frame,seek=false,elapsed=0,playing=false,animationRate=1,fxRate=animationRate,linked=true,loop=true,range,cameraPosition,cameraQuaternion,budgetMs=5}){
    const clip=this.native.model.Sequences[sequence],start=range?.[0]??clip.Interval[0],end=range?.[1]??clip.Interval[1];
    if(sequence!==this.sequence||seek||linked&&!this.linked)this.reset(sequence,Math.max(start,Math.min(end,frame)));
    this.linked=linked;
    if(this.limit)return this.status={busy:false,frame:this.native.getFrame(),global:this.phase().global,fx:this.phase().fx,ended:true,error:this.limit.message,limit:this.limit.limit};
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
        if(!linked){const point=this.phase();this.timeline.push({at:this.target,...point,poseRate,fxRate:effectRate});if(this.pending)this.pending.timeline=structuredClone(this.timeline);}
      }else {
        this.target-=(phase.frame-end)/poseRate;ended=true;
      }
      phase=this.phase();
    }
    if(this.limit)return this.status={busy:false,frame:this.native.getFrame(),global:this.phase().global,fx:this.phase().fx,ended:true,error:this.limit.message,limit:this.limit.limit};
    const candidate=this.pending||this.simulation;
    if(cameraPosition&&cameraQuaternion)candidate.setCamera(cameraPosition,cameraQuaternion);
    let result;try{result=candidate.advance(this.target,{budgetMs});}catch(error){if(!(error instanceof ParticlePreviewBudgetError))throw error;this.limit=error;return this.status={busy:false,frame:this.native.getFrame(),global:this.phase().global,fx:this.phase().fx,ended:true,error:error.message,limit:error.limit};}
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

/** Native posed triangle hit, converted through the chosen attachment's full affine transform. */
export function particleSurfaceAnchor(native,camera,width,height,x,y,anchorId) {
 const anchor=native.model.Nodes?.[anchorId];if(!anchor)return null;
 const raycaster=new Raycaster();raycaster.setFromCamera(new Vector2(x/width*2-1,1-y/height*2),camera);
 const matrices=new Map(native.rendererData.nodes.flatMap((n,i)=>n?.matrix?[[i,new Matrix4().fromArray(n.matrix)]]:[]));
 let nearest=null,distance=Infinity;
 for(const [index,geo]of native.model.Geosets.entries()){
  if(sampleGeosetAnimation(native.model,index,native.getFrame(),native.getSequence()).alpha<=.001)continue;
  const vertices=skinGeoset(geo,matrices);
  for(let i=0;i<geo.Faces.length;i+=3){
   const triangle=[0,1,2].map(k=>new Vector3().fromArray(vertices,geo.Faces[i+k]*3)),point=raycaster.ray.intersectTriangle(...triangle,false,new Vector3());
   if(point){const d=point.distanceToSquared(camera.position);if(d<distance){distance=d;nearest=point;}}
  }
 }
 if(!nearest)return null;
 const matrix=matrices.get(anchor.Parent)||new Matrix4();if(Math.abs(matrix.determinant())<1e-10)return null;
 return nearest.applyMatrix4(matrix.clone().invert()).toArray();
}

/** Hide effect hits behind actual opaque posed surfaces; transparent surfaces need coverage-aware depth. */
function particleOpaqueDepth(native,camera,width,height,x,y){
 const raycaster=new Raycaster();raycaster.setFromCamera(new Vector2(x/width*2-1,1-y/height*2),camera);
 const matrices=new Map(native.rendererData.nodes.flatMap((n,i)=>n?.matrix?[[i,new Matrix4().fromArray(n.matrix)]]:[]));let depth=Infinity;
 for(const [index,geo]of native.model.Geosets.entries()){
  if(sampleGeosetAnimation(native.model,index,native.getFrame(),native.getSequence()).alpha<.999)continue;
  const material=native.model.Materials[geo.MaterialID];if(!material?.Layers.some(layer=>layer.FilterMode===0&&Number(sampleTrack(layer.Alpha,native.getFrame(),{interval:native.model.Sequences[native.getSequence()]?.Interval,globalSequences:native.model.GlobalSequences,globalTime:native.getFrame(),fallback:1}))>=.999))continue;
  const vertices=skinGeoset(geo,matrices);
  for(let i=0;i<geo.Faces.length;i+=3){const triangle=[0,1,2].map(k=>new Vector3().fromArray(vertices,geo.Faces[i+k]*3)),hit=raycaster.ray.intersectTriangle(...triangle,false,new Vector3());if(hit)depth=Math.min(depth,hit.project(camera).z);}
 }
 return depth;
}
