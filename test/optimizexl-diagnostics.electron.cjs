const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const model=process.env.MDLXL_DIAGNOSTICS_MODEL||'C:/Users/PC/Desktop/fINALS/WH_WOC_KnightKhorneAxe02.mdx',source=fs.readFileSync(model);
  const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','diagnostics-ui');fs.mkdirSync(out,{recursive:true});
  const exe=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[];
  const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),model],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
  try{
    const main=await app.firstWindow();await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
    const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}});
    const stage=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true}).click();
    await stage('Unused data');await p.locator('.ox-hive-unused').filter({hasText:'5 Hive unused notices remain'}).waitFor();
    assert.equal(await p.getByText('No unused data to remove.',{exact:true}).count(),0);await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.screenshot({path:path.join(out,'unused-routing.png')});
    await p.getByRole('button',{name:'Review Hive cleanup',exact:true}).click();
    await p.getByText('Hive: 0 errors · 0 severe · 0 warnings · 5 notices',{exact:true}).waitFor();
    await p.getByText('Checker findings (5)',{exact:true}).click();
    assert.equal(await p.getByRole('button',{name:'Preview fix',exact:true}).count(),5);
    await p.getByRole('button',{name:'Preview fix',exact:true}).first().click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    assert.equal(await p.getByLabel('Animation',{exact:true}).inputValue(),'12');
    const before=await p.locator('[aria-label="Before preview"] h2').textContent();
    await p.getByText('Checker findings (5)',{exact:true}).click();
    const list=p.locator('.ox-fix-selection');await list.locator('summary').click();await list.getByRole('button',{name:'Select all',exact:true}).click();
    assert.equal(await list.locator('input:checked').count(),4);
    await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    await p.screenshot({path:path.join(out,'five-key-preview.png')});await p.getByRole('button',{name:'Approve selected',exact:true}).click();
    await p.getByText('Hive: 0 errors · 0 severe · 0 warnings · 0 notices',{exact:true}).waitFor();assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),before);
    await p.screenshot({path:path.join(out,'hive-clean.png')});await stage('Unused data');await p.getByText('No Hive unused notices.',{exact:true}).waitFor();
    await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByText('Hive: 0 errors · 0 severe · 0 warnings · 5 notices',{exact:true}).waitFor();
    assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,allFiveNoticesRouted:true,zeroAfterApproval:true,backRestoresFindings:true,sourceUnchanged:true,errors},null,2));
    console.log('Passed unused routing, five direct repair links, combined cleanup, zero Hive result and Back.');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
