import test from 'node:test';
import assert from 'node:assert/strict';
import {uncoupleVertices,weldSelectedVertices} from '../src/classic-mesh.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {transformVertices} from '../src/editor-commands.js';
const point=(g,id)=>Array.from(g.Vertices.slice(id*3,id*3+3));
function disconnected(){
 const g=createDemoDocument().model.Geosets[0];
 g.Vertices=new Float32Array([0,0,0, 10,0,0, 10,10,0, 0,0,0, 10,10,0, 0,10,0, 50,50,50]);
 g.Faces=new Uint16Array([0,1,2,3,4,5]);g.Normals=new Float32Array(Array.from({length:7},()=>[0,0,1]).flat());
 g.TVertices=[new Float32Array(14)];g.VertexGroup=new Uint8Array(7);
 return g;
}
test('already independent triangles visibly separate without adding vertices, and a corner moves alone',()=>{
 const g=disconnected(),faces=g.Faces.slice(),before=structuredClone(g);
 const r=uncoupleVertices(g,[0,1,2,3,4,5]);assert.equal(r.added,0);assert.deepEqual(g.Faces,faces);
 assert.ok(Math.hypot(...point(g,0).map((v,a)=>v-point(g,3)[a]))>1);
 assert.ok(Math.hypot(...point(g,2).map((v,a)=>v-point(g,4)[a]))>1);
 assert.deepEqual(point(g,6),point(before,6));
 const other=point(g,3);transformVertices(g,[0],[3,0,0]);assert.deepEqual(point(g,3),other);
});
test('a welded shared corner splits visibly while unselected neighbours retain their coordinates',()=>{
 const g=disconnected();const welded=weldSelectedVertices(g,[0,3]);const before=structuredClone(g);
 const split=uncoupleVertices(g,welded.selection);assert.equal(split.added,1);assert.equal(split.selection.length,2);
 assert.notDeepEqual(point(g,split.selection[0]),point(g,split.selection[1]));
 for(let i=0;i<before.Vertices.length/3;i++)if(!welded.selection.includes(i))assert.deepEqual(point(g,i),point(before,i));
 const duplicate=point(g,split.selection[1]);transformVertices(g,[split.selection[0]],[0,0,5]);assert.deepEqual(point(g,split.selection[1]),duplicate);
});
test('uncoupling loose vertices is a no-op',()=>{
 const g=disconnected(),before=structuredClone(g);assert.deepEqual(uncoupleVertices(g,[6]),{selection:[6],added:0});assert.deepEqual(g,before);
});
test('visible inset and split topology survive undo/redo and both save formats',()=>{
 for(const format of ['mdl','mdx']){
  const doc=createDemoDocument();doc.apply('fixture',['Geosets'],m=>{m.Geosets[0]=disconnected();});
  const original=structuredClone(doc.model.Geosets[0]);
  doc.apply('Uncouple',['Geosets'],m=>uncoupleVertices(m.Geosets[0],[0,1,2,3,4,5]));
  const separated=structuredClone(doc.model.Geosets[0]);assert.notDeepEqual(separated.Vertices,original.Vertices);
  doc.undo();assert.deepEqual(doc.model.Geosets[0],original);doc.redo();assert.deepEqual(doc.model.Geosets[0],separated);
  const reopened=openDocument(doc.serialize(format),'separated.'+format).model.Geosets[0];assert.deepEqual(reopened.Vertices,separated.Vertices);assert.deepEqual(reopened.Faces,separated.Faces);
 }
});
