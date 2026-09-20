import test from 'node:test';
import assert from 'node:assert/strict';
import { serialize, deserialize } from 'node:v8';
import { createChanges, applyChanges, HistoryStore } from '../src/history-store.js';
import { EditorDocument, createDemoDocument, createNode, deleteNode, duplicateGeoset, deleteGeoset } from '../src/editor-document.js';

test('1,500 mesh nudges undo and redo exactly without retaining 1,500 full models', () => {
  const doc = createDemoDocument();
  const initial = doc.serialize(), before = doc.model.Geosets[0].Vertices.slice();
  const mesh = doc.model.Geosets[0], stableVertices = mesh.Vertices;
  for (let i = 0; i < 1500; i++) doc.apply(`Move vertex ${i + 1}`, ['Geosets'], () => { mesh.Vertices[0] += 0.125; });
  assert.equal(doc.historyStats.undoSteps, 1500);
  assert.equal(doc.historyStats.undoLabel, 'Move vertex 1500');
  assert.equal(doc.historyStats.budgetBytes, 512 * 1024 * 1024);
  assert.equal(doc.historyStats.maxSteps, 10000);
  assert.ok(doc.historyStats.usedBytes < 3 * 1024 * 1024, `Delta cache used ${doc.historyStats.usedBytes} bytes`);
  assert.equal(doc.model.Geosets[0].Vertices, stableVertices);
  for (let i = 1499; i >= 0; i--) {
    assert.equal(doc.undo(), true);
    assert.equal(doc.model.Geosets[0].Vertices[0], before[0] + i * 0.125);
  }
  assert.equal(doc.canUndo, false);
  assert.equal(doc.dirty, false);
  assert.deepEqual(doc.serialize(), initial);
  assert.equal(doc.historyStats.redoSteps, 1500);
  for (let i = 1; i <= 1500; i++) {
    assert.equal(doc.redo(), true);
    assert.equal(doc.model.Geosets[0].Vertices[0], before[0] + i * 0.125);
  }
  assert.equal(doc.canRedo, false);
  assert.equal(doc.model.Geosets[0].Vertices, stableVertices);
});

test('mixed mesh topology, materials, textures, node creation/deletion, pivots and tracks all reverse', () => {
  const doc = createDemoDocument(), states = [structuredClone(doc.model)];
  const edit = (name, fn) => { doc.apply(name, [], fn); states.push(structuredClone(doc.model)); };
  edit('Material and texture', (m) => { m.Materials[0].Layers[0].FilterMode = 5; m.Textures[0].Image = 'Textures\\Replacement.blp'; });
  edit('Add layer', (m) => { m.Materials[0].Layers.push({ ...m.Materials[0].Layers[0], Alpha: 0.3 }); });
  edit('Create helper', (m) => { const node = createNode(m, 'Helper'); node.Parent = 0; node.PivotPoint = new Float32Array([13, 2, 9]); });
  const helperId = doc.model.Helpers[0].ObjectId;
  edit('Node keyframe and pivot', (m) => { m.Nodes[helperId].Translation = { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([1, 0, 0]) }] }; m.PivotPoints[0][1] = 8; });
  edit('Duplicate geometry', (m) => { duplicateGeoset(m, 0); });
  edit('Remove original geometry', (m) => { deleteGeoset(m, 0); });
  edit('Remove helper', (m) => { deleteNode(m, helperId); });
  for (let i = states.length - 2; i >= 0; i--) {
    assert.equal(doc.undo(), true); assert.deepEqual(doc.model, states[i]);
    for (const node of doc.model.Nodes.filter(Boolean)) assert.equal(node.PivotPoint, doc.model.PivotPoints[node.ObjectId]);
    assert.equal(doc.model.Nodes[0], doc.model.Bones[0]);
  }
  for (let i = 1; i < states.length; i++) { assert.equal(doc.redo(), true); assert.deepEqual(doc.model, states[i]); }
});

