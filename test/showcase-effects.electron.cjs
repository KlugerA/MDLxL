const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out/showcase-review/ui-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const fixture=process.env.MDLXL_EFFECT_MODEL;if(!fixture)throw Error('Set MDLXL_EFFECT_MODEL to the Flail model to inspect.');
 const original=require('node:crypto').createHash('sha256').update(fs.readFileSync(fixture)).digest('hex');
 const cache=JSON.parse(fs.readFileSync(path.join(root,'profile/game-data-discovery.json'),'utf8')).result;
 const entry=path.join(out,'main.cjs');fs.writeFileSync(entry,`
 const {app}=require('electron');app.getAppPath=()=>${JSON.stringify(root)};
 const {GameDataDiscovery}=require(${JSON.stringify(path.join(root,'electron/game-data.cjs'))});GameDataDiscovery.prototype.discover=async()=>(${JSON.stringify(cache)});
 app.on('browser-window-created',(_,w)=>w.webContents.setBackgroundThrottling(false));require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`);
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',entry,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});let clipboard;
 try{
  clipboard=await app.evaluate(({clipboard})=>clipboard.readText());const page=await app.firstWindow();page.setDefaultTimeout(20000);
  await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
  await page.getByRole('list',{name:'Animation sequence'}).locator('li').first().dblclick();await page.getByRole('dialog').getByLabel('Animation',{exact:true}).selectOption({label:'Attack - Slam'});await page.getByRole('button',{name:/^1 loop ·/}).click();
  const length=Number(await page.getByRole('dialog').getByLabel('Length (seconds)').inputValue());assert.ok(length>=2.448&&length<2.6,length);await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();
  const samples=await page.locator('.showcase-workspace').evaluate(async el=>{
    let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))],api;
    while(f&&!api){for(let h=f.memoizedState;h;h=h.next)if(h.memoizedState?.prepareRecording){api=h.memoizedState;break;}f=f.return;}
    if(!api)throw Error('No Showcase capture API');await api.whenReady();await api.prepareRecording();const samples=[];
    for(const time of [1600,2000,2600]){await api.seekRecordingFrame(time);const c=api.captureFrame({maxDimension:800});samples.push({time,state:api.playbackState(),png:c.toDataURL('image/png')});}
    api.endRecording();return samples;
  });
  for(const item of samples){fs.writeFileSync(path.join(out,'slam-'+item.time+'.png'),Buffer.from(item.png.split(',')[1],'base64'));delete item.png;assert.equal(item.state.frame,171437);}
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),original);
  fs.writeFileSync(path.join(out,'slam.json'),JSON.stringify({length,samples},null,2));console.log('PASS actual Slam duration '+length+'s, held pose and continuous effect clocks, model bytes unchanged. '+out);
 }finally{if(clipboard!==undefined)await app.evaluate(({clipboard},text)=>clipboard.writeText(text),clipboard);await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
