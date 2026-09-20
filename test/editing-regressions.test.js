import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { deleteVertices, transformVertices, addTriangle } from '../src/editor-commands.js';
import { uncoupleVertices, deleteSelectedFaces } from '../src/classic-mesh.js';
import { hotkeyBadge } from '../src/hotkey-badge.js';
import { createScrollSensitivity } from '../app/viewport-performance.js';

test('last triangle can be deleted independently of a loose vertex, with undo and MDL/MDX round trips', () => {
  for (const format of ['mdl','mdx']) {
    const doc=createDemoDocument(); const g=doc.model.Geosets[0];
    doc.apply('Set fixture face',['Geosets'],m=>{m.Geosets[0].Faces=new Uint16Array([0,1,2]);});
    const loose=Array.from(g.Vertices.slice(9));
    doc.apply('Delete triangle vertices',['Geosets'], m=>deleteVertices(m.Geosets[0],[0,1,2]));
    assert.equal(doc.model.Geosets[0].Faces.length,0);
    assert.deepEqual(Array.from(doc.model.Geosets[0].Vertices),loose);
    const reopened=openDocument(doc.serialize(format),'loose.'+format);
    assert.deepEqual(Array.from(reopened.model.Geosets[0].Vertices),loose);
    assert.equal(reopened.model.Geosets[0].Faces.length,0);
    doc.undo(); assert.equal(doc.model.Geosets[0].Faces.length,3);
    doc.redo(); assert.equal(doc.model.Geosets[0].Faces.length,0);
  }
});
test('deleting the final face preserves all vertices for later editing', () => {
  const doc=createDemoDocument(), g=doc.model.Geosets[0], before=g.Vertices.slice();
  doc.apply('Delete all faces',['Geosets'],m=>deleteSelectedFaces(m.Geosets[0],Array.from({length:g.Vertices.length/3},(_,i)=>i)));
  assert.equal(doc.model.Geosets[0].Faces.length,0); assert.deepEqual(doc.model.Geosets[0].Vertices,before);
  doc.apply('Move loose point',['Geosets'],m=>transformVertices(m.Geosets[0],[0],[2,0,0]));
  assert.equal(doc.model.Geosets[0].Vertices[0],before[0]+2);
});
test('uncoupled face moves independently of every formerly shared face', () => {
  const g=createDemoDocument().model.Geosets[0];
  const selected=Array.from(g.Faces.slice(0,3));
  const result=uncoupleVertices(g,selected), other=Array.from(g.Faces.slice(3));
  const positions=other.map(i=>Array.from(g.Vertices.slice(i*3,i*3+3)));
  transformVertices(g,Array.from(g.Faces.slice(0,3)),[5,0,0]);
  assert.deepEqual(other.map(i=>Array.from(g.Vertices.slice(i*3,i*3+3))),positions);
});
test('a later face can be picked and moved independently after uncoupling', () => {
  const g=createDemoDocument().model.Geosets[0];
  g.Faces=new Uint16Array([0,1,2,0,2,3]);
  const result=uncoupleVertices(g,[0,2,3]);
  const picked=Array.from(g.Faces.slice(3));
  assert.ok(picked.every(id=>result.selection.includes(id)));
  const neighbour=Array.from(g.Faces.slice(0,3)), before=neighbour.map(i=>Array.from(g.Vertices.slice(i*3,i*3+3)));
  transformVertices(g,picked,[5,0,0]);
  assert.deepEqual(neighbour.map(i=>Array.from(g.Vertices.slice(i*3,i*3+3))),before);
});
test('toolbar badges exclude combinations and sequences while retaining single key aliases', () => {
  assert.deepEqual(['W','M','A','F4','Delete'].map(hotkeyBadge),['W','M','A','F4','DEL']);
  for(const key of ["'A0G",'Ctrl+S','Shift+F4','Alt+A','Space','Backspace']) assert.equal(hotkeyBadge(key),'');
});
test('DPI button owns wheel alone and held mouse gestures do not switch its persistent mode', () => {
  let preferences={wheelMode:'pointer',pointerSensitivity:1,scrollSensitivity:2}; const changed=[];
  const control=createScrollSensitivity({getPreferences:()=>preferences,onPointerChange:v=>{preferences.pointerSensitivity=v;},onWheelModeChange:v=>changed.push(v)});
  const wheel=(buttons=0)=>({deltaY:100,deltaMode:0,buttons,preventDefault(){},stopImmediatePropagation(){}});
  assert.equal(control.wheel(wheel()).kind,'pointer'); assert.ok(preferences.pointerSensitivity<1);
  assert.equal(control.wheel(wheel(2)).kind,'scroll'); assert.equal(preferences.wheelMode,'pointer');
  preferences.wheelMode='rotate'; assert.equal(control.wheel(wheel(1)).kind,'pointer');
  assert.equal(control.wheel(wheel()).adjusting,false); assert.deepEqual(changed,[]);
});
test('a regular wheel tick can increase DPI from its 0.01x minimum', () => {
  let value;
  const control=createScrollSensitivity({getPreferences:()=>({wheelMode:'pointer',pointerSensitivity:.01}),onPointerChange:v=>{value=v;}});
  control.wheel({deltaY:-100,deltaMode:0,buttons:0,preventDefault(){},stopImmediatePropagation(){}});
  assert.equal(value,.02);
});
test('triangle creation audit: preserves requested winding; duplicate and collinear faces are currently accepted', () => {
  const g=createDemoDocument().model.Geosets[0], length=g.Faces.length;
  addTriangle(g,[2,1,0]); assert.deepEqual(Array.from(g.Faces.slice(length)),[2,1,0]);
  addTriangle(g,[2,1,0]); assert.equal(g.Faces.length,length+6);
  g.Vertices.set([0,0,0,1,0,0,2,0,0]); addTriangle(g,[0,1,2]);
  assert.equal(g.Faces.length,length+9);
});
