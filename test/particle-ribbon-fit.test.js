import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {ribbonPolygonSelection,fitRibbonToPolygons} from '../src/particle-ribbon-fit.js';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
import {sampleNodeMatrices} from '../src/animation.js';

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
