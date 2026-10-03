const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { openDocument } = await import('../src/editor-document.js');
  const root = process.cwd(), file = process.env.MDLXL_TEST_MODEL || path.join(root, 'out/resource-managers-xl/manager-fixture.mdx');
  const original = fs.readFileSync(file), source = openDocument(original, file).model;
  const emitter = source.ParticleEmitters2.find(n => n.Name === 'SoulFountain') || source.ParticleEmitters2[0];
  const seq = Math.max(0, source.Sequences.findIndex(s => s.Name === 'Spell Slam')), interval = Array.from(source.Sequences[seq].Interval);
  const out = path.join(root, 'out/animation-node-visibility'); fs.mkdirSync(out, { recursive: true });
  const shots = process.env.MDLXL_SCREENSHOTS || out; fs.mkdirSync(shots, { recursive: true });
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [root, file], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  let page; const errors = [];
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1600, 1000); w.setPosition(-3000, 0); w.webContents.setBackgroundThrottling(false); w.showInactive(); });
    await page.getByText(`Opened ${path.basename(file)}`, { exact: true }).waitFor();
    const menu = action => app.evaluate(({ BrowserWindow }, command) => BrowserWindow.getAllWindows()[0].webContents.send('menu', command), action);
    await menu('Nodes');
    await page.getByRole('dialog', { name: 'Node Manager', exact: true }).waitFor();
    await page.evaluate(() => {
      const el = document.querySelector('.re-window'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.doc?.serialize) { window.managerTestDoc = fiber.memoizedProps.doc; break; }
    });
    const beforeDrag = await page.locator('.re-window').boundingBox(), caption = await page.locator('.re-caption').boundingBox();
    await page.mouse.move(caption.x + 80, caption.y + 20); await page.mouse.down(); await page.mouse.move(caption.x - 210, caption.y + 55, { steps: 8 }); await page.mouse.up();
    const afterDrag = await page.locator('.re-window').boundingBox(); assert.ok(afterDrag.x < beforeDrag.x - 100, 'manager title bar moves the window');
    await page.getByLabel('Search nodes').fill(emitter.Name);
    await page.locator('[data-node-id="' + emitter.ObjectId + '"]').click();
    await page.getByRole('button', { name: 'Edit visibility in Animations →', exact: true }).click();
    assert.equal(await page.locator('.resource-editor').count(), 0);
    await page.getByLabel('Choose animation sequence', { exact: true }).selectOption(String(seq));
    await page.locator('.an-edit strong').filter({ hasText: emitter.Name }).waitFor();
    assert.equal(await page.getByLabel('Node controls mode').inputValue(), 'Clueless');
    const panel = page.locator('.animation-nodes');
    const globalLight = source.Lights.find(n => Number.isInteger(n.Visibility?.GlobalSeqId) && n.Visibility.GlobalSeqId >= 0);
    if (globalLight) {
      await page.getByRole('group', { name: 'Quick display', exact: true }).getByLabel('Nodes', { exact: true }).check();
      await page.getByLabel('View direction', { exact: true }).selectOption('front');
      await page.locator('.classic-view canvas[data-node-overlay]').waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const point = await page.evaluate(id => {
        const el = document.querySelector('.classic-view .game-preview-root'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState?.current;
          if (state?.native && state.controls) {
            const camera = state.controls.object, point = camera.position.clone().fromArray(managerTestDoc.model.Nodes[id].PivotPoint), matrix = state.native.rendererData.nodes[id]?.matrix;
            if (matrix) point.applyMatrix4(camera.matrixWorld.clone().fromArray(matrix));
            point.project(camera); const rect = el.querySelector('canvas[data-clean-model-canvas]').getBoundingClientRect();
            return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
          }
        }
      }, globalLight.ObjectId);
      await page.mouse.click(point.x, point.y);
      await panel.locator('.an-edit strong').filter({ hasText: globalLight.Name }).waitFor();
      await panel.getByRole('button', { name: 'Use this clock', exact: true }).click();
      await panel.getByRole('button', { name: 'Whole loop', exact: true }).click();
      await panel.getByRole('button', { name: 'Hide', exact: true }).click();
      assert.ok(await page.evaluate(id => managerTestDoc.model.Nodes[id].Visibility.Keys.every(k => k.Vector[0] === 0), globalLight.ObjectId));
      await menu('undo');
      await page.waitForFunction(id => managerTestDoc.model.Nodes[id].Visibility.Keys.some(k => k.Vector[0] === 1), globalLight.ObjectId);
      await page.getByLabel('Find animation node').fill(emitter.Name); await panel.locator('.an-list [role="option"]').filter({ hasText: emitter.Name }).click(); await page.getByLabel('Find animation node').fill('');
      await panel.getByRole('button', { name: 'Use this clock', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Choose animation sequence"]').value === '0');
    }
    const snapshot = () => page.evaluate(id => structuredClone(managerTestDoc.model.Nodes[id].Visibility), emitter.ObjectId);
    const before = await snapshot();
    await panel.getByRole('button', { name: 'Whole animation', exact: true }).click();
    await panel.getByRole('button', { name: 'Hide', exact: true }).click();
    let track = await snapshot();
    assert.equal(track.Keys.find(k => k.Frame === interval[0]).Vector[0], 0);
    assert.equal(track.Keys.find(k => k.Frame === interval[1]).Vector[0], 0);
    if (before?.Keys) assert.deepEqual(track.Keys.filter(k => k.Frame < interval[0] || k.Frame > interval[1]), before.Keys.filter(k => k.Frame < interval[0] || k.Frame > interval[1]));
    await menu('undo'); await page.waitForFunction(({ id, old }) => JSON.stringify(managerTestDoc.model.Nodes[id].Visibility) === old, { id: emitter.ObjectId, old: JSON.stringify(before) });
    await panel.getByRole('button', { name: 'This key', exact: true }).click();
    const reel = page.getByRole('slider', { name: 'Animation frame', exact: true }), box = await reel.boundingBox();
    const point = fraction => ({ x: box.x + box.width * fraction, y: box.y + 9 });
    let a = point(.26), b = point(.61);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
    const selected = await page.locator('.classic-reel-selection').evaluate(el => [Number(el.dataset.rangeStart), Number(el.dataset.rangeEnd)]);
    assert.ok(selected[0] > interval[0] && selected[1] < interval[1]);
    await panel.getByRole('button', { name: 'Hide', exact: true }).click();
    track = await snapshot(); assert.equal(track.Keys.find(k => k.Frame === selected[0]).Vector[0], 0); assert.equal(track.Keys.find(k => k.Frame === selected[1]).Vector[0], 0);
    await panel.getByRole('button', { name: 'This key', exact: true }).click();
    await page.keyboard.down('Control');
    for (const at of selected) {
      const x = box.x + (at - interval[0]) / (interval[1] - interval[0]) * box.width;
      await page.mouse.click(x, box.y + 8);
    }
    await page.keyboard.up('Control');
    await panel.getByText(/2 selected keys/).waitFor();
    await panel.getByRole('button', { name: 'Show', exact: true }).click();
    const keysChanged = await snapshot();
    assert.deepEqual(keysChanged.Keys.filter(k => !selected.includes(k.Frame)), track.Keys.filter(k => !selected.includes(k.Frame)));
    assert.ok(keysChanged.Keys.filter(k => selected.includes(k.Frame)).every(k => k.Vector[0] === 1));
    await panel.getByLabel('Preview particles', { exact: true }).check();
    await page.screenshot({ path: path.join(shots, 'animations-node-visibility.png') });
    await panel.getByRole('button', { name: 'More node settings…', exact: true }).click();
    await page.getByRole('heading', { name: emitter.Name, exact: true }).waitFor();
    await page.getByLabel('Search nodes').fill('');
    assert.equal(await page.getByLabel('Show hierarchy').isChecked(), false);
    assert.ok(await page.locator('.re-node-name').evaluateAll(items => items.every(el => el.scrollWidth <= el.clientWidth + 1)), 'node names wrap rather than truncate');
    await page.getByLabel('Show hierarchy').check();
    assert.ok(await page.locator('.re-tree-row').evaluateAll(items => items.every(el => parseFloat(el.style.paddingLeft) <= 52)), 'deep rigs keep a bounded readable indent');
    await page.screenshot({ path: path.join(shots, 'node-manager-readable.png') });
    await page.getByLabel('Manager mode').selectOption('Classic'); await page.locator('.inspector-fields').first().waitFor();
    await page.getByLabel('Manager mode').selectOption('Clueless');
    await page.getByRole('navigation', { name: 'Resource managers' }).getByRole('button', { name: 'Geosets', exact: true }).click();
    await page.evaluate(() => {
      window.meshDraws = new Map();
      const original = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (...args) {
        if (!meshDraws.has(this.canvas)) meshDraws.set(this.canvas, new Set());
        meshDraws.get(this.canvas).add(this.getParameter(this.ELEMENT_ARRAY_BUFFER_BINDING));
        return original.apply(this, args);
      };
    });
    await page.getByText('Preview isolated mesh', { exact: true }).click(); await page.locator('.re-model-stage canvas[data-clean-model-canvas]').waitFor();
    const isolation = await page.evaluate(() => {
      const el = document.querySelector('.re-model-stage .game-preview-root'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.isolatedGeosets) return { fit: fiber.memoizedProps.isolatedGeosets, hidden: [...fiber.memoizedProps.hiddenGeosets], count: fiber.memoizedProps.model.Geosets.length };
    });
    assert.deepEqual(isolation.fit, [0]); assert.equal(isolation.hidden.length, isolation.count - 1);
    const drawnIds = await page.evaluate(() => {
      const el = document.querySelector('.re-model-stage .game-preview-root'), canvas = el.querySelector('canvas[data-clean-model-canvas]');
      let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.native?.indexBuffer) return state.native.indexBuffer.flatMap((buffer, i) => window.meshDraws.get(canvas)?.has(buffer) ? [i] : []);
      }
    });
    assert.deepEqual(drawnIds, [0], 'actual GL draws must contain only the isolated mesh');
    await page.screenshot({ path: path.join(shots, 'isolated-geoset.png') });
    await page.getByRole('button', { name: 'Close Geoset Manager', exact: true }).click();
    await panel.getByRole('button', { name: 'EMTR…', exact: true }).click();
    await page.getByRole('dialog', { name: 'Particle Editor', exact: true }).waitFor();
    const effectBox = await page.locator('.pe-window').boundingBox(), effectTitle = await page.locator('.pe-window .re-caption').boundingBox();
    await page.mouse.move(effectTitle.x + 80, effectTitle.y + 10); await page.mouse.down(); await page.mouse.move(effectTitle.x + 40, effectTitle.y + 50, { steps: 6 }); await page.mouse.up();
    const movedEffect = await page.locator('.pe-window').boundingBox(); assert.ok(Math.abs(movedEffect.x - effectBox.x) > 20 || Math.abs(movedEffect.y - effectBox.y) > 20, 'EMTR is movable too');
    await page.getByRole('button', { name: 'Close Particle Editor', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 760));
    await panel.getByRole('button', { name: 'Show', exact: true }).scrollIntoViewIfNeeded();
    const compact = await panel.boundingBox();
    assert.ok(compact.width <= 320 && compact.x + compact.width <= 1000, 'compact node controls retain the existing sidebar width');
    assert.ok(await panel.locator('.an-list button span').evaluateAll(items => items.every(el => el.scrollWidth <= el.clientWidth + 1)), 'compact node names remain readable');
    await page.screenshot({ path: path.join(shots, 'animations-compact.png') });
    assert.deepEqual(fs.readFileSync(file), original, 'user model is never overwritten'); assert.deepEqual(errors, []);
    console.log('PASS visible Animations editing, range and key selection, readable lists, movable manager/EMTR, actual isolated GL draws, original file preserved: ' + path.basename(file));
  } catch (cause) { if (page) { console.error(await page.getByLabel('Choose animation sequence', { exact: true }).evaluate(el => ({ value: el.value, disabled: el.disabled, options: [...el.options].map(o => ({ value: o.value, disabled: o.disabled, text: o.text })) })).catch(() => null)); await page.screenshot({ path: path.join(out, 'failure.png') }); } throw cause; }
  finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
