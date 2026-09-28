// Optional integration check against user-supplied files; never rewrites them.
// node test/optimizexl-models.mjs path/to/flail.mdx path/to/axe.mdx
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { ModelRenderer } from 'war3-model';
import { Matrix4 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { skinGeoset } from '../src/animation.js';
import { findIrregularities, runOptimizeStage, simpleSettings, SPHERE_PRESETS } from '../src/optimizexl.js';
import { prepareNuclearReduction } from '../src/optimizexl-geometry.js';
await prepareNuclearReduction();

vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'),{filename:'hive-viewer.js'});
function sanity(bytes){const m=new globalThis.ModelViewer.parsers.mdlx.Model();m.load(new Uint8Array(bytes).buffer);const {errors,severe,warnings,unused}=globalThis.ModelViewer.utils.mdlx.sanityTest(m);return {errors,severe,warnings,unused};}
function pose(model,sequence,frame){const r=new ModelRenderer(structuredClone(model));r.setSequence(sequence);r.setFrame(frame);r.updateNode(r.rendererData.rootNode);const matrices=new Map(r.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,new Matrix4().fromArray(n.matrix)]));return model.Geosets.flatMap(g=>Array.from(skinGeoset(g,matrices)));}
function difference(a,b){assert.equal(a.length,b.length);return Math.max(0,...a.map((v,i)=>Math.abs(v-b[i])));}
function retainedPoseDifference(before,after){
 const vertexMap=[];let offset=0;
 const record=(g,i)=>JSON.stringify([Array.from(g.Vertices.slice(i*3,i*3+3)),Array.from(g.Normals.slice(i*3,i*3+3)),g.TVertices.map(uv=>Array.from(uv.slice(i*2,i*2+2))),g.Groups[g.VertexGroup[i]]]);
 before.Geosets.forEach((g,gi)=>{const original=new Map(Array.from({length:g.Vertices.length/3},(_,i)=>[record(g,i),offset+i]));const next=after.Geosets[gi];for(let i=0;i<next.Vertices.length/3;i++){const source=original.get(record(next,i));assert.ok(source!==undefined,'Nuclear must retain authored vertex attributes and bindings');vertexMap.push(source);}offset+=g.Vertices.length/3;});
 let maximum=0;
 for(let si=0;si<before.Sequences.length;si++){const [lo,hi]=before.Sequences[si].Interval;for(let j=0;j<=8;j++){const frame=lo+(hi-lo)*j/8,a=pose(before,si,frame),b=pose(after,si,frame);for(let i=0;i<vertexMap.length;i++)for(let axis=0;axis<3;axis++)maximum=Math.max(maximum,Math.abs(a[vertexMap[i]*3+axis]-b[i*3+axis]));}}
 assert.ok(maximum<1e-5,`Nuclear changed retained vertex motion by ${maximum}`);return maximum;
}

const results=[];
for(const file of process.argv.slice(2)){
 const original=new Uint8Array(fs.readFileSync(file));let bytes=original;const steps=[];
 const apply=(stage,settings,fix)=>{const result=runOptimizeStage(bytes,stage,settings,fix);bytes=result.bytes;steps.push({stage,saved:result.saved,stats:result.stats,hive:sanity(bytes)});assert.equal(steps.at(-1).hive.errors,0);assert.equal(steps.at(-1).hive.severe,0);};
 for(const stage of ['duplicates','animation','unused'])apply(stage,simpleSettings(stage,0,openDocument(bytes,'x.mdx').model));
 const m=openDocument(bytes,'x.mdx').model,originalModel=openDocument(original,'x.mdx').model;
 let cleanupPoseDifference=0;for(let si=0;si<m.Sequences.length;si++){const [lo,hi]=m.Sequences[si].Interval;for(let j=0;j<=8;j++)cleanupPoseDifference=Math.max(cleanupPoseDifference,difference(pose(originalModel,si,lo+(hi-lo)*j/8),pose(m,si,lo+(hi-lo)*j/8)));}
 assert.ok(cleanupPoseDifference<1e-5,`Exact cleanup changed sampled poses by ${cleanupPoseDifference}`);
 const findings=findIrregularities(m),transition=findings.find(f=>f.label==='Death → Decay Flesh pose mismatch');
 let deathTransitionDifference;
 if(transition){apply('irregularities',{},transition);const repaired=openDocument(bytes,'x.mdx').model;deathTransitionDifference=difference(pose(repaired,transition.from,transition.fromFrame),pose(repaired,transition.sequence,transition.frame));assert.ok(deathTransitionDifference<1e-5,`Death transition mismatch ${deathTransitionDifference}`);}
 apply('spheres',{size:1,preset:4,spheres:SPHERE_PRESETS[4].spheres});
 const nuclearBaseline=bytes,nuclearModel=openDocument(bytes,'x.mdx').model;
 apply('nuclear',simpleSettings('nuclear',40,openDocument(bytes,'x.mdx').model));
 const nuclearRetainedPoseDifference=retainedPoseDifference(nuclearModel,openDocument(bytes,'x.mdx').model);
 const maximum=runOptimizeStage(nuclearBaseline,'nuclear',simpleSettings('nuclear',100,nuclearModel)),maximumHive=sanity(maximum.bytes);
 assert.deepEqual(maximumHive,{errors:0,severe:0,warnings:0,unused:0});
 const nuclearMaximum={saved:maximum.saved,stats:maximum.stats,hive:maximumHive,retainedPoseDifference:retainedPoseDifference(nuclearModel,openDocument(maximum.bytes,'x.mdx').model)};
 assert.deepEqual(new Uint8Array(fs.readFileSync(file)),original);
 results.push({file,originalBytes:original.length,afterBytes:bytes.length,cleanupPoseDifference,deathTransitionDifference,nuclearRetainedPoseDifference,nuclearMaximum,irregularities:findings.map(f=>f.label),steps,sourceUnchanged:true});
}
if(!results.length)throw Error('Supply at least one MDX model path.');
console.log(JSON.stringify(results,null,2));
