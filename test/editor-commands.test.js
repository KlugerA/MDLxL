import test from 'node:test';
import assert from 'node:assert/strict';
import { transformVertices, deleteVertices, bindVertices, addTriangle } from '../src/editor-commands.js';

function fixture() {
  // Vertices 0 and 4 occupy the same point, but encode a UV/hard-normal seam.
  return {
    Vertices: new Float32Array([0,0,0, 2,0,0, 2,2,0, 0,2,0, 0,0,0]),
    Normals: new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,1,0]),
    Tangents: new Float32Array([1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,-1, 1,0,0,-1]),
    TVertices: [new Float32Array([0,0, 1,0, 1,1, 0,1, .25,.25]), new Float32Array([.1,.2, .3,.4, .5,.6, .7,.8, .9,1])],
    Faces: new Uint16Array([0,1,2, 4,2,3]),
    VertexGroup: new Uint8Array([0,1,0,1,0]), Groups: [[0],[2]], TotalGroupsCount: 2,
    SkinWeights: new Uint8Array([0,2,0,0, 200,55,0,0, 2,0,0,0, 255,0,0,0, 0,2,0,0, 128,127,0,0, 2,0,0,0, 255,0,0,0, 0,0,0,0, 255,0,0,0]),
  };
}
function close(actual,expected,epsilon=1e-6) {
  assert.equal(actual.length,expected.length);
  actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<=epsilon,`${i}: ${value} != ${expected[i]}`));
}
const unit = vector => { const length=Math.hypot(...vector);return vector.map(v=>v/length); };

test('selected nonuniform scale and rotation transform tangent frames with inverse-transpose normals',()=>{
  const g=fixture();
  g.Normals.set(unit([1,1,1]),0);g.Tangents.set([...unit([1,-1,0]),1],0);
  const before=structuredClone(g);
  transformVertices(g,[0],[1,2,3],[2,3,4],[0,0,90]);
  close([...g.Vertices.slice(0,3)],[1,2,3]);
  close([...g.Normals.slice(0,3)],unit([-1/3,1/2,1/4]));
  close([...g.Tangents.slice(0,3)],unit([3,2,0]));
  assert.equal(g.Tangents[3],1);
  assert.ok(Math.abs(g.Normals.slice(0,3).reduce((sum,n,i)=>sum+n*g.Tangents[i],0))<1e-6);
  assert.deepEqual(g.Vertices.slice(3),before.Vertices.slice(3));
  assert.deepEqual(g.Normals.slice(3),before.Normals.slice(3));
  assert.deepEqual(g.Tangents.slice(4),before.Tangents.slice(4));
  for(const key of ['Faces','TVertices','SkinWeights','VertexGroup','Groups'])assert.deepEqual(g[key],before[key]);
});

test('mirroring flips selected tangent handedness and only fully selected face winding',()=>{
  const g=fixture();const before=structuredClone(g);
  transformVertices(g,[0,1,2,2],[0,0,0],[-1,2,1]);
  close([...g.Vertices.slice(0,9)],[8/3,-2/3,0, 2/3,-2/3,0, 2/3,10/3,0]);
  assert.deepEqual([...g.Faces],[0,2,1,4,2,3]);
  for(const i of [0,1,2])close([...g.Tangents.slice(i*4,i*4+4)],[-1,0,0,-1]);
  assert.deepEqual(g.Tangents.slice(12),before.Tangents.slice(12));
  assert.deepEqual(g.TVertices,before.TVertices);
  assert.equal(g.Vertices.length,before.Vertices.length);
});

test('two negative scale axes retain winding and tangent handedness',()=>{
  const g=fixture();const faces=g.Faces.slice();
  transformVertices(g,[0,1,2,3,4],[0,0,0],[-2,-3,1]);
  assert.deepEqual(g.Faces,faces);
  assert.deepEqual([g.Tangents[3],g.Tangents[15]],[1,-1]);
});

test('singular or malformed transforms fail before mutating any attributes',()=>{
  for(const scale of [[0,1,1],[1,1e-12,1],[1,NaN,1],[1,2],[Infinity,1,1]]){
    const g=fixture();const before=structuredClone(g);
    assert.throws(()=>transformVertices(g,[0,1,2],[0,0,0],scale),/Scale|finite/);
    assert.deepEqual(g,before);
  }
  const g=fixture();g.Tangents=new Float32Array(4);const before=structuredClone(g);
  assert.throws(()=>transformVertices(g,[0],[9,9,9]),/Tangents/);assert.deepEqual(g,before);
});

test('zoom may collapse separate vertices without altering their independent attributes',()=>{
  const g=fixture(),before=structuredClone(g);
  transformVertices(g,[0,1],[0,0,0],[0,0,0],[0,0,0],[0,0,0],{allowSingularScale:true});
  assert.deepEqual([...g.Vertices.slice(0,6)],[0,0,0,0,0,0]);
  for(const key of ['Normals','Tangents','TVertices','Faces','VertexGroup','SkinWeights','Groups'])assert.deepEqual(g[key],before[key],key);
  assert.equal(g.Vertices.length,before.Vertices.length);
});

