import test from 'node:test';
import assert from 'node:assert/strict';
import { correctNormalsXL, normalsXLDirection } from '../src/normals-xl.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

const references = [0, 1, 2].map(vertexIndex => ({ geosetIndex: 0, vertexIndex }));
const geoset = () => ({
  Vertices: new Float32Array([0,0,0, 1,0,0, 0,1,0, 2,0,0, 3,0,0, 2,1,0]),
  Normals: new Float32Array([0,0,1, 0,0,1, 0,0,1, .6,0,-.8, 0,0,-2, 0,0,1]),
  Faces: new Uint16Array([0,1,2, 3,5,4]),
  Tangents: new Float32Array([1,0,0,1, 1,0,0,1, 1,0,0,1, .8,0,.6,1, 1,0,0,-1, 1,0,0,1]),
  TVertices: [new Float32Array(12)], VertexGroup: new Uint8Array(6), Groups: [[0]],
});
test('mixed selection reverses only opposing normals and independently fixes winding', () => {
  const g = geoset(), before = structuredClone(g);
  const result = correctNormalsXL({ Geosets: [g] }, { 0: [0,1,2,3,4,5] }, references);
  assert.equal(result.reversedNormals, 2); assert.equal(result.reversedFaces, 1);
  assert.deepEqual([...g.Normals.slice(0,9)], [...before.Normals.slice(0,9)]);
  assert.deepEqual([...g.Normals.slice(9,15)], [...before.Normals.slice(9,15)].map(v => -v));
  assert.deepEqual([...g.Normals.slice(15)], [...before.Normals.slice(15)]);
  assert.deepEqual([...g.Faces], [0,1,2,3,4,5]);
  assert.equal(g.Tangents[15], -1); assert.equal(g.Tangents[19], 1);
  for (const key of ['Vertices','TVertices','VertexGroup','Groups']) assert.deepEqual(g[key], before[key]);
  for (let i = 0; i < g.Tangents.length; i++) if (i !== 15 && i !== 19) assert.equal(g.Tangents[i], before.Tangents[i]);
});
test('partial selections preserve boundary winding and all unselected vertices', () => {
  const g = geoset(), before = structuredClone(g);
  correctNormalsXL({Geosets:[g]}, {0:[3]}, references);
  assert.deepEqual(g.Faces, before.Faces);
  for (let i=0;i<g.Normals.length;i++) if (i<9 || i>=12) assert.equal(g.Normals[i],before.Normals[i]);
});
test('reference order, normal magnitudes and reference positions do not bias the guide', () => {
  const g = geoset(); g.Normals[2]=5; g.Normals[5]=.3;
  assert.deepEqual(normalsXLDirection({Geosets:[g]}, references), [0,0,1]);
  assert.deepEqual(normalsXLDirection({Geosets:[g]}, [...references].reverse()), [0,0,1]);
});
test('zero and perpendicular target normals stay unchanged; repeat use is a no-op', () => {
  const g=geoset();g.Normals.set([1,0,0],9);g.Normals.set([0,0,0],12);
  const model={Geosets:[g]}, result=correctNormalsXL(model,{0:[0,1,2,3,4,5]},references);
  assert.equal(result.reversedNormals,0);assert.deepEqual([...g.Normals.slice(9,15)],[1,0,0,0,0,0]);
  const snapshot=structuredClone(g);
  assert.equal(correctNormalsXL(model,{0:[0,1,2,3,4,5]},references).reversedFaces,0);
  assert.deepEqual(g,snapshot);
});
test('invalid or contradictory references cannot modify the model', () => {
  for(const kind of ['two','duplicate','opposite','zero','missing']) {
    const g=geoset(), model={Geosets:[g]}, refs=structuredClone(references);
    if(kind==='two')refs.pop();
    if(kind==='duplicate')refs[2]=refs[0];
    if(kind==='opposite')g.Normals[8]=-1;
    if(kind==='zero')g.Normals[8]=0;
    if(kind==='missing')refs[2].vertexIndex=999;
    const before=structuredClone(model);
    assert.throws(()=>correctNormalsXL(model,{0:[0,1,2,3,4,5]},refs),/NormalsXL/);
    assert.deepEqual(model,before);
  }
});
test('multiple target geosets are validated before any mutations', () => {
  const model={Geosets:[geoset(),geoset()]},before=structuredClone(model);
  assert.throws(()=>correctNormalsXL(model,{0:[3],1:[999]},references),/NormalsXL/);
  assert.deepEqual(model,before);
  correctNormalsXL(model,{1:[3,4,5]},references);
  assert.deepEqual(model.Geosets[0],before.Geosets[0]);
  assert.equal(model.Geosets[1].Normals[14],2);
});
test('correction is one undoable document edit and survives MDX/MDL save/reopen', () => {
  const doc=createDemoDocument(),g=doc.model.Geosets[0];
  const normal=Array.from(g.Normals.slice(0,3));
  doc.apply('Prepare mixed normals', ['Geosets'], () => {
    for(let id=0;id<4;id++)g.Normals.set(normal,id*3);
    g.Normals.set(normal.map(v=>-v),9);
  });
  const before=structuredClone(g);
  doc.apply('NormalsXL',['Geosets'],model=>correctNormalsXL(model,{0:[0,1,2,3]},references));
  const after=structuredClone(doc.model.Geosets[0]);
  assert.equal(doc.historyStats.undoSteps,2);
  for(const format of ['mdx','mdl']) {
    const reopened=openDocument(doc.serialize(format));
    assert.deepEqual(reopened.model.Geosets[0].Normals,after.Normals);
    assert.deepEqual(reopened.model.Geosets[0].Faces,after.Faces);
  }
  doc.undo();assert.deepEqual(doc.model.Geosets[0],before);
  doc.redo();assert.deepEqual(doc.model.Geosets[0],after);
});
