const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const output = path.resolve('out/grabthrough-ui'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(output, 'grabthrough.mdx');
  fs.writeFileSync(fixture, Buffer.from(createStarterDocument().serialize('mdx')));
  const app = await _electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) },
    timeout: 60000,
  });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(30000);
    const marqueeAll = async locator => {
      const box = await locator.boundingBox(); assert.ok(box);
      await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10);
      await page.mouse.down();
      await page.mouse.move(box.x + 5, box.y + 5, { steps: 8 });
      await page.mouse.up();
    };
    const selectedCount = async () => Number(await page.locator('.classic-counts>div').nth(1).locator('span').textContent());
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    const vertexToggle = page.getByLabel('Grabthrough');
    assert.equal(await vertexToggle.isChecked(), false, 'Vertex Grabthrough defaults off');
    await page.getByLabel('View direction', { exact: true }).selectOption('front');
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    await marqueeAll(page.getByLabel('3D model viewport'));
    assert.equal(await selectedCount(), 4, 'Vertex textured selection excludes the hidden rear vertices');
    await vertexToggle.check(); assert.equal(await vertexToggle.isChecked(), true);
    await marqueeAll(page.getByLabel('3D model viewport'));
    assert.equal(await selectedCount(), 8, 'Vertex Grabthrough selects the hidden rear vertices');
    await vertexToggle.uncheck();
    await page.screenshot({ path: path.join(output, 'vertex-grabthrough.png') });

    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor({ timeout: 60000 });
    const bonesToggle = page.getByLabel('Grabthrough');
    assert.equal(await bonesToggle.isChecked(), false, 'Bones Grabthrough defaults off');
    await marqueeAll(page.locator('.game-preview-surface canvas').first());
    await page.getByRole('button', { name: 'Vertices', exact: true }).click();
    await page.getByLabel('3D model viewport').waitFor();
    assert.equal(await selectedCount(), 4, 'Bones textured selection excludes the hidden rear vertices');

    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor();
    await page.getByLabel('Grabthrough').check();
    await marqueeAll(page.locator('.game-preview-surface canvas').first());
    await page.getByRole('button', { name: 'Vertices', exact: true }).click();
    await page.getByLabel('3D model viewport').waitFor();
    assert.equal(await selectedCount(), 8, 'Bones Grabthrough selects the hidden rear vertices');

    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor();
    await page.screenshot({ path: path.join(output, 'bones-grabthrough.png') });

    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    assert.equal(await page.getByLabel('Grabthrough').count(), 0, 'Grabthrough stays scoped to Vertex and Bones');
    console.log('Grabthrough is visible in Vertex and Bones, defaults off, toggles on, and stays out of Movement.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
