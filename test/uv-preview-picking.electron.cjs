// Run against the rebuilt bundle: node test/uv-preview-picking.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const output = path.resolve('out/uv-preview-picking'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(output, 'starter.mdx');
  fs.writeFileSync(fixture, Buffer.from(createStarterDocument().serialize('mdx')));
  const original = fs.readFileSync(fixture);
  const app = await _electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, `profile-${Date.now()}`) }, timeout: 60000,
  });
  let uv;
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.locator('[aria-label="3D model viewport"]').click();
    await page.keyboard.press('Control+a');
    const opened = app.waitForEvent('window');
    await page.locator('[data-warmkey="uv"]').click(); uv = await opened; uv.setDefaultTimeout(15000);
    const toggle = uv.getByRole('button', { name: 'show verticles', exact: true });
    await toggle.waitFor();
    await uv.locator('[data-clean-model-canvas]').waitFor({ timeout: 60000 });
    await uv.evaluate(() => {
      window.uvState = () => {
        const root = document.querySelector('.uv-workspace');
        let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.eligibleSelection) return fiber.memoizedProps;
        throw Error('UV workspace props unavailable');
      };
      window.previewState = () => {
        const root = document.querySelector('.game-preview-root');
        let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState?.current;
          if (state?.native && state?.controls) return state;
        }
        throw Error('Preview camera unavailable');
      };
      window.uvMapSelection = () => {
        const canvas = document.querySelector('.uv-map-pane canvas');
        let fiber = canvas[Object.keys(canvas).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) {
          if (fiber.memoizedProps?.geoset?.TVertices && fiber.memoizedProps?.selectedVertices) return fiber.memoizedProps.selectedVertices;
        }
        throw Error('UV map selection unavailable');
      };
      window.pickLocations = () => {
        const canvas = document.querySelector('[data-clean-model-canvas]'), rect = canvas.getBoundingClientRect();
        const geoset = uvState().model.Geosets[0], camera = previewState().controls.object;
        const Vector3 = camera.position.constructor;
        const points = Array.from({ length: geoset.Vertices.length / 3 }, (_, index) => {
          const projected = new Vector3().fromArray(geoset.Vertices, index * 3).project(camera);
          return { x: (projected.x + 1) * rect.width / 2, y: (1 - projected.y) * rect.height / 2, z: projected.z };
        });
        const faces = [];
        for (let offset = 0; offset < geoset.Faces.length; offset += 3) {
          const ids = Array.from(geoset.Faces.slice(offset, offset + 3));
          const center = { x: ids.reduce((sum, id) => sum + points[id].x, 0) / 3, y: ids.reduce((sum, id) => sum + points[id].y, 0) / 3, z: ids.reduce((sum, id) => sum + points[id].z, 0) / 3 };
          if (center.x > 10 && center.x < rect.width - 10 && center.y > 10 && center.y < rect.height - 10) faces.push({ ids, ...center });
        }
        faces.sort((a, b) => a.z - b.z);
        return { rect: { x: rect.x, y: rect.y }, face: faces[0], points };
      };
    });
    await uv.waitForFunction(() => uvState().selectionByGeoset[0]?.length === 8);
    const before = await uv.evaluate(() => JSON.stringify(uvState().model));
    const location = await uv.evaluate(() => pickLocations());
    assert.ok(location.face, 'A projected cube polygon must be visible');
    await uv.mouse.click(location.rect.x + location.face.x, location.rect.y + location.face.y);
    await uv.waitForFunction(() => uvState().selectionByGeoset[0]?.length === 3);
    await uv.waitForFunction(() => uvMapSelection().length === 3);
    const polygon = await uv.evaluate(() => uvState().selectionByGeoset[0]);
    assert.deepEqual([...polygon].sort((a, b) => a - b), [...location.face.ids].sort((a, b) => a - b));
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await uv.evaluate(() => {
      const root = document.querySelector('.game-preview-root');
      let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.previewSelectionMode) return fiber.memoizedProps.previewSelectionMode;
    }), 'vertices');
    let selectedVertex = false;
    for (const point of location.points) {
      await uv.mouse.click(location.rect.x + point.x, location.rect.y + point.y);
      selectedVertex = await uv.evaluate(() => uvState().selectionByGeoset[0]?.length === 1);
      if (selectedVertex) break;
    }
    assert.ok(selectedVertex, 'A visible model vertex must select one UV coordinate');
    await uv.waitForFunction(() => uvMapSelection().length === 1);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await uv.mouse.click(location.rect.x + location.face.x, location.rect.y + location.face.y);
    await uv.waitForFunction(() => uvState().selectionByGeoset[0]?.length === 3);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await uv.evaluate(() => JSON.stringify(uvState().model)), before);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS Electron UV: polygon picks three UV corners; vertex toggle picks one; repeated toggle and model preservation');
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
