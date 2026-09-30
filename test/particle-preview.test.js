import test from 'node:test';
import assert from 'node:assert/strict';
import {createNode} from '../src/editor-document.js';
import {createStarterRecipe} from '../src/particle-starters.js';
import {NativeParticleSimulation,particleTimelineAt} from '../app/particle-preview-adapter.js';
const v=(...n)=>new Float32Array(n);
const track=keys=>({LineType:0,GlobalSeqId:null,Keys:keys.map(([Frame,value])=>({Frame,Vector:v(value)}))});
const make=()=>structuredClone(createStarterRecipe().native);
const particles=sim=>sim.snapshot().particles;
test('pinned native simulation gives identical particles across display rates and repeated seek replay',()=>{
  const model=make(),a=new NativeParticleSimulation(model),b=new NativeParticleSimulation(model);
  a.advance(1500);
  for(let time=7;time<1500;time+=7)b.advance(time);
  b.advance(1500);
  assert.deepEqual(particles(a),particles(b));assert.equal(a.random.state,b.random.state);
  const replay=new NativeParticleSimulation(model);replay.advance(1500);
  assert.deepEqual(particles(a),particles(replay));
  const snapshot=a.snapshot();a.advance(1750);a.restore(snapshot);a.advance(1750);
  replay.advance(1750);assert.deepEqual(particles(a),particles(replay));
});
test('a one-millisecond emission window and exact Squirt key survive one long display frame',()=>{
  const model=make(),p=model.ParticleEmitters2[0];p.Visibility=track([[0,0],[105,1],[106,0]]);p.EmissionRate=1000;p.LifeSpan=10;
  const continuous=new NativeParticleSimulation(model);continuous.advance(200);
  assert.equal(continuous.native.particlesController.emitters[0].particles.length,1);
  p.Squirt=true;p.EmissionRate=track([[0,0],[105,7],[106,0]]);
  const burst=new NativeParticleSimulation(model);burst.advance(104);assert.equal(burst.native.particlesController.emitters[0].particles.length,0);
  burst.advance(105);assert.equal(burst.native.particlesController.emitters[0].particles.length,7);
  burst.advance(200);assert.equal(burst.native.particlesController.emitters[0].particles.length,7);
});
test('global emission events repeat at their authored phases without replaying a future first key',()=>{
  const model=make(),p=model.ParticleEmitters2[0];model.GlobalSequences=[1000];p.Visibility=1;p.LifeSpan=10;p.Squirt=true;p.EmissionRate={...track([[100,2],[101,0]]),GlobalSeqId:0};
  const sim=new NativeParticleSimulation(model);assert.equal(sim.native.particlesController.emitters[0].particles.length,0);
  sim.advance(2100);assert.equal(sim.native.particlesController.emitters[0].particles.length,6);
  assert.equal(sim.native.rendererData.globalSequencesFrames[0],100);
});
test('FX pause discards crossed burst triggers and resume does not release a queued burst',()=>{
  const model=make(),p=model.ParticleEmitters2[0];p.LifeSpan=10;p.Squirt=true;p.EmissionRate=track([[100,9],[101,0],[350,4],[351,0]]);
  const timeline=[{at:0,frame:0,global:0,fx:0,poseRate:1,fxRate:0},{at:300,frame:300,global:300,fx:0,poseRate:1,fxRate:1}];
  const sim=new NativeParticleSimulation(model,0,{timeline});sim.advance(349);assert.equal(sim.native.particlesController.emitters[0].particles.length,0);
  sim.advance(350);assert.equal(sim.native.particlesController.emitters[0].particles.length,4);
  assert.equal(particleTimelineAt(timeline,350).fx,50);
});
test('independent FX progression ages and emits at a fixed model pose without moving model tracks',()=>{
  const model=make(),p=model.ParticleEmitters2[0];p.EmissionRate=20;p.LifeSpan=2;
  const sim=new NativeParticleSimulation(model,0,{timeline:[{at:0,frame:700,global:700,fx:0,poseRate:0,fxRate:1}]});
  sim.advance(1000);assert.equal(sim.native.getFrame(),700);assert.equal(sim.native.particlesController.emitters[0].particles.length,20);
  assert.equal(sim.native.particlesController.emitters[0].particles[0].lifeSpan<2,true);
});
test('native ribbon history and RNG restore independently of wall-clock time',()=>{
  const model=make();model.Materials=[{PriorityPlane:0,Layers:[{FilterMode:3,Shading:16,TextureID:0,CoordId:0,Alpha:1}]}];
  const ribbon=createNode(model,'RibbonEmitter');ribbon.MaterialID=0;ribbon.Visibility=1;ribbon.EmissionRate=50;ribbon.LifeSpan=1;ribbon.Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(0,0,0)},{Frame:5000,Vector:v(100,0,0)}]};
  const a=new NativeParticleSimulation(model);a.advance(500);const saved=a.snapshot();a.advance(1000);const first=a.snapshot();
  a.restore(saved);a.advance(1000);const second=a.snapshot();assert.deepEqual(second,first);
  assert.ok(second.ribbons[0].creationTimes.length>2);assert.ok(second.ribbons[0].vertices.some(n=>n>0));
});

