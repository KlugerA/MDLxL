// Run against the rebuilt bundle:
// $env:MDLXL_PLAYWRIGHT_MODULE='<path-to-playwright>'; node test/mesh-density.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const fixture = process.env.MDLXL_DENSITY_MODEL || 'C:/Users/PC/Desktop/sd.mdx';
const profile = path.join(root, 'out', `mesh-density-profile-${Date.now()}`);
const output = path.join(root, 'out', 'mesh-density-review');

async function setRange(locator, value) {
  await locator.evaluate((element, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(element, String(nextValue));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

(async () => {
  if (!fs.existsSync(fixture)) throw Error(`Missing supplied fixture: ${fixture}`);
  fs.mkdirSync(output, { recursive: true });
  const original = fs.readFileSync(fixture);
  const app = await _electron.launch({
    executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', root, fixture],
    cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile },
    timeout: 60000,
  });
  let uv;
  try {
    const main = await app.firstWindow();
    main.setDefaultTimeout(30000);
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setBackgroundThrottling(false);
      window.setPosition(-3000, 0);
      window.showInactive();
    });

    await main.locator('[data-warmkey="forge"]').click();
    await main.getByRole('button', { name: 'Pick geoset', exact: true }).click();
    await main.getByLabel('Forge geoset').selectOption('1');
    const forgeSlider = main.locator('.forge-density-body').getByLabel('Triangle density');
    assert.equal(await forgeSlider.getAttribute('max'), '75', 'the slider stops when this surface reaches its six-cell grid limit');
    await setRange(forgeSlider, 75);
    await main.waitForFunction(() => document.querySelector('.forge-density-body .mesh-density-counts')?.textContent.includes('108 triangles'));
    assert.equal(await main.locator('.forge-density-body .forge-preview-canvas').count(), 1, 'Forge must show the wireframe density preview');
    await main.screenshot({ path: path.join(output, 'forge-density.png') });
    await main.locator('.forge-dialog footer .forge-primary').click();
    await main.locator('.forge-dialog').waitFor({ state: 'detached' });
    await main.waitForFunction(() => document.querySelector('.classic-status')?.textContent.includes('Geoset 2: 60 → 108 triangles.'));

    const opened = app.waitForEvent('window');
    await main.locator('[data-warmkey="uv"]').click();
    uv = await opened;
    uv.setDefaultTimeout(30000);
    const triangles = uv.getByRole('button', { name: 'Triangles', exact: true });
    await triangles.waitFor();
    await triangles.click();
    const popup = uv.locator('.uv-density-popup');
    await popup.waitFor();
    assert.equal(await popup.locator('input[type="range"]').count(), 1, 'UV popup must contain one density slider');
    assert.equal(await popup.locator('select').count(), 0, 'UV popup must not contain a geoset picker');
    assert.equal(await popup.getByLabel('Triangle density').getAttribute('max'), '0', 'reopening an applied six-cell grid must not scroll into another density pass');
    await uv.waitForFunction(() => document.querySelector('.uv-density-popup .mesh-density-counts')?.textContent.includes('108 triangles'));
    const uvCount = await popup.locator('.mesh-density-counts').innerText();
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
    await popup.waitFor({ state: 'detached' });

    assert.ok(fs.readFileSync(fixture).equals(original), 'Preview and Apply must not overwrite the supplied model before Save');
    console.log(`PASS Forge and UV triangle-density controls: geoset picker, capped square-grid 60→108 wireframe and Apply, compact UV popup, original file unchanged (${uvCount.trim()})`);
  } finally {
    await app.evaluate(({ app }) => app.exit(0));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
