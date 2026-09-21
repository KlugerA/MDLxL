import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PerspectiveCamera, Vector3 } from 'three';
import { setEditorCameraAngles } from '../app/editor-camera-controls.js';
import { HUMAN_FRAME_CROP, HUMAN_FRAME_SIZE, HUMAN_TILE_LAYOUT, MODEL_CAMERA_FOV_FACTOR, PORTRAIT_ASPECT, PORTRAIT_RECT, applyEvaluatedModelCamera, editorCameraSnapshot, evaluateModelCamera, firstPortraitSequenceIndex, portraitCaptureLayout, updateModelCameraFromView } from '../app/portrait-view.js';

const require = createRequire(import.meta.url);
const { HUMAN_PORTRAIT_RESOURCES, validateHumanPortraitResources } = require('../electron/human-portrait-frame.cjs');
const track = (from, to) => ({ LineType:1, Keys:[{Frame:100,Vector:new Float32Array(from)},{Frame:200,Vector:new Float32Array(to)}] });

test('Portrait chooses the first Portrait sequence, including Talk variants', () => {
  assert.equal(firstPortraitSequenceIndex({ Sequences: [
    { Name: 'Portrait Talk' }, { Name: 'Stand' }, { Name: 'Portrait Alternate' }, { Name: 'Portrait' },
  ] }), 0);
  assert.equal(firstPortraitSequenceIndex({ Sequences: [{ Name: 'Stand' }, { Name: 'Portrait Talk 2' }] }), 1);
});

test('tight native gold frame preserves the Warcraft logical camera aperture', () => {
  assert.equal(PORTRAIT_ASPECT, 167 / 170);
  assert.deepEqual(PORTRAIT_RECT, { x:8, y:9, width:167, height:170 });
  assert.deepEqual(HUMAN_FRAME_CROP, { x:414, y:116, width:184, height:184 });
  assert.equal(HUMAN_FRAME_SIZE, 184);
  assert.equal(HUMAN_FRAME_CROP.x + PORTRAIT_RECT.x, 422);
  assert.equal(HUMAN_FRAME_CROP.y + PORTRAIT_RECT.y, 125);
  assert.deepEqual(HUMAN_TILE_LAYOUT.map(row => [row.name,row.sy,row.sh,row.dx,row.dy]), [
    ['humanuitile01.dds',160,352,0,0], ['humanuitile02.dds',212,300,512,52],
  ]);
  const small = portraitCaptureLayout(167,170), large = portraitCaptureLayout(668,680);
  assert.equal(small.size,184); assert.equal(large.size,736);
  assert.equal(small.model.width / small.model.height, PORTRAIT_ASPECT);
  assert.equal(large.model.x / large.size, PORTRAIT_RECT.x / HUMAN_FRAME_SIZE);
});

test('one evaluated camera samples translation, target translation and roll at Movement time', () => {
  const model = { Sequences:[{Interval:[100,200]}], GlobalSequences:[] };
  const source = { Position:[10,20,30], TargetPosition:[1,2,3], FieldOfView:Math.PI/3, NearClip:1, FarClip:10000,
    Translation:track([0,0,0],[20,0,10]), TargetTranslation:track([0,0,0],[0,4,6]), Rotation:track([0],[Math.PI/2]) };
  const evaluated = evaluateModelCamera(model, source, 150, 0, 150);
  assert.deepEqual(evaluated.position.map(Math.round), [20,20,35]);
  assert.deepEqual(evaluated.target.map(Math.round), [1,4,6]);
  assert.ok(Math.abs(evaluated.roll - Math.PI/4) < 1e-6);
  assert.equal(evaluated.near,1); assert.equal(evaluated.far,10000);
});

