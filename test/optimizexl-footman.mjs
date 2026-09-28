// Optional supplied-model integration proof; inputs are never rewritten.
// node test/optimizexl-footman.mjs unoptimized.mdx original.mdx
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {ModelRenderer} from 'war3-model';import {Matrix4} from 'three';
import {openDocument} from '../src/editor-document.js';import {runOptimizeStage,simpleSettings,sanityProposals} from '../src/optimizexl.js';import {allNodes,skinGeoset} from '../src/animation.js';
import {scanCurveMotion} from '../src/motion-inspector.js';import {findIrregularities} from '../src/optimizexl.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const files={'Unoptimized':process.argv[2],'Original':process.argv[3]};if(!files.Original)throw Error('Supply both Footman paths.');
const read=name=>new Uint8Array(fs.readFileSync(files[name]));const source=read('Unoptimized'),model=openDocument(source,'a.mdx').model;
const reports=[];
for(const name of ['Unoptimized','Original']){
 const bytes=read(name),doc=openDocument(bytes,'x.mdx'),before=doc.serialize('mdx');
 const warnings=doc.model.Sequences.flatMap((s,sequenceIndex)=>scanCurveMotion(doc.model,{sequenceIndex}).map(f=>({animation:s.Name,bone:f.nodeName,start:f.start,end:f.end})));
 if(name==='Original')assert.deepEqual(warnings,[]);else{assert.ok(warnings.some(f=>f.animation==='Stand - 1'&&f.bone==='Bone_Root'));assert.ok(findIrregularities(doc.model).some(f=>f.kind==='motion'&&f.sequence===0&&f.inspectionOnly));}
 assert.deepEqual(doc.serialize('mdx'),before);reports.push({name,motionWarnings:warnings});
}
function pose(r,frame){r.setFrame(frame);r.updateNode(r.rendererData.rootNode);const matrices=new Map(r.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,new Matrix4().fromArray(n.matrix)]));return r.rendererData.model.Geosets.flatMap(g=>Array.from(skinGeoset(g,matrices)));}
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
if(process.env.MDLXL_FOOTMAN_REPORT)fs.writeFileSync(process.env.MDLXL_FOOTMAN_REPORT,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
