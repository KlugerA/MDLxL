// Private fixtures stay outside Git. Supply the encountered model path.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ModelRenderer} from 'war3-model';
import {openDocument} from '../src/editor-document.js';
import {sanityProposals,runOptimizeStage} from '../src/optimizexl.js';
import {assertRoundTripFields} from '../src/model-optimizer.js';
import {flattenHiveFindings} from '../app/optimizexl-hive.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const at=(m,p)=>p.reduce((v,k)=>v[k],m),hash=b=>createHash('sha256').update(b).digest('hex');
const hive=bytes=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(bytes.slice().buffer);const r=ModelViewer.utils.mdlx.sanityTest(m);return {errors:r.errors,severe:r.severe,warnings:r.warnings,unused:r.unused,findings:flattenHiveFindings(r.nodes)};};
for(const path of process.argv.slice(2)){
  const source=new Uint8Array(fs.readFileSync(path)),before=openDocument(source,'x.mdx').model,plans=[];
  let bytes=source;
  for(let pass=0;pass<10;pass++){
    const model=openDocument(bytes,'x.mdx').model,fixes=sanityProposals(model).filter(f=>!f.inspectionOnly);
    if(!fixes.length)break;
    const batch=runOptimizeStage(bytes,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes;
    for(const order of [fixes,[...fixes].reverse()]){
      let individual=bytes;
      for(const old of order){const current=sanityProposals(openDocument(individual,'x.mdx').model).find(f=>f.id===old.id);assert.ok(current);individual=runOptimizeStage(individual,'sanity',{},current).bytes;}
      assert.deepEqual(individual,batch,'Batch and both individual approval orders agree');
    }
    plans.push(...fixes);bytes=batch;
  }
  const after=openDocument(bytes,'x.mdx').model,clean=hive(bytes);
  assert.equal(clean.errors+clean.severe+clean.warnings+clean.unused,0);
  assert.ok(!sanityProposals(after).some(f=>!f.inspectionOnly));
  const paths=[...new Map(plans.filter(f=>f.path).map(f=>[f.path.join('.'),f.path])).values()];
  const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after));
  let samples=0,maxComponentError=0;
  for(let si=0;si<before.Sequences.length;si++){
    a.setSequence(si);b.setSequence(si);const [lo,hi]=before.Sequences[si].Interval;
    for(let frame=lo;frame<=hi;frame+=.25){a.setFrame(frame);b.setFrame(frame);
      for(const p of paths){const rotation=p.at(-1)==='Rotation',x=rotation?a.interp.quat(new Float32Array(4),at(before,p)):a.interp.vec3(new Float32Array(3),at(before,p)),y=rotation?b.interp.quat(new Float32Array(4),at(after,p)):b.interp.vec3(new Float32Array(3),at(after,p));
        if(x===null||y===null)assert.equal(x,y);else maxComponentError=Math.max(maxComponentError,...Array.from(x,(v,i)=>Math.abs(v-y[i])));samples++;
      }
    }
  }
  assert.ok(maxComponentError<.001);
  const expected=structuredClone(before);
  for(const p of paths)at(expected,p.slice(0,-1))[p.at(-1)]=at(after,p);
  assertRoundTripFields(expected,after);
  assert.deepEqual(new Uint8Array(fs.readFileSync(path)),source);
  console.log(JSON.stringify({file:path,inputSHA256:hash(source),outputSHA256:hash(bytes),beforeBytes:source.length,afterBytes:bytes.length,beforeHive:hive(source),afterHive:clean,plans:plans.map(({signature,track,...f})=>f),samples,maxComponentError,approvalOrdersAgree:true,otherDataUnchanged:true,sourceUnchanged:true},null,2));
}
