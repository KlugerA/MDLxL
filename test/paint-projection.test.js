import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSmartPaintMasks, interpolatePaintStroke, preparePaintProjection, prepareTexturePaintProjection, projectPaintVertex, samplePaintSource, stampProjectedBrush } from '../src/paint-projection.js';
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

test('texture sources use brush-local image coordinates, preserve colour, and accept an RGB filter',()=>{
  const source=createPaintRaster(2,2);source.data.set([
    240,20,10,255, 20,230,30,255,
    30,40,220,255, 245,210,20,255,
  ]);
  assert.deepEqual(samplePaintSource(source,-.5,-.5),[240,20,10,255]);
  assert.deepEqual(samplePaintSource(source,.5,.5),[245,210,20,255]);
  assert.deepEqual(samplePaintSource(source,-.5,-.5,{filterColor:'#8080ff'}),[120,10,10,255]);

  const destination=createPaintRaster(16),projection=prepareTexturePaintProjection(16),textureBrush={...brush,size:12,zoom:1,filterColor:'#ffffff'};
  assert.ok(stampProjectedBrush(destination,projection,{x:8,y:8},textureBrush,{materialRaster:source})>0);
  const upperLeft=(5*16+5)*4,lowerRight=(10*16+10)*4;
  assert.ok(destination.data[upperLeft]>destination.data[upperLeft+1]);
  assert.ok(destination.data[lowerRight]>destination.data[lowerRight+2]);
});

test('brush diameter changes coverage without changing texture scale; zoom changes texture without changing coverage',()=>{
  const source=createPaintRaster(32,16);
  for(let y=0;y<16;y++)for(let x=0;x<32;x++)source.data.set([x*8,y*16,80,255],(y*32+x)*4);
  const dab=(size,zoom)=>{const raster=createPaintRaster(128);stampProjectedBrush(raster,prepareTexturePaintProjection(128),{x:64,y:64},{...brush,size,zoom},{materialRaster:source});return raster;};
  const small=dab(24,1),large=dab(80,1),zoomed=dab(24,8);
  let compared=0,changed=0;
  for(let y=58;y<70;y++)for(let x=58;x<70;x++){
    const i=(y*128+x)*4;
    assert.deepEqual(large.data.slice(i,i+4),small.data.slice(i,i+4),'enlarging the brush must keep the interior image pixels');compared++;
    if(small.data[i]!==zoomed.data[i])changed++;
  }
  assert.equal(compared,144);assert.ok(changed>100);
  assert.ok(painted(large)>painted(small)*5);assert.equal(painted(small),painted(zoomed));
  assert.equal(large.data[(30*128+30)*4+3],0,'a texture dab must not stamp rectangular corners');
  assert.ok(large.data[(94*128+64)*4+3]>0,'a wide source must not squash the brush footprint');
});

test('model units do not set brush scale when screen framing is unchanged',()=>{
  const source=createPaintRaster(16,16);for(let i=0;i<source.data.length;i+=4)source.data.set([i%251,(i*7)%255,60,255],i);
  const first=paintFixtureModel([squareSeamGeoset()]),second=structuredClone(first),matrix=[...IDENTITY_MATRIX];
  second.Geosets[0].Vertices=Float32Array.from(second.Geosets[0].Vertices,v=>v*100);matrix[0]=matrix[5]=matrix[10]=.01;
  const small=createPaintRaster(128),large=createPaintRaster(128),settings={...brush,size:48,zoom:.5};
  stampProjectedBrush(small,preparePaintProjection(first,paintTarget(),IDENTITY_MATRIX,128,128),{x:64,y:64},settings,{materialRaster:source});
  stampProjectedBrush(large,preparePaintProjection(second,paintTarget(),matrix,128,128),{x:64,y:64},settings,{materialRaster:source});
  assert.deepEqual(large,small);
});

test('dragging blurs only the chosen texture source instead of sampling existing paint',()=>{
  const source=createPaintRaster(5,1);source.data.set([
    255,0,0,255, 255,0,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  ]);
  const crisp=samplePaintSource(source,0,0),smeared=samplePaintSource(source,0,0,{motion:{x:1,y:0}});
  assert.deepEqual(crisp,[0,0,255,255]);
  assert.ok(smeared[0]>crisp[0]);assert.ok(smeared[2]<crisp[2]);assert.equal(smeared[3],255);
});
