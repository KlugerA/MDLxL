// Run after building: node test/model-tabs.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/model-tabs');
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const firstPath = path.join(root, 'fixtures/demo.mdx'), secondPath = path.join(root, 'fixtures/demo.mdl'), executablePath = path.join(root, 'node_modules/electron/dist/electron.exe');
  const env = { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile };
  const app = await _electron.launch({ executablePath, args: ['--disable-backgrounding-occluded-windows', root], cwd: root, env, timeout: 60000 });
  const launchAgain = (...files) => new Promise((resolve, reject) => {
    const child=spawn(executablePath,[root,...files],{cwd:root,env,stdio:'ignore'}),timer=setTimeout(()=>{child.kill();reject(Error('Secondary MDLxL process did not hand off to the primary instance.'));},15000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`Secondary MDLxL exited with ${code}.`));});
  });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('tab', { name: 'Untitled.mdl' }).waitFor();
    await launchAgain(firstPath);
    await page.getByRole('tab', { name: 'demo.mdx' }).waitFor();
    assert.equal(await page.getByRole('tab').count(), 1, 'the first externally opened model replaces only the pristine starter tab');
    await page.evaluate(() => {
      window.modelTabSummary = () => {
        const host = document.querySelector('.viewport');
        let fiber = host?.[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.Geosets && fiber.memoizedProps?.model?.Nodes) {
          const model = fiber.memoizedProps.model, nodes = model.Nodes.filter(Boolean);
          return { geosets: model.Geosets.length, nodes: nodes.length, dummy: model.Bones.filter(node => node.Name === 'DummyBone').length, lastGroups: model.Geosets.at(-1)?.Groups };
        }
        throw Error('Active model props were not found.');
      };
    });
    const firstBefore = await page.evaluate(() => modelTabSummary()), canvases = await page.locator('.viewport canvas').count();
    await launchAgain(secondPath);
    await page.getByRole('tab', { name: 'demo.mdl' }).waitFor();
    assert.equal(await page.getByRole('tab').count(), 2);
    await launchAgain();
    assert.equal(await page.getByRole('tab').count(), 2, 'launching the desktop shortcut again only focuses the existing window');
    assert.equal(await page.locator('.viewport canvas').count(), canvases, 'opening a tab must not retain the inactive WebGL viewport');
    await page.bringToFront();

    await page.getByRole('tab', { name: 'demo.mdx' }).click();
    await page.waitForFunction(() => document.querySelector('.model-tab.active [role="tab"]')?.textContent.includes('demo.mdx'));
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(250);
    const copyState=await page.evaluate(()=>({status:document.querySelector('.classic-status')?.textContent,copyDisabled:document.querySelector('[data-warmkey="copy"]')?.disabled,active:document.querySelector('.model-tab.active [role="tab"]')?.textContent,focus:document.activeElement?.outerHTML?.slice(0,240)}));
    assert.match(copyState.status||'',/Copied/,`Ctrl+C did not reach the active model: ${JSON.stringify(copyState)}`);
    await page.getByRole('tab', { name: 'demo.mdl' }).click();
    await page.waitForFunction(() => document.querySelector('.model-tab.active [role="tab"]')?.textContent.includes('demo.mdl'));
    const secondBefore = await page.evaluate(() => modelTabSummary());
    await page.keyboard.press('Control+p');
    await page.waitForFunction(count => modelTabSummary().geosets === count + 1, secondBefore.geosets);
    const afterGeometry = await page.evaluate(() => modelTabSummary());
    assert.equal(afterGeometry.nodes, secondBefore.nodes + 1, 'ordinary paste adds only DummyBone, not the donor rig');
    assert.equal(afterGeometry.dummy, 1);
    assert.deepEqual(afterGeometry.lastGroups, [[afterGeometry.nodes - 1]]);

    await page.getByRole('tab', { name: 'demo.mdx' }).click();
    assert.deepEqual(await page.evaluate(() => modelTabSummary()), firstBefore, 'inactive source model remains unchanged');
    await page.locator('[data-warmkey="bones"]').click();
    await page.keyboard.press('Control+a'); await page.keyboard.press('Control+c');
    await page.getByRole('tab', { name: 'demo.mdl' }).click();
    const beforeNodes = await page.evaluate(() => modelTabSummary());
    await page.keyboard.press('Control+p');
    await page.waitForFunction(count => modelTabSummary().nodes > count, beforeNodes.nodes);
    assert.equal((await page.evaluate(() => modelTabSummary())).dummy, 1, 'node paste reuses exactly one DummyBone');

    await page.screenshot({ path: path.join(out, 'model-tabs.png') });
    await page.locator('.model-tab.active .model-tab-close').click();
    await page.getByRole('dialog', { name: 'Close model tab?' }).waitFor();
    await page.getByRole('button', { name: "Don't save", exact: true }).click();
    assert.equal(await page.getByRole('tab').count(), 1);
    await page.locator('[data-warmkey="vertices"]').click();
    assert.deepEqual(await page.evaluate(() => modelTabSummary()), firstBefore);
    assert.deepEqual(errors, []);
    console.log('PASS single-instance desktop handoff, model tabs, suspended inactive renderer, cross-tab geometry/node paste, Ctrl+P, DummyBone binding, and close prompt');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
