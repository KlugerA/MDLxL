import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PreviewRecordingStore, timeline, bitmap } = require('../electron/preview-ffmpeg.cjs');
const { validateGIFFile, MAX_CAPTURE_BYTES } = require('../electron/preview-capture.cjs');

function inspectGIF(bytes) {
  assert.equal(bytes.subarray(0,6).toString(), 'GIF89a');
  let offset = 13 + (bytes[10] & 128 ? 3 * (1 << ((bytes[10] & 7) + 1)) : 0);
  let delay = 0, frames = 0, loop = null;
  const subblocks = () => { while (bytes[offset]) offset += bytes[offset] + 1; offset++; };
  while (offset < bytes.length) {
    const type = bytes[offset++];
    if (type === 0x3b) return { delay, frames, loop };
    if (type === 0x21) {
      const label = bytes[offset++];
      if (label === 0xf9) delay += bytes.readUInt16LE(offset + 2) * 10;
      if (label === 0xff && bytes.subarray(offset + 1, offset + 12).toString() === 'NETSCAPE2.0') loop = bytes.readUInt16LE(offset + 14);
      subblocks();
    } else if (type === 0x2c) {
      frames++; const packed = bytes[offset + 8]; offset += 9;
      if (packed & 128) offset += 3 * (1 << ((packed & 7) + 1));
      offset++; subblocks();
    } else assert.fail(`Unknown GIF block ${type} at ${offset}`);
  }
  assert.fail('GIF trailer missing');
}
function frame(index, width = 16, height = 8) {
  const bytes = new Uint8Array(width * height * 4);
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const p=(y*width+x)*4; bytes[p]=(x*16+index*47)%256; bytes[p+1]=y*30; bytes[p+2]=(index*23)%256; bytes[p+3]=255;
  }
  return bytes;
}
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-gif-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return new PreviewRecordingStore({ temporaryRoot: path.join(root,'frames'), destination: path.join(root,'Screenshots'), ...options });
}
test('GIF timing rounds cumulatively at every supported capture FPS and preserves holds', () => {
  for (const fps of [10,15,20,24,25,30,50]) {
    const frames = Array.from({length:fps},(_,i)=>({file:String(i),time:i*1000/fps}));
    const result = timeline(frames,1000);
    assert.equal(result.entries.reduce((sum,item)=>sum+item.ticks,0),100);
    assert.equal(result.entries.length,fps);
  }
  assert.equal(timeline([{file:'one',time:0}], 1).duration,20);
  const held=timeline([{file:'a',time:0},{file:'b',time:93},{file:'c',time:417}],1234);
  assert.deepEqual(held.entries.map(x=>x.ticks),[9,33,81]);
  assert.deepEqual(timeline([{file:'a',time:0}],700000).entries.map(x=>x.ticks),[65535,4465]);
  assert.throws(()=>timeline([{file:'a',time:100}],99));
});
test('lossless BMP writes correct red/blue order and top-down dimensions', () => {
  const result=bitmap(new Uint8Array([255,17,3,255]),1,1);
  assert.deepEqual([...result.subarray(54)],[3,17,255,255]);
  assert.equal(result.readInt32LE(22),-1);
});
test('real bundled FFmpeg: 24/30 FPS, irregular frames, one-frame capture, loops, save/retry', { skip: process.platform !== 'win32' }, async t => {
  const store=await fixture(t);
  for (const [fps,loop,quality] of [[24,true,'medium'],[30,false,'high'],[1,false,'low']]) {
    const {jobId}=await store.begin(1,{width:16,height:8,quality,loop});
    const count=fps===1?1:fps;
    for(let i=0;i<count;i++)await store.frame(1,{jobId,width:16,height:8,time:i*1000/fps,buffer:frame(i)});
    const output=await store.finish(1,{jobId,time:fps===1?1234:1000});
    const job=store.get(1,jobId), decoded=inspectGIF(await fs.readFile(job.output));
    assert.equal(decoded.delay, fps===1?1230:1000);
    assert.equal(decoded.loop, loop?0:null);
    assert.equal(decoded.frames,count);
    assert.equal(output.duration,decoded.delay);
    const oldDestination=store.destination;
    if(fps===24){
      const blocked=path.join(path.dirname(oldDestination),'blocked'); await fs.writeFile(blocked,'file'); store.destination=path.join(blocked,'Screenshots');
      await assert.rejects(store.save(1,jobId)); assert.equal(store.get(1,jobId).phase,'ready'); await fs.access(job.output); store.destination=oldDestination;
    }
    const saved=await store.save(1,jobId); await validateGIFFile(saved.path);
    assert.equal(store.jobs.size,0); await assert.rejects(fs.access(job.directory));
  }
  const {jobId}=await store.begin(1,{width:16,height:8,quality:'medium',loop:true});
  for(const [i,time] of [0,93,417].entries())await store.frame(1,{jobId,width:16,height:8,time,buffer:frame(i)});
  await store.finish(1,{jobId,time:1234});
  assert.equal(inspectGIF(await fs.readFile(store.get(1,jobId).output)).delay,1230);
  await store.save(1,jobId);
});
test('native boundary rejects malformed/stale/foreign frames, handles storage budget and missing binary', async t => {
  const store=await fixture(t,{maxTempBytes:16*8*4+54+512});
  const {jobId}=await store.begin(1,{width:16,height:8,quality:'low',loop:false});
  assert.throws(()=>store.frame(2,{jobId}));
  assert.throws(()=>store.frame(1,{jobId,width:16,height:8,time:0,buffer:new Uint8Array(1)}));
  await store.frame(1,{jobId,width:16,height:8,time:0,buffer:frame(0)});
  store.get(1,jobId).budget=store.get(1,jobId).bytes;
  assert.equal((await store.frame(1,{jobId,width:16,height:8,time:40,buffer:frame(1)})).limit,true);
  await store.finish(1,{jobId,time:100}); await store.save(1,jobId);
  assert.throws(()=>store.get(1,jobId));
  const missing=await fixture(t,{executable:path.join(os.tmpdir(),'no-such-ffmpeg-mdlxl.exe')});
  await assert.rejects(missing.begin(1,{width:16,height:8,quality:'medium',loop:false}),/missing/);
});
test('oversized completed GIF is rejected by file size without a renderer buffer', async t => {
  const store=await fixture(t); await fs.mkdir(store.temporaryRoot,{recursive:true});
  const file=path.join(store.temporaryRoot,'large.gif');
  const handle=await fs.open(file,'w'); await handle.truncate(MAX_CAPTURE_BYTES+1); await handle.close();
  await assert.rejects(validateGIFFile(file),/256 MB/);
});
