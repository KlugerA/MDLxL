import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createPreviewGIF } from '../src/preview-gif.js';
const { savePreviewCapture } = createRequire(import.meta.url)('../electron/preview-capture.cjs');
function frame(color, width = 8, height = 6) { const values = new Uint8Array(width * height * 4); for (let i = 0; i < values.length; i += 4) values.set([...color, 255], i); return values; }
test('GIF records actual elapsed delays and opaque frames with fixed size', () => {
  const gif = createPreviewGIF(); gif.add(frame([255,0,0]),8,6,0); gif.add(frame([0,0,255]),8,6,150);
  const result = gif.finish(450);
  assert.equal(Buffer.from(result.bytes.subarray(0,6)).toString(),'GIF89a');
  assert.equal(result.frames,2); assert.equal(result.duration,450); assert.equal(result.bytes.at(-1),0x3b);
  assert.equal(result.width,8); assert.equal(result.height,6);
  assert.throws(()=>gif.add(frame([0,0,0]),8,6,500),/finished/);
});
test('GIF rejects changing size and malformed frame data', () => {
  const gif = createPreviewGIF(); assert.throws(()=>gif.finish(50),/No recording/);
  gif.add(frame([255,0,0]),8,6,0);
  assert.throws(()=>gif.add(frame([0,0,0],4,4),4,4,50),/dimensions/);
  assert.throws(()=>gif.add(new Uint8Array(1),8,6,50),/Invalid/);
});
test('Capture writes unique preview-only filenames and validates data before writing', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(),'mdlvis-capture-'));
  try {
    const gif = createPreviewGIF(); gif.add(frame([20,40,80]),8,6,0); const {bytes} = gif.finish(100);
    const first = await savePreviewCapture(directory,{format:'gif',bytes,path:'../forbidden.mdx',name:'forbidden.mdx'});
    const second = await savePreviewCapture(directory,{format:'gif',bytes});
    assert.equal(path.dirname(first.path),directory); assert.match(first.name,/^Preview-.*\.gif$/); assert.notEqual(first.path,second.path);
    assert.deepEqual(new Uint8Array(await readFile(first.path)),bytes);
    await assert.rejects(savePreviewCapture(directory,{format:'mdx',bytes}),/PNG or GIF/);
    await assert.rejects(savePreviewCapture(directory,{format:'png',bytes}),/Invalid capture/);
    assert.equal((await readdir(directory)).length,2);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
