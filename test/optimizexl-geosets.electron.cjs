const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {openDocument}=await import('../src/editor-document.js');
 const {runOptimizeStage,simpleSettings}=await import('../src/optimizexl.js');
 const {prepareNuclearReduction}=await import('../src/optimizexl-geometry.js');await prepareNuclearReduction();
 const {skinGeoset,sampleGeosetAnimation}=await import('../src/animation.js');
 const {projectPreviewGeosets,pickPreviewGeoset}=await import('../app/preview-selection.js');
 const {OrthographicCamera,Matrix4}=await import('three');
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','optimizexl-geosets-proof'),run=path.join(out,'run-'+Date.now()),profile=path.join(run,'profile');fs.mkdirSync(profile,{recursive:true});
 const preferences={wheelMode:'scroll',viewportAppearance:{geosetHighlight:{color:'#ff00ff',type:'fill',viaView:true,viaSelection:true}}};fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({preferences}));
 const file=process.env.MDLXL_OPTIMIZEXL_MODEL||'C:/Users/PC/Documents/ChatGPT/MDLxL/out/Khorne_Optimized_Review/WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx';
 const source=fs.readFileSync(file),model=openDocument(new Uint8Array(source),'fixture.mdx').model,errors=[],packaged=process.env.MDLXL_OPTIMIZEXL_EXE;
 const expected=runOptimizeStage(new Uint8Array(source),'nuclear',simpleSettings('nuclear',100,model)),reduced=openDocument(expected.bytes,'after.mdx').model;
 const chosen=model.Geosets.findIndex((g,i)=>g.Faces.length>reduced.Geosets[i].Faces.length&&sampleGeosetAnimation(model,i,1667,1,0).alpha>.001);assert.ok(chosen>=0);
 const app=await _electron.launch({executablePath:packaged||path.resolve('node_modules/electron/dist/electron.exe'),args:packaged?[file]:[process.cwd(),file],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
 try{
  const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}});
  const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong')&&!document.querySelector('.ox-savings').textContent.includes('Updating'));
  await p.getByLabel('Animation',{exact:true}).selectOption({label:'Stand'});await ready();
  await p.evaluate(()=>{window.oxState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
   let props,runtime;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const r=h.memoizedState?.current;if(r?.native&&r?.controls)runtime=r;if(r?.model?.Geosets&&r?.compareCamera)props=r;}
   if(!runtime||!props)throw Error('Preview not ready');const cam=runtime.controls.object;
   return {counts:props.model.Geosets.map(g=>[g.Vertices.length,g.Faces.length]),geosets:JSON.stringify(props.model.Geosets,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v),hidden:Array.from(props.hiddenGeosets||[]),hovered:props.hoveredGeoset,frame:runtime.native.getFrame(),position:cam.position.toArray(),projection:cam.projectionMatrix.toArray(),worldInverse:cam.matrixWorldInverse.toArray(),matrices:(runtime.native.rendererData?.nodes||[]).map(n=>n?.matrix?Array.from(n.matrix):null)};
  });});
  const nav=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true});
  const star=async(name,exists)=>{await p.locator('nav[aria-label="Optimization stages"][aria-busy="false"]').waitFor();assert.equal(await nav(name).locator('.ox-stage-star').count(),exists?1:0,name+' star');};
  const box=p.locator('.ox-geosets'),selected=()=>box.getByRole('checkbox',{checked:true}).count();
  const exclude=i=>p.getByLabel(`Exclude geoset ${i+1}`,{exact:true});
  await nav('Nuclear Polygon Destroyer').click();await ready();await star('Nuclear Polygon Destroyer',true);
  assert.equal(await p.getByRole('listbox',{name:'Excluded geosets',exact:true}).count(),1);assert.equal(await selected(),1,'Only Highlight is initially checked');
  assert.ok(await box.getByRole('listbox').evaluate(el=>el.clientHeight<=140),'Keep the picker compact and scroll its rows');
  await exclude(1).check();await exclude(4).click({modifiers:['Shift']});for(let i=1;i<=4;i++)assert.equal(await exclude(i).isChecked(),true);assert.equal(await exclude(0).isChecked(),false);
  await box.getByRole('button',{name:'Invert',exact:true}).click();assert.equal(await selected(),model.Geosets.length-4+1);await box.getByRole('button',{name:'Clear',exact:true}).click();
  await p.getByLabel('Strength',{exact:true}).fill('100');await ready();await star('Nuclear Polygon Destroyer',true);
  let state=await p.evaluate(()=>oxState());assert.deepEqual(state[1].counts,reduced.Geosets.map(g=>[g.Vertices.length,g.Faces.length]));
  await exclude(chosen).check();await p.waitForFunction(i=>oxState()[1].counts[i][1]===oxState()[0].counts[i][1],chosen);await ready();state=await p.evaluate(()=>oxState());
  assert.deepEqual(state[1].counts[chosen],state[0].counts[chosen]);assert.deepEqual(state[0].hidden,[]);assert.deepEqual(state[1].hidden,[]);
  const serialize=g=>JSON.stringify(g,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v);assert.equal(JSON.stringify(JSON.parse(state[1].geosets)[chosen]),serialize(model.Geosets[chosen]));
  assert.ok(state[1].counts.some((g,i)=>i!==chosen&&g[1]<state[0].counts[i][1]),'Other geosets still reduce');
  const preview=p.getByLabel('Before preview',{exact:true}),bounds=await preview.boundingBox();await p.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await p.mouse.wheel(0,-400);await p.waitForTimeout(200);
  await exclude(chosen).hover();await p.waitForFunction(()=>document.querySelectorAll('[data-geoset-overlay]').length===2);
  const overlays=await p.locator('[data-geoset-overlay]').evaluateAll(canvases=>canvases.map(c=>{const ctx=c.getContext('2d'),data=ctx.getImageData(0,0,c.width,c.height).data;let colored=0;for(let i=0;i<data.length;i+=4)if(data[i]>240&&data[i+1]<15&&data[i+2]>240&&data[i+3]>100&&data[i+3]<200)colored++;return {color:ctx.fillStyle,colored};}));
  assert.ok(overlays.every(o=>o.color==='#ff00ff'&&o.colored>5),'Both highlights must use the Appearance fill type, color and opacity');
  state=await p.evaluate(()=>oxState());assert.deepEqual(state.map(s=>s.hovered),[chosen,chosen]);await p.screenshot({path:path.join(out,'01-excluded-geoset-highlight.png')});
  await p.getByRole('heading',{name:'OptimizeXL',exact:true}).hover();await p.waitForFunction(()=>!document.querySelector('[data-geoset-overlay]'));
  // Hit-test actual native animated coordinates using the shared picker, then
  // move the real mouse to that surface in each viewport and check both views.
  for(const side of [0,1]){
   state=await p.evaluate(()=>oxState());const s=state[side],cam=new OrthographicCamera();cam.projectionMatrix.fromArray(s.projection);cam.matrixWorldInverse.fromArray(s.worldInverse);
   const meshModel=side?openDocument(runOptimizeStage(new Uint8Array(source),'nuclear',{...simpleSettings('nuclear',100,model),excludedGeosets:[chosen]}).bytes,'after.mdx').model:model;
   const matrices=new Map(s.matrices.flatMap((m,i)=>m?[[i,new Matrix4().fromArray(m)]]:[]));
   const canvas=p.locator('.ox-preview .game-preview-surface canvas:not([data-background])').nth(side),rect=await canvas.boundingBox();
   const projected=projectPreviewGeosets(meshModel.Geosets.flatMap((g,i)=>sampleGeosetAnimation(meshModel,i,s.frame,1,0).alpha>.001?[{index:i,faces:g.Faces,vertices:skinGeoset(g,matrices)}]:[]),cam,rect.width,rect.height);
   let point;for(let y=rect.height*.3;!point&&y<rect.height*.8;y+=9)for(let x=rect.width*.25;x<rect.width*.75;x+=9){const hit=pickPreviewGeoset(projected,x,y);if(hit){point={x,y,index:hit.index};break;}}
   assert.ok(point);await p.mouse.move(rect.x+point.x,rect.y+point.y);await p.waitForFunction(i=>window.oxState().every(s=>s.hovered===i),point.index);
   assert.equal(await box.locator('.geoset-row.hovered').getByRole('checkbox').getAttribute('aria-label'),`Exclude geoset ${point.index+1}`);
  }
  await p.getByRole('heading',{name:'OptimizeXL',exact:true}).hover();
  for(const name of ['Duplicate data','Animation optimization','Unused data']){await nav(name).click();await ready();assert.equal(await exclude(chosen).isChecked(),true);}
  for(const name of ['Insanity FIxer','Irregularities Fixer','Sphereomancer']){await nav(name).click();assert.equal(await box.count(),0);await p.waitForFunction(()=>!document.querySelector('[data-geoset-overlay]'));}
  await nav('Nuclear Polygon Destroyer').click();await p.getByLabel('Strength',{exact:true}).fill('100');await box.getByRole('button',{name:'All',exact:true}).click();await ready();await star('Nuclear Polygon Destroyer',false);
  state=await p.evaluate(()=>oxState());assert.equal(state[0].geosets,state[1].geosets);assert.deepEqual(state[1].hidden,[]);assert.match(await p.locator('.ox-savings').textContent(),/0.00 KB saved/);
  await box.getByRole('button',{name:'Clear',exact:true}).click();await ready();await star('Nuclear Polygon Destroyer',true);
  await p.getByRole('button',{name:'Skip stage',exact:true}).click();await star('Nuclear Polygon Destroyer',true);await p.getByRole('button',{name:'Back',exact:true}).click();await ready();
  await p.getByLabel('Strength',{exact:true}).fill('100');await exclude(chosen).check();await ready();await p.getByRole('button',{name:'Approve',exact:true}).click();await star('Nuclear Polygon Destroyer',false);assert.equal(await box.count(),0);
  await p.getByRole('button',{name:'Back',exact:true}).click();await ready();await star('Nuclear Polygon Destroyer',true);assert.equal(await exclude(chosen).isChecked(),true);
  await p.screenshot({path:path.join(out,'02-restored-exclusions-and-star.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(fs.readFileSync(file),source);assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'settings.json'))).preferences.viewportAppearance.geosetHighlight.color,'#ff00ff');
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!packaged,excludedGeoset:chosen+1,rangeSelection:true,sharedHover:true,appearance:overlays,excludedVisible:true,stageStars:true,undoRestoresExclusions:true,sourceUnchanged:true,errors},null,2));
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
