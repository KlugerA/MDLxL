import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { decodeDds } from '../src/dds.js';
const require=createRequire(import.meta.url), {CascTextures}=require('../electron/casc.cjs'), {GameDataDiscovery}=require('../electron/game-data.cjs');
async function scratch(t) {
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-casc-'));
 t.after(async()=>{if(path.dirname(base)!==path.resolve(os.tmpdir())||!path.basename(base).startsWith('mdlvis-casc-'))throw Error('Invalid cleanup path');await fs.rm(base,{recursive:true,force:true});});
 return base;
}
test('native byte cache survives restart and invalidates on Warcraft build changes',async t=>{
 const base=await scratch(t),game=path.join(base,'Warcraft III'),cacheDirectory=path.join(base,'cache');await fs.mkdir(game);await fs.writeFile(path.join(game,'.build.info'),'build1');
 let opens=0;const openReader=()=>{opens++;return {read:async()=>Buffer.from('texture'+opens),close(){}};};
 const first=new CascTextures({cacheDirectory,openReader});assert.equal((await first.read('Units\\Peon.blp',[game])).toString(),'texture1');await first.close();
 const second=new CascTextures({cacheDirectory,openReader});assert.equal((await second.read('Units\\Peon.blp',[game])).toString(),'texture1');assert.equal(opens,1);
 await fs.writeFile(path.join(game,'.build.info'),'build2');assert.equal((await second.read('Units\\Peon.blp',[game])).toString(),'texture2');await second.close();
});
test('cached missing texture falls through to the next installation',async t=>{
 const base=await scratch(t),a=path.join(base,'a'),b=path.join(base,'b');for(const folder of [a,b]){await fs.mkdir(folder);await fs.writeFile(path.join(folder,'.build.info'),'build');}
 const options={cacheDirectory:path.join(base,'cache'),openReader:folder=>({read:async()=>folder===a?null:Buffer.from('found'),close(){}})};
 const first=new CascTextures(options);assert.equal((await first.read('a.blp',[a,b])).toString(),'found');await first.close();
 const next=new CascTextures({...options,openReader:()=>{throw Error('Cache should satisfy both lookups');}});assert.equal((await next.read('a.blp',[a,b])).toString(),'found');await next.close();
});
test('CASC discovery cache avoids registry and directory scans until build metadata changes',async t=>{
 const base=await scratch(t),game=path.join(base,'Warcraft III'),cacheFile=path.join(base,'cache.json');await fs.mkdir(path.join(game,'Data'),{recursive:true});await fs.writeFile(path.join(game,'.build.info'),'build1');
 const options={cacheFile,env:{},registry:async()=>[game],drives:async()=>[]};
 assert.deepEqual((await new GameDataDiscovery(options).discover()).cascFolders,[game]);
 const restart=new GameDataDiscovery({...options,registry:()=>{throw Error('Unexpected registry scan');},readdir:()=>{throw Error('Unexpected directory scan');}});
 assert.equal((await restart.discover()).fromCache,true);
 await fs.writeFile(path.join(game,'.build.info'),'new-build2');
 assert.notEqual((await new GameDataDiscovery(options).discover()).fromCache,true);
});
test('native DDS top mip decodes BC1 colors and rejects truncated or unsupported data',()=>{
 const source=new Uint8Array(136),v=new DataView(source.buffer);v.setUint32(0,0x20534444,true);v.setUint32(4,124,true);v.setUint32(12,4,true);v.setUint32(16,4,true);v.setUint32(84,0x31545844,true);v.setUint16(128,0xf800,true);
 const decoded=decodeDds(source);assert.equal(decoded.width,4);assert.equal(decoded.height,4);assert.deepEqual(Array.from(decoded.data.slice(0,4)),[255,0,0,255]);
 assert.throws(()=>decodeDds(source.subarray(0,135)),/truncated/);v.setUint32(84,0x30315844,true);assert.throws(()=>decodeDds(source),/Unsupported/);
});
