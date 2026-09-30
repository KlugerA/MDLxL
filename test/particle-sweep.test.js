
import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Matrix4,Vector3} from 'three';
import {createNode,createDemoDocument,openDocument} from '../src/editor-document.js';
import {createStarterRecipe} from '../src/particle-starters.js';
import {extractParticleRecipe,particleRecipeDocument,placeParticleRecipe} from '../src/particle-recipes.js';
import {createParticleGesture} from '../src/particle-bindings.js';
import {particleSweepPath,particleSweepTimes,addParticleDemonstration,setParticleEmissionWindow,particleBurstTrack} from '../src/particle-sweep.js';
import {NativeParticleSimulation,particleStageSnapshot,particleSurfaceAnchor,ParticleAuthoringPreview} from '../app/particle-preview-adapter.js';
import {ModelRenderer} from 'war3-model';
const v=(...a)=>new Float32Array(a);
function ribbonFixture(){
 const model=structuredClone(createStarterRecipe().native);
 model.Materials=[{RenderMode:0,PriorityPlane:0,Layers:[{FilterMode:3,Shading:16,TextureID:0,CoordId:0,Alpha:1}]}];
 const parent=createNode(model,'Helper');parent.Scaling={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(2,3,1)}]};parent.Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(0,0,0)},{Frame:5000,Vector:v(40,0,0)}]};
 const ribbon=createNode(model,'RibbonEmitter');ribbon.Parent=parent.ObjectId;ribbon.Visibility=1;ribbon.EmissionRate=40;
 return {model,parent,ribbon};
}
test('ribbon gestures preserve parent, support animated opacity/color, and create one undo',()=>{
 const {model,ribbon}=ribbonFixture();ribbon.Color={LineType:3,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(.1,.2,.3),InTan:v(.1,.2,.3),OutTan:v(.2,.3,.4)}]};
 const doc=particleRecipeDocument(extractParticleRecipe(model,[ribbon.ObjectId])),node=doc.model.RibbonEmitters[0],before=structuredClone(doc.model);
 let gesture=createParticleGesture({doc,id:node.ObjectId,field:'HeightAbove',options:{family:'RibbonEmitters',frame:800,interval:[0,5000]}});
 gesture.update(12);gesture.finish();assert.equal(doc.model.RibbonEmitters[0].HeightAbove,12);assert.deepEqual(doc.model.Helpers,before.Helpers);
 doc.undo();assert.deepEqual(doc.model,before);
 gesture=createParticleGesture({doc,id:node.ObjectId,field:'Alpha',options:{family:'RibbonEmitters'}});gesture.update(.3);gesture.finish();assert.equal(doc.model.RibbonEmitters[0].Alpha,.3);
 gesture=createParticleGesture({doc,id:node.ObjectId,field:'Color',options:{family:'RibbonEmitters',scope:'track',frame:0,interval:[0,5000]}});
 gesture.update([.5,.6,.7]);gesture.finish();assert.equal(doc.model.RibbonEmitters[0].Color.Keys.length,1);
 assert.ok(Math.abs(doc.model.RibbonEmitters[0].Color.Keys[0].Vector[2]-.7)<1e-6);
 for(const format of ['mdl','mdx']){const reopened=openDocument(doc.serialize(format),'ribbon.'+format);assert.equal(reopened.readOnly,false);assert.deepEqual(reopened.model.RibbonEmitters[0].Color,doc.model.RibbonEmitters[0].Color);}
});
test('sweep samples scaled source motion without mutation; crossings stay in the current time neighborhood',()=>{
 const {model,ribbon}=ribbonFixture(),before=structuredClone(model),path=particleSweepPath(model,ribbon.ObjectId,0,[0,1000]);
 assert.equal(path.length,65);assert.notDeepEqual(path[0].world,path.at(-1).world);assert.deepEqual(model,before);
 const crossing=[{time:0,point:[0,0]},{time:100,point:[10,10]},{time:200,point:[0,10]},{time:300,point:[10,0]}];
 const candidates=particleSweepTimes(crossing,5,5,250);assert.equal(candidates[0].time,250);assert.ok(candidates.some(p=>p.time===50));
});
test('demonstration wrapper is isolated from the recipe and retains source motion',()=>{
 const {model,ribbon}=ribbonFixture(),recipe=extractParticleRecipe(model,[ribbon.ObjectId]),before=structuredClone(recipe);
 const preview=structuredClone(recipe.native);addParticleDemonstration(preview,[0,5000]);assert.deepEqual(recipe,before);
 const path=particleSweepPath(preview,preview.RibbonEmitters[0].ObjectId,0,[0,1200]);assert.ok(path.some(p=>Math.abs(p.world[1])>10));
 assert.ok(preview.Helpers.length>recipe.native.Helpers.length);
});
test('emission-window and burst authoring preserve other clips, native boundaries and global ownership',()=>{
 const p=structuredClone(createStarterRecipe().native.ParticleEmitters2[0]);
 p.Visibility={LineType:0,GlobalSeqId:null,Keys:[{Frame:6000,Vector:v(.8)}]};setParticleEmissionWindow(p,[0,5000],[210,330]);
 assert.deepEqual(p.Visibility.Keys.map(k=>[k.Frame,k.Vector[0]]),[[0,0],[210,1],[330,0],[6000,v(.8)[0]]]);
 const burst=particleBurstTrack(p,[0,5000],200,7);assert.deepEqual(burst.Keys.map(k=>[k.Frame,k.Vector[0]]),[[0,0],[200,7],[201,0],[5000,0]]);
 p.Visibility.GlobalSeqId=0;assert.throws(()=>setParticleEmissionWindow(p,[0,5000],[210,330]),/global loop/);
});
test('period-end and period-start Squirt keys fire once each at loop seams',()=>{
 const model=structuredClone(createStarterRecipe().native),p=model.ParticleEmitters2[0];model.GlobalSequences=[1000];p.Squirt=true;p.Visibility=1;p.LifeSpan=10;
 p.EmissionRate={LineType:0,GlobalSeqId:0,Keys:[{Frame:0,Vector:v(2)},{Frame:1000,Vector:v(3)}]};
 const sim=new NativeParticleSimulation(model);assert.equal(sim.snapshot().particles[0].particles.length,2);
 sim.advance(1000);assert.equal(sim.snapshot().particles[0].particles.length,7);
 sim.refresh();sim.advance(1001);assert.equal(sim.snapshot().particles[0].particles.length,7);
 sim.advance(2000);assert.equal(sim.snapshot().particles[0].particles.length,12);
});
test('placement ghost anchor mapping follows a nonuniform parent and leaves target untouched',()=>{
 const {model,parent,ribbon}=ribbonFixture(),doc=particleRecipeDocument(extractParticleRecipe(model,[ribbon.ObjectId])),before=structuredClone(doc.model),ghost=structuredClone(doc.model);
 const targetParent=ghost.Helpers[0],result=placeParticleRecipe(ghost,createStarterRecipe(),{parent:targetParent.ObjectId,position:[10,20,0],sourceInterval:[0,5000],targetInterval:[0,5000],fit:true});
 const native=new NativeParticleSimulation(ghost).native,camera=new PerspectiveCamera(45,4/3,.1,10000);camera.position.set(200,-250,180);camera.up.set(0,0,1);camera.lookAt(0,0,30);camera.updateMatrixWorld();
 const shot=particleStageSnapshot(native,camera,800,600,result.ids[0],false,{anchorId:result.anchorId});
 assert.ok(shot.anchor);assert.ok([...shot.anchor.dx,...shot.anchor.dy].every(Number.isFinite));
 const parentMatrix=new Matrix4().fromArray(native.rendererData.nodes[targetParent.ObjectId].matrix),base=new Vector3(10,20,0).applyMatrix4(parentMatrix).project(camera),moved=new Vector3(...[10,20,0].map((v,i)=>v+shot.anchor.dx[i]*10)).applyMatrix4(parentMatrix).project(camera);
 assert.ok(Math.abs((moved.x-base.x)*400-10)<1e-6);assert.deepEqual(doc.model,before);
});
test('focused loop reconstruction revisits the same native state',()=>{
 const native=new ModelRenderer(structuredClone(createStarterRecipe().native)),preview=new ParticleAuthoringPreview(native),options={sequence:0,frame:250,range:[200,300],playing:false,budgetMs:Infinity};
 preview.advance(options);const expected=preview.simulation.snapshot();
 preview.advance({...options,playing:true,elapsed:100});assert.equal(preview.status.frame,250);
 assert.deepEqual(preview.simulation.snapshot().particles,expected.particles);
});

