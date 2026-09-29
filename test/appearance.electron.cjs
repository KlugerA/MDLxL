// Run after building: node test/appearance.electron.cjs
// Set MDLXL_PLAYWRIGHT_MODULE when Playwright is provided outside this checkout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const { buildSync } = require(path.join(process.cwd(), 'node_modules/esbuild'));

(async () => {
  const root = process.cwd(), out = path.join(root, 'out/appearance-audit');
  fs.mkdirSync(out, { recursive: true });
  const profile = path.join(out, 'profile-' + Date.now());
  fs.mkdirSync(profile);
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { rendererRevision: 3, graphics: { pauseWhenHidden: false } } }));
  const modelPath = path.join(root, 'fixtures/demo.mdx'), modelBytes = fs.readFileSync(modelPath);
  const bundle = buildSync({ stdin: { contents: `export { drawPreviewGeometryOverlay } from './app/preview-overlays.js'; export { drawPreviewBackground } from './app/game-preview-capture.js'; export { normalizePreferences } from './src/preferences.js'; export { exportConfiguration, importConfiguration } from './src/portable-settings.js'; export { BUILT_IN_VIEWPORT_PRESETS, backgroundImageRect } from './src/viewport-appearance.js'; export { OrthographicCamera, Vector3 } from 'three';`, resolveDir: root }, bundle: true, format: 'iife', globalName: 'appearanceAudit', write: false }).outputFiles[0].text;
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', root, modelPath], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  const result = { raster: null, presets: [], gaps: [] }, errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); });
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    await page.locator('.game-preview-root').waitFor();
    await page.evaluate(bundle);
    result.raster = await page.evaluate(() => {
      const { drawPreviewGeometryOverlay, drawPreviewBackground, OrthographicCamera, Vector3, BUILT_IN_VIEWPORT_PRESETS, normalizePreferences, exportConfiguration, importConfiguration } = appearanceAudit;
      const check = (ok, message) => { if (!ok) throw Error(message); };
      const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 100);
      camera.position.z = 5; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      const geosets = [{ index: 0, faces: new Uint16Array([0, 1, 2]), vertices: new Float32Array([-.7, -.7, 0, .7, -.7, 0, 0, .7, 0]) }], original = JSON.stringify(geosets);
      let markers = 0, wires = 0, backgrounds = 0;
      for (const preset of Object.values(BUILT_IN_VIEWPORT_PRESETS)) {
        const prefs = normalizePreferences({ rendererRevision: 3, theme: preset.theme, viewportPreset: preset.id, viewportAppearance: preset.appearance });
        check(JSON.stringify(importConfiguration(JSON.stringify(exportConfiguration(prefs)))) === JSON.stringify(prefs), preset.name + ' configuration round trip');
        for (const ratio of [1, 1.5, 2]) for (const style of ['square', 'circle', 'diamond']) for (const mode of ['unselected', 'selected', 'bone-colors']) {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 200 * ratio;
          const context = canvas.getContext('2d'), appearance = structuredClone(preset.appearance);
          appearance.selectedVertex.style = appearance.unselectedVertex.style = style;
          const options = { vertices: mode !== 'selected', selectedVerticesOnly: mode === 'selected', preferences: { viewportAppearance: appearance } };
          if (mode === 'selected') options.selectionByGeoset = { 0: [0, 1, 2] };
          if (mode === 'bone-colors') options.boneVertexColors = new Map([[0, new Map([[0, '#808080'], [1, '#808080'], [2, '#808080']])]]);
          drawPreviewGeometryOverlay(context, geosets, camera, 200, 200, options, new Vector3(), 1, ratio);
          const alpha = (x, y) => context.getImageData(Math.round(x * ratio), Math.round(y * ratio), 1, 1).data[3];
          check(alpha(100, 100) === 0, `${preset.name}/${style}/${mode}/${ratio}: filled space between markers`);
          for (const [x, y] of [[30, 170], [170, 170], [100, 30]]) check(alpha(x, y) > 0, 'missing vertex marker');
          markers++;
        }
        for (const style of ['solid', 'dotted', 'dashed']) for (const opacity of [0, .5, 1]) {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 200;
          const context = canvas.getContext('2d'), appearance = structuredClone(preset.appearance);
          appearance.selectedGeoset = { ...appearance.selectedGeoset, style, opacity, spacing: 9 };
          drawPreviewGeometryOverlay(context, geosets, camera, 200, 200, { wires: true, selectableGeosets: [0], preferences: { viewportAppearance: appearance } }, new Vector3(), 1);
          const data = context.getImageData(0, 0, 200, 200).data;
          const visible = data.some((v, i) => i % 4 === 3 && v > 0);
          check(visible === (opacity > 0), preset.name + '/' + style + ': wire opacity'); wires++;
        }
      }
      const image = document.createElement('canvas'); image.width = 80; image.height = 40;
      image.getContext('2d').fillStyle = '#ff0000'; image.getContext('2d').fillRect(0, 0, 80, 40);
      for (const display of ['fit', 'fill', 'stretch', 'center']) for (const opacity of [0, .5, 1]) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
        const context = canvas.getContext('2d'); drawPreviewBackground(context, 100, 100, image, '#0000ff', { display, opacity });
        const center = context.getImageData(50, 50, 1, 1).data;
        check(Math.abs(center[0] - 255 * opacity) <= 1 && Math.abs(center[2] - 255 * (1 - opacity)) <= 1, display + ': background opacity');
        const corner = context.getImageData(0, 0, 1, 1).data;
        if (display === 'fit' || display === 'center') check(corner[2] === 255, display + ': background layout'); backgrounds++;
      }
      check(JSON.stringify(geosets) === original, 'appearance mutated model data');
      return { markers, wires, backgrounds };
    });
    console.log('Native canvas checks:', result.raster);
    const menu = action => app.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].webContents.send('menu', value), action);
    await menu('appearanceSettings');
    await page.getByRole('dialog', { name: 'Settings' }).waitFor();
    await page.evaluate(() => {
      window.currentFiber = host => { let f = host[Object.keys(host).find(k => k.startsWith('__reactFiber'))], top=f; while(top.return)top=top.return; return top.stateNode.current===top?f:f.alternate||f; };
      window.auditSettings = () => {
        const host = document.querySelector('.settings-window');
        let fiber = currentFiber(host);
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.preferences && fiber.memoizedProps.onChange) return fiber.memoizedProps;
        throw Error('Settings owner not found');
      };
      window.auditPreview = () => {
        const host = document.querySelector('.game-preview-root');
        let fiber = currentFiber(host);
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model && fiber.memoizedProps.preferences) return fiber.memoizedProps;
        throw Error('Preview owner not found');
      };
    });
    const originalModel = await page.evaluate(() => JSON.stringify(auditPreview().model));
    const presets = await page.evaluate(() => Object.values(appearanceAudit.BUILT_IN_VIEWPORT_PRESETS).map(p => ({ id: p.id, name: p.name, theme: p.theme, background: p.appearance.background.color })));
    for (const preset of presets) {
      await page.getByLabel('Viewport appearance preset').selectOption(preset.id);
      await page.waitForFunction(id => auditSettings().preferences.viewportPreset === id && auditPreview().preferences.viewportPreset === id, preset.id);
      const state = await page.evaluate(() => ({ theme: auditSettings().preferences.theme, background: getComputedStyle(document.documentElement).getPropertyValue('--visual-background').trim(), model: JSON.stringify(auditPreview().model) }));
      assert.equal(state.theme, preset.theme); assert.equal(state.background, preset.background); assert.equal(state.model, originalModel);
      result.presets.push(preset.name);
    }
    const palette = await page.evaluate(() => JSON.stringify(auditSettings().preferences.viewportAppearance));
    await page.locator('[data-warmkey="appearance:theme:light"]').click();
    assert.equal(await page.evaluate(() => JSON.stringify(auditSettings().preferences.viewportAppearance)), palette);
    await page.getByLabel('Custom viewport preset name').fill('Appearance audit');
    await page.getByRole('button', { name: 'Save as custom preset', exact: true }).click();
    const custom = await page.evaluate(() => auditSettings().preferences.viewportPreset);
    await page.getByLabel('Viewport appearance preset').selectOption('mdlvis-vanilla');
    await page.getByLabel('Viewport appearance preset').selectOption(custom);
    assert.equal(await page.evaluate(() => JSON.stringify(auditSettings().preferences.viewportAppearance)), palette);
    await page.getByRole('button', { name: 'Delete selected preset', exact: true }).click();
    assert.equal(await page.evaluate(() => JSON.stringify(auditSettings().preferences.viewportAppearance)), palette);
    // Large, valid background configurations must survive the real file-import control.
    const configuration = await page.evaluate(() => {
      const prefs = appearanceAudit.normalizePreferences(auditSettings().preferences);
      prefs.viewportAppearance.background.imageData = 'data:image/png;base64,' + 'AAAA'.repeat(1_100_000);
      prefs.viewportAppearance.background.imageName = 'large-reference.png'; prefs.viewportAppearance.background.type = 'color';
      return JSON.stringify(appearanceAudit.exportConfiguration(prefs));
    });
    await menu('configurationSettings');
    await page.getByRole('button', { name: 'Import configuration…', exact: true }).waitFor();
    await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({ name: 'appearance.json', mimeType: 'application/json', buffer: Buffer.from(configuration) });
    await page.waitForFunction(() => document.querySelector('.settings-message')?.textContent?.match(/Configuration (imported|exceeds)/));
    const message = await page.locator('.settings-message').innerText();
    if (!message.includes('Configuration imported.')) result.gaps.push('Large background import: ' + message);
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await menu('appearanceSettings');
    await page.getByLabel('Viewport appearance preset').selectOption('solarized-light');
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await page.locator('[data-warmkey="paint"]').click();
    await page.locator('.paint-workspace').waitFor();
    const tip = await page.locator('.paint-workspace').evaluate(el => getComputedStyle(el).getPropertyValue('--paint-tip').trim());
    if (tip !== '#242424') result.gaps.push('Silvermoon uses dark-theme brush tips: ' + tip);
    assert.deepEqual(fs.readFileSync(modelPath), modelBytes);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!process.argv.includes('--audit-before-fixes')) assert.deepEqual(result.gaps, []);
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
