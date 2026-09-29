// Optional private teaching pair: damaged 06, authored restoration 07.
// No model names, bone identities or counterpart data enter runtime reduction.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { ModelRenderer } from 'war3-model';
import { Matrix4 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { skinGeoset } from '../src/animation.js';
import { runOptimizeStage, simpleSettings, findIrregularities, sanityProposals } from '../src/optimizexl.js';

const paths=process.argv.slice(2);assert.equal(paths.length,2,'Supply damaged and restored model paths');
const bytes=paths.map(p=>new Uint8Array(fs.readFileSync(p))),models=bytes.map(b=>openDocument(b,'input.mdx').model);
const changed=models[1].Bones.flatMap((n,i)=>isDeepStrictEqual(n,models[0].Bones[i])?[]:[i]);assert.equal(changed.length,1);
const index=changed[0],authored=models[1].Bones[index].Translation,damaged=models[0].Bones[index].Translation;
assert.equal(authored.Keys.length-damaged.Keys.length,4);
models[0].Bones[index].Translation=authored;assert.deepEqual(models[0],models[1]);
const model=models[1],source=bytes[1],sequence=model.Sequences.findIndex(s=>authored.Keys.every(k=>k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1]));assert.ok(sequence>=0);
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const hive=b=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(b.buffer);const {errors,severe,warnings,unused}=ModelViewer.utils.mdlx.sanityTest(m);return {errors,severe,warnings,unused};};
let result;
for(const strength of [0,40,80,100]){
 result=runOptimizeStage(source,'animation',simpleSettings('animation',strength,model));
 assert.deepEqual(result.bytes,source,'Already optimized reference loses no further animation at any tested strength');
}
assert.deepEqual(findIrregularities(model),[]);assert.deepEqual(sanityProposals(model),[]);
assert.deepEqual(hive(result.bytes),{errors:0,severe:0,warnings:0,unused:0});
let pipeline=source;
for(const stage of ['duplicates','animation','unused'])pipeline=runOptimizeStage(pipeline,stage,simpleSettings(stage,100,openDocument(pipeline,'x.mdx').model)).bytes;
const after=openDocument(pipeline,'x.mdx').model;
assert.deepEqual(after.Bones.find(n=>n.Name===model.Bones[index].Name).Translation,authored);
assert.deepEqual(hive(pipeline),{errors:0,severe:0,warnings:0,unused:0});
const a=new ModelRenderer(structuredClone(model)),b=new ModelRenderer(openDocument(result.bytes,'x.mdx').model);
a.setSequence(sequence);b.setSequence(sequence);
const geosets=model.Geosets.flatMap((g,i)=>g.Groups.some(group=>group.includes(model.Bones[index].ObjectId))?[i]:[]);assert.ok(geosets.length);
const posed=(r,frame)=>{r.setFrame(frame);r.updateNode(r.rendererData.rootNode);const matrices=new Map(r.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,new Matrix4().fromArray(n.matrix)]));return geosets.flatMap(i=>Array.from(skinGeoset(r.rendererData.model.Geosets[i],matrices)));};
const interval=model.Sequences[sequence].Interval;let samples=0,vertexSamples=0;
for(let frame=interval[0];frame<=interval[1];frame++){
 const av=posed(a,frame),bv=posed(b,frame);assert.deepEqual(bv,av);samples++;vertexSamples+=av.length/3;
 assert.deepEqual(b.interp.vec3(new Float32Array(3),b.rendererData.model.Bones[index].Translation),a.interp.vec3(new Float32Array(3),authored));
}
for(let i=0;i<paths.length;i++)assert.deepEqual(new Uint8Array(fs.readFileSync(paths[i])),bytes[i]);
console.log(JSON.stringify({passed:true,sequence:model.Sequences[sequence].Name,restoredKeys:4,retainedKeys:authored.Keys.length,maximumStrengthBytesUnchanged:true,wholePipelineRetainsSpeech:true,hive:hive(pipeline),nativeFrames:samples,posedVertexSamples:vertexSamples,maximumDifference:0,originalFilesUnchanged:true}));
