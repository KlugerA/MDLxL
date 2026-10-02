import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaintRaster} from '../src/paint-raster.js';
import {borrowPaintPixel} from '../src/paint-borrow.js';
import {projectPaintDecal} from '../src/paint-decal.js';
import {prepareTexturePaintProjection} from '../src/paint-projection.js';
import {blendProjectedPaint} from '../src/paint-blend.js';

test('texture borrowing keeps red paint red while transferring light and dark detail',()=>{
  const source=createPaintRaster(2,1);source.data.set([40,60,80,255,180,200,220,255]);
  const reference=createPaintRaster(2,1,[160,32,16,255]),dark=[],light=[];
  borrowPaintPixel(source,0,reference,0,'texture',dark);borrowPaintPixel(source,4,reference,1,'texture',light);
  assert.ok(dark[0]<160&&light[0]>160);assert.ok(dark[0]>dark[1]*4&&light[0]>light[1]*3);
  const h=[];borrowPaintPixel(source,0,reference,0,'highlights',h);assert.deepEqual(h,[160,32,16,255]);
  borrowPaintPixel(source,4,reference,1,'highlights',h);assert.ok(h[0]>160&&h[1]>32);
});
test('borrowed decal respects source alpha and selection and leaves reference untouched',()=>{
  const source=createPaintRaster(2,1,[220,220,220,255]);source.data[7]=0;
  const reference=createPaintRaster(4,1,[150,30,15,255]),before=reference.data.slice(),target=createPaintRaster(4,1),projection=prepareTexturePaintProjection(4,1);
  projectPaintDecal(target,projection,source,{x:2,y:.5},{width:4,height:1,opacity:1},{borrowMode:'texture',reference,mask:Uint8Array.from([0,255,255,255])});
  assert.deepEqual([...target.data],[0,0,0,0,150,30,15,255,0,0,0,0,0,0,0,0]);assert.deepEqual(reference.data,before);
});
test('blend mixes visible selected pigment without sampling an excluded green region',()=>{
  const reference=createPaintRaster(8,2,[240,0,0,255]);for(let y=0;y<2;y++)for(let x=4;x<8;x++)reference.data.set([0,255,0,255],(y*8+x)*4);
  const raster=createPaintRaster(8,2),mask=Uint8Array.from({length:16},(_,i)=>i%8<4?255:0),state={};
  blendProjectedPaint(raster,prepareTexturePaintProjection(8,2),{x:3,y:1},{size:8,opacity:1,strength:1},{reference,mask},state);
  assert.ok(state.color[0]>230);assert.equal(state.color[1],0);for(let i=0;i<16;i++)if(i%8>=4)assert.equal(raster.data[i*4+3],0);
});
