// Rebuilt Electron acceptance for direct Movement keyframe deletion.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const cwd = process.cwd(), out = path.join(cwd, 'out/keyframe-delete');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'keyframe-delete.mdx');
  const doc = createDemoDocument();
  const key = (Frame, Vector) => ({ Frame, Vector: new Float32Array(Vector) });
  doc.apply('Keyframe delete fixture', ['Nodes'], model => {
    const root = model.Bones[0], rune = model.Bones[1];
    root.Translation.Keys.push(key(377, [1, 2, 3]), key(521, [2, 3, 4]), key(643, [3, 4, 5]));
    root.Rotation.Keys.push(key(377, [0, 0, 0, 1]), key(643, [0, 0, 0, 1]));
    rune.Translation = { LineType: 1, Keys: [key(377, [5, 0, 0])] };
    model.GeosetAnims[4].Alpha.Keys.push(key(377, [0.7]));
    for (const track of [root.Translation, root.Rotation, rune.Translation, model.GeosetAnims[4].Alpha]) track.Keys.sort((a, b) => a.Frame - b.Frame);
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));

  const app = await _electron.launch({ executablePath: path.join(cwd, 'node_modules/electron/dist/electron.exe'), args: [cwd, fixture], env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await page.locator('[data-warmkey="animation"]').click();
    const reel = page.locator('.classic-reel-track'), frameInput = page.getByLabel('Current animation frame');
    const marker = frame => page.locator(`.classic-reel-key[data-frame="${frame}"]`);
    async function clickKey(frame) {
      await marker(frame).waitFor();
      const box = await marker(frame).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + 4);
      assert.equal(await frameInput.inputValue(), String(frame), 'Click selects the exact stored frame');
    }
    async function deleteKey(frame) {
      await clickKey(frame); await page.keyboard.press('Delete');
      await marker(frame).waitFor({ state: 'detached' });
    }
    await page.getByLabel('Movement current sequence').selectOption('-1');
    await deleteKey(377); // All line: remove all editable keys at the clicked time.
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => !document.querySelector('.classic-status')?.textContent.includes('Modified'));
    let saved = openDocument(fs.readFileSync(fixture), 'keyframe-delete.mdx').model;
    assert.equal(saved.Bones[0].Translation.Keys.some(key => key.Frame === 377), false);
    assert.equal(saved.Bones[0].Rotation.Keys.some(key => key.Frame === 377), false);
    assert.equal(saved.Bones[1].Translation.Keys.some(key => key.Frame === 377), false);
    assert.equal(saved.GeosetAnims[4].Alpha.Keys.some(key => key.Frame === 377), false);

    await page.getByLabel('Movement bone or node').selectOption('0');
    await page.getByRole('group', { name: 'Movement tool' }).getByRole('button', { name: 'Rotate', exact: true }).click();
    await page.getByLabel('Highlight KF').check();
    assert.equal(await marker(521).count(), 0, 'Rotation highlight does not display a translation-only key');
    await deleteKey(643);
    await page.getByRole('group', { name: 'Movement tool' }).getByRole('button', { name: 'Select', exact: true }).click();
    await deleteKey(521); // Select tool still edits visible keys of the selected bone.
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => !document.querySelector('.classic-status')?.textContent.includes('Modified'));
    saved = openDocument(fs.readFileSync(fixture), 'keyframe-delete.mdx').model;
    assert.equal(saved.Bones[0].Rotation.Keys.some(key => key.Frame === 643), false);
    assert.equal(saved.Bones[0].Translation.Keys.some(key => key.Frame === 643), true, 'Other channels survive Highlight KF deletion');
    assert.equal(saved.Bones[0].Translation.Keys.some(key => key.Frame === 521), false);
    assert.equal(saved.Bones[0].Translation.Keys.some(key => key.Frame === 1000), true);
    assert.equal(await reel.count(), 1);
    console.log('PASS: exact click, Del, Highlight KF scope, Select tool, and saved MDX');
  } finally {
    await app.evaluate(({ app }) => app.exit(0));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
