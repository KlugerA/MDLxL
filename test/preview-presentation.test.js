import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera } from 'three';
import { previewPresentationProps, previewOverlaySettings, previewOverlayGeometry } from '../app/preview-presentation.js';
import { drawPresentationOverlay } from '../app/preview-overlays.js';

const geosets = () => [0, 1].map(index => ({ index, vertices: new Float32Array([-20,-20,0,20,-20,0,20,20,0,-20,20,0,0,0,0].map((v,i)=>i%3===0?v+index*55:v)), faces: new Uint16Array([0,1,2,0,2,3]) }));
const domain = {0:[0,1,2,3,4],1:new Set([0,1,2,3,4])};

test('Animations presentation shares editor display switches and uses the grid only for the None background',()=>{
  const edit={model:{Geosets:[]},mode:'wireframe',sequenceIndex:2,time:1234,playing:true,cameraMode:'rotate',cameraAnglesRequest:{x:30},preferences:{graphics:{textures:false,antialias:false},platform:{enabled:true}},hiddenGeosets:new Set([0]),selectionByGeoset:{0:[0]},selectedNodeIds:[1],overlays:{vertices:true,wires:true,bones:true,grid:true,normals:true},showAxes:true,hoveredGeoset:0,onSelectVertices:()=>{},onNodeTransform:()=>{},onTimeChange:()=>{}};
  const before=structuredClone(edit.preferences),preview=previewPresentationProps({...edit,presentation:'preview'});
  assert.equal(previewPresentationProps(edit),edit);
  for(const key of ['model','cameraAnglesRequest','sequenceIndex','time','playing','cameraMode','onTimeChange'])assert.equal(preview[key],edit[key],key);
  assert.equal(preview.mode,'textured');assert.equal(preview.shaded,true);assert.equal(preview.preferences.graphics.textures,true);assert.equal(preview.preferences.platform.enabled,false);
  assert.equal(preview.overlays.grid,true);assert.equal(preview.overlays.axes,true);assert.equal(preview.overlays.wires,true);assert.equal(preview.overlays.vertices,true);assert.equal(preview.overlays.bones,true);assert.equal(preview.overlays.normals,true);assert.deepEqual(preview.selectionByGeoset,{});assert.deepEqual(preview.selectedNodeIds,[]);
  assert.equal(preview.showGrid,true);assert.equal(preview.showAxes,true);assert.equal(preview.showVertices,true);assert.equal(preview.showSkeleton,true);assert.equal(preview.showNormals,true);assert.equal(preview.hiddenGeosets,undefined);assert.equal(preview.hoveredGeoset,null);assert.equal(preview.onSelectVertices,undefined);assert.equal(preview.onNodeTransform,undefined);
  const pictured=previewPresentationProps({...edit,presentation:'preview',backgroundUrl:'file:///background.png'});
  assert.equal(pictured.showGrid,false);assert.equal(pictured.showAxes,false);assert.equal(pictured.overlays.grid,false);assert.equal(pictured.overlays.axes,false);assert.equal(pictured.overlays.wires,true);assert.equal(pictured.overlays.vertices,true);
  const gridDisabled=previewPresentationProps({...edit,presentation:'preview',overlays:{...edit.overlays,grid:false}});
  assert.equal(gridDisabled.showGrid,false);assert.equal(gridDisabled.overlays.grid,false);assert.equal(gridDisabled.showAxes,false);
  assert.deepEqual(edit.preferences,before);assert.deepEqual(edit.selectionByGeoset,{0:[0]});
});

test('interactive preview retains only the selection and geoset-hover inputs needed by Select New',()=>{
  const change=()=>{},preview=previewPresentationProps({presentation:'preview',interactivePreview:true,preferences:{graphics:{}},selectionByGeoset:{1:[2]},selectableGeosets:[1],hoveredGeoset:1,onSelectionChange:change,onNodeTransform:()=>{}});
  assert.deepEqual(preview.selectionByGeoset,{1:[2]});assert.deepEqual(preview.selectableGeosets,[1]);assert.equal(preview.hoveredGeoset,1);assert.equal(preview.onSelectionChange,change);assert.equal(preview.onNodeTransform,undefined);
});

test('UV Only Selected reaches the preview without changing other clean previews',()=>{
  const hidden=new Set([1,3]), props={presentation:'preview',preferences:{graphics:{}},hiddenGeosets:hidden,hideRgbGeoset:2};
  assert.equal(previewPresentationProps(props).hiddenGeosets,undefined);
  const isolated=previewPresentationProps({...props,uvOnlySelected:true});
  assert.equal(isolated.hiddenGeosets,hidden);
  assert.equal(isolated.hideRgbGeoset,2);
});

