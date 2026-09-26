import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DEFAULT_PREFERENCES, normalizePreferences, effectiveBindings } from '../src/preferences.js';
import { COMMANDS } from '../src/commands.js';

const require = createRequire(import.meta.url);
const { SettingsStore, applySettingsPatch } = require('../electron/settings.cjs');
const { buildMenuTemplate, nativeAccelerator, normalizeMenuChecks } = require('../electron/menu.cjs');

test('native View menu retains Bones, Skeleton and Vertices checkbox state', () => {
  const checks = normalizeMenuChecks({ 'display:bones': true, 'display:skeleton': false, showVertices: true });
  assert.equal(checks['display:bones'], true);
  assert.equal(checks['display:skeleton'], false);
  assert.equal(checks.showVertices, true);
  assert.equal(checks.grid, false);
});

async function scratch(t) {
  const root = path.resolve(os.tmpdir()), prefix = 'mdlvis-settings-', directory = await fs.mkdtemp(path.join(root, prefix));
  t.after(async () => {
    const resolved = path.resolve(directory);
    if (!resolved.toLowerCase().startsWith(root.toLowerCase() + path.sep) || !path.basename(resolved).startsWith(prefix)) throw Error('Unexpected settings test cleanup location.');
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return path.join(directory, 'settings.json');
}

test('desktop settings persist mouse, graphics and cleared WarmKeys across restart without losing legacy history', async t => {
  const file = await scratch(t);
  await fs.writeFile(file, JSON.stringify({ gameData: 'C:\\Warcraft', historyBudgetBytes: 512 * 1048576, historyMaxSteps: 12000 }));
  const store = new SettingsStore(file, normalizePreferences);
  await store.load();
  assert.equal(store.settings.preferences.scrollSensitivity, 2);
  await store.configure({ preferences: { scrollSensitivity: 3.2, graphics: { maxFps: 30 }, hotkeys: { open: ['Alt+O'], save: [] } } });
  const reopened = new SettingsStore(file, normalizePreferences);
  await reopened.load();
  assert.equal(reopened.settings.gameData, 'C:\\Warcraft');
  assert.equal(reopened.settings.historyMaxSteps, 12000);
  assert.equal(reopened.settings.preferences.scrollSensitivity, 3.2);
  assert.equal(reopened.settings.preferences.graphics.maxFps, 30);
  assert.equal(reopened.settings.preferences.graphics.textures, true);
  assert.deepEqual(reopened.settings.preferences.hotkeys, { open: ['Alt+O'], save: [] });
  await reopened.configure({ preferences: { hotkeys: {} } });
  assert.deepEqual(reopened.settings.preferences.hotkeys, {});
  assert.equal(reopened.settings.preferences.scrollSensitivity, 3.2);
  assert.equal(effectiveBindings(COMMANDS, reopened.settings.preferences.hotkeys).save[0], 'Ctrl+S');
});

test('concurrent preference and legacy writes preserve each other and failed updates leave the file intact', async t => {
  const file = await scratch(t), store = new SettingsStore(file, normalizePreferences);
  await store.load();
  await Promise.all([
    store.configure({ preferences: { scrollSensitivity: 4.5 } }),
    store.configure({ historyBudgetBytes: 128 * 1048576, historyMaxSteps: 2500 }),
    store.configure({ preferences: { graphics: { particles: false, pixelRatio: 1 } } }),
  ]);
  const committed = await fs.readFile(file, 'utf8');
  assert.equal(JSON.parse(committed).preferences.scrollSensitivity, 4.5);
  assert.equal(store.settings.historyBudgetBytes, 128 * 1048576);
  assert.equal(store.settings.preferences.graphics.particles, false);
  for (const patch of [null, { preferences: [] }, { preferences: { scrollSensitivity: NaN } }, { preferences: { scrollSensitivity: 11 } }, { preferences: { rightScrollAdjust: 'true' } }, { preferences: { graphics: { maxFps: 500 } } }, { preferences: { graphics: { textures: 1 } } }, { preferences: { hotkeys: { open: 'Ctrl+O' } } }, { historyBudgetBytes: 1 }, { historyMaxSteps: 100001 }]) {
    assert.throws(() => store.configure(patch));
  }
  assert.equal(await fs.readFile(file, 'utf8'), committed);
  await store.configure({ preferences: { rightScrollAdjust: false } });
  assert.equal(store.settings.preferences.rightScrollAdjust, false);
});

test('damaged stored fields restore safe defaults while retaining other valid settings', async t => {
  const file = await scratch(t);
  await fs.writeFile(file, JSON.stringify({ gameData: 'C:\\Assets', historyMaxSteps: -10, preferences: { scrollSensitivity: 999, graphics: { maxFps: -5 } } }));
  const store = new SettingsStore(file, normalizePreferences);
  await store.load();
  assert.equal(store.settings.preferences.scrollSensitivity, 10);
  assert.equal(store.settings.preferences.graphics.maxFps, DEFAULT_PREFERENCES.graphics.maxFps);
  assert.equal(store.settings.historyMaxSteps, undefined);
  assert.equal(store.settings.gameData, 'C:\\Assets');
  assert.throws(() => applySettingsPatch(store.settings, { preferences: { hotkeys: JSON.parse('{"__proto__":["X"]}') } }, normalizePreferences));
});

test('a chosen Warcraft III folder persists across restart and can be cleared without retaining its path', async t => {
  const file = await scratch(t), install = path.join(path.dirname(file), 'Warcraft III');
  const store = new SettingsStore(file, normalizePreferences);
  await store.load();
  await store.configure({ gameData: install });
  const reopened = new SettingsStore(file, normalizePreferences);
  await reopened.load();
  assert.equal(reopened.settings.gameData, install);
  await reopened.configure({ gameData: null });
  const cleared = new SettingsStore(file, normalizePreferences);
  await cleared.load();
  assert.equal(cleared.settings.gameData, undefined);
  await fs.writeFile(file, JSON.stringify({ gameData: null }));
  const legacyNull = new SettingsStore(file, normalizePreferences);
  await legacyNull.load();
  assert.equal(legacyNull.settings.gameData, undefined);
  assert.throws(() => cleared.configure({ gameData: '   ' }));
});

test('native menus reflect remapped and cleared shortcuts and leave execution to the renderer', () => {
  const actions = [], bindings = effectiveBindings(COMMANDS, { open: ['Alt+O'], save: [], front: ['Ctrl+ArrowLeft'], graphics: ['Pause'] });
  const menus = buildMenuTemplate(bindings, id => actions.push(id), 'win32');
  const file = menus.find(menu => menu.label === '&File').submenu;
  assert.equal(file[0].accelerator, undefined);
  assert.equal(file[0].registerAccelerator, undefined);
  assert.equal(file.find(item=>item.label==='&Save').accelerator, undefined);
  assert.ok(file.find(item=>item.label==='&Save'));
  const view = menus.find(menu => menu.label === 'View').submenu;
  for (const label of ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom', 'Perspective']) assert.equal(view.find(item => item.label === label), undefined);
  assert.ok(COMMANDS.some(command => command.id === 'front'), 'view actions remain available for viewport and shortcut use');
  const settings = menus.find(menu => menu.label === 'Settings').submenu;
  settings.slice(0, 3).forEach(item => item.click());
  assert.deepEqual(actions, ['settings', 'warmkeys', 'graphics']);
  assert.equal(settings[2].label, 'Graphical settings…');
  for (const [label, action] of [['Recording and screenshots…','captureSettings'],['Appearance…','appearanceSettings'],['Configuration…','configurationSettings'],['Grid…','gridSettings'],['Warcraft III…','gameDataSettings']]) {
    const entry = settings.find(item => item.label === label); assert.ok(entry, `${label} is directly reachable`); entry.click(); assert.equal(actions.at(-1), action);
  }
  for (const menu of menus) for (const item of menu.submenu) if (item.accelerator) assert.equal(item.registerAccelerator, false);
  file[0].click();
  assert.equal(actions.filter(id => id === 'open').length, 1);
});

test('middle button and DPI preferences persist with desktop validation and long resource WarmKeys identities', async t => {
  const file = await scratch(t), store = new SettingsStore(file, normalizePreferences);
  await store.load();
  assert.equal(store.settings.preferences.wheelMode, 'rotate'); assert.equal(store.settings.preferences.pointerSensitivity, 1);
  const resource = 'resource:' + 'x'.repeat(500);
  await store.configure({ preferences: { wheelMode: 'pointer', pointerSensitivity: 2.25, hotkeys: { [resource]: ['Ctrl+Alt+P'] } } });
  const reopened = new SettingsStore(file, normalizePreferences); await reopened.load();
  assert.equal(reopened.settings.preferences.wheelMode, 'pointer'); assert.equal(reopened.settings.preferences.pointerSensitivity, 2.25);
  assert.deepEqual(reopened.settings.preferences.hotkeys[resource], ['Ctrl+Alt+P']);
  await reopened.configure({ preferences: { pointerSensitivity: .01 } }); assert.equal(reopened.settings.preferences.pointerSensitivity, .01);
  for (const preferences of [{ wheelMode: 'unknown' }, { pointerSensitivity: .009 }, { pointerSensitivity: 4.01 }, { pointerSensitivity: Infinity }, { pointerSensitivity: '2' }]) assert.throws(() => reopened.configure({ preferences }));
  assert.equal(nativeAccelerator('Ctrl+Alt+Space > ABC'), null);
  assert.equal(nativeAccelerator('Ctrl+Alt+Space > A'), null);
  const actions = [], menu = buildMenuTemplate({}, id => actions.push(id)).find(item => item.label === 'Settings');
  menu.submenu.find(item => item.label === 'Rescan game data').click(); assert.deepEqual(actions, ['game-data-rescan']);
});

test('native particle and geoset-animation editors dispatch shared commands only while editing is available', () => {
  const select = menu => [menu.find(item => item.label === 'Modules').submenu.find(item => item.label === 'Particle Editor…'), menu.find(item => item.label === 'Windows').submenu.find(item => item.label === 'Geoset Animation Manager…')];
  const actions = [];
  for (const state of [{ readOnly: true, saving: false }, { readOnly: false, saving: true }, { readOnly: true, saving: true }]) {
    const entries = select(buildMenuTemplate({}, id => actions.push(id), 'win32', [], value => value, state));
    for (const entry of entries) { assert.equal(entry.enabled, false); entry.click(); }
  }
  assert.deepEqual(actions, []);
  const entries = select(buildMenuTemplate({}, id => actions.push(id), 'win32', [], value => value, { readOnly: false, saving: false }));
  for (const entry of entries) { assert.equal(entry.enabled, true); entry.click(); }
  assert.deepEqual(actions, ['particles', 'GeosetAnims']);
});
