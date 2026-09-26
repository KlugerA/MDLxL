// Run after rebuilding dist: node test/geoset-operations.electron.cjs
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const getJson = (port, route) => new Promise((resolve, reject) => http.get(`http://127.0.0.1:${port}${route}`, response => { let data = ''; response.on('data', chunk => data += chunk); response.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } }); }).on('error', reject));

async function target(port) {
  for (let attempt = 0; attempt < 150; attempt++) {
    try { const page = (await getJson(port, '/json')).find(item => item.type === 'page' && item.url.includes('/dist/index.html')); if (page) return page; } catch {}
    await delay(100);
  }
  throw Error('Electron editor target unavailable.');
}
async function connect(url) {
  const socket = new WebSocket(url), pending = new Map(); let sequence = 0;
  socket.addEventListener('message', event => {
    const response = JSON.parse(event.data), request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    response.error ? request.reject(Error(response.error.message)) : request.resolve(response.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  return { send(method, params = {}) { const id = ++sequence; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }, close() { socket.close(); } };
}
async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(cdp, expression) {
  for (let attempt = 0; attempt < 150; attempt++) { const result = await evaluate(cdp, expression); if (result) return result; await delay(100); }
  throw Error(`Timed out: ${expression}`);
}

(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const { gather, updateBounds } = await import('../src/mesh-tools.js');
  const output = path.join(root, 'out', 'geoset-operations'); fs.mkdirSync(output, { recursive: true });
  const fixture = path.join(output, 'loose-parts.mdx'), doc = createDemoDocument();
  doc.apply('Prepare loose parts', ['Geosets'], model => {
    const g = model.Geosets[0];
    Object.assign(g, gather(g, [0, 1, 2, 3, 4, 5]));
    g.Faces = Uint16Array.of(0, 1, 2, 3, 4, 5);
    g.PrimitiveTypes = Uint32Array.of(4); g.PrimitiveCounts = Uint32Array.of(6);
    updateBounds(g);
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const original = fs.readFileSync(fixture), port = await freePort();
  const electron = spawn(path.join(root, 'node_modules/electron/dist/electron.exe'), ['--disable-gpu', `--remote-debugging-port=${port}`, root, fixture], { cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, `profile-${Date.now()}`) }, stdio: 'ignore' });
  let cdp;
  try {
    cdp = await connect((await target(port)).webSocketDebuggerUrl);
    await waitFor(cdp, `document.querySelectorAll('.classic-geoset-list [role="option"]').length === 5`);
    const controls = await evaluate(cdp, `(() => { const buttons = [...document.querySelectorAll('.classic-geoset-operations button')]; const list = document.querySelector('.classic-geosets'); return { labels: buttons.map(button => button.textContent.trim()), beforeList: buttons.every(button => !!(button.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)), sidebarWidth: getComputedStyle(document.querySelector('.classic-sidebar')).width }; })()`);
    assert.deepEqual(controls.labels, ['Seperate by Loose parts', 'Nuclear Seperation', 'Merge Geosets']);
    assert.equal(controls.beforeList, true);
    assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [true, true, true]);
    await evaluate(cdp, `document.querySelector('[data-warmkey="geosetsClear"]').click()`);
    await evaluate(cdp, `document.querySelector('[aria-label="Select geoset 0"]').click()`);
    assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [true, true, true]);
    const selectAll = async () => {
      await evaluate(cdp, `document.querySelector('[aria-label="3D model viewport"]').focus()`);
      const data = { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 };
      await cdp.send('Input.dispatchKeyEvent', { ...data, type: 'rawKeyDown' });
      await cdp.send('Input.dispatchKeyEvent', { ...data, type: 'keyUp' });
      await waitFor(cdp, `!document.querySelector('.classic-geoset-operations button:first-child').disabled`);
      assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [false, false, false]);
    };
    await selectAll();
    await evaluate(cdp, `document.querySelector('.classic-geoset-operations button:first-child').click()`);
    await waitFor(cdp, `document.querySelectorAll('.classic-geoset-list [role="option"]').length === 6`);
    await evaluate(cdp, `document.querySelector('.classic-geoset-operations button:last-child').click()`);
    await waitFor(cdp, `document.querySelectorAll('.classic-geoset-list [role="option"]').length === 5`);
    assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [false, false, false]);
    await selectAll();
    await evaluate(cdp, `document.querySelector('.classic-geoset-operations button:nth-child(2)').click()`);
    await waitFor(cdp, `document.querySelectorAll('.classic-geoset-list [role="option"]').length === 6`);
    assert.equal(await evaluate(cdp, `getComputedStyle(document.querySelector('.classic-sidebar')).width`), controls.sidebarWidth);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS rebuilt Electron: selection required, refined and nuclear split, merge, sidebar width and input file preserved');
  } finally { cdp?.close(); electron.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
