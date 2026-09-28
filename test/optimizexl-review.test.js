import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument,createNode } from '../src/editor-document.js';
import { runOptimizeStage,findIrregularities } from '../src/optimizexl.js';
import { sampleTrack } from '../src/animation.js';

const sequence=(Name,index)=>({Name,Interval:new Uint32Array([index*100,index*100+80]),MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,MoveSpeed:0,NonLooping:!Name.startsWith('Stand'),Rarity:0});
const key=(Frame,v)=>({Frame,Vector:new Float32Array([v,0,0])});
function combatFixture(offsets=[0,0,0,0,20]) {
 const doc=createStarterDocument();doc.apply('Endpoint fixture',['Sequences','Bones','ParticleEmitters2','PivotPoints'],m=>{
  m.Sequences=['Attack - 1','Attack - 2','Stand Ready','Death','Attack - Slam'].map(sequence);
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:offsets.flatMap((offset,i)=>[key(i*100,offset),key(i*100+40,offset+50),key(i*100+80,i===3?150:offset)])};
  const effect=createNode(m,'ParticleEmitter2');effect.Translation={LineType:1,GlobalSeqId:null,Keys:offsets.flatMap((_,i)=>[key(i*100,i*10),key(i*100+80,i*10+1)])};
 });return doc;
}
const pose=(m,sequence,end)=>sampleTrack(m.Bones[0].Translation,m.Sequences[sequence].Interval[end],{interval:m.Sequences[sequence].Interval,fallback:[0,0,0]});

test('one common-pose proposal corrects both attack endpoints and leaves interior keys/effects intact',()=>{
 const doc=combatFixture(),bytes=doc.serialize('mdx'),before=openDocument(bytes,'x.mdx').model;
 const fixes=findIrregularities(before).filter(f=>f.kind==='commonPose');assert.equal(fixes.length,1);const fix=fixes[0];assert.equal(fix.sequence,4);assert.deepEqual(fix.frames,[400,480]);assert.deepEqual(fix.support,[0,1,2,3]);
 const after=openDocument(runOptimizeStage(bytes,'irregularities',{},fix).bytes,'x.mdx').model;
 assert.deepEqual(pose(after,4,0),pose(after,0,0));assert.deepEqual(pose(after,4,1),pose(after,0,0));assert.deepEqual(pose(after,3,1),pose(before,3,1));
 assert.deepEqual(after.Bones[0].Translation.Keys.filter(k=>![400,480].includes(k.Frame)),before.Bones[0].Translation.Keys.filter(k=>![400,480].includes(k.Frame)));
 assert.deepEqual(after.ParticleEmitters2,before.ParticleEmitters2);assert.ok(!findIrregularities(after).some(f=>f.kind==='commonPose'));assert.deepEqual(doc.serialize('mdx'),bytes);
});

test('the common pose can correct an outlying Stand Ready instead of treating its name as authority',()=>{
 const doc=combatFixture([0,0,20,0,0]),bytes=doc.serialize('mdx'),before=openDocument(bytes,'x.mdx').model;
 const fixes=findIrregularities(before).filter(f=>f.kind==='commonPose');assert.equal(fixes.length,1);assert.equal(fixes[0].sequence,2);assert.notEqual(fixes[0].from,2);
 const after=openDocument(runOptimizeStage(bytes,'irregularities',{},fixes[0]).bytes,'x.mdx').model;assert.deepEqual(pose(after,2,0),pose(after,0,0));assert.deepEqual(pose(after,2,1),pose(after,0,0));
});

test('Death contributes only its first frame and a correction never overwrites its final pose',()=>{
 const doc=combatFixture([0,0,0,20,0]),bytes=doc.serialize('mdx'),before=openDocument(bytes,'x.mdx').model,fix=findIrregularities(before).find(f=>f.kind==='commonPose');assert.deepEqual(fix.frames,[300]);
 const after=openDocument(runOptimizeStage(bytes,'irregularities',{},fix).bytes,'x.mdx').model;assert.deepEqual(pose(after,3,0),pose(after,0,0));assert.deepEqual(pose(after,3,1),pose(before,3,1));
 // With no Death keys at all, inserting its first key must not replace the
 // previously implicit default at Death's end.
 doc.apply('Implicit death',['Bones'],m=>{m.Bones[0].Translation.Keys=m.Bones[0].Translation.Keys.filter(k=>k.Frame<300||k.Frame>380).map(k=>({...k,Vector:new Float32Array([10,0,0])}));});
 const implicitBytes=doc.serialize('mdx'),implicit=openDocument(implicitBytes,'x.mdx').model,implicitFix=findIrregularities(implicit).find(f=>f.kind==='commonPose'&&f.sequence===3);
 const result=openDocument(runOptimizeStage(implicitBytes,'irregularities',{},implicitFix).bytes,'x.mdx').model;assert.deepEqual(pose(result,3,0),[10,0,0]);assert.deepEqual(pose(result,3,1),[0,0,0]);
});

