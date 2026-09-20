import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices } from '../src/animation.js';
import { viewportOverlayOptions, viewportNodeLayout, updateNodeOverlayPositions } from '../app/viewport-overlays.js';

test('explicit viewport flags override render modes and legacy display switches independently', () => {
  const defaults = { mode: 'vertices', showSkeleton: true, showGrid: true, showAxes: true, showVertices: true };
  const hidden = viewportOverlayOptions({ ...defaults, overlays: {} });
  assert.equal(hidden.explicit, true); assert.equal(hidden.axes, true, 'explicit Axis display is independent of grid');
  for (const name of ['bones', 'nodes', 'attachments', 'particles', 'wires', 'vertices', 'grid']) assert.equal(hidden[name], false, name);
  for (const name of ['bones', 'nodes', 'attachments', 'particles', 'wires', 'vertices']) {
    const options = viewportOverlayOptions({ ...defaults, mode: 'textured', overlays: { [name]: true } });
    for (const other of ['bones', 'nodes', 'attachments', 'particles', 'wires', 'vertices']) assert.equal(options[other], other === name);
  }
  const grid = viewportOverlayOptions({ ...defaults, overlays: { grid: true } });
  assert.equal(grid.grid, true); assert.equal(grid.axes, true);
});

test('legacy viewport callers retain render-mode wires/points and showGrid defaults', () => {
  assert.equal(viewportOverlayOptions({ mode: 'vertices' }).vertices, true);
  assert.equal(viewportOverlayOptions({ mode: 'vertices' }).wires, true);
  assert.equal(viewportOverlayOptions({ mode: 'wireframe' }).wires, true);
  assert.equal(viewportOverlayOptions({ mode: 'wireframe' }).vertices, false);
  assert.equal(viewportOverlayOptions({ mode: 'textured', showVertices: true }).vertices, true);
  const options = viewportOverlayOptions({ showSkeleton: true, showGrid: true, showAxes: false });
  assert.equal(options.explicit, false); assert.equal(options.bones, true); assert.equal(options.grid, true); assert.equal(options.axes, false);
});

test('all node types receive the correct independent overlay and helpers participate in bone links', () => {
  const model = { Bones: [{ObjectId:0}, {ObjectId:1,Parent:0}], Helpers:[{ObjectId:2,Parent:0}], Lights:[{ObjectId:3,Parent:2}],
    Attachments:[{ObjectId:4,Parent:1}], EventObjects:[{ObjectId:5}], CollisionShapes:[{ObjectId:6}],
    ParticleEmitters:[{ObjectId:7,Parent:1}], ParticleEmitters2:[{ObjectId:8}], ParticleEmitterPopcorns:[{ObjectId:9}], RibbonEmitters:[{ObjectId:10}] };
  const layout = viewportNodeLayout(model, allNodes(model));
  assert.deepEqual(layout.groups.bones.map(n=>n.ObjectId),[0,1,2]);
  assert.deepEqual(layout.groups.nodes.map(n=>n.ObjectId),[3,5,6]);
  assert.deepEqual(layout.groups.attachments.map(n=>n.ObjectId),[4]);
  assert.deepEqual(layout.groups.particles.map(n=>n.ObjectId),[7,8,9,10]);
  assert.deepEqual(layout.boneLinks.map(n=>n.ObjectId),[0,1,0,2]);
  assert.equal(layout.allLinks.length,10);
});

test('marker positions use bind pivots and animated parent transforms without mutating source nodes', () => {
  const quaternion = new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2).toArray();
  const track = Vector => ({ LineType:0,Keys:[{Frame:0,Vector:new Float32Array(Vector)}] });
  const model = { Sequences:[{Interval:[0,1000]}], Bones:[{ObjectId:0,PivotPoint:[0,0,0],Translation:track([10,0,0]),Rotation:track(quaternion)}, {ObjectId:1,Parent:0,PivotPoint:[3,0,0]}],
    Attachments:[{ObjectId:2,Parent:1}], PivotPoints:[[],[],[5,0,0]] };
  const nodes=allNodes(model),before=structuredClone(model),positions=new Float32Array(nodes.length*3);
  assert.equal(updateNodeOverlayPositions(model,nodes,sampleNodeMatrices(model,0,-1),positions),positions);
  assert.deepEqual(Array.from(positions),[0,0,0,3,0,0,5,0,0]);
  updateNodeOverlayPositions(model,nodes,sampleNodeMatrices(model,500,0),positions);
  [10,0,0,10,3,0,10,5,0].forEach((value,index)=>assert.ok(Math.abs(positions[index]-value)<1e-5));
  assert.deepEqual(model,before);
});
