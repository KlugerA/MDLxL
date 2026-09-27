import test from 'node:test';
import assert from 'node:assert/strict';
import { correctNormalsXL } from '../src/normals-xl.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

const unit = n => n.map(value => value / Math.hypot(...n));
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const at = (array, id) => Array.from(array.slice(id * 3, id * 3 + 3));
const refs = (ids = [0], geosetIndex = 0) => ids.map(vertexIndex => ({ geosetIndex, vertexIndex }));
const all = g => Array.from({length:g.Vertices.length / 3}, (_, id) => id);
const repair = (g, references = refs(), ids = all(g)) => correctNormalsXL({Geosets:[g]}, {0:ids}, references);
const close = (actual, expected, tolerance = 1e-6) => {
  assert.equal(actual.length, expected.length);
  assert.ok(Math.max(...actual.map((n, i) => Math.abs(n - expected[i]))) <= tolerance);
};
function tetra() {
  const vertices = [1,1,1, -1,-1,1, -1,1,-1, 1,-1,-1];
  return { Vertices: new Float32Array(vertices), Normals: new Float32Array(vertices.map(n => n / Math.sqrt(3))),
    Faces: new Uint16Array([0,2,1, 0,1,3, 0,3,2, 1,2,3]),
    TVertices:[new Float32Array(8)], VertexGroup:new Uint8Array(4), Groups:[[0]] };
}
function reverseFace(g, offset) { [g.Faces[offset],g.Faces[offset+2]] = [g.Faces[offset+2],g.Faces[offset]]; }
function reverseNormal(g, id) { g.Normals.set(at(g.Normals,id).map(n=>-n), id*3); }
function sameWinding(actual, expected) {
  for (let offset=0;offset<actual.length;offset+=3) {
    const a=at(actual,offset/3),b=at(expected,offset/3);
    assert.ok([0,1,2].some(shift=>a.every((n,i)=>n===b[(i+shift)%3])));
  }
}
function sharedPieces() {
  const g=tetra(), h=tetra(), angle=.7, c=Math.cos(angle),s=Math.sin(angle);
  const rotate=([x,y,z])=>[c*x-s*y,s*x+c*y,z];
  for(const id of all(h)) {
    h.Vertices.set(rotate(at(h.Vertices,id)).map((n,i)=>n+(i===0?6:0)),id*3);
    h.Normals.set(rotate(at(h.Normals,id)),id*3);
  }
  const outward0=at(g.Normals,0),outward4=at(h.Normals,0);
  const desired=unit(outward0.map((n,i)=>n+outward4[i]));
  const authored=unit(outward0.map((n,i)=>n-outward4[i]));
  for(const id of all(h))reverseNormal(h,id);
  for(let offset=0;offset<h.Faces.length;offset+=3)reverseFace(h,offset);
  g.Vertices=new Float32Array([...g.Vertices,...h.Vertices]);
  g.Normals=new Float32Array([...g.Normals,...h.Normals]);
  g.Faces=new Uint16Array([...g.Faces,...Array.from(h.Faces,n=>n+4)]);
  g.Normals.set(authored,0);g.Normals.set(authored,12);
  return {g,desired};
}

