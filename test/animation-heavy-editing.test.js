import test from 'node:test';
import assert from 'node:assert/strict';
import { serialize } from 'node:v8';
import { createDemoDocument, createNode, EditorDocument, openDocument, validateModel } from '../src/editor-document.js';
import { createChanges, applyChanges } from '../src/history-store.js';

function bakedDocument() {
  const doc = createDemoDocument();
  doc.apply('Baked animation fixture', [], model => {
    const helper = createNode(model, 'Helper'); helper.Parent = 0;
    helper.Translation = { LineType: 1, Keys: Array.from({ length: 10000 }, (_, Frame) => ({ Frame, Vector: new Float32Array([Frame / 1000, 0, 0]) })) };
    helper.Rotation = { LineType: 1, Keys: Array.from({ length: 10000 }, (_, Frame) => ({ Frame, Vector: new Float32Array([0, 0, 0, 1]) })) };
  });
  return openDocument(doc.serialize('mdx'), 'baked.mdx');
}

test('small mesh edits retain baked tracks, exact dirty state and both history directions in compact recovery', () => {
  const doc = bakedDocument(), initial = doc.originalBytes, tracks = structuredClone(doc.model.Helpers);
  const start = doc.model.Geosets[0].Vertices[0];
  doc.apply('Mesh edit with an advisory label', ['Materials'], model => { model.Geosets[0].Vertices[0] += .125; });
  assert.deepEqual(doc.saveImpact().changedSections, ['Geosets']);
  const snapshot = doc.captureRecoveryState({ compact: true });
  assert.equal(snapshot.version, 2); assert.equal(snapshot.model, undefined); assert.equal(snapshot.savedModel, undefined);
  assert.ok(snapshot.modelChanges.every(change => change.path[0] === 'Geosets'));
  assert.ok(serialize(snapshot).length < serialize(doc.captureRecoveryState()).length / 4);
  const recovered = EditorDocument.restoreRecoveryState(snapshot);
  assert.deepEqual(recovered.model, doc.model); assert.deepEqual(recovered.model.Helpers, tracks);
  assert.equal(recovered.model.Nodes[0], recovered.model.Bones[0]);
  assert.equal(recovered.model.Nodes[0].PivotPoint, recovered.model.PivotPoints[0]);
  assert.equal(recovered.dirty, true); recovered.undo(); assert.equal(recovered.dirty, false);
  assert.deepEqual(recovered.serialize('mdx'), initial);
  recovered.redo(); assert.equal(recovered.model.Geosets[0].Vertices[0], start + .125);
  recovered.apply('Move back without undo', ['Geosets'], model => { model.Geosets[0].Vertices[0] = start; });
  assert.equal(recovered.dirty, false);
  assert.deepEqual(recovered.model.Helpers, tracks);
  snapshot.originalBytes[0] = 0;
  assert.deepEqual(doc.originalBytes, initial, 'compact snapshots are detached');
});

test('compact recovery preserves a saved semantic baseline and a newer edit during asynchronous save', () => {
  const doc = createDemoDocument();
  doc.apply('Layer alpha', [], model => { model.Materials[0].Layers[0].Alpha = .4; });
  const saved = doc.serialize('mdx');
  doc.apply('Newer mesh edit', [], model => { model.Geosets[0].Vertices[0] += 3; });
  doc.markSaved(saved, 'saved.mdx');
  const expected = structuredClone(doc.model), restored = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ compact: true }));
  assert.deepEqual(restored.model, expected); assert.deepEqual(restored._savedModel, doc._savedModel);
  assert.equal(restored.dirty, true); restored.undo(); assert.equal(restored.dirty, false);
  assert.deepEqual(restored.serialize(), saved);
  restored.undo(); assert.equal(restored.dirty, true); restored.redo(); assert.equal(restored.dirty, false);
  restored.redo(); assert.deepEqual(restored.model, expected);
});

