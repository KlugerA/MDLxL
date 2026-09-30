import { Matrix4, Vector3 } from 'three';
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
export function particleStageSnapshot(native,camera,width,height,selectedId) {
  const project = value => { const p=new Vector3().fromArray(value).project(camera);return [(p.x+1)*width/2,(1-p.y)*height/2,p.z]; };
  const wrappers=native.particlesController?.emitters||[], samples=[];
  let count=0;
  for(const wrapper of wrappers) {
    count+=wrapper.particles.length;
    if(wrapper.props.ObjectId!==selectedId)continue;
    const n=Math.min(wrapper.particles.length,24);
    for(let i=0;i<n;i++) {
      const vertices=wrapper.headVertices;
      if(!vertices||!(wrapper.type&1))continue;
      const points=[0,1,2,3].map(k=>project(vertices.subarray(i*12+k*3,i*12+k*3+3)));
      if(points.some(p=>!p.every(Number.isFinite)||p[2]<-1||p[2]>1))continue;
      samples.push({owner:selectedId,points,age:1-wrapper.particles[i].lifeSpan/Math.max(.00001,wrapper.props.LifeSpan),uv:Array.from(wrapper.headTexCoords?.subarray(i*8,i*8+8)||[]),opacity:wrapper.colors?.[i*16+3]??1});
    }
  }
  const node=native.model.ParticleEmitters2.find(p=>p.ObjectId===selectedId);
  let guide=null;
  if(node) {
    const transform=new Matrix4().fromArray(native.rendererData.nodes[node.ObjectId]?.matrix||new Matrix4().elements);
    const pivot=new Vector3().fromArray(node.PivotPoint||[0,0,0]);
    const point=offset=>project(pivot.clone().add(new Vector3(...offset)).applyMatrix4(transform).toArray());
    const widthValue=native.particlesController.interp.animVectorVal(node.Width,0),length=native.particlesController.interp.animVectorVal(node.Length,0),latitude=native.particlesController.interp.animVectorVal(node.Latitude,0)*Math.PI/180;
    guide={origin:point([0,0,0]),x:point([1,0,0]),y:point([0,1,0]),z:point([0,0,1]),area:[point([-widthValue,-length,0]),point([widthValue,-length,0]),point([widthValue,length,0]),point([-widthValue,length,0])],aim:point([0,0,60]),spread:point([60*Math.sin(latitude),0,60*Math.cos(latitude)])};
  }
  return {width,height,samples,guide,liveParticles:count,frame:native.getFrame()};
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
