const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {openDocument}=await import('../src/editor-document.js'),{runOptimizeStage,simpleSettings}=await import('../src/optimizexl.js');
 const files=process.env.MDLXL_EXPRESSION_MODEL?[process.env.MDLXL_EXPRESSION_MODEL]:['C:/Users/PC/Desktop/fINALS/WH_WOC_KnightKhorneFlail07.mdx','C:/Users/PC/Desktop/WH_WOC_KnightKhorneFlail03.mdx'];
 const proof=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','expression-ui');fs.mkdirSync(proof,{recursive:true});
 const reports=[];
 for(const [index,file] of files.entries()){
  const source=fs.readFileSync(file),model=openDocument(new Uint8Array(source),'source.mdx').model;
  const jaw=model.Bones.find(n=>n.Name==='BoneJaw'),sequence=model.Sequences.findIndex(s=>/portrait talk/i.test(s.Name));assert.ok(jaw&&sequence>=0);
  const expected=Buffer.from(runOptimizeStage(new Uint8Array(source),'animation',simpleSettings('animation',100,model)).bytes);
  const out=path.join(proof,`case-${index}-${Date.now()}`),copies=path.join(out,'copies');fs.mkdirSync(copies,{recursive:true});const errors=[];
  const exe=process.env.MDLXL_OPTIMIZEXL_EXE;
  const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),file],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
  try{
   const main=await app.firstWindow();await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
   const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
   await app.evaluate(({BrowserWindow,dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}},copies);
   await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Animation optimization',exact:true}).click();
   await p.getByLabel('Strength',{exact:true}).fill('100');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
   const pinned=await p.locator('[aria-label="Before preview"] h2').textContent();
   await p.getByLabel('Animation',{exact:true}).selectOption(String(sequence));
   await p.evaluate(()=>{window.expressionState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
    let runtime,props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.native&&c?.controls)runtime=c;if(c?.model?.Geosets&&c?.compareCamera)props=c;}
    if(!runtime||!props)return null;const n=props.model.Bones.find(n=>n.Name==='BoneJaw');return {frame:runtime.native.getFrame(),sequence:runtime.native.getSequence(),keys:n.Translation.Keys.length,matrix:Array.from(runtime.native.rendererData.nodes[n.ObjectId].matrix)};
   });});
   const poses=[];
   for(const frame of [jaw.Translation.Keys[0].Frame,jaw.Translation.Keys[1].Frame,jaw.Translation.Keys[4].Frame]){
    await p.getByLabel('Animation frame',{exact:true}).fill(String(frame));
    await p.waitForFunction(({frame,sequence})=>expressionState().every(s=>s&&s.keys===7&&s.sequence===sequence&&Math.abs(s.frame-frame)<1e-5),{frame,sequence});
    const states=await p.evaluate(()=>expressionState());assert.deepEqual(states[1].matrix,states[0].matrix);poses.push(states[1].matrix);
   }
   assert.notDeepEqual(poses[0],poses[1],'After jaw must actually move');assert.notDeepEqual(poses[1],poses[2]);
   await p.screenshot({path:path.join(out,'maximum-strength-speech.png')});
   await p.getByRole('button',{name:'Advanced',exact:true}).click();
   for(const label of ['Translation tolerance','Rotation tolerance (degrees)','Scale tolerance']){await p.getByRole('button',{name:'About '+label,exact:true}).hover();assert.match(await p.getByRole('tooltip').textContent(),/10% relative/);await p.keyboard.press('Escape');await p.getByRole('tooltip').waitFor({state:'hidden'});}
   await p.getByRole('button',{name:'Approve',exact:true}).click();
   await p.getByRole('heading',{name:'Unused data',exact:true}).waitFor();assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),pinned);
   await p.getByRole('button',{name:'Optimize New Copy',exact:true}).click();await p.getByText('Saved both copies:',{exact:false}).waitFor();
   const saved=fs.readdirSync(copies);assert.equal(saved.length,2);
   assert.deepEqual(fs.readFileSync(path.join(copies,saved.find(f=>f.includes('_Before')))),source);
   const afterBytes=fs.readFileSync(path.join(copies,saved.find(f=>f.includes('_After'))));assert.deepEqual(afterBytes,expected);
   assert.equal(openDocument(new Uint8Array(afterBytes),'after.mdx').model.Bones.find(n=>n.Name==='BoneJaw').Translation.Keys.length,7);
   await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('heading',{name:'Animation optimization',exact:true}).waitFor();
   assert.match(await p.locator('footer').textContent(),/Total saved: 0.00 KB/);
   assert.deepEqual(fs.readFileSync(file),source);assert.deepEqual(errors,[]);
   reports.push({file,passed:true,nativePairedJawPoses:3,keysRetained:7,approvedOnlyPairSaved:true,backRestoresOriginal:true,originalUntouched:true,errors});
  }finally{await app.close();}
 }
 fs.writeFileSync(path.join(proof,'result.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1;});
