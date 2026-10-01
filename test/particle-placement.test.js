import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {createStarterRecipe} from '../src/particle-starters.js';
import {particlePlacementInterval,placeTimedParticleRecipe} from '../src/particle-placement.js';
import {sampleTrack} from '../src/animation.js';
import {particleRecipeDocument} from '../src/particle-recipes.js';
import {createParticleGesture} from '../src/particle-bindings.js';
test('dragging an emitter authors native translation with one undo and cancels cleanly',()=>{
 const doc=particleRecipeDocument(createStarterRecipe()),id=doc.model.ParticleEmitters2[0].ObjectId,before=structuredClone(doc.model);
 const gesture=createParticleGesture({doc,id,field:'Translation',options:{frame:350,interval:[0,5000]}});
 gesture.update([5,-8,12]);gesture.finish();assert.deepEqual(Array.from(doc.model.Nodes[id].Translation.Keys[0].Vector),[5,-8,12]);assert.equal(doc.model.Nodes[id].Translation.Keys[0].Frame,350);
 const cancel=createParticleGesture({doc,id,field:'Translation',options:{frame:350,interval:[0,5000]}});cancel.update([12,34,56]);cancel.cancel();assert.deepEqual(Array.from(doc.model.Nodes[id].Translation.Keys[0].Vector),[5,-8,12]);
 doc.undo();assert.deepEqual(doc.model,before);
});
test('Movement placement requires a user-selected end and touches only the inserted graph in one undo',()=>{
 const doc=createDemoDocument(),recipe=createStarterRecipe(),before=structuredClone(doc.model);
 const [start,end]=doc.model.Sequences[0].Interval;
 const placement={sequence:0,from:start+100,to:'',parent:String(doc.model.Bones[0].ObjectId),position:[2,3,4],fit:true,motion:'target'};
 assert.throws(()=>placeTimedParticleRecipe(doc.model,recipe,placement),/Choose when/);assert.deepEqual(doc.model,before);
 assert.deepEqual(particlePlacementInterval(doc.model,placement,{preview:true}),[start+100,end]);
 placement.to=start+350;let result;
 doc.apply('Add effect',['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'],m=>{result=placeTimedParticleRecipe(m,recipe,placement);});
 const node=doc.model.Nodes[result.ids[0]],track=node.Visibility,interval=doc.model.Sequences[0].Interval;
 for(const [frame,value]of [[start,0],[start+99,0],[start+100,1],[start+349,1],[start+350,0],[end,0]])assert.equal(sampleTrack(track,frame,{interval,fallback:1}),value);
 for(const sequence of doc.model.Sequences.slice(1))assert.equal(sampleTrack(track,sequence.Interval[0],{interval:sequence.Interval,fallback:1}),0);
 assert.equal(doc.model.Nodes[result.anchorId].Parent,doc.model.Bones[0].ObjectId);
 assert.deepEqual(doc.model.Geosets,before.Geosets);assert.deepEqual(doc.model.Bones,before.Bones);assert.deepEqual(doc.model.Sequences,before.Sequences);
 assert.equal(doc.historyStats.undoSteps,1);
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'placed.'+format);
  assert.deepEqual(reopened.model.ParticleEmitters2[0].Visibility,track);
 }
 doc.undo();assert.deepEqual(doc.model,before);
});
test('static targets accept an effect without creating an animation or requiring end times',()=>{
 const doc=createDemoDocument();doc.model.Sequences=[];const result=placeTimedParticleRecipe(doc.model,createStarterRecipe(),{parent:'',position:[0,0,0],sequence:0,from:0,to:'',fit:true,motion:'source'});
 assert.ok(result.ids.length);assert.equal(doc.model.Sequences.length,0);
});
test('invalid placement frames are rejected before model mutation',()=>{
 const model=createDemoDocument().model,before=structuredClone(model),[start,end]=model.Sequences[0].Interval;
 for(const [from,to]of [[start,''],[start,start],[end,end+1],[start-1,end],[start+.5,end],[start,end+1],[start,NaN]]){
  assert.throws(()=>placeTimedParticleRecipe(model,createStarterRecipe(),{sequence:0,from,to}));assert.deepEqual(model,before);
 }
});
