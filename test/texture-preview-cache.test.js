import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{TexturePreviewCache}=require('../electron/texture-preview-cache.cjs'),{CascTextures}=require('../electron/casc.cjs');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6RUAAAAASUVORK5CYII=';
const key=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,24);
const item=(name,build='a')=>({cacheKey:key(build+'|'+name),path:name,lookupName:'war3.w3mod:'+name,available:true});
const catalog=items=>({signature:key(items.map(i=>i.cacheKey).join()),items,errors:[]});
async function scratch(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mdlxl-preview-test-'));t.after(async()=>{if(path.dirname(directory)!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith('mdlxl-preview-test-'))throw Error('Unsafe fixture cleanup.');await fs.rm(directory,{recursive:true,force:true});});return directory;}

test('preload persists every preview across restart without reading or decoding warm sources',async t=>{
  const directory=await scratch(t),items=Array.from({length:5},(_,i)=>item('Textures\\'+i+'.blp'));
  let reads=0,decodes=0,prepares=0,active=0,peak=0;
  const prepare=async()=>{prepares++;return {catalog:catalog(items),readAsset:async i=>{reads++;return {name:i.lookupName,bytes:Buffer.from('original native bytes')};},decode:async()=>{decodes++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return png;}};};
  const first=new TexturePreviewCache({directory,concurrency:2});const started=await first.start(prepare);assert.equal(started.state,'indexing');assert.equal(typeof started.jobId,'string');await first.settle();
  assert.equal(first.snapshot().state,'complete');assert.equal(first.snapshot().completed,5);assert.equal(peak,2);assert.equal(prepares,1);assert.equal(reads,5);assert.equal(decodes,5);
  const next=new TexturePreviewCache({directory});assert.equal((await next.getStatus()).state,'complete');await next.start(prepare);await next.settle();
  assert.equal(reads,5);assert.equal(decodes,5);assert.equal(prepares,2);assert.equal(next.snapshot().cached,5);assert.equal((await next.readMany(items.map(i=>i.cacheKey))).length,5);
  const index=JSON.parse(await fs.readFile(path.join(directory,'index.json'),'utf8'));assert.equal(Object.keys(index.entries).length,5);assert.ok(!JSON.stringify(index).includes('original native bytes'));
});

test('cancel stops new work, keeps completed previews, and a fresh run resumes only missing items',async t=>{
  const directory=await scratch(t),items=Array.from({length:10},(_,i)=>item('texture'+i+'.blp'));let reads=0,cache;
  cache=new TexturePreviewCache({directory,concurrency:1,progressInterval:0,onProgress:status=>{if(status.completed===2&&status.state==='running')cache.cancel(status.jobId);}});
  const prepare=async()=>({catalog:catalog(items),readAsset:async i=>{reads++;return {name:i.path,bytes:Buffer.from('x')};},decode:async()=>png});
  await cache.start(prepare);await cache.settle();assert.equal(cache.snapshot().state,'cancelled');assert.equal(reads,2);
  const resumed=new TexturePreviewCache({directory});await resumed.start(prepare);await resumed.settle();assert.equal(resumed.snapshot().state,'complete');assert.equal(resumed.snapshot().cached,2);assert.equal(reads,10);
});

test('source fingerprint changes invalidate previews while corrupted files regenerate independently',async t=>{
  const directory=await scratch(t),old=item('Units\\Footman.blp'),changed=item('Units\\Footman.blp','newbuild');let reads=0;
  const prepare=items=>async()=>({catalog:catalog(items),readAsset:async i=>{reads++;return {name:i.lookupName,bytes:Buffer.from('source')};},decode:async()=>png});
  const cache=new TexturePreviewCache({directory});await cache.start(prepare([old]));await cache.settle();await cache.start(prepare([changed]));await cache.settle();assert.equal(reads,2);assert.notEqual(old.cacheKey,changed.cacheKey);
  await fs.writeFile(path.join(directory,changed.cacheKey+'.png'),'truncated');await cache.start(prepare([changed]));await cache.settle();assert.equal(reads,3);assert.equal(cache.snapshot().failed,0);assert.equal(await cache.read(changed.cacheKey),png);
});

test('journal recovery survives interruption, ignores incomplete last record, and thumbnail keys cannot escape cache',async t=>{
  const directory=await scratch(t),asset=item('custom.png'),cache=new TexturePreviewCache({directory});cache.register([asset]);await cache.save(asset.cacheKey,png);
  await fs.appendFile(path.join(directory,'journal.ndjson'),'\n{"key":"broken');
  const restart=new TexturePreviewCache({directory});assert.equal(await restart.read(asset.cacheKey),png);
  await assert.rejects(restart.save('../escape',png),/Unknown/);await assert.rejects(restart.save(key('unknown'),png),/Unknown/);
  restart.register([asset]);await assert.rejects(restart.save(asset.cacheKey,'data:text/plain;base64,eA=='),/PNG/);assert.equal(await restart.read('../escape'),null);
});

test('unavailable and unsupported textures report failures without discarding successful previews',async t=>{
  const directory=await scratch(t),items=['good.png','missing.blp','unsupported.dds'].map(name=>item(name));
  const cache=new TexturePreviewCache({directory});await cache.start(async()=>({catalog:catalog(items),readAsset:async i=>({name:i.path,bytes:i.path.includes('missing')?null:Buffer.from('x')}),decode:async asset=>{if(asset.name.includes('unsupported'))throw Error('Unsupported DDS texture encoding.');return png;}}));await cache.settle();
  const status=cache.snapshot();assert.equal(status.state,'complete');assert.equal(status.completed,3);assert.equal(status.failed,2);assert.equal(status.errors.length,2);assert.equal((await cache.readMany(items.map(i=>i.cacheKey))).length,1);
});

test('native preload reuses one enumerated build and incremental byte inventory with bounded disk bytes',async t=>{
  const directory=await scratch(t),game=path.join(directory,'game'),cacheDirectory=path.join(directory,'native');await fs.mkdir(game);await fs.writeFile(path.join(game,'.build.info'),'fixture build');
  let lists=0,reads=0,opens=0;
  const casc=new CascTextures({cacheDirectory,maxBytes:6,openReader:()=>{opens++;return {list:async()=>{lists++;return ['war3.w3mod:a.blp','war3.w3mod:b.blp','war3.w3mod:c.blp'];},read:async()=>{reads++;return Buffer.from('1234');},close(){}};}});
  const listing=await casc.list([game]),source=listing.sources[0];
  await casc.readSnapshot(source.names[0],game,source.key);const inventory=casc.byteEntries;
  await casc.readSnapshot(source.names[1],game,source.key);await casc.readSnapshot(source.names[2],game,source.key);
  assert.equal(casc.byteEntries,inventory);assert.equal(lists,1);assert.equal(reads,3);assert.equal(opens,2);assert.ok([...inventory.values()].reduce((n,e)=>n+e.size,0)<=6);
  await casc.close();
});

test('multiple journal checkpoints retain a complete larger catalog without source bytes in the index',async t=>{
  const directory=await scratch(t),items=Array.from({length:260},(_,i)=>item('checkpoint'+i+'.png'));
  const cache=new TexturePreviewCache({directory});await cache.start(async()=>({catalog:catalog(items),readAsset:async i=>({name:i.path,bytes:Buffer.from('source')}),decode:async()=>png}));await cache.settle();
  assert.equal(cache.snapshot().completed,260);assert.equal(cache.snapshot().failed,0);
  const persisted=JSON.parse(await fs.readFile(path.join(directory,'index.json'),'utf8'));assert.equal(Object.keys(persisted.entries).length,260);assert.equal(await fs.readFile(path.join(directory,'journal.ndjson'),'utf8'),'');
  const restarted=new TexturePreviewCache({directory});await restarted.load();assert.equal(restarted.entries.size,260);assert.equal(await restarted.read(items[259].cacheKey),png);
});

test('disk-full failure stops new work and remains closable with completed cache entries retained',async t=>{
  const directory=await scratch(t),cache=new TexturePreviewCache({directory,concurrency:1}),items=[item('first.png'),item('second.png'),item('third.png')];let reads=0;
  const save=cache.save.bind(cache);cache.save=async(...args)=>{if(reads===2)throw Object.assign(Error('Disk is full.'),{code:'ENOSPC'});return save(...args);};
  await cache.start(async()=>({catalog:catalog(items),readAsset:async i=>{reads++;return {name:i.path,bytes:Buffer.from('source')};},decode:async()=>png}));await cache.settle();
  assert.equal(reads,2);assert.equal(cache.snapshot().state,'error');assert.equal(cache.snapshot().completed,1);assert.match(cache.snapshot().errors.at(-1).message,/Disk is full/);assert.equal(await cache.read(items[0].cacheKey),png);await cache.close();
});
