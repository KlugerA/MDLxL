import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRasterDelta, blendPaintPixel, compositePaintRasters, createPaintRaster, fillRasterMask, rasterRegionDelta, resizePaintRaster } from '../src/paint-raster.js';

test('coat compositing preserves source alpha until an explicit alpha mask erases it',()=>{
  const base=createPaintRaster(2,2,[10,20,30,77]),coat={visible:true,opacity:1,raster:createPaintRaster(2,2,[210,80,40,255])};
  const preserved=compositePaintRasters(base,[coat]);
  assert.deepEqual([...preserved.data.slice(0,4)],[210,80,40,77]);
  const alphaMask=createPaintRaster(2,2,[255,255,255,255]);
  blendPaintPixel(alphaMask.data,0,[0,0,0,0],.5,'erase');
  const erased=compositePaintRasters(base,[coat],{alphaMask});
  assert.equal(erased.data[3],39);
  assert.equal(erased.data[7],77);
});

test('raster tile deltas undo and redo the smallest changed rectangle',()=>{
  const before=createPaintRaster(8,8,[0,0,0,0]),after=createPaintRaster(8,8,[0,0,0,0]);
  blendPaintPixel(after.data,(3*8+2)*4,[255,12,3,255],1);
  blendPaintPixel(after.data,(4*8+4)*4,[4,5,6,255],1);
  const delta=rasterRegionDelta(before,after);
  assert.deepEqual({x:delta.x,y:delta.y,width:delta.width,height:delta.height},{x:2,y:3,width:3,height:2});
  applyRasterDelta(after,delta,'before');assert.deepEqual(after,before);
  applyRasterDelta(before,delta,'after');assert.equal(before.data[(4*8+4)*4],4);
});

test('mask strength, erasing, and deterministic nearest resize retain RGBA boundaries',()=>{
  const raster=createPaintRaster(2,2,[0,0,0,0]);
  fillRasterMask(raster,new Uint8ClampedArray([255,0,128,255]),'#ff0000',.5);
  assert.deepEqual([...raster.data.slice(0,8)],[255,0,0,128,0,0,0,0]);
  blendPaintPixel(raster.data,0,[0,0,0,0],1,'erase');assert.equal(raster.data[3],0);
  const enlarged=resizePaintRaster(raster,4,4);assert.equal(enlarged.width,4);assert.deepEqual([...enlarged.data.slice(0,4)],[255,0,0,0]);
});
