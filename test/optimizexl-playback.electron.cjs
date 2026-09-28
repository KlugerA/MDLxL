const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {openDocument}=await import('../src/editor-document.js'),{ModelRenderer}=await import('war3-model');
 const {runOptimizeStage,simpleSettings}=await import('../src/optimizexl.js');
 const file=process.env.MDLXL_OPTIMIZEXL_REVIEW_MODEL||'C:/Users/PC/Desktop/WH_WOC_KnightKhorneFlail03.mdx',source=fs.readFileSync(file),model=openDocument(new Uint8Array(source),'review.mdx').model;
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','optimizexl-playback-proof'),profile=path.join(out,'profile-'+Date.now());fs.mkdirSync(profile,{recursive:true});
 const exe=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[];
 const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:exe?[file]:[process.cwd(),file],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
 try{
  const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}});
  await p.waitForFunction(()=>document.querySelector('.ox-savings strong'));
  const speed=p.getByLabel('Playback speed (%)',{exact:true});assert.equal(await speed.inputValue(),'100');assert.equal(await speed.getAttribute('min'),'0');assert.equal(await speed.getAttribute('max'),'200');
  await p.evaluate(()=>{
   window.playbackState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
    let runtime,props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.native&&c?.controls)runtime=c;if(c?.model?.Geosets&&c?.compareCamera)props=c;}
    if(!runtime||!props)return null;return {frame:runtime.native.getFrame(),requestedFrame:props.time,sequence:runtime.native.getSequence(),requestedSequence:props.sequenceIndex,time:props.playbackGlobalTime,clocks:Array.from(runtime.native.rendererData.globalSequencesFrames),shield:[48,49].map(id=>Array.from(runtime.native.rendererData.nodes[id].matrix))};
   });
   // Advance the popup's controller RAF deterministically; detached native
   // previews retain their existing timer-based renderer and real GPU update.
   const originalCancel=window.cancelAnimationFrame.bind(window);let id=0,now=0;const frames=new Map();
   window.requestAnimationFrame=callback=>{const token=--id;frames.set(token,callback);return token;};
   window.cancelAnimationFrame=token=>{if(frames.has(token))frames.delete(token);else originalCancel(token);};
   window.playbackTick=delta=>{now+=delta;const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(now);};
  });
  let globalTime=0;
  const settled=async()=>{await p.waitForFunction(({expected,durations})=>playbackState().every(s=>s&&s.time===expected&&Math.abs(s.frame-s.requestedFrame)<1e-5&&s.sequence===s.requestedSequence&&s.clocks.every((v,i)=>Math.abs(v-expected%durations[i])<1e-5)),{expected:globalTime,durations:model.GlobalSequences});return p.evaluate(()=>playbackState());};
  const tick=async(delta,advance=delta)=>{globalTime+=advance;await p.evaluate(d=>playbackTick(d),delta);return settled();};
  const play=async()=>{await p.getByRole('button',{name:'Play',exact:true}).click();await tick(0,0);};
  const pause=async()=>{await p.getByRole('button',{name:'Pause',exact:true}).click();return settled();};
  let afterModel=model;
  const checkPose=state=>{for(const [sideIndex,side]of state.entries()){const renderer=new ModelRenderer(structuredClone(sideIndex?afterModel:model));renderer.setSequence(side.sequence);renderer.setFrame(side.frame);side.clocks.forEach((v,i)=>renderer.rendererData.globalSequencesFrames[i]=v);renderer.updateNode(renderer.rendererData.rootNode);[48,49].forEach((id,index)=>side.shield[index].forEach((v,i)=>assert.ok(Math.abs(v-renderer.rendererData.nodes[id].matrix[i])<1e-5,'Native shield pose matches its independent global clock')));}};
  await p.getByLabel('Animation',{exact:true}).selectOption({label:'Walk'});const initial=await settled();
  await speed.fill('0');await play();await tick(100,0);assert.deepEqual((await settled()).map(s=>s.frame),initial.map(s=>s.frame));
  await speed.fill('100');await tick(0,0);for(let i=0;i<10;i++)await tick(100,100);assert.equal(globalTime,1000);
  await speed.fill('50');await tick(0,0);for(let i=0;i<10;i++)await tick(100,50);assert.equal(globalTime,1500);
  await speed.fill('200');await tick(0,0);const samples=[];for(let i=0;i<15;i++){const states=await tick(100,200);checkPose(states);samples.push(states[0]);if(globalTime===1900)await p.screenshot({path:path.join(out,'01-walk-global-shield.png')});}
  assert.equal(globalTime,4500);assert.ok(samples.some(s=>s.clocks[0]>=3900));assert.ok(samples.some((s,i)=>i&&s.clocks[0]<samples[i-1].clocks[0]),'The full 4000 ms global sequence wraps independently');assert.ok(samples.filter((s,i)=>i&&s.frame<samples[i-1].frame).length>=4,'Walk loops while the longer global sequence continues');
  await speed.fill('0');const frozen=await settled();await tick(100,0);assert.deepEqual(await settled(),frozen);await pause();
  await p.getByRole('button',{name:'Animation optimization',exact:true}).click();await p.getByLabel('Strength',{exact:true}).fill('40');await p.waitForFunction(()=>document.querySelector('.ox-savings strong')&&!document.querySelector('.ox-savings').textContent.includes('Updating'));afterModel=openDocument(runOptimizeStage(new Uint8Array(source),'animation',simpleSettings('animation',40,model)).bytes,'after.mdx').model;checkPose(await settled());
  await speed.fill('100');
  for(let i=0;i<model.Sequences.length;i++){
   await p.getByLabel('Animation',{exact:true}).selectOption(String(i));checkPose(await settled());await play();await tick(100,100);checkPose(await pause());
   await p.getByRole('button',{name:'End',exact:true}).click();checkPose(await settled());await p.getByRole('button',{name:'Start',exact:true}).click();checkPose(await settled());
  }
  await p.getByLabel('Animation',{exact:true}).selectOption({label:'Walk'});await p.getByRole('checkbox',{name:'Loop',exact:true}).uncheck();await p.getByLabel('Animation frame',{exact:true}).fill('850');await play();await tick(100,50);await p.getByRole('button',{name:'Play',exact:true}).waitFor();assert.equal((await settled())[0].frame,900);checkPose(await settled());
  await speed.fill('250');assert.equal(await speed.inputValue(),'200');await speed.fill('-1');assert.equal(await speed.inputValue(),'0');await speed.fill('100');
  await p.screenshot({path:path.join(out,'02-speed-percent.png')});assert.deepEqual(errors,[]);assert.deepEqual(fs.readFileSync(file),source);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!exe,speedPercent:[0,50,100,200],allSequences:model.Sequences.length,fullGlobalCycle:true,pairedClocks:true,nativeShieldPoses:true,seekAndRebuildPreserveClock:true,nonLoopingStop:true,sourceUnchanged:true,errors,samples},null,2));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
