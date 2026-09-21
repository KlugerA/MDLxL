import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { setCameraFromCurrentView } from '../app/portrait-camera-edit.js';
import { evaluateModelCamera, applyEvaluatedModelCamera, PORTRAIT_ASPECT } from '../app/portrait-view.js';
import { allNodes } from '../src/animation.js';
import { clearQuickDisplay } from '../src/display-overlays.js';

const view={position:[25,-200,80],target:[0,0,45],roll:.37,fieldOfView:Math.PI/4,near:1,far:1000};
test('Set Current View creates once, updates selected camera, recalculates extents and supports undo/save',()=>{
  const doc=createDemoDocument(); doc.model.Cameras=[];
  const before=structuredClone(doc.model);
  const index=doc.apply('Set Current View',['Cameras','Info','Geosets'],model=>setCameraFromCurrentView(model,-1,view));
  assert.equal(index,0); assert.equal(doc.model.Cameras[0].Name,'Camera 01');
  assert.deepEqual(Array.from(doc.model.Cameras[0].Position),view.position);
  assert.ok(Math.abs(evaluateModelCamera(doc.model,doc.model.Cameras[0],0,-1,0).roll-view.roll)<1e-6);
  assert.ok(doc.model.Info.BoundsRadius>0);
  assert.ok(!allNodes(doc.model).includes(doc.model.Cameras[0]));
  doc.undo(); assert.deepEqual(doc.model,before); doc.redo();
  const next={...view,position:[50,-150,90]};
  doc.apply('Set Current View',['Cameras','Info','Geosets'],model=>setCameraFromCurrentView(model,0,next));
  assert.equal(doc.model.Cameras.length,1); assert.deepEqual(Array.from(doc.model.Cameras[0].Position),next.position);
  for(const format of ['mdl','mdx']) {
    const reopened=openDocument(doc.serialize(format),'camera.'+format);
    assert.equal(reopened.model.Cameras.length,1);
    assert.deepEqual(Array.from(reopened.model.Cameras[0].Position),next.position);
    assert.ok(Math.abs(evaluateModelCamera(reopened.model,reopened.model.Cameras[0],0,-1,0).roll-view.roll)<1e-6);
  }
  doc.model.Cameras.push({...structuredClone(doc.model.Cameras[0]),Name:'Other camera'});
  const first=structuredClone(doc.model.Cameras[0]);
  setCameraFromCurrentView(doc.model,1,view);
  assert.equal(doc.model.Cameras.length,2);
  assert.deepEqual(doc.model.Cameras[0],first);
  assert.equal(doc.model.Cameras[1].Name,'Other camera');
});

test('Set Current View preserves existing camera animation when updating the evaluated view',()=>{
  const model=createDemoDocument().model;
  model.Cameras=[{Name:'Existing',Translation:{LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([10,20,30])}]}}];
  setCameraFromCurrentView(model,0,view,0,0);
  const camera=evaluateModelCamera(model,model.Cameras[0],0,0,0);
  assert.deepEqual(camera.position,view.position);
  assert.equal(model.Cameras[0].Translation.Keys.length,1);
});

test('Set Current View authors one identical camera roll for every Portrait variant',()=>{
  const doc=createDemoDocument();
  const sequence=doc.model.Sequences[0];
  doc.model.Sequences=[
    {...structuredClone(sequence),Name:'Stand',Interval:new Uint32Array([0,99])},
    {...structuredClone(sequence),Name:'Portrait - 1',Interval:new Uint32Array([100,199])},
    {...structuredClone(sequence),Name:'Portrait Talk - 1',Interval:new Uint32Array([300,399])},
  ];
  doc.model.Cameras=[];
  setCameraFromCurrentView(doc.model,-1,view,300,2);
  const source=doc.model.Cameras[0];
  for(const [frame,index] of [[100,1],[150,1],[300,2],[350,2]]) {
    assert.ok(Math.abs(evaluateModelCamera(doc.model,source,frame,index,frame).roll-view.roll)<1e-6);
  }
  assert.deepEqual(source.Rotation.Keys.map(key=>key.Frame),[100,199,300,399]);
  for(const format of ['mdl','mdx']) {
    const reopened=openDocument(doc.serialize(format),'shared-camera.'+format), camera=reopened.model.Cameras[0];
    assert.ok(Math.abs(evaluateModelCamera(reopened.model,camera,150,1,150).roll-view.roll)<1e-6);
    assert.ok(Math.abs(evaluateModelCamera(reopened.model,camera,350,2,350).roll-view.roll)<1e-6);
  }
});

