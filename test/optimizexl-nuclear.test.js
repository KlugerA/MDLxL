import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareNuclearReduction, reducePolygons } from '../src/optimizexl-geometry.js';

await prepareNuclearReduction();
function grid({height=()=>0,uv=(x,y)=>[x/16,y/16],skin=()=>0,normal=()=>[0,0,1]}={}) {
 const vertices=[],normals=[],uvs=[],groups=[],faces=[];
 for(let y=0;y<17;y++)for(let x=0;x<17;x++){vertices.push(x,y,height(x,y));normals.push(...normal(x,y));uvs.push(...uv(x,y));groups.push(skin(x,y));}
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){const a=y*17+x;faces.push(a,a+1,a+17,a+1,a+18,a+17);}
 return {Geosets:[{Vertices:new Float32Array(vertices),Normals:new Float32Array(normals),TVertices:[new Float32Array(uvs)],VertexGroup:new Uint8Array(groups),Groups:[[0],[1]],Faces:new Uint16Array(faces)}]};
}
const settings={target:2,error:.02,normalLimit:45,protectNormals:true,protectSeams:true,protectSkin:true};
const records=g=>Array.from({length:g.Vertices.length/3},(_,i)=>JSON.stringify([
 ...g.Vertices.slice(i*3,i*3+3),...g.Normals.slice(i*3,i*3+3),...g.TVertices.flatMap(uv=>Array.from(uv.slice(i*2,i*2+2))),...g.Groups[g.VertexGroup[i]],
]));
test('Nuclear removes flat detail while keeping a raised surface feature and open boundaries',()=>{
 const flat=grid(),raised=grid({height:(x,y)=>3*Math.exp(-((x-8)**2+(y-8)**2)/8)}),before=structuredClone(raised);
 const flatResult=reducePolygons(flat,settings),raisedResult=reducePolygons(raised,settings);
 assert.ok(flatResult.trianglesAfter<100);assert.ok(raisedResult.trianglesAfter>flatResult.trianglesAfter);
 assert.ok(raised.Geosets[0].Vertices.some((v,i)=>i%3===2&&v>=2.99),'Peak must survive a small surface-error budget');
 const retained=new Set(records(raised.Geosets[0]));const original=records(before.Geosets[0]);
 for(let y=0;y<17;y++)for(let x=0;x<17;x++)if(x===0||x===16||y===0||y===16)assert.ok(retained.has(original[y*17+x]),'Open border vertex must survive');
 assert.ok(raisedResult.maxAppearanceError<=settings.error);
});
test('Nuclear measures UV interpolation error, including secondary UV channels',()=>{
 const plain=grid(),textured=grid(),second=new Float32Array(textured.Geosets[0].TVertices[0]);
 for(let y=0;y<17;y++)for(let x=0;x<17;x++)second[(y*17+x)*2]+=.3*Math.exp(-((x-8)**2+(y-8)**2)/8);
 textured.Geosets[0].TVertices.push(second);
 const a=reducePolygons(plain,settings),b=reducePolygons(textured,settings);
 assert.ok(b.trianglesAfter>a.trianglesAfter+5,'A nonlinear texture feature must retain more triangles than a plain surface');
 assert.ok(b.maxAppearanceError<=settings.error);assert.equal(textured.Geosets[0].TVertices.length,2);
});
test('Nuclear measures normal interpolation error even without the hard-angle lock',()=>{
 const plain=grid(),shaded=grid({normal:(x,y)=>{const a=.6*Math.exp(-((x-8)**2+(y-8)**2)/8);return [Math.sin(a),0,Math.cos(a)];}});
 const a=reducePolygons(plain,{...settings,protectNormals:false}),b=reducePolygons(shaded,{...settings,protectNormals:false});
 assert.ok(b.trianglesAfter>a.trianglesAfter+5,'A shading feature must contribute to the collapse error');
});
test('Nuclear retains authored records and all vertices at a skinning boundary',()=>{
 const model=grid({skin:x=>x<8?0:1}),before=structuredClone(model),original=records(before.Geosets[0]);
 const result=reducePolygons(model,{...settings,error:.2}),retained=new Set(records(model.Geosets[0]));
 assert.ok(result.trianglesAfter<result.trianglesBefore);
 for(const record of retained)assert.ok(original.includes(record),'Positions, UVs, normals and bone bindings must be original records');
 for(let y=0;y<17;y++)for(const x of [7,8])assert.ok(retained.has(original[y*17+x]),'Both sides of the animated bone boundary must survive');
 assert.deepEqual(model.Geosets[0].Groups,before.Geosets[0].Groups);
});
test('Nuclear respects odd polygon targets when one collapse removes two faces',()=>{
 for(const target of [251,321,471]){
  const result=reducePolygons(grid(),{...settings,target,error:1});
  assert.ok(result.trianglesAfter>=target,`Target ${target} was crossed`);
  assert.ok(result.trianglesAfter<result.trianglesBefore);
 }
});
