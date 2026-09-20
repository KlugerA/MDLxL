import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePaintDds} from '../src/paint-blp.js';
import {decodeDds} from '../src/dds.js';

for(const [width,height] of [[256,256],[31,7],[1,1]])test(`DDS DXT5 saves ${width}×${height} with alpha and every mip`,async()=>{
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set([x*255/Math.max(1,width-1),y*255/Math.max(1,height-1),128,width===1?255:x<width/2?0:255],(y*width+x)*4);
  const bytes=await encodePaintDds({width,height,data}),header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(header.getUint32(0,true),0x20534444);
  assert.equal(header.getUint32(84,true),0x35545844,'Use legacy DXT5 supported by the existing editor');
  const levels=Math.floor(Math.log2(Math.max(width,height)))+1;
  assert.equal(header.getUint32(28,true)||1,levels);
  let offset=128;
  for(let level=0;level<levels;level++){
    const w=Math.max(1,width>>level),h=Math.max(1,height>>level),size=Math.ceil(w/4)*Math.ceil(h/4)*16;
    const mip=new Uint8Array(128+size);mip.set(bytes.subarray(0,128));mip.set(bytes.subarray(offset,offset+size),128);
    new DataView(mip.buffer).setUint32(12,h,true);new DataView(mip.buffer).setUint32(16,w,true);
    const decoded=decodeDds(mip);assert.deepEqual([decoded.width,decoded.height,decoded.data.length],[w,h,w*h*4]);
    if(level===0){
      let colorError=0;for(let i=0;i<data.length;i++)if(i%4!==3)colorError+=Math.abs(data[i]-decoded.data[i]);
      assert.ok(colorError/(w*h*3)<10,'Color error stays below ten byte levels on the gradient fixture');
      for(let i=3;i<data.length;i+=4)assert.ok(Math.abs(data[i]-decoded.data[i])<2,'Retain opaque and transparent pixels');
    }
    offset+=size;
  }
  assert.equal(offset,bytes.length,'Mip chain accounts for the complete saved file');
});

test('DDS rejects unsupported raster dimensions without invoking the codec',async()=>{
  for(const raster of [{width:0,height:1,data:new Uint8ClampedArray(0)},{width:2,height:2,data:new Uint8ClampedArray(4)},{width:4097,height:1,data:new Uint8ClampedArray(4097*4)}])await assert.rejects(encodePaintDds(raster),/RGBA texture up to 4096/);
});
