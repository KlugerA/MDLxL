// Autoaim is optional source scaling on the original mapping. All edits use UI
// input; Fiber reads observe pixels, hit faces and effective zoom only.
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),fixture=process.env.MDLXL_PAINT_FIXTURE,out=path.resolve(process.env.MDLXL_PAINT_OUT||'out/citadel-audit/autoaim-'+Date.now());
if(!fixture)throw Error('Set MDLXL_PAINT_FIXTURE to the unchanged Classic Footman.');
fs.mkdirSync(out,{recursive:true});let app,page;const result={checks:[],samples:[],errors:[]};
const settle=()=>page.waitForTimeout(100),shot=name=>page.screenshot({path:path.join(out,name+'.png')});
async function run(){
  app=await _electron.launch({executablePath:process.env.MDLXL_ELECTRON_PATH||path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')}});
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>result.errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1280,920);w.setPosition(-3000,0);w.showInactive();});
  await page.locator('[data-warmkey="paint"]').click();await page.getByRole('button',{name:'Begin',exact:true}).click();await page.locator('.paint-texture-view').waitFor();
  await page.evaluate(()=>{
    window.audit=()=>{const e=document.querySelector('.paint-workspace');let f=e[Object.keys(e).find(k=>k.startsWith('__reactFiber'))];while(f.return)f=f.return;const find=(f,p)=>{if(p(f))return f;for(let c=f.child;c;c=c.sibling){const r=find(c,p);if(r)return r;}};const w=find(f.stateNode.current,f=>f.memoizedProps?.onWorkingModelChange&&f.memoizedProps?.originalModel),v=find(f.stateNode.current,f=>f.memoizedProps?.onPaintStart&&f.memoizedProps?.paintMode);let runtime,hover,hit;for(let h=v.memoizedState;h;h=h.next)if(h.memoizedState?.current?.renderer&&h.memoizedState?.current?.camera)runtime=h.memoizedState.current;for(let h=w.memoizedState;h;h=h.next){const s=h.memoizedState?.current;if(s?.entries&&s.parts)hover=s;if(s?.screen&&s?.viewport)hit=s;}return{props:w.memoizedProps,project:w.memoizedProps.project,runtime,hover,hit};};
    window.pointFor=world=>{const r=audit().runtime,p=r.camera.position.clone().set(...world).project(r.camera),b=r.renderer.domElement.getBoundingClientRect();return [b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2];};
    window.digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
    window.geometryState=()=>JSON.stringify({geosets:audit().props.model.Geosets,edits:audit().project.geometryEdits,uv:audit().project.uvEdits,bindings:audit().project.targets.map(t=>t.bindings),dimensions:audit().project.targets.map(t=>[t.base.width,t.base.height])});
    window.timings={samples:[],longTasks:[]};new PerformanceObserver(list=>timings.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});document.querySelector('.paint-model-view').addEventListener('pointermove',()=>{const t=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>timings.samples.push(performance.now()-t)));},true);
  });
  const original=await page.evaluate(()=>geometryState());await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await page.getByRole('spinbutton',{name:'Brush Size value',exact:true}).fill('100');assert.equal(await page.getByRole('checkbox',{name:'Autoaim',exact:true}).isChecked(),false);
  const world={shield:[14.75,-29,52.26],sword:[54.9762,20.8331,59.2066]};
  async function hoverAt(area){const p=await page.evaluate(v=>pointFor(v),world[area]);await page.mouse.move(...p);await page.waitForFunction(()=>!!audit().hover);await settle();return p;}
  async function inspect(){return page.evaluate(async()=>{const a=audit();return {zoom:a.hover.brush.zoom,geoset:a.hit.geosetIndex,face:a.hit.triangle,coat:await digest(a.hover.parts[0].coat.raster.data)};});}
  for(const mode of ['Brush','Detail']){
    await page.getByRole('button',{name:mode,exact:true}).click();
    for(const enabled of [false,true]){
      await page.getByRole('checkbox',{name:'Autoaim',exact:true}).setChecked(enabled);let shield;
      for(const area of ['shield','sword']){
        const p=await hoverAt(area),held=await inspect();assert.equal(held.geoset,area==='shield'?1:0);if(!enabled)assert.equal(held.zoom,1);else if(area==='shield')assert.ok(held.zoom>1);else assert.ok(held.zoom<shield,'sword compensation must be lower than the shield');if(area==='shield')shield=held.zoom;
        assert.equal(await page.evaluate(()=>geometryState()),original);assert.equal(await page.evaluate(()=>audit().project.history.undo.length),0);await shot(mode+'-'+area+'-'+enabled+'-held');
        await page.mouse.click(...p);await page.mouse.move(960,490);await settle();assert.equal(await page.evaluate(()=>digest(audit().project.targets[0].coats[0].raster.data)),held.coat);assert.equal(await page.evaluate(()=>geometryState()),original);assert.equal(await page.evaluate(()=>audit().project.history.undo.length),1);await shot(mode+'-'+area+'-'+enabled+'-placed');
        result.samples.push({mode,area,autoaim:enabled,zoom:held.zoom,face:held.face});await page.keyboard.press('Control+z');await settle();assert.equal(await page.evaluate(()=>audit().project.history.undo.length),0);
      }
    }
  }
  // Same camera, same cached projection: moving between parts must update scale.
  await hoverAt('shield');const first=(await inspect()).zoom;await hoverAt('sword');assert.ok((await inspect()).zoom<first);await hoverAt('shield');assert.equal((await inspect()).zoom,first);
  // Flat texture painting is always literal, even with Autoaim enabled.
  const b=await page.locator('.paint-texture-image').boundingBox();await page.mouse.move(b.x+b.width*.7,b.y+b.height*.5);await settle();assert.equal((await inspect()).zoom,1);
  const p=await hoverAt('shield');await page.mouse.wheel(0,-180);await settle();await hoverAt('shield');assert.ok((await inspect()).zoom>first);assert.equal(await page.evaluate(()=>geometryState()),original);await shot('Autoaim-closer-camera');
  await page.getByRole('checkbox',{name:'Autoaim',exact:true}).uncheck();await hoverAt('shield');assert.equal((await inspect()).zoom,1);assert.equal(await page.evaluate(()=>geometryState()),original);
  // A short warm input sample, including actual 3D brushing.
  await page.getByRole('button',{name:'Brush',exact:true}).click();await page.getByRole('checkbox',{name:'Autoaim',exact:true}).check();const start=await hoverAt('shield');await page.evaluate(()=>{timings.samples=[];timings.longTasks=[];});await page.mouse.down();for(let i=0;i<24;i++)await page.mouse.move(start[0]+i%6,start[1]+Math.floor(i/6));await page.mouse.up();await settle();result.performance=await page.evaluate(()=>timings);
  result.checks.push('Autoaim defaults off; literal source zoom restored when disabled','Shield receives more compensation than sword, in Brush and Detail','Hover/commit pixels match; undo remains one ordinary paint step','No destination resize, UV repack or geometry change on hover, paint, undo or zoom','Same-pose face switching refreshes scale; flat texture view stays literal','Closer camera increases local compensation');assert.deepEqual(result.errors,[]);console.log(JSON.stringify({out,...result},null,2));
}
run().catch(async error=>{result.failure=error.stack;console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-1200));await shot('failure');}process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});});