test('preview recipe updates retain the native renderer and last valid particles until newest replay completes',async()=>{
  const {ModelRenderer}=await import('war3-model'),{ParticleAuthoringPreview}=await import('../app/particle-preview-adapter.js');
  const model=make(),native=new ModelRenderer(structuredClone(model)),preview=new ParticleAuthoringPreview(native);
  const options={sequence:0,frame:1500,playing:false,animationRate:1,fxRate:1,budgetMs:Infinity};
  preview.advance(options);const original=native.particlesController.emitters[0].particles.map(p=>({pos:Array.from(p.pos),speed:Array.from(p.speed)})),count=original.length;
  const edited=structuredClone(model);edited.ParticleEmitters2[0].Speed=90;preview.updateSource(edited,'Speed',0);
  preview.advance({...options,budgetMs:0});assert.equal(preview.status.busy,true);assert.equal(native.particlesController.emitters[0].particles.length,count);
  assert.deepEqual(native.particlesController.emitters[0].particles.map(p=>({pos:Array.from(p.pos),speed:Array.from(p.speed)})),original);
  edited.ParticleEmitters2[0].Speed=135;preview.updateSource(edited,'Speed',0);preview.advance(options);
  assert.equal(preview.status.busy,false);assert.equal(preview.native,native);assert.equal(native.getFrame(),1500);
  const speeds=native.particlesController.emitters[0].particles.map(p=>Array.from(p.speed));
  for(let i=0;i<speeds.length;i++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(speeds[i][axis]-original[i].speed[axis]*3)<.0001);
});
test('restoring an earlier checkpoint after a partial display step cannot jump to a future state',()=>{
  const sim=new NativeParticleSimulation(make());sim.advance(500);const before=sim.snapshot();sim.advance(1573);sim.restore(before);sim.advance(900);
  const reference=new NativeParticleSimulation(make());reference.advance(900);assert.deepEqual(particles(sim),particles(reference));assert.equal(sim.time,900);
});

test('excessive native bursts stop at an explicit preview budget without changing the recipe',async()=>{
 const model=make(),p=model.ParticleEmitters2[0];p.Squirt=true;p.EmissionRate=track([[0,1e8]]);const before=structuredClone(model);
 const {ModelRenderer}=await import('war3-model'),{ParticleAuthoringPreview}=await import('../app/particle-preview-adapter.js');
 const native=new ModelRenderer(structuredClone(model)),preview=new ParticleAuthoringPreview(native);
 const state=preview.advance({sequence:0,frame:0,playing:false,budgetMs:Infinity});
 assert.match(state.error,/12,000/);assert.equal(state.ended,true);assert.deepEqual(model,before);assert.equal(native.model.ParticleEmitters2[0].EmissionRate.Keys[0].Vector[0],1e8);
 model.ParticleEmitters2[0].EmissionRate=track([[0,7]]);preview.updateSource(model,'EmissionRate',0);
 const resumed=preview.advance({sequence:0,frame:0,playing:false,budgetMs:Infinity});assert.equal(resumed.error,undefined);assert.equal(resumed.liveParticles,7);
});

test('ModelSpace carries live particles with source motion while world-space particles stay behind',()=>{
 const model=make(),p=model.ParticleEmitters2[0];p.Speed=0;p.Width=0;p.Length=0;p.Gravity=0;p.EmissionRate=10;p.LifeSpan=10;
 p.Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(0,0,0)},{Frame:5000,Vector:v(100,0,0)}]};
 p.Flags|=524288;const carried=new NativeParticleSimulation(model);carried.advance(1000);
 const moving=carried.native.particlesController.emitters[0],center=(moving.headVertices[0]+moving.headVertices[3]+moving.headVertices[6]+moving.headVertices[9])/4;
 assert.ok(Math.abs(center-20)<1e-5);assert.equal(moving.particles[0].pos[0],0,'Native particle remains local during integration');
 p.Flags&=~524288;const world=new NativeParticleSimulation(model);world.advance(1000);
 const fixed=world.native.particlesController.emitters[0],fixedCenter=(fixed.headVertices[0]+fixed.headVertices[3]+fixed.headVertices[6]+fixed.headVertices[9])/4;
 assert.ok(fixedCenter<3,'Particles born early remain at their birth position');
});
test('four atlas ranges repeat independently and non-square sheets use columns for their row index',async()=>{
 const {particleAtlasFrame}=await import('../app/particle-preview-adapter.js');
 assert.equal(particleAtlasFrame([8,12,2],.25,4,4),10);
 assert.equal(particleAtlasFrame([8,12,2],.75,4,4),10);
 assert.equal(particleAtlasFrame([8,12,0],.75,4,4),8);
 const model=make(),p=model.ParticleEmitters2[0];p.Rows=2;p.Columns=4;p.FrameFlags=3;p.Time=.5;
 p.LifeSpanUVAnim=new Uint32Array([5,5,1]);p.TailUVAnim=new Uint32Array([6,6,1]);
 const sim=new NativeParticleSimulation(model);sim.advance(100);
 const e=sim.native.particlesController.emitters[0];assert.ok(e.particles.length>0);
 assert.equal(e.headTexCoords[0],.25);assert.equal(e.headTexCoords[1],.5);assert.equal(e.tailTexCoords[0],.5);assert.equal(e.tailTexCoords[1],.5);
});

test('native PE2 replacement overrides only that emitter while retaining the shared texture resource',()=>{
 const model=make(),p=model.ParticleEmitters2[0];p.ReplaceableId=2;const sim=new NativeParticleSimulation(model),controller=sim.native.particlesController,calls=[];
 const before=structuredClone(sim.native.model.Textures);controller.shaderProgramLocations={replaceableTypeUniform:'replacement'};controller.gl=new Proxy({}, {get:(_,name)=>name.toUpperCase()===name?name:(...args)=>calls.push([name,...args])});
 controller.setLayerProps(controller.emitters[0]);assert.ok(calls.some(c=>c[0]==='uniform1f'&&c[1]==='replacement'&&c[2]===2));assert.deepEqual(sim.native.model.Textures,before);
 controller.emitters[0].props.ReplaceableId=0;calls.length=0;controller.setLayerProps(controller.emitters[0]);assert.ok(calls.some(c=>c[0]==='uniform1f'&&c[1]==='replacement'&&c[2]===0));
});