test('an explicit zoom pivot keeps its anchor fixed while scaling other selected vertices',()=>{
  const g=fixture();
  transformVertices(g,[0,1],[0,0,0],[.5,.5,.5],[0,0,0],[0,0,0]);
  assert.deepEqual([...g.Vertices.slice(0,6)],[0,0,0,1,0,0]);
});

test('delete preserves separate seam vertices and every parallel UV, tangent and skin attribute',()=>{
  const g=fixture();const before=structuredClone(g);
  deleteVertices(g,[1,1]);
  assert.equal(g.Vertices.length,12);
  assert.deepEqual([...g.Faces],[3,1,2]);
  for(const [key,stride] of [['Vertices',3],['Normals',3],['Tangents',4],['VertexGroup',1],['SkinWeights',8]]) {
    const expected=[0,2,3,4].flatMap(i=>Array.from(before[key].slice(i*stride,(i+1)*stride)));
    assert.deepEqual([...g[key]],expected,key);
  }
  for(let set=0;set<2;set++)assert.deepEqual([...g.TVertices[set]],[0,2,3,4].flatMap(i=>Array.from(before.TVertices[set].slice(i*2,(i+1)*2))));
  assert.deepEqual([...g.Vertices.slice(0,3)],[...g.Vertices.slice(9,12)]);
  assert.notDeepEqual([...g.TVertices[0].slice(0,2)],[...g.TVertices[0].slice(6,8)]);
  assert.deepEqual(g.Groups,before.Groups);
});

test('invalid selections reject all mesh commands without partial mutation',()=>{
  const model={Bones:[{ObjectId:0},{ObjectId:2}]};
  for(const bad of [-1,.5,NaN,Infinity,5,65536])for(const command of [
    g=>transformVertices(g,[0,bad],[1,2,3]),
    g=>deleteVertices(g,[0,bad]),
    g=>bindVertices(model,g,[0,bad],2),
    g=>addTriangle(g,[0,1,bad]),
  ]){
    const g=fixture();const before=structuredClone(g);
    assert.throws(()=>command(g),/range/);assert.deepEqual(g,before);
  }
});

test('binding validates bone and byte capacity before appending groups or overwriting weights',()=>{
  for(const boneId of [-1,.5,3,256]){
    const g=fixture();const before=structuredClone(g);
    assert.throws(()=>bindVertices({Bones:[{ObjectId:0},{ObjectId:256}]},g,[0,1],boneId),/bone|8-bit/);
    assert.deepEqual(g,before);
  }
  const g=fixture();const before=structuredClone(g);
  assert.throws(()=>bindVertices({Bones:[{ObjectId:0}]},g,[],0),/Select/);assert.deepEqual(g,before);
});

test('rigid binding reuses groups, accepts bone zero, and changes only selected weights',()=>{
  const g=fixture();const before=structuredClone(g);
  bindVertices({Bones:[{ObjectId:0},{ObjectId:2}]},g,[1,1],0);
  assert.deepEqual(g.Groups,before.Groups);assert.equal(g.TotalGroupsCount,2);
  assert.deepEqual([...g.VertexGroup],[0,0,0,1,0]);
  assert.deepEqual([...g.SkinWeights.slice(8,16)],[0,0,0,0,255,0,0,0]);
  assert.deepEqual(g.SkinWeights.slice(0,8),before.SkinWeights.slice(0,8));
  assert.deepEqual(g.SkinWeights.slice(16),before.SkinWeights.slice(16));
  for(const key of ['Vertices','Normals','Tangents','TVertices','Faces'])assert.deepEqual(g[key],before[key]);
});

test('full classic group tables permit reuse but reject a new group before mutation',()=>{
  const g=fixture();delete g.SkinWeights;g.Groups=Array.from({length:256},(_,i)=>[i]);
  bindVertices({Bones:[{ObjectId:255}]},g,[0],255);assert.equal(g.VertexGroup[0],255);
  const before=structuredClone(g);
  assert.throws(()=>bindVertices({Bones:[{ObjectId:256}]},g,[0],256),/256/);assert.deepEqual(g,before);
});

test('triangle creation preserves supplied winding and rejects repeated or 16-bit-overflow indices',()=>{
  const g=fixture();addTriangle(g,[4,3,0]);assert.deepEqual([...g.Faces],[0,1,2,4,2,3,4,3,0]);
  for(const indices of [[0,0,1],[0,1],[0,1,2,3]]){
    const before=structuredClone(g);assert.throws(()=>addTriangle(g,indices),/three/);assert.deepEqual(g,before);
  }
  const oversized={Vertices:new Float32Array(65537*3),Faces:new Uint16Array([0,1,2])};
  const before=oversized.Faces.slice();assert.throws(()=>addTriangle(oversized,[0,1,65536]),/16-bit/);assert.deepEqual(oversized.Faces,before);
});

test('empty delete is a no-op; malformed parallel attributes fail before deletion',()=>{
  const g=fixture();const before=structuredClone(g);deleteVertices(g,[]);assert.deepEqual(g,before);
  g.TVertices[1]=new Float32Array(2);const malformed=structuredClone(g);
  assert.throws(()=>deleteVertices(g,[0]),/UV coordinates/);assert.deepEqual(g,malformed);
});
