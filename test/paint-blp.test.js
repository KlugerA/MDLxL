import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { decodeBLP, getBLPImageData } from 'war3-model';
import { encodePaintBlp1, decodePaintBlp, PAINT_BLP_ENCODER } from '../src/paint-blp.js';

function fixture(size){const data=new Uint8ClampedArray(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const offset=(y*size+x)*4;data[offset]=x*255/(size-1);data[offset+1]=y*255/(size-1);data[offset+2]=(x+y)&255;data[offset+3]=((x>>4)+(y>>4))%2?255:0;}return{width:size,height:size,data};}
const arrayBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);

for(const size of [256,512])test(`WhiteoutLib BLP1 JPEG round trip retains ${size}×${size}, RGBA alpha, and every mip`,async()=>{
  const source=fixture(size),bytes=await encodePaintBlp1(source),view=new DataView(arrayBuffer(bytes));
  assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'BLP1');assert.equal(view.getUint32(4,true),0);assert.equal(view.getUint32(8,true),8);assert.equal(view.getUint32(12,true),size);assert.equal(view.getUint32(16,true),size);
  const levels=Math.log2(size)+1;for(let level=0;level<levels;level++){assert.ok(view.getUint32(28+level*4,true)>0);assert.ok(view.getUint32(92+level*4,true)>0);}if(levels<16)assert.equal(view.getUint32(28+levels*4,true),0);
  const decoded=getBLPImageData(decodeBLP(arrayBuffer(bytes)),0);assert.equal(decoded.width,size);assert.equal(decoded.height,size);assert.equal(decoded.data.length,source.data.length);
  let minimum=255,maximum=0;for(let offset=3;offset<decoded.data.length;offset+=4){minimum=Math.min(minimum,decoded.data[offset]);maximum=Math.max(maximum,decoded.data[offset]);}assert.ok(minimum<35);assert.ok(maximum>220);
});

test('encoder metadata pins the audited profile and shipped WASM hashes',async()=>{
  assert.deepEqual(PAINT_BLP_ENCODER,{id:'whiteoutlib-blp1-jpeg',library:'WhiteoutLib',source:'https://github.com/FernandoS27/WhiteoutLib',pinnedCommit:'38d279c2a6d8d439377959c56fe4f1eb9ab12fa6',license:'BSD-3-Clause',format:'BLP1',encoding:'JPEG',pixelFormat:'RGBA8',jpegQuality:90,alphaBits:8,mipmaps:true});
  const build=JSON.parse(await fs.readFile('public/whiteout/build.json','utf8'));
  for(const [name,expected] of Object.entries(build.files)){const actual=createHash('sha256').update(await fs.readFile(path.join('public/whiteout',name))).digest('hex');assert.equal(actual,expected);}
  await assert.rejects(encodePaintBlp1({width:4097,height:1,data:new Uint8ClampedArray(4097*4)}),/up to 4096/);
});

test('native BLP decoder reads exported RGBA and texture saves allow larger imported images',async()=>{
  const source=fixture(1024),bytes=await encodePaintBlp1(source),decoded=await decodePaintBlp(bytes);
  assert.deepEqual([decoded.width,decoded.height,decoded.data.length],[1024,1024,1024*1024*4]);
  assert.ok(decoded.data.some((v,i)=>i%4===3&&v<35));assert.ok(decoded.data.some((v,i)=>i%4===3&&v>220));
  await assert.rejects(decodePaintBlp(new Uint8Array(24)),/signature/);
});

test('shipped codec encodes and decodes with JavaScript string generation forbidden',()=>{
  // Mirrors script-src 'self' 'wasm-unsafe-eval': allow WASM, reject eval/new Function.
  // Exercise native bindings as well as module load; Embind also creates wrappers lazily.
  const code=`import {encodePaintBlp1,encodePaintDds,decodePaintBlp} from './src/paint-blp.js';
    import {decodeDds} from './src/dds.js';
    const raster={width:4,height:4,data:new Uint8ClampedArray(64).fill(255)};
    for(const [encode,decode] of [[encodePaintBlp1,decodePaintBlp],[encodePaintDds,decodeDds]]){
      const decoded=await decode(await encode(raster));
      if(decoded.width!==4||decoded.height!==4||decoded.data[3]!==255)throw Error('Codec round trip failed');
    }`;
  const result=spawnSync(process.execPath,['--disallow-code-generation-from-strings','--input-type=module','--eval',code],{cwd:process.cwd(),encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr||result.error?.message);
});
