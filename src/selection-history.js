/** Selection belongs to the editor, but topology changes also change vertex IDs. */
const index = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const ids = (values, valid) => Uint32Array.from([...new Set(values || [])].filter(value => index(value) && valid(value)));

/** Compact, detached UI data only: never retain a model, mesh, or position array. */
export function captureSelection(state, model) {
  const geosets = model.Geosets || [];
  const selectable = ids(state.selectable, value => !!geosets[value]);
  const enabled = new Set(selectable);
  const vertices = (source, selected) => Object.fromEntries(Object.entries(source || {})
    .filter(([gi]) => index(Number(gi)) && geosets[gi] && (!selected || enabled.has(Number(gi))))
    .map(([gi, values]) => [gi, ids(values, value => value < geosets[gi].Vertices.length / 3)]));
  const activeGeoset = index(state.activeGeoset) && enabled.has(state.activeGeoset) ? state.activeGeoset : selectable[0] ?? -1;
  const uvCount = geosets[activeGeoset]?.TVertices?.length || 0;
  const snapshot = {
    selectable, selection: vertices(state.selection, true), hidden: vertices(state.hidden, false), activeGeoset,
    uvSet: Math.max(0, Math.min(index(state.uvSet) ? state.uvSet : 0, uvCount - 1)),
  };
  if (state.selectedNodeIds) {
    const nodes = new Set((model.Nodes || []).filter(Boolean).map(node => node.ObjectId));
    snapshot.selectedNodeIds = ids(state.selectedNodeIds, value => nodes.has(value));
  }
  return snapshot;
}

/** Return fresh arrays/Sets for React state; clamp old/recovered UI IDs to the model. */
export function restoreSelection(snapshot, model) {
  const state = captureSelection(snapshot, model);
  return { ...state, selectable: new Set(state.selectable),
    selection: Object.fromEntries(Object.entries(state.selection).map(([gi, values]) => [gi, Array.from(values)])),
    hidden: Object.fromEntries(Object.entries(state.hidden).map(([gi, values]) => [gi, Array.from(values)])),
    ...(state.selectedNodeIds ? { selectedNodeIds: Array.from(state.selectedNodeIds) } : {}) };
}

export function validSelectionHistory(value) {
  const validIds = values => values instanceof Uint32Array;
  const onlyKeys = (value, keys) => Object.keys(value).every(key => keys.includes(key));
  const validMap = value => !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([gi, values]) => index(Number(gi)) && validIds(values));
  const validSnapshot = value => !!value && validIds(value.selectable) && validMap(value.selection) && validMap(value.hidden)
    && (value.activeGeoset === -1 || index(value.activeGeoset)) && index(value.uvSet)
    && (value.selectedNodeIds === undefined || validIds(value.selectedNodeIds))
    && onlyKeys(value, ['selectable', 'selection', 'hidden', 'activeGeoset', 'uvSet', 'selectedNodeIds']);
  return value?.version === 1 && validSnapshot(value.before) && validSnapshot(value.after) && onlyKeys(value, ['version', 'before', 'after']);
}

/** Position/normal/material edits keep IDs. Compaction and geoset list edits do not. */
export function changesSelectionIndices(changes) {
  return changes.some(change => {
    if (change.path[0] !== 'Geosets') return false;
    if (change.path.length <= 2) return true;
    if (change.path[2] === 'Vertices') return change.kind !== 'bytes';
    // UV layer creation/deletion changes which coordinate set is active.
    return change.path[2] === 'TVertices' && change.path.length === 3 && change.kind !== 'bytes';
  });
}

/**
 * Call captureEdit before doc.apply, recordEdit immediately after, and settle once
 * in the next layout effect, after the edit handler's selection updates commit.
 * Entries own their snapshots, so branch truncation and cache eviction also free
 * selection data. Ordinary transforms retain no additional selection history.
 */
export class SelectionHistory {
  constructor(doc) { this.doc = doc; this.pending = null; this.observed = null; this.observedRevision = doc.revision; }
  captureEdit(state) {
    this.settle(state);
    return { revision: this.doc.revision, before: captureSelection(state, this.doc.model), entry: this.doc._historyStore.undoEntries.at(-1) };
  }
  recordEdit(ticket, state) {
    const entry = this.doc._historyStore.undoEntries.at(-1);
    if (this.doc.revision !== ticket.revision + 1 || !entry || entry === ticket.entry || !changesSelectionIndices(entry.changes)) return false;
    const selection = { version: 1, before: ticket.before, after: captureSelection(state, this.doc.model) };
    if (!this.doc._historyStore.setSelection(entry, selection)) return false;
    this.pending = entry;
    return true;
  }
  settle(state) {
    const entry = this.pending;
    this.pending = null;
    if (!entry || this.doc._historyStore.undoEntries.at(-1) !== entry) return false;
    return this.doc._historyStore.setSelection(entry, { ...entry.selection, after: captureSelection(state, this.doc.model) });
  }
  observe(state) {
    const after = captureSelection(state, this.doc.model);
    if (!this.observed) { this.observed = after; this.observedRevision = this.doc.revision; return false; }
    const before = this.observed, changed = JSON.stringify(before) !== JSON.stringify(after);
    if (this.pending) {
      this.settle(state);
    } else if (changed) {
      const store = this.doc._historyStore;
      if (this.doc.revision === this.observedRevision) {
        const entry = store.prepare({ label: 'Change selection', sections: [], changes: [] });
        store.commit(entry);
        store.setSelection(entry, { version: 1, before, after });
      } else if (this.doc.revision === this.observedRevision + 1 && store.undoEntries.length) {
        store.setSelection(store.undoEntries.at(-1), { version: 1, before, after });
      }
    }
    this.observed = after; this.observedRevision = this.doc.revision;
    return changed;
  }
  travel(direction, state) {
    if (!['undo', 'redo'].includes(direction)) throw new Error('Invalid selection history direction.');
    this.settle(state);
    const store = this.doc._historyStore;
    const entry = (direction === 'undo' ? store.undoEntries : store.redoEntries).at(-1);
    if (!entry || !this.doc[direction]()) return false;
    const saved = entry.selection?.[direction === 'undo' ? 'before' : 'after'];
    const restored = restoreSelection(saved || state, this.doc.model);
    this.observed = captureSelection(restored, this.doc.model);
    this.observedRevision = this.doc.revision;
    return restored;
  }
}
