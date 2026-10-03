import test from 'node:test';
import assert from 'node:assert/strict';
import { accessibleHotkey, accessiblePaintHotkey } from '../src/hotkey-badge.js';
import { normalizePreferences } from '../src/preferences.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';

test('RVL accepts direct and two-key chords and rejects every longer chord or sequence', () => {
  for (const [chord, expected] of [['M','M'],['Ctrl+1','Ctrl+1'],['Shift+F4','Shift+F4'],['Space','Space'],['Meta+S','Win+S'],['Ctrl+Plus','Ctrl++']]) assert.equal(accessibleHotkey(chord), expected);
  for (const chord of ['Ctrl+Alt+1','Ctrl+Shift+S','Ctrl+Alt+Space > A01',"'A01",'A+B','Shift','Ctrl+1+Space','Ctrl1Spc']) assert.equal(accessibleHotkey(chord), '');
  assert.equal(['Ctrl+Shift+S','Ctrl+S'].map(accessibleHotkey).find(Boolean), 'Ctrl+S');
});
test('Paint uses the same limit while preserving accessible brush alternatives', () => {
  assert.equal(accessiblePaintHotkey('Ctrl+Shift+O'), '');
  assert.equal(accessiblePaintHotkey('Ctrl+↵'), 'Ctrl+Enter');
  assert.equal(accessiblePaintHotkey('[ ]'), '[ / ]');
  assert.equal(accessiblePaintHotkey('Shift+[ ]'), 'Shift+[ / Shift+]');
});
test('hotkey appearance persists through preferences and portable configuration', () => {
  const appearance = {color:'#cc44aa',fontSize:14,placement:'left'};
  const prefs = normalizePreferences({hotkeyAppearance:appearance});
  assert.deepEqual(prefs.hotkeyAppearance, appearance);
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(prefs))).hotkeyAppearance, appearance);
  assert.deepEqual(importConfiguration(exportConfiguration(prefs)).hotkeyAppearance, appearance);
  assert.deepEqual(normalizePreferences({hotkeyAppearance:{color:'bad',fontSize:999,placement:'elsewhere'}}).hotkeyAppearance, {color:'#39ff14',fontSize:24,placement:'below'});
  assert.deepEqual(normalizePreferences().hotkeyAppearance, {color:'#39ff14',fontSize:10,placement:'below'});
});
