// node test/animation-heavy-editing.electron.cjs [model.mdx] [app directory]
// Uses an isolated profile and the normal App transform callback in rebuilt dist.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(process.argv[3] || path.join(__dirname, '..'));
  const api = await import(pathToFileURL(path.join(root, 'src/editor-document.js')));
  const output = path.join(root, 'out', 'animation-heavy-editing'); fs.mkdirSync(output, { recursive: true });
  let fixture = process.argv[2] && path.resolve(process.argv[2]);
  if (!fixture) {
    const doc = api.createDemoDocument();
    doc.apply('Baked animation fixture', [], model => {
      model.Bones[0].Translation = { LineType: 1, Keys: Array.from({ length: 20000 }, (_, Frame) => ({ Frame, Vector: new Float32Array([Frame / 1000, 0, 0]) })) };
    });
    fixture = path.join(output, 'baked.mdx'); fs.writeFileSync(fixture, doc.serialize('mdx'));
  }
  const original = fs.readFileSync(fixture), profile = fs.mkdtempSync(path.join(output, 'profile-'));
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', root, fixture], cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  const errors = [];
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setPosition(-3000, 0); win.showInactive();
    });
    await page.waitForFunction(() => document.title.includes('.mdx') && !!document.querySelector('[aria-label="3D model viewport"] canvas'));
    await page.evaluate(() => {
      window.editingState = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        const result = {};
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const current = hook.memoizedState?.current;
          if (current?.doc?.apply) result.app = current;
          if (current?.renderer && current?.entries) result.viewport = current;
          if (current?.onTransform && current?.model) result.props = current;
        }
        return result;
      };
      const doc = editingState().app.doc;
      window.editingTimings = { apply: [], dirty: [], recovery: [], ui: [], largestGap: 0, versions: [] };
      for (const [method, key] of [['apply', 'apply'], ['_changedKeys', 'dirty'], ['captureRecoveryState', 'recovery']]) {
        const original = doc[method]; doc[method] = function (...args) {
          const start = performance.now(), result = original.apply(this, args), elapsed = performance.now() - start;
          editingTimings[key].push(elapsed);
          if (key === 'recovery') editingTimings.versions.push(result.version);
          return result;
        };
      }
      window.editingStart = doc.model.Geosets[0].Vertices[0];
      let previous = performance.now();
      window.editingTimer = setInterval(() => { const now = performance.now(); editingTimings.largestGap = Math.max(editingTimings.largestGap, now - previous); previous = now; }, 10);
    });
    for (let index = 0; index < 5; index++) {
      await page.evaluate(() => {
        window.editingCommitStart = performance.now();
        editingState().props.onTransform({ selections: { 0: [0] }, translation: [.125, 0, 0], pivot: [0, 0, 0] });
      });
      await page.waitForFunction(count => {
        const state = editingState(), expected = editingStart + count * .125;
        return state.app.doc.model.Geosets[0].Vertices[0] === expected && state.viewport.entries[0].geometry.attributes.position.array[0] === expected;
      }, index + 1);
      await page.evaluate(() => editingTimings.ui.push(performance.now() - editingCommitStart));
      await page.waitForFunction(count => editingTimings.recovery.length >= count, index + 1);
    }
    const timings = await page.evaluate(() => { clearInterval(editingTimer); return editingTimings; });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'undo'));
    await page.waitForFunction(() => editingState().app.doc.model.Geosets[0].Vertices[0] === editingStart + .5);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'redo'));
    await page.waitForFunction(() => editingState().app.doc.model.Geosets[0].Vertices[0] === editingStart + .625);
    const bytes = await page.evaluate(() => {
      const doc = editingState().app.doc, bytes = doc.serialize('mdx'), original = doc.originalBytes;
      function chunks(input) {
        const view = new DataView(input.buffer, input.byteOffset, input.byteLength), result = new Map();
        for (let offset = 4; offset + 8 <= input.length;) {
          const tag = String.fromCharCode(...input.subarray(offset, offset + 4)), end = offset + 8 + view.getUint32(offset + 4, true);
          result.set(tag, input.subarray(offset, end)); offset = end;
        }
        return result;
      }
      const before = chunks(original), after = chunks(bytes);
      for (const [tag, data] of before) if (tag !== 'GEOS') {
        const result = after.get(tag);
        if (!result || result.length !== data.length || !data.every((value, index) => value === result[index])) throw Error('Changed untouched ' + tag + ' chunk');
      }
      return { size: bytes.length, preservedTags: [...before.keys()].filter(tag => tag !== 'GEOS'), vertex: doc.model.Geosets[0].Vertices[0] };
    });
    // Wait for the normal disk checkpoint, then restore through the same API as
    // File/Recovery. No supplied model file is saved or rewritten.
    const { RecoveryStore } = require(path.join(root, 'electron/recovery.cjs')), store = new RecoveryStore(path.join(profile, 'recovery'));
    let envelope;
    for (let attempt = 0; attempt < 30; attempt++) {
      const entries = await store.list();
      if (entries.length) {
        envelope = await store.read(entries[0].id);
        const recovered = api.EditorDocument.restoreRecoveryState(envelope.state);
        if (recovered.model.Geosets[0].Vertices[0] === bytes.vertex) break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(envelope, 'normal checkpoint reached disk');
    const recovered = api.EditorDocument.restoreRecoveryState(envelope.state);
    if (!process.argv[3]) assert.equal(envelope.state.version, 2);
    assert.equal(recovered.model.Geosets[0].Vertices[0], bytes.vertex);
    assert.equal(recovered.historyStats.undoSteps, 5); assert.equal(recovered.dirty, true);
    for (let count = 0; count < 5; count++) recovered.undo();
    assert.equal(recovered.dirty, false); assert.deepEqual(Buffer.from(recovered.serialize('mdx')), original);
    assert.deepEqual(fs.readFileSync(fixture), original); assert.deepEqual(errors, []);
    const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const report = { root, fixture, applyMedianMs: median(timings.apply), dirtyMaxMs: Math.max(...timings.dirty), recoveryMedianMs: median(timings.recovery), uiMedianMs: median(timings.ui), largestEventLoopGapMs: timings.largestGap, recoveryVersion: envelope.state.version, preservedTags: bytes.preservedTags, undoRedoRecoverySave: 'PASS', originalUnchanged: true };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    // Discard only the isolated test session before Playwright closes it. The
    // real beforeunload prompt otherwise races Chromium teardown in app.close.
    if (page && !page.isClosed()) await page.evaluate(() => {
      if (typeof editingState === 'function' && editingState().app) Object.defineProperty(editingState().app.doc, 'dirty', { get: () => false });
      window.desktop?.setDirty({ dirty: false, saved: true });
    });
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
