// Native Electron acceptance test. Run after building; uses only a synthetic model
// and a separate profile in out/motion-inspector. Never opens user model files.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const cwd = process.cwd(), out = path.join(cwd, 'out/motion-inspector');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'motion-fixture.mdx'), saved = path.join(out, 'motion-saved.mdx');
  const doc = createDemoDocument();
  doc.apply('Synthetic holding example', ['Nodes', 'Sequences'], model => {
    const arm = model.Bones[0]; arm.Name = 'Arm'; delete arm.Translation;
    arm.Rotation = { LineType: 1, Keys: [0, 200, 400, 600, 800, 850, 1000].map(Frame => ({ Frame, Vector: new Float32Array(Frame >= 850 ? [0, 0, Math.SQRT1_2, Math.SQRT1_2] : [0, 0, 0, 1]) })) };
    model.Bones[1].Name = 'Sword'; model.PivotPoints[model.Bones[1].ObjectId][0] = 40;
    model.Sequences[0].Interval = new Uint32Array([0, 1000]);
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const original = fs.readFileSync(fixture), errors = [], metrics = {};
  const app = await _electron.launch({ executablePath: path.join(cwd, 'node_modules/electron/dist/electron.exe'), args: [cwd, fixture], env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    await page.locator('[data-warmkey="animation"]').waitFor({ timeout: 60000 });
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    const scan = page.getByRole('button', { name: 'Find Motion Irregularities', exact: true });
    const results = page.getByLabel('Motion findings');
    await page.evaluate(() => {
      window.motionTicks = 0; window.motionScanEvents = []; window.motionTimer = setInterval(() => window.motionTicks++, 5);
      const Original = window.Worker;
      window.Worker = class extends Original {
        constructor(...args) {
          super(...args);
          if (String(args[0]).includes('motion-scan')) {
            const start = performance.now(), ticks = window.motionTicks;
            this.addEventListener('message', ({ data }) => { if (data.result) window.motionScanEvents.push({ ms: performance.now() - start, ticks: window.motionTicks - ticks }); });
          }
        }
      };
    });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await scan.click(); await results.getByRole('button').first().waitFor();
    metrics.scans = await page.evaluate(() => window.motionScanEvents);
    assert.ok(metrics.scans[0].ticks > 0);
    assert.equal(await page.getByRole('button', { name: 'Stop', exact: true }).isVisible(), true);
    const hold = results.getByRole('button').filter({ hasText: 'holding keys' }).first();
    await hold.click();
    assert.match(await page.getByLabel('Selected motion finding').innerText(), /4 intermediate keys.*final 50 ms/s);
    assert.equal(await page.getByLabel('Current animation frame').inputValue(), '800');
    assert.equal(await page.getByLabel('Movement bone or node').inputValue(), '0');
    await page.screenshot({ path: path.join(out, '01-holding-warning.png') });
    assert.equal(await page.locator('.classic-status').innerText().then(t => t.includes('Modified')), false);
    assert.equal(await page.locator('[data-warmkey="undo"]').isDisabled(), true);
    await page.getByRole('button', { name: 'Mark Desired', exact: true }).click();
    assert.equal(await results.getByRole('button').filter({ hasText: 'holding keys' }).count(), 0);
    await scan.click(); await scan.waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.motion-body>button').disabled);
    assert.equal(await results.getByRole('button').filter({ hasText: 'holding keys' }).count(), 0);
    await page.getByLabel('Show Desired', { exact: true }).check(); await results.getByRole('button').filter({ hasText: 'holding keys' }).first().click();
    await page.getByRole('button', { name: 'Restore warning', exact: true }).click();
    await page.getByLabel('Show Desired', { exact: true }).uncheck();
    assert.equal(await page.locator('[data-warmkey="undo"]').isDisabled(), true);
    await page.getByRole('button', { name: 'Replay section', exact: true }).click();
    await page.waitForFunction(() => +document.querySelector('[aria-label="Current animation frame"]').value > 20);
    assert.ok(+await page.getByLabel('Current animation frame').inputValue() <= 1000);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByRole('button', { name: 'Full animation', exact: true }).click();
    await page.locator('.classic-reel-key[data-frame="400"]').click({ force: true });
    await page.waitForFunction(() => document.querySelector('[aria-label="Current animation frame"]').value === '400');
    await page.locator('.motion-key-list').getByRole('button', { name: '800 ms', exact: true }).click();
    const rotation = page.getByLabel('Motion Z (degrees)', { exact: true });
    await rotation.fill('30'); await rotation.press('Enter');
    assert.ok(Math.abs(+await rotation.inputValue() - 30) < .01);
    assert.match(await page.locator('.motion-inspector').innerText(), /Animation changed/);
    await page.screenshot({ path: path.join(out, '02-numeric-pose.png') });
    // Movement's existing workplane drag operates in blank viewport space.
    await page.locator('[data-warmkey="workplaneEnabled"]').check();
    const canvas = page.locator('.game-preview-surface>canvas').filter({ hasNot: page.locator('[aria-hidden]') }).first();
    const box = await canvas.boundingBox(); assert.ok(box);
    await page.mouse.move(box.x + box.width * .75, box.y + box.height * .45);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .75 + 40, box.y + box.height * .45, { steps: 8 });
    await page.waitForFunction(() => document.querySelector('.motion-pose')?.textContent.includes('Posing preview'));
    metrics.dragPreview = +await rotation.inputValue();
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector('.motion-pose')?.textContent.includes('Posing preview'));
    metrics.dragCommitted = +await rotation.inputValue(); assert.ok(Math.abs(metrics.dragCommitted - 30) > .1);
    await page.locator('[data-warmkey="undo"]').click();
    await page.waitForFunction(() => Math.abs(+document.querySelector('[aria-label="Motion Z (degrees)"]').value - 30) < .01);
    await page.locator('[data-warmkey="redo"]').click();
    await page.waitForFunction(value => Math.abs(+document.querySelector('[aria-label="Motion Z (degrees)"]').value - value) < .01, metrics.dragCommitted);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(out, '03-visual-pose.png') });
    // Verify data through a real save and reopen, then test persistent decisions.
    await scan.click(); await results.getByRole('button').first().waitFor();
    const first = results.getByRole('button').first(); metrics.desiredLabel = (await first.innerText()).replace(/^[⚠✓]\s*/, ''); await first.click();
    await page.getByRole('button', { name: 'Mark Desired', exact: true }).click();
    await app.evaluate(({ dialog }, saved) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: saved }); }, saved);
    await page.keyboard.press('Control+Shift+s'); await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.classic-status')?.textContent.includes('Modified'));
    const reopened = openDocument(fs.readFileSync(saved), 'saved.mdx');
    assert.equal(reopened.model.Bones[0].Rotation.Keys.length, 7);
    assert.deepEqual(reopened.model.Geosets, openDocument(original, 'fixture.mdx').model.Geosets);
    const savedRotation = reopened.model.Bones[0].Rotation.Keys.find(k => k.Frame === 800).Vector;
    assert.ok(Math.abs(savedRotation[2] - Math.sin(metrics.dragCommitted * Math.PI / 360)) < 1e-4);
    await app.evaluate(({ dialog }, saved) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [saved] }); }, saved);
    await page.keyboard.press('Control+o'); await page.waitForFunction(() => document.title.includes('motion-saved'));
    await page.locator('[data-warmkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption('0');
    await scan.click(); await page.waitForFunction(() => document.querySelector('.motion-body')?.textContent.includes('inspection hints'));
    assert.ok(!(await results.innerText()).includes(metrics.desiredLabel));
    await page.getByLabel('Show Desired', { exact: true }).check();
    await page.screenshot({ path: path.join(out, '04-reopened-desired.png') });
    assert.ok((await results.innerText()).includes(metrics.desiredLabel));
    assert.deepEqual(fs.readFileSync(fixture), original); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'electron-results.json'), JSON.stringify({ ...metrics, errors, passed: true }, null, 2));
    console.log('PASS', JSON.stringify(metrics));
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
