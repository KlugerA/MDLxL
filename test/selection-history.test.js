import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorDocument, createDemoDocument, deleteGeoset, duplicateGeoset } from '../src/editor-document.js';
import { deleteVertices } from '../src/editor-commands.js';
import { weldSelectedVertices } from '../src/classic-mesh.js';
import { detachFaces } from '../src/mesh-tools.js';
import { SelectionHistory, captureSelection, restoreSelection } from '../src/selection-history.js';

const ui = (selection = { 0: [0, 1] }, options = {}) => ({
  selectable: new Set([0, 1, 2, 3, 4]), selection, hidden: {}, activeGeoset: 0, uvSet: 0, ...options,
});
function edit(history, state, label, mutate, after = state) {
  const ticket = history.captureEdit(state);
  const result = history.doc.apply(label, [], mutate);
  history.recordEdit(ticket, state);
  history.settle(typeof after === 'function' ? after(result) : after);
  return result;
}

test('transform and property undo/redo preserve selection, visibility and independent subsequent picks', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc);
  const initial = ui({ 0: [0, 1], 3: [2, 4] }, { hidden: { 1: [3] }, activeGeoset: 3 });
  edit(history, initial, 'Move vertices', m => { m.Geosets[0].Vertices[0] += 5; m.Geosets[3].Vertices[6] += 5; });
  assert.deepEqual(history.travel('undo', initial), initial);
  assert.deepEqual(history.travel('redo', initial), initial);
  const later = ui({ 2: [0, 3] }, { activeGeoset: 2, hidden: { 0: [1, 2] }, selectable: new Set([0, 2]) });
  assert.deepEqual(history.travel('undo', later), later);
  assert.deepEqual(history.travel('redo', later), later);
  edit(history, later, 'Material opacity', m => { m.Materials[0].Layers[0].Alpha = 0.5; });
  assert.deepEqual(history.travel('undo', later), later);
  assert.equal(doc._historyStore.undoEntries[0].selection, undefined, 'ordinary transforms retain no selection snapshots');
});

test('vertex deletion restores original vertex IDs on undo and the completed handler state on redo', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc);
  const initial = ui({ 0: [0, 2], 2: [1] }, { hidden: { 0: [8], 4: [3] }, activeGeoset: 2 });
  const after = ui({}, { hidden: {}, activeGeoset: 2 });
  const originalCount = doc.model.Geosets[0].Vertices.length;
  edit(history, initial, 'Delete vertices', m => deleteVertices(m.Geosets[0], [0, 2]), after);
  assert.ok(doc.model.Geosets[0].Vertices.length < originalCount);
  assert.deepEqual(history.travel('undo', after), initial);
  assert.equal(doc.model.Geosets[0].Vertices.length, originalCount);
  assert.deepEqual(history.travel('redo', initial), after);
});

test('deleting whole geosets restores multi-geoset selection and the shifted post-delete state', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc);
  const initial = ui({ 0: [0, 1], 2: [1, 3], 4: [2] }, { hidden: { 3: [0] }, activeGeoset: 4 });
  const after = ui({ 2: [2] }, { selectable: new Set([0, 1, 2]), activeGeoset: 2, hidden: { 1: [0] } });
  edit(history, initial, 'Delete geosets', m => { deleteGeoset(m, 2); deleteGeoset(m, 0); }, after);
  assert.deepEqual(history.travel('undo', after), initial);
  assert.equal(doc.model.Geosets.length, 5);
  assert.deepEqual(history.travel('redo', initial), after);
  assert.equal(doc.model.Geosets.length, 3);
});

test('weld records the remapped selected vertex in each geoset and never reapplies stale IDs on redo', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc);
  const initial = ui({ 0: [0, 3], 2: [0, 3] }, { activeGeoset: 2 });
  let after;
  edit(history, initial, 'Weld vertices', m => {
    const selection = Object.fromEntries([0, 2].map(gi => [gi, weldSelectedVertices(m.Geosets[gi], [0, 3]).selection]));
    after = ui(selection, { activeGeoset: 0 });
  }, () => after);
  assert.deepEqual(after.selection, { 0: [2], 2: [2] });
  for (let repeat = 0; repeat < 4; repeat++) {
    assert.deepEqual(history.travel('undo', after), initial);
    assert.deepEqual(history.travel('redo', initial), after);
  }
});

