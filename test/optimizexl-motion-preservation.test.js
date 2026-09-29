import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceAnimationTrack } from '../src/optimizexl-animation.js';
import { sampleTrack } from '../src/animation.js';

const model={Sequences:[{Name:'Unrelated name',Interval:[0,1000]}]};
const key=(Frame,Vector)=>({Frame,Vector:new Float32Array(Vector)});
const track=(values)=>({LineType:1,GlobalSeqId:null,Keys:values.map(([f,...v])=>key(f,v))});
const reduce=(t,property='Translation',tolerance=1000,m=model)=>{
 const changes=[],count=reduceAnimationTrack(m,t,property,tolerance,c=>changes.push(c));
 assert.equal(count,changes.length);return changes;
};
const q=degrees=>[0,0,Math.sin(degrees*Math.PI/360),Math.cos(degrees*Math.PI/360)];

test('tiny talking-like motion survives huge absolute tolerance and repeated reduction',()=>{
 for(const size of [.0001,1,10000]){
  const t=track([[0,0,0,0],[200,0,0,-size],[400,0,0,0],[600,0,0,-size*.8],[1000,0,0,0]]),before=structuredClone(t);
  for(let pass=0;pass<3;pass++)assert.deepEqual(reduce(t,'Translation',size*100),[]);
  assert.deepEqual(t,before);
 }
});

test('a large movement on another axis cannot swallow a small expression',()=>{
 const t=track([[0,0,0,0],[250,250,0,-.01],[500,500,0,0],[750,750,0,-.02],[1000,1000,0,0]]),before=structuredClone(t);
 reduce(t);assert.deepEqual(t,before);
});

test('small secondary cycles survive beside a larger excursion on the same axis',()=>{
 const t=track([[0,0,0,0],[150,1,0,0],[300,0,0,0],[450,.02,0,0],[600,0,0,0],[800,.015,0,0],[1000,0,0,0]]),before=structuredClone(t);
 reduce(t);assert.deepEqual(t,before);
});

test('small quaternion rotations and scale cycles stay animated',()=>{
 const rotation={LineType:1,Keys:[0,200,400,600,1000].map((f,i)=>key(f,q([0,.1,0,.08,0][i])))},r=structuredClone(rotation);
 reduce(rotation,'Rotation',180);assert.deepEqual(rotation,r);
 const scaling=track([[0,20,1,1],[200,20,1.001,1],[400,20,1,1],[600,20,1.002,1],[1000,20,1,1]]),s=structuredClone(scaling);
 reduce(scaling,'Scaling',10);assert.deepEqual(scaling,s);
});

test('curved motion between equal keys is preserved with authored handles',()=>{
 for(const LineType of [2,3]){
  const t={LineType,Keys:[0,300,600,1000].map((f,i)=>({...key(f,[0,0,0]),InTan:new Float32Array([0,i===1?-.8:0,0]),OutTan:new Float32Array([0,i===0?.8:0,0])}))};
  const original=structuredClone(t);reduce(t);
  for(let f=0;f<=1000;f++)assert.deepEqual(sampleTrack(t,f,{interval:[0,1000],fallback:[0,0,0]}),sampleTrack(original,f,{interval:[0,1000],fallback:[0,0,0]}));
  for(const k of t.Keys)assert.deepEqual(k,original.Keys.find(o=>o.Frame===k.Frame));
 }
});

test('motion budgets are per animation and are unaffected by static offsets',()=>{
 const m={Sequences:[{Interval:[0,1000]},{Interval:[2000,3000]}]};
 const t=track([[0,0,0,0],[500,100,0,0],[1000,0,0,0],[2000,100,0,0],[2500,100.001,0,0],[3000,100,0,0]]),original=structuredClone(t);
 reduce(t,'Translation',1000,m);assert.deepEqual(t,original);
});

test('constant and collinear data still reduce and reporting lists only actual removals',()=>{
 const t=track([[0,0,0,0],[100,1,0,0],[200,2,0,0],[300,3,0,0],[400,4,0,0],[1000,10,0,0]]);
 assert.equal(reduce(t).length,4);assert.deepEqual(t.Keys.map(k=>k.Frame),[0,1000]);
 const mixed=track([[0,0,0,0],[100,0,0,0],[200,0,0,0],[400,0,0,-1],[600,0,0,0],[800,0,0,-1],[1000,0,0,0]]),before=structuredClone(mixed);
 const changes=reduce(mixed);assert.equal(changes.length,before.Keys.length-mixed.Keys.length);
 for(const c of changes)assert.ok(!mixed.Keys.some(k=>k.Frame===c.frame));
 assert.equal(mixed.Keys.find(k=>k.Frame===400).Vector[2],-1);
});

test('smooth motion can reduce approximately without disabling strength controls',()=>{
 const t=track([[0,0,0,0],[250,.25,0,0],[500,.52,0,0],[750,.75,0,0],[1000,1,0,0]]);
 const exact=structuredClone(t);reduce(exact,'Translation',0);assert.equal(exact.Keys.length,5);
 reduce(t,'Translation',1);assert.equal(t.Keys.length,2);
});
