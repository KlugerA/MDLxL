// Rebuilt Electron regression for checked-geoset RGB editing followed by merge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const api = await import('../src/editor-document.js');
  const output = path.join(root, 'out', 'geoset-rgb-merge');
  fs.mkdirSync(output, { recursive: true });
  let source = process.argv[2] && path.resolve(process.argv[2]);
  if (!source) {
    const fixture = api.createDemoDocument(), base = fixture.model.Geosets[0];
    fixture.apply('Prepare RGB merge fixture', ['Geosets', 'GeosetAnims', 'Info'], model => {
      model.Geosets = Array.from({ length: 12 }, () => structuredClone(base));
      model.GeosetAnims = model.Geosets.map((_, GeosetId) => ({ GeosetId, Flags: GeosetId === 5 ? 2 : 0, Alpha: 1, Color: new Float32Array(GeosetId === 5 ? [185 / 255, 155 / 255, 145 / 255] : [1, 1, 1]) }));
      model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims.length;
    });
    source = path.join(output, 'rgb-merge.mdx'); fs.writeFileSync(source, fixture.serialize('mdx'));
  }
  const original = fs.readFileSync(source);
  const initialCount = api.openDocument(original, path.basename(source)).model.Geosets.length;
  const profile = fs.mkdtempSync(path.join(output, 'profile-'));
  const app = await _electron.launch({
    executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', root, source], cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000,
  });
  let page;
  try {
    page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.setBackgroundThrottling(false); win.setPosition(-3000, 0); win.showInactive();
    });
    await page.waitForFunction(count => document.title.includes('.mdx') && document.querySelectorAll('.classic-geoset-list [role="option"]').length === count, initialCount);
    await page.evaluate(() => {
      window.rgbMergeState = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        if (!host) return window.rgbMergeApp;
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const current = hook.memoizedState?.current;
          if (current?.doc?.apply) return window.rgbMergeApp = current;
        }
        return window.rgbMergeApp;
      };
      window.rgbMergeState();
    });

    await page.locator('[data-warmkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 5', { exact: true }).click();
    await page.getByLabel('Select geoset 11', { exact: true }).click();
    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    for (const [channel, value] of [['R', '185'], ['G', '155'], ['B', '145']]) await page.getByLabel(`Animation ${channel}`, { exact: true }).fill(value);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'vertices'));
    await page.waitForFunction(() => {
      const model = rgbMergeState().doc.model;
      const colors = [5, 11].map(id => model.GeosetAnims.find(animation => animation.GeosetId === id));
      return colors.every(animation => animation && (animation.Flags & 2) && Array.from(animation.Color).every((value, channel) => Math.abs(value - [185, 155, 145][channel] / 255) < 1e-6));
    });

    await page.locator('[aria-label="3D model viewport"]').focus();
    await page.keyboard.press('Control+A');
    await page.getByRole('button', { name: 'Merge Geosets', exact: true }).click();
    await page.waitForFunction(count => rgbMergeState().doc.model.Geosets.length === count - 1, initialCount);
    const saved = Uint8Array.from(await page.evaluate(() => Array.from(rgbMergeState().doc.serialize('mdx'))));
    const reopened = api.openDocument(saved, 'rgb-merge-proof.mdx');
    assert.equal(reopened.model.Geosets.length, initialCount - 1);
    const mergedAnimation = reopened.model.GeosetAnims.find(animation => animation.GeosetId === 5);
    assert.ok(mergedAnimation.Flags & 2);
    assert.deepEqual(Array.from(mergedAnimation.Color).map(value => Math.round(value * 255)), [185, 155, 145]);
    assert.deepEqual(fs.readFileSync(source), original);
    console.log('PASS rebuilt Electron: checked geosets 6 and 12 receive the same RGB and merge; input model unchanged');
  } finally {
    if (page && !page.isClosed()) await page.evaluate(() => {
      const state = typeof rgbMergeState === 'function' && rgbMergeState();
      if (state) Object.defineProperty(state.doc, 'dirty', { get: () => false });
      window.desktop?.setDirty({ dirty: false, saved: true });
    });
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
