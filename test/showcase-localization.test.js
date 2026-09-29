import test from 'node:test';
import assert from 'node:assert/strict';
import showcase from '../src/locales/showcase.json' with { type: 'json' };
import { translate, setLanguage } from '../src/localization.js';
import { localizedCreateElement } from '../app/localized-element.js';

test('every Showcase label has complete language packs with intact data slots', () => {
  const slots = text => [...text.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
  for (const [source, values] of Object.entries(showcase)) {
    assert.equal(values.length, 3, source);
    for (const [index, locale] of ['ru', 'es', 'zh'].entries()) {
      assert.ok(values[index].trim() && !values[index].includes('\ufffd'), source);
      assert.deepEqual(slots(values[index]), slots(source), `${locale}: ${source}`);
      if (!['Color', 'Zoom'].includes(source) && !(locale === 'zh' && source === 'Hive BBCode {0}')) assert.notEqual(translate(source, locale), source, `${locale}: ${source}`);
    }
    assert.notEqual(translate(source, 'mordor'), source, source);
  }
});

test('Showcase popup groups translate while authored names, text, and option values stay literal', () => {
  try {
    for (const locale of ['ru','es','zh','mordor']) {
      setLanguage(locale);
      assert.equal(localizedCreateElement('optgroup', { label: 'Included' }).props.label, translate('Included', locale));
      const option = localizedCreateElement('option', { translate:'no', value:'Portrait' }, 'Portrait');
      assert.equal(option.props.children, 'Portrait'); assert.equal(option.props.value, 'Portrait');
      const text = localizedCreateElement('textarea', { value: 'Your text' });
      assert.equal(text.props.value, 'Your text');
      assert.notEqual(translate('Capturing GIF frames… 50%', locale), 'Capturing GIF frames… 50%');
      assert.notEqual(translate('Place model bottom right', locale), 'Place model bottom right');
    }
  } finally { setLanguage('en'); }
});
