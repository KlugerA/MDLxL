const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','main-rig-'+Date.now());await fs.mkdir(out,{recursive:true});
 const {createDemoDocument}=await import('../src/editor-document.js'),doc=createDemoDocument();doc.model.Sequences=[];
 const fixture=path.join(out,'Static sword.mdx'),bytes=Buffer.from(doc.serialize('mdx'));await fs.writeFile(fixture,bytes);let app;
 try{
  app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
  const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1400,920);w.setPosition(-3000,0);w.webContents.setBackgroundThrottling(false);w.showInactive();});
  await page.getByText('Opened Static sword.mdx',{exact:true}).waitFor();
  const read=()=>page.evaluate(()=>{let el=document.querySelector('.classic-app'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState;if(v?.doc?.model&&v.assets)return {model:JSON.parse(JSON.stringify(v.doc.model)),undo:v.doc.historyStats.undoSteps};}throw Error('Document missing');});
  const before=await read();assert.equal(before.model.Sequences.length,0);
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();await page.getByRole('button',{name:'Close Particle Library',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Particle Editor',exact:true});await editor.getByRole('button',{name:'Add to model',exact:true}).click();
  assert.equal(await page.getByLabel('Effect end',{exact:true}).count(),0);await page.getByRole('button',{name:'Confirm placement',exact:true}).click();await page.getByText('Effect added. Undo restores the model.',{exact:true}).waitFor();
  const placed=await read(),id=placed.model.ParticleEmitters2[0].ObjectId;assert.equal(placed.model.Sequences.length,0);assert.equal(placed.undo,before.undo+1);assert.deepEqual(placed.model.Geosets,before.model.Geosets);
  await page.getByRole('button',{name:'Close Particle Editor',exact:true}).click();await editor.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Bones',exact:true}).click();await page.getByRole('checkbox',{name:'Bones',exact:true}).check();await page.getByLabel('Movement bone or node',{exact:true}).selectOption(String(id));
  await page.getByRole('button',{name:'Move',exact:true}).click();const x=page.getByLabel('X coordinate',{exact:true});await x.fill('80');await x.press('Enter');
  const moved=await read();assert.equal(moved.model.ParticleEmitters2[0].PivotPoint[0],80);assert.equal(moved.undo,placed.undo+1);assert.deepEqual(moved.model.Bones,placed.model.Bones);assert.deepEqual(moved.model.Geosets,placed.model.Geosets);
  const project=async point=>page.evaluate(point=>{const el=document.querySelector('.game-preview-root');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const state=h.memoizedState?.current;if(state?.native&&state.controls){const p=state.controls.target.clone().set(...point).project(state.controls.object),r=el.querySelector('[data-clean-model-canvas]').getBoundingClientRect();return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};}}throw Error('Camera missing');},point);
  const emitterPoint=await project(Object.values(moved.model.ParticleEmitters2[0].PivotPoint));await page.mouse.move(emitterPoint.x,emitterPoint.y);await page.mouse.down();await page.mouse.move(emitterPoint.x+35,emitterPoint.y-15,{steps:5});await page.mouse.up();
  const dragged=await read();assert.notDeepEqual(dragged.model.ParticleEmitters2[0].PivotPoint,moved.model.ParticleEmitters2[0].PivotPoint,'Dragging the selected emitter moves its pivot');assert.equal(dragged.undo,moved.undo+1);assert.deepEqual(dragged.model.Bones,moved.model.Bones);
  await page.getByRole('button',{name:'Attach',exact:true}).click();const rootPoint=await project(Object.values(before.model.Bones[0].PivotPoint));await page.mouse.click(rootPoint.x,rootPoint.y);
  const attached=await read();assert.equal(attached.model.ParticleEmitters2[0].Parent,before.model.Bones[0].ObjectId);assert.equal(attached.undo,dragged.undo+1);assert.deepEqual(attached.model.ParticleEmitters2[0].PivotPoint,dragged.model.ParticleEmitters2[0].PivotPoint);
  await page.screenshot({path:path.join(out,'bound-emitter.png')});
  await page.getByRole('button',{name:'Detach',exact:true}).click();assert.ok((await read()).model.ParticleEmitters2[0].Parent==null);
  const visibility=page.getByRole('checkbox',{name:'Emitter visible at current frame',exact:true});await visibility.uncheck();const hidden=await read();assert.equal(hidden.model.ParticleEmitters2[0].Visibility,0);assert.deepEqual(hidden.model.ParticleEmitters2[0].SegmentColor,placed.model.ParticleEmitters2[0].SegmentColor);
  await page.getByRole('button',{name:'Edit effect',exact:true}).click();assert.equal(await page.getByLabel('Effect ingredient',{exact:true}).inputValue(),String(id));await editor.getByRole('button',{name:'Remove',exact:true}).click();assert.equal((await read()).model.ParticleEmitters2.length,0);await editor.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).model.ParticleEmitters2,hidden.model.ParticleEmitters2);
  assert.deepEqual((await read()).model.Sequences,[]);assert.deepEqual(await fs.readFile(fixture),bytes);assert.deepEqual(errors,[]);console.log('Static model insertion, coordinate and pointer move, Attach/Detach, visibility, removal and undo passed.');
 }catch(error){if(app){const page=await app.firstWindow();console.error((await page.locator('body').innerText()).slice(-2200));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}
 finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(error=>{console.error(error);process.exit(1);});
