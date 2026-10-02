import test from 'node:test';
import assert from 'node:assert/strict';
import {translate} from '../src/localization.js';
import {paintRussian,paintSpanish,paintChinese,paintSources} from '../src/locales/paint-ui-locales.js';
import {readFileSync} from 'node:fs';
const slots=s=>[...new Set(s.match(/\{\d+\}/g)||[])].sort();
test('Paint translations keep data placeholders and cover all supported languages',()=>{
 assert.equal(new Set(paintSources).size,paintSources.length);
 for(const pack of [paintRussian,paintSpanish,paintChinese])for(const source of paintSources){assert.ok(pack[source]?.trim(),source);assert.deepEqual(slots(pack[source]),slots(source),source);assert.ok(!/\ufffd|undefined/.test(pack[source]),source);}
 for(const locale of ['ru','es','zh','mordor'])for(const label of ['Where to work','Hold to paint from outside the edge','Related colors','Brush shapes','Finish the outline first: Enter. Esc cancels it.','Riveted plate detail','Dark wood grain'])assert.notEqual(translate(label,locale),label,locale+': '+label);
});
test('Paint shortcut descriptions and selection instructions have localized text',()=>{
 const layout=readFileSync(new URL('../app/PaintStudioLayout.jsx',import.meta.url),'utf8');const shortcuts=layout.match(/const shortcuts=(.*);/)[1];
 const labels=[...shortcuts.matchAll(/\['[^']+','([^']+)'\]/g)].map(m=>m[1]);assert.ok(labels.length>25);
 for(const locale of ['ru','es','zh'])for(const label of labels)assert.notEqual(translate(label,locale),label,locale+': '+label);
});
