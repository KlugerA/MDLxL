// Rebuilt Electron acceptance; synthetic data and an isolated profile only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const cwd = process.cwd(), out = path.join(cwd, 'out/motion-inspector');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'motion-fixture.mdx'), saved = path.join(out, `motion-saved-${Date.now()}.mdx`);
  const doc = createDemoDocument();
  doc.apply('Synthetic holding example', ['Nodes', 'Sequences'], model => {
    const arm = model.Bones[0]; arm.Name = 'Arm';
    arm.Translation = { LineType: 1, Keys: [0, 1000, 2000, 2377, 3200].map(Frame => ({ Frame, Vector: new Float32Array([0, 0, 0]) })) };
    arm.Rotation = { LineType: 1, Keys: [0, 200, 400, 600, 800, 850, 1000].map(Frame => ({ Frame, Vector: new Float32Array(Frame >= 850 ? [0, 0, Math.SQRT1_2, Math.SQRT1_2] : [0, 0, 0, 1]) })) };
    arm.Rotation.Keys.push(...[2000, 2224, 2377, 2472, 2690, 2853, 2997, 3200].map(Frame => ({ Frame, Vector: new Float32Array(Frame === 2377 ? [0, 0, Math.sin(4 * Math.PI / 180), Math.cos(4 * Math.PI / 180)] : [0, 0, 0, 1]) })));
    model.Bones[1].Name = 'Sword'; model.PivotPoints[model.Bones[1].ObjectId][0] = 40;
    model.Sequences[0].Interval = new Uint32Array([0, 1000]);
    model.Sequences.push({ ...structuredClone(model.Sequences[0]), Name: 'Twitch', Interval: new Uint32Array([2000, 3200]) });
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const original = fs.readFileSync(fixture), errors = [], metrics = {};
  const app = await _electron.launch({ executablePath: path.join(cwd, 'node_modules/electron/dist/electron.exe'), args: [cwd, fixture], env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error' && /TypeError|ReferenceError/.test(message.text())) errors.push(message.text()); });
    await page.locator('[data-warmkey="animation"]').waitFor({ timeout: 60000 });
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
    const details = page.getByRole('dialog', { name: 'Motion warning details' });
    const holding = page.locator('.motion-reel-warning[aria-label*="holding-keys"]');
    const reel = page.locator('.classic-reel-track');
    async function menu() { await reel.click({ button: 'right', position: { x: 30, y: 46 } }); }
    async function rescan() {
      const count = await page.evaluate(() => window.motionScanEvents.length);
      await menu(); await page.getByRole('menuitem', { name: 'Find Motion Irregularities', exact: true }).click();
      await page.waitForFunction(count => window.motionScanEvents.length > count, count);
    }
    async function showDesired() { await menu(); await page.getByRole('menuitemcheckbox', { name: 'Show Desired' }).click(); }
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await holding.waitFor();
    metrics.scans = await page.evaluate(() => window.motionScanEvents);
    assert.ok(metrics.scans[0].ticks > 0);
    assert.equal(await page.getByRole('button', { name: 'Stop', exact: true }).isVisible(), true);
    assert.equal(await details.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Find Motion Irregularities', exact: true }).count(), 0);
    const sidebar = page.locator('.classic-sidebar'), viewport = page.locator('.classic-view');
    metrics.sidebarWidth = (await sidebar.boundingBox()).width; assert.ok(metrics.sidebarWidth < 190);
    const viewBefore = await viewport.boundingBox();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await menu();
    assert.equal(await page.getByRole('menuitem', { name: 'Find Motion Irregularities', exact: true }).count(), 0, 'Even the context menu stays unchanged before inspecting a warning');
    await page.locator('.classic-reel-frame>span').click();
    await page.screenshot({ path: path.join(out, '00-markers-only.png') });
    await page.locator('.classic-reel-key[data-frame="400"]').click({ force: true });
    assert.equal(await details.count(), 0, 'An ordinary key must not open any extra UI');
    await holding.click();
    assert.match(await page.getByLabel('Selected motion finding').innerText(), /keeps the old pose until 800 ms, leaving only 50 ms/);
    assert.equal(await page.getByLabel('Current animation frame').inputValue(), '800');
    assert.equal(await page.getByLabel('Movement bone or node').inputValue(), '0');
    assert.equal(await page.getByRole('button', { name: 'Delete selected key', exact: true }).isEnabled(), true);
    assert.equal(await details.locator('input,select,details').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Show Keys', exact: true }).count(), 0);
    metrics.popupHeight = (await details.boundingBox()).height; assert.ok(metrics.popupHeight < 230);
    assert.deepEqual(await viewport.boundingBox(), viewBefore);
    assert.equal((await sidebar.boundingBox()).width, metrics.sidebarWidth);
    await page.screenshot({ path: path.join(out, '01-holding-warning.png') });
    assert.equal(await page.locator('.classic-status').innerText().then(t => t.includes('Modified')), false);
    assert.equal(await page.locator('[data-warmkey="undo"]').isDisabled(), true);
    await page.getByRole('button', { name: 'Mark Desired', exact: true }).click();
    await page.getByRole('button', { name: 'Restore warning', exact: true }).waitFor();
    assert.equal(await holding.count(), 0);
    await rescan(); assert.equal(await holding.count(), 0);
    await page.getByRole('button', { name: 'Close motion warning', exact: true }).click();
    await showDesired(); await holding.click();
    await page.getByRole('button', { name: 'Restore warning', exact: true }).click();
    await page.getByRole('button', { name: 'Mark Desired', exact: true }).waitFor();
    await showDesired();
    assert.equal(await page.locator('[data-warmkey="undo"]').isDisabled(), true);
    // A previous range must not turn single-key keyboard deletion into a range delete.
    await page.getByRole('button', { name: 'Close motion warning', exact: true }).click();
    const reelBox = await reel.boundingBox();
    await page.mouse.click(reelBox.x + reelBox.width * .2, reelBox.y + 8);
    await page.keyboard.down('Shift'); await page.mouse.click(reelBox.x + reelBox.width * .6, reelBox.y + 8); await page.keyboard.up('Shift');
    assert.equal(await page.locator('.classic-reel-selection').count(), 1);
    await holding.click();
    assert.equal(await page.locator('.classic-reel-selection').count(), 0);
    assert.equal(await holding.getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Delete');
    await page.waitForFunction(() => document.querySelector('[aria-label="Selected motion finding"]')?.textContent.includes('Key deleted'));
    assert.equal(await page.locator('.classic-reel-key[data-frame="800"]').count(), 0);
    assert.equal(await page.locator('.classic-reel-key[data-frame="400"]').count(), 1);
    assert.equal(await page.locator('.classic-reel-key[data-frame="600"]').count(), 1);
    await page.locator('[data-warmkey="undo"]').click(); await holding.waitFor();
    await page.locator('[data-warmkey="redo"]').click();
    await page.waitForFunction(() => !document.querySelector('.classic-reel-key[data-frame="800"]'));
    await page.locator('[data-warmkey="undo"]').click(); await holding.waitFor(); await holding.click();
    await page.getByRole('button', { name: 'Mark Desired', exact: true }).click();
    await page.getByRole('button', { name: 'Restore warning', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close motion warning', exact: true }).click();
    // The same one-key spike as Knight04: use the direct button during playback.
    await page.getByLabel('Movement current sequence').selectOption('1');
    const spike = page.locator('.motion-reel-warning[aria-label*="pose-spike"]');
    await spike.waitFor(); await spike.click();
    assert.equal(await page.getByLabel('Current animation frame').inputValue(), '2377');
    assert.match(await page.getByLabel('Selected motion finding').innerText(), /briefly turns the bone, then the next key turns it back/);
    await page.screenshot({ path: path.join(out, '02-direct-key.png') });
    await page.getByRole('button', { name: 'Replay section', exact: true }).click();
    await page.waitForFunction(() => +document.querySelector('[aria-label="Current animation frame"]').value > 2050);
    await page.getByRole('button', { name: 'Delete selected key', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Selected motion finding"]')?.textContent.includes('Key deleted'));
    assert.equal(await page.getByLabel('Current animation frame').inputValue(), '2377');
    assert.equal(await page.getByRole('button', { name: 'Delete selected key', exact: true }).isDisabled(), true);
    await page.locator('[data-warmkey="undo"]').click(); await spike.waitFor();
    await page.locator('[data-warmkey="redo"]').click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Selected motion finding"]')?.textContent.includes('Key deleted'));
    await page.getByRole('button', { name: 'Replay section', exact: true }).click();
    await page.waitForFunction(() => +document.querySelector('[aria-label="Current animation frame"]').value > 2050);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.screenshot({ path: path.join(out, '03-key-deleted.png') });
    await app.evaluate(({ dialog }, saved) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: saved }); }, saved);
    await page.keyboard.press('Control+Shift+s'); await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.classic-status')?.textContent.includes('Modified'));
    const expected = openDocument(original, 'fixture.mdx');
    expected.apply('Delete only the suspect rotation key', ['Nodes'], current => { const arm = current.Bones[0]; arm.Rotation.Keys = arm.Rotation.Keys.filter(k => k.Frame !== 2377); });
    assert.deepEqual(fs.readFileSync(saved), Buffer.from(expected.serialize('mdx')), 'Only the one rotation key may change, including when a translation key shares its time');
    await page.getByRole('button', { name: 'Close motion warning' }).click();
    await app.evaluate(({ dialog }, saved) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [saved] }); }, saved);
    await page.keyboard.press('Control+o'); await page.waitForFunction(() => document.title.includes('motion-saved'));
    await page.locator('[data-warmkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption('0');
    await rescan();
    assert.equal(await holding.count(), 0); assert.equal(await details.count(), 0);
    await showDesired(); await holding.waitFor();
    await holding.click(); await page.locator('.classic-reel-key[data-frame="400"]').click({ force: true });
    assert.equal(await details.count(), 0, 'Choosing another ordinary key dismisses the old deletion target');
    await holding.click(); await page.getByRole('button', { name: 'Close motion warning' }).focus(); await page.keyboard.press('Escape');
    assert.equal(await details.count(), 0); assert.equal((await sidebar.boundingBox()).width, metrics.sidebarWidth);
    await page.screenshot({ path: path.join(out, '04-reopened-desired.png') });
    assert.deepEqual(fs.readFileSync(fixture), original); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'electron-results.json'), JSON.stringify({ ...metrics, errors, passed: true }, null, 2));
    console.log('PASS', JSON.stringify(metrics));
  } catch (error) {
    console.error('Renderer errors:', errors);
    const page = await app.firstWindow();
    await page.screenshot({ path: path.join(out, 'failure.png') });
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
