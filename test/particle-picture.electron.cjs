const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','picture-'+Date.now()),profile=path.join(out,'profile');await fs.mkdir(profile,{recursive:true});
 let app;const errors=[];
 try{
  app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1100,760);w.setPosition(-3000,0);w.showInactive();});
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).waitFor();
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();const editor=page.getByRole('dialog',{name:'Particle Editor',exact:true});
  await editor.getByRole('button',{name:'New',exact:true}).click();await page.getByRole('button',{name:'Soft sparks',exact:true}).click();await page.locator('.pe-library').waitFor({state:'hidden'});
  await editor.getByRole('button',{name:'Picture',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).click();
  const read=()=>page.evaluate(()=>{const el=document.querySelector('.pe-window');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState;if(v?.doc?.model&&v?.recipe)return {model:JSON.parse(JSON.stringify(v.doc.model)),undo:v.doc.historyStats.undoSteps};}throw Error('Lab missing');});
  const runtime=()=>page.evaluate(()=>{const el=document.querySelector('.pe-preview .game-preview-root');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState?.current;if(v?.native&&v?.controls){const p=v.native.particlesController.emitters[0];return {texture:p.props.TextureID,replaceable:p.props.ReplaceableId,images:v.native.model.Textures.map(t=>t.Image),count:p.particles.length};}}return null;});
  const original=await read();
  await page.locator('.pe-picture-actions').getByRole('button',{name:'Team color',exact:true}).click();
  await page.locator('.pe-picture-actions').getByRole('button',{name:'Team glow',exact:true}).click();
  assert.equal((await read()).model.Textures.length,3);
  await page.locator('.pe-picture-choices').getByRole('button',{name:'Picture 1',exact:true}).click();
  assert.equal((await read()).model.ParticleEmitters2[0].ReplaceableId,0);
  await page.waitForFunction(()=>!document.querySelector('.pe-window .re-status')?.textContent.includes('Updating effect'));
  assert.equal((await runtime()).replaceable,0,'Switching from team glow clears the live override');
  await page.locator('.pe-picture-choices').getByRole('button',{name:'Team color',exact:true}).click();
  await page.getByRole('button',{name:'Remove team color picture',exact:true}).click();
  assert.equal((await read()).model.Textures.length,2);assert.equal((await read()).model.ParticleEmitters2[0].ReplaceableId,0);
  await editor.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).model.Textures.length,3);
  await page.getByRole('button',{name:'Remove team color picture',exact:true}).click();await page.getByRole('button',{name:'Remove team glow picture',exact:true}).click();
  assert.deepEqual((await read()).model,original.model,'Both added team pictures are removable');
  await page.getByRole('button',{name:'Library…',exact:true}).click();const library=page.getByRole('dialog',{name:'Material and Texture Library',exact:true});await library.waitFor();
  await page.getByLabel('Search textures',{exact:true}).fill('GenericGlow64');
  const tile=page.locator('.tl-tile').filter({hasText:/GenericGlow64/i}).first();await tile.waitFor({timeout:60000});await tile.click();
  const use=page.getByRole('button',{name:'Use picture',exact:true});await use.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.tl-actions button')].some(b=>b.textContent==='Use picture'&&!b.disabled),null,{timeout:60000});
  await page.screenshot({path:path.join(out,'library.png')});await use.click();await library.waitFor({state:'hidden'});
  const imported=await read(),picture=imported.model.Textures.at(-1);assert.match(picture.Image,/MDLxL_Forge\\Particle_[a-f0-9]{32}\.(blp|dds|tga)$/);assert.equal(imported.model.ParticleEmitters2[0].ReplaceableId,0);assert.equal(imported.model.ParticleEmitters2[0].TextureID,1);
  await page.waitForFunction(()=>!document.querySelector('.pe-window .re-status')?.textContent.includes('Updating effect'));
  assert.equal((await runtime()).images[1],picture.Image);assert.ok((await runtime()).count>0);
  await page.screenshot({path:path.join(out,'picture.png')});
  await editor.getByRole('button',{name:'Save preset',exact:true}).click();await page.getByLabel('Preset name',{exact:true}).fill('Library picture proof');await page.getByRole('button',{name:'Save to My presets',exact:true}).click();await page.getByText('Saved Library picture proof',{exact:true}).waitFor();
  const names=await fs.readdir(path.join(profile,'particles','mine'));const saved=JSON.parse(await fs.readFile(path.join(profile,'particles','mine',names.find(n=>n.endsWith('.json'))),'utf8'));assert.equal(saved.embeddedAssets.length,1);assert.equal(saved.embeddedAssets[0].path,picture.Image);assert.ok(saved.embeddedAssets[0].data.length>0);
  await editor.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).model,original.model,'One undo removes the library picture and reference together');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,out,checks:'Actual CASC texture library import, portable picture, native preview, team color/glow removal, switching back and undo'}));
 }catch(error){if(app){const page=await app.firstWindow();console.error((await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}
 finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(error=>{console.error(error);process.exit(1);});
