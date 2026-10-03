const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out/showcase-review/ui-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const {createDemoDocument}=await import('../src/editor-document.js');const demo=createDemoDocument();
 demo.model.Sequences.push({...structuredClone(demo.model.Sequences[0]),Name:'Portrait Talk'});
 demo.model.Sequences.forEach(sequence=>{sequence.Interval=[0,100];});
 demo.model.Cameras=[{Name:'Portrait Camera',Position:new Float32Array([0,-350,150]),TargetPosition:new Float32Array([0,0,70]),FieldOfView:Math.PI/4,NearClip:1,FarClip:1000}];
 const fixture=path.join(out,'LayoutA.mdx');fs.writeFileSync(fixture,demo.serialize('mdx'));
 demo.model.Sequences.reverse();const second=path.join(out,'LayoutB.mdx');fs.writeFileSync(second,demo.serialize('mdx'));
 demo.model.Sequences=demo.model.Sequences.filter(s=>s.Name!=='Stand');const third=path.join(out,'LayoutC.mdx');fs.writeFileSync(third,demo.serialize('mdx'));
 const entry=path.join(out,'main.cjs');fs.writeFileSync(entry,`
 const {app}=require('electron');app.getAppPath=()=>${JSON.stringify(root)};
 const {GameDataDiscovery}=require(${JSON.stringify(path.join(root,'electron/game-data.cjs'))});GameDataDiscovery.prototype.discover=async()=>({folders:[],archives:[],cascFolders:[]});
 global.nextOpen=null;require('electron').dialog.showOpenDialog=async()=>{if(!global.nextOpen)throw Error('No test file selected');const file=global.nextOpen;global.nextOpen=null;return {canceled:false,filePaths:[file]};};

 app.on('browser-window-created',(_,w)=>w.webContents.setBackgroundThrottling(false));require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`);
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',entry,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});let clipboard;
 try{
  clipboard=await app.evaluate(({clipboard})=>clipboard.readText());const page=await app.firstWindow();page.setDefaultTimeout(20000);
  await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
  const hive=page.getByRole('button',{name:'HIVE',exact:true}),controls=page.getByRole('complementary',{name:'Showcase controls'});
  assert.equal(await hive.getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.showcase-export-target button').count(),1);
  assert.equal(await page.getByLabel('Recording FPS').evaluate(el=>el.tagName),'SELECT');
  await hive.click();await hive.click();assert.equal(await hive.getAttribute('aria-pressed'),'false');
  const short=async()=>{await page.getByRole('list',{name:'Animation sequence'}).locator('li').first().dblclick();await page.getByRole('dialog').getByLabel('Animation Extra Time').fill('0');await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();};
  await short();const output=path.join(root,'Showcase Recordings','LayoutA'),records=[];
  const record=async()=>{const prior=await page.locator('.classic-status').textContent();await page.locator('.showcase-record').click();await page.waitForFunction(prior=>{const t=document.querySelector('.classic-status')?.textContent;return t?.startsWith('Saved ')&&t!==prior;},prior,{timeout:60000});await page.waitForFunction(()=>!document.querySelector('.showcase-record').disabled);const file=fs.readdirSync(output).map(name=>path.join(output,name)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0],bytes=fs.readFileSync(file);const result={file,width:bytes.readUInt16LE(6),height:bytes.readUInt16LE(8)};records.push(result);return result;};
  await page.getByLabel('Crop size',{exact:true}).selectOption('classic');let r=await record();assert.deepEqual([r.width,r.height],[1920,1440]);
  await hive.click();
  for(const [preset,ratio] of [['classic',4/3],['square',1],['wide',16/9],['portrait',3/4]]){await page.getByLabel('Crop size',{exact:true}).selectOption(preset);r=await record();assert.ok(Math.abs(r.width/r.height-ratio)<.004,JSON.stringify(r));assert.ok(r.width*r.height<=300000,JSON.stringify(r));}
  await page.getByRole('button',{name:'Hive Main Picture',exact:true}).click();r=await record();assert.deepEqual([r.width,r.height],[612,490]);assert.ok(path.basename(r.file).startsWith('Hive-Main-Picture'));
  await page.getByRole('tab',{name:'Portrait',exact:true}).click();await short();assert.equal(await page.getByLabel('Portrait frame',{exact:true}).isChecked(),false);r=await record();assert.deepEqual([r.width,r.height],[612,490]);
  await page.getByRole('button',{name:'Hive Main Picture',exact:true}).click();await page.getByRole('tab',{name:'Sequences',exact:true}).click();await hive.click();await page.getByLabel('Crop size',{exact:true}).selectOption('classic');
  await page.getByRole('region',{name:'Text',exact:true}).getByRole('button',{name:'Add',exact:true}).click();await page.getByLabel('Text content').fill('MEGAZORD');
  await app.evaluate((_,file)=>global.nextOpen=file,second);await page.getByRole('button',{name:'Load model',exact:true}).click();await page.locator('.showcase-model-file small').filter({hasText:'LayoutB.mdx'}).waitFor();await page.waitForFunction(()=>!document.querySelector('.showcase-record').disabled);
  assert.match(await page.getByRole('list',{name:'Animation sequence'}).innerText(),/Stand/);assert.equal(await page.getByLabel('Crop size',{exact:true}).inputValue(),'classic');assert.equal(await page.getByLabel('Text content').inputValue(),'MEGAZORD');assert.equal(await page.getByLabel('Extra Time').inputValue(),'0');
  await page.getByRole('button',{name:'Vertices',exact:true}).click();assert.match(await page.title(),/LayoutA/);await page.getByRole('button',{name:'Showcase',exact:true}).click();assert.match(await page.locator('.showcase-model-file small').innerText(),/LayoutB/);
  await page.getByRole('button',{name:'Vertices',exact:true}).click();await app.evaluate(({BrowserWindow},file)=>{global.nextOpen=file;BrowserWindow.getAllWindows()[0].webContents.send('menu','open');},third);await page.waitForFunction(()=>document.title.includes('LayoutC'));await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.locator('.showcase-model-file small').filter({hasText:'LayoutC.mdx'}).waitFor();assert.equal(await page.getByRole('list',{name:'Animation sequence'}).locator('li').count(),0);assert.equal(await page.getByLabel('Text content').inputValue(),'MEGAZORD');assert.equal(await page.getByLabel('Crop size',{exact:true}).inputValue(),'classic');
  await page.getByRole('tab',{name:'Portrait',exact:true}).click();assert.match(await page.getByRole('list',{name:'Animation sequence'}).innerText(),/Portrait Talk/);
  fs.writeFileSync(path.join(out,'ratios.json'),JSON.stringify(records,null,2));await page.screenshot({path:path.join(out,'layout.png')});console.log('PASS ratios, optional Hive profile, no removed upload control, separate main picture, isolated loading and retained setup: '+out);
 }finally{if(clipboard!==undefined)await app.evaluate(({clipboard},text)=>clipboard.writeText(text),clipboard);await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