test('Clear all switches off helper overlays while preserving grid, selections and other workspaces',()=>{
  const state={vertices:{grid:true},bones:{grid:true},animation:{grid:true,vertices:true,wires:true,bones:true,nodes:true,attachments:true,particles:true},uv:{vertices:true}};
  const before=structuredClone(state),next=clearQuickDisplay(state,'animation');
  assert.deepEqual(state,before);assert.deepEqual(next.uv,before.uv);
  for(const mode of ['vertices','bones','animation']){
    assert.equal(next[mode].grid,true);
    for(const key of ['vertices','wires','bones','nodes','attachments','particles'])assert.equal(next[mode][key],false);
  }
});

test('Snap uses existing camera entry without altering document, playback or sequence',()=>{
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  assert.match(app,/onSnap=\{\(\) => \{ setPortraitView\('perspective'\); setPortraitSnapRevision\(value => value \+ 1\); \}\}/);
  assert.match(preview,/current\.enterPortrait\(evaluated\);\s*\}, \[props\.portraitMode, props\.portraitCameraIndex, props\.portraitSnapRevision/);
  assert.doesNotMatch(app,/newPortraitCamera|onPortraitNew/);
  for(const file of ['src/commands.js','electron/menu.cjs']) {
    const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/'Cameras'/);
  }
});

test('Portrait exposes the same free XYZ camera controls as the Vertices workspace',()=>{
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
  assert.match(app,/const cameraRotating = cameraMode === 'rotate' \|\| cameraGesture;/);
  assert.doesNotMatch(app,/cameraRotating = .*portraitModeActive/);
  assert.match(app,/\{cameraRotating && cameraPanel\}/);
});

test('Movement and Portrait share the complete viewpoint dropdown',()=>{
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  assert.match(app,/const views = \['orthographic', 'perspective', 'front', 'back', 'left', 'right', 'top', 'bottom'\]/);
  assert.match(app,/value=\{cameraPortraitActive \? portraitView : view\}/);
  assert.match(app,/onChange=\{event => cameraPortraitActive \? setPortraitView\(event\.target\.value\) : setView\(event\.target\.value\)\}/);
  assert.doesNotMatch(preview,/function setView\(next\) \{\s*if \(state\.portraitActive\) return;/);
  assert.match(preview,/if \(state\.portraitActive\) \{ state\.cameraDetached = true; latest\.current\.onPlayingChange\?\.\(false\); \}/);
  assert.match(preview,/state\.portraitActive = true; state\.cameraDetached = false; state\.appliedView = 'perspective';/);
});

test('switching Portrait sequences preserves the one shared camera view',()=>{
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  assert.match(preview,/current\.enterPortrait\(evaluated\);\s*\}, \[props\.portraitMode, props\.portraitCameraIndex, props\.portraitSnapRevision, model, rendererRevision\]\);/);
  assert.doesNotMatch(preview,/current\.enterPortrait\(evaluated\);\s*\}, \[[^\]]*sequenceIndex/);
  assert.match(preview,/setCameraAngles: values => \{ if \(setEditorCameraAngles\(camera, controls\.target, values\)\) \{ if \(state\.portraitActive\) \{ state\.cameraDetached = true;/);
});

test('snapping restores the native camera projection after temporary viewport navigation without authoring changes',()=>{
  const model=createDemoDocument().model;
  setCameraFromCurrentView(model,-1,view);
  const before=structuredClone(model),camera=new PerspectiveCamera(),controls={target:new Vector3(),update(){}};
  const evaluated=evaluateModelCamera(model,model.Cameras[0],0,0,0);
  applyEvaluatedModelCamera(camera,controls,evaluated,PORTRAIT_ASPECT);
  const projection=camera.projectionMatrix.clone(),up=camera.up.clone();
  camera.position.set(99,88,77);controls.target.set(3,4,5);camera.zoom=3;camera.updateProjectionMatrix();
  applyEvaluatedModelCamera(camera,controls,evaluated,PORTRAIT_ASPECT);
  assert.deepEqual(camera.position.toArray(),view.position);
  assert.deepEqual(controls.target.toArray(),view.target);
  assert.deepEqual(camera.projectionMatrix,projection);assert.deepEqual(camera.up,up);
  assert.equal(camera.zoom,1);assert.deepEqual(model,before);
});
