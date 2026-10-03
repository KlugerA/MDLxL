const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const model=process.env.MDLXL_SPLINE_MODEL;if(!model)throw Error('Set MDLXL_SPLINE_MODEL to the private review fixture.');
  const source=fs.readFileSync(model),out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','spline-ui-'+Date.now()),copies=path.join(out,'copies');fs.mkdirSync(copies,{recursive:true});
  const {openDocument}=await import('../src/editor-document.js'),{sanityProposals,runOptimizeStage}=await import('../src/optimizexl.js');
  let expected=new Uint8Array(source);const passes=[];
  for(let i=0;i<10;i++){const fixes=sanityProposals(openDocument(expected,'x.mdx').model).filter(f=>!f.inspectionOnly);if(!fixes.length)break;
    expected=runOptimizeStage(expected,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes;passes.push({count:fixes.length,bytes:Buffer.from(expected)});
  }
  const exe=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[];
  const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),model],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
  try{
    const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
    const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow,dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}},copies);
    const stage=()=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Insanity FIxer',exact:true}).click();
    const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    const save=async(bytes)=>{const old=new Set(fs.readdirSync(copies));await p.getByRole('button',{name:'Optimize New Copy',exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelectorAll('header button')).some(b=>b.textContent==='Saving…'));
      const added=fs.readdirSync(copies).filter(n=>!old.has(n));assert.equal(added.length,2);assert.deepEqual(fs.readFileSync(path.join(copies,added.find(n=>n.includes('_Before')))),source);assert.deepEqual(fs.readFileSync(path.join(copies,added.find(n=>n.includes('_After')))),bytes);
    };
    await stage();await p.getByText('Hive: 0 errors · 0 severe · 0 warnings · 22 notices',{exact:true}).waitFor();
    assert.equal(await p.locator('.ox-fix-selection details[open]').count(),0);
    const before=await p.locator('[aria-label="Before preview"] h2').textContent();
    await p.screenshot({path:path.join(out,'01-original-findings.png')});
    let approved=source;
    for(let i=0;i<passes.length;i++){
      const list=p.locator('.ox-fix-selection');if(await list.locator('details').getAttribute('open')===null)await list.locator('summary').click();await list.getByRole('button',{name:'Select all',exact:true}).click();
      assert.equal(await list.locator('input:checked').count(),passes[i].count);
      await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();await ready();
      await save(approved);await p.screenshot({path:path.join(out,`02-preview-${i}.png`)});
      await p.getByRole('button',{name:'Approve selected',exact:true}).click();approved=passes[i].bytes;
      await stage();await p.waitForFunction(()=>Array.from(document.querySelectorAll('[role="status"]')).some(e=>e.textContent.startsWith('Hive:')));
      assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),before);
    }
    await p.getByText('Hive: 0 errors · 0 severe · 0 warnings · 0 notices',{exact:true}).waitFor();await save(approved);
    await p.getByLabel('Animation frame',{exact:true}).press('End');
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await p.screenshot({path:path.join(out,'03-clean-approved.png')});
    await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByText('Hive: 0 errors · 0 severe · 0 warnings · 3 notices',{exact:true}).waitFor();
    await p.screenshot({path:path.join(out,'04-back.png')});
    assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!exe,passes:passes.map(p=>p.count),approvedOnlySaves:true,beforePinned:true,backRestoresFindings:true,sourceUnchanged:true,errors,copies},null,2));console.log(out);
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
