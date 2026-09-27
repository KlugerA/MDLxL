const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const input=path.resolve(process.argv[2]),original=fs.readFileSync(input),out=path.resolve('out/material-presets');fs.mkdirSync(out,{recursive:true});
 const app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',process.cwd(),input],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
 let uv,page;
 try{
  page=await app.firstWindow();page.setDefaultTimeout(20000);
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3000,y:0,width:1920,height:1080});w.showInactive();});
  await page.getByLabel('Select geoset 4',{exact:true}).waitFor({timeout:60000});
  await page.locator('[data-warmkey="geosetsClear"]').click();await page.getByLabel('Select geoset 4',{exact:true}).check();
  await page.locator('[aria-label="3D model viewport"]').click();await page.keyboard.press('Control+a');
  const opened=app.waitForEvent('window');await page.locator('[data-warmkey="uv"]').click();uv=await opened;uv.setDefaultTimeout(20000);
  await uv.getByLabel('Material Properties',{exact:true}).waitFor();
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='about:blank');w.setBounds({x:-3000,y:0,width:1920,height:1080});w.showInactive();});
  await uv.waitForFunction(()=>innerWidth>1800);
  const colors=await page.evaluate(async()=>{const names=Array.from({length:25},(_,i)=>'ReplaceableTextures\\TeamColor\\TeamColor'+String(i).padStart(2,'0')+'.blp');const records=await window.desktop.resolveTextures({names});return records.map(r=>({name:r.name,bytes:Array.from(r.bytes)}));});
  global.ImageData=class{constructor(width,height){this.width=width;this.height=height;this.data=new Uint8ClampedArray(width*height*4);}};
  const {decodeBLP,getBLPImageData}=await import('war3-model');
  const {decodeDds}=await import('../src/dds.js'),{decodeBlp2}=await import('../src/blp2.js'),{TGALoader}=await import('three/addons/loaders/TGALoader.js');
  const colorSamples=colors.map(r=>{const bytes=Uint8Array.from(r.bytes),magic=Buffer.from(bytes.slice(0,4)).toString(),pixels=magic==='DDS '?decodeDds(bytes.buffer):magic==='BLP2'?decodeBlp2(bytes.buffer):magic==='BLP1'?getBLPImageData(decodeBLP(bytes.buffer),0):new TGALoader().parse(bytes.buffer);return {name:r.name,pixel:Array.from(pixels.data.slice(0,4))};});
  assert.equal(colorSamples.length,25);assert.deepEqual(colorSamples[12].pixel,[156,0,0,255]);assert.deepEqual(colorSamples[24].pixel,[46,45,46,255]);console.log('PASS: all 25 native fixed colors resolve; Maroon and Black pixels verified');
  await uv.evaluate(()=>{
   window.uvState=()=>{let f=document.querySelector('.uv-workspace');f=f[Object.keys(f).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)if(f.memoizedProps?.onMaterialPreset)return f.memoizedProps;throw Error('Missing UV state');};
   window.nativeState=()=>{let f=document.querySelector('.game-preview-root');if(!f)return null;f=f[Object.keys(f).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next)if(h.memoizedState?.current?.native)return h.memoizedState.current.native;return null;};
  });
  await uv.waitForFunction(()=>nativeState()?.model?.Materials[4]?.Layers.length===3);
  assert.equal(await uv.getByLabel('Material Properties',{exact:true}).inputValue(),'Team Color Overlay');
  await uv.getByLabel('Material Properties',{exact:true}).selectOption('Color Tint');
  await uv.getByLabel('Tint color',{exact:true}).selectOption('1');
  await uv.waitForFunction(()=>{const n=nativeState(),l=n?.model.Materials[4].Layers[1];return n?.model.Textures[l?.TextureID]?.Image.endsWith('TeamColor01.blp');});
  await uv.waitForFunction(()=>!document.querySelector('.uv-workspace-warning'));
  const tinted=await uv.evaluate(()=>JSON.stringify(uvState().model));
  await uv.screenshot({path:path.join(out,'uv-blue.png')});
  const placement=await uv.evaluate(()=>{const side=document.querySelector('.uv-side-panel')||document.querySelector('.uv-live-preview');return {material:document.querySelector('[aria-label="UV material"]').getBoundingClientRect().toJSON(),properties:document.querySelector('[aria-label="Material Properties"]').getBoundingClientRect().toJSON(),header:document.querySelector('.uv-header-actions').getBoundingClientRect().toJSON(),side:side?.getBoundingClientRect().toJSON()};});
  assert.ok(placement.material.x-placement.header.x<75);assert.ok(placement.properties.x>placement.material.x);
  await uv.getByLabel('Material Properties',{exact:true}).selectOption('Team Color');
  await uv.waitForFunction(()=>nativeState()?.model.Materials[4].Layers.length===2);
  assert.equal(await uv.getByLabel('Tint color',{exact:true}).count(),0);
  await uv.keyboard.press('Control+z');await uv.waitForFunction(v=>JSON.stringify(uvState().model)===v,tinted);
  await uv.keyboard.press('Control+y');await uv.waitForFunction(()=>nativeState()?.model.Materials[4].Layers.length===2);
  await uv.getByLabel('Material Properties',{exact:true}).selectOption('Team Color Overlay');
  await uv.waitForFunction(()=>nativeState()?.model.Materials[4].Layers.length===3);
  await uv.screenshot({path:path.join(out,'uv-overlay.png')});
  await uv.getByRole('button',{name:'Exit UV Wrapper',exact:true}).click();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('menu','Materials'));
  await page.getByRole('dialog',{name:'Material Manager',exact:true}).waitFor();
  await page.getByLabel('Material Properties',{exact:true}).selectOption('Color Tint');
  await page.getByLabel('Tint color',{exact:true}).selectOption('12');
  await page.screenshot({path:path.join(out,'manager-maroon.png')});
  const layers=await page.locator('.inspector-fields').innerText();assert.ok(layers.includes('Layer 2'));
  assert.ok(fs.readFileSync(input).equals(original));
  console.log('PASS: UV placement, all presets, live native renderer update, fixed blue texture resolved, tint visibility, undo/redo, manager tint selection, input file unchanged');
 }catch(error){console.error('Original failure:',error);if(uv&&!uv.isClosed()){await uv.screenshot({path:path.join(out,'failure.png')});console.error(await uv.locator('body').innerText());}else if(page)console.error(await page.locator('body').innerText());throw error;}
 finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exitCode=1;});
