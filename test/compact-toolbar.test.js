import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/portrait-view.css',import.meta.url),'utf8');
const quick=readFileSync(new URL('../app/QuickDisplay.jsx',import.meta.url),'utf8');

test('Black is short and the display options remain visible',()=>{
  assert.match(app,/row.index === null \? row.name :/);
  assert.doesNotMatch(app,/Neutral Hostile/);
  assert.match(css,/\.classic-app>\.classic-toolbar\{flex-wrap:nowrap\}/);
  assert.match(css,/\.editor-modules \.quick-display\{[^}]*flex-wrap:nowrap/);
  assert.doesNotMatch(css,/quick-display\[data-expanded="true"\][^\n]*flex-wrap:wrap/);
  assert.match(css,/\.editor-modules \.quick-display-options label\{[^}]*font-size:9\.5px/);
  assert.match(quick,/VIEW_MENU\[viewMode\]/);
  assert.match(quick,/>Clear<\/button>/);
  assert.ok(quick.indexOf('>Clear</button>') < quick.indexOf('VIEW_MENU[viewMode]'));
  assert.doesNotMatch(quick,/>Reveal<\/button>|>Textured View<\/button>/);
});

test('Vis is a reversible presentation toggle, not a model or editing command',()=>{
  assert.match(app,/\[visUI, setVisUI\] = useState\(false\)/);
  assert.match(app,/data-vis-ui=\{visUI \|\| undefined\}/);
  assert.match(app,/<Tool className="vis-toggle".*?badge=\{visUI \? 'XL' : 'VIS'\}.*?onClick=\{\(\) => setVisUI\(value => !value\)\}/);
  const group=app.match(/<div className="classic-toolbar-group toolbar-visibility">(.*?)<\/div>/)[1];
  assert.doesNotMatch(group,/visUI/);
  assert.match(group,/onClick=\{hide\}/);
  assert.match(group,/onClick=\{\(\) => setHidden\(\{\}\)\}/);
  assert.match(css,/data-vis-ui\]>\.classic-modules/);
  assert.match(css,/data-vis-ui\]>\.classic-modules \.quick-display-options/);
  assert.doesNotMatch(css,/data-vis-ui[^{}]*portrait-toolbar/);
});

test('quick display follows RGB controls in the editor row and strengths stay in the top toolbar',()=>{
  const toolbar=app.slice(app.indexOf('<div className="classic-toolbar">'),app.indexOf('<div className="classic-modules"'));
  const editor=app.slice(app.indexOf('<div className="editor-modules"'),app.indexOf('<div className="module-divider"'));
  assert.doesNotMatch(toolbar,/<QuickDisplay/);
  assert.ok(editor.indexOf('RGB preview animation')<editor.indexOf('<QuickDisplay'));
  assert.equal((app.match(/<QuickDisplay/g)||[]).length,1);
  assert.doesNotMatch(app,/className="module-hint"/);
  assert.match(toolbar,/\{inputStrength\}\s*<LanguageSwitch/);
  assert.match(css,/team-picker select\{width:auto;min-width:0;max-width:none\}/);
});

test('module menu remains available with the custom module row hidden',()=>{
  const {buildMenuTemplate}=require('../electron/menu.cjs');
  const dispatched=[];
  const menu=buildMenuTemplate({},id=>dispatched.push(id)).find(entry=>entry.label==='Modules');
  for(const label of ['Movement','Animations: visibility and RGB'])menu.submenu.find(item=>item.label===label).click();
  assert.deepEqual(dispatched,['animation','animations']);
  assert.match(app,/\['Modules', \[\['Vertices', 'vertices'\]/);
  assert.match(app,/mode === 'animation' && <PortraitToolbar/);
});