test('failed, asynchronous, nested and no-op edits leave the previous undo/redo branch intact', () => {
  const doc = createDemoDocument();
  doc.apply('First', ['Info'], (m) => { m.Info.Name = 'First'; });
  doc.apply('Second', ['Info'], (m) => { m.Info.Name = 'Second'; });
  doc.undo();
  const before = structuredClone(doc.model), stats = doc.historyStats, revision = doc.revision;
  assert.throws(() => doc.apply('Invalid', [], (m) => { m.Info.Name = 'Bad'; m.Geosets[0].MaterialID = 999; }), /missing material/);
  assert.throws(() => doc.apply('Thrown', [], (m) => { m.Geosets = []; throw new Error('Interrupted edit'); }), /Interrupted/);
  assert.throws(() => doc.apply('Async', [], (m) => { m.Info.Name = 'Async'; return Promise.resolve(); }), /synchronous/);
  assert.throws(() => doc.apply('Nested', [], () => { doc.apply('Inner', [], () => {}); }), /Nested/);
  assert.throws(() => doc.apply('Undo within edit', [], () => { doc.undo(); }), /inside/);
  assert.equal(doc.apply('No change', [], () => {}), false);
  assert.deepEqual(doc.model, before); assert.deepEqual(doc.historyStats, stats); assert.equal(doc.revision, revision);
  doc.apply('New branch', [], (m) => { m.Info.Name = 'Branched'; });
  assert.equal(doc.canRedo, false);
  assert.equal(doc.historyStats.undoSteps, 2);
  assert.equal(doc.historyStats.undoLabel, 'New branch');
});

test('cache step and byte caps evict oldest states and keep reachable undo/redo chains', () => {
  const doc = createDemoDocument(), start = doc.model.Geosets[0].Vertices[0];
  doc.configureHistory({ maxSteps: 3, budgetBytes: 4096 });
  for (let i = 0; i < 10; i++) doc.apply(`Step ${i}`, [], (m) => { m.Geosets[0].Vertices[0] += 1; });
  assert.equal(doc.historyStats.undoSteps, 3); assert.equal(doc.historyStats.evictedSteps, 7);
  assert.ok(doc.historyStats.usedBytes <= 4096);
  for (let i = 0; i < 3; i++) assert.equal(doc.undo(), true);
  assert.equal(doc.model.Geosets[0].Vertices[0], start + 7);
  assert.equal(doc.undo(), false);
  doc.configureHistory({ maxSteps: 2 });
  assert.equal(doc.redo(), true); assert.equal(doc.model.Geosets[0].Vertices[0], start + 8);
  assert.equal(doc.redo(), true); assert.equal(doc.model.Geosets[0].Vertices[0], start + 9);
  assert.equal(doc.redo(), false);
  doc.configureHistory({ budgetBytes: 1 });
  assert.equal(doc.historyStats.usedBytes, 0); assert.equal(doc.canUndo, false);
  doc.apply('Too large for user limit', [], (m) => { m.Info.Name = 'Changed'; });
  assert.equal(doc.model.Info.Name, 'Changed'); assert.equal(doc.historyStats.lastEntryRetained, false);
});

test('binary recovery restores dirty data, unknown bytes, aliases and both history directions', () => {
  const doc = createDemoDocument();
  doc.apply('First material edit', [], (m) => { m.Materials[0].Layers[0].Alpha = 0.4; });
  const saved = doc.serialize('mdx'); doc.markSaved(saved, 'Recovered.mdx');
  doc.apply('Unsaved pivot', [], (m) => { m.Nodes[0].PivotPoint[2] = 14; });
  doc.apply('Unsaved geometry', [], (m) => { m.Geosets[0].Vertices[0] += 5; });
  doc.undo();
  const diskPayload = serialize(doc.captureRecoveryState());
  const restored = EditorDocument.restoreRecoveryState(deserialize(diskPayload));
  assert.deepEqual(restored.model, doc.model); assert.equal(restored.dirty, true);
  assert.deepEqual(restored.originalBytes, saved); assert.deepEqual(restored.historyStats, doc.historyStats);
  assert.equal(restored.model.Nodes[0], restored.model.Bones[0]);
  assert.equal(restored.model.Nodes[0].PivotPoint, restored.model.PivotPoints[0]);
  assert.equal(restored.redo(), true); assert.equal(restored.model.Geosets[0].Vertices[0], doc.model.Geosets[0].Vertices[0] + 5);
  restored.undo(); restored.undo(); assert.equal(restored.dirty, false);
  assert.deepEqual(restored.serialize(), saved);
  restored.undo(); assert.equal(restored.dirty, true);
  restored.redo(); assert.equal(restored.dirty, false);
  restored.apply('After recovery', [], (m) => { m.Textures[0].Image = 'Other.blp'; });
  assert.equal(restored.historyStats.redoSteps, 0);
});

