import test from 'node:test';
import assert from 'node:assert/strict';
import { paintHalfModel, paintPartCenter, paintProjectModel, paintGeosetTarget, paintGeosetMask, paintOutlinePositions, paintStandHidden, visiblePaintGeosets } from '../src/paint-view.js';
import { preparePaintProjection, preparePaintSurface, stampProjectedBrush } from '../src/paint-projection.js';
import { createPaintRaster } from '../src/paint-raster.js';
import { IDENTITY_MATRIX, squareSeamGeoset, triangleGeoset, paintFixtureModel, paintTarget } from './fixtures/paint-fixtures.js';

test('initial miniature visibility uses Stand, while selecting corpse geometry reveals it without changing the model',()=>{
  const model=paintFixtureModel([triangleGeoset(),triangleGeoset(),triangleGeoset({materialId:1})]);
  model.Sequences=[{Name:'Death',Interval:[0,999]},{Name:'Stand - 1',Interval:[1000,2000]}];
  model.GeosetAnims=[{GeosetId:1,Alpha:{LineType:0,Keys:[{Frame:0,Vector:[1]},{Frame:1000,Vector:[0]}]}}];
  model.Textures.push({Image:'',ReplaceableId:2});model.Materials.push({Layers:[{TextureID:1,Alpha:1}]});
  const before=structuredClone(model);assert.deepEqual([...paintStandHidden(model)],[1]);assert.deepEqual(visiblePaintGeosets(model),[0]);assert.deepEqual(visiblePaintGeosets(model,1),[0,1]);assert.deepEqual(model,before);
  model.Sequences=[];assert.deepEqual([...paintStandHidden(model)],[]);
});

test('distant attachments cannot move the half plane and an offset remains explicitly adjustable',()=>{
  const torso=squareSeamGeoset(),weapon=triangleGeoset();for(let i=0;i<weapon.Vertices.length;i+=3)weapon.Vertices[i]+=100;
  const model=paintFixtureModel([torso,weapon]),half=paintHalfModel(model,{axis:'x',side:1});
  assert.equal(paintPartCenter(model,0,'x'),0);assert.equal(Math.min(...Array.from(half.Geosets[0].Vertices).filter((_,i)=>i%3===0)),0);assert.ok(half.Geosets[0].Faces.length);
  const shifted=paintHalfModel(model,{axis:'x',side:1,position:.5});assert.equal(Math.min(...Array.from(shifted.Geosets[0].Vertices).filter((_,i)=>i%3===0)),.5);
});
test('UV edits create a paint-only model and reject malformed coordinate sets',()=>{
  const model=paintFixtureModel([squareSeamGeoset()]),before=structuredClone(model),uv=Array.from(model.Geosets[0].TVertices[0],v=>v+.2),project={uvEdits:{'0:0':uv}};
  const painted=paintProjectModel(model,project);assert.deepEqual(model,before);assert.notEqual(painted.Geosets[0],model.Geosets[0]);assert.deepEqual(painted.Geosets[0].TVertices[0],new Float32Array(uv));
  assert.throws(()=>paintProjectModel(model,{uvEdits:{'0:0':[NaN]}}),/invalid UV/);
});

test('mirror freeze clips crossing triangles and interpolates every UV set without changing source geometry',()=>{
  const geo=squareSeamGeoset();geo.TVertices.push(new Float32Array(geo.TVertices[0]));
  const model=paintFixtureModel([geo]),snapshot=structuredClone(model);
  for(const side of [-1,1]){
    const half=paintHalfModel(model,{axis:'x',side}).Geosets[0];
    assert.ok(half.Faces.length>0);
    for(let i=0;i<half.Vertices.length;i+=3){assert.ok(half.Vertices[i]*side>=0);assert.ok(Math.abs(half.TVertices[0][i/3*2]-(half.Vertices[i]+1)/2)<1e-6);}
    assert.deepEqual(half.TVertices[0],half.TVertices[1]);assert.equal(half.Normals.length,half.Vertices.length);
  }
  assert.deepEqual(model,snapshot);assert.equal(paintHalfModel(model,null),model);
});

test('outline contains silhouette boundaries and excludes the internal UV seam diagonal',()=>{
  assert.equal(paintOutlinePositions(squareSeamGeoset(),IDENTITY_MATRIX).length,4*6);
});

test('geoset scoping prevents painting and fill on another geoset with separate UV pixels',()=>{
  const first=triangleGeoset({uv:[0,1,.45,1,0,0]}),second=triangleGeoset({uv:[.55,1,1,1,.55,0]});
  const model=paintFixtureModel([first,second]),target=paintGeosetTarget(paintTarget([0,1]),0);
  const mask=paintGeosetMask(model,target,64),raster=createPaintRaster(64),projection=preparePaintProjection(model,target,IDENTITY_MATRIX,64,64,64);
  stampProjectedBrush(raster,projection,{x:32,y:32},{size:100,hardness:1,color:'#ffffff',opacity:1,flow:1,strength:1,mode:'paint'});
  assert.ok(mask.some(Boolean));assert.ok(raster.data.some(Boolean));
  for(let y=0;y<64;y++)for(let x=33;x<64;x++){assert.equal(mask[y*64+x],0);assert.equal(raster.data[(y*64+x)*4+3],0);}
});

test('hidden occluders leave the depth surface and cached samples are reused until dimensions change',()=>{
  const model=paintFixtureModel([triangleGeoset({z:.5}),triangleGeoset({z:-.5})]),target=paintTarget([0]);
  const projection=preparePaintProjection(model,target,IDENTITY_MATRIX,64,64,64,new Set([1])),raster=createPaintRaster(64);
  const surface=preparePaintSurface(projection,raster);assert.ok(surface.bins.size>0);assert.equal(preparePaintSurface(projection,raster),surface);
  assert.notEqual(preparePaintSurface(projection,createPaintRaster(32)),surface);
});

test('hide half keeps a filter-texel margin without allowing strokes on the hidden surface',()=>{
  const model=paintFixtureModel([squareSeamGeoset()]),half=paintHalfModel(model,{axis:'x',side:1}),target=paintTarget();
  const hidden=paintGeosetMask(half,target,64),both=paintGeosetMask(model,target,64);
  // Half of the UV map plus one adjacent filter row at the cut edge.
  assert.equal(hidden.filter(Boolean).length,64*33);assert.equal(both.filter(Boolean).length,64*64);
  const raster=createPaintRaster(64),projection=preparePaintProjection(half,target,IDENTITY_MATRIX,64,64,64);
  stampProjectedBrush(raster,projection,{x:16,y:32},{size:12,hardness:1,color:'#ffffff',opacity:1,flow:1,strength:1,mode:'paint'});
  assert.equal(raster.data.some(Boolean),false);
});
