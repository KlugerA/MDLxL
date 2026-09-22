// Exercise the rebuilt production bundle: node test/quad-view.electron.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
function sameCamera(actual, expected, message) {
  assert.equal(actual.zoom, expected.zoom, message);
  for (const key of ['position','quaternion','target']) actual[key].forEach((value,index)=>assert.ok(Math.abs(value-expected[key][index])<1e-9,message+' '+key));
}
function sameOrientation(actual, expected, message) {
  actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<1e-12,message));
}

(async () => {
  const out = path.resolve('out/quad-view'); fs.mkdirSync(out, {recursive:true});
  const {createStarterDocument} = await import('../src/starter-model.js');
  const doc = createStarterDocument();
  doc.apply('Asymmetric test vertices', ['Geosets'], model => {
    model.Geosets[0].Vertices.set([17,29,43],0);
  });
  const fixture=path.join(out,'quad-test.mdx');fs.writeFileSync(fixture,Buffer.from(doc.serialize('mdx')));
  const original=fs.readFileSync(fixture), errors=[];
  const app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',process.cwd(),fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
  try {
    const page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setPosition(-3000,0);w.showInactive();});
    await page.getByRole('button',{name:'Quad View',exact:true}).waitFor({timeout:60000});
    await page.waitForFunction(()=>document.querySelector('.classic-counts')?.textContent.includes('Vertices: 8'));
    // Read existing React runtime refs for assertions; no production test API.
    await page.evaluate(()=>{
      window.viewportState=()=>{
        const host=document.querySelector('[aria-label="3D model viewport"]');
        let fiber=host[Object.keys(host).find(key=>key.startsWith('__reactFiber'))];
        for(;fiber;fiber=fiber.return)for(let hook=fiber.memoizedState;hook;hook=hook.next){
          const value=hook.memoizedState?.current;if(value?.renderer&&value?.entries)return value;
        }
        throw Error('Viewport runtime not found');
      };
      window.draws={};const state=viewportState(),render=state.renderer.render;
      state.renderer.render=function(scene,camera){
        const rect=this.getViewport({copy(v){return {x:v.x,y:v.y,w:v.z,h:v.w}}});
        const entry=state.entries[0];
        draws[rect.x+','+rect.y]={vertices:Array.from(entry.geometry.attributes.position.array),selected:Array.from(entry.selectedPoints.geometry.index?.array||[]),camera:camera.uuid,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom};
        return render.call(this,scene,camera);
      };
      window.vertexPoint=()=>{
        const state=viewportState(),p=state.controls.target.clone().fromBufferAttribute(state.entries[0].geometry.attributes.position,0).project(state.camera);
        const r=state.controls.domElement.getBoundingClientRect();return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};
      };
      window.coordinates=()=>Array.from(viewportState().entries[0].geoset.Vertices.slice(0,3));
      window.cameraState=()=>{const s=viewportState();return{position:s.camera.position.toArray(),quaternion:s.camera.quaternion.toArray(),zoom:s.camera.zoom,target:s.controls.target.toArray()};};
      window.pointerLog=[];for(const type of ['pointerdown','pointermove','pointerup'])document.addEventListener(type,event=>{pointerLog.push({type,x:event.clientX,y:event.clientY,target:event.target.className});if(pointerLog.length>20)pointerLog.shift();},true);
    });
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
    await page.locator('[data-warmkey="select"]').click();
    const clickVertex=async()=>{const p=await page.evaluate(()=>vertexPoint());await page.mouse.click(p.x,p.y);};
    const idle=()=>page.waitForTimeout(150);
    await idle();await clickVertex();await idle();
    assert.deepEqual(await page.evaluate(()=>Array.from(viewportState().entries[0].selectedPoints.geometry.index.array)),[0]);
    const single=await page.evaluate(()=>cameraState());
    await page.getByLabel('Workplane',{exact:true}).uncheck();
    const toggle=()=>page.getByRole('button',{name:'Quad View',exact:true}).click();
    await page.evaluate(()=>{draws={};});await toggle();await idle();
    assert.equal(await page.locator('.quad-pane:visible').count(),4);
    assert.equal(await page.locator('[aria-label="3D model viewport"] > canvas').count(),1);
    assert.equal(Object.keys(await page.evaluate(()=>draws)).length,4);
    for(const draw of Object.values(await page.evaluate(()=>draws)))assert.deepEqual(draw.selected,[0]);
    const activate=async id=>{await page.locator(`[data-viewport="${id}"]`).focus();await idle();};
    const metrics=[];
    for(const [id,depth,plane] of [['front',0,'YZ'],['side',1,'ZX'],['top',2,'XY']]){
      await activate(id);assert.equal(await page.getByLabel(plane+' workplane',{exact:true}).isChecked(),true);
      await page.keyboard.press('a');await clickVertex();await idle();
      await page.waitForFunction(()=>viewportState().entries[0].selectedPoints.geometry.index?.count===1);
      assert.equal(await page.evaluate(()=>viewportState().entries[0].selectedPoints.geometry.index.count),1);
      await page.keyboard.press('m');
      const before=await page.evaluate(()=>coordinates()),p=await page.evaluate(()=>vertexPoint());
      await page.evaluate(()=>{draws={};});await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+26,p.y-17,{steps:5});await idle();
      await page.waitForFunction(()=>Object.keys(draws).length===4&&Object.values(draws).every(draw=>draw.vertices.slice(0,3).every((value,index)=>value===viewportState().entries[0].geometry.attributes.position.array[index])));
      const live=await page.evaluate(()=>({source:coordinates(),draws}));
      assert.deepEqual(live.source,before,'document must wait for mouse-up');
      assert.equal(Object.keys(live.draws).length,4,'all panes render during drag');
      const preview=Object.values(live.draws)[0].vertices.slice(0,3);
      assert.equal(preview[depth],before[depth],id+' live depth');assert.notDeepEqual(preview,before);
      for(const draw of Object.values(live.draws)){assert.deepEqual(draw.vertices.slice(0,3),preview);assert.deepEqual(draw.selected,[0]);}
      await page.mouse.up();await idle();
      const after=await page.evaluate(()=>coordinates());assert.equal(after[depth],before[depth],id+' committed depth');
      assert.deepEqual(after,preview);metrics.push({id,before,after,depthDelta:after[depth]-before[depth]});
      await page.keyboard.press('Control+z');await idle();assert.deepEqual(await page.evaluate(()=>coordinates()),before,'one undo per drag');
      await page.keyboard.press('Control+y');await idle();assert.deepEqual(await page.evaluate(()=>coordinates()),after);
    }
    await page.screenshot({path:path.join(out,'quad-selected.png')});
    // Escape cancels the shared preview without changing the document.
    const beforeCancel=await page.evaluate(()=>coordinates()),p=await page.evaluate(()=>vertexPoint());
    await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+23,p.y+11);await page.keyboard.press('Escape');await page.mouse.up();await idle();
    assert.deepEqual(await page.evaluate(()=>coordinates()),beforeCancel);
    for(const draw of Object.values(await page.evaluate(()=>draws)))assert.deepEqual(draw.vertices.slice(0,3),beforeCancel);
    // Selection, marquee, independent zoom/pan, and fixed orthographic orientation.
    const cameras={};
    for(const id of ['front','top','side','perspective']){await activate(id);cameras[id]=await page.evaluate(()=>cameraState());}
    await activate('front');await page.keyboard.press('a');await clickVertex();await idle();
    const r=await page.locator('[data-viewport="front"]').boundingBox();
    await page.mouse.move(r.x+20,r.y+35);await page.mouse.down();await page.mouse.move(r.x+r.width-20,r.y+r.height-20,{steps:3});await page.mouse.up();await idle();
    assert.equal(await page.evaluate(()=>viewportState().entries[0].selectedPoints.geometry.index.count),8,'marquee selects visible vertices');
    await clickVertex();await idle();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,-220);await idle();
    assert.notEqual((await page.evaluate(()=>cameraState())).zoom,cameras.front.zoom);
    await page.mouse.down({button:'right'});await page.mouse.move(r.x+r.width/2+35,r.y+r.height/2+12);await page.mouse.up({button:'right'});await idle();
    assert.deepEqual((await page.evaluate(()=>cameraState())).quaternion,cameras.front.quaternion,'Front remains axis-aligned');
    for(const id of ['top','side','perspective']){await activate(id);sameCamera(await page.evaluate(()=>cameraState()),cameras[id],id+' camera independent');}
    // Perspective orbit remains available.
    const pr=await page.locator('[data-viewport="perspective"]').boundingBox();await page.mouse.move(pr.x+pr.width/2,pr.y+pr.height/2);await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(pr.x+pr.width/2+40,pr.y+pr.height/2+18);await page.mouse.up();await page.keyboard.up('Alt');await idle();
    assert.notDeepEqual((await page.evaluate(()=>cameraState())).quaternion,cameras.perspective.quaternion);
    await toggle();await idle();sameCamera(await page.evaluate(()=>cameraState()),single,'single-view camera restored');
    assert.deepEqual(await page.evaluate(()=>coordinates()),beforeCancel);assert.equal(await page.evaluate(()=>viewportState().entries[0].selectedPoints.geometry.index.count),1);
    await toggle();await idle();
    await activate('perspective');await page.keyboard.press('a');await clickVertex();await idle();
    assert.equal(await page.evaluate(()=>viewportState().entries[0].selectedPoints.geometry.index.count),1,'Perspective selection');
    await activate('front');
    const topCamera=cameras.top;
    await page.getByRole('button',{name:'Fit selection',exact:true}).click();await idle();
    await activate('top');sameCamera(await page.evaluate(()=>cameraState()),topCamera,'Fit affects only active pane');
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setSize(1021,733);});await idle();
    const sizes=await page.locator('.quad-pane:visible').evaluateAll(items=>items.map(e=>({w:e.clientWidth,h:e.clientHeight})));
    assert.equal(sizes.length,4);assert.ok(sizes.every(r=>r.w>200&&r.h>150));
    assert.ok(Math.abs(sizes[0].w-sizes[1].w)<=1);assert.ok(Math.abs(sizes[0].h-sizes[2].h)<=1);
    await page.screenshot({path:path.join(out,'quad-resized.png')});
    // Retera-style fixed planes cannot be turned into arbitrary cameras.
    await activate('front');await page.getByRole('button',{name:'Fit',exact:true}).click();await idle();
    const dropdown=page.getByLabel('View direction',{exact:true});
    const options=await dropdown.locator('option').evaluateAll(items=>items.map(item=>item.value));
    assert.deepEqual(options,['front','back','right','left','top','bottom','perspective']);
    assert.equal(await page.locator('.quad-pane select').count(),0,'extra camera dropdowns removed');
    const planeViews={front:['front',0,'YZ'],back:['front',0,'YZ'],right:['side',1,'ZX'],left:['side',1,'ZX'],top:['top',2,'XY'],bottom:['top',2,'XY']};
    const shiftMetrics=[];
    async function planeDrag(view,dx,dy,shift){
      const [id,depthAxis]=planeViews[view];await activate(id);
      await page.keyboard.press('m');
      const before=await page.evaluate(()=>({coordinates:coordinates(),point:vertexPoint()}));
      const r=await page.locator(`[data-viewport="${id}"]`).boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
      await page.mouse.move(x,y);if(shift)await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:3});await idle();
      const live=await page.evaluate(()=>Array.from(viewportState().entries[0].geometry.attributes.position.array.slice(0,3)));
      assert.equal(live[depthAxis],before.coordinates[depthAxis],view+' live hidden axis must be EXACTLY unchanged');
      await page.mouse.up();if(shift)await page.keyboard.up('Shift');await idle();
      const after=await page.evaluate(()=>({coordinates:coordinates(),point:vertexPoint()})),delta=after.coordinates.map((v,i)=>v-before.coordinates[i]);
      assert.equal(delta[depthAxis],0,view+' committed hidden axis must be EXACTLY unchanged');
      if(shift){
        const locked=Math.abs(dx)>Math.abs(dy)?'y':'x',moving=locked==='x'?'y':'x';
        assert.ok(Math.abs(after.point[locked]-before.point[locked])<1e-3,view+' '+locked+' locked');
        assert.ok(Math.abs(after.point[moving]-before.point[moving])>2,view+' moves');
      }else assert.equal(delta.filter(value=>value!==0).length,2,view+' ordinary drag moves both visible axes');
      shiftMetrics.push({view,dx,dy,shift,depthDelta:delta[depthAxis]});
      await page.keyboard.press('Control+z');await idle();assert.deepEqual(await page.evaluate(()=>coordinates()),before.coordinates);
    }
    for(const [view,[id,depthAxis,plane]] of Object.entries(planeViews)){
      await dropdown.selectOption(view);await page.waitForFunction(value=>viewportState().appliedView===value,view);await idle();
      assert.equal(await page.locator('.quad-pane.active').getAttribute('data-viewport'),id,'view command targets its fixed plane');
      assert.equal(await page.getByLabel(plane+' workplane',{exact:true}).isChecked(),true);
      assert.equal(await page.getByLabel('Workplane',{exact:true}).isChecked(),true);
      assert.equal(await page.getByLabel('Workplane',{exact:true}).isDisabled(),true);
      await activate(id);await page.getByRole('button',{name:'Fit',exact:true}).click();await idle();await activate(id);
      const fixed=await page.evaluate(()=>cameraState()),unchanged=await page.evaluate(()=>coordinates());
      const r=await page.locator(`[data-viewport="${id}"]`).boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2;
      await page.mouse.move(cx,cy);await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(cx+34,cy+23,{steps:4});await page.mouse.up();await page.keyboard.up('Alt');await idle();
      sameOrientation((await page.evaluate(()=>cameraState())).quaternion,fixed.quaternion,view+' Alt cannot rotate the editing plane');
      await page.locator('[data-warmkey="camera:rotate"]').click();await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+21,cy+12);await page.mouse.up();await idle();
      sameOrientation((await page.evaluate(()=>cameraState())).quaternion,fixed.quaternion,view+' camera toolbar cannot rotate the editing plane');
      await page.locator('[data-warmkey="camera:work"]').click();await activate(id);
      await page.evaluate(()=>{viewportState().setCameraAngles({x:31,y:59,z:83});viewportState().setView('orthographic');viewportState().setView('top-front-right');});await idle();
      assert.equal(await dropdown.inputValue(),view);sameOrientation((await page.evaluate(()=>cameraState())).quaternion,fixed.quaternion,view+' rejects arbitrary camera angles');
      assert.deepEqual(await page.evaluate(()=>coordinates()),unchanged,'navigation does not edit vertices');
      assert.equal(await page.evaluate(()=>viewportState().controls.enableRotate),false);
      await planeDrag(view,28,-19,false);await planeDrag(view,28,9,true);await planeDrag(view,9,-28,true);
    }
    await dropdown.selectOption('front');await activate('front');
    const fr=await page.locator('[data-viewport="front"]').boundingBox(),cx=fr.x+fr.width/2,cy=fr.y+fr.height/2;
    await page.screenshot({path:path.join(out,'quad-locked-planes.png')});
    const coarse=await page.evaluate(()=>viewportState().grid.userData.spacing);
    await page.mouse.move(cx,cy);for(let n=0;n<3;n++){await page.mouse.wheel(0,-350);await idle();}
    assert.ok(await page.evaluate(()=>viewportState().grid.userData.spacing)<coarse,'zoom reveals finer grid');
    await page.getByRole('button',{name:'Fit',exact:true}).click();await idle();
    // Appearance presets, custom edits, and their saved bundle reach the actual renderer.
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('menu','appearanceSettings'));
    await page.getByLabel('Quadview appearance',{exact:true}).waitFor();
    const {BUILT_IN_VIEWPORT_PRESETS}=await import('../src/viewport-appearance.js');
    for(const preset of Object.values(BUILT_IN_VIEWPORT_PRESETS)){
      await page.getByLabel('Viewport appearance preset',{exact:true}).selectOption(preset.id);await idle();
      assert.equal(await page.getByLabel('Quadview background color',{exact:true}).inputValue(),preset.appearance.quadView.background.color);
      assert.equal(await page.evaluate(()=>viewportState().scene.background.getHexString()),preset.appearance.quadView.background.color.slice(1));
      const colors=await page.evaluate(()=>viewportState().grid.children.map(item=>item.material.color.getHexString()));
      assert.ok(colors.includes(preset.appearance.quadView.grid.minorColor.slice(1)),preset.id+' grid palette');
    }
    await page.getByLabel('Quadview background color',{exact:true}).fill('#203040');
    await page.getByLabel('Quadview minor grid color',{exact:true}).fill('#6789ab');
    await page.getByLabel('Quadview minimum cell size',{exact:true}).fill('36');await idle();
    assert.equal(await page.evaluate(()=>viewportState().scene.background.getHexString()),'203040');
    assert.ok(await page.evaluate(()=>viewportState().grid.children.some(item=>item.material.color.getHexString()==='6789ab')));
    await page.getByLabel('Custom viewport preset name',{exact:true}).fill('Quad test appearance');await page.getByRole('button',{name:'Save as custom preset',exact:true}).click();
    const custom=await page.getByLabel('Viewport appearance preset',{exact:true}).inputValue();assert.ok(custom.startsWith('custom-'));
    await page.getByLabel('Viewport appearance preset',{exact:true}).selectOption('mdlvis-vanilla');await page.getByLabel('Viewport appearance preset',{exact:true}).selectOption(custom);await idle();
    assert.equal(await page.getByLabel('Quadview minimum cell size',{exact:true}).inputValue(),'36');
    assert.equal(await page.evaluate(()=>viewportState().scene.background.getHexString()),'203040');
    await page.getByLabel('Quadview appearance',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'quad-appearance-settings.png')});
    await page.getByRole('button',{name:'Done',exact:true}).click();await idle();await page.screenshot({path:path.join(out,'quad-custom-appearance.png')});
    assert.deepEqual(errors,[]);assert.deepEqual(await page.locator('[role="alert"]').allTextContents(),[]);
    assert.ok(fs.readFileSync(fixture).equals(original),'input file stays unchanged');
    fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({metrics,shiftMetrics,sizes,errors},null,2));
    console.log('PASS',JSON.stringify({metrics,sizes,lockedPlaneDrags:shiftMetrics.length,checks:'shared live preview, exact depth, undo/redo, cancel, selection, marquee, independent cameras, perspective orbit, toggle restore, resize, input preservation, permanent planes, disabled global workplane override, blocked orthographic orbit/angles, Shift H/V, adaptive zoom, appearance bundles'}));
  } catch(error) {
    console.error(error);
    const page=await app.firstWindow();await page.screenshot({path:path.join(out,'failure.png')});
    console.error('Runtime',await page.evaluate(()=>({view:viewportState().appliedView,camera:cameraState(),point:vertexPoint(),coords:coordinates(),selection:Array.from(viewportState().entries[0].selectedPoints.geometry.index?.array||[]),pointerLog})));
    throw error;
  } finally {await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exitCode=1;});
