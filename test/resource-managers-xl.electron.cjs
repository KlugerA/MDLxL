const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createDemoDocument, createNode, openDocument } = await import('../src/editor-document.js');
  const root = process.cwd(), output = path.join(root, 'out', 'resource-managers-xl');
  fs.mkdirSync(output, { recursive: true });
  const shots = process.env.MDLXL_SCREENSHOTS || output; fs.mkdirSync(shots, { recursive: true });
  const doc = createDemoDocument(); let emitterId, lightId, globalId;
  doc.apply('Prepare fixture', ['Nodes', 'PivotPoints', 'Sequences', 'GlobalSequences'], m => {
    m.Sequences = [{ ...m.Sequences[0], Name: 'Stand', Interval: new Uint32Array([100, 1100]) }, { ...m.Sequences[0], Name: 'Death', Interval: new Uint32Array([2000, 3000]) }];
    const emitter = createNode(m, 'ParticleEmitter2'); emitterId = emitter.ObjectId; emitter.Name = 'XL Sparks'; emitter.Parent = 0; emitter.TextureID = 0;
    const light = createNode(m, 'Light'); lightId = light.ObjectId; light.Name = 'XL Loop Light'; light.PivotPoint.set([-18, 0, 35]);
    globalId = m.GlobalSequences.push(1000) - 1;
    light.Visibility = { LineType: 0, GlobalSeqId: globalId, Keys: [0, 1000].map(Frame => ({ Frame, Vector: new Float32Array([1]) })) };
  });
  const fixture = path.join(output, 'manager-fixture.mdx'), original = Buffer.from(doc.serialize('mdx'));
  fs.writeFileSync(fixture, original);
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', root, fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  const errors = []; let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', dialog => { console.log('DIALOG', dialog.type(), dialog.message()); dialog.dismiss().catch(() => {}); });
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1480, 980); w.setPosition(-3000, 0); w.webContents.setBackgroundThrottling(false); w.showInactive(); });
    await page.getByText('Opened manager-fixture.mdx', { exact: true }).waitFor();
    console.log('Loaded fixture');
    assert.equal(await page.locator('.resource-editor').count(), 0, 'manager remains dismissible, not a permanent panel');
    const menu = command => app.evaluate(({ BrowserWindow }, action) => BrowserWindow.getAllWindows()[0].webContents.send('menu', action), command);
    const close = async () => { await page.getByRole('button', { name: /^Close .*Manager$/ }).click(); await page.locator('.resource-editor').waitFor({ state: 'detached' }); };
    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByLabel('Movement bone or node').selectOption(String(emitterId));
    await page.getByRole('button', { name: 'Edit selected node…', exact: true }).click();
    console.log('Opened selected node');
    const manager = page.getByRole('dialog', { name: 'Node Manager', exact: true }); await manager.waitFor();
    await manager.getByRole('heading', { name: 'XL Sparks', exact: true }).waitFor();
    await page.evaluate(() => {
      const el = document.querySelector('.re-window'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.doc?.serialize) { window.managerTestDoc = fiber.memoizedProps.doc; break; }
      if (!window.managerTestDoc) throw Error('Resource editor document not found');
    });
    console.log('Node selected, document captured');
    const visibility = page.getByRole('region', { name: 'Visibility editor', exact: true });
    await visibility.getByLabel('Visibility animation', { exact: true }).selectOption('1');
    await visibility.getByRole('button', { name: 'Whole animation', exact: true }).click();
    await visibility.getByRole('button', { name: 'Hide', exact: true }).click();
    assert.deepEqual(await page.evaluate(id => managerTestDoc.model.Nodes[id].Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), emitterId), [[100, 1], [1100, 1], [2000, 0], [3000, 0]]);
    console.log('Whole sequence edited');
    await menu('undo'); await page.waitForFunction(id => !managerTestDoc.model.Nodes[id].Visibility, emitterId);
    await menu('redo'); await page.waitForFunction(id => !!managerTestDoc.model.Nodes[id].Visibility, emitterId);
    await visibility.getByLabel('Visibility animation', { exact: true }).selectOption('0');
    const timeline = visibility.getByRole('group', { name: 'Visibility timeline', exact: true }), box = await timeline.boundingBox();
    const x = at => box.x + (12 + (at - 100) / 1000 * 976) / 1000 * box.width;
    await page.mouse.move(x(350), box.y + 20); await page.mouse.down(); await page.mouse.move(x(650), box.y + 20, { steps: 12 }); await page.mouse.up();
    await visibility.getByRole('button', { name: 'Hide', exact: true }).click();
    const ranged = await page.evaluate(id => managerTestDoc.model.Nodes[id].Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), emitterId);
    assert.ok(ranged.some(([at, value]) => at >= 349 && at <= 351 && value === 0));
    assert.deepEqual(ranged.filter(([at]) => at >= 2000), [[2000, 0], [3000, 0]]);
    await visibility.getByRole('button', { name: 'Visibility key 100: On', exact: true }).click();
    await visibility.getByRole('button', { name: 'Visibility key 1100: On', exact: true }).click({ modifiers: ['Control'] });
    await visibility.getByRole('button', { name: 'Hide', exact: true }).click();
    const edited = await page.evaluate(id => managerTestDoc.model.Nodes[id].Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), emitterId);
    assert.equal(edited.find(([at]) => at === 100)[1], 0); assert.equal(edited.find(([at]) => at === 1100)[1], 0);
    assert.deepEqual(edited.filter(([at]) => at !== 100 && at !== 1100), ranged.filter(([at]) => at !== 100 && at !== 1100), 'Ctrl selection does not overwrite intermediate keys');
    await page.screenshot({ path: path.join(shots, 'node-manager-xl.png') });
    await manager.getByLabel('Search nodes').fill('no such object'); assert.equal(await manager.locator('[role="treeitem"]').count(), 0);
    await manager.getByLabel('Search nodes').fill('XL Sparks'); assert.equal(await manager.locator('[role="treeitem"]').count(), 1);
    await manager.getByLabel('Search nodes').fill('');
    await close(); await menu('vertices');
    await page.getByRole('group', { name: 'Quick display', exact: true }).getByLabel('Nodes', { exact: true }).check();
    await page.getByLabel('View direction', { exact: true }).selectOption('front');
    await menu('Nodes');
    await page.getByRole('heading', { name: 'XL Sparks', exact: true }).waitFor();
    await page.getByRole('navigation', { name: 'Resource managers' }).getByRole('button', { name: 'Materials', exact: true }).click();
    await page.getByRole('dialog', { name: 'Material Manager', exact: true }).waitFor();
    assert.equal(await page.locator('.live-node-manager').count(), 0);
    await page.getByRole('navigation', { name: 'Resource managers' }).getByRole('button', { name: 'Nodes', exact: true }).click();
    await page.getByRole('heading', { name: 'XL Sparks', exact: true }).waitFor();
    assert.equal(await page.locator('.live-node-manager').count(), 1);
    const lightPoint = await page.evaluate(id => {
      const el = document.querySelector('.viewport'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.renderer && state.camera) { const node = state.nodes.find(n => n.ObjectId === id), point = state.camera.position.clone().set(...node.PivotPoint).project(state.camera), rect = state.renderer.domElement.getBoundingClientRect(); return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 }; }
      }
      throw Error('Viewport camera not found');
    }, lightId);
    await page.mouse.click(lightPoint.x, lightPoint.y);
    await page.getByRole('heading', { name: 'XL Loop Light', exact: true }).waitFor();
    await page.getByText(`Global loop ${globalId + 1} · 1000 ms · shared by every animation`, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Whole loop', exact: true }).click();
    await page.getByRole('region', { name: 'Visibility editor', exact: true }).getByRole('button', { name: 'Hide', exact: true }).click();
    assert.equal(await page.evaluate(id => managerTestDoc.model.Nodes[id].Visibility.GlobalSeqId, lightId), globalId);
    assert.deepEqual(await page.evaluate(id => managerTestDoc.model.Nodes[id].Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), lightId), [[0, 0], [1000, 0]]);
    await page.getByRole('button', { name: 'Undo manager edit', exact: true }).click();
    await page.waitForFunction(id => managerTestDoc.model.Nodes[id].Visibility.Keys[0].Vector[0] === 1, lightId);
    await close(); await menu('Geosets');
    const geoset = page.getByRole('dialog', { name: 'Geoset Manager', exact: true });
    await geoset.getByRole('button', { name: 'Whole animation', exact: true }).click();
    await geoset.getByLabel('Visibility opacity percent', { exact: true }).fill('50');
    await geoset.getByRole('button', { name: 'Apply', exact: true }).click();
    assert.ok(await page.evaluate(() => managerTestDoc.model.GeosetAnims.some(a => a.Alpha?.Keys?.some(k => k.Vector[0] === .5))));
    await geoset.getByText('Several animations…', { exact: true }).click();
    await geoset.locator('.re-batch-visibility').getByRole('button', { name: 'Select all', exact: true }).click();
    await geoset.getByRole('button', { name: 'Hide in selected', exact: true }).click();
    assert.ok(await page.evaluate(() => managerTestDoc.model.GeosetAnims.some(a => a.Alpha?.Keys?.filter(k => k.Frame >= 100 && k.Frame <= 3000).every(k => k.Vector[0] === 0))));
    await geoset.getByRole('button', { name: 'Undo manager edit', exact: true }).click();
    await geoset.getByText('Several animations…', { exact: true }).click();
    await page.screenshot({ path: path.join(shots, 'geoset-manager-xl.png') });
    await geoset.getByRole('button', { name: 'Edit this material', exact: true }).click();
    const material = page.getByRole('dialog', { name: 'Material Manager', exact: true });
    await material.getByLabel('Appearance', { exact: true }).selectOption('2');
    await material.getByRole('button', { name: 'Whole animation', exact: true }).click();
    await material.getByLabel('Layer opacity opacity percent', { exact: true }).fill('25');
    await material.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.screenshot({ path: path.join(shots, 'material-manager-xl.png') });
    await material.getByRole('button', { name: 'Open texture', exact: true }).click();
    const texture = page.getByRole('dialog', { name: 'Texture Manager', exact: true });
    await texture.getByLabel('Texture source', { exact: true }).waitFor();
    assert.ok(await texture.locator('.re-relations button').count());
    await page.screenshot({ path: path.join(shots, 'texture-manager-xl.png') });
    const themes = JSON.parse(fs.readFileSync(path.join(root, 'src/application-themes.json'), 'utf8'));
    await page.evaluate(colors => { document.documentElement.dataset.theme = 'dark'; for (const [key, value] of Object.entries(colors)) document.documentElement.style.setProperty('--ui-' + key, value); }, themes.dark.colors);
    await page.screenshot({ path: path.join(shots, 'texture-manager-xl-dark.png') });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 760));
    assert.ok(await page.locator('.re-window').evaluate(el => el.getBoundingClientRect().right <= innerWidth && el.getBoundingClientRect().bottom <= innerHeight));
    await page.screenshot({ path: path.join(shots, 'texture-manager-xl-compact.png') });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1480, 980));
    await texture.locator('.re-relations button').first().click();
    await page.getByRole('dialog', { name: 'Material Manager', exact: true }).waitFor();
    await page.locator('.re-model-preview summary').click(); await page.locator('.re-model-stage canvas').first().waitFor();
    await close();
    await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: pathForSave(output, options.filters[0].extensions[0]) }); function pathForSave(dir, ext) { return dir + '/saved-manager.' + ext; } }, output);
    for (const format of ['mdx', 'mdl']) {
      await menu('saveAs'); await page.getByRole('button', { name: `Save ${format.toUpperCase()}…`, exact: true }).click();
      await page.getByText(`Saved saved-manager.${format}`, { exact: true }).waitFor();
      const saved = openDocument(fs.readFileSync(path.join(output, `saved-manager.${format}`)), `saved.${format}`);
      assert.deepEqual(saved.model.Nodes[emitterId].Visibility.Keys.map(k => [k.Frame, k.Vector[0]]), edited);
      assert.ok(saved.model.GeosetAnims.some(a => a.Alpha?.Keys?.some(k => k.Vector[0] === .5)));
      assert.ok(saved.model.Materials.some(m => m.Layers.some(l => l.Alpha?.Keys?.some(k => k.Vector[0] === .25))));
    }
    assert.deepEqual(fs.readFileSync(fixture), original); assert.deepEqual(errors, []);
    console.log('PASS managers: Movement/Vertices handoff, named sequences, range and Ctrl-key selection, undo/redo, linked resources, model preview, saved MDL/MDX, unchanged input.');
  } catch (error) { console.error('TEST FAILURE', error); if (page) await page.screenshot({ path: path.join(output, 'failure.png') }); throw error; }
  finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
