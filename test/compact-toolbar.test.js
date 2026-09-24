import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/portrait-view.css',import.meta.url),'utf8');
const quick=readFileSync(new URL('../app/QuickDisplay.jsx',import.meta.url),'utf8');

test('Black is short and the collapsed toolbar stays compact',()=>{
  assert.match(app,/row.index === null \? row.name :/);
  assert.doesNotMatch(app,/Neutral Hostile/);
  assert.match(css,/\.classic-app>\.classic-toolbar\{flex-wrap:nowrap\}/);
  assert.match(css,/\.classic-toolbar \.quick-display\{[^}]*flex-wrap:nowrap/);
  assert.doesNotMatch(css,/quick-display\[data-expanded="true"\][^\n]*flex-wrap:wrap/);
  assert.match(css,/\.classic-toolbar \.quick-display-options label\{[^}]*font-size:9\.5px/);
  assert.ok(quick.indexOf('>Textured View</button>')<quick.indexOf('>Clear</button>'));
  assert.ok(quick.indexOf('>Clear</button>')<quick.indexOf('>Reveal</button>'));
  for(const action of ['cleanView','grid:small','grid:xz','grid:yz','grid:xy','axes'])assert.match(quick,new RegExp(`HIDDEN_QUICK_ACTIONS = new Set\\(\\[[^\\]]*'${action}'`));
});

test('Vis is a reversible presentation toggle, not a model or editing command',()=>{
  assert.match(app,/\[visUI, setVisUI\] = useState\(false\)/);
  assert.match(app,/data-vis-ui=\{visUI \|\| undefined\}/);
  assert.match(app,/onClick=\{\(\) => setVisUI\(value => !value\)\}>\{visUI \? 'XL' : 'Vis'\}/);
  const group=app.match(/<div className="classic-toolbar-group toolbar-visibility">(.*?)<\/div>/)[1];
  assert.ok(group.indexOf("'Vis'")<group.indexOf('data-warmkey="hide"'));
  assert.match(group,/onClick=\{hide\}/);
  assert.match(group,/onClick=\{\(\) => setHidden\(\{\}\)\}/);
  assert.match(css,/data-vis-ui\]>\.classic-modules/);
  assert.match(css,/data-vis-ui\]>\.classic-toolbar \.quick-display-options/);
  assert.doesNotMatch(css,/data-vis-ui[^{}]*portrait-toolbar/);
});

test('quick display follows team picker, strengths replace hints, capture is Animations only',()=>{
  const toolbar=app.slice(app.indexOf('<div className="classic-toolbar">'),app.indexOf('<div className="classic-modules"'));
  assert.ok(toolbar.indexOf('toolbar-team-color')<toolbar.indexOf('<QuickDisplay'));
  assert.ok(toolbar.indexOf('<QuickDisplay')<toolbar.indexOf('<LanguageSwitch'));
  assert.equal((app.match(/<QuickDisplay/g)||[]).length,1);
  assert.doesNotMatch(app,/className="module-hint"/);
  assert.match(app,/animationPanel === 'animations' && <AnimationPreviewTools/);
  assert.match(app,/<\/>\}\s*\{inputStrength\}\s*<\/div>/);
  assert.match(css,/team-picker select\{width:auto;min-width:0;max-width:none\}/);
});

test('module menu remains available with the custom module row hidden',()=>{
  const {buildMenuTemplate}=require('../electron/menu.cjs');
  const dispatched=[];
  const menu=buildMenuTemplate({},id=>dispatched.push(id)).find(entry=>entry.label==='Modules');
  for(const label of ['Movement','Animations: visibility and RGB'])menu.submenu.find(item=>item.label===label).click();
  assert.deepEqual(dispatched,['animation','animations']);
  assert.match(app,/\['Modules', \[\['Vertices', 'vertices'\]/);
  assert.match(app,/animationPanel === 'movement' && <PortraitToolbar/);
});
