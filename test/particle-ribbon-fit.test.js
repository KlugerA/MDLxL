import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {ribbonPolygonSelection,fitRibbonToPolygons} from '../src/particle-ribbon-fit.js';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
import {sampleNodeMatrices,sampleTrack} from '../src/animation.js';

function fixture(){
 const doc=createDemoDocument();doc.apply('Make test weapon',['Geosets','Nodes'],m=>{
  const g=m.Geosets[0];g.Vertices=new Float32Array([20,4,0,22,4,0,22,4,100,20,4,100,999,999,999]);g.Normals=new Float32Array(15);g.TVertices=[new Float32Array(10)];g.Faces=new Uint16Array([0,1,2,0,2,3]);g.VertexGroup=new Uint8Array(5);g.Groups=[[0]];
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([0,0,0])},{Frame:2000,Vector:new Float32Array([17,-9,23])}]};
  m.Bones[0].Rotation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([0,0,0,1])},{Frame:2000,Vector:new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(1,1,0).normalize(),2).toArray())}]};
  m.Bones[0].Scaling={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([2,.5,1.5])}]};
 });return doc;
}
test('marked weapon-back polygons fit a native Y-axis ribbon and detect the shared bone',()=>{
 const doc=fixture(),before=structuredClone(doc.model),selection={0:[0,1,2,3,4]},fit=fitRibbonToPolygons(doc.model,selection);
 assert.equal(fit.polygons,2);assert.equal(fit.parent,0);assert.equal(fit.needsBone,false);assert.equal(fit.length,100);
 assert.deepEqual(fit.endpoints,[[21,4,0],[21,4,100]]);assert.deepEqual(doc.model,before,'Fitting is read-only');
 assert.throws(()=>fitRibbonToPolygons(doc.model,{0:[0,1]}),/select the polygons/);
 const g=doc.model.Geosets[0];g.Groups.push([1]);g.VertexGroup[0]=1;
 assert.equal(ribbonPolygonSelection(doc.model,selection).needsBone,true);
 assert.equal(ribbonPolygonSelection(doc.model,selection).parent,0,'Mixed polygons use their strongest shared influence without an attachment prompt');
});
test('fitted endpoints follow animated and nonuniform parent motion without changing the weapon',()=>{
 const doc=fixture(),before=structuredClone(doc.model),fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]});let placed;
 doc.apply('Add weapon ribbon',['Nodes','PivotPoints','Materials','Textures','GlobalSequences'],m=>{placed=placeTimedParticleRecipe(m,fit.recipe,{sequence:0,from:0,to:2000,parent:'0',position:[0,0,0],motion:'target',fit:true});});
 const r=doc.model.Nodes[placed.ids[0]];
 for(const frame of [0,125,570,1190,1900]){
  const matrices=sampleNodeMatrices(doc.model,frame,0),ends=[-r.HeightBelow,r.HeightAbove].map(y=>new Vector3(...r.PivotPoint).add(new Vector3(0,y,0)).applyMatrix4(matrices.get(r.ObjectId)));
  for(let i=0;i<2;i++)assert.ok(ends[i].distanceTo(new Vector3(...fit.endpoints[i]).applyMatrix4(matrices.get(0)))<2e-5);
 }
 assert.deepEqual(doc.model.Geosets,before.Geosets);assert.deepEqual(doc.model.Bones,before.Bones);
 doc.undo();assert.deepEqual(doc.model,before);
});
test('fitted native ribbon placement round-trips MDL and MDX with chosen visibility',()=>{
 const doc=createDemoDocument(),selection={0:Array.from({length:doc.model.Geosets[0].Vertices.length/3},(_,i)=>i)},fit=fitRibbonToPolygons(doc.model,selection);
 doc.apply('Add ribbon',['Nodes','PivotPoints','Materials','Textures','GlobalSequences'],m=>placeTimedParticleRecipe(m,fit.recipe,{sequence:0,from:100,to:900,parent:String(fit.parent),position:[0,0,0],motion:'target',fit:true}));
 const r=doc.model.RibbonEmitters[0];for(const format of ['mdx','mdl']){const copy=openDocument(doc.serialize(format),'ribbon.'+format),next=copy.model.RibbonEmitters[0];assert.deepEqual(next.PivotPoint,r.PivotPoint);assert.deepEqual(next.Rotation,r.Rotation);assert.deepEqual(next.Visibility,r.Visibility);assert.equal(next.HeightAbove,Math.fround(r.HeightAbove));}
});
test('ribbon creation uses whole checked animations and preserves its fitted axis in every clip',()=>{
 const doc=fixture();doc.apply('Test animations',['Sequences'],m=>{m.Sequences=[0,1,2].map(i=>({ ...m.Sequences[0],Name:'Clip '+i,Interval:new Uint32Array([i*3000,i*3000+2000]) }));});
 const before=structuredClone(doc.model),fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]});let placed;
 doc.apply('Add ribbon',['Nodes','PivotPoints','Materials','Textures','GlobalSequences'],m=>{placed=placeTimedParticleRecipe(m,fit.recipe,{ribbon:fit,sequences:[0,2],sequence:2,from:0,to:'',parent:String(fit.parent),position:[0,0,0],motion:'target',fit:true});});
 const ribbon=doc.model.Nodes[placed.ids[0]];
 for(let i=0;i<doc.model.Sequences.length;i++){
  const interval=doc.model.Sequences[i].Interval;
  for(const frame of [interval[0],interval[0]+500,interval[1]]){
   assert.equal(sampleTrack(ribbon.Visibility,frame,{interval,fallback:1}),i===1?0:1);
   assert.deepEqual(sampleTrack(ribbon.Rotation,frame,{interval,dimension:4,fallback:[0,0,0,1]}),Array.from(fit.recipe.native.RibbonEmitters[0].Rotation.Keys[0].Vector));
  }
 }
 assert.deepEqual(doc.model.Geosets,before.Geosets);assert.deepEqual(doc.model.Bones,before.Bones);assert.deepEqual(doc.model.Sequences,before.Sequences);
 for(const format of ['mdl','mdx']){const reopened=openDocument(doc.serialize(format),'ribbon.'+format).model.RibbonEmitters[0];assert.deepEqual(reopened.Visibility,ribbon.Visibility);assert.deepEqual(reopened.Rotation,ribbon.Rotation);}
 doc.undo();assert.deepEqual(doc.model,before);
});
test('ribbons can be created with no checked animations or on a static model',()=>{
 for(const animated of [true,false]){
  const doc=fixture();if(!animated)doc.model.Sequences=[];
  const fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]});
  const result=placeTimedParticleRecipe(doc.model,fit.recipe,{ribbon:fit,sequences:[],sequence:0,from:0,to:'',parent:'0',position:[0,0,0],motion:'target',fit:true});
  const r=doc.model.Nodes[result.ids[0]];
  if(animated)assert.ok(r.Visibility.Keys.every(key=>key.Vector[0]===0));else assert.equal(r.Visibility,1);
 }
});
