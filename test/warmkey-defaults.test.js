import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS } from '../src/commands.js';
import { assignHotkey, effectiveBindings, normalizeChord, normalizePreferences } from '../src/preferences.js';
import { contextualWarmKeyDefaults, coreWarmKeyDefaults, normalizeWarmKeySequence, warmKeyCode, warmKeySequence, WarmKeySequence, WARMKEY_LEADER } from '../src/warmkey-defaults.js';

const leader = { key: ' ', code: 'Space', ctrlKey: true, altKey: true };
test('every core action has a unique default and original MDLVis shortcuts retain their command', () => {
  const assigned = new Map();
  for (const action of COMMANDS) {
    assert.ok(action.defaultKeys.length, `${action.id} needs a default`);
    for (const key of action.defaultKeys) { assert.equal(assigned.has(key), false, `${key} already belongs to ${assigned.get(key)}`); assigned.set(key, action.id); }
  }
  for (const [key, action] of Object.entries({ A:'select', M:'translate', Q:'translate', R:'rotate', Z:'scale', W:'cameraToggle', T:'Create triangle', U:'Uncouple', C:'Collapse', B:'Weld', F:'frame', '`':'frame', S:'frameSelection', F1:'vertices', F2:'uv', F3:'animation', 'Ctrl+Z':'undo', 'Ctrl+Y':'redo', 'Ctrl+C':'copy', 'Ctrl+V':'paste', 'Ctrl+A':'selectAll' })) assert.equal(assigned.get(key), action);
  assert.equal(assigned.get('N'), 'normals'); // Final patch explicitly assigns normal visibility.
  assert.equal(assigned.get('1'), 'anchorSelect');
  for (const key of ['H', 'K', 'Ctrl+X', 'Ctrl+B']) assert.equal(assigned.has(key), false, `${key} is reserved by original MDLVis`);
  assert.deepEqual(COMMANDS.find(command => command.id === 'keyframe:clear').defaultKeys, ['Ctrl+D']);
  assert.equal(assigned.get('Ctrl+Alt+P'), 'wheel:scroll'); assert.equal(assigned.get('Ctrl+Alt+I'), 'wheel:pointer');
  assert.deepEqual(coreWarmKeyDefaults([{ id:'existing', defaultKeys:['M','Q'] }])[0].defaultKeys, ['M','Q']);
});

test('contextual defaults are unique, independent of discovery order, and stable after persistence and new controls', () => {
  const contextual = Array.from({ length: 6000 }, (_, i) => ({ id:`resource:Nodes:node:${i}:field:X`, contextual:true, defaultKeys:[] }));
  const first = contextualWarmKeyDefaults([...COMMANDS, ...contextual]);
  const reversed = contextualWarmKeyDefaults([...COMMANDS, ...contextual.toReversed()]);
  const byId = actions => Object.fromEntries(actions.map(action => [action.id, action.defaultKeys]));
  assert.deepEqual(byId(first), byId(reversed));
  const codes = first.flatMap(action => action.defaultKeys); assert.equal(new Set(codes).size, codes.length);
  const saved = JSON.parse(JSON.stringify(first.filter(action => action.contextual)));
  const next = contextualWarmKeyDefaults([...COMMANDS, { id:'new:control', contextual:true }, ...saved]);
  const updated = byId(next);
  for (const action of first) assert.deepEqual(updated[action.id], action.defaultKeys);
  assert.equal(next.find(action => action.id === 'new:control').defaultKeys.length, 1);
  assert.ok(next.filter(action => action.contextual).every(action => !warmKeyCode(action.defaultKeys[0]).startsWith('A')));
});

