import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { scanMotion, motionPose, setMotionPose, motionSnapshot, rotationDistance } from '../src/motion-inspector.js';
import { motionModelKey, motionSignature, motionDecisionStore } from '../src/motion-decisions.js';
import { applyMovementTransform, deleteMovementKeys, sampleMovement } from '../src/movement.js';
import { sampleNodeMatrices } from '../src/animation.js';
import { previewPlaybackStep } from '../app/game-preview-capture.js';

const rotation = degrees => new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), degrees * Math.PI / 180).toArray();
const track = (pairs, LineType = 1) => ({ LineType, Keys: pairs.map(([Frame, Vector]) => ({ Frame, Vector: new Float32Array(Vector) })) });
function fixture() {
  return { Nodes: [
    { ObjectId: 0, Name: 'Chest', PivotPoint: [0, 0, 0] },
    { ObjectId: 1, Name: 'Arm', Parent: 0, PivotPoint: [0, 0, 0], Rotation: track([0, 200, 400, 600, 800, 850, 1000].map(t => [t, rotation(t >= 850 ? 90 : 0)])) },
    { ObjectId: 2, Name: 'Sword', Parent: 1, PivotPoint: [10, 0, 0] },
    { ObjectId: 3, Name: 'Other', PivotPoint: [0, 0, 0] },
  ], Sequences: [{ Name: 'Attack', Interval: [0, 1000] }, { Name: 'Stand', Interval: [2000, 3000] }], GlobalSequences: [], Info: { BoundsRadius: 20 } };
}
const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
async function holding(model) { const f = scanMotion(model).findings.find(f => f.kind === 'holding-keys'); assert.ok(f); return { ...f, signature: await motionSignature(f) }; }

test('holding keys and compressed transition are one hint with actual times and angles', () => {
  const model = fixture(), before = structuredClone(model), result = scanMotion(model);
  const finding = result.findings.find(f => f.kind === 'holding-keys');
  assert.deepEqual(finding.keyTimes, [0, 200, 400, 600, 800, 850]);
  assert.deepEqual([finding.start, finding.end, finding.time], [0, 850, 800]);
  assert.deepEqual(finding.targets, [{ role: 'hold', time: 800, keyTimes: [200, 400, 600, 800] }]);
  assert.match(finding.explanation, /4 intermediate keys/); assert.match(finding.explanation, /final 50 ms/);
  assert.match(finding.explanation, /Interpolation still operates/); assert.match(finding.evidence, /90°.*1800°\/s/);
  assert.deepEqual(model, before);
});

test('holding selection frees the transition while preserving both intended poses', () => {
  const model = fixture(), node = model.Nodes[1], finding = scanMotion(model).findings.find(f => f.kind === 'holding-keys');
  const first = structuredClone(node.Rotation.Keys[0]), destination = structuredClone(node.Rotation.Keys.find(k => k.Frame === 850));
  assert.ok(rotationDistance(sampleMovement(model, node, 'Rotation', 400, 0), first.Vector) < .001);
  for (const time of finding.targets[0].keyTimes) deleteMovementKeys(model, [node.ObjectId], time, 0, 'rotate');
  assert.deepEqual(node.Rotation.Keys, [first, destination, { Frame: 1000, Vector: new Float32Array(rotation(90)) }]);
  assert.ok(rotationDistance(sampleMovement(model, node, 'Rotation', 400, 0), first.Vector) > 40, 'The real evaluator now moves during the previously held interval');
});

test('inherited sword jerk is observed in model space, not blamed on clean local tracks', () => {
  const findings = scanMotion(fixture(), { nodeIds: [2] }).findings;
  assert.ok(findings.some(f => f.nodeId === 1 && f.kind === 'holding-keys'));
  const sword = findings.filter(f => f.nodeId === 2);
  assert.ok(sword.some(f => f.property === 'Translation'));
  assert.ok(sword.every(f => f.space === 'model' && /not proof/.test(f.explanation)));
  assert.deepEqual(sword[0].chain.map(n => n.name), ['Sword', 'Arm', 'Chest']);
  assert.ok(!findings.some(f => f.nodeId === 3));
  const model = fixture(); model.Nodes[2].Flags = 2;
  assert.ok(!scanMotion(model).findings.some(f => f.nodeId === 2 && f.property === 'Rotation'));
});

