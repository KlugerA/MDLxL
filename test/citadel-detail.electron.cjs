// User feedback regression: native chainmail directly on the original shield.
// Real pointer edits; Fiber and camera reads only observe the running app.
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=process.cwd(),fixture=process.env.MDLXL_PAINT_FIXTURE,out=path.resolve(process.env.MDLXL_PAINT_OUT||'out/citadel-audit/detail-'+Date.now());
if(!fixture)throw Error('Set MDLXL_PAINT_FIXTURE to the unchanged Classic Footman.');
fs.mkdirSync(out,{recursive:true});let app,page;const result={checks:[],placements:[],errors:[]};
const settle=()=>page.waitForTimeout(220);
async function run(){
  app=await _electron.launch({executablePath:process.env.MDLXL_ELECTRON_PATH||path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')}});
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>result.errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1280,920);w.setPosition(-3000,0);w.showInactive();});
  await page.locator('[data-warmkey="paint"]').click();await page.getByRole('button',{name:'Begin',exact:true}).click();await page.locator('.paint-texture-view').waitFor();
  await page.evaluate(()=>{
    window.audit=()=>{const e=document.querySelector('.paint-workspace');let f=e[Object.keys(e).find(k=>k.startsWith('__reactFiber'))];while(f.return)f=f.return;const find=(f,p)=>{if(p(f))return f;for(let c=f.child;c;c=c.sibling){const r=find(c,p);if(r)return r;}};const w=find(f.stateNode.current,f=>f.memoizedProps?.onWorkingModelChange&&f.memoizedProps?.originalModel),v=find(f.stateNode.current,f=>f.memoizedProps?.onPaintStart&&f.memoizedProps?.paintMode);let runtime,hover,prepared,mask;for(let h=v.memoizedState;h;h=h.next)if(h.memoizedState?.current?.renderer&&h.memoizedState?.current?.camera)runtime=h.memoizedState.current;for(let h=w.memoizedState;h;h=h.next){const s=h.memoizedState;if(s?.current?.entries&&s.current.parts)hover=s.current;if(s?.key&&s.project?.targets)prepared=s;if(s?.targetId&&s?.width&&ArrayBuffer.isView(s.data))mask=s;}return {project:w.memoizedProps.project,runtime,hover,prepared,mask};};
    window.shieldPoint=()=>{const {runtime:r}=audit(),p=r.camera.position.clone().set(14.75,-29,52.26).project(r.camera),b=r.renderer.domElement.getBoundingClientRect();return[b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2];};
    window.digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
  });
  await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await page.getByRole('spinbutton',{name:'Brush Size value',exact:true}).fill('100');
  for(const mode of ['Brush','Detail']){
    await page.getByRole('button',{name:mode,exact:true}).click();await page.getByRole('button',{name:'Fit model',exact:true}).click();await settle();
    for(let zoom=0;zoom<3;zoom++){
      const p=await page.evaluate(()=>shieldPoint()),start=Date.now();await page.mouse.move(...p);await page.waitForFunction(()=>audit().hover?.parts.length>0);await settle();
      const held=await page.evaluate(async()=>{const a=audit(),p=a.hover.parts[0];return {coat:await digest(p.coat.raster.data),zoom:a.hover.brush.zoom,width:p.coat.raster.width,canonicalWidth:a.project.targets[0].base.width,history:a.project.history.undo.length};});
      assert.equal(held.canonicalWidth,256);assert.equal(held.width,1024);assert.equal(held.history,0);
      await page.screenshot({path:path.join(out,mode+'-'+zoom+'-held.png')});await page.mouse.click(...p);await page.mouse.move(960,490);await settle();
      assert.equal(await page.evaluate(()=>digest(audit().project.targets[0].coats[0].raster.data)),held.coat);assert.equal(await page.evaluate(()=>audit().project.history.undo.length),1);
      await page.screenshot({path:path.join(out,mode+'-'+zoom+'-committed.png')});result.placements.push({mode,cameraStep:zoom,effectiveZoom:held.zoom,hoverAndSettleMs:Date.now()-start});
      await page.keyboard.press('Control+z');await settle();assert.equal(await page.evaluate(()=>audit().project.targets[0].base.width),256);
      await page.mouse.move(...p);await page.mouse.wheel(0,-180);await settle();
    }
  }
  result.checks.push('Brush and Detail direct shield placement at three camera distances; preview equals committed pixels; each undo restores original mapping');
  await page.getByRole('button',{name:'Fit model',exact:true}).click();await page.getByRole('button',{name:'Paint region…',exact:true}).click();await page.getByRole('button',{name:'Texture mask…',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Paint region',exact:true});await dialog.getByLabel('Selection mode',{exact:true}).selectOption('subtract');const b=await dialog.locator('.paint-cutout-image').boundingBox();await page.mouse.move(b.x,b.y);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height);await page.mouse.up();await page.getByRole('button',{name:'Use paint region',exact:true}).click();
  const p=await page.evaluate(()=>shieldPoint());await page.mouse.move(...p);await page.waitForFunction(()=>audit().hover?.parts.length>0);await settle();
  const maskProof=await page.evaluate(()=>{const a=audit(),p=a.hover.parts[0],mask=a.prepared.textureRegion.data;let excluded=0,changed=0;for(let i=0;i<mask.length;i++){if(!mask[i]){excluded++;if(p.coat.raster.data[i*4+3])throw Error('Paint entered an excluded destination pixel');}else if(p.coat.raster.data[i*4+3])changed++;}return {original:a.mask.width,prepared:a.prepared.textureRegion.width,excluded,changed};});
  assert.equal(maskProof.original,256);assert.equal(maskProof.prepared,1024);assert.ok(maskProof.excluded>100);assert.ok(maskProof.changed>100);await page.mouse.click(...p);await page.mouse.move(960,490);await settle();assert.equal(await page.evaluate(()=>audit().mask.width),1024);await page.screenshot({path:path.join(out,'prepared-mask.png')});
  result.checks.push('protected destination mask survives automatic mapping and excludes exact staged pixels');assert.deepEqual(result.errors,[]);console.log(JSON.stringify({out,...result},null,2));
}
run().catch(async error=>{result.failure=error.stack;console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-1200));await page.screenshot({path:path.join(out,'failure.png')});}process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});});
