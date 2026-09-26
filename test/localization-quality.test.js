import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { russian, translate, setLanguage } from '../src/localization.js';
import spanish from '../src/locales/es-reviewed.json' with { type: 'json' };
import { chinese } from '../src/locales/short-ui-locales.js';
import { broadChinese } from '../src/locales/broad-ui-locales.js';
import { PAINT_MESSAGES } from '../src/paint-messages.js';
import { COMMANDS } from '../src/commands.js';
import { particleUVGroups, particleFlags } from '../src/particle-editing.js';
import { localizedCreateElement } from '../app/localized-element.js';
import viewMenu from '../src/view-menu.json' with { type: 'json' };

const packs = { ru: russian, es: spanish };
const slots = text => [...new Set(text.match(/\{\d+\}/g) || [])].sort();
// These slots are English inflection fragments ("s", " has", "s have"),
// not data. Count-based phrasing avoids importing English grammar into either locale.
const inflections = {
  'Copied {0} geoset{1}. Clipboard survives opening another model.': '{1}',
  '{0} track{1} baked.': '{1}',
  'Visibility and RGB baked for {0} checked geoset{1} in {2}.': '{1}',
  'Enter {0} {1} value{2}.': '{2}',
  'Enter {0} numeric value{1}.': '{1}',
  'Separated selected geometry into {0} new geoset{1}.': '{1}',
  '{0} geoset{1} multiple animation owners. Nothing has been changed. Review the proposed visibility owner below.': '{1}',
};

test('the entire community Chinese catalog stays byte-for-byte unchanged', () => {
  const catalog = { ...chinese, ...broadChinese };
  assert.equal(Object.keys(catalog).length, 321);
  assert.equal(createHash('sha256').update(JSON.stringify(catalog)).digest('hex'), 'f852b24437357b5b9947ca2eb95c4a0157b3621f85e373ed7aac0eaff9166398');
  for (const [source, expected] of Object.entries(catalog)) assert.equal(translate(source, 'zh'), expected, source);
});

test('Spanish covers the full Russian catalog and both packs preserve data placeholders', () => {
  for (const source of Object.keys(russian)) assert.ok(Object.hasOwn(spanish, source), source);
  for (const [locale, pack] of Object.entries(packs)) for (const [source, value] of Object.entries(pack)) {
    assert.ok(value.trim() && !/\ufffd|undefined/.test(value), `${locale}: ${source}`);
    assert.deepEqual(slots(value), slots(source).filter(slot => slot !== inflections[source]), `${locale}: ${source}`);
  }
});

test('all paint messages, commands, view controls, and particle controls have reviewed translations', () => {
  const brands = new Set(['BitsAndParts', 'Citadel Paint']);
  for (const [locale, pack] of Object.entries(packs)) {
    for (const [id, source] of Object.entries(PAINT_MESSAGES)) {
      let index = 0;
      const key = source.replace(/\{\w+\}/g, () => `{${index++}}`);
      assert.ok(Object.hasOwn(pack, key), `${locale}: ${id}`);
      const populated = source.replace(/\{\w+\}/g, '987');
      assert.equal(translate(populated, locale), pack[key].replace(/\{\d+\}/g, '987'), `${locale}: ${id}`);
    }
    const labels = [...COMMANDS.map(item => item.label), ...new Set(Object.values(viewMenu).flat().map(row => row[0])), ...particleFlags.map(row => row[0])];
    for (const [label] of particleUVGroups) labels.push(label, ...['Start', 'End', 'Repeat'].map(field => `${label} ${field}`));
    for (const label of labels) if (!brands.has(label)) assert.notEqual(translate(label, locale), label, `${locale}: ${label}`);
  }
});

test('Russian uses consistent editing terms and count-based grammar for singular and plural messages', () => {
  assert.equal(translate('Material Manager…', 'ru'), 'Редактор материалов…');
  assert.equal(translate('Review tint conflict', 'ru'), 'Проверить конфликт оттенков');
  assert.equal(translate('Mouse and general…', 'ru'), 'Мышь и общие настройки…');
  assert.equal(translate('Geoset Animation Manager…', 'es'), 'Gestor de animaciones de geoset…');
  assert.equal(translate('static RGB (1, 0, 0)', 'ru'), 'Статический RGB (1, 0, 0)');
  assert.equal(translate('2 RGB keys, linear, global sequence 1', 'ru'), 'Ключей RGB: 2, линейная интерполяция, глобальная последовательность 1');
  for (const count of [1, 2, 5, 21]) {
    assert.equal(translate(`Copied ${count} geoset${count === 1 ? '' : 's'}. Clipboard survives opening another model.`, 'ru'), `Скопировано геосетов: ${count}. Буфер сохранится при открытии другой модели.`);
    assert.equal(translate(`${count} track${count === 1 ? '' : 's'} baked.`, 'ru'), `Применено дорожек: ${count}.`);
    assert.equal(translate(`${count} track${count === 1 ? '' : 's'} baked.`, 'es'), `Pistas aplicadas: ${count}.`);
    assert.equal(translate(`Enter ${count} numeric value${count === 1 ? '' : 's'}.`, 'ru'), `Введите числовые значения в количестве ${count}.`);
  }
});

test('repeated language switches preserve user values, file paths, axes, and native shortcuts', () => {
  const { buildMenuTemplate } = createRequire(import.meta.url)('../electron/menu.cjs');
  const file = 'C:\\Models\\My Hero\\Head.mdx';
  for (const locale of ['ru', 'es', 'zh', 'mordor', 'en', 'ru', 'es', 'en']) {
    setLanguage(locale);
    const option = localizedCreateElement('option', null, 'Materials');
    assert.equal(option.props.value, 'Materials');
    assert.equal(localizedCreateElement('input', { value: 'Materials' }).props.value, 'Materials');
    assert.equal(localizedCreateElement('span', { translate: 'no' }, 'Materials').props.children, 'Materials');
    assert.equal(translate(file), file);
    const menu = buildMenuTemplate({ ...Object.fromEntries(COMMANDS.map(command => [command.id, command.defaultKeys])), open: ['F4'] }, () => {}, 'win32', [file], text => translate(text));
    assert.equal(menu[0].submenu[0].accelerator, 'F4');
    assert.equal(menu[0].submenu[0].registerAccelerator, false);
    assert.equal(menu[0].submenu[1].submenu[0].label, file);
  }
});

test('Mordor keeps technical tokens and file names recognizable in its existing joke mode', () => {
  for (const value of ['RGB', 'UV', 'MDX', 'CASC', 'XYZ', 'Ctrl+Shift+S', 'Hero.mdx', 'Textures/Head.blp']) assert.equal(translate(value, 'mordor'), value);
  const value = translate('Read docs/ADDONS.md before loading Hero.mdx with Ctrl+O.', 'mordor');
  assert.ok(value.includes('docs/ADDONS.md') && value.includes('Hero.mdx') && value.includes('Ctrl+O'));
  assert.ok(!value.includes('before loading'));
});