test('detach restores selections and active geoset on both sides of newly appended geometry', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc);
  const picked = Array.from(doc.model.Geosets[0].Faces.slice(0, 3));
  const initial = ui({ 0: picked, 2: [1] }, { selectable: new Set([0, 2]), hidden: { 2: [3] } });
  let after;
  edit(history, initial, 'Detach faces', m => detachFaces(m, 0, picked), gi => {
    after = ui({ [gi]: Array.from({ length: doc.model.Geosets[gi].Vertices.length / 3 }, (_, i) => i) },
      { selectable: new Set([0, 2, gi]), activeGeoset: gi });
    return after;
  });
  assert.deepEqual(history.travel('undo', after), initial);
  assert.deepEqual(history.travel('redo', initial), after);
});

test('selection history follows branch truncation and step eviction without separate stale stacks', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc);
  doc.configureHistory({ maxSteps: 2 });
  let state = ui();
  const duplicate = label => {
    const before = state;
    edit(history, before, label, m => duplicateGeoset(m, 0), gi => {
      state = ui({ [gi]: [0, 2] }, { selectable: new Set([gi]), activeGeoset: gi });
      return state;
    });
    return before;
  };
  duplicate('First');
  const secondBefore = duplicate('Second');
  const thirdBefore = duplicate('Third');
  const thirdAfter = state;
  assert.equal(doc.historyStats.undoSteps, 2);
  assert.equal(doc.historyStats.evictedSteps, 1);
  state = history.travel('undo', thirdAfter);
  assert.deepEqual(state, thirdBefore);
  duplicate('Replacement branch');
  assert.equal(history.travel('redo', state), false);
  state = history.travel('undo', state);
  assert.deepEqual(state, thirdBefore);
  state = history.travel('undo', state);
  assert.deepEqual(state, secondBefore);
  assert.equal(history.travel('undo', state), false);
  assert.equal(doc.historyStats.budgetBytes, 512 * 1024 * 1024);
  const retained = [...doc._historyStore.undoEntries, ...doc._historyStore.redoEntries];
  assert.equal(doc.historyStats.usedBytes, retained.reduce((total, entry) => total + entry.bytes, 0));
  assert.ok(retained.every(entry => entry.selection && !('model' in entry.selection)));
});

test('selection snapshots count against the existing cache budget and survive recovery', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc), before = ui({ 0: [0, 3] });
  const ticket = history.captureEdit(before);
  const welded = doc.apply('Weld', [], m => weldSelectedVertices(m.Geosets[0], [0, 3]));
  const modelBytes = doc.historyStats.usedBytes;
  history.recordEdit(ticket, before);
  const after = ui({ 0: welded.selection }); history.settle(after);
  assert.ok(doc.historyStats.usedBytes > modelBytes);
  const recovered = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
  assert.equal(recovered.historyStats.usedBytes, doc.historyStats.usedBytes);
  const recoveredHistory = new SelectionHistory(recovered);
  assert.deepEqual(recoveredHistory.travel('undo', ui({})), before);
  assert.deepEqual(recoveredHistory.travel('redo', before), after);
  doc.configureHistory({ budgetBytes: modelBytes });
  assert.equal(doc.canUndo, false, 'selection bytes are not exempt from the cache limit');
  assert.equal(doc.historyStats.usedBytes, 0);
});

