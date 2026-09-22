// Exercise the rebuilt production bundle: node test/quad-view.electron.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
function sameCamera(actual, expected, message) {
  assert.equal(actual.zoom, expected.zoom, message);
  for (const key of ['position','quaternion','target']) actual[key].forEach((value,index)=>assert.ok(Math.abs(value-expected[key][index])<1e-9,message+' '+key));
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
  const app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[process.cwd(),fixture],env:{...process.env,MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
  try {
    const page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
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
    });
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
    await page.locator('[data-warmkey="select"]').click();
    const clickVertex=async()=>{const p=await page.evaluate(()=>vertexPoint());await page.mouse.click(p.x,p.y);};
    const idle=()=>page.waitForTimeout(120);
    await idle();await clickVertex();await idle();
    assert.deepEqual(await page.evaluate(()=>Array.from(viewportState().entries[0].selectedPoints.geometry.index.array)),[0]);
    const single=await page.evaluate(()=>cameraState());
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
      assert.equal(await page.evaluate(()=>viewportState().entries[0].selectedPoints.geometry.index.count),1);
      await page.keyboard.press('m');
      const before=await page.evaluate(()=>coordinates()),p=await page.evaluate(()=>vertexPoint());
      await page.evaluate(()=>{draws={};});await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+26,p.y-17,{steps:5});await idle();
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
    await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(r.x+r.width/2+35,r.y+r.height/2+12);await page.mouse.up();await page.keyboard.up('Alt');await idle();
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
    assert.deepEqual(errors,[]);assert.deepEqual(await page.locator('[role="alert"]').allTextContents(),[]);
    assert.ok(fs.readFileSync(fixture).equals(original),'input file stays unchanged');
    fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({metrics,sizes,errors},null,2));
    console.log('PASS',JSON.stringify({metrics,sizes,checks:'shared live preview, exact depth, undo/redo, cancel, selection, marquee, independent cameras, orbit, toggle restore, resize, input preservation'}));
  } finally {await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exitCode=1;});
