import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../src/localization.js';
import { release015Chinese, release015Russian, release015Sources, release015Spanish } from '../src/locales/v015-ui-locales.js';

const packs = { ru: release015Russian, es: release015Spanish, zh: release015Chinese };
const slots = value => [...new Set(value.match(/\{\d+\}/g) || [])].sort();

test('0.15 feature text is translated in every available non-English language', () => {
  assert.ok(release015Sources.length > 200);
  for (const [locale, pack] of Object.entries(packs)) {
    assert.equal(Object.keys(pack).length, release015Sources.length, locale);
    for (const source of release015Sources) {
      assert.ok(pack[source]?.trim(), `${locale}: ${source}`);
      assert.deepEqual(slots(pack[source]), slots(source), `${locale}: ${source}`);
      assert.equal(translate(source, locale), pack[source], `${locale}: ${source}`);
    }
  }
  assert.notEqual(translate('Emitter Editor', 'mordor'), 'Emitter Editor');
  assert.notEqual(translate('Ribbon added. Drag its two ends to adjust the edge.', 'mordor'), 'Ribbon added. Drag its two ends to adjust the edge.');
});

test('0.15 dynamic feature messages preserve their data in every language', () => {
  for (const locale of ['ru', 'es', 'zh', 'mordor']) {
    assert.match(translate('Deleted 12 free vertices from selected geosets.', locale), /12/);
    if (locale !== 'mordor') assert.match(translate('Opening Fire Nova…', locale), /Fire Nova/);
    assert.match(translate('8 live sprites\/streaks · 3 ribbon segments', locale), /8/);
    assert.match(translate('8 live sprites\/streaks · 3 ribbon segments', locale), /3/);
  }
});
