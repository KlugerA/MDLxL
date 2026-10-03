import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import themes from '../src/application-themes.json' with {type:'json'};
import { BUILT_IN_VIEWPORT_PRESETS as presets } from '../src/viewport-appearance.js';
import { normalizePreferences } from '../src/preferences.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { applyApplicationTheme } from '../app/theme.js';

const luminance=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

test('seven Warcraft presets have exactly seven matching themes and readable primary text',()=>{
  const names=['Lordaeron','Blackrock','Ironforge','Northrend','Silvermoon','Durotar','Dalaran'];
  assert.deepEqual(Object.values(presets).map(p=>p.name),names);
  assert.deepEqual(Object.values(themes).map(t=>t.name),names);
  assert.equal(new Set(Object.values(presets).map(p=>p.theme)).size,7);
  for(const preset of Object.values(presets)){
    const theme=themes[preset.theme];assert.equal(preset.name,theme.name);
    for(const bg of ['panel','surface','field'])assert.ok(contrast(theme.colors.text,theme.colors[bg])>=4.5,`${theme.name}: text on ${bg}`);
    assert.ok(contrast(theme.colors['selected-text'],theme.colors.selected)>=4.5,theme.name+' selected text');
    for(const part of ['selectedVertex','unselectedVertex'])if(!['mdlvis-vanilla','blender-style'].includes(preset.id))assert.ok(contrast(preset.appearance[part].color,preset.appearance.background.color)>=3,`${preset.name}: ${part}`);
  }
});

test('new and legacy themes survive persistence/export without touching unrelated settings',()=>{
  for(const preset of Object.values(presets)){
    const prefs=normalizePreferences({rendererRevision:3,theme:preset.theme,accent:themes[preset.theme].accent,viewportPreset:preset.id,viewportAppearance:preset.appearance,scrollSensitivity:3.5,hotkeys:{foo:['Ctrl+J']},viewportPresets:[{id:'custom-mine',name:'My colors',appearance:presets['blender-style'].appearance}]});
    const restored=importConfiguration(JSON.stringify(exportConfiguration(prefs)));
    assert.deepEqual(restored,prefs);assert.equal(restored.theme,preset.theme);assert.equal(restored.scrollSensitivity,3.5);assert.equal(restored.viewportPresets[0].name,'My colors');
  }
});

test('every theme replaces all tokens in main and detached documents without changing viewport colors',()=>{
  const targets=Array.from({length:2},()=>{const values=new Map();return {documentElement:{dataset:{},style:{setProperty:(k,v)=>values.set(k,v)}},values};});
  for(const [id,theme]of Object.entries(themes))for(const doc of targets){
    applyApplicationTheme(normalizePreferences({rendererRevision:3,theme:id,accent:theme.accent,viewportAppearance:presets.nord.appearance}),doc);
    assert.equal(doc.documentElement.dataset.theme,theme.scheme);
    for(const [key,value]of Object.entries(theme.colors))assert.equal(doc.values.get('--ui-'+key),value);
    assert.equal(doc.values.get('--visual-background'),presets.nord.appearance.background.color);
  }
});

test('preset application pairs theme and accent while native windows use the same catalog',()=>{
  const settings=readFileSync(new URL('../app/Settings.jsx',import.meta.url),'utf8');
  const desktop=readFileSync(new URL('../electron/main.cjs',import.meta.url),'utf8');
  assert.match(settings,/theme: preset.theme, accent: preset.accent \|\| APPLICATION_THEMES\[preset.theme\].accent/);
  assert.match(settings,/Object.entries\(APPLICATION_THEMES\)/);
  assert.doesNotMatch(desktop,/theme==='dark'/);
  assert.match(desktop,/require\('\.\.\/src\/application-themes.json'\)/);
});

test('folder and node palettes belong to each preset and remain readable', () => {
  assert.equal(new Set(Object.values(presets).map(p => p.appearance.tree.background)).size, 7);
  assert.equal(new Set(Object.values(presets).map(p => p.appearance.tree.folders.default)).size, 7);
  for (const preset of Object.values(presets)) {
    const tree = preset.appearance.tree;
    assert.ok(contrast(tree.text, tree.background) >= 4.5, preset.name + ' tree text');
    assert.ok(contrast(tree.selectedText, tree.selected) >= 4.5, preset.name + ' selected text');
    for (const tint of Object.values(tree.folders)) assert.ok(contrast(tint, tree.background) >= 4.5, preset.name + ' folder ' + tint);
    for (const tint of Object.values(tree.nodes)) assert.ok(contrast(tint, tree.background) >= 3, preset.name + ' node ' + tint);
    const old = structuredClone(preset.appearance); delete old.tree;
    const migrated = normalizePreferences({ rendererRevision: 3, theme: preset.theme, viewportPreset: preset.id, viewportAppearance: old });
    assert.deepEqual(migrated.viewportAppearance.tree, tree, preset.name + ' older profile');
  }
});

test('custom tree colors, font size and theme survive profile and configuration export', () => {
  const appearance = structuredClone(presets['blender-style'].appearance);
  Object.assign(appearance.tree, { background: '#112233', text: '#ddeeff', fontSize: 17 });
  appearance.tree.nodes.bone = '#abcdef'; appearance.tree.folders.Human = '#fedcba';
  const prefs = normalizePreferences({ rendererRevision: 3, theme: 'dark', accent: '#123456', viewportPreset: 'custom-trees', viewportAppearance: appearance,
    viewportPresets: [{ id: 'custom-trees', name: 'Custom trees', appearance, theme: 'dark', accent: '#123456' }] });
  assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(prefs))), prefs);
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(prefs))), prefs);
  assert.deepEqual(prefs.viewportPresets[0].appearance.tree, appearance.tree);
  assert.equal(prefs.viewportPresets[0].theme, 'dark'); assert.equal(prefs.viewportPresets[0].accent, '#123456');
  const values = new Map();
  applyApplicationTheme(prefs, { documentElement: { dataset: {}, style: { setProperty: (k, v) => values.set(k, v) } } });
  assert.equal(values.get('--tree-background'), '#112233'); assert.equal(values.get('--tree-font-size'), '17px');
  assert.equal(values.get('--tree-nodes-bone'), '#abcdef'); assert.equal(values.get('--tree-folders-Human'), '#fedcba');
});

test('malformed tree settings are bounded without mutating preset defaults', () => {
  const prefs = normalizePreferences({ rendererRevision: 3, theme: 'dark', viewportAppearance: { tree: { background: 'red; color: black', fontSize: 99, nodes: { bone: '#FEDCBA' }, folders: null } } });
  assert.equal(prefs.viewportAppearance.tree.background, presets['blender-style'].appearance.tree.background);
  assert.equal(prefs.viewportAppearance.tree.fontSize, 20); assert.equal(prefs.viewportAppearance.tree.nodes.bone, '#fedcba');
  prefs.viewportAppearance.tree.nodes.helper = '#000000';
  assert.notEqual(presets['blender-style'].appearance.tree.nodes.helper, '#000000');
});
