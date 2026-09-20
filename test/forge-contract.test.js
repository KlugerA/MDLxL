import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {alphaMask,buildForgeMesh,combineMask,commitForge,cropMask,polygonMask}from '../src/forge.js';
import {createDemoDocument,openDocument}from '../src/editor-document.js';
import {previewShape,resolveShapeSelection,shapeGeosets}from '../src/shaping.js';
const points={square:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],triangle:[[.1,.1],[.9,.3],[.3,.9]],star:Array.from({length:10},(_,i)=>[.5+Math.cos(i*Math.PI/5-Math.PI/2)*(i%2?.19:.44),.5+Math.sin(i*Math.PI/5-Math.PI/2)*(i%2?.19:.44)]),jagged:[[.1,.1],[.5,.13],[.7,.03],[.73,.31],[.94,.4],[.76,.6],[.89,.89],[.47,.87],[.22,.97],[.28,.68],[.07,.48]],halfShield:[[.5,.05],[.8,.1],[.95,.3],[.95,.6],[.8,.82],[.5,.95]]};
const fixture=(name,n)=>name==='circle'?cropMask(n,n,'Circle',[0,0],[n,n]):polygonMask(n,n,points[name].map(p=>p.map(x=>x*n)));
function assertClosed(geosets) {
  const edges=new Map();
  for(const g of geosets){ const pos=n=>Array.from(g.Vertices.slice(n*3,n*3+3)).map(v=>v.toFixed(4)).join(',');
    for(let i=0;i<g.Faces.length;i+=3)for(let k=0;k<3;k++){ const key=[pos(g.Faces[i+k]),pos(g.Faces[i+(k+1)%3])].sort().join('|');edges.set(key,(edges.get(key)||0)+1); }
  }
  assert.ok([...edges.values()].every(n=>n===2),'Assembled solid has a cracked, duplicate or nonmanifold edge');
}
function assertUv(g){const uv=g.TVertices[0];for(let i=0;i<g.Faces.length;i+=3){const[a,b,c]=[...g.Faces.slice(i,i+3)].map(n=>n*2); assert.ok(Math.abs((uv[b]-uv[a])*(uv[c+1]-uv[a+1])-(uv[b+1]-uv[a+1])*(uv[c]-uv[a]))>1e-12,'UV triangle collapses');}}
function capAngles(g){const z=Math.max(...g.Vertices.filter((_,i)=>i%3===2)),result=[]; for(let i=0;i<g.Faces.length;i+=3){const p=[...g.Faces.slice(i,i+3)].map(n=>[...g.Vertices.slice(n*3,n*3+3)]);if(!p.every(v=>v[2]===z))continue;const sides=p.map((v,j)=>Math.hypot(v[0]-p[(j+1)%3][0],v[1]-p[(j+1)%3][1]));result.push(Math.min(...sides.map((v,j)=>Math.acos(Math.max(-1,Math.min(1,(sides[(j+1)%3]**2+sides[(j+2)%3]**2-v*v)/(2*sides[(j+1)%3]*sides[(j+2)%3]))))*180/Math.PI)));}return result.sort((a,b)=>a-b);}
test('Rough shapes preserve authored corners and total export budgets independent of image resolution',()=>{
  const counts=new Map();
  for(const n of [64,128,256,512])for(const name of [...Object.keys(points),'circle'])for(const trim of [false,true])for(const thickness of [0,2]){
    const mesh=buildForgeMesh({mask:fixture(name,n),width:n,height:n,detail:0,thickness,trim,trimThickness:3.5});
    assert.ok(mesh.vertexCount<=300 && mesh.triangleCount<=300,`${name} ${n}: ${mesh.vertexCount}/${mesh.triangleCount}`);
    const key=`${name}-${trim}-${thickness}`, value=[mesh.vertexCount,mesh.triangleCount]; if(counts.has(key))assert.deepEqual(value,counts.get(key));else counts.set(key,value);
    assert.equal(mesh.contours.length,1); assert.equal(mesh.contours[0].length,name==='circle'?16:points[name].length);
    for(const g of mesh.geosets)assertUv(g);
    if(thickness>0) for(const g of mesh.geosets)assertClosed([g]);
  }
  const m=buildForgeMesh({mask:fixture('triangle',64),width:64,height:64,detail:0});assert.equal(m.vertexCount,3);assert.equal(m.triangleCount,1);
});
test('frame extends beyond all image edges, preserves body and uses centered signed depth',()=>{
  const mask=polygonMask(64,64,[[0,0],[64,0],[64,64],[0,64]]),settings={mask,width:64,height:64,size:64,detail:0,thickness:2};
  const plain=buildForgeMesh(settings),withTrim=buildForgeMesh({...settings,trim:true,trimWidth:4,trimThickness:3,trimOffset:-.5});
  assert.deepEqual(withTrim.geosets[0],plain.geosets[0]); const g=withTrim.geosets[1],bounds=axis=>[Math.min(...g.Vertices.filter((_,i)=>i%3===axis)),Math.max(...g.Vertices.filter((_,i)=>i%3===axis))];
  assert.deepEqual(bounds(0),[-36,36]);assert.deepEqual(bounds(1),[-36,36]);assert.deepEqual(bounds(2),[-2,1]);assertClosed([g]);
});
test('vector booleans retain holes, disconnected small parts, transparency and undo definitions',()=>{
  const n=128,opaque=alphaMask({width:n,height:n,data:new Uint8Array(n*n*4).fill(255)}),star=fixture('star',n),cut=combineMask(opaque,star,'keep',opaque),hole=cropMask(n,n,'Triangle',[58,58],[69,70]);
  const holed=combineMask(cut,hole,'remove',opaque),island=cropMask(n,n,'Square',[2,2],[6,6]),separate=combineMask(holed,island,'add',opaque);
  assert.equal(buildForgeMesh({mask:separate,width:n,height:n,detail:0}).contours.length,3);
  assert.equal(buildForgeMesh({mask:cut,width:n,height:n,detail:0}).contours[0].length,10,'Previous mask still restores exact star');
  const image={width:64,height:64,data:new Uint8Array(64*64*4).fill(255)};for(let y=0;y<64;y++)for(let x=0;x<16;x++)image.data[(y*64+x)*4+3]=0;
  const original=alphaMask(image),cropped=combineMask(original,cropMask(64,64,'Square',[0,0],[64,64]),'keep',original),g=buildForgeMesh({mask:cropped,width:64,height:64,detail:0}).geosets[0];
  assert.equal(Math.min(...g.TVertices[0].filter((_,i)=>i%2===0)),.25);
});
test('crop primitives have exact geometry, equal circle/square dimensions and retain original UVs',()=>{
  for(const kind of ['Rectangle','Square','Circle','Triangle']){
    const mesh=buildForgeMesh({mask:cropMask(128,64,kind,[20,5],[90,60]),width:128,height:64,detail:0,trim:true,thickness:1,trimThickness:1});
    assert.ok(mesh.vertexCount<=300 && mesh.triangleCount<=300);assert.equal(mesh.contours[0].length,kind==='Circle'?16:kind==='Triangle'?3:4);assertClosed(mesh.geosets);
    if(['Square','Circle'].includes(kind)){const c=mesh.contours[0],dx=Math.max(...c.map(p=>p[0]))-Math.min(...c.map(p=>p[0])),dy=Math.max(...c.map(p=>p[1]))-Math.min(...c.map(p=>p[1]));assert.ok(Math.abs(dx-dy)<.001);}
  }
});
test('higher Detail supplies interior support, valid UVs and conforming seams through bend/twist and persistence',()=>{
  for(const name of ['square','circle','star','jagged']){
    const input={mask:fixture(name,128),width:128,height:128,thickness:2,trim:true,trimThickness:2};
    let previous=buildForgeMesh({...input,detail:0}).vertexCount;
    for(const detail of [35,85,100]){const mesh=buildForgeMesh({...input,detail});assert.ok(mesh.vertexCount>previous);previous=mesh.vertexCount;assertClosed(mesh.geosets);for(const g of mesh.geosets)assertUv(g);if(['square','circle'].includes(name)){const angles=capAngles(mesh.geosets[0]);assert.ok(angles[0]>=5);assert.ok(angles.filter(a=>a>=15).length/angles.length>=.95);}}
    const mesh=buildForgeMesh({...input,detail:35}),doc=createDemoDocument(),result=doc.apply('Forge',[],m=>commitForge(m,mesh,{texturePath:'test.tga'})),selection=resolveShapeSelection(doc.model,new Set(result.geosetIndices));
    for(const tool of ['Bend','Warp']){const deformed=previewShape(doc.model,selection,{tool,axis:1,amount:35});assertClosed(result.geosetIndices.map(i=>deformed.Geosets[i]));for(const i of result.geosetIndices)assert.deepEqual(deformed.Geosets[i].TVertices,doc.model.Geosets[i].TVertices);}
    doc.apply('Bend',[],m=>shapeGeosets(m,selection,{tool:'Bend',axis:1,amount:35}));
    for(const format of ['mdl','mdx']){const reopened=openDocument(doc.serialize(format)).model;for(const gi of result.geosetIndices){assert.equal(reopened.Geosets[gi].Vertices.length,doc.model.Geosets[gi].Vertices.length);assert.equal(reopened.Geosets[gi].Faces.length,doc.model.Geosets[gi].Faces.length);}}
  }
});
test('R01 dragon retains two islands and eye/loop holes at reference complexity and quality',()=>{
  const mask=new Uint8Array(fs.readFileSync(new URL('./fixtures/forge/R01-447-mask.bin',import.meta.url))),m=buildForgeMesh({mask,width:447,height:447,detail:0,thickness:2});
  assert.ok(m.vertexCount<=300 && m.triangleCount<=300);assert.equal(m.contours.length,4);assertClosed(m.geosets);assertUv(m.geosets[0]);const angles=capAngles(m.geosets[0]);assert.ok(angles[Math.floor(angles.length/2)]>=30);assert.equal(angles.filter(a=>a<5).length,0);assert.ok(angles.filter(a=>a<15).length/angles.length<.123);
});
test('R02 authored shield plus matched frame meets the 300 total ceiling and closes after bending',()=>{
  const outline=JSON.parse(fs.readFileSync(new URL('./fixtures/forge/R02-outline.json',import.meta.url),'utf8')),mask=polygonMask(256,256,outline),m=buildForgeMesh({mask,width:256,height:256,detail:0,thickness:2,trim:true,trimThickness:2});
  assert.ok(m.vertexCount<=300 && m.triangleCount<=300);assertClosed(m.geosets);m.geosets.forEach(assertUv);
  const model={Geosets:m.geosets,Info:{},Sequences:[]},selection=resolveShapeSelection(model,new Set([0,1])),bent=previewShape(model,selection,{tool:'Bend',axis:0,amount:35});assertClosed(bent.Geosets);
});
