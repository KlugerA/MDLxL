import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePaintProjection,stampProjectedBrush} from '../src/paint-projection.js';
import {paintGeosetMask,paintGeosetTarget} from '../src/paint-view.js';
import {createPaintRaster,fillRasterMask} from '../src/paint-raster.js';
import {createPaintDirtyRows} from '../src/paint-preview.js';
import {projectPaintDecal} from '../src/paint-decal.js';
import {IDENTITY_MATRIX,paintFixtureModel,paintTarget,triangleGeoset} from './fixtures/paint-fixtures.js';
import {OrthographicCamera,PerspectiveCamera,Matrix4,Vector3} from 'three';

function mirroredPanel(){return {
  Vertices:new Float32Array([-1,-1,0,0,-1,0,0,1,0,-1,1,0,0,-1,0,1,-1,0,1,1,0,0,1,0]),
  Normals:new Float32Array(Array.from({length:8},()=>[0,0,1]).flat()),Faces:new Uint16Array([0,1,2,0,2,3,4,5,6,4,6,7]),
  TVertices:[new Float32Array([.125,.125,.5,.125,.5,.875,.125,.875,.5,.125,.125,.125,.125,.875,.5,.875])],MaterialID:0,
};}
const brush={mode:'paint',size:20,hardness:1,color:'#ffffff',opacity:1,flow:1,strength:1};
const alpha=(r,x,y)=>r.data[(y*r.width+x)*4+3];

test('painting a mirrored centre seam covers both bilinear filter taps and records gutter uploads',()=>{
  const model=paintFixtureModel([mirroredPanel()]),target=paintTarget(),raster=createPaintRaster(32),rows=createPaintDirtyRows(32);
  stampProjectedBrush(raster,preparePaintProjection(model,target,IDENTITY_MATRIX,64,64,64),{x:32,y:32},brush,{dirtyRows:rows});
  assert.equal(alpha(raster,15,16),255);assert.equal(alpha(raster,16,16),255);
  assert.equal((alpha(raster,15,16)+alpha(raster,16,16))/2,255,'a filtered sample exactly at u=.5 has no unpainted line');
  assert.ok(rows[16*2+1]>=16,'the gutter is uploaded with the stroke');assert.equal(alpha(raster,20,16),0);
});

test('fill reaches shared filter taps while separate texture pixels remain untouched',()=>{
  const panel=mirroredPanel(),model=paintFixtureModel([panel]),raster=createPaintRaster(32);
  fillRasterMask(raster,paintGeosetMask(model,paintTarget(),32),'#ffffff');assert.equal(alpha(raster,16,16),255);
  const neighbour=triangleGeoset({uv:[.51,.1,.9,.1,.51,.9]}),shared=paintFixtureModel([panel,neighbour]),target=paintGeosetTarget(paintTarget([0,1]),0),mask=paintGeosetMask(shared,target,32);
  assert.equal(mask[10*32+16],255,'the selected panel also samples this pixel through bilinear filtering');
  assert.equal(mask[10*32+17],0,'pixels outside the selected panel filter footprint remain protected');
});

test('mirrored faces and triangle boundaries blend each dab once at the chosen opacity',()=>{
  const model=paintFixtureModel([mirroredPanel()]),raster=createPaintRaster(32),projection=preparePaintProjection(model,paintTarget(),IDENTITY_MATRIX,64,64,64);
  stampProjectedBrush(raster,projection,{x:32,y:32},{...brush,opacity:.25});
  let max=0;for(let i=3;i<raster.data.length;i+=4)max=Math.max(max,raster.data[i]);assert.equal(max,64);
  assert.equal(alpha(raster,15,16),alpha(raster,16,16));
  stampProjectedBrush(raster,projection,{x:32,y:32},{...brush,opacity:.25});assert.ok(alpha(raster,15,16)>64,'later dabs can still build opacity');
});

test('erasing the seam reaches gutter texels with the same opacity and respects depth occlusion',()=>{
  const panel=mirroredPanel(),model=paintFixtureModel([panel]),raster=createPaintRaster(32,32,[255,255,255,255]);
  stampProjectedBrush(raster,preparePaintProjection(model,paintTarget(),IDENTITY_MATRIX,64,64,64),{x:32,y:32},{...brush,mode:'erase',opacity:.25});
  assert.equal(alpha(raster,15,16),191);assert.equal(alpha(raster,16,16),191);
  const front={...panel,Vertices:new Float32Array(Array.from(panel.Vertices,(v,i)=>i%3===2?-.5:v))},hidden=paintFixtureModel([panel,front]),untouched=createPaintRaster(32);
  stampProjectedBrush(untouched,preparePaintProjection(hidden,paintTarget([0]),IDENTITY_MATRIX,64,64,64),{x:32,y:32},brush);
  assert.ok(untouched.data.every(v=>v===0));
});

function filteredAlpha(raster,u,v){
  const px=u*raster.width-.5,py=v*raster.height-.5,x=Math.floor(px),y=Math.floor(py),dx=px-x,dy=py-y;let result=0;
  for(let j=0;j<2;j++)for(let i=0;i<2;i++)result+=alpha(raster,Math.max(0,Math.min(raster.width-1,x+i)),Math.max(0,Math.min(raster.height-1,y+j)))*(i?dx:1-dx)*(j?dy:1-dy);
  return result;
}

