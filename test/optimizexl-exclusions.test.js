import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { runOptimizeStage, simpleSettings } from '../src/optimizexl.js';
import { prepareNuclearReduction } from '../src/optimizexl-geometry.js';
import { OptimizeXLSession } from '../src/optimizexl-session.js';
import { sampleNodeMatrices } from '../src/animation.js';

await prepareNuclearReduction();
const reopen=bytes=>openDocument(bytes,'review.mdx').model;
const track=(values=[[0,0,0],[1,0,0],[2,0,0]])=>({LineType:1,GlobalSeqId:null,Keys:values.map((v,i)=>({Frame:i*500,Vector:new Float32Array(v)}))});
function twoGeosets() {
  const doc=createStarterDocument();
  doc.apply('Two geosets',['Geosets'],m=>m.Geosets.push(structuredClone(m.Geosets[0])));
  return doc;
}

test('duplicates and unused vertices skip excluded streams and bindings; clearing restores the proposal',()=>{
  const doc=twoGeosets();
  doc.apply('Duplicate and orphan vertices',['Geosets'],m=>{for(const g of m.Geosets){
    g.Vertices=new Float32Array([0,0,0,1,0,0,0,1,0,0,0,0,4,4,4]);
    g.Normals=new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1]);g.TVertices=[new Float32Array([0,0,1,0,0,1,0,0,1,1])];
    g.VertexGroup=new Uint8Array([0,0,0,1,1]);g.Groups=[[0],[0]];g.TotalGroupsCount=2;g.Faces=new Uint16Array([0,1,2,3,1,2]);
  }});
  const bytes=doc.serialize('mdx'),before=reopen(bytes);
  for(const [stage,settings] of [['duplicates',{bones:true}],['unused',{vertices:true,resources:true,nodes:true}]]) {
    const protectedResult=runOptimizeStage(bytes,stage,{...settings,excludedGeosets:[1]}),after=reopen(protectedResult.bytes);
    assert.deepEqual(after.Geosets[1],before.Geosets[1],stage+' must not touch excluded geometry');
    assert.ok(after.Geosets[0].Vertices.length<before.Geosets[0].Vertices.length);
    assert.ok(protectedResult.changed);assert.ok(protectedResult.saved>0);
    const cleared=reopen(runOptimizeStage(bytes,stage,{...settings,excludedGeosets:[]}).bytes);
    assert.ok(cleared.Geosets[1].Vertices.length<before.Geosets[1].Vertices.length);
  }
  assert.deepEqual(doc.serialize('mdx'),bytes);
});

test('excluded bone dependencies are retained even when equivalent leaves could be merged',()=>{
  const doc=twoGeosets();doc.apply('Equivalent leaves',['Bones','PivotPoints','Geosets'],m=>{
    for(let i=0;i<3;i++){const n=createNode(m,'Bone'),id=n.ObjectId;Object.assign(n,structuredClone(m.Bones[0]),{ObjectId:id,Name:'Leaf '+i});m.PivotPoints[id]=new Float32Array(m.Bones[0].PivotPoint);}
    m.Geosets[0].Groups=[[0,1]];m.Geosets[0].TotalGroupsCount=2;m.Geosets[1].Groups=[[2,3]];m.Geosets[1].TotalGroupsCount=2;
  });
  const bytes=doc.serialize('mdx'),before=reopen(bytes),result=runOptimizeStage(bytes,'duplicates',{bones:true,excludedGeosets:[1]}),after=reopen(result.bytes);
  assert.equal(result.stats.duplicateBones,1);assert.equal(after.Geosets[1].Groups[0].length,2);
  const oldNodes=before.Geosets[1].Groups[0].map(id=>before.Nodes[id]),newNodes=after.Geosets[1].Groups[0].map(id=>after.Nodes[id]);
  assert.deepEqual(newNodes.map(n=>n.Name),oldNodes.map(n=>n.Name));
  for(let i=0;i<2;i++)assert.deepEqual(sampleNodeMatrices(before,0,-1).get(oldNodes[i].ObjectId),sampleNodeMatrices(after,0,-1).get(newNodes[i].ObjectId));
});

