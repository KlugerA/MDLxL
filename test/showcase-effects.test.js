import test from 'node:test';
import assert from 'node:assert/strict';
import {loopEffectTiming,timeShowcasePlaylist} from '../app/showcase-effects.js';
import {showcaseAnimation} from '../app/showcase-timeline.js';
import {advanceShowcaseModel} from '../app/showcase-playback.js';
import {activeEventInstances} from '../app/event-preview-data.js';
const model={Sequences:[{Name:'Slam',Interval:[170000,171437],NonLooping:true}],GlobalSequences:[4000],ParticleEmitters2:[{ObjectId:101,LifeSpan:.4,EmissionRate:60,Visibility:{GlobalSeqId:0,LineType:0,Keys:[{Frame:0,Vector:[0]},{Frame:1815,Vector:[1]},{Frame:2048,Vector:[0]},{Frame:4000,Vector:[0]}]}}]};
test('global emitters never extend local animation time or receive emission cutoffs',()=>{
 const timing=loopEffectTiming(model,0,1,1);assert.equal(timing.motionSeconds,1.437);assert.equal(timing.seconds,1.44);assert.equal(timing.emissionEnds[101],undefined);
 const row=timeShowcasePlaylist(model,[{sequence:0,useDuration:true,durationLoops:1,speed:1,seconds:1.44}])[0];
 const sample=showcaseAnimation(model,[row],2.2,false);assert.equal(sample.frame,171437);assert.equal(sample.globalTime,2200);assert.equal(sample.effectTail,true);assert.equal(sample.looping,false);
 assert.equal(showcaseAnimation(model,[row],.5,false).frame,170500);
});
test('local action tails finish while continuous walk effects do not extend the loop',()=>{
 const m={Sequences:[{Name:'Attack',Interval:[0,1000]}],ParticleEmitters2:[{ObjectId:1,LifeSpan:.5,Visibility:1,EmissionRate:20}]};
 assert.equal(loopEffectTiming(m,0,1,2).seconds,1.04);assert.equal(loopEffectTiming(m,0,2,1).seconds,3.08);
 const walk={...m,Sequences:[{Name:"Walk",Interval:[0,1000]}]};assert.equal(loopEffectTiming(walk,0,1,2).seconds,.5);assert.equal(loopEffectTiming(walk,0,2,1).seconds,2);
});
test('a held pose ages particles, suppresses further local emissions, and restores private emitter properties',()=>{
 const props={ObjectId:1,EmissionRate:60};let elapsed=0;const particles=[{life:.5}];
 const native={rendererData:{globalSequencesFrames:[]},particlesController:{emitters:[{props,particles,emission:0}],updateEmitter(){assert.equal(props.Visibility,0);assert.equal(props.EmissionRate,60);}},setSequence(){},update(dt){elapsed+=dt;this.particlesController.updateEmitter(this.particlesController.emitters[0],dt);}};
 const previous={revision:1,segment:0,globalTime:1000,localTime:1000};
 advanceShowcaseModel(native,{Sequences:[{Interval:[0,1000]}]}, {sequenceIndex:0,revision:1,segment:0,frame:1000,globalTime:1200,localTime:1000,clipTime:1200,cycleTime:1200,looping:false,emissionEnds:{1:1000}},previous);
 assert.equal(elapsed,200);assert.equal(props.EmissionRate,60);assert.equal(particles.length,1);
});
test('normal sequence changes preserve living particles; explicit rewind clears them',()=>{
 const emitter={props:{ObjectId:1},particles:[{}],emission:0};const native={rendererData:{globalSequencesFrames:[]},particlesController:{emitters:[emitter]},setSequence(){},update(){}};
 const m={Sequences:[{Interval:[0,1000]}]},before={revision:1,segment:0,globalTime:1000,localTime:1000},sample={sequenceIndex:0,revision:1,segment:1,frame:0,globalTime:1020,localTime:0,clipTime:0};
 advanceShowcaseModel(native,m,sample,before);assert.equal(emitter.particles.length,1);advanceShowcaseModel(native,m,{...sample,revision:2},sample);assert.equal(emitter.particles.length,0);
});
test('spawned event effects keep aging after the final animation pose',()=>{
 const m={Sequences:[{Name:'Spell',Interval:[0,1000]}],EventObjects:[{Name:'SPNxTEST',EventTrack:[900]}]};const definitions=new Map([['SPNxTEST',{lifeSpanMs:600}]]);
 assert.equal(loopEffectTiming(m,0,1,1,0,definitions).seconds,1.54);
 const active=activeEventInstances(m,definitions,{sequenceIndex:0,frame:1000,globalTime:1300,playback:{clipTime:1300,motionSeconds:1,durationLoops:1,speed:1,segment:0}});assert.equal(active[0].ageMs,400);
 assert.equal(activeEventInstances(m,definitions,{sequenceIndex:0,frame:1000,globalTime:1600,playback:{clipTime:1600,motionSeconds:1,durationLoops:1,speed:1,segment:0}}).length,0);
});
