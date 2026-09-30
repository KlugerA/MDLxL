// Exercise the rebuilt Electron picker: node test/bones-picker.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'out/bones-picker-ui'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(output, 'bones-picker.mdx');
  fs.writeFileSync(fixture, Buffer.from(createStarterDocument().serialize('mdx')));
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', root, fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(60000);
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    const picker = page.getByLabel('Movement bone or node');
    await picker.waitFor();
    const { pickerFontSize, optionFontSize, optionNames } = await picker.evaluate(element => ({
      pickerFontSize: getComputedStyle(element).fontSize,
      optionFontSize: getComputedStyle(element.options[0]).fontSize,
      optionNames: [...element.options].map(option => option.textContent),
    }));
    assert.ok(Number.parseFloat(pickerFontSize) > 0, 'the collapsed picker must not suppress its menu text');
    assert.ok(Number.parseFloat(optionFontSize) > 0, 'picker options must have a visible font size');
    assert.ok(optionNames.includes('Bone_Root'), 'the menu contains the model bones');
    await page.screenshot({ path: path.join(output, 'bones-picker.png') });
    console.log('Bones picker menu labels are visible.');
  } finally {
    const child = app.process(); await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 3000))]); child?.kill();
  }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
