import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePaintProjection,stampProjectedBrush,interpolatePaintStroke} from '../src/paint-projection.js';
import {createPaintRaster} from '../src/paint-raster.js';
import {IDENTITY_MATRIX,paintFixtureModel,paintTarget,squareSeamGeoset} from './fixtures/paint-fixtures.js';

const brush={mode:'paint',size:9,zoom:1,hardness:1,opacity:1,flow:1,strength:1,spacing:.2,color:'#ff3010'};
const projection=()=>preparePaintProjection(paintFixtureModel([squareSeamGeoset()]),paintTarget(),IDENTITY_MATRIX,512,512);
const touched=r=>Array.from({length:r.width*r.height},(_,p)=>p).filter(p=>r.data[p*4+3]);

test('a small Normal dab writes one low-resolution texel, not its display-filter neighbours',()=>{
  // Eight screen pixels per texture texel. This dab is centred on texel 30,37.
  // Previously every bilinear filter tap was painted at full opacity (3x3).
  const r=createPaintRaster(64),p=projection();
  assert.equal(stampProjectedBrush(r,p,{x:244,y:300},brush),1);
  assert.deepEqual(touched(r),[37*64+30]);
  assert.deepEqual(Array.from(r.data.slice((37*64+30)*4,(37*64+30)*4+4)),[255,48,16,255]);
});

test('a small brush between texel centres remains paintable without spreading to another row',()=>{
  const r=createPaintRaster(64);
  stampProjectedBrush(r,projection(),{x:248,y:300},{...brush,size:3,opacity:.25});
  assert.deepEqual(touched(r),[37*64+30,37*64+31]);
  for(const pixel of touched(r))assert.equal(r.data[pixel*4+3],64,'use selected opacity, not a weaker substitute');
});

test('Normal can draw a continuous one-texel line across a low-resolution surface',()=>{
  const r=createPaintRaster(64),p=projection(),settings={...brush,size:3};
  const start={x:204,y:300},end={x:284,y:300};
  for(const point of [start,...interpolatePaintStroke(start,end,settings)])stampProjectedBrush(r,p,point,settings);
  assert.deepEqual(touched(r),Array.from({length:11},(_,x)=>37*64+25+x));
  for(const pixel of touched(r))assert.equal(r.data[pixel*4+3],255);
});

test('small texture/cutout dabs use the same tight cells, source colour and independent Zoom',()=>{
  const source=createPaintRaster(32);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++)source.data.set([x*8,y*8,128,255],(y*32+x)*4);
  const paint=(size,zoom)=>{const r=createPaintRaster(64);stampProjectedBrush(r,projection(),{x:244,y:300},{...brush,size,zoom,filterColor:'#8080ff'},{materialRaster:source});return r;};
  const small=paint(9,1),large=paint(25,1),zoomed=paint(9,4);
  assert.deepEqual(touched(small),[37*64+30]);assert.deepEqual(touched(zoomed),touched(small));
  const offset=(37*64+30)*4;
  assert.deepEqual(large.data.slice(offset,offset+4),small.data.slice(offset,offset+4),'Size does not stretch the source');
  assert.equal(small.data[offset+2],128);assert.equal(small.data[offset+3],255);
  assert.ok(small.data[offset]<128&&small.data[offset+1]<128,'RGB filter tints the source');
});

test('small eraser strokes clear the touched texel without erasing its neighbours',()=>{
  const r=createPaintRaster(64,64,[220,180,80,255]);
  assert.equal(stampProjectedBrush(r,projection(),{x:244,y:300},{...brush,mode:'erase'}),1);
  assert.equal(r.data[(37*64+30)*4+3],0);
  assert.equal(r.data[(37*64+29)*4+3],255);assert.equal(r.data[(36*64+30)*4+3],255);
});

test('Drybrush and Wash retain their existing samples before applying geometry masks',()=>{
  for(const mode of ['drybrush','wash']){
    const r=createPaintRaster(64),p=projection();
    stampProjectedBrush(r,p,{x:244,y:300},{...brush,mode});
    assert.equal(touched(r).length,9,'smart techniques retain their original geometry-mask footprint');
    for(const pixel of touched(r))assert.equal(r.data[pixel*4+3],255);
  }
});