test('no-op and failed edits leave selection snapshots and redo intact; invalid recovered UI metadata is ignored', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc), state = ui();
  edit(history, state, 'Delete vertices', m => deleteVertices(m.Geosets[0], [0]), ui({}));
  history.travel('undo', ui({}));
  const ticket = history.captureEdit(state);
  assert.equal(doc.apply('No change', [], () => {}), false);
  assert.equal(history.recordEdit(ticket, state), false);
  assert.throws(() => doc.apply('Invalid edit', [], m => { m.Geosets[0].Vertices[0] += 8; throw new Error('abort'); }), /abort/);
  assert.equal(history.recordEdit(ticket, state), false);
  assert.equal(doc.canRedo, true);
  const recovery = doc.captureRecoveryState();
  recovery.history.redoEntries[0].selection.before.selection = { 0: [-1, NaN] };
  const restored = EditorDocument.restoreRecoveryState(recovery);
  assert.equal(restored._historyStore.redoEntries[0].selection, undefined);
  assert.deepEqual(new SelectionHistory(restored).travel('redo', state).selection, state.selection);
});

test('selection snapshots copy and validate IDs while preserving insertion order used by the weld tool', () => {
  const doc = createDemoDocument();
  const state = ui({ 0: [3, 0, 3, 0.5, -1, NaN, 999], 99: [0] }, { hidden: { 0: [2, 999] }, uvSet: 999 });
  const snapshot = captureSelection(state, doc.model);
  state.selection[0][0] = 9;
  assert.deepEqual(restoreSelection(snapshot, doc.model).selection, { 0: [3, 0] });
  assert.deepEqual(restoreSelection(snapshot, doc.model).hidden, { 0: [2] });
  assert.equal(snapshot.uvSet, 0);
  assert.ok(snapshot.selection[0] instanceof Uint32Array);
});

test('removing a UV layer restores the original active coordinate set when undone', () => {
  const doc = createDemoDocument();
  doc.apply('Add UV layer', [], m => { m.Geosets[0].TVertices.push(m.Geosets[0].TVertices[0].slice()); });
  const history = new SelectionHistory(doc), initial = ui({ 0: [1, 3] }, { uvSet: 1 }), after = ui({ 0: [1, 3] });
  edit(history, initial, 'Remove UV layer', m => { m.Geosets[0].TVertices.pop(); }, after);
  assert.deepEqual(history.travel('undo', after), initial);
  assert.deepEqual(history.travel('redo', initial), after);
});

test('selection-only vertex, UV and bone picks share document undo order without dirtying the model', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc);
  const nodeIds = doc.model.Nodes.filter(Boolean).slice(0, 2).map(node => node.ObjectId);
  const first = ui({ 0: [0] }, { selectedNodeIds: [] });
  const second = ui({ 0: [1, 2] }, { selectedNodeIds: [] });
  const third = ui({ 0: [1, 2] }, { selectedNodeIds: nodeIds.slice(0, 1) });
  history.observe(first);
  history.observe(second);
  history.observe(third);
  assert.equal(doc.historyStats.undoSteps, 2);
  assert.equal(doc.revision, 0);
  assert.equal(doc.dirty, false);
  assert.deepEqual(history.travel('undo', third), second);
  assert.deepEqual(history.travel('undo', second), first);
  assert.deepEqual(history.travel('redo', first), second);
  assert.deepEqual(history.travel('redo', second), third);
  assert.equal(doc.revision, 0, 'selection travel does not rebuild an unchanged model');
  assert.equal(doc.dirty, false);
});

test('selection picks interleave with model edits and survive recovery and redo replacement', () => {
  const doc = createDemoDocument(), history = new SelectionHistory(doc);
  const first = ui({ 0: [0] }), second = ui({ 0: [2] });
  history.observe(first);
  history.observe(second);
  edit(history, second, 'Move vertex', model => { model.Geosets[0].Vertices[0] += 3; });
  history.observe(second);
  const third = ui({ 0: [3] });
  history.observe(third);
  const recovered = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
  const recoveredHistory = new SelectionHistory(recovered);
  assert.deepEqual(recoveredHistory.travel('undo', third), second);
  assert.deepEqual(recoveredHistory.travel('undo', second), second);
  assert.deepEqual(recoveredHistory.travel('undo', second), first);
  assert.deepEqual(recoveredHistory.travel('redo', first), second);
  recoveredHistory.observe(third);
  assert.equal(recovered.canRedo, false);
  assert.deepEqual(recoveredHistory.travel('undo', third), second);
});
