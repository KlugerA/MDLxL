const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
  const root=process.cwd(),out=path.join(root,'out','particle-prototype');fs.mkdirSync(out,{recursive:true});
  const app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(root,'profile')},timeout:60000});
  const errors=[];
  try{
    const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1400,920);w.setPosition(-3000,0);w.showInactive();});
    await page.waitForFunction(()=>window.desktop&&document.querySelector('.classic-toolbar'));
    await page.evaluate(async()=>{const settings=await window.desktop.getSettings();await window.desktop.configure({preferences:{...settings.preferences,graphics:{...settings.preferences.graphics,pauseWhenHidden:false}}});});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('menu','particles'));
    await page.getByRole('dialog',{name:'Particle Editor',exact:true}).waitFor();
    console.log('opened');
    if(await page.getByRole('button',{name:'Close Particle Library',exact:true}).count())await page.getByRole('button',{name:'Close Particle Library',exact:true}).click();
    await page.waitForTimeout(2200);
    console.log('UI',await page.locator('.pe-window').innerText());
    await page.screenshot({path:path.join(out,'starter.png')});
    const state=await page.evaluate(()=>{
      const el=document.querySelector('.pe-preview .game-preview-root');let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
      for(;fiber;fiber=fiber.return)for(let hook=fiber.memoizedState;hook;hook=hook.next){const value=hook.memoizedState?.current;if(value?.native&&value?.controls)return {particles:value.native.particlesController.emitters.reduce((n,e)=>n+e.particles.length,0),frame:value.native.getFrame(),emitters:value.native.model.ParticleEmitters2.length};}
      return null;
    });
    console.log('runtime',state);console.log('stage',await page.locator('.pe-stage-tools').getAttribute('viewBox'));assert.ok(state?.particles>0,'Starter must have visible simulated particles');
    const slider=page.getByRole('slider',{name:'Size',exact:true});const bounds=await slider.boundingBox();
    await page.mouse.move(bounds.x+bounds.width*.3,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height/2,{steps:8});await page.mouse.up();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.pe-window').getByRole('button',{name:'Undo',exact:true}).isEnabled(),true);
    await page.getByRole('button',{name:'Save preset',exact:true}).click();
    await page.getByLabel('Preset name',{exact:true}).fill('Prototype test sparks');
    await page.getByRole('button',{name:'Save to My presets',exact:true}).click();
    await page.waitForTimeout(250);
    console.log('after save',await page.locator('.pe-window [role=status]').innerText());
    await page.screenshot({path:path.join(out,'edited.png')});
    console.log('errors',errors);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'runtime.json'),JSON.stringify({state,errors},null,2));
  } finally {await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(error=>{console.error(error);process.exit(1);});