test('smooth dense motion, holds alone and equivalent quaternion signs do not produce spikes', () => {
  for (const moving of [false, true]) {
    const model = fixture();
    model.Nodes[1].Rotation = track(Array.from({ length: 101 }, (_, i) => [i * 10, rotation(moving ? i * .9 : 30).map(v => i % 2 ? -v : v)]));
    assert.deepEqual(scanMotion(model).findings, []);
  }
  assert.ok(rotationDistance(rotation(90), rotation(90).map(v => -v)) < 1e-5);
});

test('only active sequence keys are sampled; boundary jumps to other animations are not warnings', () => {
  const model = fixture(); model.Nodes[1].Rotation = track([[0, rotation(0)], [1000, rotation(5)], [1001, rotation(170)], [2000, rotation(-90)]]);
  assert.deepEqual(scanMotion(model).findings, []);
});

test('severe translation spikes, abrupt changes, steps and short extreme curve excursions', () => {
  const model = fixture(); delete model.Nodes[1].Rotation;
  const node = model.Nodes[1];
  node.Translation = track([[0, [0, 0, 0]], [500, [0, 0, 0]], [550, [10, 0, 0]], [600, [0, 0, 0]], [1000, [0, 0, 0]]]);
  assert.ok(scanMotion(model).findings.some(f => f.kind === 'pose-spike' && f.property === 'Translation'));
  node.Translation = track([[0, [0, 0, 0]], [800, [0, 0, 0]], [850, [10, 0, 0]], [1000, [10, 0, 0]]]);
  assert.ok(scanMotion(model).findings.some(f => f.kind === 'abrupt-change'));
  node.Translation = track([[0, [0, 0, 0]], [500, [1, 0, 0]], [1000, [30, 0, 0]]]);
  assert.deepEqual(scanMotion(model).findings, [], 'A speed increase over half a second is not a snap');
  node.Translation.LineType = 0;
  assert.ok(scanMotion(model).findings.some(f => f.kind === 'step'));
  node.Translation = track([[0, [0, 0, 0]], [1000, [0, 0, 0]]], 3);
  for (const key of node.Translation.Keys) { key.InTan = [30, 0, 0]; key.OutTan = [30, 0, 0]; }
  assert.deepEqual(scanMotion(model).findings, [], 'A broad animated arc is not a sudden jump');
  node.Translation.Keys[1].Frame = 50;
  assert.ok(scanMotion(model).findings.some(f => f.kind === 'curve-overshoot'));
  // Same endpoints are not a hold if their curve leaves the pose in between.
  node.Rotation = undefined;
  node.Translation = track([0, 200, 400, 600, 800, 850].map(t => [t, [t === 850 ? 10 : 0, 0, 0]]), 3);
  for (const key of node.Translation.Keys) { key.InTan = [20, 0, 0]; key.OutTan = [20, 0, 0]; }
  assert.ok(!scanMotion(model).findings.some(f => f.kind === 'holding-keys'));
});

test('ordinary fast walking, attack swings, small deviations and starts/stops remain quiet', () => {
  for (const pairs of [
    [[0,0],[200,0],[233,61],[267,90],[500,0],[1000,0]],
    [[0,0],[300,0],[500,140],[700,0],[1000,0]],
    [[0,0],[300,2],[333,22],[366,2],[1000,0]],
    [[0,0],[200,0],[400,0],[600,0],[800,0],[850,15],[1000,15]],
  ]) {
    const model = fixture(); model.Nodes = model.Nodes.slice(0, 2);
    model.Nodes[1].Rotation = track(pairs.map(([t, angle]) => [t, rotation(angle)]));
    assert.deepEqual(scanMotion(model).findings, []);
  }
});

