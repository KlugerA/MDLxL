import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ModelRenderer} from 'war3-model';
import {createStarterDocument} from '../src/starter-model.js';
import {createNode,openDocument} from '../src/editor-document.js';
import {generateCompatibleMdx} from '../src/mdx-compatibility.js';
import {canonicalizeSerializedNodeOrder} from '../src/node-id-order.js';
import {assertRoundTripFields} from '../src/model-optimizer.js';
import {sanityProposals,runOptimizeStage} from '../src/optimizexl.js';
import {classifyHiveFindings} from '../src/optimizexl-diagnostics.js';
import {flattenHiveFindings} from '../app/optimizexl-hive.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const hive=bytes=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(bytes.slice().buffer);const r=ModelViewer.utils.mdlx.sanityTest(m);return {...r,findings:flattenHiveFindings(r.nodes)};};
const key=(Frame,Vector,InTan=Vector,OutTan=Vector)=>({Frame,Vector:new Float32Array(Vector),InTan:new Float32Array(InTan),OutTan:new Float32Array(OutTan)});
function fixture(type=2,rotation=false){
  const d=createStarterDocument();d.model.Sequences=[{Name:'Arbitrary',Interval:new Uint32Array([100,2100]),MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0}];
  const v=rotation?[0,0,0,1]:[0,0,0],c=rotation?[0,0,Math.sin(.015),Math.cos(.015)]:[0,0,1];
  d.model.Bones[0][rotation?'Rotation':'Translation']={LineType:type,GlobalSeqId:null,Keys:[key(100,v,v,c),key(800,v),key(1400,v),key(2100,rotation?[0,0,Math.sin(.1),Math.cos(.1)]:[0,0,5])]};
  return openDocument(new Uint8Array(generateCompatibleMdx({...d.model,BindPoses:undefined})),'fixture.mdx');
}
for(const type of [2,3])for(const rotation of [false,true])test(`spline ${type} ${rotation?'quaternion':'vector'}: repair preserves sampled motion, anchors and external data`,()=>{
  const d=fixture(type,rotation),source=d.serialize('mdx'),property=rotation?'Rotation':'Translation';
  const old=sanityProposals(d.model).find(f=>f.kind==='redundantTracks');assert.equal(old.inspectionOnly,true);
  const f=sanityProposals(d.model).find(f=>f.kind==='splineResample');assert.ok(f);
  assert.equal(classifyHiveFindings(hive(source).findings,sanityProposals(d.model)).find(x=>x.kind==='redundantTracks').fixId,f.id);
  const result=runOptimizeStage(source,'sanity',{},f),after=openDocument(result.bytes,'x.mdx').model;
  assert.equal(hive(result.bytes).unused,0);assert.ok(!sanityProposals(after).some(p=>p.kind==='splineResample'));
  const a=new ModelRenderer(structuredClone(d.model)),b=new ModelRenderer(structuredClone(after));
  let error=0;
  for(let frame=100;frame<=2100;frame+=.25){a.setFrame(frame);b.setFrame(frame);
    const x=rotation?a.interp.quat(new Float32Array(4),d.model.Bones[0][property]):a.interp.vec3(new Float32Array(3),d.model.Bones[0][property]);
    const y=rotation?b.interp.quat(new Float32Array(4),after.Bones[0][property]):b.interp.vec3(new Float32Array(3),after.Bones[0][property]);
    error=Math.max(error,...Array.from(x,(v,i)=>Math.abs(v-y[i])));
  }
  assert.ok(error<.001);
  const beforeTrack=d.model.Bones[0][property],afterTrack=after.Bones[0][property];
  for(const span of f.spans){const a=afterTrack.Keys.find(k=>k.Frame===span.lo),b=afterTrack.Keys.find(k=>k.Frame===span.hi);
    assert.deepEqual(a.InTan,beforeTrack.Keys.find(k=>k.Frame===span.lo).InTan);assert.deepEqual(b.OutTan,beforeTrack.Keys.find(k=>k.Frame===span.hi).OutTan);}
  assert.deepEqual(afterTrack.Keys.filter(k=>!f.spans.some(s=>k.Frame>=s.lo&&k.Frame<=s.hi)),beforeTrack.Keys.filter(k=>!f.spans.some(s=>k.Frame>=s.lo&&k.Frame<=s.hi)));
  after.Bones[0][property]=beforeTrack;assert.deepEqual(after,d.model);assert.deepEqual(d.serialize('mdx'),source);
});
test('stale, duplicate and competing corrections cannot apply; batch equals individual result',()=>{
  const d=fixture(),source=d.serialize('mdx'),f=sanityProposals(d.model).find(f=>f.kind==='splineResample');
  assert.deepEqual(runOptimizeStage(source,'sanity',{},f).bytes,runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:[{fix:f}]}).bytes);
  assert.throws(()=>runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:[{fix:f},{fix:f}]}),/twice/);
  d.model.Bones[0].Translation.Keys[0].OutTan[2]=3;
  assert.throws(()=>runOptimizeStage(new Uint8Array(generateCompatibleMdx({...d.model,BindPoses:undefined})),'sanity',{},f),/finding changed/);
});
test('unsupported domains and invalid affected controls remain inspectable; existing deletion owns supported keys first',()=>{
  for(const change of [m=>m.Sequences.push({...m.Sequences[0],Name:'Overlap'}),m=>{m.GlobalSequences=[2100];m.Bones[0].Translation.GlobalSeqId=0;},m=>m.Bones[0].Translation.Keys[1].InTan[0]=NaN]){
    const m=fixture().model;change(m);assert.ok(!sanityProposals(m).some(f=>f.kind==='splineResample'));
  }
  const m=fixture().model;m.Bones[0].Translation.Keys[0].OutTan.fill(0);
  assert.ok(sanityProposals(m).some(f=>f.kind==='redundantTracks'&&f.frames.length));
  assert.ok(!sanityProposals(m).some(f=>f.kind==='splineResample'));
});
test('noncanonical event/helper IDs survive repair export with strict reference validation',()=>{
  const d=fixture();const event=createNode(d.model,'EventObject');event.Name='SNDXABCD';event.EventTrack=new Uint32Array([100]);event.GlobalSeqId=null;
  const helper=createNode(d.model,'Helper');helper.Parent=event.ObjectId;helper.PivotPoint=d.model.PivotPoints[helper.ObjectId]=new Float32Array([1,2,3]);
  const source=new Uint8Array(generateCompatibleMdx({...d.model,BindPoses:undefined})),input=openDocument(source,'x.mdx');
  const f=sanityProposals(input.model).find(f=>f.kind==='splineResample'),result=runOptimizeStage(source,'sanity',{},f),after=openDocument(result.bytes,'x.mdx').model;
  const expected=structuredClone(input.model);expected.Bones[0].Translation=after.Bones[0].Translation;
  assertRoundTripFields(expected,after);
  const rawExpected=structuredClone(expected);
  canonicalizeSerializedNodeOrder(expected,{preserveUnusedPivots:true});assert.deepEqual(after.Helpers[0],expected.Helpers[0]);
  for(const corrupt of [m=>m.Helpers[0].Parent=0,m=>m.Geosets[0].Groups[0][0]=m.Helpers[0].ObjectId,m=>m.PivotPoints[0][0]=99]){
    const m=structuredClone(after);corrupt(m);assert.throws(()=>assertRoundTripFields(rawExpected,m),/cannot preserve/);
  }
  assert.deepEqual(input.serialize('mdx'),source);
});
