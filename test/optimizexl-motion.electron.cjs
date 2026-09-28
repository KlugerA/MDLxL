const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const model=process.env.MDLXL_FOOTMAN_MODEL||'C:/Users/PC/Downloads/Footman (Unoptimized).mdx',source=fs.readFileSync(model);
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','motion-ui'),profile=path.join(out,'profile-'+Date.now());fs.mkdirSync(profile,{recursive:true});
 const exe=process.env.MDLXL_OPTIMIZEXL_EXE;
 const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),model],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
 const errors=[];
 try{
  const main=await app.firstWindow();await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}});
  const stage=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true}).click();
  await stage('Irregularities Fixer');
  const select=p.getByLabel('Proposed fix',{exact:true}),warning='Stand - 1: irregular movement (Bone_Root)';
  assert.ok((await select.locator('option').allTextContents()).includes(warning));
  assert.equal(await p.getByText(/Replace the affected translation only/).count(),0,'No repair details until selected');
  await select.selectOption({label:warning});await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
  assert.equal(await p.getByLabel('Animation',{exact:true}).inputValue(),'0');assert.equal(await p.getByLabel('Animation frame',{exact:true}).inputValue(),'167');
  assert.match(await p.locator('.ox-controls').textContent(),/Remove curve bouncing and keyed jitter from Stand - 1 \(whole body\)/);
  assert.equal(await p.getByRole('button',{name:'Approve',exact:true}).isEnabled(),true);
  const frame=p.getByLabel('Animation frame',{exact:true});await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(()=>Number(document.querySelector('[aria-label="Animation frame"]').value)>250);await p.getByRole('button',{name:'Pause',exact:true}).click();
  await p.evaluate(()=>{window.sides=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{let props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.model?.Geosets&&c?.compareCamera)props=c;}return props;});});
  const state=await p.evaluate(()=>{const [a,b]=sides(),root=s=>s.model.Nodes.find(n=>n?.Name==='Bone_Root').Translation;return {sameModel:a.model===b.model,timeA:a.time,timeB:b.time,posesA:root(a).Keys.map(k=>[k.Frame,...k.Vector]),posesB:root(b).Keys.map(k=>[k.Frame,...k.Vector]),controlsChanged:JSON.stringify(root(a))!==JSON.stringify(root(b))};});assert.equal(state.sameModel,false);assert.equal(state.timeA,state.timeB);assert.deepEqual(state.posesA.filter((v,i)=>JSON.stringify(v)!==JSON.stringify(state.posesB[i])).map(v=>v[0]),[1033,1067]);assert.equal(state.controlsChanged,true);
  await frame.fill('1067');await p.waitForTimeout(100);await p.screenshot({path:path.join(out,'motion-repair.png')});
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelector('[aria-label="Proposed fix"]').options).some(o=>o.textContent==='Stand - 1: irregular movement (Bone_Root)'));assert.equal(await p.getByRole('button',{name:'Back',exact:true}).isEnabled(),true);
  await p.getByRole('button',{name:'Back',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));assert.ok((await select.locator('option').allTextContents()).includes(warning));assert.equal(await select.inputValue(),'motion:0:25:Translation');
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelector('[aria-label="Proposed fix"]').options).some(o=>o.textContent==='Stand - 1: irregular movement (Bone_Root)'));
  await stage('Animation optimization');await p.getByLabel('Strength',{exact:true}).fill('100');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();
  await p.getByLabel('Proposed fix',{exact:true}).selectOption('invalidBounds');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();await p.getByText('No Hive issues found. Choose Next stage to review movement irregularities.',{exact:true}).waitFor();assert.equal(await p.getByLabel('Proposed fix',{exact:true}).count(),0);assert.equal(await p.getByText(/remain for manual editing/).count(),0);await p.screenshot({path:path.join(out,'sanity-clean.png')});
  await stage('Duplicate data');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));assert.equal(await p.getByText('Review only — no correction proposed.',{exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'Approve',exact:true}).isEnabled(),true);
  assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,warning,sequenceSelected:0,frameSelected:167,repairPreviewAndApproval:true,backRestoresCurve:true,removedBadKeyPoses:[1033,1067],cleanSanityExplained:true,playbackSynchronized:true,sourceUnchanged:true,errors},null,2));console.log('Passed OptimizeXL curve repair preview, synchronized playback, approval, Back, clean sanity and source preservation.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
