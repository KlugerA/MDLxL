const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out/catbox-review/ui-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const {createDemoDocument}=await import('../src/editor-document.js');const fixture=path.join(out,'CatboxDemo.mdx');fs.writeFileSync(fixture,createDemoDocument().serialize('mdx'));
 const entry=path.join(out,'main.cjs');fs.writeFileSync(entry,`
 const {app}=require('electron');app.getAppPath=()=>${JSON.stringify(root)};
 const {GameDataDiscovery}=require(${JSON.stringify(path.join(root,'electron/game-data.cjs'))});GameDataDiscovery.prototype.discover=async()=>({folders:[],archives:[],cascFolders:[]});
 global.catboxMock={calls:0,release:null};global.fetch=async(url,options)=>{if(url!=='https://catbox.moe/user/api.php')throw Error('Unexpected network request');const index=++catboxMock.calls;if(index===1)await new Promise(resolve=>catboxMock.release=resolve);return new Response('https://files.catbox.moe/test'+catboxMock.calls+'.gif');};
 app.on('browser-window-created',(_,w)=>w.webContents.setBackgroundThrottling(false));require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`);
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',entry,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});let clipboard;
 try{
  clipboard=await app.evaluate(({clipboard})=>clipboard.readText());const page=await app.firstWindow();page.setDefaultTimeout(20000);
  await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
  const hive=page.getByRole('button',{name:'HIVE',exact:true}),catbox=page.getByRole('button',{name:'CATBOX',exact:true});
  const a=await hive.boundingBox(),b=await catbox.boundingBox(),record=await page.locator('.showcase-record').boundingBox();assert.ok(Math.abs(a.width-b.width)<1);assert.ok(Math.abs(a.width+b.width+2-record.width)<2);assert.ok(a.y>=record.y+record.height);
  assert.equal(await hive.getAttribute('aria-pressed'),'false');assert.equal(await catbox.getAttribute('aria-pressed'),'false');await hive.click();assert.equal(await page.getByLabel('Orbit timing').count(),0);await page.getByLabel('Record length seconds').fill('6');await page.getByText('Hive does not support GIF previews longer than 5 seconds.',{exact:true}).waitFor();assert.equal(await page.locator('.showcase-record').isDisabled(),true);
  await catbox.click();assert.equal(await page.getByLabel('Orbit timing').count(),1);assert.equal(await app.evaluate(()=>catboxMock.calls),0);
  await page.getByLabel('Orbit timing').selectOption('circle');
  await page.getByRole('list',{name:'Animation sequence'}).locator('li').first().dblclick();await page.getByRole('dialog').getByLabel('Length (seconds)').fill('0.2');await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();await page.getByLabel('Record length seconds').fill('0.2');
  await page.getByRole('button',{name:/^Add to recording list/}).click();await page.getByRole('button',{name:/^Add to recording list/}).click();await page.getByRole('button',{name:'RECORD & UPLOAD',exact:true}).click();
  await page.getByText('Uploading...',{exact:true}).first().waitFor({timeout:60000});assert.equal(await page.getByRole('button',{name:'Upload to Catbox',exact:true}).first().isDisabled(),true);await app.evaluate(()=>catboxMock.release());
  await page.getByLabel('Link 2',{exact:true}).waitFor({timeout:60000});assert.equal(await page.getByLabel('Link 1',{exact:true}).inputValue(),'https://files.catbox.moe/test1.gif');assert.equal(await page.getByLabel('Hive BBCode 2',{exact:true}).inputValue(),'[IMG]https://files.catbox.moe/test2.gif[/IMG]');
  await page.getByRole('button',{name:'Copy Link',exact:true}).first().click();assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'https://files.catbox.moe/test1.gif');await page.getByRole('button',{name:'Copy Hive BBCode',exact:true}).nth(1).click();assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'[IMG]https://files.catbox.moe/test2.gif[/IMG]');
  await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);await hive.click();assert.equal(await page.getByLabel('Orbit timing').count(),0);assert.equal(await page.getByLabel('Link 2',{exact:true}).count(),1);assert.equal(await app.evaluate(()=>catboxMock.calls),2);
  await page.screenshot({path:path.join(out,'links.png')});console.log('PASS: half-width buttons, Hive limits, Catbox consent, real export pipeline, two mocked uploads, duplicate prevention, persistent link/tag pairs and Electron clipboard. '+out);
 }finally{if(clipboard!==undefined)await app.evaluate(({clipboard},text)=>clipboard.writeText(text),clipboard);await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
