// Exercise the rebuilt Electron bundle: node test/bone-tools.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const output = path.resolve('out/bone-tools-ui'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(output, 'bone-tools.mdx');
  fs.writeFileSync(fixture, Buffer.from(createStarterDocument().serialize('mdx')));
  const errors = [];
  console.log('Launching Electron');
  const app = await _electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    console.log('Waiting for first window');
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    console.log('Window ready');
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    console.log('Vertex viewport ready');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    const before = await page.evaluate(() => {
      const host = document.querySelector('[aria-label="3D model viewport"]');
      let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.renderer && state?.controls) {
          state.camera.position.addScalar(37); state.controls.target.addScalar(5); state.controls.update();
          return { position: state.camera.position.toArray(), target: state.controls.target.toArray(), zoom: state.camera.zoom };
        }
      }
      throw Error('Vertex camera not found');
    });
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+A');
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Selected: 8'));
    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor({ timeout: 60000 });
    console.log('Bones controller ready');
    await page.waitForTimeout(1500);
    console.log('Preview diagnostic', await page.evaluate(() => ({ canvases: document.querySelectorAll('.game-preview-surface canvas').length, alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent), surface: !!document.querySelector('.game-preview-surface') })));
    console.log('Reading bone camera');
    const after = await page.evaluate(() => {
      const host = document.querySelector('.game-preview-surface');
      let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.native && state?.controls) return { position: state.controls.object.position.toArray(), target: state.controls.target.toArray(), zoom: state.controls.object.zoom };
      }
      throw Error('Bone camera not found');
    });
    before.position.forEach((value, index) => assert.ok(Math.abs(value - after.position[index]) < 1e-5));
    before.target.forEach((value, index) => assert.ok(Math.abs(value - after.target[index]) < 1e-5));
    assert.equal(after.zoom, before.zoom);
    for (const label of ['Bones', 'Emitters', 'Nodes']) assert.equal(await page.getByLabel(label, { exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Bone' }).click();
    assert.match(await page.getByLabel('Movement bone or node').inputValue(), /^[0-9]+$/);
    assert.match(await page.getByLabel('Movement bone or node').getAttribute('title'), /bone_new0/);
    assert.equal(await page.getByRole('button', { name: 'Delete selected object' }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Attach', exact: true }).isEnabled(), true);
    for (const label of ['Soft Bind', 'Hard Bind', 'Detach Vertices']) assert.equal(await page.getByRole('button', { name: label, exact: true }).isEnabled(), true);
    await page.keyboard.press('c');
    assert.match(await page.getByLabel('List of bones connected to selected vertices').textContent(), /Bone_Root/);
    assert.match(await page.getByLabel('List of bones connected to selected vertices').textContent(), /bone_new0/);
    await page.keyboard.press('r');
    assert.doesNotMatch(await page.getByLabel('List of bones connected to selected vertices').textContent(), /Bone_Root/);
    await page.keyboard.press('v');
    assert.equal((await page.getByLabel('List of bones connected to selected vertices').textContent()).trim(), '');
    await page.getByRole('button', { name: 'Attach', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Attach', exact: true }).getAttribute('aria-pressed'), 'true');
    const parentPoint = await page.evaluate(() => {
      const host = document.querySelector('.game-preview-surface');
      let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.native && state?.controls) {
          const projected = state.controls.target.clone().set(0, 0, 0).project(state.controls.object);
          const bounds = host.querySelector('canvas[data-clean-model-canvas]').getBoundingClientRect();
          return { x: bounds.x + (projected.x + 1) * bounds.width / 2, y: bounds.y + (1 - projected.y) * bounds.height / 2 };
        }
      }
      throw Error('Bone camera not found');
    });
    await page.mouse.move(parentPoint.x + 160, parentPoint.y + 100);
    await page.screenshot({ path: path.join(output, 'attach-guide.png') });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Attach', exact: true }).getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('t');
    assert.equal(await page.getByRole('button', { name: 'Attach', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.mouse.click(parentPoint.x, parentPoint.y);
    assert.equal(await page.getByRole('button', { name: 'Detach', exact: true }).isEnabled(), true);
    await page.keyboard.press('d');
    assert.equal(await page.getByRole('button', { name: 'Detach', exact: true }).isEnabled(), false);
    await page.keyboard.press('Delete');
    assert.equal(await page.getByLabel('Movement bone or node').locator('option', { hasText: 'bone_new0' }).count(), 0);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Attachment' }).click();
    assert.match(await page.getByLabel('Movement bone or node').getAttribute('title'), /New Ref/);
    await page.screenshot({ path: path.join(output, 'bones-tab.png') });
    assert.deepEqual(errors, []);
    console.log('Bones desktop UI and camera handoff passed.');
  } finally { const child = app.process(); await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 3000))]); child?.kill(); }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
