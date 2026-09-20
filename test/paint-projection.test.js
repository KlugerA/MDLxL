import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSmartPaintMasks, interpolatePaintStroke, preparePaintProjection, projectPaintVertex, stampProjectedBrush } from '../src/paint-projection.js';
import { createPaintRaster } from '../src/paint-raster.js';
import { IDENTITY_MATRIX, paintFixtureModel, paintTarget, squareSeamGeoset, triangleGeoset } from './fixtures/paint-fixtures.js';

const brush={id:'round',name:'Round',mode:'paint',size:10,hardness:1,opacity:1,flow:1,spacing:.2,strength:1,color:'#ff3010'};
const painted=raster=>{let count=0;for(let i=3;i<raster.data.length;i+=4)if(raster.data[i])count++;return count;};

test('screen projection maps rest-pose vertices and interpolates fast strokes without gaps',()=>{
  assert.deepEqual(projectPaintVertex(IDENTITY_MATRIX,new Float32Array([-1,1,0]),0,100,80),{x:0,y:0,z:0,w:1});
  const points=interpolatePaintStroke({x:0,y:0},{x:100,y:0},{...brush,size:20,spacing:.25});
  assert.equal(points.length,20);assert.deepEqual(points.at(-1),{x:100,y:0});
  assert.ok(points.every((point,index)=>index===0||point.x-points[index-1].x<=5.000001));
});

test('a projected brush crosses a UV seam and overlapping or mirrored faces share pixels',()=>{
  const model=paintFixtureModel([squareSeamGeoset()]),target=paintTarget(),projection=preparePaintProjection(model,target,IDENTITY_MATRIX,32,32,32),raster=createPaintRaster(32);
  assert.equal(projection.triangles.length,2);
  assert.ok(stampProjectedBrush(raster,projection,{x:16,y:16},brush,{flags:0})>0);
  assert.ok(painted(raster)>20);
  assert.ok(raster.data[(16*32+14)*4+3]>0);
  assert.ok(raster.data[(16*32+18)*4+3]>0);
  const shared=paintFixtureModel([triangleGeoset(),triangleGeoset()]),sharedRaster=createPaintRaster(32),sharedProjection=preparePaintProjection(shared,paintTarget([0,1]),IDENTITY_MATRIX,32,32,32);
  assert.equal(sharedProjection.triangles.length,2);
  stampProjectedBrush(sharedRaster,sharedProjection,{x:8,y:22},brush,{flags:0});
  assert.ok(painted(sharedRaster)>0);
});

test('depth occlusion prevents painting through a nearer model surface',()=>{
  const model=paintFixtureModel([triangleGeoset({z:-.5}),triangleGeoset({z:.5})]),back=paintTarget([1]),front=paintTarget([0]);
  const hidden=createPaintRaster(32),visible=createPaintRaster(32);
  stampProjectedBrush(hidden,preparePaintProjection(model,back,IDENTITY_MATRIX,32,32,32),{x:8,y:22},brush,{flags:0});
  stampProjectedBrush(visible,preparePaintProjection(model,front,IDENTITY_MATRIX,32,32,32),{x:8,y:22},brush,{flags:0});
  assert.equal(painted(hidden),0);assert.ok(painted(visible)>0);
});

test('UVs beyond one paint repeated texels in wrap mode and only the displayed edge in clamp mode',()=>{
  const model=paintFixtureModel([triangleGeoset({uv:[1,1,2,1,1,0]})]),target=paintTarget(),projection=preparePaintProjection(model,target,IDENTITY_MATRIX,32,32,32),wrapped=createPaintRaster(32),clamped=createPaintRaster(32);
  stampProjectedBrush(wrapped,projection,{x:8,y:22},brush,{flags:1});
  stampProjectedBrush(clamped,projection,{x:8,y:22},brush,{flags:0});
  assert.ok(painted(wrapped)>0);assert.ok(painted(clamped)>0);
  for(let y=0;y<32;y++)for(let x=0;x<31;x++)assert.equal(clamped.data[(y*32+x)*4+3],0);
  assert.ok(wrapped.data[(22*32+8)*4+3]>0);
});

test('smart wash and drybrush masks derive distinct cavity and exposed-edge fields',()=>{
  const model=paintFixtureModel([squareSeamGeoset()]),masks=buildSmartPaintMasks(model,paintTarget(),32);
  assert.equal(masks.wash.length,1024);assert.equal(masks.drybrush.length,1024);
  assert.ok(Math.max(...masks.wash)>0);assert.ok(Math.max(...masks.drybrush)>0);
  assert.notDeepEqual(masks.wash,masks.drybrush);
  assert.ok(masks.drybrush[1*32+1]>masks.drybrush[16*32+16]);
});
