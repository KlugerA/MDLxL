import test from 'node:test';import assert from 'node:assert/strict';
import {translate,setLanguage} from '../src/localization.js';
import {localizedCreateElement} from '../app/localized-element.js';
import {DESCRIPTORS,CONTEXTS} from '../src/texture-library/search-language.mjs';
import {EXTRA_CONTEXTS} from '../src/texture-library/ultra-vocabulary.mjs';
import {LABELS,GROUPS,KINDS} from '../src/texture-library/materials.mjs';
test('language can switch without changing stored option values, inputs or model paths',()=>{
 setLanguage('ru');
 assert.equal(translate('Settings'),'Настройки');assert.equal(translate('Save as…'),'Сохранить как…');
 const option=localizedCreateElement('option',null,'Materials');assert.equal(option.props.children,'Материалы');assert.equal(option.props.value,'Materials');
 const modelName=localizedCreateElement('input',{value:'Materials',title:'Settings'});assert.equal(modelName.props.value,'Materials');assert.equal(modelName.props.title,'Настройки');
 const path='C:\\Models\\Textures\\Head.blp';assert.equal(translate(path),path);
 assert.equal(localizedCreateElement('span',{translate:'no'},'Materials').props.children,'Materials');
 assert.equal(translate('Opened Hero.mdx'),'Открыт файл Hero.mdx');
 assert.equal(translate('Copied 1 geoset. Clipboard survives opening another model.'),'Скопировано геосетов: 1. Буфер сохранится при открытии другой модели.');
 setLanguage('en');assert.equal(localizedCreateElement('button',null,'Settings').props.children,'Settings');
});
test('Russian texture search translates the descriptive vocabulary without changing its identifiers',()=>{
 const labels=[...DESCRIPTORS.map(d=>d.label),...CONTEXTS.map(c=>c[1]),...EXTRA_CONTEXTS.map(c=>c[1]),...Object.values(LABELS),...GROUPS.flatMap(g=>[g.name,g.hint]),...Object.values(KINDS)];
 for(const label of new Set(labels))assert.notEqual(translate(label,'ru'),label,`Untranslated search label: ${label}`);
 assert.equal(LABELS['human-body'],'Human body');
});
test('Spanish, Chinese, and Mordor localize the concise editor controls',()=>{
 for(const [locale, expected] of [['es','Guardar'],['zh','保存']]){
   setLanguage(locale); assert.equal(translate('Save'),expected); assert.notEqual(translate('Settings'),'Settings');
 }
 const mordorSave = translate('Save','mordor');
 assert.notEqual(mordorSave,'Save');
 assert.match(mordorSave,/^(?:ash|nazg|durb|atulûk|gimb|krimp|burzum|ishi|agh|ghâsh|snaga|uruk|lugbúrz|nazgûl)$/);
 setLanguage('en');
});
test('new language packs include the longer help and Settings guidance',()=>{
 const help='Rotate the model to the required viewpoint, or choose a standard projection plane.';
 const settings='MDLVis Vanilla is the default. Presets change only the editor viewport and never alter model geometry, materials, UVs, animations, or saved MDL/MDX data.';
 for(const locale of ['es','zh','mordor']){
   assert.notEqual(translate(help,locale),help,`${locale} projection guidance`);
   assert.notEqual(translate(settings,locale),settings,`${locale} appearance guidance`);
 }
});
test('Mordor mode ciphers otherwise untranslated UI prose into Black Speech vocabulary',()=>{
 const source='This unusual explanatory sentence is intentionally not in a translation pack.';
 const translated=translate(source,'mordor');
 assert.notEqual(translated,source);
 assert.match(translated,/^(?:ash|nazg|durb|atulûk|gimb|krimp|burzum|ishi|agh|ghâsh|snaga|uruk|lugbúrz|nazgûl)/);
});
