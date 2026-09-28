// Optional supplied-model integration proof; inputs are never rewritten.
// node test/optimizexl-footman.mjs unoptimized.mdx original.mdx [known-good.mdx ...]
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {ModelRenderer} from 'war3-model';import {Matrix4} from 'three';
import {openDocument} from '../src/editor-document.js';import {runOptimizeStage,simpleSettings,sanityProposals} from '../src/optimizexl.js';import {allNodes,skinGeoset} from '../src/animation.js';
import {scanCurveMotion} from '../src/motion-inspector.js';import {findIrregularities} from '../src/optimizexl.js';
import {scanIrregularMotion} from '../src/optimizexl-motion.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const files={'Unoptimized':process.argv[2],'Original':process.argv[3]};if(!files.Original)throw Error('Supply both Footman paths.');
const read=name=>new Uint8Array(fs.readFileSync(files[name]));const source=read('Unoptimized'),model=openDocument(source,'a.mdx').model;
const reports=[];
for(const name of ['Unoptimized','Original']){
 const bytes=read(name),doc=openDocument(bytes,'x.mdx'),before=doc.serialize('mdx');
 const warnings=doc.model.Sequences.flatMap((s,sequenceIndex)=>scanCurveMotion(doc.model,{sequenceIndex}).map(f=>({animation:s.Name,bone:f.nodeName,start:f.start,end:f.end})));
 if(name==='Original'){assert.deepEqual(warnings,[]);assert.deepEqual(scanIrregularMotion(doc.model),[]);}else{assert.ok(warnings.some(f=>f.animation==='Stand - 1'&&f.bone==='Bone_Root'));assert.ok(findIrregularities(doc.model).some(f=>f.kind==='motion'&&f.sequence===0));}
 assert.deepEqual(doc.serialize('mdx'),before);reports.push({name,motionWarnings:warnings});
}
function pose(r,frame){r.setFrame(frame);r.updateNode(r.rendererData.rootNode);const matrices=new Map(r.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,new Matrix4().fromArray(n.matrix)]));return r.rendererData.model.Geosets.flatMap(g=>Array.from(skinGeoset(g,matrices)));}
for(const fix of findIrregularities(model).filter(f=>f.kind==='motion')){
 const result=runOptimizeStage(source,'irregularities',{},fix),next=openDocument(result.bytes,'after.mdx').model;
 const track=next.Nodes[fix.nodeId].Translation,original=model.Nodes[fix.nodeId].Translation;
 assert.deepEqual(track.Keys.map(k=>k.Frame),original.Keys.map(k=>k.Frame));
 const changedTimes=track.Keys.filter((k,i)=>k.Vector.some((v,j)=>v!==original.Keys[i].Vector[j])).map(k=>k.Frame);
 for(const time of changedTimes)assert.ok(fix.bridges.some(s=>time>s.start&&time<s.end));
 if(fix.sequence===0){assert.deepEqual(changedTimes,[833,1033,1067]);assert.deepEqual(fix.bridges,[{start:467,end:900,axis:2},{start:900,end:1233,axis:2}]);}
 const a=new ModelRenderer(structuredClone(model)),b=new ModelRenderer(structuredClone(next));a.setSequence(fix.sequence);b.setSequence(fix.sequence);
 let maxKeyPoseError=0,maxSegmentError=0;
 for(const segment of fix.segments){
  const left=track.Keys.find(k=>k.Frame===segment.start),right=track.Keys.find(k=>k.Frame===segment.end);
  for(const frame of [segment.start,segment.end].filter(t=>!changedTimes.includes(t))){const pa=pose(a,frame),pb=pose(b,frame);for(let i=0;i<pa.length;i++)maxKeyPoseError=Math.max(maxKeyPoseError,Math.abs(pa[i]-pb[i]));}
  for(let j=0;j<=32;j++){const t=j/32;b.setFrame(segment.start+(segment.end-segment.start)*t);const value=b.interp.vec3(new Float32Array(3),track);for(let axis=0;axis<3;axis++)maxSegmentError=Math.max(maxSegmentError,Math.abs(value[axis]-(left.Vector[axis]+(right.Vector[axis]-left.Vector[axis])*t)));}
 }
 assert.ok(maxKeyPoseError<1e-5);assert.ok(maxSegmentError<1e-5);
 // Restore just the intended track edit to prove all other serialized fields match.
 next.Nodes[fix.nodeId].Translation=structuredClone(original);assert.deepEqual(next,model);
 reports.push({motionRepair:model.Sequences[fix.sequence].Name,bone:fix.nodeName,segments:fix.segments.length,changedTimes,maxKeyPoseError,maxSegmentError});
}
// Original is a test oracle only: both body position AND velocity must match.
// A 0.093-unit error at 833 was visually small but made a 1.394-unit/s hitch.
// The earlier 1033/1067 dip repair and the tangent-only repair must be upgradable.
{
 const originalModel=openDocument(read('Original'),'original.mdx').model;
 const fix=scanIrregularMotion(model).find(f=>f.sequence===0&&f.nodeName==='Bone_Root');
 const next=openDocument(runOptimizeStage(source,'irregularities',{},fix).bytes,'after.mdx').model;
 const a=new ModelRenderer(structuredClone(model)),b=new ModelRenderer(structuredClone(next)),o=new ModelRenderer(structuredClone(originalModel));
 for(const r of [a,b,o])r.setSequence(0);
 let previous,previousRef,travel=0,maxSpeed=0,maxOriginalError=0,maxVelocityError=0,maxExtraDip=0;
 for(let frame=167;frame<=1667;frame++){
  b.setFrame(frame);o.setFrame(frame);
  const v=b.interp.vec3(new Float32Array(3),next.Nodes[25].Translation),ref=o.interp.vec3(new Float32Array(3),originalModel.Nodes[25].Translation);
  maxOriginalError=Math.max(maxOriginalError,Math.hypot(...v.map((v,i)=>v-ref[i])));
  maxExtraDip=Math.max(maxExtraDip,-7.289509773254394-v[2]);
  if(previous){const step=Math.hypot(...v.map((x,i)=>x-previous[i]));travel+=step;maxSpeed=Math.max(maxSpeed,step*1000);maxVelocityError=Math.max(maxVelocityError,Math.hypot(...v.map((x,i)=>(x-previous[i]-(ref[i]-previousRef[i]))*1000)));}previous=Array.from(v);previousRef=Array.from(ref);
 }
 assert.ok(maxExtraDip<1e-5);assert.ok(maxSpeed<3.1);assert.ok(maxOriginalError<1e-5);assert.ok(maxVelocityError<.002);assert.ok(travel<4.53);
 assert.deepEqual(scanIrregularMotion(next).filter(f=>f.sequence===0),[]);
 const oldDoc=openDocument(source,'old.mdx');oldDoc.apply('Previous tangent-only repair',['Helpers'],m=>{const t=m.Nodes[25].Translation;for(const s of fix.segments){const l=t.Keys.find(k=>k.Frame===s.start),r=t.Keys.find(k=>k.Frame===s.end);l.OutTan=new Float32Array(r.Vector.map((v,i)=>v-l.Vector[i]));r.InTan=new Float32Array(l.OutTan);}});
 const residual=scanIrregularMotion(oldDoc.model).find(f=>f.sequence===0&&f.nodeId===25);assert.ok(residual?.bridges.length);assert.equal(residual.segments.length,0);
 const corrected=runOptimizeStage(oldDoc.serialize('mdx'),'irregularities',{},residual);
 assert.deepEqual(openDocument(corrected.bytes,'corrected.mdx').model,next);
 const earlierDoc=openDocument(corrected.bytes,'earlier.mdx');earlierDoc.apply('Previously approved dip repair',['Helpers'],m=>{const track=m.Nodes[25].Translation,old=model.Nodes[25].Translation;track.Keys.find(k=>k.Frame===833).Vector=new Float32Array(old.Keys.find(k=>k.Frame===833).Vector);for(let i=1;i<track.Keys.length;i++){const a=track.Keys[i-1],b=track.Keys[i];if(a.Frame>=467&&b.Frame<=900)a.OutTan[2]=b.InTan[2]=b.Vector[2]-a.Vector[2];}});
 const hitch=scanIrregularMotion(earlierDoc.model).find(f=>f.sequence===0&&f.nodeId===25);assert.deepEqual(hitch.bridges,[{start:467,end:900,axis:2}]);
 assert.deepEqual(openDocument(runOptimizeStage(earlierDoc.serialize('mdx'),'irregularities',{},hitch).bytes,'corrected.mdx').model,next);
 reports.push({stand1JitterRemoved:true,changedPoses:[833,1033,1067],nativeSamples:1501,maxExtraDip,maxSpeed,maxOriginalError,maxVelocityError,travel,repairsPreviouslyApprovedTangentFix:true,repairsPreviouslyApprovedDipFix:true});
}
for(const strength of [0,40,100]){
 const result=runOptimizeStage(source,'animation',simpleSettings('animation',strength,model)),next=openDocument(result.bytes,'b.mdx').model,a=new ModelRenderer(structuredClone(model)),b=new ModelRenderer(structuredClone(next));let maxVertexError=0,samples=0,maxRotation=0,maxTranslation=0,maxScale=0;
 assert.deepEqual(model.Geosets,next.Geosets);assert.deepEqual(model.Sequences,next.Sequences);
 for(let si=0;si<model.Sequences.length;si++){
  const [lo,hi]=model.Sequences[si].Interval,times=new Set([lo,hi]);for(let i=0;i<=200;i++)times.add(lo+(hi-lo)*i/200);
  for(const n of allNodes(model))for(const p of ['Translation','Rotation','Scaling']){const keys=(n[p]?.Keys||[]).filter(k=>k.Frame>=lo&&k.Frame<=hi);for(let i=0;i<keys.length;i++){times.add(keys[i].Frame);if(keys[i+1])for(let j=1;j<16;j++)times.add(keys[i].Frame+(keys[i+1].Frame-keys[i].Frame)*j/16);}}
  a.setSequence(si);b.setSequence(si);
  for(const frame of times){const pa=pose(a,frame),pb=pose(b,frame);for(let i=0;i<pa.length;i+=3)maxVertexError=Math.max(maxVertexError,Math.hypot(pa[i]-pb[i],pa[i+1]-pb[i+1],pa[i+2]-pb[i+2]));samples++;
   for(const n of allNodes(model))for(const p of ['Translation','Rotation','Scaling']){if(!n[p]?.Keys)continue;const bn=next.Nodes[n.ObjectId],method=p==='Rotation'?'quat':'vec3',x=a.interp[method](new Float32Array(p==='Rotation'?4:3),n[p]),y=b.interp[method](new Float32Array(p==='Rotation'?4:3),bn[p]);if(!x||!y)continue;if(p==='Rotation'){const dot=Math.min(1,Math.abs(Array.from(x).reduce((v,q,i)=>v+q*y[i],0)/(Math.hypot(...x)*Math.hypot(...y))));maxRotation=Math.max(maxRotation,2*Math.acos(dot)*180/Math.PI);}else{const delta=Math.hypot(...Array.from(x,(v,i)=>v-y[i]));if(p==='Translation')maxTranslation=Math.max(maxTranslation,delta);else maxScale=Math.max(maxScale,delta);}}
  }
 }
 const tolerances=simpleSettings('animation',strength,model);assert.ok(maxRotation<=tolerances.rotation+1e-4);assert.ok(maxTranslation<=tolerances.position+1e-4);assert.ok(maxScale<=tolerances.scale+1e-4);if(!strength)assert.ok(maxVertexError<.001);
 assert.ok(scanCurveMotion(next).some(f=>f.nodeName==='Bone_Root'),'Reducing file size must not conceal the remaining motion warning');
 reports.push({strength,bytes:result.afterBytes,keysRemoved:result.stats.keys,samples,maxVertexError,maxRotation,maxTranslation,maxScale});
}
for(const duplicateStrength of [0,100]){
 let bytes=source;for(const stage of ['duplicates','animation','unused'])bytes=runOptimizeStage(bytes,stage,simpleSettings(stage,stage==='duplicates'?duplicateStrength:100,openDocument(bytes,'stage.mdx').model)).bytes;
 const beforeRepair=openDocument(bytes,'x.mdx').model,fix=sanityProposals(beforeRepair).find(f=>f.kind==='bounds');bytes=runOptimizeStage(bytes,'sanity',{},fix).bytes;
 const after=openDocument(bytes,'x.mdx').model,h=new ModelViewer.parsers.mdlx.Model();h.load(bytes.buffer);const {errors,severe,warnings,unused}=ModelViewer.utils.mdlx.sanityTest(h);
 assert.equal(errors+severe+warnings,0);assert.ok(bytes.length<read('Original').length);assert.deepEqual(after.Geosets.map(g=>g.Faces.length),model.Geosets.map(g=>g.Faces.length));assert.deepEqual(after.CollisionShapes,model.CollisionShapes);
 reports.push({duplicateStrength,animationStrength:100,bytes:bytes.length,noPolygonReduction:true,hive:{errors,severe,warnings,unused}});
}
for(const name of ['Unoptimized','Original']){const bytes=read(name),m=openDocument(bytes,'x.mdx').model,fix=sanityProposals(m).find(f=>f.kind==='bounds'),r=runOptimizeStage(bytes,'sanity',{},fix),h=new ModelViewer.parsers.mdlx.Model();h.load(r.bytes.buffer);const {errors,severe,warnings,unused}=ModelViewer.utils.mdlx.sanityTest(h);assert.equal(warnings,0);assert.equal(errors+severe,0);reports.push({name,repairedBounds:fix.targets.length,hive:{errors,severe,warnings,unused}});assert.deepEqual(read(name),bytes);}
for(const path of process.argv.slice(4)){const bytes=fs.readFileSync(path),m=openDocument(bytes,'known-good.mdx').model;assert.deepEqual(scanIrregularMotion(m),[]);assert.deepEqual(fs.readFileSync(path),bytes);reports.push({knownGood:path,sequences:m.Sequences.length,newMotionProposals:0,unchanged:true});}
if(process.env.MDLXL_FOOTMAN_REPORT)fs.writeFileSync(process.env.MDLXL_FOOTMAN_REPORT,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
