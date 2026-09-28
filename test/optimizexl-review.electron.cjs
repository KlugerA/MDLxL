const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {openDocument}=await import('../src/editor-document.js'),{skinGeoset,allNodes}=await import('../src/animation.js');
 const {protectedGeosetData}=await import('../src/optimizexl-exclusions.js');
 const {Matrix4}=await import('three'),{ModelRenderer}=await import('war3-model');
 const {findIrregularities,runOptimizeStage}=await import('../src/optimizexl.js');
 const file=process.env.MDLXL_OPTIMIZEXL_REVIEW_MODEL||'C:/Users/PC/Desktop/WH_WOC_KnightKhorneFlail03.mdx',source=fs.readFileSync(file),model=openDocument(new Uint8Array(source),'review.mdx').model;
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','optimizexl-guidance-proof'),profile=path.join(out,'profile-'+Date.now());fs.mkdirSync(profile,{recursive:true});
 fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({preferences:{viewportAppearance:{geosetHighlight:{color:'#ff9900',type:'fill',viaView:true,viaSelection:true}}}}));
 const errors=[],packaged=process.env.MDLXL_OPTIMIZEXL_EXE;
 const app=await _electron.launch({executablePath:packaged||path.resolve('node_modules/electron/dist/electron.exe'),args:packaged?[file]:[process.cwd(),file],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
 try{
  const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}});
  const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong')&&!document.querySelector('.ox-savings').textContent.includes('Updating'));
  await p.getByLabel('Animation',{exact:true}).selectOption({label:'Stand'});await p.getByLabel('Animation frame',{exact:true}).fill('2000');
  await p.getByLabel('Strength',{exact:true}).fill('40');await ready();
  await p.evaluate(()=>{window.reviewState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
   let r,props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.native&&c?.controls)r=c;if(c?.model?.Geosets&&c?.compareCamera)props=c;}
   if(!r||!props)return null;return {frame:r.native.getFrame(),sequence:r.native.getSequence(),globalTime:props.playbackGlobalTime,hovered:props.hoveredGeoset,matrices:r.native.rendererData.nodes.map(n=>n?.matrix?Array.from(n.matrix):null)};
  });});
  const details=p.locator('.ox-review');assert.equal(await details.getAttribute('open'),null,'Review details start collapsed');await details.locator('summary').click();
  const rows=details.locator('.ox-review-row');assert.equal(await rows.count(),10);assert.equal(await rows.first().textContent(),'Geoset 18');
  assert.ok((await rows.allTextContents()).every(s=>/^Geoset \d+$/.test(s)),'Duplicate review lists only geosets');assert.equal(await details.getByRole('button').count(),0);
  await rows.first().hover();await p.waitForFunction(()=>reviewState().every(s=>s?.hovered===17)&&document.querySelectorAll('[data-geoset-overlay]').length===2);
  assert.ok(await p.locator('[data-geoset-overlay]').evaluateAll(canvases=>canvases.every(c=>{const ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height).data;return ctx.fillStyle==='#ff9900'&&d.some((v,i)=>i%4===3&&v>0);})));await p.screenshot({path:path.join(out,'01-duplicate-guidance-hover.png')});
  await details.locator('summary').click();await p.waitForFunction(()=>reviewState().every(s=>s?.sequence===1&&s.frame===2000));await p.getByRole('heading',{name:'OptimizeXL',exact:true}).hover();
  await p.getByRole('button',{name:'Animation optimization',exact:true}).click();await p.getByLabel('Strength',{exact:true}).fill('40');await ready();await details.locator('summary').click();
  assert.equal(await rows.count(),0);assert.deepEqual(await details.getByRole('button').allTextContents(),['10 changes to animation Attack - 1','19 changes to animation Death','6 changes to animation Attack - Slam','1 change to animation Dissipate','1 change to animation Attack - 2']);
  await details.getByRole('button',{name:'6 changes to animation Attack - Slam',exact:true}).click();await p.waitForFunction(()=>reviewState().every(s=>s?.sequence===9&&s.frame===171063));await p.screenshot({path:path.join(out,'02-animation-guidance.png')});
  await details.locator('summary').click();await p.waitForFunction(()=>reviewState().every(s=>s?.sequence===1&&s.frame===2000));await details.locator('summary').click();await details.getByRole('button',{name:'6 changes to animation Attack - Slam',exact:true}).click();
  await p.getByRole('button',{name:'Unused data',exact:true}).click();await ready();await p.waitForFunction(()=>reviewState().every(s=>s?.sequence===1&&s.frame===2000));await details.locator('summary').click();assert.deepEqual(await rows.allTextContents(),['Helper: Axe','Global sequence 2']);await p.screenshot({path:path.join(out,'05-unused-data.png')});
  await p.getByRole('button',{name:'Advanced',exact:true}).click();await p.getByLabel('Unused materials, textures and globals',{exact:true}).uncheck();await p.getByLabel('Unused bones and helpers',{exact:true}).uncheck();await p.getByText('No unused data to remove.',{exact:true}).waitFor();await p.getByRole('button',{name:'Simple',exact:true}).click();
  await p.getByRole('button',{name:'Irregularities Fixer',exact:true}).click();await p.waitForFunction(()=>reviewState().every(s=>s?.sequence===1&&s.frame===2000));assert.equal(await details.count(),0);
  const proposals=p.getByLabel('Proposed fix',{exact:true}),options=await proposals.locator('option').allTextContents();assert.equal(options.filter(s=>s.includes('Slam')).length,1);assert.ok(options.some(s=>s==='Attack - Slam: match common first/last pose'));
  await proposals.selectOption('common-pose:9');await ready();assert.match(await p.locator('.ox-controls').textContent(),/Attack - 1, Death, Stand Ready, Attack - 2 agree/);
  const positions=(state,geosets=model.Geosets)=>{const matrices=new Map(state.matrices.flatMap((m,i)=>m?[[i,new Matrix4().fromArray(m)]]:[]));return geosets.flatMap(g=>Array.from(skinGeoset(g,matrices)));};
  const difference=(a,b)=>a.reduce((max,v,i)=>Math.max(max,Math.abs(v-b[i])),0);
  await p.getByRole('button',{name:'Start',exact:true}).click();await p.waitForFunction(()=>reviewState().every(s=>s?.sequence===9&&s.frame===170000));const start=await p.evaluate(()=>reviewState());await p.screenshot({path:path.join(out,'03-common-pose-first.png')});
  await p.getByRole('button',{name:'End',exact:true}).click();await p.waitForFunction(()=>reviewState().every(s=>s?.sequence===9&&s.frame===171437));const end=await p.evaluate(()=>reviewState());await p.screenshot({path:path.join(out,'04-common-pose-last.png')});
  // Global sequences keep their independent clock during local seeks. Compare
  // the full posed model against the reference at that same global time.
  const globalNodes=new Set(allNodes(model).filter(n=>['Translation','Rotation','Scaling'].some(k=>n[k]?.Keys&&n[k].GlobalSeqId!=null&&n[k].GlobalSeqId!==-1&&n[k].GlobalSeqId!==0xffffffff)).map(n=>n.ObjectId));
  const localGeosets=model.Geosets.filter((g,i)=>![...protectedGeosetData(model,{excludedGeosets:[i]}).nodes].some(n=>globalNodes.has(n)));
  const startAfter=positions(start[1]),endAfter=positions(end[1]),endpointDifference=difference(positions(start[1],localGeosets),positions(end[1],localGeosets));assert.ok(endpointDifference<1e-5,`Both corrected local endpoint poses must agree: ${endpointDifference}`);assert.ok(difference(positions(start[0]),startAfter)>1,'The wrong pose really changes');
  const reference=new ModelRenderer(structuredClone(model));reference.setSequence(3);reference.setFrame(21567);reference.updateNode(reference.rendererData.rootNode);
  const referencePose=frame=>{model.GlobalSequences.forEach((duration,i)=>reference.rendererData.globalSequencesFrames[i]=frame%duration);reference.updateNode(reference.rendererData.rootNode);return positions({matrices:reference.rendererData.nodes.map(n=>n?.matrix?Array.from(n.matrix):null)});};
  const referenceDifference=Math.max(difference(startAfter,referencePose(start[1].globalTime)),difference(endAfter,referencePose(end[1].globalTime)));assert.ok(referenceDifference<1e-5,`Both full native poses must match the common reference with the same global clock: ${referenceDifference}`);
  const fix=findIrregularities(model).find(f=>f.kind==='commonPose'&&f.sequence===9),after=openDocument(runOptimizeStage(new Uint8Array(source),'irregularities',{},fix).bytes,'after.mdx').model;
  for(let i=0;i<model.Bones.length;i++)for(const key of ['Translation','Rotation','Scaling'])if(model.Bones[i][key]?.Keys)assert.deepEqual(after.Bones[i][key].Keys.filter(k=>k.Frame!==170000&&k.Frame!==171437),model.Bones[i][key].Keys.filter(k=>k.Frame!==170000&&k.Frame!==171437));
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelectorAll('[aria-label="Proposed fix"] option')).some(o=>o.value==='common-pose:9'));
  await p.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await proposals.inputValue(),'common-pose:9');await ready();
  assert.deepEqual(errors,[]);assert.deepEqual(fs.readFileSync(file),source);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!packaged,duplicateReportGeosets:10,animationReportRows:5,animationChanges:37,unusedItems:['Helper: Axe','Global sequence 2'],disabledUnusedOptionsClearReport:true,sharedAppearanceHover:true,reportNavigationRestored:true,pairedEndpointDifference:endpointDifference,referencePoseDifference:referenceDifference,interiorKeysUnchanged:true,sourceUnchanged:true,errors},null,2));
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