test('conflicting endpoint groups without a majority do not nominate an arbitrary reference',()=>{
 const doc=combatFixture([0,10,20,30,40]);assert.equal(findIrregularities(doc.model).filter(f=>f.kind==='commonPose').length,0);
});

test('duplicate review identifies only affected geosets without animation details',()=>{
 const doc=createStarterDocument();doc.apply('Visible duplicate fixture',['Geosets','Sequences','GeosetAnims'],m=>{
  m.Geosets.push(structuredClone(m.Geosets[0]));const g=m.Geosets[0];g.Vertices=new Float32Array([...g.Vertices,...g.Vertices.slice(0,3)]);g.Normals=new Float32Array([...g.Normals,...g.Normals.slice(0,3)]);g.TVertices=g.TVertices.map(a=>new Float32Array([...a,...a.slice(0,2)]));g.VertexGroup=new Uint8Array(9);g.Faces=new Uint16Array([...g.Faces,8,1,2]);
  m.Sequences=['Stand','Portrait'].map(sequence);m.GeosetAnims=[{GeosetId:0,Flags:0,Color:new Float32Array([1,1,1]),Alpha:{LineType:0,GlobalSeqId:null,Keys:[[0,0],[80,0],[100,1],[180,1]].map(([Frame,v])=>({Frame,Vector:new Float32Array([v])}))}}];
 });const bytes=doc.serialize('mdx'),result=runOptimizeStage(bytes,'duplicates',{});assert.deepEqual(result.review,{stage:'duplicates',geosets:[{index:0}],animations:[],removed:[]});
 assert.deepEqual(runOptimizeStage(bytes,'duplicates',{excludedGeosets:[0]}).review,{stage:'duplicates',geosets:[],animations:[],removed:[]});
});

test('animation review counts a shared-bone change once per animation',()=>{
 const doc=createStarterDocument();doc.apply('Shared animated rig',['Geosets','Bones','Helpers','PivotPoints','Sequences'],m=>{
  m.Geosets.push(structuredClone(m.Geosets[0]),structuredClone(m.Geosets[0]));const independent=createNode(m,'Bone');m.Geosets[2].Groups=[[independent.ObjectId]];
  m.Sequences=['Stand','Attack'].map(sequence);m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[key(0,0),key(40,50),key(80,0),key(100,0),key(140,0),key(180,0)]};
 });const result=runOptimizeStage(doc.serialize('mdx'),'animation',{});
 assert.equal(result.stats.keys,1);assert.deepEqual(result.review,{stage:'animation',geosets:[],animations:[{sequence:1,frame:140,changes:1}],removed:[]});
});

test('unused review names actual removals, not retained resources with renumbered IDs',()=>{
 const doc=createStarterDocument();doc.apply('Unused records',['Geosets','Materials','Textures','Bones','Helpers','PivotPoints','GlobalSequences'],m=>{
  const g=m.Geosets[0];g.Vertices=new Float32Array([...g.Vertices,99,99,99]);g.Normals=new Float32Array([...g.Normals,0,0,1]);g.TVertices=g.TVertices.map(a=>new Float32Array([...a,0,0]));g.VertexGroup=new Uint8Array([...g.VertexGroup,0]);g.Groups.push([...g.Groups[0]]);g.TotalGroupsCount=g.Groups.flat().length;
  m.Materials.unshift(structuredClone(m.Materials[0]));g.MaterialID=1;
  m.Textures.unshift({Image:'Textures\\Unused.blp',ReplaceableId:0,Flags:0});for(const mat of m.Materials)for(const layer of mat.Layers)if(Number.isInteger(layer.TextureID))layer.TextureID++;
  const bone=createNode(m,'Bone');bone.Name='UnusedBone';bone.GeosetId=null;bone.GeosetAnimId=null;
  createNode(m,'Helper').Name='UnusedHelper';
  m.GlobalSequences=[400,400];m.Bones[0].Translation={LineType:1,GlobalSeqId:1,Keys:[key(0,0),key(400,0)]};
 });const bytes=doc.serialize('mdx'),settings={vertices:true,resources:true,nodes:true},result=runOptimizeStage(bytes,'unused',settings);
 assert.deepEqual(result.review.removed,[{geoset:0,label:'Geoset 1: 1 unused vertex, 1 unused bone group'},{label:'Material 1'},{label:'Texture 1: Unused.blp'},{label:'Bone: UnusedBone'},{label:'Helper: UnusedHelper'},{label:'Global sequence 1'}]);
 const after=openDocument(result.bytes,'x.mdx').model;assert.equal(after.Geosets[0].MaterialID,0);assert.equal(after.Bones[0].Translation.GlobalSeqId,0);assert.equal(after.GlobalSequences.length,1);
 assert.deepEqual(runOptimizeStage(bytes,'unused',{...settings,excludedGeosets:[0]}).review.removed.filter(r=>r.geoset!=null),[]);
 assert.deepEqual(runOptimizeStage(bytes,'unused',{}).review.removed,[]);assert.deepEqual(doc.serialize('mdx'),bytes);
});