function bentUVSeam(){return {
  Vertices:new Float32Array([-1,-1,0,0,-1,0,0,1,0,-1,1,0,0,-1,0,1,-1,.6,1,1,.6,0,1,0]),
  Normals:new Float32Array(Array.from({length:8},()=>[0,0,1]).flat()),Faces:new Uint16Array([0,1,2,0,2,3,4,5,6,4,6,7]),
  TVertices:[new Float32Array([.1,.1,.4,.1,.4,.9,.1,.9,.6,.1,.9,.1,.9,.9,.6,.9])],MaterialID:0,
};}

test('turning a folded surface paints both UV seam edges, including inside filter taps of magnified texels',()=>{
  const model=paintFixtureModel([bentUVSeam()]),target=paintTarget(),raster=createPaintRaster(32);
  for(const angle of [-35,0,35]){
    raster.data.fill(0);
    const camera=new OrthographicCamera(-1.6,1.6,1.6,-1.6,.1,100);camera.position.set(Math.sin(angle*Math.PI/180)*5,0,-Math.cos(angle*Math.PI/180)*5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const matrix=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
    const projection=preparePaintProjection(model,target,matrix,960,960),center=new Vector3(0,0,0).project(camera);
    stampProjectedBrush(raster,projection,{x:(center.x+1)*480,y:(1-center.y)*480},{...brush,size:18});
    assert.equal(filteredAlpha(raster,.4,.5),255,`left seam at ${angle} degrees`);
    assert.equal(filteredAlpha(raster,.6,.5),255,`right seam at ${angle} degrees`);
    assert.equal(filteredAlpha(raster,.2,.5),0,'the dab remains local to the seam');
  }
});

test('the real shoulder UV split receives equal paint after a 270 degree camera turn',()=>{
  // The reported Ogre shoulder has a duplicated vertex with UVs only three
  // texels apart. Triangle-centre projection missed most of the second edge.
  const geoset={
    Vertices:new Float32Array([-6.8542399406433105,10.10575008392334,111.03150177001953,-19.094900131225586,-.5496600270271301,100.87300109863281,-7.288249969482422,-.13684199750423431,111.03150177001953,-6.8542399406433105,10.10575008392334,111.03150177001953,-19.792600631713867,21.72010040283203,102.01200103759766,-19.094900131225586,-.5496600270271301,100.87300109863281,-7.722259998321533,-6.414289951324463,111.03150177001953,-19.094900131225586,-.5496600270271301,100.87300109863281,-19.792600631713867,-22.819499969482422,99.62494659423828]),
    Faces:new Uint16Array([0,1,2,3,4,5,6,7,8]),TVertices:[new Float32Array([.7868009209632874,.4177294969558716,.8359364867210388,.46999841928482056,.8310031294822693,.4124877154827118,.7868009209632874,.4177294969558716,.7176293134689331,.45557141304016113,.839632511138916,.4822291135787964,.8065521121025085,.4054987132549286,.8359364867210388,.46999841928482056,.7364252209663391,.4796290099620819])],MaterialID:0,
  };
  const camera=new OrthographicCamera(-90,90,90,-90,1,1000);camera.up.set(0,0,1);camera.position.set(0,-300,150);camera.lookAt(0,0,75);camera.updateMatrixWorld();
  const matrix=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements,point=new Vector3(-12.974570035934448,4.778045028448105,105.95225143432617).project(camera),raster=createPaintRaster(256);
  stampProjectedBrush(raster,preparePaintProjection(paintFixtureModel([geoset]),paintTarget(),matrix,900,900),{x:(point.x+1)*450,y:(1-point.y)*450},{...brush,size:40});
  const uv=geoset.TVertices[0];
  for(const [a,b] of [[0,1],[3,5]])assert.equal(filteredAlpha(raster,(uv[a*2]+uv[b*2])/2,(uv[a*2+1]+uv[b*2+1])/2),255);
});

test('perspective depth rejects a nearby hidden surface instead of using a fixed NDC allowance',()=>{
  const front=triangleGeoset({z:0}),back=triangleGeoset({z:-.1}),model=paintFixtureModel([front,back]),raster=createPaintRaster(32),camera=new PerspectiveCamera(42,1,.2,1000);
  camera.position.set(0,0,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();const matrix=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
  stampProjectedBrush(raster,preparePaintProjection(model,paintTarget([1]),matrix,600,600),{x:285,y:315},{...brush,size:16});
  assert.ok(raster.data.every(value=>value===0),'a surface 0.1 world units behind the visible one is not painted');
});

test('placing a cutout blends overlapping faces and seam samples once at the chosen opacity',()=>{
  const model=paintFixtureModel([bentUVSeam()]),raster=createPaintRaster(32),source=createPaintRaster(8,8,[200,100,40,255]);
  projectPaintDecal(raster,preparePaintProjection(model,paintTarget(),IDENTITY_MATRIX,960,960),source,{x:480,y:480},{width:18,height:18,opacity:.25});
  assert.equal(filteredAlpha(raster,.4,.5),64);assert.equal(filteredAlpha(raster,.6,.5),64);
  for(let i=3;i<raster.data.length;i+=4)assert.ok(raster.data[i]<=64,'projection samples do not accumulate cutout opacity');
});
