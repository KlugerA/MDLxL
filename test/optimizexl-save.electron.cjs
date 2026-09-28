const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {openDocument}=await import('../src/editor-document.js');
 const {runOptimizeStage,simpleSettings,SPHERE_PRESETS}=await import('../src/optimizexl.js');
 const {prepareNuclearReduction}=await import('../src/optimizexl-geometry.js');await prepareNuclearReduction();
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','optimizexl-save-proof'),run=path.join(out,'run-'+Date.now()),copies=path.join(run,'copies');fs.mkdirSync(copies,{recursive:true});
 const model=process.env.MDLXL_OPTIMIZEXL_MODEL||'C:/Users/PC/Documents/ChatGPT/MDLxL/out/Khorne_Optimized_Review/WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx';
 const source=fs.readFileSync(model),packaged=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[],savedFiles=new Map();
 const stem=path.basename(model,'.mdx');for(const suffix of ['Before','After']){const file=path.join(copies,`${stem}_${suffix}.mdx`),bytes=Buffer.from('Existing review copy, do not replace');fs.writeFileSync(file,bytes);savedFiles.set(file,bytes);}
 const spheres=Buffer.from(runOptimizeStage(new Uint8Array(source),'spheres',{size:1,preset:4,spheres:SPHERE_PRESETS[4].spheres}).bytes);
 assert.notDeepEqual(spheres,source);
 const nuclear=Buffer.from(runOptimizeStage(new Uint8Array(spheres),'nuclear',simpleSettings('nuclear',100,openDocument(new Uint8Array(spheres),'copy.mdx').model)).bytes);
 assert.notDeepEqual(nuclear,spheres);
 const app=await _electron.launch({executablePath:packaged||path.resolve('node_modules/electron/dist/electron.exe'),args:packaged?[model]:[process.cwd(),model],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(run,'profile')},timeout:60000});
 try{
  const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow,dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1440,height:900});w.showInactive();}},copies);
  const save=p.getByRole('button',{name:'Optimize New Copy',exact:true});await save.waitFor();
  const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong')&&!document.querySelector('.ox-savings').textContent.includes('Updating'));
  const onlySave=async()=>{assert.equal(await save.count(),1);assert.equal(await save.isEnabled(),true);assert.equal(await p.locator('.ox-root > header').getByRole('button',{name:'Optimize New Copy',exact:true}).count(),1);assert.equal(await p.getByRole('button',{name:'Save Before + After',exact:true}).count(),0);};
  const saveAndCheck=async(expected,nuked=false)=>{
   const old=new Set(fs.readdirSync(copies));const stage=await p.locator('.ox-controls > h2').textContent();await save.click();
   await p.waitForFunction(()=>!Array.from(document.querySelectorAll('.ox-root>header button')).some(b=>b.textContent==='Saving…'));
   const added=fs.readdirSync(copies).filter(n=>!old.has(n));assert.equal(added.length,2,'Each click must create exactly two new files');
   const before=added.find(n=>n.includes('_Before')),after=added.find(n=>n.includes('_After'));assert.ok(before&&after);assert.equal(after.includes('_NUCLEAR'),nuked);
   assert.deepEqual(fs.readFileSync(path.join(copies,before)),source);assert.deepEqual(fs.readFileSync(path.join(copies,after)),expected,'Save only the approved bytes');
   for(const [file,bytes]of savedFiles)assert.deepEqual(fs.readFileSync(file),bytes,'Never overwrite an earlier output');
   for(const name of added){const file=path.join(copies,name);savedFiles.set(file,fs.readFileSync(file));}
   assert.equal(await p.locator('.ox-controls > h2').textContent(),stage,'Saving must not advance or approve the current stage');assert.deepEqual(fs.readFileSync(model),source);await onlySave();
  };
  await p.getByLabel('Animation',{exact:true}).selectOption({label:'Stand'});
  for(const name of ['Duplicate data','Animation optimization','Unused data','Insanity FIxer','Irregularities Fixer','Sphereomancer','Nuclear Polygon Destroyer']){await p.getByRole('button',{name,exact:true}).click();await onlySave();}
  await p.getByRole('button',{name:'Sphereomancer',exact:true}).click();await p.getByLabel('Sphere preset',{exact:true}).selectOption('4');await ready();
  await saveAndCheck(source);assert.match(await p.locator('footer').textContent(),/Total saved: 0.00 KB/);await p.screenshot({path:path.join(out,'01-unapproved-excluded.png')});
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.getByLabel('Strength',{exact:true}).fill('100');await onlySave();await saveAndCheck(spheres);await ready();
  assert.match(await p.locator('.ox-poly').textContent(),/2,946/);await p.screenshot({path:path.join(out,'02-approved-only.png')});
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.getByRole('heading',{name:'Ready to save',exact:true}).waitFor();await onlySave();await saveAndCheck(nuclear,true);await saveAndCheck(nuclear,true);
  await p.screenshot({path:path.join(out,'03-final-same-save-action.png')});
  await p.getByRole('button',{name:'Back',exact:true}).click();await ready();await saveAndCheck(spheres);
  const count=fs.readdirSync(copies).length;await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});await save.click();await p.waitForFunction(()=>Array.from(document.querySelectorAll('.ox-root>header button')).some(b=>b.textContent==='Optimize New Copy'&&!b.disabled));assert.equal(fs.readdirSync(copies).length,count,'Cancel must not create files');
  assert.deepEqual(errors,[]);assert.deepEqual(fs.readFileSync(model),source);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!packaged,errors,copies,saveOperations:5,newFiles:count-2,existingFilesPreserved:true,sourceUnchanged:true,unapprovedExcluded:true},null,2));
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
