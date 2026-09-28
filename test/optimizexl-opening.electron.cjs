const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const model = process.env.MDLXL_OPENING_MODEL || 'C:/Users/PC/Downloads/WH_WOC_KnightKhorneFlail02_After.mdx';
  const source = fs.readFileSync(model), out = path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT || 'out', 'opening-ui'); fs.mkdirSync(out, { recursive: true });
  const exe = process.env.MDLXL_OPTIMIZEXL_EXE, errors = [];
  const app = await _electron.launch({ executablePath: exe || path.resolve('node_modules/electron/dist/electron.exe'), args: [...(exe ? [] : [process.cwd()]), model],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const main = await app.firstWindow(); await main.getByTitle('OptimizeXL', { exact: true }).waitFor({ timeout: 60000 });
    const pending = app.waitForEvent('window'); await main.getByTitle('OptimizeXL', { exact: true }).click(); const p = await pending; p.setDefaultTimeout(20000); p.on('pageerror', e => errors.push(e.message));
    await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) { w.webContents.setBackgroundThrottling(false); w.setBounds({ x: -3500, y: 0, width: 1600, height: 1000 }); w.showInactive(); } });
    await p.getByRole('navigation', { name: 'Optimization stages' }).getByRole('button', { name: 'Insanity FIxer', exact: true }).click();
    await p.getByText('Hive: 0 errors · 1 severe · 0 warnings · 3 notices', { exact: true }).waitFor();
    const select = p.getByLabel('Proposed fix', { exact: true }), label = 'BlastFlare: missing opening Translation in Attack - Slam';
    assert.ok((await select.locator('option').allTextContents()).includes(label));
    await select.selectOption({ label }); await p.waitForFunction(() => !!document.querySelector('.ox-savings strong'));
    assert.equal(await p.getByLabel('Animation', { exact: true }).inputValue(), '9');
    assert.equal(await p.getByLabel('Animation frame', { exact: true }).inputValue(), '170000');
    assert.equal(await p.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), true);
    await p.evaluate(() => { window.sides = () => Array.from(document.querySelectorAll('.ox-preview .game-preview-root'), root => { let props; for (let f = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))]; f; f = f.return) for (let h = f.memoizedState; h; h = h.next) { const c = h.memoizedState?.current; if (c?.model?.Geosets && c?.compareCamera) props = c; } return props; }); });
    const original = await p.evaluate(() => JSON.stringify(sides()[0].model)), header = await p.locator('[aria-label="Before preview"] h2').textContent();
    const preview = await p.evaluate(() => sides().map(s => s.model.ParticleEmitters2[1].Translation.Keys.map(k => k.Frame)));
    assert.equal(preview[1].length, preview[0].length + 1); assert.ok(preview[1].includes(170000)); assert.ok(preview.every(frames => frames.includes(173015)));
    await p.getByLabel('Animation frame', { exact: true }).fill('170982'); await p.screenshot({ path: path.join(out, 'opening-preview.png') });
    await p.getByRole('button', { name: 'Approve', exact: true }).click();
    await p.getByText('Hive: 0 errors · 0 severe · 0 warnings · 3 notices', { exact: true }).waitFor();
    assert.equal(await p.evaluate(() => JSON.stringify(sides()[0].model)), original); assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(), header);
    assert.ok(!(await select.locator('option').allTextContents()).includes(label)); await p.screenshot({ path: path.join(out, 'opening-approved.png') });
    await p.getByRole('button', { name: 'Back', exact: true }).click();
    await p.getByText('Hive: 0 errors · 1 severe · 0 warnings · 3 notices', { exact: true }).waitFor();
    assert.ok((await select.locator('option').allTextContents()).includes(label));
    assert.deepEqual(fs.readFileSync(model), source); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, packaged: !!exe, missingOpeningPreviewApprovalAndBack: true,
      severeCleared: true, unusedNoticesRetained: 3, pinnedBefore: true, noSourceWrites: true, errors }, null, 2));
    console.log('Passed missing-opening preview, approval, Hive severe clearance, unused-record preservation and Back.');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
