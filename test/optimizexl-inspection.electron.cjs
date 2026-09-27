const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const out=path.resolve('out/optimizexl-inspection-proof');fs.mkdirSync(out,{recursive:true});
 const model=process.env.MDLXL_OPTIMIZEXL_MODEL||'C:/Users/PC/Documents/ChatGPT/MDLxL/out/Khorne_Optimized_Review/WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx';
 const source=fs.readFileSync(model),packaged=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[];
 const app=await _electron.launch({executablePath:packaged||path.resolve('node_modules/electron/dist/electron.exe'),args:packaged?[model]:[process.cwd(),model],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
 try{
  const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1440,height:900});w.showInactive();}});
  const animation=p.getByLabel('Animation',{exact:true}),frame=p.getByLabel('Animation frame',{exact:true});
  await animation.selectOption({label:'Stand'});await frame.fill('2000');await p.getByLabel('Playback speed',{exact:true}).selectOption('0.5');
  await p.getByRole('checkbox',{name:'Loop',exact:true}).uncheck();
  await p.waitForFunction(()=>document.querySelectorAll('.ox-preview canvas:not([data-background])').length>=2);
  await p.evaluate(()=>{window.inspectState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{let fiber=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];for(;fiber;fiber=fiber.return)for(let h=fiber.memoizedState;h;h=h.next){const r=h.memoizedState?.current;if(r?.native&&r?.controls)return {sequence:r.native.getSequence(),frame:r.native.getFrame(),position:r.controls.object.position.toArray(),target:r.controls.target.toArray(),zoom:r.controls.object.zoom};}return null;});});
  await p.waitForFunction(()=>inspectState().every(s=>s?.sequence===1&&s.frame===2000));
  const box=await p.getByLabel('Before preview',{exact:true}).boundingBox();await p.mouse.move(box.x+200,box.y+230);await p.mouse.down();await p.mouse.move(box.x+230,box.y+240,{steps:6});await p.mouse.up();await p.mouse.wheel(0,-200);await p.waitForTimeout(150);
  const camera=(await p.evaluate(()=>inspectState()))[0];
  const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong')&&!document.querySelector('.ox-savings').textContent.includes('Updating'));
  const inspect=async(id='decay:37')=>{await p.getByRole('button',{name:'Irregularities Fixer',exact:true}).click();await p.getByLabel('Proposed fix',{exact:true}).selectOption(id);await ready();};
  const restored=async()=>{
   assert.equal(await animation.inputValue(),'1','Leaving a finding must restore the previous whole-model animation');assert.equal(await frame.inputValue(),'2000','Restore the previous frame, not the sequence start');
   await p.waitForFunction(()=>inspectState().every(s=>s?.sequence===1&&s.frame===2000));
   for(const state of await p.evaluate(()=>inspectState()))for(const key of ['position','target','zoom'])assert.deepEqual(state[key],camera[key],'Keep the paired camera while leaving inspection');
   assert.equal(await p.getByLabel('Playback speed',{exact:true}).inputValue(),'0.5');assert.equal(await p.getByRole('checkbox',{name:'Loop',exact:true}).isChecked(),false);
  };
  await ready();await p.screenshot({path:path.join(out,'01-normal.png')});
  for(const name of ['Duplicate data','Animation optimization','Unused data','Insanity FIxer','Sphereomancer','Nuclear Polygon Destroyer']){
   await inspect();await p.waitForFunction(()=>inspectState().every(s=>s?.sequence===10));
   if(name==='Duplicate data')await p.screenshot({path:path.join(out,'02-decay-inspection.png')});
   await p.getByRole('button',{name,exact:true}).click();await p.screenshot({path:path.join(out,'03-returned.png')});await restored();
  }
  // Changing findings must keep the original return point, not the last finding.
  await inspect();await p.getByLabel('Proposed fix',{exact:true}).selectOption('visibility:45:13');await ready();await p.getByRole('button',{name:'Next stage',exact:true}).click();await restored();
  // Clearing, skipping and approving all finish the temporary inspection.
  await inspect();await p.getByLabel('Proposed fix',{exact:true}).selectOption('');await restored();
  await inspect('decay:38');await p.getByRole('button',{name:'Skip fix',exact:true}).click();await restored();
  await inspect();await p.getByRole('button',{name:'Approve',exact:true}).click();await restored();
  // Back reopens the undone finding, then leaving it restores normal playback.
  await p.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await p.getByLabel('Proposed fix',{exact:true}).inputValue(),'decay:37');await p.waitForFunction(()=>inspectState().every(s=>s?.sequence===10));
  await p.getByRole('button',{name:'Duplicate data',exact:true}).click();await restored();
  // Ordinary stage changes must retain an animation the user chose deliberately.
  await animation.selectOption({label:'Decay Bone'});await frame.fill('180000');await p.getByRole('button',{name:'Unused data',exact:true}).click();assert.equal(await animation.inputValue(),'10');assert.equal(await frame.inputValue(),'180000');
  await animation.selectOption({label:'Stand'});await frame.fill('2000');await restored();await ready();
  assert.match(await p.locator('footer').textContent(),/Total saved: 0.00 KB/);await p.screenshot({path:path.join(out,'04-restored-final.png')});
  assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!packaged,errors,sourceUnchanged:true,stageExits:6,restoredSequence:'Stand',restoredFrame:2000},null,2));
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
