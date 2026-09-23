const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const cwd = process.cwd(), out = path.join(cwd, 'out/geoset-save');
  fs.mkdirSync(out, { recursive: true });
  const copy = path.join(out, 'ui-fixture.mdx');
  fs.copyFileSync('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', copy);
  const app = await _electron.launch({ executablePath: path.join(cwd, 'node_modules/electron/dist/electron.exe'),
    args: [cwd, copy], env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await page.waitForSelector('[data-warmkey="animations"]', { timeout: 60000 });
    console.log('LOADED', await page.title());
    await page.locator('[data-warmkey="animations"]').click();
    await page.getByLabel('Choose animation sequence').selectOption({ label: 'Decay Bone' });
    await page.locator('[data-warmkey="geosetsAll"]').click();
    await page.getByRole('button', { name: 'Create Visibility', exact: true }).click();
    await page.getByLabel('Visibility alpha percent').fill('0');
    await page.getByLabel('Visibility alpha percent').press('Enter');
    console.log('HIDDEN', await page.getByLabel('Visibility alpha percent').inputValue());
    await page.evaluate(() => {
      window.saveEvents = []; window.saveWorkerCount = 0; window.saveTicks = 0;
      const Original = window.Worker;
      window.Worker = class extends Original {
        constructor(...args) { super(...args); if (String(args[0]).includes('model-save')) {
          window.saveWorkerCount++;
          const started = window.saveTicks;
          this.addEventListener('message', e => window.saveEvents.push({ error: e.data.error, timings: e.data.timings, ticksDuringSave: window.saveTicks - started }));
        } }
      };
      window.tickTimer = setInterval(() => window.saveTicks++, 10);
    });
    await app.evaluate(({ dialog }, out) => {
      globalThis.saveDialogs = 0;
      dialog.showSaveDialog = async (_window, options) => { globalThis.saveDialogs++; return { canceled: false, filePath: out + '/ui-saved.' + options.filters[0].extensions[0] }; };
    }, out);
    await page.keyboard.press('Control+Shift+s');
    await page.getByRole('button', { name: 'Save MDL…', exact: true }).click();
    await page.waitForFunction(() => window.saveEvents.length === 1);
    await page.getByRole('button', { name: 'Save MDL…', exact: true }).waitFor({ state: 'visible' });
    console.log('FAILED', await page.evaluate(() => ({ events: window.saveEvents, workers: window.saveWorkerCount, ticks: window.saveTicks, text: document.body.innerText.slice(-900) })));
    if (await app.evaluate(() => globalThis.saveDialogs) !== 0) throw Error('Failed verification opened a disk save dialog');
    await page.screenshot({ path: path.join(out, 'electron-failure-controls.png') });
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.waitForFunction(() => window.saveEvents.length === 2);
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).waitFor({ state: 'hidden' });
    console.log('SAVED', await page.evaluate(() => ({ events: window.saveEvents, workers: window.saveWorkerCount, ticks: window.saveTicks, alpha: document.querySelector('[aria-label="Visibility alpha percent"]').value })));
    if (!fs.existsSync(path.join(out, 'ui-saved.mdx'))) throw Error('Save did not write output');
    const metrics = await page.evaluate(() => window.saveEvents);
    if (metrics.some(event => event.ticksDuringSave < 1)) throw Error('UI did not tick during worker save');
    fs.writeFileSync(path.join(out, 'electron-metrics.json'), JSON.stringify(metrics, null, 2));
    if (!fs.readFileSync(copy).equals(fs.readFileSync('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx'))) throw Error('Original copy changed on Save As');
    await app.evaluate(({ dialog }, out) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [out + '/ui-saved.mdx'] }); }, out);
    await page.keyboard.press('Control+o');
    await page.waitForFunction(() => document.title.includes('ui-saved.mdx'));
    await page.locator('[data-warmkey="animations"]').click();
    await page.getByLabel('Choose animation sequence').selectOption({ label: 'Decay Bone' });
    await page.locator('[data-warmkey="geosetsAll"]').click();
    if (await page.getByLabel('Visibility alpha percent').inputValue() !== '0') throw Error('Reopened visibility edit was lost');
    await page.screenshot({ path: path.join(out, 'electron-reopened.png') });
    console.log('REOPENED alpha=0; fixture preserved; controls usable');
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