test('one stray pose surrounded by repeated holds is distinct from a minor speed deviation', () => {
  const model = fixture(); model.Nodes = model.Nodes.slice(0, 2);
  model.Sequences[0] = { Name: 'Any animation name', Interval: [245000,246200] };
  const times = [245000,245224,245377,245472,245690,245853,245997,246200];
  model.Nodes[1].Rotation = track(times.map(t => [t, rotation(t === 245377 ? 8 : 0)]));
  const findings = scanMotion(model).findings;
  assert.equal(findings.length, 1); assert.equal(findings[0].kind, 'pose-spike');
  assert.equal(findings[0].time, 245377); assert.match(findings[0].explanation, /surrounding intervals hold the same pose/);
  assert.deepEqual(findings[0].targets, [{ role: 'surrounding-holds', time: 245224, keyTimes: [245224, 245472, 245690, 245853, 245997], returnTime: 245472, preserveTime: 245377 }]);
  model.Nodes[1].Rotation.Keys[2].Vector = new Float32Array(rotation(2));
  assert.deepEqual(scanMotion(model).findings, [], 'A tiny stray adjustment is below the warning threshold');
});

test('selecting surrounding holds preserves the changed pose and lengthens its approach and return', () => {
  const model = fixture(); model.Nodes = model.Nodes.slice(0, 2);
  model.Nodes[1].Rotation = track([[0, rotation(0)], [224, rotation(0)], [377, rotation(8)], [472, rotation(0)], [690, rotation(0)], [1000, rotation(0)]]);
  const node = model.Nodes[1], finding = scanMotion(model).findings.find(f => f.kind === 'pose-spike');
  const intended = structuredClone(node.Rotation.Keys.find(k => k.Frame === finding.time));
  assert.ok(rotationDistance(sampleMovement(model, node, 'Rotation', 100, 0), rotation(0)) < .001);
  for (const frame of finding.targets[0].keyTimes) deleteMovementKeys(model, [node.ObjectId], frame, 0, 'rotate');
  assert.deepEqual(node.Rotation.Keys.map(k => k.Frame), [0, 377, 1000]);
  assert.deepEqual(node.Rotation.Keys.find(k => k.Frame === finding.time), intended);
  assert.ok(rotationDistance(sampleMovement(model, node, 'Rotation', 100, 0), rotation(0)) > 2);
  assert.ok(rotationDistance(sampleMovement(model, node, 'Rotation', 377, 0), intended.Vector) < .001);
  assert.ok(rotationDistance(sampleMovement(model, node, 'Rotation', 500, 0), rotation(0)) > 6, 'Return is spread out instead of immediately pulling back');
});

test('a near-instant left-to-right rotation is caught without repeated holding keys', () => {
  const model = fixture(); model.Nodes = model.Nodes.slice(0, 2);
  model.Nodes[1].Rotation = track([[0, rotation(-80)], [500, rotation(-80)], [533, rotation(80)], [1000, rotation(80)]]);
  assert.ok(scanMotion(model).findings.some(f => f.kind === 'abrupt-change' && f.time === 533));
});

test('Desired persists across scans/reopen/save aliases, restores and reconsiders relevant changes', async () => {
  const model = fixture(), storage = memoryStorage(), bytes = new TextEncoder().encode('model A');
  const key = await motionModelKey(bytes, 'C:/Models/arm.mdx', 'arm.mdx'), store = motionDecisionStore(storage, key), finding = await holding(model);
  store.mark(finding, true);
  assert.ok(motionDecisionStore(storage, key).desired()[(await holding(model)).signature]);
  model.Nodes[3].Translation = track([[0, [1, 2, 3]], [1000, [7, 8, 9]]]);
  assert.ok(store.desired()[(await holding(model)).signature]);
  model.Nodes[1].Rotation.Keys.push({ Frame: 2000, Vector: new Float32Array(rotation(170)) });
  assert.ok(store.desired()[(await holding(model)).signature]);
  model.Nodes[1].Rotation.Keys.find(k => k.Frame === 1000).Vector = new Float32Array(rotation(110));
  assert.ok(store.desired()[(await holding(model)).signature], 'Keys after the highlighted interval do not change this hold');
  const savedKey = await motionModelKey(new TextEncoder().encode('model A after unrelated edits'), 'C:/Models/arm.mdx', 'arm.mdx');
  store.alias(savedKey); assert.ok(motionDecisionStore(storage, savedKey).desired()[finding.signature]);
  const different = await motionModelKey(new TextEncoder().encode('model B'), 'C:/Models/arm.mdx', 'arm.mdx');
  assert.deepEqual(motionDecisionStore(storage, different).desired(), {});
  const otherPath = await motionModelKey(bytes, 'C:/Elsewhere/arm.mdx', 'arm.mdx');
  assert.deepEqual(motionDecisionStore(storage, otherPath).desired(), {});
  model.Nodes[1].Rotation.Keys.find(k => k.Frame === 850).Vector = new Float32Array(rotation(70));
  assert.ok(!store.desired()[(await holding(model)).signature]);
  store.mark(finding, false); assert.deepEqual(store.desired(), {});
});

