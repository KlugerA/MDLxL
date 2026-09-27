import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { runOptimizeStage, simpleSettings, findIrregularities, SPHERE_PRESETS, triangleCount } from '../src/optimizexl.js';
import { OptimizeXLSession } from '../src/optimizexl-session.js';
import { sampleNodeMatrices } from '../src/animation.js';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';
const {saveOptimizeXLPair}=createRequire(import.meta.url)('../electron/optimizexl-save.cjs');
const fixture=()=>createStarterDocument().serialize('mdx');
const sequence=(Name='Stand',start=0,end=1000)=>({Name,Interval:new Uint32Array([start,end]),MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,MoveSpeed:0,NonLooping:false,Rarity:0});
test('unused globals retain event-only references and remap tracks including index zero',()=>{
 const doc=createStarterDocument();doc.apply('global fixture',['GlobalSequences','Bones','EventObjects','PivotPoints'],m=>{
  m.GlobalSequences=[100,200,300,400];m.Bones[0].Translation={LineType:1,GlobalSeqId:2,Keys:[{Frame:0,Vector:new Float32Array(3)}]};
  createNode(m,'EventObject').GlobalSeqId=0;
 });
 const result=runOptimizeStage(doc.serialize('mdx'),'unused',{resources:true}),m=openDocument(result.bytes,'x.mdx').model;
 assert.deepEqual(m.GlobalSequences,[100,300]);assert.equal(m.Bones[0].Translation.GlobalSeqId,1);assert.equal(m.EventObjects[0].GlobalSeqId,0);
});
test('sphere presets replace collision-only parent chains, preserving other nodes and data',()=>{
 const doc=createStarterDocument();doc.apply('collision chain',['CollisionShapes','PivotPoints'],m=>{
  const first=createNode(m,'CollisionShape'),second=createNode(m,'CollisionShape');second.Parent=first.ObjectId;
 });const bytes=doc.serialize('mdx'),before=openDocument(bytes,'x.mdx').model;
 const result=runOptimizeStage(bytes,'spheres',{size:1,preset:4,spheres:SPHERE_PRESETS[4].spheres}),m=openDocument(result.bytes,'x.mdx').model;
 assert.equal(m.CollisionShapes.length,3);assert.ok(m.CollisionShapes.every(n=>n.Parent==null));assert.deepEqual(m.Geosets,before.Geosets);assert.deepEqual(m.Bones,before.Bones);
});
test('equivalent leaf bone merging retains the skinned pose and does not merge different pivots',()=>{
 const doc=createStarterDocument();doc.apply('bone fixture',['Bones','Geosets','PivotPoints','Sequences'],m=>{
  m.Sequences=[sequence()];const first=m.Bones[0],second=createNode(m,'Bone');const id=second.ObjectId;Object.assign(second,structuredClone(first),{ObjectId:id,Name:'Duplicate'});m.PivotPoints[id]=new Float32Array(first.PivotPoint);
  m.Geosets[0].Groups.push([id]);m.Geosets[0].TotalGroupsCount++;m.Geosets[0].VertexGroup[0]=1;
 });const bytes=doc.serialize('mdx'),a=openDocument(bytes,'x.mdx').model,result=runOptimizeStage(bytes,'duplicates',{bones:true}),b=openDocument(result.bytes,'x.mdx').model;
 assert.equal(result.stats.duplicateBones,1);const oldId=a.Geosets[0].Groups[a.Geosets[0].VertexGroup[0]][0],newId=b.Geosets[0].Groups[b.Geosets[0].VertexGroup[0]][0];assert.deepEqual(sampleNodeMatrices(a,500,0).get(oldId),sampleNodeMatrices(b,500,0).get(newId));
 doc.apply('distinct pivot',['Bones','PivotPoints'],m=>{m.PivotPoints[1][0]+=10;m.Bones[1].PivotPoint=m.PivotPoints[1];});assert.equal(runOptimizeStage(doc.serialize('mdx'),'duplicates',{bones:true}).stats.duplicateBones,0);
});
test('Death to Decay Flesh repair matches the endpoint and preserves later decay motion',()=>{
 const doc=createStarterDocument();doc.apply('death fixture',['Sequences','Bones'],m=>{
  m.Sequences=[sequence('Death',0,1000),sequence('Decay Flesh',2000,3000)];m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[[0,0],[1000,10],[2000,30],[2500,35],[3000,40]].map(([Frame,x])=>({Frame,Vector:new Float32Array([x,0,0])}))};
 });const bytes=doc.serialize('mdx'),before=openDocument(bytes,'x.mdx').model,fix=findIrregularities(before).find(f=>f.label==='Death → Decay Flesh pose mismatch');assert.ok(fix);
 const m=openDocument(runOptimizeStage(bytes,'irregularities',{},fix).bytes,'x.mdx').model;
 assert.deepEqual(sampleNodeMatrices(m,1000,0),sampleNodeMatrices(m,2000,1));assert.deepEqual(m.Bones[0].Translation.Keys.filter(k=>k.Frame>=2500),before.Bones[0].Translation.Keys.filter(k=>k.Frame>=2500));
});
test('Hive findings include unused objects with no child messages and severe findings',()=>{
 const findings=flattenHiveFindings([{type:'node',name:'Texture 0',uses:0,nodes:[]},{type:'node',name:'Geoset 0',nodes:[{type:'severe',message:'Broken face'}]}]);
 assert.equal(findings.length,2);assert.equal(findings[0].type,'unused');assert.equal(findings[1].type,'severe');
});
test('each candidate starts from accepted bytes; approval, skipping and Back never mutate source',()=>{
 const source=fixture(),session=new OptimizeXLSession(source,'original.mdx'),original=new Uint8Array(source);
 const model=openDocument(source,'x.mdx').model,settings=simpleSettings('spheres',0,model);settings.preset=4;settings.spheres=SPHERE_PRESETS[4].spheres;
 const result=runOptimizeStage(source,'spheres',settings);assert.ok(session.propose(result,0));assert.deepEqual(session.accepted,source);
 session.approve('spheres',settings);assert.equal(openDocument(session.accepted,'x.mdx').model.CollisionShapes.length,3);
 assert.equal(session.propose(result,0),false);session.skip('nuclear');assert.equal(session.savePayload().nuclear,false);session.back();session.back();assert.deepEqual(session.accepted,original);assert.deepEqual(source,original);
});
test('duplicate vertices preserve distinct UVs, normals, bindings and all faces',()=>{
 const doc=createStarterDocument();doc.apply('fixture',['Geosets'],m=>{const g=m.Geosets[0];g.Vertices=new Float32Array([0,0,0,1,0,0,0,1,0,0,0,0,0,0,0]);g.Normals=new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1]);g.TVertices=[new Float32Array([0,0,1,0,0,1,0,0,.1,0])];g.VertexGroup=new Uint8Array(5);g.Faces=new Uint16Array([0,1,2,3,1,2,4,1,2]);});
 const bytes=doc.serialize('mdx'),result=runOptimizeStage(bytes,'duplicates',{position:0,normal:0,uv:0,bones:false}),m=openDocument(result.bytes,'x.mdx').model;
 assert.equal(result.stats.duplicateVertices,1);assert.equal(m.Geosets[0].Faces.length,9);assert.equal(m.Geosets[0].Vertices.length/3,4);
});
test('animation strength removes linear keys but preserves boundaries and visibility events',()=>{
 const doc=createStarterDocument();doc.apply('keys',['Sequences','Bones','GeosetAnims'],m=>{m.Sequences=[sequence()];const [a,b]=m.Sequences[0].Interval;m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[a,(a+b)/2,b].map((Frame,i)=>({Frame,Vector:new Float32Array([i,0,0])}))};m.GeosetAnims=[{GeosetId:0,Alpha:{LineType:0,GlobalSeqId:null,Keys:[{Frame:a,Vector:new Float32Array([1])},{Frame:(a+b)/2,Vector:new Float32Array([0])},{Frame:b,Vector:new Float32Array([1])}]},Flags:0,Color:new Float32Array([1,1,1])}];});
 const bytes=doc.serialize('mdx'),result=runOptimizeStage(bytes,'animation',{position:.01,rotation:0,scale:0}),a=openDocument(bytes,'x.mdx').model,b=openDocument(result.bytes,'x.mdx').model;assert.equal(result.stats.keys,1);assert.equal(b.Bones[0].Translation.Keys.length,2);assert.deepEqual(a.GeosetAnims,b.GeosetAnims);
});
test('irregularity repair proposals keep untouched sequences and require explicit selected repair',()=>{
 const doc=createStarterDocument();doc.apply('visibility',['Sequences','GeosetAnims'],m=>{m.Sequences=Array.from({length:4},(_,i)=>sequence(i===3?'Portrait':i===0?'Stand':'Attack '+i,1000*i,1000*i+500));m.GeosetAnims=[{GeosetId:0,Flags:0,Color:new Float32Array([1,1,1]),Alpha:{LineType:0,GlobalSeqId:null,Keys:[{Frame:1000,Vector:new Float32Array([0])},{Frame:2000,Vector:new Float32Array([0])},{Frame:3000,Vector:new Float32Array([1])}]}}];});
 const bytes=doc.serialize('mdx'),model=openDocument(bytes,'x.mdx').model,fix=findIrregularities(model).find(f=>f.kind==='hide');assert.ok(fix);
 assert.deepEqual(runOptimizeStage(bytes,'irregularities',{}).bytes,bytes);
 const result=runOptimizeStage(bytes,'irregularities',{},fix),after=openDocument(result.bytes,'x.mdx').model;assert.equal(after.GeosetAnims[0].Alpha.Keys.find(k=>k.Frame===0).Vector[0],0);assert.deepEqual(after.GeosetAnims[0].Alpha.Keys.filter(k=>k.Frame>=1000),model.GeosetAnims[0].Alpha.Keys);
});
test('nuclear is reversible at zero; real edge collapses reduce bytes and respect target',()=>{
 const doc=createStarterDocument();doc.apply('grid',['Geosets'],m=>{const g=m.Geosets[0],v=[],n=[],uv=[],f=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){v.push(x,y,0);n.push(0,0,1);uv.push(x/8,y/8);}for(let y=0;y<7;y++)for(let x=0;x<7;x++){let a=y*8+x;f.push(a,a+1,a+8,a+1,a+9,a+8);}g.Vertices=new Float32Array(v);g.Normals=new Float32Array(n);g.TVertices=[new Float32Array(uv)];g.VertexGroup=new Uint8Array(64);g.Faces=new Uint16Array(f);});
 const bytes=doc.serialize('mdx'),model=openDocument(bytes,'grid.mdx').model;
 const zero=runOptimizeStage(bytes,'nuclear',simpleSettings('nuclear',0,model));assert.deepEqual(zero.bytes,bytes);
 const settings={...simpleSettings('nuclear',65,model),protectSeams:false,protectNormals:false,error:100},result=runOptimizeStage(bytes,'nuclear',settings),after=openDocument(result.bytes,'after.mdx').model;
 assert.ok(triangleCount(after)<triangleCount(model));assert.ok(result.saved>0);assert.ok(triangleCount(after)>=settings.target);assert.deepEqual(after.CollisionShapes,model.CollisionShapes);assert.deepEqual(runOptimizeStage(bytes,'nuclear',simpleSettings('nuclear',0,model)).bytes,bytes);
 const faces=after.Geosets[0].Faces,keys=Array.from({length:faces.length/3},(_,i)=>Array.from(faces.slice(i*3,i*3+3)).sort((a,b)=>a-b).join(':'));assert.equal(new Set(keys).size,keys.length);
});
test('save creates exactly two verified new files, numbers collisions, and never touches original',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'optimizexl-')),bytes=fixture();try{
  const original=path.join(dir,'source.mdx');await fs.writeFile(original,bytes);const payload={name:'source.mdx',before:bytes,after:bytes,nuclear:true};
  const [a,b]=await Promise.all([saveOptimizeXLPair(dir,payload),saveOptimizeXLPair(dir,payload)]);
  assert.notEqual(a.before,b.before);assert.match(a.after,/NUCLEAR/);assert.equal((await fs.readdir(dir)).length,5);
  for(const f of [original,a.before,a.after,b.before,b.after])assert.deepEqual(new Uint8Array(await fs.readFile(f)),bytes);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('failed second write removes only the newly created pair and reports failure',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'optimizexl-fail-')),bytes=fixture();try{
  const original=path.join(dir,'source.mdx');await fs.writeFile(original,bytes);let opens=0;
  const io={...fs,open:async(...args)=>{const handle=await fs.open(...args);if(++opens===2)return {writeFile:async()=>{throw Error('disk full');},sync:()=>handle.sync(),close:()=>handle.close()};return handle;}};
  await assert.rejects(saveOptimizeXLPair(dir,{name:'source.mdx',before:bytes,after:bytes},io),/disk full/);assert.deepEqual(await fs.readdir(dir),['source.mdx']);assert.deepEqual(new Uint8Array(await fs.readFile(original)),bytes);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
