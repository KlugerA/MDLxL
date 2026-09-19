import { validSelectionHistory } from './selection-history.js';

/**
 * Bidirectional document deltas. Mesh nudges retain changed byte ranges, not a
 * complete model per step. The budget is a conservative retained-size estimate,
 * including both directions and JS entry/path overhead; it is not process RSS.
 */
export const DEFAULT_HISTORY_OPTIONS = Object.freeze({ budgetBytes: 512 * 1024 * 1024, maxSteps: 10000 });
const copy = (value) => structuredClone(value);
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function byteView(value) {
  return value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
function retainedBytes(value, seen = new Set()) {
  if (value == null) return 8;
  if (typeof value === 'string') return 24 + value.length * 2;
  if (typeof value !== 'object') return 16;
  if (seen.has(value)) return 8;
  seen.add(value);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return 80 + value.byteLength;
  return 64 + Object.entries(value).reduce((sum, [key, child]) => sum + 16 + key.length * 2 + retainedBytes(child, seen), 0);
}

/** ignore(path) excludes canonical aliases such as Nodes and node.PivotPoint. */
export function createChanges(before, after, { ignore = () => false } = {}) {
  const changes = [];
  const active = new Set();
  function same(left, right, path) {
    if (ignore(path) || Object.is(left, right)) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || left.constructor !== right.constructor) return false;
    if (ArrayBuffer.isView(left) || left instanceof ArrayBuffer) {
      if (left.byteLength !== right.byteLength) return false;
      const a = byteView(left), b = byteView(right);
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }
    if (Array.isArray(left) && left.length !== right.length) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => own(right, key) && same(left[key], right[key], [...path, key]));
  }
  function visit(left, right, path, leftExists = true, rightExists = true) {
    if (ignore(path) || leftExists === rightExists && Object.is(left, right)) return;
    const replace = () => changes.push({ kind: 'value', path, beforeExists: leftExists, afterExists: rightExists, before: copy(left), after: copy(right) });
    if (!leftExists || !rightExists || !left || !right || typeof left !== 'object' || typeof right !== 'object' || left.constructor !== right.constructor) { replace(); return; }
    if (ArrayBuffer.isView(left) || left instanceof ArrayBuffer) {
      if (left.byteLength !== right.byteLength) { replace(); return; }
      const a = byteView(left), b = byteView(right);
      // Merge nearby byte edits, avoiding one JS allocation per changed float.
      let start = -1, last = -1;
      const flush = () => { if (start >= 0) changes.push({ kind: 'bytes', path, offset: start, before: a.slice(start, last + 1), after: b.slice(start, last + 1) }); };
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) { if (start < 0) start = i; last = i; }
        else if (start >= 0 && i - last > 32) { flush(); start = -1; }
      }
      flush();
      return;
    }
    if (Array.isArray(left) && left.length !== right.length) {
      // Adding a geoset/node/key retains only the inserted/deleted middle, so
      // unaffected meshes are never retained merely because a list grew.
      let start = 0, end = 0;
      while (start < Math.min(left.length, right.length) && same(left[start], right[start], [...path, String(start)])) start++;
      while (end < Math.min(left.length, right.length) - start && same(left[left.length - end - 1], right[right.length - end - 1], [...path, String(left.length - end - 1)])) end++;
      changes.push({ kind: 'splice', path, index: start, before: copy(left.slice(start, left.length - end)), after: copy(right.slice(start, right.length - end)) });
      return;
    }
    if (active.has(right)) throw new Error('Document history cannot store a cyclic model value.');
    active.add(right);
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (forbidden.has(key)) throw new Error(`Unsafe document property: ${key}.`);
      visit(left[key], right[key], [...path, key], own(left, key), own(right, key));
    }
    active.delete(right);
  }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (forbidden.has(key)) throw new Error(`Unsafe document property: ${key}.`);
    visit(before[key], after[key], [key], own(before, key), own(after, key));
  }
  return changes;
}

function validateChange(change) {
  if (!change || !Array.isArray(change.path) || !change.path.length || change.path.length > 128 || change.path.some((key) => typeof key !== 'string' || forbidden.has(key))) throw new Error('Invalid recovery history path.');
  if (change.kind === 'bytes') {
    if (!Number.isSafeInteger(change.offset) || change.offset < 0 || !(change.before instanceof Uint8Array) || !(change.after instanceof Uint8Array) || change.before.length !== change.after.length) throw new Error('Invalid recovery history byte range.');
  } else if (change.kind === 'splice') {
    if (!Number.isSafeInteger(change.index) || change.index < 0 || !Array.isArray(change.before) || !Array.isArray(change.after)) throw new Error('Invalid recovery history array range.');
  } else if (change.kind !== 'value' || typeof change.beforeExists !== 'boolean' || typeof change.afterExists !== 'boolean') throw new Error('Invalid recovery history change.');
}

/** Resolve and allocate all replacements before writing, so errors are atomic. */
export function applyChanges(model, changes, direction = 'after') {
  if (!['before', 'after'].includes(direction)) throw new Error('Invalid history direction.');
  const writes = changes.map((change) => {
    validateChange(change);
    let parent = model;
    for (const key of change.path.slice(0, -1)) {
      if (!parent || typeof parent !== 'object' || !own(parent, key)) throw new Error('History no longer matches this document.');
      parent = parent[key];
    }
    if (!parent || typeof parent !== 'object') throw new Error('History no longer matches this document.');
    const key = change.path.at(-1);
    if (change.kind === 'bytes') {
      const value = parent[key];
      if (!(ArrayBuffer.isView(value) || value instanceof ArrayBuffer) || change.offset + change[direction].length > value.byteLength) throw new Error('History byte range no longer matches this document.');
      return { bytes: byteView(value), offset: change.offset, value: change[direction] };
    }
    if (change.kind === 'splice') {
      const value = parent[key], remove = change[direction === 'after' ? 'before' : 'after'].length;
      if (!Array.isArray(value) || change.index + remove > value.length) throw new Error('History array range no longer matches this document.');
      // Build without spreading huge arrays through a function argument list.
      return { parent, key, exists: true, value: value.slice(0, change.index).concat(copy(change[direction]), value.slice(change.index + remove)) };
    }
    return { parent, key, exists: change[`${direction}Exists`], value: copy(change[direction]) };
  });
  for (const write of writes) {
    if (write.bytes) write.bytes.set(write.value, write.offset);
    else if (write.exists) write.parent[write.key] = write.value;
    else delete write.parent[write.key];
  }
}

