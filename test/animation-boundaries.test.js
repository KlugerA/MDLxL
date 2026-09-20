import test from 'node:test';
import assert from 'node:assert/strict';
import { localSequenceAtFrame, sampleTrack } from '../src/animation.js';

const key=(Frame,value)=>({Frame,Vector:new Float32Array([value])});

test('All line resolves frames through each authored sequence interval, never one continuous interpolation range',()=>{
  const model={Sequences:[{Name:'Death',Interval:[100,400]},{Name:'Stand',Interval:[1000,1400]},{Name:'Editor timeline',Interval:[100,1400]}]};
  assert.equal(localSequenceAtFrame(model,250,2),0);
  assert.equal(localSequenceAtFrame(model,1200,2),1);
  assert.equal(localSequenceAtFrame(model,700,2),-1);
});

test('missing boundary keys hold the first and last pose inside a sequence and ignore adjacent sequences',()=>{
  const track={LineType:1,Keys:[key(50,99),key(200,10),key(300,20),key(1100,500)]};
  const options={interval:[100,400],fallback:0};
  assert.equal(sampleTrack(track,100,options),10);
  assert.equal(sampleTrack(track,150,options),10);
  assert.equal(sampleTrack(track,350,options),20);
  assert.equal(sampleTrack(track,400,options),20);
  assert.equal(sampleTrack({LineType:1,Keys:[key(50,99),key(1100,500)]},250,options),0);
});

