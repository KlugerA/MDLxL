// node test/startup-benchmark.electron.cjs [app directory or exe] [runs=5] [profile to copy]
// Measures hidden viewport readiness and a real Grid toggle, not a splash screen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const target = path.resolve(process.argv[2] || root);
  const runs = Number(process.argv[3] || 5);
  assert.ok(Number.isInteger(runs) && runs > 0 && runs <= 30);
  const output = path.join(root, 'out/startup');
  fs.mkdirSync(output, { recursive: true });
  const directory = fs.mkdtempSync(path.join(output, 'benchmark-'));
  const profile = path.join(directory, 'profile');
  fs.mkdirSync(profile);
  if (process.argv[4]) {
    const seed = path.resolve(process.argv[4]);
    for (const name of ['settings.json', 'recovery', 'Local Storage', 'game-data-discovery.json']) {
      const source = path.join(seed, name);
      if (fs.existsSync(source)) fs.cpSync(source, path.join(profile, name), { recursive: true });
    }
  }
  const packaged = path.extname(target).toLowerCase() === '.exe';
  const rows = [];
  for (let index = 0; index < runs; index++) {
    const began = performance.now();
    const app = await _electron.launch({
      executablePath: packaged ? target : path.join(root, 'node_modules/electron/dist/electron.exe'),
      args: ['--disable-backgrounding-occluded-windows', ...(packaged ? [] : [target])], cwd: root,
      env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 30000,
    });
    try {
      const page = await app.firstWindow();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
      await page.waitForFunction(() => !!document.querySelector('[aria-label="3D model viewport"] canvas'), null, { polling: 20, timeout: 30000 });
      const viewportMs = performance.now() - began;
      const grid = page.locator('[data-warmkey="grid"]');
      const checked = await grid.isChecked();
      // A hidden window has no compositor actionability frames. Dispatch the
      // normal DOM event and verify React changed the actual control state.
      await grid.dispatchEvent('click');
      await page.waitForFunction(previous => document.querySelector('[data-warmkey="grid"]').checked !== previous, checked, { polling: 20 });
      const responsiveMs = performance.now() - began;
      assert.deepEqual(errors, []);
      assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.isVisible())), false);
      rows.push({ run: index + 1, viewportMs: Math.round(viewportMs), responsiveMs: Math.round(responsiveMs) });
      console.log(JSON.stringify(rows.at(-1)));
    } finally { await app.close(); }
  }
  const times = rows.map(row => row.responsiveMs).sort((a, b) => a - b);
  const report = { target, seedProfile: process.argv[4] ? path.resolve(process.argv[4]) : null, rows,
    medianMs: times[Math.floor(times.length / 2)], minMs: times[0], maxMs: times.at(-1),
    note: 'Hidden hardware-accelerated launches. First launch uses a fresh or copied profile; subsequent launches reuse it. OS disk cache is not flushed. No Retera or MDLVis parity claim.' };
  const file = path.join(directory, 'results.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ medianMs: report.medianMs, minMs: report.minMs, maxMs: report.maxMs, file }));
})().catch(error => { console.error(error); process.exitCode = 1; });
