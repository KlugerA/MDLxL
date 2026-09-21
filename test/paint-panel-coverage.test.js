import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Matrix4,OrthographicCamera,PerspectiveCamera,Vector3} from 'three';
import {paintFixtureModel,paintTarget,triangleGeoset} from './fixtures/paint-fixtures.js';
import {paintGeosetMask,paintGeosetTarget} from '../src/paint-view.js';
import {preparePaintProjection,preparePaintSurface,stampProjectedBrush} from '../src/paint-projection.js';
import {createPaintRaster,fillRasterMask} from '../src/paint-raster.js';

// Small, unchanged face extracts from the user's Chaos Warrior test model.
// Includes shield centres, thin shoulder panels, wrapped UVs and collapsed UVs.
const panels=JSON.parse(fs.readFileSync(new URL('./fixtures/chaos-paint-panels.json',import.meta.url)));
const brush={size:12,hardness:1,flow:1,strength:1,opacity:1,mode:'paint',color:'#ffffff'};
const makeFace=f=>({Vertices:new Float32Array(f.vertices),Faces:new Uint16Array([0,1,2]),TVertices:[new Float32Array(f.uv)],MaterialID:0});
function filteredAlpha(r,u,v){
  const x=u*r.width-.5,y=v*r.height-.5,ix=Math.floor(x),iy=Math.floor(y);let a=0;
  for(let j=0;j<2;j++)for(let i=0;i<2;i++){const px=((ix+i)%r.width+r.width)%r.width,py=((iy+j)%r.height+r.height)%r.height;a+=r.data[(py*r.width+px)*4+3]*(i?x-ix:1-x+ix)*(j?y-iy:1-y+iy);}
  return a;
}

test('full fill covers the actual shield and shoulder UVs, even when another geoset overlaps their texture',()=>{
  for(const face of panels){
    const geo=makeFace(face),other=triangleGeoset({uv:[0,0,2,0,0,2]}),model=paintFixtureModel([geo,other]),target=paintGeosetTarget(paintTarget([0,1]),0);target.flags=3;
    const r=createPaintRaster(256);fillRasterMask(r,paintGeosetMask(model,target,256),'#ffffff');
    for(let i=0;i<=10;i++)for(let j=0;j<=10-i;j++){
      const a=i/10,b=j/10,c=1-a-b,u=a*face.uv[0]+b*face.uv[2]+c*face.uv[4],v=a*face.uv[1]+b*face.uv[3]+c*face.uv[5];
      assert.ok(filteredAlpha(r,u,v)>254.99,`geoset ${face.geoset}, face ${face.face}, ${i}/${j}`);
    }
  }
});

test('small brushes reach magnified shield and shoulder faces from three viewing angles',()=>{
  for(const face of panels){
    const vertices=[0,1,2].map(i=>new Vector3(...face.vertices.slice(i*3,i*3+3))),center=vertices.reduce((s,p)=>s.add(p),new Vector3()).divideScalar(3),edge=vertices[1].clone().sub(vertices[0]),normal=edge.clone().cross(vertices[2].clone().sub(vertices[0])).normalize();
    if(!normal.lengthSq())continue;
    const geo=makeFace(face),model=paintFixtureModel([geo]),target=paintTarget();target.flags=3;
    for(const angle of [-35,0,35]){
      const direction=normal.clone().applyAxisAngle(edge.clone().normalize(),angle*Math.PI/180),camera=angle===0?new OrthographicCamera(-15,15,15,-15,.1,200):new PerspectiveCamera(30,1,.1,200);
      camera.position.copy(center).addScaledVector(direction,55);camera.up.copy(edge).normalize();camera.lookAt(center);camera.updateMatrixWorld();
      const matrix=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements,projection=preparePaintProjection(model,target,matrix,900,900),r=createPaintRaster(256);
      const changed=stampProjectedBrush(r,projection,{x:450,y:450},brush,{flags:3}),u=(face.uv[0]+face.uv[2]+face.uv[4])/3,v=(face.uv[1]+face.uv[3]+face.uv[5])/3;
      assert.ok(changed>0,`geoset ${face.geoset}, face ${face.face}, ${angle} degrees responds`);
      // A sub-texel dab paints the touched cell at full strength, not all four
      // bilinear neighbours. Filtering can mix it with untouched cells (the
      // nearest tap contributes at least 1/4); this is not a brush dead spot.
      assert.ok(filteredAlpha(r,u,v)>=63,`geoset ${face.geoset}, face ${face.face}, ${angle} degrees paints the visible centre`);
      assert.ok(r.data.some((value,index)=>index%4===3&&value===255),'the touched cells retain the selected opacity');
      const surface=preparePaintSurface(projection,r,3),cached=[...surface.bins];
      assert.ok(surface.sampledTiles.size<=4,'only tiles under the small brush are sampled');
      stampProjectedBrush(r,projection,{x:450,y:450},brush,{flags:3});
      for(const [key,points] of cached)assert.equal(surface.bins.get(key),points,'stationary strokes reuse the samples');
    }
  }
});

test('a face mapped to one texel remains paintable and does not multiply dab opacity',()=>{
  const geo=triangleGeoset({uv:[.503,.497,.503,.497,.503,.497]}),model=paintFixtureModel([geo]),target=paintTarget(),r=createPaintRaster(32),matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],projection=preparePaintProjection(model,target,matrix,960,960);
  stampProjectedBrush(r,projection,{x:240,y:700},{...brush,opacity:.25});
  assert.ok(filteredAlpha(r,.503,.497)>63.99);assert.ok(filteredAlpha(r,.503,.497)<64.01);
});