test('legacy recovery can be checkpointed compactly and direct staged model replacement is fully discovered', () => {
  const doc = createDemoDocument();
  doc.apply('Pivot', [], model => { model.PivotPoints[0][0] = 14; });
  const legacy = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
  legacy.model = structuredClone(legacy.model);
  legacy.model.Textures[0].Flags ^= 1;
  assert.equal(legacy.dirty, true);
  const restored = EditorDocument.restoreRecoveryState(legacy.captureRecoveryState({ compact: true }));
  assert.deepEqual(restored.model, legacy.model);
  assert.deepEqual(restored.saveImpact().changedSections.sort(), ['PivotPoints', 'Textures']);
});

test('compact checkpoints retain in-place drafts outside committed sections', () => {
  const doc = createDemoDocument();
  doc.dirty;
  doc.apply('Committed geometry', ['Geosets'], model => { model.Geosets[0].Vertices[0] += .125; });
  doc.model.Bones[0].Translation.Keys[0].Vector[0] += 3;
  const recovered = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ compact: true }));
  assert.deepEqual(recovered.model, doc.model);
  const initial = openDocument(doc.originalBytes, doc.name);
  initial.model.Info.Name = 'Uncommitted initial name';
  assert.equal(initial.dirty, true);
});

test('edit scope never hides malformed tracks, tangent values or global sequence dependencies', () => {
  const doc = createDemoDocument();
  doc.apply('Prime diagnostic cache', [], model => { model.Geosets[0].Vertices[0] += .125; });
  const initial = structuredClone(doc.model), revision = doc.revision;
  assert.throws(() => doc.apply('Unrelated track mutation', ['Geosets'], model => {
    model.Bones[0].Translation.Keys[0].Vector[0] = NaN;
  }), /non-finite/);
  assert.deepEqual(doc.model, initial); assert.equal(doc.revision, revision);
  doc.apply('Add valid global spline', [], model => {
    model.GlobalSequences.push(1000);
    model.Bones[0].Translation = { GlobalSeqId: 0, LineType: 2, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]), InTan: new Float32Array([0, 0, 0]), OutTan: new Float32Array([0, 0, 0]) }] };
  });
  assert.throws(() => doc.apply('Bad tangent', ['Geosets'], model => { model.Bones[0].Translation.Keys[0].OutTan[1] = Infinity; }), /non-finite/);
  assert.throws(() => doc.apply('Remove used global sequence', ['GlobalSequences'], model => { model.GlobalSequences.pop(); }), /global sequence/);
  assert.deepEqual(validateModel(doc.model).filter(issue => issue.severity === 'error'), []);
});

test('compact recovery rejects corrupt deltas and invalid reconstructed data', () => {
  const doc = createDemoDocument();
  doc.apply('Name', [], model => { model.Info.Name = 'Changed'; });
  const snapshot = doc.captureRecoveryState({ compact: true });
  const invalid = structuredClone(snapshot);
  invalid.modelChanges[0].path = ['__proto__', 'polluted'];
  assert.throws(() => EditorDocument.restoreRecoveryState(invalid), /history path/);
  assert.equal({}.polluted, undefined);
  snapshot.modelChanges.push({ kind: 'value', path: ['Geosets', '0', 'Vertices'], beforeExists: true, afterExists: true, before: doc.model.Geosets[0].Vertices, after: new Float32Array(doc.model.Geosets[0].Vertices).fill(NaN) });
  assert.throws(() => EditorDocument.restoreRecoveryState(snapshot), /invalid/);
});

test('history keyframe comparisons retain signed zero, NaN payloads, holes and named array properties', () => {
  const before = { Keys: [{ Frame: 0, Vector: new Float32Array([0, 1, 2]) }] }, after = structuredClone(before);
  after.Keys[0].Vector[0] = -0;
  let changes = createChanges(before, after);
  assert.equal(changes.length, 1); applyChanges(before, changes); assert.deepEqual(before, after);
  const one = new Float32Array(new Uint32Array([0x7fc00001]).buffer), two = new Float32Array(new Uint32Array([0x7fc00002]).buffer);
  assert.equal(createChanges({ Keys: [{ Vector: one }] }, { Keys: [{ Vector: two }] }).length, 1);
  const sparse = { Keys: new Array(2) }, named = { Keys: new Array(2) }; named.Keys.extra = 1;
  changes = createChanges(sparse, named); applyChanges(sparse, changes); assert.deepEqual(sparse, named);
});
