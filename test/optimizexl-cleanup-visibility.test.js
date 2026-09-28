import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument } from '../src/editor-document.js';
import { ModelRenderer } from 'war3-model';
import { sampleTrack } from '../src/animation.js';
import { sanityProposals, runOptimizeStage, SPHERE_PRESETS } from '../src/optimizexl.js';
import { effectVisibilityProposals } from '../src/optimizexl-effect-visibility.js';
const seq = (Name,a,b) => ({Name,Interval:new Uint32Array([a,b]),MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,MoveSpeed:0,NonLooping:false,Rarity:0});
const key = (Frame,v) => ({Frame,Vector:new Float32Array(v)});
const track = (Keys,LineType=0) => ({Keys,LineType,GlobalSeqId:null});
function fixture() {
  const d=createStarterDocument();
  d.apply('Attached glow', ['Sequences','Geosets','Materials','GeosetAnims'], m => {
    m.Sequences=[seq('A',100,200),seq('B',300,400),seq('C',500,600)];
    m.Materials[0].Layers[0].FilterMode=0;
    m.Materials.push(structuredClone(m.Materials[0])); m.Materials[1].Layers.forEach(l=>l.FilterMode=3);
    m.Geosets.push(structuredClone(m.Geosets[0])); m.Geosets[1].MaterialID=1;
    m.GeosetAnims=[{GeosetId:0,Flags:0,Color:new Float32Array([1,1,1]),Alpha:track([key(100,[1]),key(300,[1]),key(500,[0])])}];
  }); return d;
}
test('attached glow is inferred without names; approval changes only its target animation',()=>{
  const d=fixture(), source=d.serialize('mdx'), m=openDocument(source,'x.mdx').model;
  const findings=effectVisibilityProposals(m); assert.equal(findings.length,1); const f=findings[0];
  assert.equal(f.sequence,2); assert.deepEqual(f.carriers,[0]);
  const after=openDocument(runOptimizeStage(source,'irregularities',{},f).bytes,'x.mdx').model;
  assert.deepEqual(effectVisibilityProposals(after),[]);
  const t=after.GeosetAnims.find(a=>a.GeosetId===1).Alpha;
  for(let si=0;si<3;si++) for(let frame=m.Sequences[si].Interval[0];frame<=m.Sequences[si].Interval[1];frame++)
    assert.equal(sampleTrack(t,frame,{interval:m.Sequences[si].Interval,fallback:1}),si===2?0:1);
  after.GeosetAnims=structuredClone(m.GeosetAnims); after.Info.NumGeosetAnims=m.Info.NumGeosetAnims; assert.deepEqual(after,m);
});
test('ordinary geometry, distant glows, visible carriers and global visibility remain quiet',()=>{
  for(const change of [
    m=>m.Materials[1].Layers.forEach(l=>l.FilterMode=0),
    m=>m.Geosets[1].Vertices.forEach((v,i,a)=>a[i]=v+10000),
    m=>m.GeosetAnims[0].Alpha.Keys.at(-1).Vector[0]=1,
    m=>{m.GlobalSequences=[1000];m.GeosetAnims.push({GeosetId:1,Flags:0,Color:new Float32Array([1,1,1]),Alpha:{...track([key(0,[1])]),GlobalSeqId:0}});},
    m=>{m.GeosetAnims[0].Alpha=track([key(100,[1]),key(300,[1]),{...key(500,[0]),InTan:new Float32Array([0]),OutTan:new Float32Array([2])},{...key(600,[0]),InTan:new Float32Array([2]),OutTan:new Float32Array([0])}],3);}
  ]) {const m=structuredClone(fixture().model);change(m);assert.deepEqual(effectVisibilityProposals(m),[]);}
});
test('overlapping intervals are inspection-only; stale visibility evidence is rejected',()=>{
  const d=fixture(), f=effectVisibilityProposals(d.model)[0];
  d.model.Sequences.push(seq('Overlap',550,650));
  assert.ok(effectVisibilityProposals(d.model).find(x=>x.sequence===2).inspectionOnly);
  assert.throws(()=>runOptimizeStage(d.serialize('mdx'),'irregularities',{},f),/finding changed/);
});
test('unused local keys preserve setup, globals and native motion; stale plans are rejected',()=>{
  const d=fixture(); d.apply('Unused track',['Bones','GlobalSequences'],m=>{
    m.Bones[0].Translation=track([key(0,[9,8,7]),key(100,[1,2,3]),key(200,[4,5,6]),key(250,[999,999,999]),key(300,[5,6,7]),key(400,[6,7,8])],1);
    m.GlobalSequences=[1000];m.Bones[0].Scaling={...track([key(0,[1,1,1]),key(250,[2,2,2])],1),GlobalSeqId:0};
  });
  const bytes=d.serialize('mdx'), before=openDocument(bytes,'x.mdx').model, fixes=sanityProposals(before).filter(f=>f.kind==='unusedLocalKeys');
  assert.equal(fixes.length,1);assert.deepEqual(fixes[0].frames,[250]);
  const after=openDocument(runOptimizeStage(bytes,'sanity',{},fixes[0]).bytes,'x.mdx').model;
  const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after));
  for(let si=0;si<3;si++) {a.setSequence(si);b.setSequence(si);for(let f=before.Sequences[si].Interval[0];f<=before.Sequences[si].Interval[1];f++){
    a.setFrame(f);b.setFrame(f);assert.deepEqual(a.interp.vec3(new Float32Array(3),before.Bones[0].Translation),b.interp.vec3(new Float32Array(3),after.Bones[0].Translation));
  }}
  assert.equal(after.Bones[0].Translation.Keys[0].Frame,0);
  after.Bones[0].Translation=before.Bones[0].Translation;assert.deepEqual(after,before);
  d.model.Bones[0].Translation.Keys[3].Vector[0]++;assert.throws(()=>runOptimizeStage(d.serialize('mdx'),'sanity',{},fixes[0]),/finding changed/);
});
test('standard preset uses both authored Footman sphere centers and radii',()=>{
  const d=fixture(), after=openDocument(runOptimizeStage(d.serialize('mdx'),'spheres',{preset:1,size:1}).bytes,'x.mdx').model;
  assert.equal(after.CollisionShapes.length,2);
  for(const [i,c]of after.CollisionShapes.entries()) {assert.deepEqual(Array.from(c.Vertices),SPHERE_PRESETS[1].spheres[i].slice(0,3));assert.equal(c.BoundsRadius,38.07600021362305);}
});