test('new contextual codes avoid custom assignments; corrupted duplicate saved codes are repaired', () => {
  const action = { id:'context:new', contextual:true }, first = contextualWarmKeyDefaults([action])[0];
  const reserved = first.defaultKeys[0];
  assert.notEqual(contextualWarmKeyDefaults([action], [reserved])[0].defaultKeys[0], reserved);
  const repaired = contextualWarmKeyDefaults([{ ...first, id:'one' }, { ...first, id:'two' }]);
  assert.notEqual(repaired[0].defaultKeys[0], repaired[1].defaultKeys[0]);
});

test('sequence normalization, persistence and assignment conflicts share the same canonical identity', () => {
  assert.equal(normalizeWarmKeySequence('alt + control + space > a09'), 'Ctrl+Alt+Space > A09');
  assert.equal(normalizeChord('Ctrl+Alt+Space > xyz'), 'Ctrl+Alt+Space > XYZ');
  for (const value of ['Ctrl+Space > ABC', 'Ctrl+Alt+Space > AB', 'Ctrl+Alt+Space > AB12', 'Ctrl+Alt+Space > A+1', 'Ctrl+Alt+Space > ABC > DEF']) assert.equal(normalizeWarmKeySequence(value), '');
  const key = warmKeySequence('AAA'), catalog = [{id:'one', defaultKeys:[key]}, {id:'two', defaultKeys:[]}];
  assert.equal(assignHotkey({}, catalog, 'two', key).ok, false);
  const replaced = assignHotkey({}, catalog, 'two', key, { replace:true });
  assert.deepEqual(effectiveBindings(catalog, replaced.hotkeys), {one:[], two:[key]});
  assert.deepEqual(normalizePreferences({ hotkeys:replaced.hotkeys }).hotkeys, replaced.hotkeys);
  assert.equal(assignHotkey({}, catalog, 'two', WARMKEY_LEADER).ok, false, 'leader cannot become a simultaneous shortcut');
});

test('leader accepts exactly three characters, retained modifiers, and repeats without leaking direct shortcuts', () => {
  const sequence = new WarmKeySequence();
  assert.equal(sequence.feed({key:'M'}, 0).consume, false);
  assert.equal(sequence.feed(leader, 10).pending, true);
  assert.equal(sequence.feed({key:'a', code:'KeyA', ctrlKey:true, altKey:true}, 20).code, 'A');
  assert.equal(sequence.feed({key:'a', repeat:true}, 30).code, 'A');
  assert.equal(sequence.feed({key:'Control'}, 35).pending, true);
  assert.equal(sequence.feed({key:'0', code:'Digit0'}, 40).code, 'A0');
  const complete = sequence.feed({key:'1', code:'Digit1'}, 50);
  assert.equal(complete.chord, 'Ctrl+Alt+Space > A01'); assert.equal(complete.consume, true); assert.equal(complete.pending, false);
  assert.equal(sequence.feed({key:'M'}, 60).consume, false);
});

test('Escape, invalid keys, timeout, focus cancellation and IME cancel an incomplete sequence', () => {
  const sequence = new WarmKeySequence({timeoutMs:100});
  for (const key of ['Escape', 'ArrowDown', 'Enter']) {
    sequence.feed(leader, 0); sequence.feed({key:'M'}, 10);
    const result = sequence.feed({key}, 20);
    assert.equal(result.consume, true); assert.equal(result.cancelled, true); assert.equal(result.chord, ''); assert.equal(sequence.active, false);
  }
  sequence.feed(leader, 0); sequence.feed({key:'A'}, 10); assert.equal(sequence.expire(109), false); assert.equal(sequence.expire(110), true);
  assert.equal(sequence.feed({key:'M'}, 111).consume, false);
  sequence.feed(leader, 0); sequence.cancel(); assert.equal(sequence.feed({key:'A'}, 30).pending, false);
  sequence.feed(leader, 0); assert.equal(sequence.feed({key:'a',isComposing:true}, 10).consume, false); assert.equal(sequence.active, false);
  sequence.feed(leader, 0); sequence.feed({key:'A'}, 10); assert.equal(sequence.feed({key:'Backspace'}, 20).code, '');
});
