import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, Vector3, HemisphereLight, DirectionalLight, Matrix4 } from 'three';
import { TEAM_COLORS } from '../src/team-colors.js';
import { visualOptions } from '../src/preferences.js';
import { renderFixture } from '../fixtures/herrdave-render.js';
import { gridSegments } from '../app/viewport-grid.js';
import { depthClipRange, screenPlaneTranslation } from '../app/viewport-math.js';
import { nativeTeamColor, viewportPixelRatio } from '../app/viewport-quality.js';
import { configurePreviewLights, previewLighting } from '../app/preview-lighting.js';
import { projectMovementNodes } from '../app/movement-overlay.js';
import { boneHighlightColors, markerStyle, rigMarkerGeometry, createRigMarkersGL } from '../app/rig-markers-gl.js';
import { projectPreviewGeosets, pickPreviewGeoset } from '../app/preview-selection.js';
import { drawPreviewGeometryOverlay } from '../app/preview-overlays.js';
import { axisScreenTriangles } from '../app/preview-scene-gl.js';

const camera = () => { const c = new OrthographicCamera(-100,100,100,-100,.1,1000);c.position.set(0,0,250);c.lookAt(0,0,0);c.updateMatrixWorld();return c; };
test('HD01 plane display is independent, fine-only toggles retain exact coarse black', () => {
  const prefs = {grid:{extent:64,spacing:8,majorEvery:4,small:true,planes:{xy:true,xz:true,yz:false}}};
  assert.deepEqual(gridSegments(prefs,'xy'),gridSegments(prefs,'yz'));
  const coarse = gridSegments({grid:{...prefs.grid,small:false}},'xz',true,false);
  assert.ok(coarse.length>0);assert.ok(coarse.every(line=>line.color==='#000000'&&line.opacity===1));
  assert.ok(gridSegments(prefs,'xy',true,false).some(line=>line.color==='#808080'&&line.opacity===1));
  const clips=depthClipRange(320,100,256);assert.ok(clips.near<=Math.max(.2,320-256*Math.SQRT2));
});
test('HD03/05 palette enters native encoded exactly once and ambient includes Lambert normalization', () => {
  assert.equal(TEAM_COLORS.length,25);
  for(const entry of TEAM_COLORS) nativeTeamColor(entry.rgbHex).forEach((v,i)=>assert.ok(Math.abs(v*255-entry.rgb[i])<.001,entry.name));
  const ambient=new HemisphereLight(),key=new DirectionalLight();configurePreviewLights(ambient,key,previewLighting());
  assert.ok(Math.abs(ambient.color.r*ambient.intensity/Math.PI-128/255)<1e-12);
});
test('HD06 native pixel ratio remains sharp independently from filtered texture quality',()=>{
  for(const device of [1,1.25,1.5,2])assert.equal(viewportPixelRatio({antialias:false,pixelRatio:1},device),device);
  assert.equal(viewportPixelRatio({antialias:true,pixelRatio:1},2),1);
});
test('unchecked Vertices workplane drags in the camera plane without a fixed world-axis lock',()=>{
  const c=camera();c.position.set(100,150,250);c.lookAt(0,0,0);c.updateMatrixWorld();const pivot=new Vector3(1,2,3),before=pivot.clone();
  const offset=screenPlaneTranslation(c,pivot,400,400,30,20);
  assert.ok(Math.abs(offset.dot(c.getWorldDirection(new Vector3())))<1e-10);assert.ok(Math.abs(offset.z)>1);assert.deepEqual(pivot,before);
});
test('HD10 typed markers contain real cube/tetra vertices and preserve node pivots',()=>{
  const model=renderFixture('rig'),before=structuredClone(model),nodes=projectMovementNodes(model,0,-1,camera(),400,400),byId=new Map(nodes.map(p=>[p.node.ObjectId,p]));
  assert.equal(markerStyle(byId.get(3),byId).shape.vertices.length,8);
  assert.equal(markerStyle(byId.get(4),byId).shape.vertices.length,4);
  assert.equal(markerStyle(byId.get(4),byId).color,'#b2b2ff');
  assert.equal(markerStyle(byId.get(5),byId).color,'#ff9800');
  assert.equal(markerStyle(byId.get(6),byId).color,'#4cff59');
  assert.equal(markerStyle(byId.get(4),byId,{visuals:{node:'#123456'}}).color,'#123456');
  assert.equal(markerStyle(byId.get(6),byId,{visuals:{particle:'#654321'}}).color,'#654321');
  const buffers=rigMarkerGeometry(nodes,[],{bones:true,nodes:true,attachments:true,particles:true});
  assert.ok(buffers.triangles.length>0&&buffers.edges.length>0);
  const z=new Set(Array.from(buffers.triangles).filter((_,i)=>i%6===2));assert.ok(z.size>2);
  assert.deepEqual(model,before);
});
test('Helper roots are ordinary green bones for hierarchy highlighting while refs and events retain distinct polyhedrons',()=>{
  const model={Bones:[{ObjectId:1,Name:'Bone_Pelvis',Parent:0,PivotPoint:[0,0,4]}],Helpers:[{ObjectId:0,Name:'Bone_Root',PivotPoint:[0,0,0]}],Attachments:[{ObjectId:2,Parent:1,PivotPoint:[0,0,8]}],EventObjects:[{ObjectId:3,Parent:1,PivotPoint:[0,0,10]}],Geosets:[],Sequences:[],GlobalSequences:[],PivotPoints:[]};
  const points=projectMovementNodes(model,0,-1,camera(),400,400),byId=new Map(points.map(point=>[point.node.ObjectId,point])),colors=boneHighlightColors(points,[1]);
  assert.equal(points.find(point=>point.node.ObjectId===0).overlayKind,'bones');assert.equal(colors.get(0),'#000000');assert.equal(colors.get(1),'#ff0000');
  assert.equal(markerStyle(byId.get(0),byId).color,'#4cb259');assert.equal(markerStyle(byId.get(2),byId).color,'#b2b2ff');assert.equal(markerStyle(byId.get(3),byId).color,'#ff9800');
});
test('rig marker lighting stays fixed when only the camera moves',()=>{
  const nodes=projectMovementNodes(renderFixture('rig'),0,-1,camera(),400,400);
  const options={bones:true,nodes:true,attachments:true,particles:true};
  const first=rigMarkerGeometry(nodes,[],{...options,cameraPosition:[0,0,250]});
  const second=rigMarkerGeometry(nodes,[],{...options,cameraPosition:[-250,0,0]});
  assert.deepEqual(first.triangles,second.triangles);
});
test('XYZ axes are expanded to exact three-pixel screen quads instead of implementation-limited GL lines',()=>{
  const triangles=axisScreenTriangles([{a:[-1,0,0],b:[1,0,0],color:'#ff0000',opacity:1,width:3}],new Matrix4(),200,100);
  assert.equal(triangles.length,54);const y1=triangles[1],y2=triangles[10];assert.ok(Math.abs(Math.abs(y1-y2)*100/2-3)<1e-5);
});
test('selected bones are red, their parent is black, and every descendant is yellow',()=>{
  const model=renderFixture('rig');model.Bones.push({ObjectId:7,Name:'Grandchild',Parent:2,PivotPoint:[0,0,10],Flags:0});
  const nodes=projectMovementNodes(model,0,-1,camera(),400,400),colors=boneHighlightColors(nodes,[2]);
  assert.equal(colors.get(0),'#000000');assert.equal(colors.get(2),'#ff0000');assert.equal(colors.get(7),'#ffff00');assert.equal(colors.get(1),null);
});
test('HD13 triangle hits ignore winding and preserve stable first-face ties',()=>{
  const model=renderFixture('opposing'),geo=model.Geosets[0],c=camera();
  for(const direction of [1,-1]){c.position.z=direction*250;c.lookAt(0,0,0);c.updateMatrixWorld();const projected=projectPreviewGeosets([{index:0,vertices:geo.Vertices,faces:geo.Faces}],c,400,400);assert.deepEqual(pickPreviewGeoset(projected,200,200),{index:0,ids:[0,1,2]});}
});
test('Surface and Textured views draw only occluded marker edges after the solid visible fragments',()=>{
  let value=0;const calls=[],gl=new Proxy({}, {get:(o,k)=>{if(k in o)return o[k];if(k===k.toUpperCase())return o[k]=++value;if(k.startsWith('create'))return ()=>({});if(k.startsWith('get'))return ()=>true;return (...args)=>calls.push([k,...args]);}});
  const markers=createRigMarkersGL(gl),model=renderFixture('rig'),c=camera();markers.draw(c,projectMovementNodes(model,0,-1,c,400,400),[],{bones:true,nodes:true,attachments:true,particles:true,occludedMarkerEdges:true});
  const draws=calls.filter(call=>call[0]==='drawArrays');assert.deepEqual(draws.map(call=>call[1]),[gl.TRIANGLES,gl.LINES]);
  const hidden=calls.findIndex(call=>call[0]==='depthFunc'&&call[1]===gl.GREATER);assert.ok(hidden>0);assert.equal(calls[hidden+1][0],'drawArrays');assert.equal(calls[hidden+1][1],gl.LINES);markers.dispose();
});
test('visible markers have no edge pass outside Surface and Textured views',()=>{
  let value=0;const calls=[],gl=new Proxy({}, {get:(o,k)=>{if(k in o)return o[k];if(k===k.toUpperCase())return o[k]=++value;if(k.startsWith('create'))return ()=>({});if(k.startsWith('get'))return ()=>true;return (...args)=>calls.push([k,...args]);}});
  const markers=createRigMarkersGL(gl),model=renderFixture('rig'),c=camera();markers.draw(c,projectMovementNodes(model,0,-1,c,400,400),[],{bones:true,nodes:true,attachments:true,particles:true});
  assert.deepEqual(calls.filter(call=>call[0]==='drawArrays').map(call=>call[1]),[gl.TRIANGLES]);markers.dispose();
});
test('Wireframe View draws rig markers as solid through geometry without a wire-only duplicate',()=>{
  let value=0;const calls=[],gl=new Proxy({}, {get:(o,k)=>{if(k in o)return o[k];if(k===k.toUpperCase())return o[k]=++value;if(k.startsWith('create'))return ()=>({});if(k.startsWith('get'))return ()=>true;return (...args)=>calls.push([k,...args]);}});
  const markers=createRigMarkersGL(gl),model=renderFixture('rig'),c=camera();markers.draw(c,projectMovementNodes(model,0,-1,c,400,400),[],{bones:true,nodes:true,attachments:true,particles:true,wireframeMarkers:true});
  assert.deepEqual(calls.filter(call=>call[0]==='drawArrays').map(call=>call[1]),[gl.TRIANGLES]);
  assert.ok(calls.some(call=>call[0]==='disable'&&call[1]===gl.DEPTH_TEST));markers.dispose();
});
test('HD04 visible unselected geometry has no vertices/normals, eligible squares remain blue behind mesh',()=>{
  const c=camera(),model=renderFixture('selection'),geosets=model.Geosets.map((g,index)=>({index,vertices:g.Vertices,normals:g.Normals,faces:g.Faces}));
  const colors=[],rects=[],moves=[];
  const context=new Proxy({fill(){colors.push(this.fillStyle);},rect(...args){rects.push(args);},moveTo(...args){moves.push(args);}}, {get:(o,k)=>k in o?o[k]:()=>{}});
  drawPreviewGeometryOverlay(context,geosets,c,400,400,{vertices:true,normals:true,selectableGeosets:[1]},new Vector3(),100);
  assert.equal(rects.length,3);assert.equal(moves.length,3);assert.ok(colors.includes(visualOptions().vertex));
});