test('Desired fingerprints include curve controls and hierarchy, and ignore equivalent rotations', async () => {
  const model = fixture(), before = await holding(model);
  model.Sequences[0].Name = 'Another animation with the same times';
  assert.notEqual((await holding(model)).signature, before.signature);
  model.Sequences[0].Name = 'Attack';
  model.Nodes[1].Rotation.Keys.forEach(key => { key.Vector = key.Vector.map(v => -v); });
  assert.equal((await holding(model)).signature, before.signature);
  const world = scanMotion(model).findings.find(f => f.nodeId === 2), worldSignature = await motionSignature(world);
  model.Nodes[0].Translation = track([[0, [0, 0, 0]], [850, [1, 0, 0]]]);
  assert.notEqual(await motionSignature(scanMotion(model).findings.find(f => f.nodeId === 2)), worldSignature);
});

test('numeric pose and visual rotation edit the same key; undo/redo restore only animation edits', () => {
  const doc = createDemoDocument(), id = doc.model.Bones[0].ObjectId;
  const beforeMesh = structuredClone(doc.model.Geosets), pivots = structuredClone(doc.model.PivotPoints), translation = structuredClone(doc.model.Bones[0].Translation);
  doc.apply('Numeric rotation', ['Nodes'], m => setMotionPose(m, id, 'Rotation', 1000, 0, [0, 0, 30]));
  assert.ok(Math.abs(motionPose(doc.model, id, 'Rotation', 1000, 0).display[2] - 30) < 1e-4);
  doc.apply('Visual rotation', ['Nodes'], m => applyMovementTransform(m, [id], 1000, 0, { mode: 'rotate', axis: 'Z', amount: 15 }));
  assert.ok(Math.abs(motionPose(doc.model, id, 'Rotation', 1000, 0).display[2] - 45) < 1e-4);
  const q = new Quaternion(); sampleNodeMatrices(doc.model, 1000, 0).get(id).decompose(new Vector3(), q, new Vector3());
  assert.ok(rotationDistance(q.toArray(), rotation(45)) < 1e-4);
  assert.equal(doc.model.Bones[0].Rotation.Keys.length, 3);
  doc.undo(); assert.ok(Math.abs(motionPose(doc.model, id, 'Rotation', 1000, 0).display[2] - 30) < 1e-4);
  doc.redo(); assert.ok(Math.abs(motionPose(doc.model, id, 'Rotation', 1000, 0).display[2] - 45) < 1e-4);
  assert.deepEqual(doc.model.Geosets, beforeMesh); assert.deepEqual(doc.model.PivotPoints, pivots); assert.deepEqual(doc.model.Bones[0].Translation, translation);
  assert.equal(motionPose(doc.model, id, 'Rotation', 1250, 0).key, undefined);
  doc.apply('Create one key', ['Nodes'], m => setMotionPose(m, id, 'Rotation', 1250, 0, [10, 20, 30]));
  assert.equal(doc.model.Bones[0].Rotation.Keys.length, 4);
  doc.apply('Delete inspected key', ['Nodes'], m => deleteMovementKeys(m, [id], 1250, 0, 'rotate'));
  doc.undo(); assert.ok(motionPose(doc.model, id, 'Rotation', 1250, 0).key);
});

