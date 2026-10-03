const assert = require('node:assert/strict');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), file = process.env.MDLXL_TEST_MODEL || 'C:/Users/PC/Desktop/WIP/graveguard_Optimized Weapon (1).mdx';
  const app = await _electron.launch({
    executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: [root, file],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(root, 'out/menu-scroll-test/profile-' + Date.now()) },
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setSize(1600, 1000); window.setPosition(-3000, 0);
      window.webContents.setBackgroundThrottling(false); window.showInactive();
    });
    await page.getByText('Opened ' + path.basename(file), { exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Nodes'));
    await page.getByLabel('Search nodes').fill('SND');
    await page.locator('.re-tree-row').filter({ hasText: 'SNDx' }).first().click();
    await page.getByRole('tree', { name: 'Sound categories' }).waitFor();
    await page.getByLabel('Search event data').fill('DVNG');
    assert.equal(await page.locator('[data-sound-id=DVNG]').count(), 0, 'unresolved sound IDs are not offered');
    assert.equal(await page.getByText(/Sound definition unavailable/).count(), 0, 'an existing unresolved node is preserved without a broken selectable row');
    await page.getByLabel('Search event data').fill('DWAR');
    await page.locator('[data-sound-id=DWAR]').click();
    await page.getByLabel('Search event data').fill('');
    const tree = page.getByRole('tree', { name: 'Sound categories' });
    const folder = tree.getByRole('button', { name: 'Sound', exact: true });
    const position = () => tree.evaluate(element => ({ list: element.scrollTop, panel: element.closest('.re-properties').scrollTop }));
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await folder.scrollIntoViewIfNeeded();
    const before = await position();
    await folder.click(); await settle();
    const after = await position();
    console.log({ before, after });
    assert.deepEqual(after, before, 'opening another folder must not scroll back to the selected sound or move the manager panel');
    await folder.click(); await settle();
    assert.deepEqual(await position(), before, 'closing the folder preserves the same scroll positions');
    console.log('PASS sound folder open/close keeps scroll position');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
