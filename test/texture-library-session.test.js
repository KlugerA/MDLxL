import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextureAssetCache, createTextureLibrarySessions, createThumbnailQueue, createThumbnailLookup, copyTextureBytes, warmTextureLibrarySession } from '../src/texture-library-session.js';
import { thumbnailPixels } from '../src/texture-thumbnail.js';
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no; }); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('previews never replace original native import lookup paths or asset bytes', async () => {
  const calls=[], bytes=new Uint8Array([1,2,3,4]);
  const load=createTextureAssetCache({resolve:async options=>{calls.push(options);return [{name:'original.dds',bytes}];}});
  const item={cacheKey:'game-build-A',lookupName:'war3.w3mod:_hd.w3mod:units\\native.dds',path:'Textures\\Native.blp',source:'native',thumbnailUrl:'file:///cache/preview.png'};
  const asset=await load(item,'C:\\models\\edited.mdx');
  assert.deepEqual(calls,[{path:'C:\\models\\edited.mdx',names:[item.lookupName]}]);
  assert.equal(asset.name,item.path);assert.equal(asset.bytes,bytes);assert.equal(asset.source,'native');
  const copied=copyTextureBytes(bytes.subarray(1,3));
  structuredClone({copied},{transfer:[copied]});
  assert.equal(copied.byteLength,0);assert.deepEqual(bytes,new Uint8Array([1,2,3,4]),'worker transfer never detaches imported original');
  assert.equal(await load(item,'C:\\models\\edited.mdx'),asset);assert.equal(calls.length,1);
});

test('raw asset cache deduplicates loads, bounds retention, and invalidates by source fingerprint',async()=>{
  const pending=deferred();let calls=0;
  const load=createTextureAssetCache({maxItems:1,resolve:async()=>{calls++;await pending.promise;return[{bytes:new Uint8Array([calls])}];}});
  const item={cacheKey:'build1',lookupName:'war3.w3mod:x.dds',path:'x.blp',source:'native'};
  const a=load(item),b=load(item);pending.resolve();assert.equal(await a,await b);assert.equal(calls,1);
  await load({...item,cacheKey:'build2'});assert.equal(calls,2);
  await load(item);assert.equal(calls,3,'bounded eviction forces only original-path reload');
  const missing=createTextureAssetCache({resolve:async()=>[]});await assert.rejects(missing(item),/not available/);
});

test('warm library remount immediately reuses catalog and query result; changed signature drops prior results',async()=>{
  const sessions=createTextureLibrarySessions(),catalog={signature:'build1',items:[{id:'a'}]},options={query:'',variant:'classic',limit:120},result={items:catalog.items,total:1};
  assert.equal(sessions.result('model',undefined,options),null,'first library mount has no catalog/signature yet');
  sessions.remember('model',undefined,options,result);assert.equal(sessions.result('model',undefined,options),null,'no result can be stored before catalog validation');
  await sessions.load('model',async()=>catalog);sessions.remember('model','build1',options,result);
  assert.equal(sessions.peek('model'),catalog);assert.equal(sessions.result('model','build1',options),result);
  const gate=deferred();let calls=0;const loader=async()=>{calls++;return gate.promise;};
  const a=sessions.load('model',loader),b=sessions.load('model',loader);await tick();assert.equal(calls,1);
  assert.equal(sessions.result('model','build1',options),result,'browse stays warm while validation runs');
  gate.resolve({...catalog,signature:'build2'});await Promise.all([a,b]);
  assert.equal(sessions.result('model','build1',options),null);assert.equal(sessions.result('model','build2',options),null);
  assert.equal(sessions.peek('model').signature,'build2');
});

test('catalog/results stay bounded and model folders never share stale custom results',async()=>{
  const sessions=createTextureLibrarySessions({maxEntries:2,maxResults:1});
  for(const name of ['a','b'])await sessions.load(name,async()=>({signature:name,items:[]}));
  sessions.remember('b','b',{query:'one'},{total:1});sessions.remember('b','b',{query:'two'},{total:2});
  assert.equal(sessions.result('b','b',{query:'one'}),null);assert.equal(sessions.result('a','b',{query:'two'}),null);
  await sessions.load('c',async()=>({signature:'c',items:[]}));assert.equal(sessions.peek('a'),null);
  await assert.rejects(sessions.load('broken',async()=>{throw Error('offline');}),/offline/);assert.equal(sessions.peek('broken'),null);
});

