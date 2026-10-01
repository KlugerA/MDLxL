// Exercise the rebuilt Electron bundle: node test/rig-node-order.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const output = path.resolve('out/rig-node-order-ui'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { createNode } = await import('../src/editor-document.js');
  const source = createStarterDocument();
  let helperId;
  source.apply('Add ordering fixture', ['Nodes', 'PivotPoints'], model => {
    const helper = createNode(model, 'Helper'); helperId = helper.ObjectId; helper.Name = 'Bone_Chest'; helper.PivotPoint.set([0, 0, 24]);
    const chest = createNode(model, 'Bone'); chest.Name = 'Chest Mesh'; chest.Parent = helper.ObjectId; chest.PivotPoint.set([0, 0, 24]);
    const attachment = createNode(model, 'Attachment'); attachment.Name = 'Chest Ref'; attachment.Parent = helper.ObjectId;
  });
  const fixture = path.join(output, 'rig-node-order.mdx'), original = Buffer.from(source.serialize('mdx'));
  fs.writeFileSync(fixture, original);
  const errors = [];
  const app = await _electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(60000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    const picker = page.getByLabel('Movement bone or node'); await picker.waitFor();
    const organized = await picker.evaluate(element => ({
      groups: [...element.querySelectorAll('optgroup')].map(group => group.label),
      boneNames: [...element.querySelectorAll('optgroup[label="Bones"] option')].map(option => option.textContent.trim()),
      otherNames: [...element.querySelectorAll('optgroup[label="Other Objects"] option')].map(option => option.textContent.trim()),
      helperNames: [...element.querySelectorAll('optgroup[label="Helpers"] option')].map(option => option.textContent.trim()),
      boneColor: element.querySelector('optgroup[label="Bones"] option')?.style.color,
      helperColor: element.querySelector('optgroup[label="Helpers"] option')?.style.color,
    }));
    assert.deepEqual(organized.groups, ['Bones', 'Other Objects', 'Helpers']);
    assert.equal(organized.boneNames[0], 'Chest Mesh');
    assert.deepEqual(organized.otherNames, ['Chest Ref']);
    assert.deepEqual(organized.helperNames, ['Bone_Chest']);
    assert.equal(organized.boneColor, 'rgb(76, 255, 89)');
    assert.equal(organized.helperColor, 'rgb(138, 43, 226)');
    await picker.selectOption(String(helperId));
    assert.equal(await picker.getAttribute('data-node-kind'), 'helper');
    assert.equal(await picker.evaluate(element => element.style.color), 'rgb(138, 43, 226)');
    assert.deepEqual(errors, []);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS rebuilt Electron Bones dropdown: anatomical order, section separation, colors, and unchanged model');
  } finally { const child = app.process(); await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 3000))]); child?.kill(); }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
