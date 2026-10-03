import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/modules.css',import.meta.url),'utf8');

test('every module icon keeps its action and carries a visible short label',()=>{
  for(const [action,className,label] of [
    ['textureLibrary','library-tool','LIBR'],
    ['forge','forge-tool','FRG'],
    ['bitsAndParts','bits-tool','BITZ'],
    ['optimizeModel','optimizer-tool','OPXL'],
  ]){
    assert.match(app,new RegExp(`action="${action}" className="${className}"[^>]*badge="${label}"`));
  }
  assert.ok(app.includes('action="particles" className="emitter-tool" icon="btn-mana-flare" badge={<><b>E</b><b>M</b><b>T</b><b>R</b></>}'));
  assert.match(app,/className="pressed-keys-tool" data-warmkey="pressedKeys"/);
  assert.match(app,/<b>K<\/b><b>E<\/b><b>Y<\/b>/);
  assert.match(app,/className="vis-toggle"[^>]*badge=\{visUI \? 'XL' : 'VIS'\}/);
});

test('new labels use transparent, distinct high-contrast color themes',()=>{
  assert.match(css,/\.classic-modules \.library-tool \.module-icon-badge\{color:#ffc928\}/);
  assert.match(css,/\.classic-modules \.forge-tool \.module-icon-badge\{color:#54c8ff\}/);
  assert.match(css,/\.classic-modules \.bits-tool \.module-icon-badge\{color:#f0f3f5\}/);
  assert.match(css,/\.classic-modules \.optimizer-tool \.module-icon-badge\{color:#72ef66\}/);
  assert.match(css,/\.classic-modules \.pressed-keys-tool>span,\.classic-modules \.module-icon-badge\{[^}]*background:transparent/);
});