test('one reference preserves outward normals around a curved surface',()=>{
  const g=tetra(),before=structuredClone(g);
  assert.ok(dot(at(g.Normals,0),at(g.Normals,1))<0);
  assert.deepEqual(repair(g),{reversedNormals:0,recalculatedNormals:0,reversedFaces:0});
  assert.deepEqual(g,before);
});
test('mixed winding and one bad normal are corrected locally, without moving geometry',()=>{
  const g=tetra(),expected=structuredClone(g);reverseFace(g,3);reverseFace(g,9);reverseNormal(g,3);
  assert.deepEqual(repair(g),{reversedNormals:1,recalculatedNormals:0,reversedFaces:2});
  assert.deepEqual(g,expected);
  assert.deepEqual(repair(g),{reversedNormals:0,recalculatedNormals:0,reversedFaces:0});
});
test('references can choose the inside consistently around a curved surface',()=>{
  const g=tetra();for(const id of [0,1,2])reverseNormal(g,id);
  const result=repair(g);assert.equal(result.reversedNormals,1);assert.equal(result.reversedFaces,4);
  for(const id of all(g))assert.ok(dot(at(g.Normals,id),at(g.Vertices,id))<0);
  assert.equal(repair(g).reversedFaces,0);
});
test('authored slopes and lengths survive direction correction',()=>{
  const g=tetra();const good=unit([.7,-.2,-.8]).map(n=>n*2.5);g.Normals.set(good.map(n=>-n),9);
  const result=repair(g);assert.equal(result.reversedNormals,1);assert.equal(result.recalculatedNormals,0);
  close(Array.from(g.Normals.slice(9)),good);
});
test('partial selections preserve unselected vertices and boundary triangles',()=>{
  const g=tetra();reverseNormal(g,3);reverseFace(g,0);const before=structuredClone(g);
  const result=repair(g,refs(),[3]);assert.equal(result.reversedNormals,1);assert.equal(result.reversedFaces,0);
  assert.deepEqual(g.Faces,before.Faces);assert.deepEqual(g.Normals.slice(0,9),before.Normals.slice(0,9));
});
test('shared geometric normals are re-averaged when connected pieces need different reversals',()=>{
  const {g,desired}=sharedPieces(),before=structuredClone(g);
  const result=repair(g,refs([1,2,3]));assert.equal(result.recalculatedNormals,2);assert.equal(result.reversedFaces,4);
  close(at(g.Normals,0),desired);close(at(g.Normals,4),desired);
  for(const key of ['Vertices','TVertices','VertexGroup','Groups'])assert.deepEqual(g[key],before[key]);
  const accepted=structuredClone(g);repair(g,refs([1,2,3]));assert.deepEqual(g,accepted);
});
test('recover shared smoothing after a global half-space reversal corrupted faces and normals',()=>{
  const {g}=sharedPieces(),accepted=structuredClone(g);repair(accepted,refs([1,2,3]));
  for(let offset=0;offset<g.Faces.length;offset+=6)reverseFace(g,offset);
  for(const id of [0,1,4,5,6])reverseNormal(g,id);
  // Reference vertices are explicitly good, as required by the picking workflow.
  for(const id of [1,2,3])g.Normals.set(at(accepted.Normals,id),id*3);
  repair(g,refs([1,2,3]));close(Array.from(g.Normals),Array.from(accepted.Normals));sameWinding(g.Faces,accepted.Faces);
});
test('parallel custom normals shared across components are not averaged without geometric evidence',()=>{
  const {g}=sharedPieces();const custom=unit([.6,.3,.7]);g.Normals.set(custom,0);g.Normals.set(custom,12);
  const before=structuredClone(g);const result=repair(g,refs([1,2,3]));assert.equal(result.recalculatedNormals,0);
  assert.deepEqual(g.Normals.slice(0,3),before.Normals.slice(0,3));assert.deepEqual(g.Normals.slice(12,15),before.Normals.slice(12,15));
});
test('HD tangents preserve their frame when normals flip or shared normals change',()=>{
  const {g}=sharedPieces();g.Tangents=new Float32Array(all(g).flatMap(id=>{
    const n=at(g.Normals,id),t=unit([-n[1],n[0],0]);return [...t,1];
  }));const before=g.Tangents.slice();const result=repair(g,refs([1,2,3]));assert.equal(result.recalculatedNormals,2);
  for(const id of all(g)) {
    const n=at(g.Normals,id),t=Array.from(g.Tangents.slice(id*4,id*4+3));
    assert.ok(Math.abs(dot(n,t))<1e-6);assert.ok(Math.abs(Math.hypot(...t)-1)<1e-6);
    if([5,6,7].includes(id)){assert.deepEqual(g.Tangents.slice(id*4,id*4+3),before.slice(id*4,id*4+3));assert.equal(g.Tangents[id*4+3],-1);}
  }
});
test('flat surfaces use reference direction, while complete selected triangles reverse independently',()=>{
  const g={Vertices:new Float32Array([0,0,0,1,0,0,0,1,0, 3,0,0,4,0,0,3,1,0]),
    Normals:new Float32Array([0,0,1,0,0,1,0,0,1, 0,0,-1,0,0,1,0,0,0]),Faces:new Uint16Array([0,1,2,3,5,4])};
  const result=repair(g);assert.equal(result.reversedNormals,1);assert.equal(result.reversedFaces,1);
  assert.deepEqual(Array.from(g.Faces),[0,1,2,4,5,3]);assert.deepEqual(at(g.Normals,5),[0,0,0]);
});
test('geometric edges connect UV seams without welding them',()=>{
  const source=tetra();const g={Vertices:new Float32Array(Array.from(source.Faces).flatMap(id=>at(source.Vertices,id))),
    Normals:new Float32Array(Array.from(source.Faces).flatMap(id=>at(source.Normals,id))),Faces:new Uint16Array(Array.from({length:12},(_,i)=>i))};
  reverseFace(g,9);const result=repair(g);assert.equal(result.reversedFaces,1);assert.equal(g.Vertices.length,36);
});
test('rotation, translation, scale and reference order do not change the outward result',()=>{
  const a=tetra(),b=tetra();reverseNormal(a,3);reverseFace(a,0);reverseNormal(b,3);reverseFace(b,0);
  const rotate=([x,y,z])=>[-z,x,-y];
  for(const id of all(b)){b.Vertices.set(rotate(at(b.Vertices,id)).map((n,i)=>n*5+[120,-300,80][i]),id*3);b.Normals.set(rotate(at(b.Normals,id)),id*3);}
  repair(a);repair(b,refs([2,1,0]));assert.deepEqual(b.Faces,a.Faces);
  for(const id of all(a))close(at(b.Normals,id),rotate(at(a.Normals,id)));
});
test('invalid or contradictory references and invalid target geosets cannot cause partial edits',()=>{
  for(const kind of ['empty','duplicate','opposite','zero','missing','other-geoset','invalid-face']) {
    const g=tetra(),model={Geosets:[g,tetra()]},references=refs(['duplicate','opposite'].includes(kind)?[0,1,2]:[0]);reverseNormal(g,3);
    if(kind==='empty')references.length=0;if(kind==='duplicate')references[2]=references[0];
    if(kind==='opposite')reverseNormal(g,2);if(kind==='zero')g.Normals.fill(0,0,3);if(kind==='missing')references[0].vertexIndex=999;
    if(kind==='invalid-face')model.Geosets[1].Faces[0]=999;
    const selection={0:all(g),1:kind==='other-geoset'?[999]:all(g)},before=structuredClone(model);
    assert.throws(()=>correctNormalsXL(model,selection,references),/NormalsXL/);assert.deepEqual(model,before);
  }
});
test('one document edit supports undo, redo, no-op repeat and MDX/MDL roundtrips',()=>{
  const doc=createDemoDocument(),g=doc.model.Geosets[2],ids=all(g),references=refs([0],2);
  doc.apply('Prepare mixed normals',['Geosets'],()=>{reverseNormal(g,7);reverseFace(g,12);});
  const before=structuredClone(doc.model);
  doc.apply('NormalsXL',['Geosets'],model=>correctNormalsXL(model,{2:ids},references));
  const after=structuredClone(doc.model);assert.equal(doc.historyStats.undoSteps,2);
  for(const format of ['mdx','mdl']){
    const reopened=openDocument(doc.serialize(format));
    assert.deepEqual(reopened.model.Geosets[2].Normals,after.Geosets[2].Normals);assert.deepEqual(reopened.model.Geosets[2].Faces,after.Geosets[2].Faces);
  }
  assert.equal(doc.apply('NormalsXL',['Geosets'],model=>correctNormalsXL(model,{2:ids},references)),false);
  doc.undo();assert.deepEqual(doc.model,before);doc.redo();assert.deepEqual(doc.model,after);
});


