const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','ribbon-fit-'+Date.now());await fs.mkdir(out,{recursive:true});
 const {CascReader}=require('../electron/casc.cjs'),reader=new CascReader('D:/Warcraft III',root);let bytes;
 try{bytes=await reader.read('war3.w3mod:units\\orc\\heroblademaster\\heroblademaster.mdx');}finally{reader.close();}
 const fixture=path.join(out,'Blademaster.mdx');await fs.writeFile(fixture,bytes);
 const {openDocument}=await import('../src/editor-document.js'),{fitRibbonToPolygons}=await import('../src/particle-ribbon-fit.js'),{Vector3,Matrix4}=await import('three');
 const original=openDocument(bytes,fixture).model,selection={3:[11,12,9,13,14]},expected=fitRibbonToPolygons(original,selection);assert.equal(expected.polygons,3);assert.equal(expected.parent,7);
 let app;const errors=[];
 try{
  app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1400,920);w.setPosition(-3000,0);w.showInactive();});
  await page.getByText('Opened Blademaster.mdx',{exact:true}).waitFor();
  await page.locator('.classic-geosets').getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByLabel('Select geoset 3',{exact:true}).check();await page.getByLabel('Show all geosets',{exact:true}).uncheck();
  await page.getByLabel('View direction',{exact:true}).selectOption('top');
  await page.locator('.viewport').click({position:{x:30,y:120}});await page.keyboard.press('Control+A');await page.getByRole('button',{name:'Fit selection',exact:true}).click();
  // Use the native camera only to locate triangle centers; real Shift-clicks own selection.
  await page.waitForTimeout(150);
  const centers=await page.evaluate(points=>{let el=document.querySelector('.viewport'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const state=h.memoizedState?.current;if(state?.renderer&&state?.camera){const rect=state.renderer.domElement.getBoundingClientRect();return points.map(point=>{const v=state.camera.position.clone().set(...point).project(state.camera);return {x:rect.x+(v.x+1)*rect.width/2,y:rect.y+(1-v.y)*rect.height/2};});}}throw Error('Camera missing');},[8,9,10].map(face=>{const g=original.Geosets[3],ids=Array.from(g.Faces.slice(face*3,face*3+3));return [0,1,2].map(axis=>ids.reduce((sum,id)=>sum+g.Vertices[id*3+axis],0)/3);}));
  for(let i=0;i<centers.length;i++){if(i)await page.keyboard.down('Shift');await page.mouse.click(centers[i].x,centers[i].y);if(i)await page.keyboard.up('Shift');}
  await page.screenshot({path:path.join(out,'marked-polygons.png')});
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();const editor=page.getByRole('dialog',{name:'Particle Editor',exact:true});
  await page.getByRole('button',{name:'Ribbon from polygons',exact:true}).click();
  assert.equal(await page.getByLabel('Attach effect to',{exact:true}).inputValue(),'7');assert.equal(await page.getByRole('button',{name:'Add ribbon',exact:true}).isDisabled(),true);
  await page.getByLabel('Placement animation',{exact:true}).selectOption('2');await page.getByLabel('Effect end',{exact:true}).fill('15300');
  await page.getByRole('button',{name:'Pause ghost',exact:true}).click();
  const seek=async(label,time)=>{await page.getByLabel(label,{exact:true}).evaluate((el,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},time);};
  await seek('Placement playhead',14900);await page.getByLabel('Fitted weapon edge',{exact:true}).waitFor();await page.screenshot({path:path.join(out,'ghost.png')});
  const read=()=>page.evaluate(()=>{let el=document.querySelector('.pe-window'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return){const doc=f.memoizedProps?.doc;if(doc?.model)return {model:JSON.parse(JSON.stringify(doc.model)),undo:doc.historyStats.undoSteps};}throw Error('Model missing');});
  const before=await read();await page.getByRole('button',{name:'Add ribbon',exact:true}).click();await page.getByText('Ribbon added. Drag its two ends to adjust the edge.',{exact:true}).waitFor();
  const added=await read(),r=added.model.RibbonEmitters.at(-1);assert.equal(added.model.Helpers.find(n=>n.ObjectId===r.Parent).Parent,7);assert.equal(added.undo,before.undo+1);assert.deepEqual(added.model.Geosets,before.model.Geosets);assert.deepEqual(added.model.Bones,before.model.Bones);assert.deepEqual(added.model.Sequences,before.model.Sequences);
  await page.getByRole('button',{name:'Pause',exact:true}).click();await seek('Particle preview playhead',14900);
  const runtime=()=>page.evaluate(id=>{let el=document.querySelector('.pe-preview .game-preview-root'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState?.current;if(v?.native&&v?.controls){const n=v.native,r=n.ribbonsController.emitters.find(e=>e.props.ObjectId===id);return {frame:n.getFrame(),ribbon:Array.from(n.rendererData.nodes[id].matrix),parent:Array.from(n.rendererData.nodes[7].matrix),segments:r.creationTimes.length};}}return null;},r.ObjectId);
  await page.waitForFunction(()=>!document.querySelector('.pe-window .re-status')?.textContent.includes('Updating effect'));
  for(const time of [14500,14900,15150]){await seek('Particle preview playhead',time);await page.waitForTimeout(250);const state=await runtime();assert.equal(state.frame,time);const matrix=new Matrix4().fromArray(state.ribbon),parent=new Matrix4().fromArray(state.parent),pivot=Object.values(r.PivotPoint);for(let i=0;i<2;i++){const actual=new Vector3(...pivot).add(new Vector3(0,i?r.HeightAbove:-r.HeightBelow,0)).applyMatrix4(matrix),want=new Vector3(...expected.endpoints[i]).applyMatrix4(parent);assert.ok(actual.distanceTo(want)<.0002,'Native ribbon stays fitted to the moving sword');}assert.ok(state.segments>0);}
  await seek('Particle preview playhead',14800);await page.waitForTimeout(350);
  await page.getByRole('button',{name:'Fit view',exact:true}).click();await page.screenshot({path:path.join(out,'sword-ribbon.png')});
  const handle=page.getByRole('slider',{name:'Ribbon upper edge',exact:true}),box=await handle.locator('circle').boundingBox();await page.mouse.move(box.x+7,box.y+7);await page.mouse.down();await page.mouse.move(box.x+37,box.y-18,{steps:5});await page.mouse.up();
  const changed=await read();assert.notEqual(changed.model.RibbonEmitters.at(-1).HeightAbove,r.HeightAbove);assert.equal(changed.undo,added.undo+1);assert.deepEqual(changed.model.Geosets,added.model.Geosets);
  await editor.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).model,added.model);await editor.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).model,before.model);
  await editor.getByRole('button',{name:'New',exact:true}).click();await page.getByRole('button',{name:'Ribbon trail',exact:true}).click();await page.getByRole('button',{name:'Preview swing',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Preview swing',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Pause',exact:true}).click();await seek('Particle preview playhead',1000);await page.waitForTimeout(350);
  const lab=()=>page.evaluate(()=>{let el=document.querySelector('.pe-window'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const value=h.memoizedState;if(value?.recipe&&value?.doc)return JSON.parse(JSON.stringify(value.doc.model));}throw Error('Lab missing');});
  const newRibbon=await lab();assert.equal(newRibbon.Helpers.length,0);assert.equal(newRibbon.Materials[0].Layers[0].FilterMode,4);assert.equal(newRibbon.RibbonEmitters[0].Translation,undefined);
  const guideError=await page.evaluate(()=>{let el=document.querySelector('.pe-preview .game-preview-root'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const state=h.memoizedState?.current;if(state?.native&&state.controls){const n=state.native,r=n.model.RibbonEmitters[0],camera=state.controls.object,point=state.controls.target.clone().set(r.PivotPoint[0],r.PivotPoint[1]+r.HeightAbove,r.PivotPoint[2]).applyMatrix4(camera.matrixWorld.clone().fromArray(n.rendererData.nodes[r.ObjectId].matrix)).project(camera),canvas=el.querySelector('[data-clean-model-canvas]'),handle=document.querySelector('[aria-label="Ribbon upper edge"] circle');return Math.hypot(Number(handle.getAttribute('cx'))-(point.x+1)*canvas.clientWidth/2,Number(handle.getAttribute('cy'))-(1-point.y)*canvas.clientHeight/2);}}throw Error('Native guide missing');});
  assert.ok(guideError<2,'Paused ribbon handles match the fitted camera and current native pose; error '+guideError);
  await page.screenshot({path:path.join(out,'new-ribbon.png')});await page.getByRole('button',{name:'Preview swing',exact:true}).click();assert.deepEqual(await lab(),newRibbon,'Preview swing never becomes authored weapon motion');assert.deepEqual((await read()).model,before.model);
  assert.deepEqual(await fs.readFile(fixture),bytes);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,out,polygons:3,bone:'Sword',length:expected.length,checks:'Native moving ribbon, chosen window, edge pointer edit, one undo, unchanged weapon and source'}));
 }catch(error){if(app){const page=await app.firstWindow();console.error((await page.locator('body').innerText()).slice(-1900));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}
 finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(error=>{console.error(error);process.exit(1);});
