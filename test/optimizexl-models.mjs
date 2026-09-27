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

vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'),{filename:'hive-viewer.js'});
function sanity(bytes){const m=new globalThis.ModelViewer.parsers.mdlx.Model();m.load(new Uint8Array(bytes).buffer);const {errors,severe,warnings,unused}=globalThis.ModelViewer.utils.mdlx.sanityTest(m);return {errors,severe,warnings,unused};}
function pose(model,sequence,frame){const r=new ModelRenderer(structuredClone(model));r.setSequence(sequence);r.setFrame(frame);r.updateNode(r.rendererData.rootNode);const matrices=new Map(r.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,new Matrix4().fromArray(n.matrix)]));return model.Geosets.flatMap(g=>Array.from(skinGeoset(g,matrices)));}
function difference(a,b){assert.equal(a.length,b.length);return Math.max(0,...a.map((v,i)=>Math.abs(v-b[i])));}

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
 apply('nuclear',simpleSettings('nuclear',40,openDocument(bytes,'x.mdx').model));
 assert.deepEqual(new Uint8Array(fs.readFileSync(file)),original);
 results.push({file,originalBytes:original.length,afterBytes:bytes.length,cleanupPoseDifference,deathTransitionDifference,irregularities:findings.map(f=>f.label),steps,sourceUnchanged:true});
}
if(!results.length)throw Error('Supply at least one MDX model path.');
console.log(JSON.stringify(results,null,2));
