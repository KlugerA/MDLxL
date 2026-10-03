import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePaintProjection} from '../src/paint-projection.js';
import {projectPaintDecal} from '../src/paint-decal.js';
import {createPaintRaster} from '../src/paint-raster.js';
import {paintFixtureModel,squareSeamGeoset,paintTarget,IDENTITY_MATRIX} from './fixtures/paint-fixtures.js';

test('a projected image samples each texel at its surface position, not its edge nearest the stamp center',()=>{
  const model=paintFixtureModel([squareSeamGeoset()]),projection=preparePaintProjection(model,paintTarget(),IDENTITY_MATRIX,128,128),raster=createPaintRaster(32),source=createPaintRaster(64);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++)source.data.set([x*4,y*4,60,255],(y*64+x)*4);
  projectPaintDecal(raster,projection,source,{x:64,y:64},{width:64,height:64,opacity:1});
  for(let y=10;y<22;y++)for(let x=10;x<22;x++)assert.deepEqual([...raster.data.slice((y*32+x)*4,(y*32+x+1)*4)],[(x*4-30)*4,(y*4-30)*4,60,255],`texel ${x},${y}`);
});
