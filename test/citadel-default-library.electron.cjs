// Exercise the shipped shelf in Electron with a clean profile and demo model.
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),out=path.resolve('out/default-paint-library');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const {createDemoDocument}=await import('../src/editor-document.js');
  const fixture=path.join(out,'demo.mdx'),document=createDemoDocument();
  fs.copyFileSync(path.join(root,'public/paint-library/Skin/Human/Tan Human Skin.png'),path.join(out,'Skin.png'));
  document.model.Textures[0]={Image:'Skin.png',ReplaceableId:0,Flags:0};fs.writeFileSync(fixture,document.serialize('mdx'));
  const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
  try{
    const page=await app.firstWindow();page.setDefaultTimeout(20000);
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1280,920);w.showInactive();});
    await page.locator('[data-warmkey="paint"]').click();await page.getByRole('button',{name:'Begin painting',exact:true}).click();
    const collection=page.getByRole('button',{name:'Texture library',exact:true});
    await collection.waitFor();assert.equal(await collection.getAttribute('aria-pressed'),'true');
    await page.waitForFunction(()=>document.querySelectorAll('.paint-shelf-tile').length===31);
    const catalog=await page.evaluate(()=>window.desktop.listPaintTextures());assert.equal(catalog.items.length,31);
    await page.getByLabel('Texture folder',{exact:true}).selectOption('Hair');assert.equal(await page.locator('.paint-shelf-tile').count(),3);
    await page.getByLabel('Search your textures',{exact:true}).fill('Golden');assert.equal(await page.locator('.paint-shelf-tile').count(),1);
    const tile=page.getByRole('button',{name:'Golden Blonde Hair',exact:true});await tile.locator('img').waitFor();
    await page.waitForFunction(()=>document.querySelector('.paint-shelf-tile img')?.naturalWidth>0);await tile.click();
    await page.waitForFunction(()=>document.querySelector('.paint-shelf-tile')?.getAttribute('aria-pressed')==='true');
    assert.equal(await tile.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.studio-source-name').innerText(),'Golden Blonde Hair.png');
    await page.screenshot({path:path.join(out,'default-library.png')});
    await page.getByLabel('Search your textures',{exact:true}).fill('');await page.getByRole('button',{name:'5 starters',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.paint-shelf-tile').length===5);
    assert.equal(await page.locator('.paint-shelf-tile').count(),5);
    console.log('PASS: 31 shipped defaults open selected, folders/search/thumbnails/source selection work, native starters remain available.');
  }finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(error=>{console.error(error);process.exitCode=1;});
