const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const output = path.resolve('out/grabthrough-ui'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(output, 'grabthrough.mdx');
  const fixtureDocument = createStarterDocument(), fixtureGeoset = fixtureDocument.model.Geosets[0], fixtureVertices = fixtureGeoset.Vertices;
  [[0, 20, -18], [0, 28, -18], [0, 20, -10], [0, 28, -10]].forEach((point, index) => fixtureVertices.set(point, [0, 3, 4, 7][index] * 3));
  fixtureGeoset.Faces = new Uint32Array([1, 2, 6, 1, 6, 5]);
  fs.writeFileSync(fixture, Buffer.from(fixtureDocument.serialize('mdx')));
  const app = await _electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) },
    timeout: 60000,
  });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(30000);
    const marqueeAll = async locator => {
      const box = await locator.boundingBox(); assert.ok(box);
      await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10);
      await page.mouse.down();
      await page.mouse.move(box.x + 5, box.y + 5, { steps: 8 });
      await page.mouse.up();
    };
    const selectedCount = async () => Number(await page.locator('.classic-counts>div').nth(1).locator('span').textContent());
    const selectedPixels = async (locator, name) => {
      await page.waitForTimeout(100);
      const png = await locator.screenshot({ path: path.join(output, name) });
      return page.evaluate(async source => {
        const bytes = Uint8Array.from(atob(source), value => value.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); image.close();
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset] > 200 && pixels[offset + 1] < 80 && pixels[offset + 2] < 80 && pixels[offset + 3] > 200) count++;
        return count;
      }, png.toString('base64'));
    };
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    const vertexToggle = page.getByLabel('Grabthrough', { exact: true });
    assert.equal(await vertexToggle.isChecked(), false, 'Vertex Grabthrough defaults off');
    await page.getByLabel('View direction', { exact: true }).selectOption('front');
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    await marqueeAll(page.getByLabel('3D model viewport'));
    assert.equal(await selectedCount(), 4, 'Vertex textured selection excludes the hidden rear vertices');
    await vertexToggle.check(); assert.equal(await vertexToggle.isChecked(), true);
    await marqueeAll(page.getByLabel('3D model viewport'));
    assert.equal(await selectedCount(), 8, 'Vertex Grabthrough selects the hidden rear vertices');
    await vertexToggle.uncheck();
    const vertexOccluded = await selectedPixels(page.getByLabel('3D model viewport'), 'vertex-grabthrough-off.png');
    await vertexToggle.check();
    const vertexDrawThrough = await selectedPixels(page.getByLabel('3D model viewport'), 'vertex-grabthrough-on.png');
    assert.ok(vertexDrawThrough > vertexOccluded, `Vertex Grabthrough draws the occluded selected vertices through Textured View (${vertexOccluded} -> ${vertexDrawThrough} red pixels)`);
    await vertexToggle.uncheck();
    await page.screenshot({ path: path.join(output, 'vertex-grabthrough.png') });

    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor({ timeout: 60000 });
    const bonesToggle = page.getByLabel('Grabthrough', { exact: true });
    assert.equal(await bonesToggle.isChecked(), false, 'Bones Grabthrough defaults off');
    await marqueeAll(page.locator('.game-preview-surface canvas').first());
    await page.getByRole('button', { name: 'Vertices', exact: true }).click();
    await page.getByLabel('3D model viewport').waitFor();
    assert.equal(await selectedCount(), 4, 'Bones textured selection excludes the hidden rear vertices');

    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor();
    await page.getByLabel('Grabthrough', { exact: true }).check();
    await marqueeAll(page.locator('.game-preview-surface canvas').first());
    await page.getByRole('button', { name: 'Vertices', exact: true }).click();
    await page.getByLabel('3D model viewport').waitFor();
    assert.equal(await selectedCount(), 8, 'Bones Grabthrough selects the hidden rear vertices');

    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor();
    await page.getByLabel('Grabthrough', { exact: true }).uncheck();
    const previewState = () => page.locator('.game-preview-root').evaluate(element => {
      let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))], top = fiber;
      while (top.return) top = top.return;
      fiber = top.stateNode.current === top ? fiber : fiber.alternate || fiber;
      for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model && fiber.memoizedProps?.preferences) return {
        mode: fiber.memoizedProps.mode, grabThrough: fiber.memoizedProps.grabThrough,
        xrayVertices: fiber.memoizedProps.preferences.viewportAppearance.xrayVertices,
      };
      throw Error('GamePreview props not found');
    });
    assert.deepEqual(await previewState(), { mode: 'textured', grabThrough: false, xrayVertices: false });
    const bonesOccluded = await selectedPixels(page.locator('.game-preview-root'), 'bones-grabthrough-off.png');
    await page.getByLabel('Grabthrough', { exact: true }).check();
    assert.deepEqual(await previewState(), { mode: 'textured', grabThrough: true, xrayVertices: false });
    const bonesDrawThrough = await selectedPixels(page.locator('.game-preview-root'), 'bones-grabthrough-on.png');
    assert.ok(bonesDrawThrough > bonesOccluded, `Bones Grabthrough draws the occluded selected vertices through Textured View (${bonesOccluded} -> ${bonesDrawThrough} red pixels)`);
    await page.screenshot({ path: path.join(output, 'bones-grabthrough.png') });

    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    assert.equal(await page.getByLabel('Grabthrough', { exact: true }).count(), 0, 'Grabthrough stays scoped to Vertex and Bones');
    console.log('Grabthrough is visible in Vertex and Bones, defaults off, toggles on, and stays out of Movement.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
