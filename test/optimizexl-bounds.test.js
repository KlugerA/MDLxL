import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarterDocument} from '../src/starter-model.js';
import {openDocument} from '../src/editor-document.js';
import {runOptimizeStage,sanityProposals} from '../src/optimizexl.js';
test('invalid animated bounds repair survives save/reopen and contains moving geometry',()=>{
 const doc=createStarterDocument();doc.apply('fixture',['Sequences','Bones'],m=>{
  m.Sequences=[{Name:'Death',Interval:new Uint32Array([0,1000]),MinimumExtent:new Float32Array([1e30,1e30,1e30]),MaximumExtent:new Float32Array([-1e30,-1e30,-1e30]),BoundsRadius:1,MoveSpeed:0,NonLooping:true,Rarity:0}];
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array(3)},{Frame:1000,Vector:new Float32Array([100,0,0])}]};
 });
 const bytes=doc.serialize('mdx'),before=openDocument(bytes,'before.mdx').model,fix=sanityProposals(before).find(p=>p.kind==='bounds');assert.ok(fix);
 const after=openDocument(runOptimizeStage(bytes,'sanity',{},fix).bytes,'after.mdx').model;
 assert.ok(after.Sequences[0].MaximumExtent[0]>=Math.max(...before.Geosets[0].Vertices.filter((_,i)=>i%3===0))+100);
 assert.deepEqual(after.Geosets,before.Geosets);assert.deepEqual(after.Bones,before.Bones);assert.deepEqual(after.Sequences[0].Interval,before.Sequences[0].Interval);assert.equal(sanityProposals(after).filter(p=>p.kind==='bounds').length,0);
});
