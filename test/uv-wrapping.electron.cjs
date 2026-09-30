// Run against the production bundle: node test/uv-wrapping.electron.cjs <model.mdx>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const input = path.resolve(process.argv[2]);
  const original = fs.readFileSync(input);
  const out = path.resolve('out/uv-wrapping'); fs.mkdirSync(out, {recursive:true});
  const app = await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),
    args:['--disable-backgrounding-occluded-windows', process.cwd(), input],
    env:{...process.env, MDLVIS_HEADLESS:'1', MDLXL_PROFILE:path.join(out, 'profile-'+Date.now())}, timeout:60000});
  let uv;
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await app.evaluate(({BrowserWindow}) => {const w=BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.setPosition(-3000,0); w.showInactive();});
    await page.getByLabel('Select geoset 0', {exact:true}).waitFor({timeout:60000});
    await page.locator('[data-warmkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', {exact:true}).check();
    await page.locator('[aria-label="3D model viewport"]').click();
    await page.keyboard.press('Control+a');
    const opened = app.waitForEvent('window');
    await page.locator('[data-warmkey="uv"]').click(); uv = await opened; uv.setDefaultTimeout(15000);
    await app.evaluate(({BrowserWindow}) => {for(const window of BrowserWindow.getAllWindows()){window.webContents.setBackgroundThrottling(false);window.setPosition(-3000,0);window.showInactive();}});
    await uv.locator('.uv-grid-toolbar').waitFor();
    const viewLimit = uv.getByLabel('UV map tile limit');
    assert.equal(await viewLimit.inputValue(), '7');
    const wrapButton = uv.getByRole('button', {name:'Disable Wrapping', exact:true});
    const [wrapBox, limitBox] = await Promise.all([wrapButton.boundingBox(), viewLimit.boundingBox()]);
    assert.ok(wrapBox && limitBox && limitBox.x > wrapBox.x && Math.abs(limitBox.y - wrapBox.y) < 8, '7x7 view limit is beside Disable Wrapping');
    await viewLimit.fill('12');
    assert.equal(await viewLimit.inputValue(), '12');
    if(await uv.getByRole('button', {name:'Disable Wrapping', exact:true}).isVisible())await uv.getByRole('button', {name:'Disable Wrapping', exact:true}).click();
    await uv.getByRole('button', {name:'Enable Wrapping', exact:true}).waitFor();
    await uv.evaluate(() => {
      window.uvState = () => {
        const root = document.querySelector('.uv-workspace');
        let fiber = root[Object.keys(root).find(key=>key.startsWith('__reactFiber'))];
        let top=fiber;while(top.return)top=top.return;if(top.stateNode.current!==top)fiber=fiber.alternate||fiber;
        for (;fiber;fiber=fiber.return) if (fiber.memoizedProps?.onWrappingChange) return fiber.memoizedProps;
        throw Error('UV workspace props not found');
      };
      window.nativeState = () => {
        const root = document.querySelector('.game-preview-root');
        if (!root) return null;
        let fiber = root[Object.keys(root).find(key=>key.startsWith('__reactFiber'))];
        for (;fiber;fiber=fiber.return) for(let h=fiber.memoizedState;h;h=h.next) if(h.memoizedState?.current?.native) return h.memoizedState.current.native;
        return null;
      };
      window.sampling = () => {
        const native = nativeState(); if (!native?.gl) return null;
        const info = native.model.Textures.find(t=>t.Image&&!t.ReplaceableId);
        const gl = native.gl, texture = native.rendererData.textures[info.Image]; if (!texture) return null;
        const previous = gl.getParameter(gl.TEXTURE_BINDING_2D); gl.bindTexture(gl.TEXTURE_2D, texture);
        const result = [gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S),gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T)];
        gl.bindTexture(gl.TEXTURE_2D,previous); return result;
      };
    });
    await uv.waitForFunction(()=>sampling()?.every(v=>v===33071)); // CLAMP_TO_EDGE
    const before = await uv.evaluate(()=>JSON.stringify(uvState().model));
    // Move the first geoset one tile right through the workspace's normal edit path.
    await uv.evaluate(()=>{const p=uvState(),values=new Float32Array(p.model.Geosets[0].TVertices[0]);for(let i=0;i<values.length;i+=2)values[i]+=1;p.onUVChanges([{geosetIndex:0,uvSet:0,values}]);});
    await uv.waitForFunction(()=>uvState().model.Geosets[0].TVertices[0][0]>1);
    await uv.screenshot({path:path.join(out,'before.png')});
    const shifted = await uv.evaluate(()=>JSON.stringify(uvState().model));
    const order = await uv.locator('.uv-grid-toolbar > button').allTextContents();
    assert.deepEqual(order.slice(0,2), ['Enable Wrapping','Grid']);
    await uv.getByRole('button', {name:'Enable Wrapping', exact:true}).click();
    await uv.waitForFunction(()=>sampling()?.every(v=>v===10497)); // REPEAT
    assert.ok(await uv.getByRole('button',{name:'Disable Wrapping',exact:true}).isEnabled());
    const after = await uv.evaluate(()=>JSON.stringify(uvState().model));
    const expected = JSON.parse(shifted);
    const material=expected.Materials[expected.Geosets[0].MaterialID];
    for(const layer of material.Layers)if(Number.isInteger(layer.TextureID)&&expected.Textures[layer.TextureID]?.Image&&!expected.Textures[layer.TextureID].ReplaceableId)expected.Textures[layer.TextureID].Flags|=3;
    assert.deepEqual(JSON.parse(after), expected);
    await uv.screenshot({path:path.join(out,'enabled.png')});
    // Both states stay clickable: exercise the actual button in each direction.
    await uv.getByRole('button',{name:'Disable Wrapping',exact:true}).click();
    await uv.waitForFunction(()=>sampling()?.every(v=>v===33071));
    assert.equal(await uv.evaluate(()=>JSON.stringify(uvState().model)), shifted);
    const unusedTextureSpaceIsBlack = await uv.evaluate(() => {
      const canvas = document.querySelector('[aria-label="UV coordinate editor"]'), context = canvas?.getContext('2d');
      return context && [[1, 1], [canvas.width - 2, 1], [1, canvas.height - 2], [canvas.width - 2, canvas.height - 2]]
        .every(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3).every(value => value === 0));
    });
    assert.ok(unusedTextureSpaceIsBlack, 'clamped UV space outside the base tile is black');
    await uv.screenshot({path:path.join(out,'disabled.png')});
    await uv.getByRole('button',{name:'Enable Wrapping',exact:true}).click();
    await uv.waitForFunction(()=>sampling()?.every(v=>v===10497));
    assert.equal(await uv.evaluate(()=>JSON.stringify(uvState().model)), after);
    await uv.keyboard.press('Control+z');
    await uv.waitForFunction(()=>sampling()?.every(v=>v===33071));
    assert.equal(await uv.evaluate(()=>JSON.stringify(uvState().model)), shifted);
    await uv.keyboard.press('Control+y');
    await uv.waitForFunction(()=>sampling()?.every(v=>v===10497));
    assert.equal(await uv.evaluate(()=>JSON.stringify(uvState().model)), after);
    for (let i=0;i<4;i++) await uv.keyboard.press('Control+z');
    await uv.waitForFunction(value=>JSON.stringify(uvState().model)===value,before);
    assert.ok(fs.readFileSync(input).equals(original));
    console.log('PASS: button placement, out-of-tile edit, black unused texture space, repeated enable/disable clicks, native WebGL clamp -> repeat -> clamp -> repeat, preserved model data, undo/redo, original file unchanged');
  } catch (error) {
    if (uv) { console.error(error); await uv.screenshot({path:path.join(out,'failure.png')}).catch(e=>console.error('Failure screenshot unavailable:',e.message)); }
    else console.error(await (await app.firstWindow()).locator('body').innerText());
    throw error;
  } finally { await app.evaluate(({app})=>app.exit(0)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
