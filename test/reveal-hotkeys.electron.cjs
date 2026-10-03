// Build dist first; all models and preferences belong to an isolated test profile.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'out/reveal'),{recursive:true});
const output=fs.mkdtempSync(path.join(root,'out/reveal/workflow-')),entry=path.join(output,'main.cjs'),profile=path.join(output,'profile');
fs.writeFileSync(entry,`const {app}=require('electron');app.getAppPath=()=>${JSON.stringify(root)};const {GameDataDiscovery}=require(${JSON.stringify(path.join(root,'electron/game-data.cjs'))});GameDataDiscovery.prototype.discover=async()=>({folders:[],archives:[],cascFolders:[]});require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`);
let app,page;const errors=[],checks=[];
const command=action=>app.evaluate(({BrowserWindow},id)=>BrowserWindow.getAllWindows()[0].webContents.send('menu',id),action);
const close=async()=>{if(app){await app.evaluate(({BrowserWindow})=>{for(const window of BrowserWindow.getAllWindows())window.destroy();});await app.close();app=null;}};
async function launch(fixture){
 app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',entry,fixture],cwd:root,env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
 page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1280,900);w.setPosition(-3000,0);w.showInactive();w.webContents.setBackgroundThrottling(false);});
 await page.waitForFunction(()=>!!document.querySelector('[data-warmkey="select"] > .warmkey-badge'));
}
async function placementMatches(placement){await page.waitForFunction(value=>{
 const control=document.querySelector('[data-warmkey="select"]'),b=control.querySelector('.warmkey-badge').getBoundingClientRect(),i=control.querySelector('img,.modern-retro-icon').getBoundingClientRect();
 return document.documentElement.dataset.hotkeyPlacement===value&&({above:b.bottom<=i.top,below:b.top>=i.bottom,left:b.right<=i.left,right:b.left>=i.right})[value];
},placement);}
const shot=name=>page.screenshot({path:path.join(output,name+'.png')});
(async()=>{
 const {createDemoDocument}=await import('../src/editor-document.js'),{normalizePreferences}=await import('../src/preferences.js');
 const fixture=path.join(output,'demo.mdx');fs.writeFileSync(fixture,createDemoDocument().serialize('mdx'));fs.mkdirSync(profile,{recursive:true});
 fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({preferences:normalizePreferences({hotkeys:{select:['Ctrl+1'],translate:['Ctrl+Alt+1','M'],about:['Ctrl+2'],'smoke:direct':['Ctrl+4'],'smoke:menu':['Ctrl+5'],'smoke:long':['Ctrl+Alt+6'],'smoke:field':['Ctrl+7'],'smoke:disabled':['Ctrl+8']}})}));
 await launch(fixture);let rvl=page.locator('[data-warmkey="revealHotkeys"]');
 assert.equal(await rvl.getAttribute('aria-pressed'),'false');assert.equal(await rvl.evaluate(e=>e.previousElementSibling.dataset.warmkey),'pressedKeys');assert.equal(await rvl.locator('img').evaluate(e=>e.naturalWidth),64);
 assert.equal(await page.locator('[data-warmkey="select"] > .warmkey-badge').isVisible(),false);await shot('01-off');await rvl.click();await placementMatches('below');
 assert.equal(await page.locator('[data-warmkey="select"] > .warmkey-badge').textContent(),'Ctrl+1');assert.equal(await page.locator('[data-warmkey="translate"] > .warmkey-badge').textContent(),'M');
 assert.equal(await page.locator('.toolbar-modules .warmkey-badge').count(),0);assert.equal(await page.locator('[data-warmkey="new"] > .warmkey-badge').count(),0);
 const audit=await page.evaluate(()=>{
  const badges=[...document.querySelectorAll('.warmkey-badge')].filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility==='visible');
  const bad=badges.filter(b=>b.textContent.includes('>')||b.textContent.split('+').length>2||getComputedStyle(b).position!=='static'||getComputedStyle(b).color!=='rgb(57, 255, 20)');
  const overlaps=badges.flatMap((a,i)=>badges.slice(i+1).filter(b=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;}).map(b=>[a.textContent,b.textContent]));return {count:badges.length,bad:bad.map(b=>b.textContent),overlaps};
 });
 assert.ok(audit.count>5&&audit.count<30);assert.deepEqual(audit.bad,[]);assert.deepEqual(audit.overlaps,[]);await shot('02-workflow-below');checks.push(`${audit.count} workflow hints; no sequences, long chords, menu labels or overlapping badges`);
 await page.evaluate(()=>{const host=document.createElement('div');host.id='reveal-smoke';host.style='position:fixed;left:400px;top:300px;z-index:3000;background:white;padding:20px';host.innerHTML='<button data-warmkey="smoke:direct">Direct</button><button role="menuitem" data-warmkey="smoke:menu">Menu</button><button data-warmkey="smoke:long">Long</button><button data-warmkey="smoke:disabled" disabled>Disabled</button><label>Field<input data-warmkey="smoke:field" type="number" value="1"></label><button data-warmkey="smoke:generated">Generated</button>';document.querySelector('.warmkeys-root').appendChild(host);});
 await page.waitForFunction(()=>document.querySelector('#reveal-smoke .warmkey-field-badge')?.textContent==='Ctrl+7');assert.equal(await page.locator('#reveal-smoke .warmkey-badge').count(),2);await page.locator('#reveal-smoke').evaluate(e=>e.remove());checks.push('new controls respect enabled-state and workflow limits');
 await command('appearanceSettings');await page.getByLabel('Hotkey font size',{exact:true}).fill('14');await page.getByLabel('Hotkey color',{exact:true}).evaluate(e=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'#cc44aa');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-warmkey="select"] > .warmkey-badge')).color==='rgb(204, 68, 170)');
 for(const place of ['above','left','right','below']){await page.getByLabel('Hotkey placement',{exact:true}).selectOption(place);await placementMatches(place);}
 assert.equal(await page.locator('.settings-window .warmkey-badge').count(),0);await shot('03-appearance');await page.getByRole('button',{name:'Done',exact:true}).click();
 assert.equal(await page.locator('[data-warmkey="select"] > .warmkey-badge').evaluate(e=>getComputedStyle(e).fontSize),'14px');await shot('04-custom-below');checks.push('Appearance color/font and all four placements apply immediately');
 await rvl.click();await page.locator('[data-warmkey="paint"]').click();await page.getByRole('button',{name:'New base coat',exact:false}).click();await page.getByRole('button',{name:'Begin painting',exact:true}).click();
 await page.waitForFunction(()=>!!document.querySelector('.paint-studio .paint-key'));assert.equal(await page.locator('.paint-studio .paint-key').first().isVisible(),false);await rvl.click();await page.waitForFunction(()=>!!document.querySelector('.paint-key[data-rvl-key=true]'));
 assert.equal(await page.getByRole('button',{name:'Help',exact:true}).locator('.paint-key').isVisible(),false);assert.equal(await page.getByRole('button',{name:'From file…',exact:true}).locator('.paint-key').isVisible(),false);
 assert.equal(await page.locator('.paint-key[data-rvl-key=true]').first().evaluate(e=>getComputedStyle(e).fontSize),'14px');await shot('05-paint');
 await rvl.click();const outlines=page.getByRole('button',{name:'Outlines',exact:true}),previous=await outlines.getAttribute('aria-pressed');await page.keyboard.press('O');
 await page.waitForFunction(value=>document.querySelector('[aria-label="Outlines"]').getAttribute('aria-pressed')!==value,previous);checks.push('Paint follows the same appearance/limits; hotkey actions work with RVL off');
 await page.locator('[data-warmkey="vertices"]').click();await page.getByLabel('3D model viewport',{exact:true}).focus();await page.keyboard.press('Control+A');await page.waitForFunction(()=>!document.querySelector('[data-warmkey="uv"]').disabled);await rvl.click();
 const opened=app.waitForEvent('window');await page.locator('[data-warmkey="uv"]').first().click();const uv=await opened;await uv.waitForFunction(()=>document.documentElement.dataset.revealHotkeys==='true'&&!!document.querySelector('.warmkey-badge'));
 assert.equal(await uv.locator('.warmkey-badge').first().evaluate(e=>getComputedStyle(e).color),'rgb(204, 68, 170)');assert.equal(await uv.locator('.warmkey-badge').first().evaluate(e=>getComputedStyle(e).fontSize),'14px');checks.push('detached UV inherits label appearance');
 await close();await launch(fixture);rvl=page.locator('[data-warmkey="revealHotkeys"]');assert.equal(await rvl.getAttribute('aria-pressed'),'false');await rvl.click();await placementMatches('below');
 assert.equal(await page.locator('[data-warmkey="select"] > .warmkey-badge').evaluate(e=>getComputedStyle(e).color),'rgb(204, 68, 170)');assert.equal(await page.locator('[data-warmkey="select"] > .warmkey-badge').evaluate(e=>getComputedStyle(e).fontSize),'14px');checks.push('appearance survives restart; RVL still starts off');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({output,checks,errors},null,2));
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),timeout:5000}).catch(()=>{});process.exitCode=1;}).finally(close);
