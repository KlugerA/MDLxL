import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceAnimationTrack } from '../src/optimizexl-animation.js';
import { sampleTrack } from '../src/animation.js';
const model={Sequences:[{Interval:[0,1000]}]};
const key=(Frame,Vector,InTan=Vector,OutTan=Vector)=>({Frame,Vector:new Float32Array(Vector),InTan:new Float32Array(InTan),OutTan:new Float32Array(OutTan)});
test('redundant cubic quaternion keys reduce at zero without changing boundaries or controls',()=>{
 const q=[0,0,Math.sin(.3),Math.cos(.3)],t={LineType:2,GlobalSeqId:null,Keys:[0,200,500,800,1000].map(f=>key(f,q))},old=structuredClone(t),changes=[];
 assert.equal(reduceAnimationTrack(model,t,'Rotation',0,c=>changes.push(c)),3);
 assert.deepEqual(t.Keys,[old.Keys[0],old.Keys[4]]);assert.equal(changes.length,3);
 for(let f=0;f<=1000;f+=5){const options={interval:[0,1000],fallback:[0,0,0,1],quaternion:true};const a=sampleTrack(old,f,options),b=sampleTrack(t,f,options);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-7));}
});
test('equal Hermite values with nonzero tangents are motion, not redundant holds',()=>{
 const t={LineType:2,Keys:[0,200,500,800,1000].map(f=>key(f,[1,0,0],[2,0,0],[2,0,0]))},old=structuredClone(t);
 assert.equal(reduceAnimationTrack(model,t,'Translation',0,()=>{}),0);assert.deepEqual(t,old);
});
test('exact cleanup still handles vector color tracks without applying transform tolerances',()=>{
 const t={LineType:1,Keys:[0,500,1000].map(Frame=>({Frame,Vector:new Float32Array([.5,.25,1])}))};
 assert.equal(reduceAnimationTrack(model,t,'Color',10,()=>{}),1);assert.deepEqual(t.Keys.map(k=>k.Frame),[0,1000]);
});
test('curve reduction checks between keys and against the original rather than accumulating error',()=>{
 const t={LineType:3,Keys:[0,100,200,300,500,800,1000].map((f,i)=>key(f,[f/1000,.01*Math.sin(i),0],[f/1000-.2,.02*Math.cos(i),0],[f/1000+.2,.02*Math.sin(i),0]))},old=structuredClone(t),tolerance=.08;
 reduceAnimationTrack(model,t,'Translation',tolerance,()=>{});
 for(let f=0;f<=1000;f++){const options={interval:[0,1000],fallback:[0,0,0]},a=sampleTrack(old,f,options),b=sampleTrack(t,f,options);assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<=tolerance);}
 assert.deepEqual(t.Keys[0],old.Keys[0]);assert.deepEqual(t.Keys.at(-1),old.Keys.at(-1));
});
test('different spline controls, overlapping sequences, globals and unnormalized rotations stay protected',()=>{
 const q=[0,0,0,1],t={LineType:2,Keys:[key(0,q,q,[0,.5,0,.8660254]),key(500,q),key(1000,q)]};
 assert.equal(reduceAnimationTrack(model,t,'Rotation',0,()=>{}),0);
 const constant={LineType:2,Keys:[0,500,1000].map(f=>key(f,q))};
 assert.equal(reduceAnimationTrack({...model,Sequences:[...model.Sequences,{Interval:[900,1200]}]},structuredClone(constant),'Rotation',10,()=>{}),0);
 assert.equal(reduceAnimationTrack(model,{...structuredClone(constant),GlobalSeqId:0},'Rotation',10,()=>{}),0);
 const nonUnit={LineType:2,Keys:[key(0,q),key(500,[0,0,.5,2]),key(1000,q)]};assert.equal(reduceAnimationTrack(model,nonUnit,'Rotation',180,()=>{}),0);
});
