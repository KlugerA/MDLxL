const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const root=process.cwd(), out=path.join(root,'out/showcase'); fs.mkdirSync(out,{recursive:true});
  const {createDemoDocument}=await import('../src/editor-document.js'); const demo=createDemoDocument(); const fixture=path.join(out,'ShowcaseTest.mdx'); fs.writeFileSync(fixture,demo.serialize('mdx'));
  const entry=path.join(out,'main.cjs');
  fs.writeFileSync(entry, `const {app}=require('electron'); app.getAppPath=()=>${JSON.stringify(root)}; app.on('browser-window-created',(_,w)=>w.webContents.setBackgroundThrottling(false)); require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`);
  const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',entry,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
  const errors=[];
  try {
    const page=await app.firstWindow(); page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message); console.error('PAGEERROR',e.message);});
    await page.getByRole('button',{name:'Showcase',exact:true}).click();
    await page.waitForTimeout(2500); console.log((await page.locator('body').innerText()).slice(-2500));  await page.getByRole('button',{name:'Record',exact:true}).waitFor();
    await page.waitForTimeout(1500);
    const html=await page.locator('.showcase-workspace').innerText();console.log(html.slice(0,2600));

    assert.equal(await page.locator('.showcase-preview [data-geometry-overlay],.showcase-preview [data-node-overlay],.showcase-preview [data-camera-overlay]').count(),0);
    assert.equal(await page.locator('.showcase-preview canvas').count()>0,true);
    const antialias=await page.locator('.showcase-preview [data-clean-model-canvas]').evaluate(canvas=>canvas.getContext('webgl2').getContextAttributes().antialias); assert.equal(antialias,true,'Showcase antialiasing must reach the WebGL context');
    await page.getByLabel('Graphics quality').selectOption('low');
    await page.getByLabel('Recording FPS').selectOption('10');
    await page.getByLabel('Record length seconds').fill('10');
    await page.getByRole('button',{name:'Record',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.classic-status')?.textContent.includes('Saved') || document.querySelector('.capture-error'),{},{timeout:120000});
    const status=await page.locator('.classic-status').innerText(); console.log('STATUS',status);
    console.log('ERRORS',errors); assert.deepEqual(errors,[]); assert.equal(await page.locator('.capture-error').count(),0);
    const gifPath=status.match(/Saved (.+\.gif)/)?.[1]; assert.ok(gifPath,`GIF save path missing from ${status}`);
    assert.equal(path.basename(path.dirname(gifPath)),'ShowcaseTest'); assert.equal(path.basename(path.dirname(path.dirname(gifPath))),'Showcase Recordings');
    const gif=fs.readFileSync(gifPath); assert.equal(gif.toString('ascii',0,6),'GIF89a');
    const decoded=execFileSync(path.join(root,'electron/ffmpeg/ffmpeg.exe'),['-v','error','-i',gifPath,'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1'],{maxBuffer:16*1024*1024});
    const colors=new Set(); for(let at=0;at<decoded.length;at+=388) colors.add(`${decoded[at]},${decoded[at+1]},${decoded[at+2]}`);
    assert.ok(colors.size>16,`Rendered first GIF frame has only ${colors.size} sampled colors`);
    let offset=13, count=0, delay=0;
    if(gif[10]&0x80) offset+=3*(1<<((gif[10]&7)+1));
    while(offset<gif.length){const marker=gif[offset++];if(marker===0x3b)break;if(marker===0x21){const label=gif[offset++];if(label===0xf9){assert.equal(gif[offset++],4);offset++;delay+=gif.readUInt16LE(offset);offset+=2;offset++;assert.equal(gif[offset++],0);}else{while(true){const size=gif[offset++];if(!size)break;offset+=size;}}continue;}if(marker!==0x2c)throw Error(`Unexpected GIF block 0x${marker.toString(16)}`);offset+=9;const packed=gif[offset-1];if(packed&0x80)offset+=3*(1<<((packed&7)+1));offset++;while(true){const size=gif[offset++];if(!size)break;offset+=size;}count++;}
    assert.equal(count,100); assert.equal(delay,1000,`GIF duration is ${delay/100}s, expected 10.00s`);
    await page.getByRole('button',{name:'Screenshot',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.classic-status')?.textContent.includes('.png') || document.querySelector('.capture-error'),{},{timeout:30000});
    const pngStatus=await page.locator('.classic-status').innerText(),pngPath=pngStatus.match(/Saved (.+\.png)/)?.[1];assert.ok(pngPath,`PNG save path missing from ${pngStatus}`);
    const png=fs.readFileSync(pngPath);assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(path.basename(path.dirname(pngPath)),'ShowcaseTest');assert.ok(png.readUInt32BE(16)<=1280&&png.readUInt32BE(20)<=1280);

  } finally {await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exitCode=1;});
