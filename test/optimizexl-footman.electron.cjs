const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const model=process.env.MDLXL_FOOTMAN_MODEL||'C:/Users/PC/Downloads/Footman (Unoptimized).mdx',source=fs.readFileSync(model),exe=process.env.MDLXL_OPTIMIZEXL_EXE;
 const scale=process.env.MDLXL_TEST_DPR||'1',out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','footman-ui-'+scale),profile=path.join(out,'profile-'+Date.now());fs.mkdirSync(profile,{recursive:true});
 const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),model,'--force-device-scale-factor='+scale],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
 const errors=[],alignment=[];
 try{
  const main=await app.firstWindow();await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1920,height:1080});w.showInactive();}});
  const stage=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true}).click();
  const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
  await stage('Irregularities Fixer');await p.getByLabel('Animation',{exact:true}).selectOption({label:'Stand - 1'});
  await p.evaluate(()=>{window.sides=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{let runtime,props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.native&&c?.controls)runtime=c;if(c?.model?.Geosets&&c?.compareCamera)props=c;}return {root,runtime,props};});});
  for(const width of [1920,1600,1601,1279]){
   await app.evaluate(({BrowserWindow},width)=>{for(const w of BrowserWindow.getAllWindows())w.setSize(width,1000);},width);
   await p.waitForTimeout(200);await p.waitForFunction(()=>sides().every(s=>s.runtime?.captureApi?.isReady));
   const state=await p.evaluate(()=>{
    const s=sides(),canvases=s.map(x=>x.root.querySelector('[data-clean-model-canvas]')),captures=s.map(x=>x.runtime.captureApi.captureFrame());
    const pixels=captures.map(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data);let changed=0;for(let i=0;i<pixels[0].length;i++)if(pixels[0][i]!==pixels[1][i])changed++;
    return {sameModel:s[0].props.model===s[1].props.model,changed,dpr:devicePixelRatio,canvases:canvases.map(c=>({rect:c.getBoundingClientRect().toJSON(),width:c.width,height:c.height}))};
   });
   assert.equal(state.sameModel,true);assert.equal(state.changed,0,'Equal inputs have equal native pixels');assert.equal(state.canvases[0].width,state.canvases[1].width);
   for(const c of state.canvases){for(const v of [c.rect.x,c.rect.y,c.rect.width,c.rect.height])assert.ok(Math.abs(v*state.dpr-Math.round(v*state.dpr))<.025,'Canvas edges align with physical pixels');assert.ok(Math.abs(c.rect.width*state.dpr-c.width)<.025);}
   // Locator screenshots round fractional CSS clips before device scaling.
   // Crop the full screenshot at physical pixel edges instead, so 125% DPI
   // does not add different extra border columns to equal canvases.
   const screenshot=await p.screenshot({scale:'device'});
   const crops=await p.evaluate(async({png,rects,dpr})=>{const img=new Image();img.src='data:image/png;base64,'+png;await img.decode();return rects.map(r=>{const c=document.createElement('canvas');c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);c.getContext('2d').drawImage(img,Math.round(r.x*dpr),Math.round(r.y*dpr),c.width,c.height,0,0,c.width,c.height);return c.toDataURL().split(',')[1];});},{png:screenshot.toString('base64'),rects:state.canvases.map(c=>c.rect),dpr:state.dpr});
   const [a,b]=crops.map(s=>Buffer.from(s,'base64'));
   fs.writeFileSync(path.join(out,`before-${width}.png`),a);fs.writeFileSync(path.join(out,`after-${width}.png`),b);
   assert.equal(a.equals(b),true,'Actual displayed screenshots must also match');alignment.push({width,...state});
  }
  await p.getByRole('button',{name:'Advanced',exact:true}).click();
  const help={
   'Duplicate data':['Position tolerance','UV tolerance','Normal angle (degrees)','Merge equivalent leaf bones'],
   'Animation optimization':['Translation tolerance','Rotation tolerance (degrees)','Scale tolerance'],
   'Unused data':['Unreferenced vertices','Unused materials, textures and globals','Unused bones and helpers'],
   'Nuclear Polygon Destroyer':['Target polygons','Shape/texture error (%)','Sharp-edge angle','Protect UV seams and boundaries','Protect sharp edges','Protect skinning boundaries'],
   'Sphereomancer':['Preset','Size','X 1','Y 1','Z 1','Radius 1'],
  };
  for(const [name,labels]of Object.entries(help)){
   await stage(name);
   for(const label of labels){const info=p.getByRole('button',{name:'About '+label,exact:true});await info.locator('..').hover();await p.getByRole('tooltip').waitFor();assert.ok((await p.getByRole('tooltip').textContent()).length>30);await p.getByRole('heading',{name:'OptimizeXL',exact:true}).hover();await p.getByRole('tooltip').waitFor({state:'hidden'});}
  }
  await stage('Animation optimization');const info=p.getByRole('button',{name:'About Rotation tolerance (degrees)',exact:true});await info.click();await p.getByRole('heading',{name:'OptimizeXL',exact:true}).hover();assert.equal(await p.getByRole('tooltip').isVisible(),true);await p.keyboard.press('Escape');await p.getByRole('tooltip').waitFor({state:'hidden'});
  await stage('Insanity FIxer');await p.getByText(/Hive: 0 errors · 0 severe · 1 warnings/).waitFor();await p.getByText(/Checker findings \(/).click();await p.getByRole('button',{name:'Preview fix',exact:true}).click();await ready();assert.match(await p.getByLabel('Proposed fix',{exact:true}).inputValue(),/invalidBounds/);
  await p.screenshot({path:path.join(out,'bounds-preview.png')});await p.getByRole('button',{name:'Approve',exact:true}).click();await p.getByText(/Hive: 0 errors · 0 severe · 0 warnings/).waitFor();await p.getByRole('button',{name:'Review redundant keys',exact:true}).click();
  assert.equal(await p.locator('.ox-controls > h2').textContent(),'Animation optimization');await p.getByRole('button',{name:'Simple',exact:true}).click();await p.getByLabel('Strength',{exact:true}).fill('100');await ready();
  const afterSize=await p.getByLabel('After preview',{exact:true}).locator('h2 small').textContent();assert.ok(parseFloat(afterSize)<105);await p.screenshot({path:path.join(out,'animation-reduction.png')});
  await p.getByRole('button',{name:'Approve',exact:true}).click();await ready();await p.getByRole('button',{name:'Optimize New Copy',exact:true}).waitFor();assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,alignment,advancedHelp:Object.values(help).flat().length,boundsRepairApproved:true,afterSize,sourceUnchanged:true,errors},null,2));console.log('Passed Footman UI: '+afterSize+', '+scale+'x display, hover/click help and approved Hive repair.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
