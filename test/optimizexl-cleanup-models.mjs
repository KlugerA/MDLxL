import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { ModelRenderer } from 'war3-model';
import { openDocument } from '../src/editor-document.js';
import { sampleTrack } from '../src/animation.js';
import { sanityProposals, runOptimizeStage, SPHERE_PRESETS } from '../src/optimizexl.js';
import { effectVisibilityProposals } from '../src/optimizexl-effect-visibility.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js', import.meta.url), 'utf8'));
const sanity = bytes => {const m=new ModelViewer.parsers.mdlx.Model();m.load(bytes.buffer);const r=ModelViewer.utils.mdlx.sanityTest(m);return {errors:r.errors,severe:r.severe,warnings:r.warnings,unused:r.unused};};
const read = bytes => openDocument(bytes,'x.mdx').model;
const batch = (source,stage,fixes) => runOptimizeStage(source,stage,{}, {kind:'batch',stage,entries:fixes.map(fix=>({fix,settings:{}}))}).bytes;
const at = (m,path) => path.reduce((v,k)=>v[k],m);
for (const path of process.argv.slice(2)) {
  const source=new Uint8Array(fs.readFileSync(path)),before=read(source),fixes=sanityProposals(before);
  assert.equal(fixes.filter(f=>f.kind==='unusedLocalKeys').length,3);
  const cleaned=batch(source,'sanity',fixes),after=read(cleaned);
  assert.deepEqual(sanity(cleaned),{errors:0,severe:0,warnings:0,unused:0});
  assert.deepEqual(sanityProposals(after),[]);
  const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after));
  const paths=[...new Map(fixes.map(f=>[f.path.join('.'),f.path])).values()]; let samples=0;
  for(let si=0;si<before.Sequences.length;si++) {a.setSequence(si);b.setSequence(si);
    for(let f=before.Sequences[si].Interval[0];f<=before.Sequences[si].Interval[1];f++) {a.setFrame(f);b.setFrame(f);
      for(const p of paths){const property=p.at(-1),ta=at(before,p),tb=at(after,p);
        const evaluate=(r,t)=>property==='Rotation'?r.interp.quat(new Float32Array(4),t):property==='Translation'?r.interp.vec3(new Float32Array(3),t):r.interp.num(t);
        assert.deepEqual(evaluate(a,ta),evaluate(b,tb));samples++;
      }
    }
  }
  for(const p of paths) at(after,p.slice(0,-1))[p.at(-1)]=structuredClone(at(before,p));
  assert.deepEqual(after,before,'Only the proposed local tracks changed');
  const cleanModel=read(cleaned),effects=effectVisibilityProposals(cleanModel);
  assert.deepEqual(effects.map(f=>[f.geoset,f.sequence]),[[48,7],[48,8],[48,10]]);
  const repaired=batch(cleaned,'irregularities',effects),final=read(repaired);
  assert.deepEqual(effectVisibilityProposals(final),[]);
  assert.deepEqual(sanity(repaired),{errors:0,severe:0,warnings:0,unused:0});
  for(let si=0;si<before.Sequences.length;si++) {
    const interval=before.Sequences[si].Interval,expected=[7,8,10].includes(si)?0:1;
    const alpha=final.GeosetAnims.find(g=>g.GeosetId===48).Alpha;
    for(let f=interval[0];f<=interval[1];f++) assert.equal(sampleTrack(alpha,f,{interval,fallback:1}),expected);
  }
  final.GeosetAnims=cleanModel.GeosetAnims;final.Info.NumGeosetAnims=cleanModel.Info.NumGeosetAnims;
  assert.deepEqual(final,cleanModel,'Glow correction changes only the target visibility track');
  assert.deepEqual(new Uint8Array(fs.readFileSync(path)),source);
  console.log(JSON.stringify({file:path.split(/[\\/]/).at(-1),hive:sanity(repaired),unchangedNativeChannelSamples:samples,glowFixes:effects.map(f=>f.label),sourceUnchanged:true}));
}
if(process.env.MDLXL_FOOTMAN_REFERENCE){
  const m=read(new Uint8Array(fs.readFileSync(process.env.MDLXL_FOOTMAN_REFERENCE)));
  assert.deepEqual(SPHERE_PRESETS[1].spheres,m.CollisionShapes.map(c=>[...c.Vertices,c.BoundsRadius]));
  console.log('Standard preset matches both authored Footman spheres exactly.');
}
