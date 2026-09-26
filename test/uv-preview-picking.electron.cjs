// Run against the rebuilt bundle: node test/uv-preview-picking.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const output = path.resolve('out/uv-preview-picking'); fs.mkdirSync(output, { recursive: true });
  const fixture = path.resolve('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const geosetIndex = 15;
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
    await page.getByLabel(`Select geoset ${geosetIndex}`, { exact: true }).waitFor({ timeout: 60000 });
    await page.locator('[data-warmkey="geosetsClear"]').click();
    await page.getByLabel(`Select geoset ${geosetIndex}`, { exact: true }).check();
    await page.locator('[aria-label="3D model viewport"]').click();
    await page.keyboard.press('Control+a');
    const opened = app.waitForEvent('window');
    await page.locator('[data-warmkey="uv"]').click(); uv = await opened; uv.setDefaultTimeout(15000);
    const toggle = uv.getByRole('button', { name: 'Live Select', exact: true });
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
      window.previewProps = () => {
        const root = document.querySelector('.game-preview-root');
        let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const current = hook.memoizedState?.current;
          if (current?.previewSelectionMode) return current;
        }
        throw Error('Preview props unavailable');
      };
      window.pickLocations = () => {
        const canvas = document.querySelector('[data-clean-model-canvas]'), rect = canvas.getBoundingClientRect();
        const geoset = uvState().model.Geosets[15], camera = previewState().controls.object;
        const Vector3 = camera.position.constructor;
        const points = Array.from({ length: geoset.Vertices.length / 3 }, (_, index) => {
          const projected = new Vector3().fromArray(geoset.Vertices, index * 3).project(camera);
          return { x: (projected.x + 1) * rect.width / 2, y: (1 - projected.y) * rect.height / 2, z: projected.z };
        });
        const faces = [];
        for (let offset = 0; offset < geoset.Faces.length; offset += 3) {
          const ids = Array.from(geoset.Faces.slice(offset, offset + 3));
          const center = { x: ids.reduce((sum, id) => sum + points[id].x, 0) / 3, y: ids.reduce((sum, id) => sum + points[id].y, 0) / 3, z: ids.reduce((sum, id) => sum + points[id].z, 0) / 3 };
          const a = points[ids[0]], b = points[ids[1]], c = points[ids[2]], area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
          if (area > 10 && center.x > 10 && center.x < rect.width - 10 && center.y > 10 && center.y < rect.height - 10) faces.push({ ids, ...center, area });
        }
        faces.sort((a, b) => a.z - b.z || b.area - a.area);
        return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, faces, points };
      };
    });
    await uv.waitForFunction(() => uvState().selectionByGeoset[15]?.length === 248);
    const before = await uv.evaluate(() => JSON.stringify(uvState().model));
    const selectedOnly = uv.getByRole('button', { name: 'Selected Only', exact: true });
    assert.equal(await selectedOnly.getAttribute('aria-pressed'), 'false');
    assert.equal(await uv.evaluate(() => uvState().preferences.visuals.uvSelection), '#4cff59');
    assert.equal(await uv.evaluate(() => uvState().preferences.uvPreviewDisplay.size), .25);
    assert.ok((await uv.evaluate(() => pickLocations())).faces.length, 'Normal Warcraft model polygons must be large enough to pick on first open');
    const canvas = uv.locator('[data-clean-model-canvas]'), box = await canvas.boundingBox();
    const cameraBefore = await uv.evaluate(() => previewState().controls.object.quaternion.toArray());
    await uv.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await canvas.evaluate(element => element.style.cursor), 'default', 'idle polygon selection uses the normal pointer');
    await uv.mouse.down(); await uv.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 });
    assert.match(await canvas.evaluate(element => element.style.cursor), /data:image\/svg\+xml/, 'polygon mode shows the rotate pointer during a rotation drag');
    await uv.mouse.up();
    assert.equal(await canvas.evaluate(element => element.style.cursor), 'default', 'releasing a rotation restores the normal pointer');
    const cameraAfter = await uv.evaluate(() => previewState().controls.object.quaternion.toArray());
    assert.notDeepEqual(cameraAfter, cameraBefore, 'dragging the preview must rotate the camera');
    assert.equal(await uv.evaluate(() => uvState().selectionByGeoset[15]?.length), 248, 'camera drag must not change UV selection');
    const zoomBefore = await uv.evaluate(() => previewState().controls.object.zoom);
    await uv.mouse.wheel(0, -250);
    await uv.waitForFunction(value => previewState().controls.object.zoom !== value, zoomBefore);
    const moveTool = uv.getByRole('button', { name: 'Move', exact: true });
    await moveTool.click();
    const mapBox = await uv.locator('.uv-map-pane canvas').first().boundingBox();
    await uv.mouse.move(mapBox.x + 20, mapBox.y + 20);
    await uv.keyboard.down('a'); await uv.keyboard.up('a');
    assert.equal(await moveTool.getAttribute('aria-pressed'), 'true', 'A over the UV map must not change its tool');
    await uv.getByRole('button', { name: 'Select', exact: true }).click();
    const location = await uv.evaluate(() => pickLocations());
    assert.ok(location.faces.length, 'Projected Warcraft model polygons must be visible');
    let pickedFace = null;
    const firstFace = location.faces[0], faceX = location.rect.x + firstFace.x, faceY = location.rect.y + firstFace.y;
    await uv.mouse.click(faceX, faceY);
    assert.equal(await uv.evaluate(() => uvState().selectionByGeoset[15]?.length), 248, 'ordinary preview clicks leave UV selection unchanged');
    await uv.keyboard.down('a');
    const clickCamera = await uv.evaluate(() => previewState().controls.object.quaternion.toArray());
    for (const face of location.faces.slice(0, 100)) {
      if (pickedFace) break;
      await uv.mouse.click(location.rect.x + face.x, location.rect.y + face.y);
      if (await uv.evaluate(() => uvState().selectionByGeoset[15]?.length === 3)) { pickedFace = face; break; }
    }
    assert.ok(pickedFace, 'holding A selects model polygons while other geosets remain visible');
    assert.deepEqual(await uv.evaluate(() => previewState().controls.object.quaternion.toArray()), clickCamera, 'A selection must not rotate the camera');
    await uv.keyboard.up('a');
    await uv.waitForFunction(() => uvMapSelection().length === 3);
    const selectedWithA = await uv.evaluate(() => JSON.stringify(uvState().selectionByGeoset));
    await uv.mouse.click(faceX, faceY);
    assert.equal(await uv.evaluate(() => JSON.stringify(uvState().selectionByGeoset)), selectedWithA, 'releasing A returns clicks to camera control');
    assert.equal(await selectedOnly.getAttribute('aria-pressed'), 'false');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await uv.getByLabel('Highlight selected vertices in live preview').check();
    await uv.getByLabel('Live selection and texture-frame color').fill('#33cc66');
    const thickness = uv.getByLabel('Live selection thickness');
    await thickness.focus(); await thickness.press('ArrowUp');
    await uv.waitForFunction(() => previewProps().previewOverlay.color === '#33cc66' && previewProps().previewOverlay.size === .5);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    await uv.waitForFunction(() => previewProps().previewSelectionMode === 'vertices');
    await uv.waitForFunction(() => {
      const canvas = document.querySelector('[data-geometry-overlay]');
      if (!canvas) return false;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset] === 51 && pixels[offset + 1] === 204 && pixels[offset + 2] === 102 && pixels[offset + 3]) return true;
      return false;
    });
    await uv.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await canvas.evaluate(element => element.style.cursor), 'default', 'idle Live Select uses the normal pointer');
    assert.equal(await uv.evaluate(() => previewProps().previewSelectionMode), 'vertices');
    assert.equal(await uv.evaluate(() => previewProps().previewOverlay.color), '#33cc66');
    assert.equal(await uv.evaluate(() => previewProps().previewOverlay.size), .5);
    const firstVertex = location.points.find(point => point.x > 10 && point.x < location.rect.width - 10 && point.y > 10 && point.y < location.rect.height - 10 && point.z >= -1 && point.z <= 1);
    assert.ok(firstVertex, 'A selectable Warcraft model vertex is on screen');
    const vertexX = location.rect.x + firstVertex.x, vertexY = location.rect.y + firstVertex.y;
    await uv.keyboard.down('a');
    await uv.mouse.move(vertexX, vertexY); await uv.mouse.down();
    const vertexCamera = await uv.evaluate(() => previewState().controls.object.quaternion.toArray());
    await uv.mouse.move(vertexX + 3, vertexY + 1);
    assert.deepEqual(await uv.evaluate(() => previewState().controls.object.quaternion.toArray()), vertexCamera, 'A vertex selection must not rotate the camera');
    await uv.mouse.up();
    await uv.keyboard.up('a');
    assert.equal(await uv.evaluate(() => uvState().selectionByGeoset[15]?.length), 1, 'holding A selects a model vertex on the UV map');
    await uv.waitForFunction(() => uvMapSelection().length === 1);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await uv.keyboard.down('a');
    await uv.mouse.click(location.rect.x + pickedFace.x, location.rect.y + pickedFace.y);
    await uv.keyboard.up('a');
    await uv.waitForFunction(() => uvState().selectionByGeoset[15]?.length === 3);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    await uv.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await uv.mouse.down(); await uv.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 3 });
    assert.match(await canvas.evaluate(element => element.style.cursor), /data:image\/svg\+xml/, 'Live Select shows the rotate pointer during a rotation drag');
    await uv.mouse.up();
    assert.equal(await canvas.evaluate(element => element.style.cursor), 'default', 'Live Select restores the normal pointer after rotation');
    assert.equal(await uv.evaluate(() => JSON.stringify(uvState().model)), before);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS Electron UV: normal Warcraft model, hold A selects only in Live View, ordinary drags rotate, wheel zooms, visible vertex markers, shared highlight, unchanged model');
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
