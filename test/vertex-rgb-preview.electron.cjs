// Exercise the rebuilt Electron bundle: set MDLXL_PLAYWRIGHT_MODULE if Playwright is external.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);

(async () => {
  const out = path.resolve('out/vertex-rgb-preview');
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument();
  doc.apply('RGB preview fixture', ['Sequences', 'GeosetAnims', 'Materials', 'Textures'], model => {
    model.Sequences[0].Interval[0] = 333;
    model.GeosetAnims[0].Color = { LineType: 1, GlobalSeqId: null, Keys: [
      { Frame: 333, Vector: new Float32Array([1, 0, 0]) },
      { Frame: 1000, Vector: new Float32Array([0, 0, 1]) },
    ] };
    model.GeosetAnims[0].Alpha = { LineType: 1, GlobalSeqId: null, Keys: [
      { Frame: 0, Vector: new Float32Array([1]) },
      { Frame: 333, Vector: new Float32Array([0]) },
      { Frame: 1000, Vector: new Float32Array([1]) },
    ] };
    model.Textures.push({ ...model.Textures[0] });
    model.Materials[0].Layers[0].TextureID = { LineType: 0, GlobalSeqId: null, Keys: [
      { Frame: 0, Vector: new Uint32Array([0]) },
      { Frame: 333, Vector: new Uint32Array([1]) },
    ] };
  });
  const fixture = path.join(out, 'preview-fixture.mdx');
  fs.writeFileSync(fixture, Buffer.from(doc.serialize('mdx')));
  const bytes = fs.readFileSync(fixture);
  const app = await _electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) },
    timeout: 60000,
  });
  const errors = [];
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setBackgroundThrottling(false);
      window.setPosition(-3000, 0);
      window.showInactive();
    });
    const toggle = page.getByRole('checkbox', { name: 'RGB Preview', exact: true });
    await toggle.waitFor({ timeout: 60000 });
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    await page.evaluate(() => {
      window.viewportState = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current;
          if (value?.renderer && value?.entries) return value;
        }
        throw Error('Viewport runtime not found');
      };
      window.rgbSnapshot = () => viewportState().entries.map(entry => ({
        visible: entry.group.visible,
        meshes: entry.meshes.map(mesh => mesh.visible),
        depth: entry.depth.visible,
        wire: entry.wire.visible,
        tint: entry.meshes[0].material.userData.geosetTint.value.toArray(),
        materialColor: entry.meshes[0].material.color.getHex(),
        texture: entry.meshes[0].material.map?.uuid || null,
        uv: Array.from(entry.meshes[0].geometry.attributes.uv.array),
        vertices: Array.from(entry.geometry.attributes.position.array),
      }));
    });
    await page.waitForFunction(() => window.viewportState().entries.length === 5 && window.viewportState().entries[0].meshes[0].visible);
    const off = await page.evaluate(() => rgbSnapshot());
    assert.ok(off.every(entry => entry.tint.every(value => value === 1)), 'off means no geoset RGB tint');
    assert.equal(off[0].visible, true);

    await toggle.check();
    await page.waitForFunction(() => window.rgbSnapshot()[0].tint[1] === 0);
    const on = await page.evaluate(() => rgbSnapshot());
    assert.deepEqual(on.map(entry => entry.visible), off.map(entry => entry.visible), 'RGB cannot change geoset visibility');
    assert.deepEqual(on.map(entry => entry.meshes), off.map(entry => entry.meshes), 'RGB cannot change layer visibility');
    assert.deepEqual(on.map(entry => entry.depth), off.map(entry => entry.depth), 'RGB cannot change depth rendering');
    assert.deepEqual(on.map(entry => entry.texture), off.map(entry => entry.texture), 'RGB cannot change texture selection');
    assert.deepEqual(on.map(entry => entry.uv), off.map(entry => entry.uv), 'RGB cannot change UVs');
    assert.deepEqual(on.map(entry => entry.vertices), off.map(entry => entry.vertices), 'RGB cannot change vertices');
    assert.deepEqual(on[0].tint, [1, 0, 0], 'animation RGB should tint first geoset');
    [on[1].tint[0], on[1].tint[1], on[1].tint[2]].forEach((value, index) => near(value, [0.7, 0.44, 0.12][index]));
    await page.screenshot({ path: path.join(out, 'rgb-on-textured.png') });

    await page.getByLabel('Render mode', { exact: true }).selectOption('wireframe');
    await page.waitForFunction(() => window.rgbSnapshot().every(entry => entry.meshes.every(visible => !visible) && entry.depth && entry.wire));
    const wireOn = await page.evaluate(() => rgbSnapshot());
    await toggle.uncheck();
    await page.waitForFunction(() => window.rgbSnapshot().every(entry => entry.tint.every(value => value === 1)));
    const wireOff = await page.evaluate(() => rgbSnapshot());
    assert.deepEqual(wireOn.map(entry => [entry.visible, entry.meshes, entry.depth, entry.wire]), wireOff.map(entry => [entry.visible, entry.meshes, entry.depth, entry.wire]));
    await toggle.check();
    assert.ok((await page.evaluate(() => rgbSnapshot())).every(entry => entry.meshes.every(visible => !visible)), 'repeat enable keeps wireframe unfilled');
    await page.screenshot({ path: path.join(out, 'rgb-on-wireframe.png') });

    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    await page.waitForFunction(() => window.rgbSnapshot()[0].meshes[0] && window.rgbSnapshot()[0].tint[1] === 0);
    await toggle.uncheck();
    await page.waitForFunction(() => window.rgbSnapshot()[0].tint.every(value => value === 1));
    await toggle.check();
    await page.waitForFunction(() => window.rgbSnapshot()[0].tint[1] === 0);
    const point = await page.evaluate(() => {
      const state = viewportState();
      const projected = state.camera.position.clone().fromBufferAttribute(state.entries[0].geometry.attributes.position, 0).project(state.camera);
      const rect = state.controls.domElement.getBoundingClientRect();
      return { x: rect.x + (projected.x + 1) * rect.width / 2, y: rect.y + (1 - projected.y) * rect.height / 2 };
    });
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.viewportState().entries[0].selectedPoints.geometry.index?.count === 1);
    const beforeEdit = await page.evaluate(() => Array.from(viewportState().entries[0].geoset.Vertices));
    await page.keyboard.press('m');
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 30, point.y + 14, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(previous => Array.from(viewportState().entries[0].geoset.Vertices).some((value, index) => value !== previous[index]), beforeEdit);
    await page.waitForFunction(() => window.rgbSnapshot()[0].tint[1] === 0);
    assert.deepEqual((await page.evaluate(() => rgbSnapshot()))[0].tint, [1, 0, 0], 'RGB stays visible while editing');
    assert.deepEqual(fs.readFileSync(fixture), bytes, 'preview toggles must not write the model');
    assert.deepEqual(errors, []);
    console.log('Electron RGB Preview: off/on/off, all geosets, visibility, materials, UVs, wireframe, live editing, and unchanged input file passed');
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {});
    await app.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
