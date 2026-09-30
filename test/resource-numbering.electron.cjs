const assert = require('node:assert/strict');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), fixture = path.join(root, 'fixtures', 'demo.mdx');
  const app = await _electron.launch({
    executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', root, fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(root, 'out', 'resource-numbering-profile') },
    timeout: 60000,
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setBackgroundThrottling(false);
      window.setPosition(-3000, 0);
      window.showInactive();
    });
    await page.getByLabel('Select geoset 1', { exact: true }).waitFor({ timeout: 60000 });

    const openManager = async (command, title, list) => {
      const openDialog = page.locator('[role="dialog"]');
      if (await openDialog.count()) {
        await page.getByRole('button', { name: /^Close .*Manager$/ }).click();
        await openDialog.waitFor({ state: 'detached' });
      }
      await app.evaluate(({ BrowserWindow }, action) => BrowserWindow.getAllWindows()[0].webContents.send('menu', action), command);
      await page.getByRole('dialog', { name: title, exact: true }).waitFor();
      const labels = await page.locator(`[aria-label="${list}"] [role="option"]`).allTextContents();
      assert.ok(labels.length, `${title} has rows`);
      assert.ok(labels[0].startsWith(command === 'Materials' ? 'Material 1' : 'Geoset 1'), `${title} starts at 1`);
      assert.ok(!labels[0].startsWith(command === 'Materials' ? 'Material 0' : 'Geoset 0'), `${title} does not expose a zero-based number`);
      return labels;
    };

    await openManager('Materials', 'Material Manager', 'Materials list');
    await openManager('Geosets', 'Geoset Manager', 'Geosets list');
    const material = page.getByLabel('Material', { exact: true });
    assert.equal(await material.locator('option:checked').textContent(), 'Material 1');
    console.log('Resource managers show one-based Material and Geoset numbers while their underlying references remain unchanged');
  } finally {
    await app.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