test('scan, selection, Desired and restore leave MDL/MDX output, dirty state, history and model identical', async () => {
  for (const format of ['mdl', 'mdx']) {
    const source = createDemoDocument();
    source.apply('Synthetic holding keys', ['Nodes'], m => { m.Bones[0].Rotation = fixture().Nodes[1].Rotation; });
    const doc = openDocument(source.serialize(format), `fixture.${format}`), beforeModel = structuredClone(doc.model), before = doc.serialize(format), beforeOther = doc.serialize(format === 'mdl' ? 'mdx' : 'mdl');
    const revision = doc.revision, dirty = doc.dirty, undo = doc.canUndo;
    const result = scanMotion(motionSnapshot(doc.model));
    const finding = result.findings.find(f => f.kind === 'holding-keys'); finding.signature = await motionSignature(finding);
    motionPose(doc.model, finding.nodeId, finding.property, finding.time, 0);
    const store = motionDecisionStore(memoryStorage(), await motionModelKey(before, 'fixture', 'fixture'));
    store.mark(finding, true); store.mark(finding, false);
    assert.deepEqual(doc.serialize(format), before); assert.deepEqual(doc.serialize(format === 'mdl' ? 'mdx' : 'mdl'), beforeOther);
    assert.deepEqual(doc.model, beforeModel); assert.equal(doc.revision, revision); assert.equal(doc.dirty, dirty); assert.equal(doc.canUndo, undo);
  }
});

test('position and scale fields share the visual tools and preserve other channels', () => {
  const doc = createDemoDocument(), id = doc.model.Bones[0].ObjectId, rotationBefore = structuredClone(doc.model.Bones[0].Rotation);
  doc.apply('Position key', ['Nodes'], m => setMotionPose(m, id, 'Translation', 800, 0, [7, 8, 9]));
  doc.apply('Visual move', ['Nodes'], m => applyMovementTransform(m, [id], 800, 0, { mode: 'move', space: 'world', values: [1, 2, 3] }));
  assert.deepEqual(motionPose(doc.model, id, 'Translation', 800, 0).display, [8, 10, 12]);
  doc.apply('Scale key', ['Nodes'], m => setMotionPose(m, id, 'Scaling', 800, 0, [2, 3, 4]));
  doc.apply('Visual scale', ['Nodes'], m => applyMovementTransform(m, [id], 800, 0, { mode: 'scale', values: [2, 1, .5] }));
  assert.deepEqual(motionPose(doc.model, id, 'Scaling', 800, 0).display, [4, 3, 2]);
  assert.deepEqual(doc.model.Bones[0].Rotation, rotationBefore);
  assert.throws(() => doc.apply('Invalid scale', ['Nodes'], m => setMotionPose(m, id, 'Scaling', 800, 0, [0, 1, 1])), /zero/);
  assert.deepEqual(motionPose(doc.model, id, 'Scaling', 800, 0).display, [4, 3, 2]);
});

test('global channels are explicit inspection-only; scan budgets report incomplete sampling', () => {
  const model = fixture(); model.GlobalSequences = [1000]; model.Nodes[1].Rotation.GlobalSeqId = 0;
  assert.ok(motionPose(model, 1, 'Rotation', 500, 0).shared);
  assert.throws(() => setMotionPose(model, 1, 'Rotation', 500, 0, [0, 0, 1]), /Shared global/);
  const result = scanMotion(model, { maxWorldSamples: 5 });
  assert.ok(result.notes.some(note => /stopped/.test(note))); assert.ok(result.notes.some(note => /global/.test(note)));
});

test('focused playback wraps only the requested section, without changing sequence evaluation', () => {
  assert.equal(previewPlaybackStep([700, 950], 940, 40).frame, 730);
  assert.equal(previewPlaybackStep([700, 950], 940, 40, false).frame, 700);
  const model = fixture(), before = structuredClone(model.Sequences);
  motionPose(model, 1, 'Rotation', 825, 0);
  assert.deepEqual(model.Sequences, before);
});

test('dense constant tracks complete with bounded world sampling', () => {
  const model = fixture(); model.Nodes = model.Nodes.slice(0, 2);
  model.Nodes[1].Rotation = track(Array.from({ length: 5001 }, (_, i) => [i, rotation(10)]));
  model.Sequences[0].Interval = [0, 5000];
  const start = performance.now(), result = scanMotion(model, { maxWorldSamples: 1000 });
  assert.deepEqual(result.findings, []); assert.ok(result.stats.worldSamples <= 1000);
  assert.ok(performance.now() - start < 5000, 'Dense hold scan must not become quadratic');
});