test('opposite coincident copies retain both sides while their bad lighting normals are corrected',()=>{
  const front=tetra(),g=structuredClone(front);
  g.Vertices=new Float32Array([...front.Vertices,...front.Vertices]);
  g.Normals=new Float32Array([...front.Normals,...front.Normals]);
  const back=Array.from(front.Faces,n=>n+4);
  for(let offset=0;offset<back.length;offset+=3)[back[offset],back[offset+2]]=[back[offset+2],back[offset]];
  g.Faces=new Uint16Array([...front.Faces,...back]);
  const faces=g.Faces.slice(),vertices=g.Vertices.slice();
  const result=repair(g);assert.equal(result.reversedNormals,4);assert.equal(result.reversedFaces,0);
  assert.deepEqual(g.Faces,faces);assert.deepEqual(g.Vertices,vertices);
  for(let id=0;id<4;id++){close(at(g.Normals,id),at(front.Normals,id));close(at(g.Normals,id+4),at(front.Normals,id).map(n=>-n));}
  const after=structuredClone(g);repair(g);assert.deepEqual(g,after);
});
test('a four-face branch is an analysis boundary, not a reason to abort all geosets',()=>{
  const g={Vertices:new Float32Array([0,0,0,1,0,0, 0,2,0,0,-2,0,0,2,1,0,-2,-1]),
    Faces:new Uint16Array([0,1,2,1,0,3,0,1,4,1,0,5]),
    Normals:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1, ...unit([0,-1,2]),...unit([0,-1,2])])};
  reverseFace(g,6);reverseNormal(g,4);
  const regular=tetra();reverseNormal(regular,3);
  const model={Geosets:[regular,g]},before=structuredClone(model);
  const result=correctNormalsXL(model,{0:all(regular),1:all(g)},refs());
  assert.equal(result.reversedFaces,1);assert.equal(result.reversedNormals,2);
  assert.equal(g.Faces.length,before.Geosets[1].Faces.length);assert.deepEqual(g.Vertices,before.Geosets[1].Vertices);
  const after=structuredClone(model);correctNormalsXL(model,{0:all(regular),1:all(g)},refs());assert.deepEqual(model,after);
});
test('references on a branching vertex use the incident patch when orienting flat triangles',()=>{
  const g={Vertices:new Float32Array([0,0,0,1,0,0,0,2,0,0,-2,0,0,2,1,0,-2,-1]),
    Faces:new Uint16Array([0,1,2,1,0,3,4,1,0,1,0,5]),
    Normals:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1,...unit([0,-1,2]),...unit([0,-1,2])])};
  const result=repair(g,refs([0,1,3]));assert.equal(result.reversedFaces,1);assert.deepEqual(Array.from(g.Faces.slice(6,9)),[0,1,4]);
});
test('unselected reverse copies remain untouched when only one side is selected',()=>{
  const g={Vertices:new Float32Array([0,0,0,1,0,0,0,1,0, 0,0,0,1,0,0,0,1,0]),
    Normals:new Float32Array([0,0,1,0,0,1,0,0,1, 0,0,1,0,0,1,0,0,1]),Faces:new Uint16Array([0,1,2,5,4,3])};
  const before=structuredClone(g);repair(g,refs(),[3]);
  assert.deepEqual(at(g.Normals,3),at(before.Normals,3).map(n=>-n));assert.deepEqual(g.Faces,before.Faces);
  for(const id of [0,1,2,4,5])assert.deepEqual(at(g.Normals,id),at(before.Normals,id));
});
test('a genuinely non-orientable sheet still rejects atomically',()=>{
  const vertices=[],faces=[],segments=5;
  for(let i=0;i<segments;i++)for(const side of [-1,1]){
    const angle=2*Math.PI*i/segments,radius=3+side*.3*Math.cos(angle/2);
    vertices.push(radius*Math.cos(angle),radius*Math.sin(angle),side*.3*Math.sin(angle/2));
  }
  for(let i=0;i<segments;i++){
    const a=2*i,b=a+1,c=i+1<segments?a+2:1,d=i+1<segments?a+3:0;
    faces.push(a,c,b,b,c,d);
  }
  const g={Vertices:new Float32Array(vertices),Normals:new Float32Array(vertices.map((_,i)=>i%3===2?1:0)),Faces:new Uint16Array(faces)};
  const regular=tetra();reverseNormal(regular,3);const model={Geosets:[regular,g]},before=structuredClone(model);
  assert.throws(()=>correctNormalsXL(model,{0:all(regular),1:all(g)},refs()),/conflicting winding/);
  assert.deepEqual(model,before);
});
