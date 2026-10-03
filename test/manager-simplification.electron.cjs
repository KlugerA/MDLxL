const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const {openDocument}=await import('../src/editor-document.js');
 const root=process.cwd(), file=process.env.MDLXL_TEST_MODEL || 'C:\\Users\\PC\\Desktop\\WIP\\graveguard_Optimized Weapon (1).mdx';
 const original=fs.readFileSync(file), out=process.env.MDLXL_SCREENSHOTS || path.join(root,'out/managers-v3'); fs.mkdirSync(out,{recursive:true});
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root,file],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(root,'out/managers-v3/profile-'+Date.now())}});
 let page;const errors=[];
 try{
  page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1600,1000);w.setPosition(-3000,0);w.webContents.setBackgroundThrottling(false);w.showInactive();});
  await page.getByText('Opened '+path.basename(file),{exact:true}).waitFor();
  const menu=command=>app.evaluate(({BrowserWindow},c)=>BrowserWindow.getAllWindows()[0].webContents.send('menu',c),command);
  for(const mode of ['Vertices','Bones','Movement','Animations']){
   await page.getByRole('button',{name:mode,exact:true}).click();
   const picker=page.locator('.classic-geoset-list');await picker.waitFor();
   await page.waitForFunction(()=>!document.body.innerText.includes('Loading controller') && !document.body.innerText.includes('Loading model preview'));
   await picker.scrollIntoViewIfNeeded();
   assert.ok(await picker.locator('.geoset-row').evaluateAll(rows=>rows.every(row=>/^\d+$/.test(row.innerText.trim()))),mode+' keeps original numbered picker');
   assert.equal(await page.getByPlaceholder('Find a mesh or texture…').count(),0);
   assert.equal(await page.getByRole('button',{name:'Edit selected node…',exact:true}).count(),0);
   await page.screenshot({path:path.join(out,mode.toLowerCase()+'.png')});
  }
  assert.equal(await page.locator('.animation-nodes button').count(),0);
  await page.getByLabel('Choose animation sequence',{exact:true}).selectOption({label:'Spell Slam'});
  await page.getByLabel('Select node SoulFountain',{exact:true}).check();
  await menu('Nodes');await page.getByRole('dialog',{name:'Node Manager',exact:true}).waitFor();
  await page.evaluate(()=>{const el=document.querySelector('.re-window');let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;fiber;fiber=fiber.return)if(fiber.memoizedProps?.doc?.serialize){window.testDoc=fiber.memoizedProps.doc;break;}});
  assert.equal(await page.locator('.re-visibility-timeline').count(),0);
  assert.equal(await page.getByLabel('Manager mode').count(),0);
  assert.equal(await page.locator('.re-properties .key-list').count(),0,'emitter visual fields are owned by EMTR');
  assert.equal(await page.locator('.re-properties').getByRole('button',{name:'EMTR…',exact:true}).count(),1);
  await page.getByRole('button',{name:'Close Node Manager',exact:true}).click();
  const reel=page.getByRole('slider',{name:'Animation frame',exact:true});
  const interval=await page.evaluate(()=>Array.from(testDoc.model.Sequences.find(s=>s.Name==='Spell Slam').Interval));
  const seek=async at=>{const b=await reel.boundingBox();await page.mouse.click(b.x+Math.min(b.width-1,Math.max(1,(at-interval[0])/(interval[1]-interval[0])*b.width)),b.y+8);};
  await seek(interval[0]);
  await page.getByLabel('Visible at current frame',{exact:true}).uncheck();
  await seek(interval[0]+Math.round((interval[1]-interval[0])*.5));
  assert.equal(await page.getByLabel('Visible at current frame',{exact:true}).isChecked(),false,'first key holds');
  await page.getByLabel('Visible at current frame',{exact:true}).check();
  await seek(interval[1]-2);assert.equal(await page.getByLabel('Visible at current frame',{exact:true}).isChecked(),true,'later key holds');
  await page.screenshot({path:path.join(out,'node-visibility.png')});
  await menu('Nodes');
  await page.getByLabel('Search nodes').fill('SND');
  await page.locator('.re-tree-row').filter({hasText:'SNDxDSPV'}).click();
  await page.getByRole('tree',{name:'Sound categories'}).waitFor();
  for (const soundId of ['AHAV','DSPD','DPES','DFOO','AEST','DCDD']) {
  await page.getByLabel('Search event data',{exact:true}).fill(soundId);
  await page.locator(`[data-sound-id="${soundId}"]`).click();
  await page.waitForFunction(()=>{const a=document.querySelector('audio');if(document.querySelector('.field-error'))throw Error(document.querySelector('.field-error').textContent);return a?.readyState>=2;},null,{timeout:30000});
  await page.locator('audio').evaluate(async a=>{a.volume=0.05;await a.play();});
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.1);
  await page.locator('audio').evaluate(a=>a.pause());
  console.log(soundId, 'loaded, decoded and played:',await page.locator('audio').evaluate(a=>({duration:a.duration,currentTime:a.currentTime})));
  }
  await page.getByLabel('Search event data',{exact:true}).fill('');
  await page.mouse.move(5,5);
  assert.equal(await page.locator('.re-sound-tree').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.ok(['rgba(0, 0, 0, 0)','rgb(197, 214, 236)'].includes(await page.locator('.re-sound-item').first().evaluate(el=>getComputedStyle(el).backgroundColor)));
  assert.equal(await page.locator('.re-sound-folder svg').first().evaluate(el=>getComputedStyle(el).display),'block');
  await page.screenshot({path:path.join(out,'node-sound.png')});
  await page.getByLabel('New node type',{exact:true}).selectOption('EventObject');await page.locator('.re-list-actions').getByRole('button',{name:'New',exact:true}).click();
  await page.getByLabel('Type',{exact:true}).selectOption('SPL');
  await page.getByLabel('Search event data',{exact:true}).fill('HumanBlood');
  const blood=await page.getByLabel('Event data',{exact:true}).locator('option').filter({hasText:'HumanBlood'}).first().getAttribute('value');await page.getByLabel('Event data',{exact:true}).selectOption(blood);
  await page.getByLabel('Blood splat animation preview',{exact:true}).waitFor();
  await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Splat preview time"]').value)>50);
  await page.getByRole('button',{name:'Pause splat preview',exact:true}).click();
  const splat = page.getByLabel('Blood splat animation preview',{exact:true}), scrub = page.getByLabel('Splat preview time',{exact:true});
  const duration=Number(await scrub.getAttribute('max'));
  await scrub.fill('200');await page.screenshot({path:path.join(out,'blood-splat-start.png')});
  const early=await splat.screenshot();
  await scrub.fill('1500');await page.screenshot({path:path.join(out,'blood-splat-spread.png')});
  assert.notDeepEqual(await splat.screenshot(),early,'native splat atlas animation changes actual preview pixels');
  const spread=await splat.screenshot();
  await scrub.fill(String(Math.round(duration*.85)));await page.screenshot({path:path.join(out,'blood-splat-decay.png')});
  assert.notDeepEqual(await splat.screenshot(),spread,'native splat decay changes actual preview pixels');
  assert.equal(await page.locator('.re-decal-preview .field-error').count(),0);
  await page.getByLabel('Resource keyframe time',{exact:true}).fill('6720');
  await page.getByRole('button',{name:/^Add at /}).click();
  const saved=await page.evaluate(()=>({bytes:Array.from(new Uint8Array(testDoc.serialize('mdx'))),events:testDoc.model.EventObjects.map(n=>({name:n.Name,times:[...n.EventTrack]}))}));
  const savedPath=path.join(root,'out/managers-v3/edited-events.mdx');fs.writeFileSync(savedPath,Buffer.from(saved.bytes));
  const reopened=openDocument(fs.readFileSync(savedPath),savedPath);
  assert.deepEqual(reopened.model.EventObjects.map(n=>({name:n.Name,times:[...n.EventTrack]})),saved.events);
  await page.getByLabel('Search nodes').fill('');await page.screenshot({path:path.join(out,'node-tree.png')});
  const backgrounds=[];
  for(const name of ['Materials','Textures','Geosets','Nodes']){
   await page.getByRole('navigation',{name:'Resource managers'}).getByRole('button',{name,exact:true}).click();
   backgrounds.push(await page.locator('.resource-editor').evaluate(el=>getComputedStyle(el).backgroundColor));
   assert.equal(await page.locator('.re-visibility-timeline').count(),0);
   assert.equal(await page.getByText(/A stack of texture|Image at the path above|Changes apply immediately/).count(),0);
   assert.ok(await page.locator('.re-resource-preview').count()<=1,'exactly one selected resource preview');
   await page.screenshot({path:path.join(out,'manager-'+name.toLowerCase()+'.png')});
  }
  assert.equal(new Set(backgrounds).size,1);assert.equal(backgrounds[0],'rgba(0, 0, 0, 0)');
  await page.getByRole('navigation',{name:'Resource managers'}).getByRole('button',{name:'Geosets',exact:true}).click();
    await page.evaluate(() => {
      window.meshDraws = new Map();
      const original = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (...args) {
        if (!meshDraws.has(this.canvas)) meshDraws.set(this.canvas, new Set());
        meshDraws.get(this.canvas).add(this.getParameter(this.ELEMENT_ARRAY_BUFFER_BINDING));
        return original.apply(this, args);
      };
    });
    await page.getByText('Preview geoset', { exact: true }).click(); await page.locator('.re-model-stage canvas[data-clean-model-canvas]').waitFor();
    const isolation = await page.evaluate(() => {
      const el = document.querySelector('.re-model-stage .game-preview-root'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.isolatedGeosets) return { fit: fiber.memoizedProps.isolatedGeosets, hidden: [...fiber.memoizedProps.hiddenGeosets], count: fiber.memoizedProps.model.Geosets.length };
    });
    assert.deepEqual(isolation.fit, [0]); assert.equal(isolation.hidden.length, isolation.count - 1);
    const drawnIds = await page.evaluate(() => {
      const el = document.querySelector('.re-model-stage .game-preview-root'), canvas = el.querySelector('canvas[data-clean-model-canvas]');
      let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.native?.indexBuffer) return state.native.indexBuffer.flatMap((buffer, i) => window.meshDraws.get(canvas)?.has(buffer) ? [i] : []);
      }
    });
    assert.deepEqual(drawnIds, [0], 'actual GL draws must contain only the isolated mesh');
    await page.screenshot({ path: path.join(out, 'isolated-geoset.png') });
    await page.locator('.re-list [data-resource-index="13"]').click();
    await page.getByText('Preview geoset',{exact:true}).click();
    await page.locator('.re-model-stage canvas[data-clean-model-canvas]').waitFor();
    const pose=await page.locator('.re-model-stage .game-preview-root').evaluate(el=>{
      let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
      for(;fiber;fiber=fiber.return)for(let hook=fiber.memoizedState;hook;hook=hook.next){const runtime=hook.memoizedState?.current;if(!runtime?.native?.indexBuffer)continue;
        const native=runtime.native, geo=native.model.Geosets[13], matrix=native.rendererData.nodes[geo.Groups[0][0]].matrix;
        const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
        for(let i=0;i<geo.Vertices.length;i+=3)for(let axis=0;axis<3;axis++){const v=matrix[axis]*geo.Vertices[i]+matrix[axis+4]*geo.Vertices[i+1]+matrix[axis+8]*geo.Vertices[i+2]+matrix[axis+12];low[axis]=Math.min(low[axis],v);high[axis]=Math.max(high[axis],v);}
        const center=low.map((v,i)=>(v+high[i])/2),target=runtime.controls.target.toArray(),camera=runtime.controls.object,canvas=el.querySelector('canvas[data-clean-model-canvas]');
        const points=[];for(let i=0;i<geo.Vertices.length;i+=3){const point=runtime.controls.target.clone().set(geo.Vertices[i],geo.Vertices[i+1],geo.Vertices[i+2]);const world=camera.matrixWorld.clone().fromArray(matrix);point.applyMatrix4(world).project(camera);points.push(point.toArray());}
        return {center,target,points,aspect:camera.aspect,displayAspect:canvas.clientWidth/canvas.clientHeight,frame:native.getFrame()};
      }
    });
    assert.equal(pose.frame,6720);assert.ok(pose.center.every((v,i)=>Math.abs(v-pose.target[i])<.001),'camera targets the drawn animated mesh');
    assert.ok(pose.points.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&z>-1&&z<1),'whole posed geoset fits without clipping');
    assert.ok(Math.abs(pose.aspect-pose.displayAspect)<.01,'preview aspect matches its displayed canvas');
    console.log('Geoset 14 at 6720 fits its actual rendered pose:',pose.center);
    await page.screenshot({path:path.join(out,'geoset-14-6720.png')});

  const beforeDrag=await page.locator('.re-window').boundingBox(), caption=await page.locator('.re-caption').boundingBox();
  await page.mouse.move(caption.x+80,caption.y+15);await page.mouse.down();await page.mouse.move(caption.x+160,caption.y+45,{steps:6});await page.mouse.up();
  assert.ok((await page.locator('.re-window').boundingBox()).x>beforeDrag.x+60);
  await page.getByRole('navigation',{name:'Resource managers'}).getByRole('button',{name:'Materials',exact:true}).click();
  const materialId=await page.locator('.re-list [aria-selected=true]').getAttribute('data-resource-index');
  await page.getByRole('button',{name:'Visibility…',exact:true}).first().click();
  await page.locator('.resource-editor').waitFor({state:'detached'});
  await page.getByLabel('Choose animation sequence',{exact:true}).selectOption({label:'Spell Slam'});
  const geosetsBefore=await page.evaluate(()=>JSON.stringify(testDoc.model.GeosetAnims));
  await page.getByLabel('Visible at current frame',{exact:true}).uncheck();
  assert.equal(await page.evaluate(id=>testDoc.model.Materials[id].Layers[0].Alpha.Keys.find(k=>k.Frame===6000)?.Vector[0],Number(materialId)),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(testDoc.model.GeosetAnims)),geosetsBefore);
  await page.getByLabel('Select geoset 0',{exact:true}).click();
  assert.equal(await page.getByText(/^Material \d+ · Layer \d+$/).count(),0);
  const globalId=await page.evaluate(()=>{let id;testDoc.apply('Global visibility fixture',['Nodes','GlobalSequences'],m=>{id=m.GlobalSequences.push(1000)-1;const n=m.ParticleEmitters2.find(n=>n.Name==='SoulFountain');n.Visibility={LineType:0,GlobalSeqId:id,Keys:[0,1000].map(Frame=>({Frame,Vector:new Float32Array([1])}))};});return id;});
  await page.getByLabel('Select node SoulFountain',{exact:true}).check();
  await page.waitForFunction(id=>document.querySelector('[aria-label="Choose animation sequence"]').value===`global:${id}`,globalId);
  await page.getByLabel('Visible at current frame',{exact:true}).uncheck();
  assert.deepEqual(await page.evaluate(()=>testDoc.model.ParticleEmitters2.find(n=>n.Name==='SoulFountain').Visibility.Keys.map(k=>[k.Frame,k.Vector[0]])),[[0,0],[1000,1]]);
  assert.deepEqual(fs.readFileSync(file),original);assert.deepEqual(errors,[]);
  console.log('PASS original editor pickers; shared visibility checkbox; sound playback; event creation/save; managers without duplicate visibility tracks or filler.');
 }catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')});throw error;}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
