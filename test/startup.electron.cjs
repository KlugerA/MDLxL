// Run after building dist. Optional: MDLXL_PLAYWRIGHT_MODULE points to an external Playwright install.
// Every window stays hidden; slow storage and discovery are injected only into test processes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const { RecoveryStore } = require('../electron/recovery.cjs');
  const output = path.join(root, 'out/startup');
  fs.mkdirSync(output, { recursive: true });
  const run = fs.mkdtempSync(path.join(output, 'regression-'));
  const entry = path.join(run, 'main.cjs');
  fs.writeFileSync(entry, `
    const { app, BrowserWindow, dialog } = require('electron');
    const { RecoveryStore } = require(${JSON.stringify(path.join(root, 'electron/recovery.cjs'))});
    const { SessionJournal } = require(${JSON.stringify(path.join(root, 'electron/session.cjs'))});
    const { GameDataDiscovery } = require(${JSON.stringify(path.join(root, 'electron/game-data.cjs'))});
    app.getAppPath = () => ${JSON.stringify(root)};
    global.startupTest = { lists: 0, discoveries: 0 };
    const gate = new Promise(resolve => { startupTest.releaseRecovery = resolve; });
    const list = RecoveryStore.prototype.list;
    RecoveryStore.prototype.list = async function() {
      startupTest.lists++;
      await gate;
      return list.call(this);
    };
    const begin = SessionJournal.prototype.begin;
    SessionJournal.prototype.begin = async function() {
      return await begin.call(this) || process.env.STARTUP_TEST_CRASH === '1';
    };
    GameDataDiscovery.prototype.discover = async function() {
      startupTest.discoveries++;
      return { folders: [], archives: [], cascFolders: [] };
    };
    app.on('browser-window-created', (_, window) => window.webContents.setBackgroundThrottling(false));
    dialog.showMessageBoxSync = () => 1;
    require(${JSON.stringify(path.join(root, 'electron/main.cjs'))});
  `);
  const fixture = createDemoDocument();
  fixture.apply('Recovered move', ['Geosets'], model => { model.Geosets[0].Vertices[0] += 3; });
  const expected = { geosets: fixture.model.Geosets.length, vertex: fixture.model.Geosets[0].Vertices[0], undo: fixture.historyStats.undoSteps };
  const recovery = { id: 'startup-draft', version: 1, dirty: true, path: null, state: fixture.captureRecoveryState() };

  for (const crash of [false, true]) {
    const profile = path.join(run, crash ? 'crash' : 'normal');
    await new RecoveryStore(path.join(profile, 'recovery')).write(recovery);
    const began = performance.now();
    const app = await _electron.launch({
      executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
      args: ['--disable-backgrounding-occluded-windows', entry], cwd: root,
      env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile, STARTUP_TEST_CRASH: crash ? '1' : '0' },
      timeout: 30000,
    });
    const errors = [];
    try {
      const page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      const command = action => app.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].webContents.send('menu', value), action);
      if (!crash) {
        // This can only finish if normal startup does not await the held recovery scan.
        await page.waitForFunction(() => !!document.querySelector('[aria-label="3D model viewport"] canvas'));
        assert.deepEqual(await app.evaluate(() => ({ lists: startupTest.lists, discoveries: startupTest.discoveries })), { lists: 0, discoveries: 0 });
        assert.equal(await page.locator('[role="dialog"]').count(), 0);
        assert.equal(await page.locator('.pressed-keys-tool img').getAttribute('src'), './classic/pasbtn-magical-sentry.png');
        const grid = page.locator('[data-warmkey="grid"]');
        const checked = await grid.isChecked();
        await grid.dispatchEvent('click');
        await page.waitForFunction(previous => document.querySelector('[data-warmkey="grid"]').checked !== previous, checked);
        console.log(`PASS normal launch responds in ${Math.round(performance.now() - began)} ms while recovery storage is held; no game-data discovery`);
        const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name.split('/').at(-1)));
        assert.ok(!resources.some(name => /^(Settings|UVWorkspace|Forge|forge|bits-and-parts)-.*\.js$/.test(name)), 'optional tools stay out of startup');
        await command('settings');
        await page.locator('.settings-window').waitFor();
        await page.locator('.settings-window [data-warmkey="done"]').dispatchEvent('click');
        await page.locator('.settings-window').waitFor({ state: 'detached' });
        await command('forge');
        await page.getByRole('dialog', { name: 'Forge', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Close Forge', exact: true }).dispatchEvent('click');
        await command('recovery');
      } else {
        await page.waitForFunction(() => !!document.querySelector('.classic-app'));
      }
      // Give the pending IPC a turn, then release the real recovery metadata read.
      await page.waitForFunction(async () => (await window.desktop.getSettings()).preferences != null);
      assert.equal(await app.evaluate(() => startupTest.lists), 1, 'manual Recovery and crash recovery still enumerate drafts');
      await app.evaluate(() => startupTest.releaseRecovery());
      await page.getByRole('dialog', { name: 'Recovery', exact: true }).waitFor();
      await page.locator('[data-warmkey="restore:startup-draft"]').dispatchEvent('click');
      await page.waitForFunction(() => !!document.querySelector('[aria-label="Select geoset 0"]'));
      const restored = await page.evaluate(() => {
        const element = document.querySelector('.classic-app');
        for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const doc = hook.memoizedState?.doc;
            if (doc?.model) return { geosets: doc.model.Geosets.length, vertex: doc.model.Geosets[0].Vertices[0], undo: doc.historyStats.undoSteps };
          }
        }
        throw Error('Editor session not found');
      });
      assert.deepEqual(restored, expected, 'recovery retains geometry and undo history');
      if (!crash) {
        await command('selectAll');
        await page.waitForFunction(() => !document.querySelector('[data-warmkey="uv"]').disabled);
        const nextWindow = app.waitForEvent('window');
        await page.locator('[data-warmkey="uv"]').dispatchEvent('click');
        const uv = await nextWindow;
        uv.on('pageerror', error => errors.push(error.message));
        await uv.locator('.uv-preview-footer').waitFor();
        assert.equal(await uv.locator('.uv-workspace').evaluate(element => getComputedStyle(element).display), 'flex', 'detached UV styles are present on first open');
        assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.isVisible())), false);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${crash ? 'crash prompt' : 'manual recovery, deferred Settings / Forge / UV'} preserves the draft and undo history`);
    } finally {
      // These synthetic restored drafts are deliberately dirty. Destroy only
      // this test process's windows to avoid native before-unload dialog races.
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()));
      await app.close();
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