test('animation exclusion protects shared ancestors, visibility, material and UV motion while reducing an independent rig',()=>{
  const doc=twoGeosets();doc.apply('Animated dependencies',['Geosets','Bones','Helpers','PivotPoints','Sequences','GeosetAnims','Materials','TextureAnims'],m=>{
    m.Sequences=[{Name:'Stand',Interval:new Uint32Array([0,1000]),MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,MoveSpeed:0,NonLooping:false,Rarity:0}];
    const parent=createNode(m,'Helper'),leaf=createNode(m,'Bone'),independent=createNode(m,'Bone');
    m.Bones[0].Parent=parent.ObjectId;leaf.Parent=parent.ObjectId;
    for(const n of [m.Bones[0],parent,leaf,independent])n.Translation=track();
    m.Geosets[0].Groups=[[leaf.ObjectId,independent.ObjectId]];m.Geosets[0].TotalGroupsCount=2;
    m.GeosetAnims=[0,1].map(GeosetId=>({GeosetId,Flags:0,Color:new Float32Array([1,1,1]),Alpha:track([[1],[1],[1]])}));
    m.Materials[0].Layers[0].Alpha=track([[1],[1],[1]]);m.Materials[0].Layers[0].TVertexAnimId=0;
    m.TextureAnims=[{Translation:track()}];
  });
  const bytes=doc.serialize('mdx'),before=reopen(bytes),result=runOptimizeStage(bytes,'animation',{position:100,rotation:100,scale:100,excludedGeosets:[1]}),after=reopen(result.bytes);
  assert.deepEqual(after.Geosets,before.Geosets);assert.deepEqual(after.Bones[0],before.Bones[0]);assert.deepEqual(after.Helpers,before.Helpers);
  assert.equal(after.Bones[1].Translation.Keys.length,2);assert.equal(after.Bones[2].Translation.Keys.length,2);
  assert.deepEqual(after.GeosetAnims[1],before.GeosetAnims[1]);assert.equal(after.GeosetAnims[0].Alpha.Keys.length,2);
  assert.deepEqual(after.Materials,before.Materials);assert.deepEqual(after.TextureAnims,before.TextureAnims);
  for(let frame=0;frame<=1000;frame+=31)assert.deepEqual(sampleNodeMatrices(after,frame,0).get(0),sampleNodeMatrices(before,frame,0).get(0));
  const all=runOptimizeStage(bytes,'animation',{position:100,excludedGeosets:[0,1]});assert.equal(all.changed,false);
});

test('Nuclear retains excluded geosets exactly and keeps other geosets at the same reduction strength',()=>{
  const doc=twoGeosets();doc.apply('Two grids',['Geosets'],m=>{for(const g of m.Geosets){const v=[],n=[],uv=[],f=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){v.push(x,y,0);n.push(0,0,1);uv.push(x/8,y/8);}for(let y=0;y<7;y++)for(let x=0;x<7;x++){const a=y*8+x;f.push(a,a+1,a+8,a+1,a+9,a+8);}g.Vertices=new Float32Array(v);g.Normals=new Float32Array(n);g.TVertices=[new Float32Array(uv)];g.VertexGroup=new Uint8Array(64);g.Faces=new Uint16Array(f);}});
  const bytes=doc.serialize('mdx'),before=reopen(bytes),settings=simpleSettings('nuclear',100,before);
  const unprotected=reopen(runOptimizeStage(bytes,'nuclear',settings).bytes);
  const result=runOptimizeStage(bytes,'nuclear',{...settings,excludedGeosets:[1]}),after=reopen(result.bytes);
  assert.deepEqual(after.Geosets[1],before.Geosets[1]);assert.deepEqual(after.Geosets[0],unprotected.Geosets[0]);assert.ok(result.saved>0);
  const all=runOptimizeStage(bytes,'nuclear',{...settings,excludedGeosets:[0,1]});assert.deepEqual(all.bytes,bytes);assert.equal(all.changed,false);
});

test('green-star review state distinguishes approval, no-op, skipped work, exclusions and undo',()=>{
  const session=new OptimizeXLSession(new Uint8Array([1]));assert.equal(session.needsReview('nuclear'),true);
  session.recordReview('nuclear',false);assert.equal(session.needsReview('nuclear'),true,'Zero strength is not a completed review');
  session.recordReview('unused',true,'1');assert.equal(session.needsReview('unused','1'),false);assert.equal(session.needsReview('unused',''),true);
  session.skip('duplicates');assert.equal(session.needsReview('duplicates'),true);assert.equal(session.needsReview('unused','1'),false,'Skip keeps no-op proof for the same accepted model');
  session.propose({bytes:new Uint8Array([2])},session.revision);session.approve('nuclear',{excludedGeosets:[1]});
  assert.equal(session.needsReview('nuclear','1'),false);assert.equal(session.needsReview('unused','1'),true,'An approved change invalidates stale no-op results');
  session.back();assert.equal(session.needsReview('nuclear'),true);assert.equal(session.needsReview('unused','1'),false);
});