test('recovery snapshots are detached, optional history is omitted and malformed state is rejected', () => {
  const doc = createDemoDocument();
  doc.apply('Change name', [], (m) => { m.Info.Name = 'Changed'; });
  const snapshot = doc.captureRecoveryState({ includeHistory: false });
  assert.equal(snapshot.history, null);
  const restored = EditorDocument.restoreRecoveryState(snapshot);
  assert.equal(restored.canUndo, false); assert.equal(restored.dirty, true);
  snapshot.model.Info.Name = 'Damaged'; assert.equal(doc.model.Info.Name, 'Changed');
  snapshot.model.Geosets[0].Vertices[0] = NaN;
  assert.throws(() => EditorDocument.restoreRecoveryState(snapshot), /invalid/);
  const unsafe = doc.captureRecoveryState();
  unsafe.history.undoEntries[0].changes[0].path = ['__proto__', 'polluted'];
  assert.throws(() => EditorDocument.restoreRecoveryState(unsafe), /history path/);
  assert.equal({}.polluted, undefined);
});

test('typed-array patches preserve byte details, changed lengths and do not copy untouched geometry', () => {
  const before = { geometry: new Float32Array(250000), material: { opacity: 1 }, indices: new Uint16Array([0, 1, 2]) };
  const after = structuredClone(before); after.geometry[200001] = -0; after.geometry[3] = 2; after.material.opacity = 0.3;
  const changes = createChanges(before, after);
  const geometryChanges = changes.filter((c) => c.path[0] === 'geometry');
  assert.equal(geometryChanges.length, 2);
  assert.ok(geometryChanges.every((c) => c.kind === 'bytes' && c.before.byteLength <= 4));
  const target = structuredClone(before); applyChanges(target, changes); assert.deepEqual(target, after);
  applyChanges(target, changes, 'before'); assert.deepEqual(target, before);
  const longer = { ...after, indices: new Uint16Array([0, 1, 2, 2, 3, 0]) };
  const changeLength = createChanges(after, longer); applyChanges(target, changes); applyChanges(target, changeLength);
  assert.deepEqual(target, longer); applyChanges(target, changeLength, 'before'); assert.deepEqual(target, after);
});

test('invalid history operations cannot partially write or consume an undo entry', () => {
  const model = { good: 0, bytes: new Uint8Array([1]) }, history = new HistoryStore();
  const changes = [{ kind: 'value', path: ['good'], beforeExists: true, afterExists: true, before: 0, after: 8 },
    { kind: 'bytes', path: ['bytes'], offset: 9, before: new Uint8Array([0]), after: new Uint8Array([1]) }];
  history.push({ label: 'Malformed recovered step', sections: [], changes });
  assert.throws(() => history.undo((patches, direction) => applyChanges(model, patches, direction)), /byte range/);
  assert.equal(model.good, 0); assert.equal(history.stats.undoSteps, 1); assert.equal(history.stats.redoSteps, 0);
});

test('list insertion and removal retain only changed entries while reusing unaffected large meshes', () => {
  const before = { geosets: Array.from({ length: 20 }, (_, i) => ({ id: i, vertices: new Float32Array(30000) })) };
  const inserted = { id: 100, vertices: new Float32Array([1, 2, 3]) };
  const after = structuredClone(before); after.geosets.splice(6, 0, inserted);
  const changes = createChanges(before, after);
  assert.equal(changes.length, 1); assert.equal(changes[0].kind, 'splice');
  assert.equal(changes[0].before.length, 0); assert.equal(changes[0].after.length, 1);
  const first = before.geosets[0], last = before.geosets.at(-1);
  applyChanges(before, changes); assert.deepEqual(before, after);
  assert.equal(before.geosets[0], first); assert.equal(before.geosets.at(-1), last);
  applyChanges(before, changes, 'before'); assert.equal(before.geosets.length, 20);
  assert.equal(before.geosets[6].id, 6);
  const store = new HistoryStore(); store.push({ label: 'Add mesh', sections: ['geosets'], changes });
  assert.ok(store.stats.usedBytes < 2000, `Only inserted mesh should be retained, used ${store.stats.usedBytes}`);
});