test('confirmed preload warms the initial query without asset reads and preserves source validation',async()=>{
  const sessions=createTextureLibrarySessions(),catalog={signature:'A',items:[{id:'native',variant:'classic'}]},calls=[];
  const loadCatalog=async()=>{calls.push('catalog');return catalog;};
  const search=async(data,options)=>{calls.push('search');assert.equal(data,catalog);return {items:data.items,total:1,options};};
  const settings={sessions,modelPath:'model',loadCatalog,search,vibe:false};
  const loaded=await warmTextureLibrarySession(settings),options={query:'',vibe:false,folder:'',variant:'classic',kind:'all',limit:120};
  assert.equal(loaded,catalog);assert.equal(sessions.result('model','A',options).total,1);assert.deepEqual(calls,['catalog','search']);
  await warmTextureLibrarySession(settings);assert.deepEqual(calls,['catalog','search','catalog'],'warm query retained but metadata still validated');
  const changed={signature:'B',items:[{id:'custom',variant:'custom'}]};
  await warmTextureLibrarySession({...settings,loadCatalog:async()=>changed,search:async(data,next)=>{assert.equal(next.variant,'all');return {items:data.items,total:1};}});
  assert.equal(sessions.result('model','A',options),null,'changed source cannot retain old search');
  await warmTextureLibrarySession({...settings,modelPath:'active-library',canWarm:()=>false});
  assert.equal(calls.filter(value=>value==='search').length,1,'background warmup never reinitializes an already open library');
});

test('thumbnail decode queue caps work and shares tile/detail jobs, including failures',async()=>{
  const enqueue=createThumbnailQueue({concurrency:2}),gates=[deferred(),deferred(),deferred()];let active=0,max=0,calls=0;
  const job=index=>async()=>{calls++;active++;max=Math.max(max,active);try{return await gates[index].promise;}finally{active--;}};
  const first=enqueue('a',job(0)),duplicate=enqueue('a',job(0)),second=enqueue('b',job(1)),third=enqueue('c',job(2));
  assert.equal(first,duplicate);await tick();assert.equal(calls,2);gates[0].resolve('A');assert.equal(await first,'A');await tick();assert.equal(calls,3);assert.equal(max,2);
  gates[1].reject(Error('invalid image'));await assert.rejects(second,/invalid image/);gates[2].resolve('C');assert.equal(await third,'C');await tick();
  assert.equal(await enqueue('b',async()=> 'retry'),'retry');
});

test('persistent thumbnail lookup batches, deduplicates pending keys and never remembers misses',async()=>{
  const requests=[],gate=deferred();let calls=0;
  const lookup=createThumbnailLookup(async request=>{requests.push(request);calls++;if(calls===1)await gate.promise;return request.keys.filter(key=>key!=='missing').map(key=>({key,url:'png:'+key}));},{maxBatch:2});
  const a=lookup('a'),duplicate=lookup('a'),b=lookup('b'),c=lookup('c');assert.equal(a,duplicate);
  await new Promise(resolve=>setTimeout(resolve,12));assert.equal(lookup('a'),a,'one in-flight IPC per key');
  gate.resolve();assert.deepEqual(await Promise.all([a,b,c]),['png:a','png:b','png:c']);assert.ok(requests.every(request=>request.keys.length<=2));
  assert.equal(await lookup('missing'),null);await tick();const before=requests.length;assert.equal(await lookup('missing'),null);assert.equal(requests.length,before+1,'preload can fill a previously missing key');
});

test('background thumbnail pixel decoding preserves TGA orientation/channels and input data',()=>{
  const bytes=new Uint8Array(18+8);bytes[2]=2;bytes[12]=2;bytes[14]=1;bytes[16]=32;bytes[17]=40;bytes.set([0,0,255,255,255,0,0,128],18);
  const before=new Uint8Array(bytes),pixels=thumbnailPixels({name:'sample.tga',bytes});
  assert.equal(pixels.width,2);assert.equal(pixels.height,1);assert.deepEqual(Array.from(pixels.data),[255,0,0,255,0,0,255,128]);assert.deepEqual(bytes,before);
  assert.equal(thumbnailPixels({name:'sample.png',bytes:new Uint8Array([1,2,3])}),null,'browser formats use off-thread bitmap decoder');
});
