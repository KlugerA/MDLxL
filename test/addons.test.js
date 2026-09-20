import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateAddon,installAddon,loadAddons} from '../src/addons.js';
const fixture=JSON.parse(readFileSync(new URL('../Addons/inspection-example.json',import.meta.url)));
test('command add-ons install, disable and restore without running actions',()=>{
  const installed=installAddon([],fixture);assert.equal(installed[0].enabled,true);
  installed[0].enabled=false;assert.deepEqual(loadAddons(JSON.stringify(installed)),installed);
  assert.equal(validateAddon(fixture).actions[0].command,'fit');
});
test('unsupported API and initialization/command failure preserve installed list',()=>{
  const installed=installAddon([],fixture), before=structuredClone(installed);
  assert.throws(()=>installAddon(installed,{...fixture,id:'second',apiVersion:2}),/Unsupported/);
  assert.throws(()=>installAddon(installed,{...fixture,id:'second',actions:[{id:'bad',label:'Bad',command:'not-a-command'}]}),/Unknown/);
  assert.throws(()=>installAddon(installed,fixture),/already installed/);
  assert.deepEqual(installed,before);
});
