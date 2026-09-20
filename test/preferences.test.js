import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, normalizeChord, chordFromEvent, effectiveBindings, assignHotkey, canHandleHotkeyEvent, isTextEditingTarget } from '../src/preferences.js';

test('preferences validate persisted data and preserve explicitly cleared bindings', () => {
  assert.equal(normalizePreferences().scrollSensitivity, 2);
  const prefs = normalizePreferences({ scrollSensitivity: 500, rightScrollAdjust: false, graphics: { maxFps: 999, textures: false, pixelRatio: 1 }, hotkeys: { move: [], open: ['control+o', 'Ctrl+O', 'Shift'] } });
  assert.equal(prefs.scrollSensitivity, 10); assert.equal(prefs.graphics.maxFps, 60); assert.equal(prefs.graphics.textures, false);
  assert.equal(prefs.rightScrollAdjust, false); assert.equal(prefs.graphics.pixelRatio, 1);
  assert.deepEqual(prefs.hotkeys, { move: [], open: ['Ctrl+O'] });
  assert.deepEqual(effectiveBindings([{ id: 'move', defaultKeys: ['M'] }], prefs.hotkeys).move, []);
  assert.equal(normalizePreferences({ scrollSensitivity: 'oops' }).scrollSensitivity, 2);
});
test('WarmKeys normalizes combinations and ignores IME / modifiers', () => {
  assert.equal(normalizeChord('shift+control+z'), 'Ctrl+Shift+Z');
  assert.equal(chordFromEvent({ key: ' ', ctrlKey: true }), 'Ctrl+Space');
  assert.equal(chordFromEvent({ key: '+', shiftKey: true }), 'Shift+Plus');
  assert.equal(normalizeChord('Ctrl++'), 'Ctrl+Plus');
  assert.equal(normalizeChord('Command+ArrowLeft'), 'Meta+ArrowLeft');
  assert.equal(chordFromEvent({ key: 'Shift', shiftKey: true }), '');
  assert.equal(chordFromEvent({ key: 'a', isComposing: true }), '');
  assert.equal(chordFromEvent({ key: '@', getModifierState: name => name === 'AltGraph' }), '');
});
test('conflicting assignment is unchanged until explicit replacement removes inherited default', () => {
  const catalog = [{ id: 'move', defaultKeys: ['M', 'W'] }, { id: 'material', defaultKeys: [] }];
  const rejected = assignHotkey({}, catalog, 'material', 'm');
  assert.equal(rejected.ok, false); assert.deepEqual(rejected.conflicts, ['move']); assert.deepEqual(rejected.hotkeys, {});
  const replaced = assignHotkey({}, catalog, 'material', 'm', { replace: true });
  assert.equal(replaced.ok, true); assert.deepEqual(replaced.hotkeys, { move: ['W'], material: ['M'] });
  assert.deepEqual(effectiveBindings(catalog, replaced.hotkeys), { move: ['W'], material: ['M'] });
});
test('shortcuts protect typing, held-key repeats, disabled controls, and consumed events', () => {
  const event = { key: 'm', target: { tagName: 'CANVAS' } };
  assert.equal(canHandleHotkeyEvent(event), true);
  assert.equal(canHandleHotkeyEvent({ ...event, target: { tagName: 'INPUT' } }), false);
  assert.equal(canHandleHotkeyEvent({ ...event, target: { isContentEditable: true } }), false);
  assert.equal(canHandleHotkeyEvent({ ...event, repeat: true }), false);
  assert.equal(canHandleHotkeyEvent({ ...event, repeat: true }, { repeat: true }), true);
  assert.equal(canHandleHotkeyEvent({ ...event, defaultPrevented: true }), false);
  assert.equal(canHandleHotkeyEvent(event, { enabled: () => false }), false);
});
test('a shortcut can repeatedly toggle its focused control without stealing native activation', () => {
  for (const type of ['checkbox', 'radio', 'button', 'submit', 'reset']) {
    const target = { tagName: 'INPUT', type };
    assert.equal(isTextEditingTarget(target), false, `${type} is a control, not a text editor`);
    assert.equal(canHandleHotkeyEvent({ key: 'j', target }), true, `J can activate a focused ${type} again`);
    assert.equal(canHandleHotkeyEvent({ key: ' ', target }), false, `native Space remains on ${type}`);
    assert.equal(canHandleHotkeyEvent({ key: 'Enter', target }, { allowInInput: true }), false, `native Enter remains on ${type} even for commands allowed in inputs`);
    assert.equal(canHandleHotkeyEvent({ key: ' ', ctrlKey: true, target }), true, `an explicit modified shortcut still works on ${type}`);
  }
  for (const type of ['text', 'number', 'range', 'search']) assert.equal(canHandleHotkeyEvent({ key: 'j', target: { tagName: 'INPUT', type } }), false, `${type} entry remains protected`);
  assert.equal(canHandleHotkeyEvent({ key: 'ArrowLeft', target: { tagName: 'INPUT', type: 'radio' } }), false, 'radio group arrow navigation remains native');
  assert.equal(canHandleHotkeyEvent({ key: ' ', target: { tagName: 'BUTTON' } }), false, 'a focused button keeps native Space activation');
});
test('deeply scoped resource shortcuts survive preference serialization without truncating their identity', () => {
  const id = ['resource:ParticleEmitter2', 'section:Animated particle appearance and visibility', 'track:Head and tail segment color transitions', 'section:Hermite interpolation tangents at selected animation frame', 'key:2147483647', 'vector:Incoming interpolation tangent', 'field:Z'].join(':');
  assert.ok(id.length > 200);
  const assigned = assignHotkey({}, [{ id, defaultKeys: [] }], id, 'Ctrl+Alt+J');
  assert.equal(assigned.ok, true);
  const persisted = normalizePreferences(JSON.parse(JSON.stringify({ hotkeys: assigned.hotkeys })));
  assert.deepEqual(persisted.hotkeys[id], ['Ctrl+Alt+J']);
});
