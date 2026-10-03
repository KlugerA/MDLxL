// Build dist first. Uses an isolated profile and never opens the user's models.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'out/reveal'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'out/reveal/smoke-'));
const entry = path.join(output, 'main.cjs');
fs.writeFileSync(entry, `
  const {app}=require('electron');
  app.getAppPath=()=>${JSON.stringify(root)};
  const {GameDataDiscovery}=require(${JSON.stringify(path.join(root, 'electron/game-data.cjs'))});
  GameDataDiscovery.prototype.discover=async()=>({folders:[],archives:[],cascFolders:[]});
  require(${JSON.stringify(path.join(root, 'electron/main.cjs'))});
`);
let app;
(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(output, 'demo.mdx'); fs.writeFileSync(fixture, createDemoDocument().serialize('mdx'));
  app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [entry, fixture], cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile') }, timeout: 60000 });
  const page = await app.firstWindow(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setSize(1280, 900); window.setPosition(-3000, 0); window.showInactive(); window.webContents.setBackgroundThrottling(false); });
  const rvl = page.locator('[data-warmkey="revealHotkeys"]');
  await rvl.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-warmkey="vertices"] > [data-warmkey-badge]'));
  assert.equal(await rvl.getAttribute('aria-pressed'), 'false');
  assert.equal(await rvl.evaluate(element => element.previousElementSibling.dataset.warmkey), 'pressedKeys');
  assert.equal(await rvl.locator('img').evaluate(element => element.naturalWidth), 64);
  assert.equal(await page.locator('[data-warmkey="vertices"] > [data-warmkey-badge]').isVisible(), false);
  await page.screenshot({ path: path.join(output, '01-off.png') });
  await rvl.click();
  await page.waitForFunction(() => document.documentElement.dataset.revealHotkeys === 'true');
  assert.equal(await rvl.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-warmkey="vertices"] > [data-warmkey-badge]').isVisible(), true);
  const audit = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('[data-warmkey]')].filter(element => element.getClientRects().length && element.dataset.warmkeyShortcuts);
    const missing = controls.filter(element => {
      const badge = element.matches('input,select,textarea') ? [...element.parentElement.querySelectorAll('.warmkey-field-badge')].find(b => b.style.getPropertyValue('position-anchor') === element.style.getPropertyValue('anchor-name')) : element.querySelector(':scope > [data-warmkey-badge]');
      if (!badge || getComputedStyle(badge).visibility !== 'visible' || getComputedStyle(badge).color !== 'rgb(57, 255, 20)') return true;
      if (element.matches('input,select,textarea')) {
        const box = element.getBoundingClientRect(), hint = badge.getBoundingClientRect();
        if (Math.abs(box.top - hint.top) > 2 || Math.abs(box.right - hint.right) > 2) return true;
      }
      return false;
    });
    return { count: controls.length, missing: missing.map(element => element.dataset.warmkey), color: getComputedStyle(document.querySelector('.warmkey-badge')).color };
  });
  assert.ok(audit.count > 30); assert.deepEqual(audit.missing, []); assert.equal(audit.color, 'rgb(57, 255, 20)');
  await page.screenshot({ path: path.join(output, '02-on.png') });
  // Newly created controls and their generated sequence codes join the same display.
  await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 'reveal-smoke'; host.style = 'position:fixed;left:400px;top:300px;z-index:3000;background:white;padding:20px';
    host.innerHTML = '<button data-warmkey="smoke:disabled" data-warmkey-badges="false" disabled>Disabled</button><label>Field<input data-warmkey="smoke:field" type="number" value="1"></label><textarea data-warmkey="smoke:textarea"></textarea><select data-warmkey="smoke:select"><option>One</option></select>';
    document.querySelector('.warmkeys-root').appendChild(host);
  });
  await page.waitForFunction(() => document.querySelector('#reveal-smoke .warmkey-field-badge')?.textContent.length === 3);
  assert.equal(await page.locator('#reveal-smoke .warmkey-badge').count(), 4);
  assert.equal(await page.locator('#reveal-smoke button .warmkey-badge').isVisible(), true);
  await page.keyboard.down('Alt');
  assert.equal(await page.locator('#reveal-smoke button .warmkey-badge').isVisible(), true);
  await page.keyboard.up('Alt');
  await page.locator('#reveal-smoke').evaluate(element => element.remove());
  await page.waitForTimeout(100);
  await rvl.click();
  await page.locator('[data-warmkey="paint"]').click();
  await page.getByRole('button', { name: 'New base coat', exact: false }).click();
  await page.getByRole('button', { name: 'Begin painting', exact: true }).click();
  await page.waitForFunction(() => !!document.querySelector('.paint-studio .paint-key'));
  assert.equal(await page.locator('.paint-studio .paint-key').first().isVisible(), false);
  await page.screenshot({ path: path.join(output, '03-paint-off.png') });
  await rvl.click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.paint-studio .paint-key')).display !== 'none');
  assert.equal(await page.locator('.paint-studio .paint-key').first().isVisible(), true);
  await page.screenshot({ path: path.join(output, '04-paint-on.png') });
  // Turning RVL off never disables the existing key actions.
  await rvl.click();
  const outlines = page.getByRole('button', { name: 'Outlines', exact: true });
  const previous = await outlines.getAttribute('aria-pressed');
  await page.keyboard.press('O');
  assert.notEqual(await outlines.getAttribute('aria-pressed'), previous);
  await page.locator('[data-warmkey="vertices"]').click();
  await page.getByLabel('3D model viewport', { exact: true }).focus();
  await page.keyboard.press('Control+A');
  await page.waitForFunction(() => !document.querySelector('[data-warmkey="uv"]').disabled);
  await rvl.click();
  const opened = app.waitForEvent('window');
  await page.locator('[data-warmkey="uv"]').first().click();
  const uv = await opened; uv.setDefaultTimeout(20000);
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows().at(-1); window.setPosition(-3000, 0); window.showInactive(); window.webContents.setBackgroundThrottling(false); });
  await uv.waitForFunction(() => document.documentElement.dataset.revealHotkeys === 'true' && !!document.querySelector('.warmkey-badge'));
  assert.equal(await uv.locator('.warmkey-badge').first().isVisible(), true);
  const revealCode = (await rvl.getAttribute('data-warmkey-shortcuts')).split(' > ')[1];
  await uv.keyboard.press('Control+Alt+Space'); await uv.keyboard.type(revealCode);
  await uv.waitForFunction(() => document.documentElement.dataset.revealHotkeys === 'false');
  assert.equal(await uv.locator('.warmkey-badge').first().isVisible(), false);
  await uv.keyboard.press('Control+Alt+Space'); await uv.keyboard.type(revealCode);
  await uv.waitForFunction(() => document.documentElement.dataset.revealHotkeys === 'true');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ output, checks: ['KEY/RVL order and requested icon', 'default hidden', `${audit.count} visible controls including fields reveal in green`, 'disabled and dynamically discovered controls', 'Paint off/on and shortcut still runs', 'detached UV inherits and follows RVL'], errors }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (app) { await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy(); }); await app.close(); } });