test('clean is the preview overlay default; Highlight overrides All mesh even for empty selection',()=>{
  assert.deepEqual(previewOverlayGeometry(geosets(),{}),[]);
  assert.equal(previewOverlaySettings({allMesh:true,highlightSelection:true}).mode,'selection');
  assert.deepEqual(previewOverlayGeometry(geosets(),{allMesh:true,highlightSelection:true,eligibleByGeoset:domain,selectionByGeoset:{}}),[]);
});

test('All mesh displays the caller domain without widening a partial geoset',()=>{
  const result=previewOverlayGeometry(geosets(),{allMesh:true,eligibleByGeoset:{0:[0,1,2]}});
  assert.deepEqual(result.map(x=>x.index),[0]);assert.deepEqual(result[0].pointIndices,[0,1,2]);assert.deepEqual(result[0].edges,[[0,1],[1,2],[2,0]]);
  const whole=previewOverlayGeometry(geosets(),{allMesh:true,eligibleByGeoset:domain});assert.equal(whole.length,2);assert.equal(whole.reduce((n,g)=>n+g.pointIndices.length,0),10);assert.equal(whole.reduce((n,g)=>n+g.edges.length,0),10);
});

test('Highlight keeps exact selected points and unique incident edges, not the selected triangle perimeter',()=>{
  const input=geosets(),before=structuredClone(input),result=previewOverlayGeometry(input,{allMesh:true,highlightSelection:true,eligibleByGeoset:domain,selectionByGeoset:{0:[0]}});
  assert.deepEqual(result.map(x=>x.index),[0]);assert.deepEqual(result[0].pointIndices,[0]);assert.deepEqual(result[0].edges,[[0,1],[2,0],[3,0]]);assert.deepEqual(input,before);
});

test('invalid and outside-domain selection does not add points, edges, or unrelated geosets',()=>{
  const result=previewOverlayGeometry(geosets(),{highlightSelection:true,eligibleByGeoset:{0:new Set([0,1,2])},selectionByGeoset:{0:[-1,0,0,3,99,.5],1:[0]}});
  assert.deepEqual(result[0].pointIndices,[0]);assert.deepEqual(result[0].edges,[[0,1],[2,0]]);assert.equal(result.length,1);
});

test('preview Size scales canvas points and portable line width, leaving projected endpoints and model unchanged',()=>{
  const camera=new OrthographicCamera(-100,100,100,-100,.1,1000);camera.position.z=200;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const input=geosets(),before=structuredClone(input),runs=[];
  for(const size of [.25,3]){
    const calls=[],context=new Proxy({},{get:(o,key)=>key in o?o[key]:(...args)=>calls.push([key,...args]),set:(o,key,value)=>{calls.push([key,value]);o[key]=value;return true;}});
    const counts=drawPresentationOverlay(context,input,camera,400,400,{highlightSelection:true,eligibleByGeoset:domain,selectionByGeoset:{0:[0]},size},1.5);assert.deepEqual(counts,{points:1,edges:3});runs.push(calls);
  }
  assert.deepEqual(runs[0].filter(c=>c[0]==='moveTo'||c[0]==='lineTo'),runs[1].filter(c=>c[0]==='moveTo'||c[0]==='lineTo'));
  assert.equal(runs[1].find(c=>c[0]==='lineWidth')[1],12*runs[0].find(c=>c[0]==='lineWidth')[1]);assert.equal(runs[0].find(c=>c[0]==='rect')[3],4);assert.equal(runs[1].find(c=>c[0]==='rect')[3],15);assert.deepEqual(input,before);
});

test('Select New overlay draws every eligible vertex and a larger contrasting selected layer',()=>{
  const camera=new OrthographicCamera(-100,100,100,-100,.1,1000);camera.position.z=200;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const calls=[],context=new Proxy({},{get:(o,key)=>key in o?o[key]:(...args)=>calls.push([key,...args]),set:(o,key,value)=>{calls.push([key,value]);o[key]=value;return true;}});
  const counts=drawPresentationOverlay(context,geosets(),camera,400,400,{allMesh:true,interactiveSelection:true,eligibleByGeoset:{0:[0,1,2,3,4]},selectionByGeoset:{0:[2]},color:'#ff3030'},1);
  assert.deepEqual(counts,{points:5,edges:5});assert.equal(calls.filter(call=>call[0]==='rect').length,6);
  assert.ok(calls.some(call=>call[0]==='fillStyle'&&call[1]==='#ff3030'));assert.ok(calls.some(call=>call[0]==='strokeStyle'&&call[1]==='#fff'));
});
