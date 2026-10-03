// Run after building dist; set MDLXL_PLAYWRIGHT_MODULE to the installed Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), output = path.join(root, 'out', 'bit-collection'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument, validateModel } = await import('../src/editor-document.js');
  const { encodeForgeTga } = await import('../src/forge.js');
  const { partPresetColor } = await import('../src/bits-and-parts.js');
  const doc = createStarterDocument(), name = `Collected UI Bit ${Date.now()}`, fixture = path.join(output, 'source.mdx'), collectedFile = path.join(root, 'BitsAndParts', name + '.mdx');
  const texture = encodeForgeTga({ width: 2, height: 2, data: new Uint8Array(16).fill(255) });
  const expectedAsset = path.join(root, 'BitsAndParts', 'MDLxL_Parts', require('node:crypto').createHash('sha256').update(texture).digest('hex') + '.tga');
  const assetExisted = fs.existsSync(expectedAsset);
  fs.writeFileSync(path.join(output, 'white.tga'), texture);
  doc.apply('Fixture', [], model => {
    model.Textures[0].Image = 'white.tga';
    model.Geosets.push(structuredClone(model.Geosets[0]), structuredClone(model.Geosets[0]));
    for (let gi = 1; gi < 3; gi++) for (let vertex = 0; vertex < model.Geosets[gi].Vertices.length; vertex += 3) model.Geosets[gi].Vertices[vertex] += 90 * gi;
    model.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([1000, 1900]), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: model.Info.MinimumExtent.slice(), MaximumExtent: model.Info.MaximumExtent.slice(), BoundsRadius: model.Info.BoundsRadius }];
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: 1, Color: { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 1000, Vector: new Float32Array([1, 0, 0]) }, { Frame: 1900, Vector: new Float32Array([0, 0, 1]) }] } }];
  });
  const original = Buffer.from(doc.serialize('mdx')); fs.writeFileSync(fixture, original);
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', root, fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  let savedAssets = [];
  try {
    const page = await app.firstWindow(), errors = []; page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      window.bitTestState = selector => {
        const host = document.querySelector(selector || '[aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))]; const result = {};
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const current = hook.memoizedState?.current;
          if (current?.doc?.apply) result.app = current;
          if (current?.renderer && current?.entries) result.viewport = current;
          if (current?.model && current?.preferences) result.props = current;
        }
        return result;
      };
    });
    const before = await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx')));
    const sidebar = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    assert.equal(await page.locator('.pressed-keys-tool img').getAttribute('src'), './classic/btn-magical-sentry.png');
    assert.equal(await page.locator('.pressed-keys-tool>span:not(.warmkey-badge)').textContent(), 'KEY');
    await page.locator('[data-warmkey="bitsAndParts"]').click();
    await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Collect Bit', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Close BitsAndParts', exact: true }).click();
    await page.locator('[data-warmkey="geosetsAll"]').click();
    // Exercise the same selection callback used by the vertex picker, with a
    // partial patch, a triangle from another geoset and one loose point.
    await page.evaluate(() => bitTestState().props.onSelectionChange({ 0: [0, 1, 2, 3], 1: [4, 5, 6], 2: [0] }));
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Selected: 8'));
    await page.waitForFunction(() => bitTestState().app.session.assets.has('white.tga'));
    await page.locator('[data-warmkey="bitsAndParts"]').click();
    await page.getByRole('button', { name: 'Collect Bit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Collect Bit', exact: true }); await dialog.waitFor();
    assert.match(await dialog.innerText(), /3 geosets · 8 selected vertices/);
    await page.getByLabel('Bit name', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Import from current', exact: true }).click();
    assert.match(await dialog.innerText(), /Stand RGB 1/); assert.match(await dialog.innerText(), /Stand RGB 2/);
    const addRgb = async (label, rgb) => {
      await page.getByRole('button', { name: 'Create new', exact: true }).click();
      await page.getByLabel('RGB animation name', { exact: true }).fill(label);
      for (const [index, channel] of ['R', 'G', 'B'].entries()) await page.getByLabel(channel + ' value', { exact: true }).fill(String(rgb[index]));
      await page.waitForFunction(expected => {
        const state = bitTestState('.parts-preview [aria-label="3D model viewport"]');
        return state.viewport?.entries?.length === 3 && state.viewport.entries.every(entry => entry.meshes.every(mesh => mesh.material.userData.geosetTint.value.toArray().every((value, index) => Math.abs(value - expected[index] / 255) < 1e-6)));
      }, rgb);
      await page.screenshot({ path: path.join(output, label + '-live.png') });
      await page.getByRole('button', { name: 'Add RGB animation', exact: true }).click();
    };
    await addRgb('Red', [255, 0, 0]); await addRgb('Cyan', [0, 255, 255]);
    await page.getByRole('button', { name: 'Save Bit', exact: true }).click();
    await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor();
    await page.getByLabel('Source animation', { exact: true }).waitFor();
    const collected = openDocument(fs.readFileSync(collectedFile), name + '.mdx');
    assert.deepEqual(collected.model.Geosets.map(geoset => geoset.Vertices.length / 3), [4, 3, 1]);
    assert.deepEqual(collected.model.Sequences.map(sequence => sequence.Name), ['Stand RGB 1', 'Stand RGB 2', 'Red', 'Cyan']);
    assert.deepEqual(partPresetColor(collected.model, 3), [0, 1, 1]);
    const textureFile = path.join(root, 'BitsAndParts', collected.model.Textures[0].Image);
    assert.equal(textureFile, expectedAsset); if (!assetExisted) savedAssets = [textureFile];
    assert.deepEqual(fs.readFileSync(textureFile), Buffer.from(texture));
    assert.deepEqual(await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx'))), before);
    await page.getByLabel('Source animation', { exact: true }).selectOption('3');
    await page.waitForFunction(() => document.querySelector('.parts-rgb')?.textContent.includes('RGB 0, 255, 255'));
    await page.getByRole('button', { name: 'Import whole part', exact: true }).click();
    await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor({ state: 'detached' });
    const imported = openDocument(new Uint8Array(await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx')))));
    assert.equal(imported.model.Geosets.length, 6);
    for (const animation of imported.model.GeosetAnims.filter(animation => animation.GeosetId >= 3)) assert.deepEqual([...animation.Color], [0, 1, 1]);
    assert.deepEqual(validateModel(imported.model).filter(issue => issue.severity === 'error'), []);
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), sidebar);
    assert.ok(fs.readFileSync(fixture).equals(original)); assert.deepEqual(errors, []);
    console.log('PASS Electron: selected multi-geoset Collect Bit, current RGB import, live rendered RGB sliders, texture-backed disk save, animation choice and re-import, KEY overlay and unchanged donor/sidebar.');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close(); if (fs.existsSync(collectedFile)) fs.unlinkSync(collectedFile); for (const file of savedAssets) if (fs.existsSync(file)) fs.unlinkSync(file); }
})().catch(error => { console.error(error); process.exitCode = 1; });
