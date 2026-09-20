import test from 'node:test';
import assert from 'node:assert/strict';
import {shapeSelection,magicSelection,combineSelection,featherSelection,extractPaintCutout} from '../src/paint-selection.js';
import {pastePaintDecal,projectPaintDecal} from '../src/paint-decal.js';
import {createPaintRaster} from '../src/paint-raster.js';
import {prepareTexturePaintProjection} from '../src/paint-projection.js';

test('rectangle, ellipse and closed freehand masks preserve cropped alpha and source pixels',()=>{
  const raster=createPaintRaster(8,8,[80,90,100,128]),original=raster.data.slice();
  const points=[{x:2,y:2},{x:6,y:6}],rectangle=shapeSelection(8,8,'rectangle',points),ellipse=shapeSelection(8,8,'ellipse',points);
  assert.equal(rectangle.filter(Boolean).length,16);assert.ok(ellipse.reduce((a,b)=>a+b,0)<16*255);
  const polygon=shapeSelection(8,8,'lasso',[{x:2,y:2},{x:6,y:2},{x:6,y:6},{x:2,y:6}]);assert.deepEqual(polygon,rectangle);
  const cut=extractPaintCutout(raster,rectangle);assert.deepEqual([cut.width,cut.height],[4,4]);assert.equal(cut.data[3],128);assert.deepEqual(raster.data,original);
  assert.ok(featherSelection(rectangle,8,8,1)[1*8+1]>0);assert.throws(()=>extractPaintCutout(raster,new Uint8Array(64)),/Select a visible/);
});
test('magic wand isolates connected colour, supports global match, tolerance, and mask operations',()=>{
  const raster=createPaintRaster(5,1,[20,30,40,255]);raster.data.set([200,100,50,255],8);
  const local=magicSelection(raster,0,0,0,true),global=magicSelection(raster,0,0,0,false);
  assert.deepEqual([...local],[255,255,0,0,0]);assert.deepEqual([...global],[255,255,0,255,255]);
  assert.equal(magicSelection(raster,0,0,255,true).filter(Boolean).length,5);
  assert.deepEqual([...combineSelection(global,local,'subtract')],[0,0,0,255,255]);assert.deepEqual(combineSelection(global,local,'intersect'),local);
  assert.equal(magicSelection(raster,-1,0).some(Boolean),false);
});

test('scanline lasso retains concave regions and the four-sample boundary of a long contour',()=>{
  const lasso=shapeSelection(5,5,'lasso',[{x:0,y:0},{x:4,y:0},{x:4,y:1},{x:1,y:1},{x:1,y:4},{x:0,y:4}]);assert.equal(lasso.filter(Boolean).length,7);assert.equal(lasso[2*5+2],0);
  const contour=Array.from({length:2048},(_,i)=>({x:128+100*Math.cos(i/2048*Math.PI*2),y:128+100*Math.sin(i/2048*Math.PI*2)}));
  const mask=shapeSelection(256,256,'lasso',contour),ellipse=shapeSelection(256,256,'ellipse',[{x:28,y:28},{x:228,y:228}]);assert.deepEqual(mask,ellipse);
});
test('cutouts retain rectangular corners and alpha with mirrored and rotated placement in both views',()=>{
  const source=createPaintRaster(2,2,[255,0,0,255]);source.data.set([0,255,0,255],4);source.data[11]=0;
  const transform={width:4,height:4,angle:0,opacity:1},a=createPaintRaster(8),b=createPaintRaster(8);
  assert.equal(pastePaintDecal(a,source,{x:4,y:4},transform),12);
  projectPaintDecal(b,prepareTexturePaintProjection(8),source,{x:4,y:4},transform);assert.deepEqual(a.data,b.data);
  assert.equal(a.data[(2*8+2)*4+3],255);assert.equal(a.data[(5*8+2)*4+3],0);
  const flip=createPaintRaster(8);pastePaintDecal(flip,source,{x:4,y:4},{...transform,flipX:true});assert.equal(flip.data[(2*8+2)*4+1],255);
  const turned=createPaintRaster(8);pastePaintDecal(turned,source,{x:4,y:4},{...transform,angle:90});assert.equal(turned.data[(2*8+2)*4+3],0);
});
