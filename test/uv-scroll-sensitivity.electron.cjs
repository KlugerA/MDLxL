// Run against the rebuilt bundle with MDLXL_PLAYWRIGHT_MODULE pointing to Playwright.
const assert = require('node:assert/strict');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

const preferenceValue = selector => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) throw Error('Missing ${selector}');
  let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
  for (; fiber; fiber = fiber.return) {
    const value = fiber.memoizedProps?.preferences?.scrollSensitivity;
    if (Number.isFinite(value)) return value;
  }
  throw Error('Scroll sensitivity preferences unavailable for ${selector}');
})()`;

(async () => {
  const root = path.resolve(__dirname, '..');
  const fixture = path.join(root, 'test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const profile = path.join(root, 'out', `uv-scroll-sensitivity-${Date.now()}`);
  const app = await _electron.launch({
    executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', root, fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000,
  });
  try {
    const main = await app.firstWindow(); main.setDefaultTimeout(15000);
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await main.getByLabel('Select geoset 3', { exact: true }).waitFor({ timeout: 60000 });
    await main.locator('[data-warmkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 3', { exact: true }).check();
    await main.locator('[aria-label="3D model viewport"]').click();
    await main.keyboard.press('Control+a');
    const outsideBefore = await main.evaluate(preferenceValue('[aria-label="3D model viewport"]'));

    const opened = app.waitForEvent('window');
    await main.locator('[data-warmkey="uv"]').click();
    let uv = await opened; uv.setDefaultTimeout(15000);
    const map = uv.getByLabel('UV coordinate editor');
    await map.waitFor({ timeout: 60000 });
    await uv.locator('.game-preview-root').waitFor({ timeout: 60000 });
    assert.equal(await uv.evaluate(preferenceValue('[aria-label="UV coordinate editor"]')), 1);
    assert.equal(await uv.evaluate(preferenceValue('.game-preview-root')), 1);

    const bounds = await map.boundingBox();
    await uv.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await uv.mouse.down({ button: 'right' });
    await uv.mouse.wheel(0, -100);
    await uv.getByRole('status').filter({ hasText: 'Scroll sensitivity: 1.22×' }).waitFor();
    await uv.mouse.up({ button: 'right' });

    const closed = uv.waitForEvent('close');
    await uv.getByRole('button', { name: 'Exit UV Wrapper', exact: true }).click();
    await closed;
    await main.locator('[aria-label="3D model viewport"]').waitFor();
    assert.equal(await main.evaluate(preferenceValue('[aria-label="3D model viewport"]')), outsideBefore);

    const reopened = app.waitForEvent('window');
    await main.locator('[data-warmkey="uv"]').click();
    uv = await reopened; uv.setDefaultTimeout(15000);
    await uv.getByLabel('UV coordinate editor').waitFor({ timeout: 60000 });
    await uv.locator('.game-preview-root').waitFor({ timeout: 60000 });
    assert.equal(await uv.evaluate(preferenceValue('[aria-label="UV coordinate editor"]')), 1);
    assert.equal(await uv.evaluate(preferenceValue('.game-preview-root')), 1);
    console.log('PASS UV scroll sensitivity: starts at 1.0, stays UV-only, and resets after reopening');
  } finally {
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
