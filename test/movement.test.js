import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { applyMovementTransform, deleteMovementControllers, deleteMovementKeys, insertMovementKeys, movementControllerType, movementKeyframes, sampleMovement, setMovementBezierHandles, setMovementControllerType, setMovementHermiteCurve, updateMovementKey } from '../src/movement.js';
import { sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { MOVEMENT_GIZMO_SCALE, boneConnectionAppearance, boneConnectionEndpoints, movementAxisHandles, movementDragAmount, movementFreeScaleValues, movementMarkerRadius, movementNodeSelection, movementWorkplaneHandle, movementWorkplanePointer, pickMovementHandle, pickMovementNode, projectMovementNodes } from '../app/movement-overlay.js';
import { applyRestPoseMatrices, isUVOnlyPreviewChange, portraitBlankDragRotatesCamera } from '../app/game-preview-data.js';
import { patchWarcraftMeshFragmentShader, previewGeosetTint } from '../app/warcraft-preview-adapter.js';

const near = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const nearVector = (a, b) => Array.from(a).forEach((value, i) => near(value, b[i]));
const track = (...keys) => ({ LineType: 1, Keys: keys.map(([Frame, Vector]) => ({ Frame, Vector: new Float32Array(Vector) })) });
const rotation = (axis, degrees) => new Quaternion().setFromAxisAngle(new Vector3().fromArray(axis), degrees * Math.PI / 180).toArray();
const fixture = () => ({ Sequences: [{ Name: 'Stand', Interval: [100, 1000] }, { Name: 'Attack', Interval: [2000, 3000] }], GlobalSequences: [], Bones: [
  { ObjectId: 0, Name: 'Parent', PivotPoint: [0, 0, 0] },
  { ObjectId: 2, Name: 'Child', Parent: 0, PivotPoint: [4, 0, 0] },
], Helpers: [], Geosets: [], PivotPoints: [] });

test('direct movement key edit retimes one node and preserves tangents and unrelated sequences', () => {
  const model = fixture();
  model.Bones[0].Translation = track([100, [1, 2, 3]], [200, [4, 5, 6]], [2000, [7, 8, 9]]);
  model.Bones[0].Translation.LineType = 2;
  model.Bones[0].Translation.Keys[0].InTan = new Float32Array([0.1, 0.2, 0.3]);
  model.Bones[0].Translation.Keys[0].OutTan = new Float32Array([0.4, 0.5, 0.6]);
  const tangent = structuredClone(model.Bones[0].Translation.Keys[0].InTan), other = structuredClone(model.Bones[0].Translation.Keys[2]);
  updateMovementKey(model, 0, 100, 150, 0, 'move', [10, 20, 30]);
  assert.deepEqual(model.Bones[0].Translation.Keys.map(key => key.Frame), [150, 200, 2000]);
  assert.deepEqual([...model.Bones[0].Translation.Keys[0].Vector], [10, 20, 30]);
  assert.deepEqual(model.Bones[0].Translation.Keys[0].InTan, tangent);
  assert.deepEqual(model.Bones[0].Translation.Keys[2], other);
  const before = structuredClone(model);
  assert.throws(() => updateMovementKey(model, 0, 150, 200, 0, 'move', [0, 0, 0]), /Another key/);
  assert.throws(() => updateMovementKey(model, 0, 150, 2001, 0, 'move', [0, 0, 0]), /inside/);
  assert.throws(() => updateMovementKey(model, 0, 150, 180, 0, 'move', [NaN, 0, 0]), /finite/);
  assert.deepEqual(model, before);
});

test('direct global rotation key edits normalize quaternions and retain shared sequence timing', () => {
  const model = fixture(); model.GlobalSequences = [100];
  model.Bones[0].Rotation = { ...track([25, [0, 0, 0, 1]]), GlobalSeqId: 0 };
  updateMovementKey(model, 0, 125, 150, 0, 'rotate', [0, 0, 2, 2]);
  const key = model.Bones[0].Rotation.Keys[0];
  assert.equal(key.Frame, 50); assert.equal(model.Bones[0].Rotation.GlobalSeqId, 0);
  near(Math.hypot(...key.Vector), 1);
  nearVector(key.Vector, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
});

test('movement authors only current sequence and keeps bind positions and other sequences intact', () => {
  const model = fixture(), originalPivot = [...model.Bones[1].PivotPoint];
  model.Bones[1].Translation = track([2000, [99, 0, 0]], [3000, [101, 0, 0]]);
  applyMovementTransform(model, [2], 500, 0, { mode: 'move', space: 'world', axis: 'X', amount: 10 });
  assert.deepEqual(model.Bones[1].Translation.Keys.map(key => key.Frame), [100, 500, 1000, 2000, 3000]);
  nearVector(sampleMovement(model, model.Bones[1], 'Translation', 500, 0), [10, 0, 0]);
  nearVector(sampleMovement(model, model.Bones[1], 'Translation', 100, 0), [0, 0, 0]);
  nearVector(sampleMovement(model, model.Bones[1], 'Translation', 2500, 1), [100, 0, 0]);
  assert.deepEqual(model.Bones[1].PivotPoint, originalPivot);
});

test('local XYZ rotation follows the selected bone while world XYZ follows environment axes', () => {
  const local = fixture(), world = fixture();
  for (const model of [local, world]) {
    model.Bones[0].Rotation = track([100, rotation([0, 0, 1], 90)]);
    model.Bones[1].Rotation = track([100, rotation([0, 1, 0], 45)]);
  }
  const before = new Quaternion().fromArray(sampleMovement(local, local.Bones[1], 'Rotation', 500, 0));
  applyMovementTransform(local, [2], 500, 0, { mode: 'rotate', space: 'local', axis: 'X', amount: 90 });
  applyMovementTransform(world, [2], 500, 0, { mode: 'rotate', space: 'world', axis: 'X', amount: 90 });
  nearVector(sampleMovement(local, local.Bones[1], 'Rotation', 500, 0), before.clone().multiply(new Quaternion().fromArray(rotation([1, 0, 0], 90))).toArray());
  const parent = new Quaternion().fromArray(rotation([0, 0, 1], 90));
  const expected = parent.clone().invert().multiply(new Quaternion().fromArray(rotation([1, 0, 0], 90))).multiply(parent).multiply(before);
  nearVector(sampleMovement(world, world.Bones[1], 'Rotation', 500, 0), expected.toArray());
  assert.notDeepEqual(sampleMovement(world, world.Bones[1], 'Rotation', 500, 0), sampleMovement(local, local.Bones[1], 'Rotation', 500, 0));
});

test('rotating parent makes child and attached mesh follow normally without editing child keys', () => {
  const model = fixture();
  const geo = { Vertices: new Float32Array([4, 0, 0]), VertexGroup: [0], Groups: [[2]] };
  applyMovementTransform(model, [0], 500, 0, { mode: 'rotate', space: 'local', axis: 'Z', amount: 90 });
  nearVector(skinGeoset(geo, sampleNodeMatrices(model, 500, 0)), [0, 4, 0]);
  assert.equal(model.Bones[1].Rotation, undefined);
});

test('world movement cancels parent rotation and scaling; local movement follows current local axes', () => {
  for (const space of ['world', 'local']) {
    const model = fixture();
    model.Bones[0].Rotation = track([100, rotation([0, 0, 1], 90)]);
    model.Bones[0].Scaling = track([100, [2, 2, 2]]);
    model.Bones[1].Rotation = track([100, rotation([0, 0, 1], 90)]);
    const pivot = new Vector3(4, 0, 0), before = pivot.clone().applyMatrix4(sampleNodeMatrices(model, 500, 0).get(2));
    applyMovementTransform(model, [2], 500, 0, { mode: 'move', space, axis: 'X', amount: 5 });
    const difference = pivot.applyMatrix4(sampleNodeMatrices(model, 500, 0).get(2)).sub(before);
    nearVector(difference.toArray(), space === 'world' ? [5, 0, 0] : [-10, 0, 0]);
  }
});

test('do-not-inherit rotation is respected while authoring world rotation', () => {
  const model = fixture(); model.Bones[0].Rotation = track([100, rotation([0, 0, 1], 90)]); model.Bones[1].Flags = 2;
  applyMovementTransform(model, [2], 500, 0, { mode: 'rotate', space: 'world', axis: 'X', amount: 45 });
  nearVector(sampleMovement(model, model.Bones[1], 'Rotation', 500, 0), rotation([1, 0, 0], 45));
});

test('multiple selected nodes rotate on individual pivots and retain normalized quaternions', () => {
  const model = fixture(); delete model.Bones[1].Parent;
  applyMovementTransform(model, [0, 2], 500, 0, { mode: 'rotate', space: 'local', values: [31, 12, -78] });
  for (const node of model.Bones) {
    near(Math.hypot(...sampleMovement(model, node, 'Rotation', 500, 0)), 1);
    nearVector(new Vector3().fromArray(node.PivotPoint).applyMatrix4(sampleNodeMatrices(model, 500, 0).get(node.ObjectId)).toArray(), node.PivotPoint);
  }
});

test('global movement keys wrap correctly and keep the global assignment', () => {
  const model = fixture(); model.GlobalSequences = [200]; model.Bones[0].Translation = { ...track([0, [0, 0, 0]], [100, [10, 0, 0]], [200, [0, 0, 0]]), GlobalSeqId: 0 };
  applyMovementTransform(model, [0], 650, 0, { mode: 'move', space: 'world', axis: 'Y', amount: 3 });
  assert.equal(model.Bones[0].Translation.GlobalSeqId, 0);
  nearVector(model.Bones[0].Translation.Keys.find(key => key.Frame === 50).Vector, [5, 3, 0]);
  assert.ok(movementKeyframes(model, [0], 0, 'move').includes(650));
  deleteMovementKeys(model, [0], 650, 0, 'move'); assert.ok(!model.Bones[0].Translation.Keys.some(key => key.Frame === 50));
});

test('existing cubic tangents retain shape when an existing translation key moves', () => {
  for (const lineType of [2, 3]) {
    const model = fixture(); model.Bones[0].Translation = { LineType: lineType, Keys: [{ Frame: 500, Vector: [4, 5, 6], InTan: [1, 2, 3], OutTan: [7, 8, 9] }] };
    applyMovementTransform(model, [0], 500, 0, { mode: 'move', space: 'world', axis: 'X', amount: 10 });
    nearVector(model.Bones[0].Translation.Keys[0].InTan, lineType === 2 ? [1, 2, 3] : [11, 2, 3]);
    assert.equal(model.Bones[0].Translation.LineType, lineType);
  }
});

test('movement edits round-trip MDL/MDX in memory and undo/redo as one operation', () => {
  for (const format of ['mdl', 'mdx']) {
    const doc = createDemoDocument(), id = doc.model.Bones[0].ObjectId, interval = doc.model.Sequences[0].Interval, frame = Math.round((interval[0] + interval[1]) / 2);
    const before = structuredClone(doc.model.Bones[0].Rotation);
    doc.apply('Rotate local Y', ['Nodes'], model => applyMovementTransform(model, [id], frame, 0, { mode: 'rotate', space: 'local', axis: 'Y', amount: 45 }));
    const authored = structuredClone(doc.model.Bones[0].Rotation);
    const reopened = openDocument(doc.serialize(format), `synthetic.${format}`);
    nearVector(sampleMovement(reopened.model, reopened.model.Bones[0], 'Rotation', frame, 0), sampleMovement(doc.model, doc.model.Bones[0], 'Rotation', frame, 0));
    doc.undo(); assert.deepEqual(doc.model.Bones[0].Rotation, before); doc.redo(); assert.deepEqual(doc.model.Bones[0].Rotation, authored);
  }
});

test('insert and delete keys target current channel; rejected transforms do not mutate', () => {
  const model = fixture(); insertMovementKeys(model, [0], 500, 0, 'all');
  assert.deepEqual(movementKeyframes(model, [0], 0, 'rotate'), [100, 500, 1000]);
  deleteMovementKeys(model, [0], 500, 0, 'rotate'); assert.equal(model.Bones[0].Translation.Keys.length, 3);
  const before = structuredClone(model);
  assert.throws(() => applyMovementTransform(model, [0], 500, -1, { mode: 'move', axis: 'X', amount: 5 }), /Choose an animation/);
  assert.throws(() => applyMovementTransform(model, [0], 500, 0, { mode: 'scale', values: [1, 0, 1] }), /zero/);
  assert.deepEqual(model, before);
});

test('movement controller types preserve keys and create valid cubic tangents', () => {
  const model = fixture();
  model.Bones[0].Translation = track([100, [0, 0, 0]], [500, [5, 2, 1]], [1000, [10, 0, 3]]);
  setMovementControllerType(model, [0], 0, 'move', 2);
  assert.equal(movementControllerType(model, [0], 'move'), 2);
  assert.ok(model.Bones[0].Translation.Keys.every(key => key.InTan?.length === 3 && key.OutTan?.length === 3));
  const vectors = model.Bones[0].Translation.Keys.map(key => [...key.Vector]);
  setMovementHermiteCurve(model, [0], 0, 'move', { tension: .25, continuity: .5, bias: -.25 });
  assert.deepEqual(model.Bones[0].Translation.Keys.map(key => [...key.Vector]), vectors);
  assert.notDeepEqual([...model.Bones[0].Translation.Keys[1].InTan], [...model.Bones[0].Translation.Keys[1].OutTan]);
  setMovementControllerType(model, [0], 0, 'move', 0);
  assert.ok(model.Bones[0].Translation.Keys.every(key => !key.InTan && !key.OutTan));
});

test('Bezier handles edit only the selected stored key and validate dimensions', () => {
  const model = fixture(); model.Bones[0].Translation = track([100, [0, 0, 0]], [500, [5, 2, 1]], [1000, [10, 0, 3]]);
  setMovementControllerType(model, [0], 0, 'move', 3);
  setMovementBezierHandles(model, [0], 500, 0, 'move', { incoming: [3, 1, 0], outgoing: [7, 3, 2] });
  assert.deepEqual([...model.Bones[0].Translation.Keys[1].InTan], [3, 1, 0]);
  assert.deepEqual([...model.Bones[0].Translation.Keys[1].OutTan], [7, 3, 2]);
  assert.throws(() => setMovementBezierHandles(model, [0], 500, 0, 'move', { incoming: [1], outgoing: [2] }), /3 finite components/);
});

test('Delete Controller scopes local transforms to the current sequence and All line removes every transform', () => {
  const model = fixture();
  for (const property of ['Translation', 'Rotation', 'Scaling']) model.Bones[0][property] = track([100, property === 'Rotation' ? [0, 0, 0, 1] : [1, 1, 1]], [500, property === 'Rotation' ? [0, 0, .5, .866] : [2, 2, 2]], [2000, property === 'Rotation' ? [0, 0, 0, 1] : [3, 3, 3]]);
  assert.equal(deleteMovementControllers(model, [0], 0), 6);
  for (const property of ['Translation', 'Rotation', 'Scaling']) assert.deepEqual(model.Bones[0][property].Keys.map(key => key.Frame), [2000]);
  assert.equal(deleteMovementControllers(model, [0], -1), 3);
  for (const property of ['Translation', 'Rotation', 'Scaling']) assert.equal(model.Bones[0][property], undefined);
  assert.equal(model.Bones[1].Translation, undefined);
});

test('viewport projects animated node positions and supplies usable XYZ handles', () => {
  const model = fixture(), camera = new PerspectiveCamera(40, 1, .1, 1000); camera.up.set(0, 0, 1); camera.position.set(20, -40, 20); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  applyMovementTransform(model, [0], 500, 0, { mode: 'move', space: 'world', axis: 'Z', amount: 5 });
  const nodes = projectMovementNodes(model, 500, 0, camera, 400, 400);
  near(nodes[0].world.z, 5); near(nodes[1].world.z, 5);
  assert.equal(pickMovementNode(nodes, nodes[1].x + 4, nodes[1].y)?.node.ObjectId, 2);
  const handles = movementAxisHandles(nodes[1], camera, 400, 400, 50, 'local');
  assert.deepEqual(handles.map(handle => handle.axis), ['X', 'Y', 'Z']);
  assert.equal(MOVEMENT_GIZMO_SCALE, .25);
  assert.ok(handles.every(handle => Math.hypot(handle.dx, handle.dy) <= 18));
  for (const handle of handles) assert.ok(movementDragAmount(handle, handle.dx, handle.dy, 'rotate') > 0);
  const coincident = [nodes[0], { ...nodes[0], node: model.Bones[1] }];
  assert.equal(pickMovementNode(coincident, nodes[0].x, nodes[0].y, [0]).node.ObjectId, 2);
});

test('free-space resize is uniform unless Shift constrains it to the active workplane', () => {
  const grow = movementFreeScaleValues(20, -20, {}), shrink = movementFreeScaleValues(-20, 20, {});
  assert.ok(grow.every(value => value > 1));
  assert.ok(shrink.every(value => value < 1));
  assert.ok(grow.every(value => value === grow[0]));
  assert.deepEqual(movementFreeScaleValues(20, -20, { workplaneEnabled: true, workplane: 'xy', shiftKey: true }).map(value => value === 1), [false, false, true]);
  assert.ok(movementFreeScaleValues(20, -20, { workplaneEnabled: true, workplane: 'xy', shiftKey: false }).every(value => value > 1));
});

test('selected bone connector colors distinguish its parent and every child', () => {
  const highlights = new Map([[0, '#000000'], [2, '#ff0000'], [3, '#ffff00'], [4, '#ffff00']]);
  const point = ObjectId => ({ node: { ObjectId } });
  assert.equal(boneConnectionAppearance(point(0), point(2), highlights), '#ff0000');
  assert.equal(boneConnectionAppearance(point(2), point(3), highlights), '#ffff00');
  assert.equal(boneConnectionAppearance(point(0), point(5), highlights), null);
});

test('movement workplanes use the requested screen drag direction and normal axis', () => {
  assert.deepEqual(movementWorkplanePointer('xy', 12, 9), [12, 0]);
  assert.deepEqual(movementWorkplanePointer('yz', 12, 9), [12, 0]);
  assert.deepEqual(movementWorkplanePointer('xz', 12, 9), [0, 9]);
  assert.deepEqual(movementWorkplanePointer('zx', 12, 9), [0, 9]);
  assert.deepEqual(['xy', 'xz', 'yz'].map(plane => movementWorkplaneHandle(plane).axis), ['Z', 'Y', 'X']);
});

test('rotate picks an axis bar while move requires its endpoint', () => {
  const handles = [{ axis: 'X', startX: 10, startY: 10, x: 110, y: 10 }];
  assert.equal(pickMovementHandle(handles, 55, 14, 'rotate')?.axis, 'X');
  assert.equal(pickMovementHandle(handles, 55, 14, 'move'), null);
  assert.equal(pickMovementHandle(handles, 106, 14, 'move')?.axis, 'X');
});

test('movement multiselect uses Shift to add and Ctrl to remove', () => {
  assert.deepEqual(movementNodeSelection([1, 2], 3, { multiple: true }), [3]);
  assert.deepEqual(movementNodeSelection([1, 2], 3, { multiple: true, shift: true }), [1, 2, 3]);
  assert.deepEqual(movementNodeSelection([1, 2], 2, { multiple: true, shift: true }), [1, 2]);
  assert.deepEqual(movementNodeSelection([1, 2], 2, { multiple: true, ctrl: true }), [1]);
  assert.deepEqual(movementNodeSelection([1, 2], 3, { multiple: true, ctrl: true }), [1, 2]);
});

test('bone connectors stop outside every rendered marker silhouette', () => {
  const parent = { x: 0, y: 0, overlayKind: 'bones' }, child = { x: 100, y: 0, overlayKind: 'bones' };
  const radius = movementMarkerRadius(parent, 6), line = boneConnectionEndpoints(parent, child, 6);
  assert.ok(radius > 15, 'radius covers a rotated three-dimensional cube');
  assert.equal(line.from.x, radius);
  assert.equal(line.to.x, 100 - radius);
  assert.equal(boneConnectionEndpoints(parent, { ...child, x: radius * 2 - 1 }, 6), null);
});

test('UV fast path accepts UV overlays and rejects topology, material, and node changes', () => {
  const model = createDemoDocument().model, overlay = { ...model, Geosets: model.Geosets.map((geo, i) => i ? geo : { ...geo, TVertices: geo.TVertices.map(uv => new Float32Array(uv)) }) };
  overlay.Geosets[0].TVertices[0][0] += .1;
  assert.equal(isUVOnlyPreviewChange(model, overlay), true);
  assert.equal(isUVOnlyPreviewChange(model, { ...overlay, Materials: [...model.Materials] }), false);
  assert.equal(isUVOnlyPreviewChange(model, { ...overlay, Geosets: overlay.Geosets.map((geo, i) => i ? geo : { ...geo, Faces: new Uint16Array(geo.Faces) }) }), false);
  assert.equal(isUVOnlyPreviewChange(model, { ...overlay, Bones: [...model.Bones] }), false);
});

test('portrait blank drag rotates only the camera until a bone is selected', () => {
  assert.equal(portraitBlankDragRotatesCamera({ portraitMode: true, cameraMode: 'work', workplaneEnabled: false, selectedNodeIds: [] }), true);
  assert.equal(portraitBlankDragRotatesCamera({ portraitMode: true, cameraMode: 'work', workplaneEnabled: false, selectedNodeIds: [2] }), false);
  assert.equal(portraitBlankDragRotatesCamera({ portraitMode: false, cameraMode: 'work', selectedNodeIds: [] }), false);
  assert.equal(portraitBlankDragRotatesCamera({ portraitMode: true, cameraMode: 'rotate', selectedNodeIds: [] }), false);
});

test('bind pose reuses the live renderer and animated updates can overwrite its temporary identity matrices', () => {
  const animated = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 7,8,9,1]);
  const data = { nodes: [null, { matrix: animated }] };
  assert.equal(applyRestPoseMatrices(data, false), false);
  assert.equal(animated[12], 7);
  assert.equal(applyRestPoseMatrices(data, true), true);
  assert.deepEqual([...animated], [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  animated[12] = 5;
  assert.equal(animated[12], 5, 'the next renderer update is free to restore animation');
});

test('preview samples geoset RGB plus geoset and layer alpha at individual sequence frames', () => {
  const model = fixture(); model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Color: track([100, [1, 0, 0]], [1000, [0, 0, 1]]), Alpha: .5 }];
  nearVector(previewGeosetTint(model, 0, { Alpha: .5, FilterMode: 2 }, 550, 0), [.5, 0, .5, .25]);
  nearVector(previewGeosetTint(model, 0, { Alpha: .5, FilterMode: 3 }, 550, 0), [.125, 0, .125, .25]);
  model.GeosetAnims[0].Flags = 0;
  nearVector(previewGeosetTint(model, 0, { Alpha: 1 }, 550, 0), [1, 1, 1, .5]);
});

