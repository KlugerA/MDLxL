const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createDemoDocument, createNode, openDocument } = await import('../src/editor-document.js');
  const root = process.cwd(), output = path.join(root, 'out/event-animation-frame');
  fs.mkdirSync(output, { recursive: true });
  const fixture = createDemoDocument(), base = fixture.model.Sequences[0];
  fixture.apply('Prepare event fixture', ['Sequences', 'Nodes', 'PivotPoints'], model => {
    model.Sequences = [['Stand', 0, 1500], ['Death', 8600, 9600], ['Attack - 1', 143100, 144100]].map(([Name, start, end]) => ({ ...structuredClone(base), Name, Interval: new Uint32Array([start, end]) }));
    for (const [Name, times] of [['SNDxDGAR', [8600]], ['SPLxFBR2', [400]], ['SPLxFBL2', [800]]]) {
      const node = createNode(model, 'EventObject');
      node.Name = Name; node.EventTrack = new Uint32Array(times);
    }
  });
  const file = path.join(output, 'fixture.mdx');
  fs.writeFileSync(file, fixture.serialize('mdx'));
  const original = fs.readFileSync(file);
  const app = await _electron.launch({
    executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: [root, file],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) },
    timeout: 30000,
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setSize(1600, 1000); window.webContents.setBackgroundThrottling(false);
    });
    await page.getByText('Opened fixture.mdx', { exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Nodes'));
    await page.getByRole('dialog', { name: 'Node Manager', exact: true }).waitFor();
    await page.getByLabel('Search nodes').fill('SNDxDGAR');
    await page.locator('.re-tree-row').filter({ hasText: 'SNDxDGAR' }).click();
    await page.evaluate(() => {
      const element = document.querySelector('.re-window');
      let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.doc?.serialize) { window.testDoc = fiber.memoizedProps.doc; break; }
    });
    const events = () => page.evaluate(() => testDoc.model.EventObjects.map(node => ({ id: node.ObjectId, name: node.Name, frames: [...node.EventTrack] })));
    const before = await events();
    // Select the local-animation picker in both the pre-fix and rebuilt bundle.
    const animation = page.locator('.re-event-editor').getByRole('combobox').last();
    await animation.selectOption({ label: 'Attack - 1' });
    assert.equal(await page.getByLabel('Resource keyframe time', { exact: true }).inputValue(), '143100');
    assert.equal(await page.getByRole('button', { name: 'Add at 143100', exact: true }).count(), 1);
    assert.equal(await animation.getAttribute('aria-label'), 'Preview animation');
    assert.deepEqual(await events(), before, 'preview selection does not assign or move event triggers');
    await page.getByRole('button', { name: 'Add at 143100', exact: true }).click();
    let expected = structuredClone(before);
    expected.find(node => node.name === 'SNDxDGAR').frames.push(143100);
    assert.deepEqual(await events(), expected, 'adding an event affects only the selected node');
    await page.getByLabel('Search nodes').fill('SPLxFBR2');
    await page.locator('.re-tree-row').filter({ hasText: 'SPLxFBR2' }).click();
    await animation.selectOption({ label: 'Death' });
    assert.equal(await page.getByLabel('Resource keyframe time', { exact: true }).inputValue(), '8600');
    assert.deepEqual(await events(), expected);
    await page.getByRole('button', { name: 'Add at 8600', exact: true }).click();
    expected.find(node => node.name === 'SPLxFBR2').frames.push(8600);
    assert.deepEqual(await events(), expected);
    await page.getByRole('button', { name: 'Undo manager edit', exact: true }).click();
    expected.find(node => node.name === 'SPLxFBR2').frames.pop();
    assert.deepEqual(await events(), expected);
    await page.getByRole('button', { name: 'Redo manager edit', exact: true }).click();
    expected.find(node => node.name === 'SPLxFBR2').frames.push(8600);
    assert.deepEqual(await events(), expected);
    await page.getByRole('button', { name: 'Remove', exact: true }).last().click();
    expected.find(node => node.name === 'SPLxFBR2').frames.pop();
    assert.deepEqual(await events(), expected);
    const bytes = await page.evaluate(() => [...new Uint8Array(testDoc.serialize('mdx'))]);
    const reopened = openDocument(Buffer.from(bytes), 'edited.mdx');
    assert.deepEqual(reopened.model.EventObjects.map(node => ({ id: node.ObjectId, name: node.Name, frames: [...node.EventTrack] })), expected);
    assert.deepEqual(fs.readFileSync(file), original, 'fixture remains unchanged');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, 'verified.png') });
    console.log('PASS animation/frame synchronization, preview label, object isolation, add/remove, undo/redo, MDX reopen');
  } finally {
    await app.evaluate(({ app }) => app.exit(0));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
