// Run after building dist. Optional: MDLXL_PLAYWRIGHT_MODULE points to an external Playwright install.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

async function launch(entry, profile, model) {
  return _electron.launch({
    executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', entry, ...(model ? [model] : [])],
    cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile },
    timeout: 30000,
  });
}

(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const output = path.join(root, 'out/model-close');
  fs.mkdirSync(output, { recursive: true });
  const run = fs.mkdtempSync(path.join(output, 'regression-'));
  const savedModel = path.join(run, 'Saved.mdx');
  fs.writeFileSync(savedModel, createDemoDocument().serialize('mdx'));
  const saveDestination = path.join(run, 'NewModel');
  const promptLog = path.join(run, 'close-prompts.json');
  const entry = path.join(run, 'main.cjs');
  fs.writeFileSync(entry, `
    const { app, dialog } = require('electron');
    app.getAppPath = () => ${JSON.stringify(root)};
    global.modelCloseTest = { prompts: [], response: 1 };
    dialog.showMessageBoxSync = (_, options) => { modelCloseTest.prompts.push(options); require('node:fs').writeFileSync(${JSON.stringify(promptLog)}, JSON.stringify(modelCloseTest.prompts)); return modelCloseTest.response; };
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: ${JSON.stringify(saveDestination)} });
    require(${JSON.stringify(path.join(root, 'electron/main.cjs'))});
  `);

  const clean = await launch(entry, path.join(run, 'clean-profile'), savedModel);
  {
    const page = await clean.firstWindow();
    await page.waitForFunction(expected => document.title.includes(expected) && !document.title.startsWith('* '), path.basename(savedModel));
    const closed = clean.waitForEvent('close');
    await page.evaluate(() => window.desktop.close());
    await closed;
    assert.equal(fs.existsSync(promptLog), false);
    console.log('PASS a clean saved model closes without prompting');
  }

  const unsaved = await launch(entry, path.join(run, 'unsaved-profile'));
  try {
    const page = await unsaved.firstWindow();
    await page.waitForFunction(() => !!document.querySelector('.classic-app'));
    await page.evaluate(() => window.desktop.close());
    await page.waitForTimeout(100);
    const prompt = await unsaved.evaluate(() => modelCloseTest.prompts[0]);
    assert.deepEqual(prompt.buttons, ['Save', 'Cancel', 'Close']);
    assert.equal(prompt.cancelId, 1);
    assert.equal(unsaved.windows().length, 1, 'Cancel keeps the editor open');

    await unsaved.evaluate(() => { modelCloseTest.response = 0; });
    const closed = unsaved.waitForEvent('close');
    await page.evaluate(() => window.desktop.close());
    await closed;
    assert.equal(['.mdl', '.mdx'].some(extension => fs.existsSync(saveDestination + extension)), true, 'Save writes the never-saved model before closing');
    assert.equal(JSON.parse(fs.readFileSync(promptLog, 'utf8')).length, 2, 'successful Save closes without a second prompt');
    console.log('PASS a never-saved model offers Save, Cancel, Close and Save completes before exit');
  } finally {
    if (unsaved.windows().length) await unsaved.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
