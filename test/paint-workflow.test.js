import test from 'node:test';
import assert from 'node:assert/strict';
import {changePaintRegion,paintRegionEntries,regionPaintTarget,isolatePaintRegion,paintConnectedPieces} from '../src/paint-region.js';
import {relatedPaintColors,paintRampColor} from '../src/paint-palette.js';
import {paintBrushTip} from '../src/paint-brush-shapes.js';
import {blendProjectedPaint} from '../src/paint-blend.js';
import {prepareTexturePaintProjection,stampProjectedBrush} from '../src/paint-projection.js';
import {createPaintRaster} from '../src/paint-raster.js';
import {preparePaintUVSelectionChange} from '../src/paint-selection-space.js';
import {createPaintProject,addPaintProjectTarget,recordPaintSurfaceChange,travelPaintHistory} from '../src/paint-project.js';
import {paintProjectModel} from '../src/paint-view.js';
import {paintFixtureModel,triangleGeoset} from './fixtures/paint-fixtures.js';

test('selection adds across geosets, subtracts precisely, and retains an empty mask until cleared',()=>{
  let region=changePaintRegion(null,0,new Set([0,2]));region=changePaintRegion(region,1,new Set([0]),'add');
  assert.deepEqual(paintRegionEntries(region).map(([id,f])=>[id,[...f]]),[[0,[0,2]],[1,[0]]]);
  region=changePaintRegion(region,0,new Set([2]),'subtract');assert.deepEqual([...region.byGeoset.get(0)],[0]);
  const target={bindings:[{geosetIndex:0},{geosetIndex:1},{geosetIndex:2}]};assert.equal(regionPaintTarget(target,region,0).bindings.length,2);
  region=changePaintRegion(region,0,new Set([0]),'subtract');assert.equal(region.geosetIndex,1);assert.deepEqual([...region.faces],[0]);region=changePaintRegion(region,1,new Set([0]),'subtract');assert.equal(regionPaintTarget(target,region).bindings.length,0);assert.equal(regionPaintTarget(target,null).bindings.length,3);
});
test('multi-part isolation keeps original face ids and does not mutate geometry',()=>{
  const geo=triangleGeoset();geo.Faces=new Uint16Array([0,1,2,2,1,0]);const model=paintFixtureModel([geo,structuredClone(geo)]),before=structuredClone(model);
  const region=changePaintRegion(changePaintRegion(null,0,new Set([1])),1,new Set([0]),'add'),view=isolatePaintRegion(model,region);
  assert.deepEqual(view.Geosets.map(g=>g.paintFaceIndices),[[1],[0]]);assert.deepEqual(model,before);assert.equal(paintConnectedPieces(geo).pieces.length,1);
});
test('a bone midtone remains exact in a continuous ramp with dark brown and pale highlights',()=>{
  const colors=relatedPaintColors('#dfd1a8');assert.equal(colors.length,9);assert.equal(colors[4],'#dfd1a8');assert.equal(paintRampColor(colors,.5),'#dfd1a8');
  assert.equal(paintRampColor(colors,0),colors[0]);assert.equal(paintRampColor(colors,1),colors[8]);
  const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));const dark=rgb(colors[0]),light=rgb(colors[8]);assert.ok(dark[0]>dark[1]&&dark[1]>dark[2]);assert.ok(light.every(v=>v>230));
});
test('brush shapes create distinct marks and respect protected pixels',()=>{
  const digests=[];for(const shape of ['round','chisel','speckle']){
    const raster=createPaintRaster(32),mask=new Uint8Array(1024);for(let i=0;i<1024;i++)mask[i]=i%32<16?255:0;
    stampProjectedBrush(raster,prepareTexturePaintProjection(32),{x:16,y:16},{size:24,color:'#ffaa22',hardness:1,opacity:1,strength:1,flow:1,mode:'paint'},{tipRaster:paintBrushTip(shape),mask});
    assert.ok(raster.data.some((v,i)=>i%4===3&&v));assert.equal(raster.data.some((v,i)=>i%4===3&&Math.floor(i/4)%32>=16&&v),false);digests.push(Buffer.from(raster.data).toString('base64'));
  }assert.equal(new Set(digests).size,3);
});
test('Blend strength is bounded for an entire stroke, including repeated dabs',()=>{
  const reference=createPaintRaster(16,16,[255,255,255,255]);for(let y=0;y<16;y++)for(let x=0;x<8;x++)reference.data.set([30,20,10,255],(y*16+x)*4);
  const sums=[];for(const strength of [0,.1,.6]){
    const raster=createPaintRaster(16),state={},projection=prepareTexturePaintProjection(16);
    for(let i=0;i<80;i++)blendProjectedPaint(raster,projection,{x:8,y:8},{size:16,opacity:1,blendStrength:strength},{reference},state);
    const alphas=Array.from(raster.data).filter((_,i)=>i%4===3);assert.ok(Math.max(...alphas)<=Math.ceil(strength*255)+1);sums.push(alphas.reduce((n,v)=>n+v,0));
  }assert.equal(sums[0],0);assert.ok(sums[2]>sums[1]&&sums[1]>0);
});
test('selected UVs detach shared corners while preserving neighbors, rig streams, pixels and Undo',()=>{
  const geo=triangleGeoset();geo.Faces=new Uint16Array([0,1,2,2,1,0]);geo.VertexGroup=new Uint8Array([0,1,0]);geo.Groups=[[7],[8]];geo.SkinWeights=Uint8Array.from({length:24},(_,i)=>i);geo.Tangents=Float32Array.from({length:12},(_,i)=>i/10);
  const model=paintFixtureModel([geo]),before=structuredClone(model),project=createPaintProject({sourceMode:'current'});project.preserveMaterials=true;
  const target=addPaintProjectTarget(project,{id:'skin',textureId:0,bindings:[{geosetIndex:0,layerIndex:0,coordId:0}],geosetIndices:[0]},createPaintRaster(16,16,[80,90,100,255])),next=Float32Array.from(geo.TVertices[0],v=>v+.2);
  const staged=preparePaintUVSelectionChange(model,project,target,0,new Set([0]),next),changed=staged.geometry[0];
  assert.equal(changed.Vertices.length,geo.Vertices.length*2);assert.deepEqual(staged.target.base,target.base);assert.deepEqual(model,before);
  for(let corner=0;corner<6;corner++){
    const from=geo.Faces[corner],to=changed.Faces[corner];for(const [key,stride] of [['Vertices',3],['Normals',3],['VertexGroup',1],['Tangents',4],['SkinWeights',8]])assert.deepEqual(changed[key].slice(to*stride,(to+1)*stride),geo[key].slice(from*stride,(from+1)*stride));
    assert.deepEqual(changed.TVertices[0].slice(to*2,to*2+2),(corner<3?next:geo.TVertices[0]).slice(from*2,from*2+2));
  }
  recordPaintSurfaceChange(project,target.id,staged,'Move UVs');const after=paintProjectModel(model,project);travelPaintHistory(project);assert.deepEqual(paintProjectModel(model,project).Geosets,model.Geosets);travelPaintHistory(project,true);assert.deepEqual(paintProjectModel(model,project),after);
});