test('evaluated camera application uses authored projection and fixed portrait aspect', () => {
  const camera = new PerspectiveCamera(), controls = { target:new Vector3(), object:null, update(){} };
  const evaluated = { position:[84,-27,61], target:[1,0,97], roll:.2, fieldOfView:Math.PI/4, near:1, far:10000 };
  assert.equal(applyEvaluatedModelCamera(camera, controls, evaluated, PORTRAIT_ASPECT), true);
  assert.equal(camera.aspect,PORTRAIT_ASPECT); assert.equal(camera.near,1); assert.equal(camera.far,10000);
  assert.equal(MODEL_CAMERA_FOV_FACTOR,.75);
  assert.ok(Math.abs(camera.fov-33.75)<1e-9); assert.deepEqual(camera.position.toArray(),evaluated.position);
  const snapshot = editorCameraSnapshot(camera, controls.target);
  assert.ok(Math.abs(snapshot.fieldOfView-evaluated.fieldOfView)<1e-9);
  assert.ok(Math.abs(snapshot.roll-evaluated.roll)<1e-9);
});

test('view writeback reverses the WC3 FOV conversion, including dolly zoom', () => {
  const camera = new PerspectiveCamera(33.75, PORTRAIT_ASPECT, 1, 10000);
  camera.zoom = 2;
  const view = editorCameraSnapshot(camera, new Vector3());
  const controls = {target:new Vector3(),update(){}};
  applyEvaluatedModelCamera(camera,controls,{...view,roll:0},PORTRAIT_ASPECT);
  assert.ok(Math.abs(Math.tan(camera.fov*Math.PI/360)-Math.tan(33.75*Math.PI/360)/2)<1e-9);
});

test('Set Current View round-trips an arbitrary free camera angle exactly', () => {
  const target = new Vector3(11,-7,23), camera = new PerspectiveCamera(41, PORTRAIT_ASPECT, .5, 9000);
  setEditorCameraAngles(camera,target,{x:37,y:-28,z:61});
  const view = editorCameraSnapshot(camera,target), source = { Position:view.position, TargetPosition:view.target };
  updateModelCameraFromView({},source,view,0,-1,0);
  const restored = new PerspectiveCamera(), controls = {target:new Vector3(),object:null,update(){}};
  applyEvaluatedModelCamera(restored,controls,evaluateModelCamera({},source),PORTRAIT_ASPECT);
  assert.ok(restored.position.distanceTo(camera.position)<1e-5);
  assert.ok(controls.target.distanceTo(target)<1e-5);
  assert.ok(restored.quaternion.angleTo(camera.quaternion)<1e-7);
});

test('camera edits subtract animated offsets instead of double-applying them', () => {
  const model = { Sequences:[{Interval:[100,200]}], GlobalSequences:[] };
  const source = { Position:new Float32Array([10,20,30]), TargetPosition:new Float32Array([1,2,3]), FieldOfView:Math.PI/4, NearClip:1, FarClip:1000,
    Translation:track([0,0,0],[20,0,10]), TargetTranslation:track([0,0,0],[0,4,6]) };
  updateModelCameraFromView(model, source, { position:[50,60,70], target:[8,9,10], roll:-.35, fieldOfView:Math.PI/2, near:2, far:2000 }, 150, 0, 150);
  const evaluated = evaluateModelCamera(model, source, 150, 0, 150);
  assert.deepEqual(evaluated.position.map(Math.round),[50,60,70]); assert.deepEqual(evaluated.target.map(Math.round),[8,9,10]);
  assert.ok(Math.abs(evaluated.roll+.35)<1e-6);
  assert.equal(evaluated.fieldOfView,Math.PI/2); assert.equal(evaluated.near,2); assert.equal(evaluated.far,2000);
});

test('camera roll writeback rebases an animated curve without flattening it', () => {
  const model = { Sequences:[{Interval:[100,200]}], GlobalSequences:[] };
  const source = { Position:[0,0,10], TargetPosition:[0,0,0], Rotation:track([.1],[.5]) };
  updateModelCameraFromView(model, source, { roll:-.6 }, 150, 0, 150);
  assert.ok(Math.abs(evaluateModelCamera(model,source,150,0,150).roll+.6)<1e-6);
  assert.ok(Math.abs((source.Rotation.Keys[1].Vector[0]-source.Rotation.Keys[0].Vector[0])-.4)<1e-6);
});

test('Human frame endpoint uses local native tiles and mask without installation lookups', () => {
  assert.deepEqual(HUMAN_PORTRAIT_RESOURCES, []);
  const records = validateHumanPortraitResources();
  assert.equal(records.length, 3);
  assert.ok(records.every(record => record.bytes.toString('ascii', 0, 4) === 'DDS '));
});
