import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPortraitSequence, portraitSequenceIndices } from '../src/sequence-editor.js';
import { sampleTrack } from '../src/animation.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { PerspectiveCamera, Vector3 } from 'three';
import { thickMarkerEdges } from '../app/rig-markers-gl.js';

const track = (a,b) => ({LineType:1,Keys:[{Frame:100,Vector:new Float32Array(a)},{Frame:1100,Vector:new Float32Array(b)}]});
test('Portrait copies visibility/RGB to requested duration without bone or camera motion', () => {
  const model = {Sequences:[{Name:'Stand',Interval:[100,1100]}],Geosets:[],Info:{},
    Bones:[{Translation:track([0,0,0],[10,20,30])}],
    Cameras:[{Translation:track([0,0,0],[1,2,3])}],
    Attachments:[{Visibility:track([1],[0])}],
    GeosetAnims:[{Alpha:track([0],[1]),Color:track([1,0,0],[0,1,0])}],
    Materials:[{Layers:[{Alpha:track([1],[.5])}]}],
    Lights:[{Color:{...track([0,0,1],[1,0,0]),GlobalSeqId:0}}]};
  const before=structuredClone(model), index=createPortraitSequence(model,2000,0);
  assert.equal(index,1); assert.equal(model.Sequences[index].Name,'Portrait');
  assert.deepEqual(Array.from(model.Sequences[index].Interval),[2100,4100]);
  assert.deepEqual(model.Bones,before.Bones); assert.deepEqual(model.Cameras,before.Cameras);
  assert.deepEqual(model.Lights,before.Lights);
  const options={interval:model.Sequences[index].Interval,fallback:1};
  assert.equal(sampleTrack(model.Attachments[0].Visibility,3100,options),.5);
  assert.equal(sampleTrack(model.GeosetAnims[0].Alpha,3100,options),.5);
  assert.equal(sampleTrack(model.Materials[0].Layers[0].Alpha,3100,options),.75);
  assert.deepEqual(sampleTrack(model.GeosetAnims[0].Color,3100,{...options,fallback:[1,1,1]}),[.5,.5,0]);
  assert.deepEqual(model.GeosetAnims[0].Alpha.Keys.slice(0,2),before.GeosetAnims[0].Alpha.Keys);
});
test('Portrait requirement handles first Talk variant and rejects invalid setup without mutation', () => {
  const model={Sequences:[{Name:'Stand',Interval:[0,1000]},{Name:'PORTRAIT Talk',Interval:[2000,3000]},{Name:'Portrait',Interval:[4000,5000]}]};
  assert.deepEqual(portraitSequenceIndices(model),[1,2]);
  const before=structuredClone(model);
  for (const duration of [0,-1,1.5,Infinity]) assert.throws(()=>createPortraitSequence(model,duration,0));
  assert.throws(()=>createPortraitSequence(model,1000,99));
  assert.deepEqual(model,before);
});
test('Portrait default setup creates an ordinary blank sequence and aligned extents', () => {
  const model={Sequences:[],Geosets:[{Anims:[]}]};
  createPortraitSequence(model,250);
  assert.deepEqual(Array.from(model.Sequences[0].Interval),[0,250]);
  assert.equal(model.Sequences[0].NonLooping,false);
  assert.equal(model.Geosets[0].Anims.length,1);
});
test('Portrait setup is one undoable edit and survives MDL/MDX save and reopen', () => {
  const doc=createDemoDocument(), before=structuredClone(doc.model);
  const index=doc.apply('Create Portrait',['Sequences','Geosets','GeosetAnims','Materials','Nodes'], model=>createPortraitSequence(model,1750,0));
  const created=structuredClone(doc.model);
  assert.equal(created.Sequences[index].Name,'Portrait');
  doc.undo(); assert.deepEqual(doc.model,before);
  doc.redo(); assert.deepEqual(doc.model,created);
  for(const format of ['mdl','mdx']) {
    const reopened=openDocument(doc.serialize(format),'portrait.'+format);
    assert.equal(reopened.readOnly,false);
    assert.equal(reopened.model.Sequences[index].Name,'Portrait');
    assert.equal(reopened.model.Sequences[index].Interval[1]-reopened.model.Sequences[index].Interval[0],1750);
    assert.equal(reopened.model.Geosets[0].Anims.length,reopened.model.Sequences.length);
  }
});
test('parent wireframe expansion is a real two-pixel quad under perspective', () => {
  const camera=new PerspectiveCamera(40,1,1,100); camera.position.z=10; camera.updateMatrixWorld();
  const result=thickMarkerEdges(new Float32Array([-1,0,0,0,0,0,1,0,0,0,0,0]),camera,500,500);
  assert.equal(result.length,36);
  const points=Array.from({length:6},(_,i)=>new Vector3().fromArray(result,i*6).project(camera));
  assert.ok(Math.abs((points[0].y-points[1].y)*250-2)<.0001);
  assert.deepEqual(Array.from(result.slice(12,18)),Array.from(result.slice(18,24)));
});
test('Portrait remains an editable Movement view with gated sequences and no playback re-entry', () => {
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  const movement=readFileSync(new URL('../app/MovementControllerRecomp.jsx',import.meta.url),'utf8');
  const toolbar=readFileSync(new URL('../app/PortraitToolbar.jsx',import.meta.url),'utf8');
  assert.match(toolbar,/Full Model View.*Portrait Frame View/);
  assert.doesNotMatch(app,/>Camera<\/button>/);
  assert.match(app,/type: 'portraitSetup'/);
  assert.match(movement,/!portraitMode.*All line/);
  assert.doesNotMatch(preview,/selectedNodeIds: \[\], selectionByGeoset: \{\}/);
  assert.match(app,/liveMovementRevision\.current = doc\.revision/);
  assert.match(preview,/\[rendererModel, rendererRevision, textureAssets/);
  assert.doesNotMatch(preview,/\[rendererModel, revision, textureAssets/);
  assert.match(preview,/\[props.portraitMode, props.portraitCameraIndex, props.portraitSnapRevision, model, rendererRevision\]/);
  assert.doesNotMatch(preview,/props\.portraitSnapRevision, model, rendererRevision, sequenceIndex/);
  assert.doesNotMatch(preview,/camera.fov = snapshot.fieldOfView/);
});
