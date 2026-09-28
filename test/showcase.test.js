import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { showcaseAnimation, showcaseCamera, orbitView, recordingTimeline } from '../app/showcase-timeline.js';
const { showcaseDirectory } = createRequire(import.meta.url)('../electron/preview-capture.cjs');
const model = { Sequences: [{ Name: 'Stand', Interval: [100, 1100] }, { Name: 'Death', Interval: [2000, 2500], NonLooping: true }, { Name: 'Portrait Talk', Interval: [3000, 4000] }] };
const view = { position: [10, 0, 0], target: [0, 0, 0], fieldOfView: .8, roll: 0, near: .1, far: 1000 };
test('Showcase stops local and global time at nonlooping end, resumes on the next entry', () => {
  const list = [{ sequence: 1, seconds: 2, speed: 2 }, { sequence: 0, seconds: 1, speed: .5 }];
  const a = showcaseAnimation(model, list, .25), b = showcaseAnimation(model, list, 1.99);
  assert.equal(a.frame, 2500); assert.equal(b.frame, 2500); assert.equal(a.globalTime, 500); assert.equal(b.globalTime, 500); assert.equal(b.active, false);
  const c = showcaseAnimation(model, list, 2.5); assert.equal(c.frame, 350); assert.equal(c.globalTime, 750); assert.equal(c.active, true);
  assert.ok(Math.abs(showcaseAnimation(model, list, 3.1).globalTime - 1200) < 1e-8);
  assert.equal(showcaseAnimation(model, list, 30, false).globalTime, 1000);
});
test('static, portrait selection and authored looping are literal', () => {
  assert.equal(showcaseAnimation(model, [], 100).active, false);
  assert.equal(showcaseAnimation(model, [{ sequence: 2, seconds: 3, speed: 1 }], 1).portrait, true);
  assert.equal(showcaseAnimation(model, [{ sequence: 0, seconds: 3, speed: 1, loop: false }], 2).frame, 1100);
});
test('orbit then one-second hold then top pan uses exact segment boundaries', () => {
  const half = orbitView(view, 180), top = { ...view, position: [0, 0, 10] };
  const points = [{ view, seconds: 2, hold: 0, path: 'orbit', curve: 'linear' }, { view: half, seconds: 2, hold: 1, path: 'pan', curve: 'smooth' }, { view: top, hold: 0 }];
  const quarter = showcaseCamera(points, 1); assert.ok(Math.abs(quarter.position[0]) < 1e-8); assert.ok(Math.abs(quarter.position[1] - 10) < 1e-8);
  assert.deepEqual(showcaseCamera(points, 2.5), half);
  assert.deepEqual(showcaseCamera(points, 5), top);
  assert.deepEqual(showcaseCamera(points, 50), top);
  assert.ok(Math.abs(showcaseCamera([{ ...points[0], turns: 1 }, points[0]], 1).position[0] + 10) < 1e-8);
});
test('10 exact seconds at every allowed FPS and fractional centiseconds', () => {
  for (const fps of [10, 15, 20, 24, 25, 30, 50]) { const t = recordingTimeline(10, fps); assert.equal(t.duration, 10000); assert.equal(t.frames, fps * 10); assert.ok(t.time(t.frames - 1) < t.duration); }
  assert.equal(recordingTimeline(1.23, 30).duration, 1230);
  assert.throws(() => recordingTimeline(0, 30)); assert.throws(() => recordingTimeline('bad', 30));
});
test('per-model Windows folder names never escape Showcase Recordings', () => {
  assert.match(showcaseDirectory('Showcase Recordings', 'Footman.mdx'), /Showcase Recordings[\\/]Footman$/);
  assert.match(showcaseDirectory('Showcase Recordings', '../CON.mdx'), /[\\/]_CON$/);
  assert.match(showcaseDirectory('Showcase Recordings', '..'), /[\\/]Untitled$/);
});

import { centeredView, orbitModelView, cameraPathView, overflowEntries, screenshotPlan, createShowcaseDirector } from '../app/showcase-director.js';
test('off-origin orbital cameras keep model center and distance on all three axes',()=>{
  const center=[450,-900,80], off={...view,position:[480,-960,120],target:[0,0,0]};
  const fixed=centeredView(off,center),distance=Math.hypot(...fixed.position.map((n,i)=>n-center[i]));
  for(const axis of ['x','y','z'])for(const angle of [0,45,90,180,270,360]){
    const result=orbitModelView(fixed,angle,axis,center);
    assert.deepEqual(result.target,center);
    assert.ok(Math.abs(Math.hypot(...result.position.map((n,i)=>n-center[i]))-distance)<1e-8);
  }
  assert.deepEqual(off.target,[0,0,0]);
});
test('camera path controls preserve endpoints and arcs do not cut through the model',()=>{
  const center=[12,35,90], a={...view,target:center,position:[22,35,90]}, b={...view,target:center,position:[2,35,90]};
  const points=[{view:a},{view:b}];
  assert.deepEqual(cameraPathView(points,0,10,{},center),a);
  assert.deepEqual(cameraPathView(points,5,10,{speed:200},center),b);
  const mid=cameraPathView(points,5,10,{curve:'arc'},center);
  assert.ok(Math.abs(Math.hypot(...mid.position.map((v,i)=>v-center[i]))-10)<1e-8);
  assert.deepEqual(cameraPathView(points,5,10,{curve:'straight'},center).position,center);
});
test('speed zero freezes pose and overflow includes partly truncated entries',()=>{
  const frozen=showcaseAnimation(model,[{sequence:0,seconds:10,speed:0}],8);
  assert.equal(frozen.frame,100);assert.equal(frozen.globalTime,0);
  assert.deepEqual(overflowEntries([{seconds:4},{seconds:7},{seconds:1}],10),[false,true,true]);
  assert.deepEqual(overflowEntries([{seconds:4},{seconds:6}],10),[false,false]);
});
test('live clock catches up after a stalled encoder and freezes at exact duration',()=>{
  let now=100;const settings={model,playlist:[{sequence:0,seconds:10,speed:1}],length:10,playing:false,cameraMode:'orbit',orbitAxis:'z'};
  const director=createShowcaseDirector(()=>settings,()=>now);
  director.begin(view,{live:true,duration:10000});assert.equal(director.sample().presentationTime,0);
  now+=4300;assert.equal(director.sample(16).presentationTime,4300);
  assert.ok(Math.abs(director.sample().frame-400)<1e-6);
  now+=12000;assert.equal(director.sample().presentationTime,10000);
  director.freeze(10000);now+=5000;assert.equal(director.sample().presentationTime,10000);
});
test('automatic screenshots obey per-animation limits and sample distinct poses and cameras',()=>{
  const playlist=[{sequence:0,shots:3},{sequence:1,shots:90}];
  for(const viewpoint of ['frontal','orbital','zoom','free']){
    const shots=screenshotPlan(model,playlist,view,{viewpoint,axis:'y',random:()=>.5});
    assert.equal(shots.length,23);assert.equal(shots.filter(s=>s.entry===1).length,20);
    assert.equal(new Set(shots.slice(0,3).map(s=>s.frame)).size,3);
    assert.equal(new Set(shots.slice(0,3).map(s=>JSON.stringify(s.camera.position))).size,viewpoint==='frontal'?1:3);
    for(const shot of shots)assert.deepEqual(shot.camera.target,view.target);
  }
});
