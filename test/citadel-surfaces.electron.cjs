// Synthetic mappings exercise actual Electron pointer/preview/commit paths.
// Fixture creation is explicit; no supplied model is rewritten for the test.
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),out=path.resolve(process.env.MDLXL_PAINT_OUT||'out/citadel-audit/surfaces-'+Date.now());
fs.mkdirSync(out,{recursive:true});let app,page;const result={checks:[],errors:[]};
async function fixture(){
  const {createDemoDocument,recalculateExtents,recalculateNormals}=await import('../src/editor-document.js');
  const {encodePaintPng}=await import('../src/paint-project.js'),{createPaintRaster}=await import('../src/paint-raster.js');
  const doc=createDemoDocument(),template=doc.model.Geosets[0];
  const panel=(cx,cz,kind)=>{
    const vertices=[],uv=[],faces=[],steps=kind==='curved'?12:1;
    for(let i=0;i<steps;i++){
      const a=i/steps,b=(i+1)/steps,point=(u,v)=>[cx+(u-.5)*65,kind==='curved'?-22*Math.cos((u-.5)*Math.PI):0,cz+(v-.5)*65];
      for(const [u,v] of [[a,0],[b,0],[a,1],[b,0],[b,1],[a,1]]){
        vertices.push(...point(u,v));
        if(kind==='collapsed')uv.push(.8,.8);
        else if(kind==='stretched')uv.push(.7+u*.002,.05+v*.3);
        else if(kind==='seam'){const second=vertices.length/3>3;uv.push((second?.52:.03)+u*.35,.55+v*.35);}
        else uv.push(.03+u*.35,.04+v*.35);
        faces.push(faces.length);
      }
    }
    const geo={...structuredClone(template),Vertices:new Float32Array(vertices),Normals:new Float32Array(vertices.length),Faces:new Uint16Array(faces),TVertices:[new Float32Array(uv)],VertexGroup:new Uint8Array(vertices.length/3),Groups:[[0]],TotalGroupsCount:1,Anims:[],MaterialID:0};
    recalculateNormals(geo);return geo;
  };
  doc.apply('Create surface fixture',['Geosets','GeosetAnims','Textures','Materials','Sequences','Nodes'],m=>{
    m.Geosets=[panel(-90,60,'flat'),panel(0,60,'seam'),panel(90,60,'flat'),panel(-90,-30,'curved'),panel(0,-30,'stretched'),panel(90,-30,'collapsed')];
    m.GeosetAnims=[];m.Sequences=[];for(const node of m.Nodes.filter(Boolean)){delete node.Translation;delete node.Rotation;delete node.Scaling;}
    m.Textures=[{Image:'Fixture.png',ReplaceableId:0,Flags:0}];m.Materials=[{PriorityPlane:0,RenderMode:0,Layers:[{TextureID:0,CoordId:0,FilterMode:0,Shading:17,Alpha:1}]}];recalculateExtents(m);
  });
  const raster=createPaintRaster(256,256,[94,108,123,255]);for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(((x>>4)+(y>>4))%2)raster.data.set([129,142,157,255],(y*256+x)*4);
  fs.writeFileSync(path.join(out,'Fixture.png'),await encodePaintPng(raster));const filename=path.join(out,'Surfaces.mdx');fs.writeFileSync(filename,doc.serialize('mdx'));return filename;
}
async function settle(){await page.waitForTimeout(180);}
async function helpers(){await page.evaluate(()=>{
  window.audit=()=>{const el=document.querySelector('.paint-workspace');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(f.return)f=f.return;const find=(f,p)=>{if(p(f))return f;for(let c=f.child;c;c=c.sibling){const r=find(c,p);if(r)return r;}};const root=f.stateNode.current,workspace=find(root,f=>f.memoizedProps?.onWorkingModelChange&&f.memoizedProps?.originalModel),viewport=find(root,f=>f.memoizedProps?.onPaintStart&&f.memoizedProps?.paintMode);let runtime;for(let h=viewport.memoizedState;h;h=h.next)if(h.memoizedState?.current?.renderer&&h.memoizedState?.current?.camera)runtime=h.memoizedState.current;return {workspace,props:workspace.memoizedProps,runtime};};
  window.hashPaint=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
  window.coatHash=()=>hashPaint(audit().props.project.targets[0].coats[0].raster.data);
  window.pointFor=(index,u=.5,v=.5)=>{const a=audit(),g=a.props.model.Geosets[index],x=g.MinimumExtent[0]+(g.MaximumExtent[0]-g.MinimumExtent[0])*u,z=g.MinimumExtent[2]+(g.MaximumExtent[2]-g.MinimumExtent[2])*v,y=index===3?-22*Math.cos((u-.5)*Math.PI):0,p=a.runtime.camera.position.clone().set(x,y,z).project(a.runtime.camera),b=a.runtime.renderer.domElement.getBoundingClientRect();return [b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2];};
  window.hoverCoat=()=>{for(let h=audit().workspace.memoizedState;h;h=h.next)if(h.memoizedState?.current?.entries&&h.memoizedState.current.parts)return h.memoizedState.current.parts[0].coat.raster.data;};
});}
async function placement(index,label){
  const before=await page.evaluate(()=>coatHash()),point=await page.evaluate(i=>pointFor(i),index);
  await page.mouse.move(...point);await settle();const preview=await page.evaluate(()=>hashPaint(hoverCoat()));assert.notEqual(preview,before,label+' has mapped coverage');assert.equal(await page.evaluate(()=>coatHash()),before);
  await page.screenshot({path:path.join(out,label+'-preview.png')});await page.mouse.down();await page.mouse.up();await settle();assert.equal(await page.evaluate(()=>coatHash()),preview,label+' preview equals committed texels');
  await page.mouse.move(945,490);await page.screenshot({path:path.join(out,label+'-committed.png')});await page.keyboard.press('Control+z');await settle();assert.equal(await page.evaluate(()=>coatHash()),before);result.checks.push(label+' preview, commit and exact undo');
}
async function run(){
  const model=await fixture();app=await _electron.launch({executablePath:process.env.MDLXL_ELECTRON_PATH||path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,model],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>result.errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1280,920);w.setPosition(-3000,0);w.showInactive();});
  await page.locator('[data-warmkey="paint"]').click();await page.getByRole('button',{name:'Begin',exact:true}).click();await page.locator('.paint-texture-view').waitFor();await helpers();await settle();
  await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await page.getByRole('button',{name:'Detail',exact:true}).click();await page.getByRole('spinbutton',{name:'Brush Size value',exact:true}).fill('30');
  for(const [index,label] of [[0,'flat-shared'],[1,'uv-seam'],[3,'curved'],[4,'stretched'],[5,'collapsed']])await placement(index,label);
  const unchanged=await page.evaluate(()=>coatHash());await page.getByRole('button',{name:'Camera rotation',exact:true}).click();const point=await page.evaluate(()=>pointFor(3));await page.mouse.move(...point);await page.mouse.down();await page.mouse.move(point[0]+80,point[1]+15,{steps:12});await page.mouse.up();await page.getByRole('button',{name:'Work mode',exact:true}).click();await settle();assert.equal(await page.evaluate(()=>coatHash()),unchanged);await placement(3,'curved-after-orbit');
  await page.getByRole('button',{name:'Prepare surface…',exact:true}).click();await page.getByRole('checkbox',{name:'Create unique UV space',exact:true}).check();await page.getByRole('button',{name:'Prepare',exact:true}).click();await page.getByRole('dialog',{name:'Prepare paint surface'}).waitFor({state:'hidden'});await settle();
  for(const [index,label] of [[0,'unique-shared'],[3,'unique-curved'],[4,'unique-stretched'],[5,'unique-collapsed']])await placement(index,label);
  assert.deepEqual(result.errors,[]);console.log(JSON.stringify({out,...result},null,2));fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
}
run().catch(async error=>{console.error(error);result.failure=error.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));process.exitCode=1;}).finally(async()=>{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});});