test('geometry tint adapter targets only mesh fragment shaders, retaining alpha-test and HD version directive', () => {
  const sd = 'precision mediump float;\nuniform mat3 uTVertexAnim;\nuniform float uWireframe;\nvoid main(void) { gl_FragColor = vec4(1.0); if(gl_FragColor.a<.75) discard; }';
  const patched = patchWarcraftMeshFragmentShader(sd);
  assert.ok(patched.includes('uniform vec4 uMdlvisGeosetTint;'));
  assert.ok(patched.indexOf('discard') < patched.indexOf('gl_FragColor *= uMdlvisGeosetTint;'));
  const hd = '#version 300 es\n' + sd.replace('void main', 'out vec4 FragColor;\nvoid main').replaceAll('gl_FragColor', 'FragColor');
  assert.ok(patchWarcraftMeshFragmentShader(hd).startsWith('#version 300 es\n'));
  assert.ok(patchWarcraftMeshFragmentShader(hd).includes('FragColor *= uMdlvisGeosetTint;'));
  const particle = 'precision mediump float; void main(void) {gl_FragColor=vec4(1.0);}';
  assert.equal(patchWarcraftMeshFragmentShader(particle), particle);
});

test('light node markers show the authored RGB at the selected keyframe', () => {
  const model = fixture(), camera = new PerspectiveCamera(40, 1, .1, 1000); camera.position.set(0, -40, 20); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  model.Lights = [{ ObjectId: 5, PivotPoint: [0, 0, 0], Color: track([100, [1, 0, 0]], [1000, [0, 0, 1]]) }];
  assert.equal(projectMovementNodes(model, 550, 0, camera, 400, 400).find(point => point.node.ObjectId === 5).displayColor, 'rgb(128,0,128)');
});