export class HistoryStore {
  constructor(options = {}) {
    this.undoEntries = []; this.redoEntries = [];
    this.usedBytes = 0; this.evictedSteps = 0; this.lastEntryRetained = true;
    this.configure(options);
  }
  configure(options = {}) {
    const budgetBytes = options.budgetBytes ?? this.budgetBytes ?? DEFAULT_HISTORY_OPTIONS.budgetBytes;
    const maxSteps = options.maxSteps ?? this.maxSteps ?? DEFAULT_HISTORY_OPTIONS.maxSteps;
    if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 0 || !Number.isSafeInteger(maxSteps) || maxSteps < 0) throw new Error('Undo cache limits must be nonnegative integers.');
    this.budgetBytes = budgetBytes; this.maxSteps = maxSteps;
    this._trim(); return this.stats;
  }
  _trim() {
    while (this.usedBytes > this.budgetBytes || this.undoEntries.length + this.redoEntries.length > this.maxSteps) {
      // Evict the furthest reachable state, preserving a contiguous undo/redo chain.
      const entry = this.undoEntries.length ? this.undoEntries.shift() : this.redoEntries.shift();
      if (!entry) break;
      this.usedBytes -= entry.bytes; this.evictedSteps++;
    }
    this.usedBytes = Math.max(0, this.usedBytes);
  }
  prepare({ label, sections, changes }) {
    const entry = { label: String(label), sections: [...sections], changes };
    entry.bytes = retainedBytes(entry); return entry;
  }
  push(change) { return change.changes.length ? this.commit(this.prepare(change)) : false; }
  commit(entry) {
    for (const entry of this.redoEntries) this.usedBytes -= entry.bytes;
    this.redoEntries = [];
    this.undoEntries.push(entry); this.usedBytes += entry.bytes;
    this._trim(); this.lastEntryRetained = this.undoEntries.at(-1) === entry;
    return this.lastEntryRetained;
  }
  setSelection(entry, selection) {
    if (!this.undoEntries.includes(entry) && !this.redoEntries.includes(entry)) return false;
    if (!validSelectionHistory(selection)) throw new Error('Invalid selection history.');
    const { bytes, selection: previous, ...documentEntry } = entry;
    const saved = copy(selection), nextBytes = retainedBytes({ ...documentEntry, selection: saved });
    entry.selection = saved; entry.bytes = nextBytes;
    this.usedBytes += nextBytes - bytes;
    this._trim();
    const retained = this.undoEntries.includes(entry) || this.redoEntries.includes(entry);
    if (!retained) this.lastEntryRetained = false;
    return retained;
  }
  undo(mutator) {
    const entry = this.undoEntries.at(-1);
    if (!entry) return null;
    mutator(entry.changes, 'before');
    this.undoEntries.pop(); this.redoEntries.push(entry); return entry;
  }
  redo(mutator) {
    const entry = this.redoEntries.at(-1);
    if (!entry) return null;
    mutator(entry.changes, 'after');
    this.redoEntries.pop(); this.undoEntries.push(entry); return entry;
  }
  get stats() {
    return { undoSteps: this.undoEntries.length, redoSteps: this.redoEntries.length, usedBytes: this.usedBytes,
      budgetBytes: this.budgetBytes, maxSteps: this.maxSteps, evictedSteps: this.evictedSteps,
      undoLabel: this.undoEntries.at(-1)?.label || '', redoLabel: this.redoEntries.at(-1)?.label || '', lastEntryRetained: this.lastEntryRetained };
  }
  capture() {
    return copy(this._recoveryState());
  }
  _recoveryState() {
    return { version: 1, budgetBytes: this.budgetBytes, maxSteps: this.maxSteps, evictedSteps: this.evictedSteps,
      lastEntryRetained: this.lastEntryRetained, undoEntries: this.undoEntries, redoEntries: this.redoEntries };
  }
  static restore(state) {
    if (state?.version !== 1 || !Array.isArray(state.undoEntries) || !Array.isArray(state.redoEntries)) throw new Error('Invalid recovery history.');
    const store = new HistoryStore(state);
    for (const key of ['undoEntries', 'redoEntries']) {
      store[key] = state[key].map((entry) => {
        if (typeof entry.label !== 'string' || !Array.isArray(entry.sections) || !Array.isArray(entry.changes)) throw new Error('Invalid recovery history entry.');
        entry.changes.forEach(validateChange);
        const result = copy({ label: entry.label, sections: entry.sections, changes: entry.changes,
          ...(validSelectionHistory(entry.selection) ? { selection: entry.selection } : {}) });
        result.bytes = retainedBytes(result); store.usedBytes += result.bytes; return result;
      });
    }
    store.evictedSteps = Number.isSafeInteger(state.evictedSteps) && state.evictedSteps >= 0 ? state.evictedSteps : 0;
    store.lastEntryRetained = state.lastEntryRetained !== false;
    store._trim(); return store;
  }
}
