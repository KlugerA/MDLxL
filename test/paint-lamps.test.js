import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,OrthographicCamera,Vector3} from 'three';
import {createPaintLampObject,paintLampDrag,initialPaintLamp,paintLampDistance,setPaintLampDistance,paintLampLight} from '../app/paint-lamps.js';
import {createPaintLightUniforms,updatePaintLights,applyPaintLightShader} from '../app/paint-lighting.js';
import {normalizePreferences} from '../src/preferences.js';
import {exportConfiguration,importConfiguration} from '../src/portable-settings.js';
test('lamp model stays under 100 triangles and every visible mesh can select its lamp',()=>{
  const object=createPaintLampObject('lamp-1');let triangles=0;object.traverse(part=>{if(part.isMesh){assert.equal(part.userData.lampId,'lamp-1');triangles+=(part.geometry.index?.count||part.geometry.attributes.position.count)/3;}});assert.ok(triangles<100,triangles);assert.equal(object.userData.lampId,'lamp-1');
});
test('move, depth, and around-model controls move the actual source for both cameras',()=>{
  const lamp={position:[10,-20,30],target:[0,0,10]},original=structuredClone(lamp);
  for(const camera of [new PerspectiveCamera(45,1,.1,1000),new OrthographicCamera(-100,100,100,-100,.1,1000)]){
    camera.position.set(100,-200,100);camera.up.set(0,0,1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const moved=paintLampDrag(lamp,20,10,camera,600,600),offset=new Vector3().fromArray(moved.position).sub(new Vector3().fromArray(lamp.position)),cameraDirection=camera.getWorldDirection(new Vector3());
    assert.deepEqual(moved.target,lamp.target);assert.ok(offset.length()>1);assert.ok(Math.abs(offset.dot(cameraDirection))<1e-9,'Move stays in the screen plane');
    const depth=paintLampDrag(lamp,0,-30,camera,600,600,'depth'),depthOffset=new Vector3().fromArray(depth.position).sub(new Vector3().fromArray(lamp.position));
    assert.deepEqual(depth.target,lamp.target);assert.ok(depthOffset.dot(cameraDirection)>1,'Up in depth mode moves away from the camera');assert.ok(depthOffset.clone().cross(cameraDirection).length()<1e-9);
    const turned=paintLampDrag(lamp,25,-30,camera,600,600,'rotate');assert.notDeepEqual(turned.position,lamp.position);assert.deepEqual(turned.target,lamp.target);assert.ok(Math.abs(paintLampDistance(turned)-paintLampDistance(lamp))<1e-9);
  }assert.deepEqual(lamp,original);
  const initial=initialPaintLamp({position:[100,-200,100],target:[0,0,30],radius:50});assert.notDeepEqual(initial.position,[100,-200,100]);assert.ok(initial.position.every(Number.isFinite));
  assert.deepEqual(initialPaintLamp({position:[100,-200,100],target:[100,100,100],center:[0,0,30],radius:50}).target,[0,0,30],'Panning the camera does not move the model distance centre');
});
test('Distance moves lamp coordinates; legacy intensity and directional lamps become distance-sensitive torches',()=>{
  const lamp={position:[0,-64,0],target:[0,0,0],type:1,intensity:0,color:'#ffffff'},original=structuredClone(lamp);
  const near={...lamp,...setPaintLampDistance(lamp,32)},far={...lamp,...setPaintLampDistance(lamp,256)};
  assert.equal(paintLampDistance(near),32);assert.equal(paintLampDistance(far),256);assert.deepEqual(near.target,lamp.target);assert.deepEqual(lamp,original);
  const uniforms=createPaintLightUniforms();updatePaintLights(uniforms,{flat:false,lights:[paintLampLight(near)]});
  assert.equal(uniforms.uCitadelPositions.value[0].w,0);assert.deepEqual(uniforms.uCitadelPositions.value[0].toArray().slice(0,3),near.position);assert.deepEqual(uniforms.uCitadelColors.value[0].toArray(),[11,11,11]);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <colorspace_fragment>'};applyPaintLightShader(shader,uniforms,false);
  assert.match(shader.vertexShader,/distanceToLight\/64\.0/);assert.match(shader.vertexShader,/weight=1\.0\/\(units\*units\)/);
  const brightness=distance=>Math.min(1,11/(1+distance/64)**2);
  assert.ok(brightness(paintLampDistance(near))>brightness(paintLampDistance(far))*2);
  assert.deepEqual(paintLampLight({...lamp,intensity:8}),paintLampLight(lamp));
});
test('Citadel appearance settings survive portable configuration and invalid colours are rejected',()=>{
  const prefs=normalizePreferences({theme:'dark',citadelPaint:{brushTipDark:'#dbeaf0',geosetBorder:'#ab12cd',borderThickness:4}}),restored=importConfiguration(exportConfiguration(prefs));assert.deepEqual(restored.citadelPaint,prefs.citadelPaint);assert.notEqual(prefs.citadelPaint.brushTipDark,prefs.citadelPaint.brushTipLight);
  assert.equal(normalizePreferences({citadelPaint:{borderThickness:999,brushCursor:'red'}}).citadelPaint.borderThickness,6);
});
