import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotShowcaseModel,hydrateShowcaseModel,remapShowcasePlaylist} from '../app/showcase-model.js';
import {snapshotShowcase,hydrateShowcase} from '../app/showcase-presets.js';

test('queued model snapshots retain independent geometry, named animations and aliased textures',async()=>{
 const texture={name:'texture.tga',bytes:new Uint8Array([1,2,3])};
 const input={model:{Sequences:[{Name:'Walk',Interval:[0,1000]}],Geosets:[{Vertices:new Float32Array([1,2,3])}]},modelName:'A.mdx',modelPath:'/A.mdx',revision:2,sessionId:'A',textureAssets:new Map([['texture',texture],['alias',texture]])};
 const source=await snapshotShowcaseModel(input);
 input.model.Geosets[0].Vertices[0]=99;texture.bytes[0]=99;input.model.Sequences[0].Name='Other';
 assert.equal(source.model.Geosets[0].Vertices[0],1);assert.equal(source.model.Sequences[0].Name,'Walk');assert.equal(source.textureAssets.get('texture').bytes[0],1);
 assert.equal(source.textureAssets.get('texture'),source.textureAssets.get('alias'));
 assert.equal(source.modelPath,'/A.mdx');assert.equal(source.sessionId,'A');
 const next={Sequences:[{Name:'Stand',Interval:[0,500]}]};
 assert.deepEqual(remapShowcasePlaylist([{sequence:0}],source.model,next),[]);
 assert.equal(source.model.Sequences[0].Name,'Walk');
});
test('queued textures survive original URL revocation and repeated setup restore',async()=>{
 const original=URL.createObjectURL(new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'}));
 const source=await snapshotShowcaseModel({model:{Sequences:[]},modelName:'A.mdx',textureAssets:new Map([['png',{name:'a.png',url:original}]])});
 URL.revokeObjectURL(original);assert.equal(source.textureAssets.get('png').url,undefined);
 const setup=await snapshotShowcase({modelSource:source,layers:[]}),urls=new Set();
 for(let i=0;i<2;i++){
  const restored=hydrateShowcaseModel(hydrateShowcase(setup,new Set()).modelSource,urls);
  assert.deepEqual([...new Uint8Array(await (await fetch(restored.textureAssets.get('png').url)).arrayBuffer())],[1,2,3,4]);
  for(const url of urls)URL.revokeObjectURL(url);urls.clear();
 }
 assert.equal(setup.modelSource.textureAssets.get('png').url,undefined);
});

test('full take snapshots preserve text, signature bytes, crop, camera, lighting and timing',async()=>{
 const bytes=new Uint8Array([71,73,70,56,57,97]);
 const source={model:{Sequences:[{Name:'Attack',Interval:[0,1000]}]},modelName:'Knight.mdx',textureAssets:new Map()};
 const setup={modelSource:source,layers:[{kind:'text',text:'Knight',size:48,bold:true,effect:'neon',rotation:15},{kind:'image',name:'signature.gif',blob:new Blob([bytes],{type:'image/gif'}),rect:{x:.8,y:.9,width:.2,height:.1}}],media:null,backgroundAsset:null,cropPreset:'square',crop:null,color:'#546477',light:'none',view:{camera:{position:[3,4,5]},zoom:2},orbitTiming:'circle',orbitDirection:-1,orbitRadius:0,sequencePlaylist:[{sequence:0,durationLoops:3,speed:1.5,disabledEmitters:[7]}]};
 const saved=await snapshotShowcase(setup);setup.layers[0].text='Changed';setup.sequencePlaylist[0].durationLoops=9;
 const urls=new Set(),restored=hydrateShowcase(saved,urls);
 assert.equal(restored.layers[0].text,'Knight');assert.equal(restored.layers[0].effect,'neon');assert.equal(restored.sequencePlaylist[0].durationLoops,3);
 assert.deepEqual(restored.view,{camera:{position:[3,4,5]},zoom:2});assert.equal(restored.light,'none');assert.equal(restored.cropPreset,'square');assert.equal(restored.orbitTiming,'circle');assert.equal(restored.orbitDirection,-1);
 assert.deepEqual([...new Uint8Array(await (await fetch(restored.layers[1].url)).arrayBuffer())],[...bytes]);
 for(const url of urls)URL.revokeObjectURL(url);
});
