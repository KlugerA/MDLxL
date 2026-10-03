import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePaintSelectionSpace} from '../src/paint-selection-space.js';
import {isolatePaintRegion} from '../src/paint-region.js';
import {createPaintProject,addPaintProjectTarget,recordPaintSurfaceChange,travelPaintHistory,paintProjectArchive,restorePaintProject} from '../src/paint-project.js';
import {createPaintRaster,samplePaintRaster} from '../src/paint-raster.js';
import {enumeratePaintTargets} from '../src/paint-targets.js';
import {enablePaintMaterials,validatePaintAssignments} from '../src/paint-materials.js';
import {paintProjectModel,paintGeosetMask} from '../src/paint-view.js';
import {regionPaintTarget} from '../src/paint-region.js';
import {paintFixtureModel,triangleGeoset} from './fixtures/paint-fixtures.js';

function fixture(){
  const geo=triangleGeoset({uv:[.25,.75,.75,.75,.25,.25]});geo.Faces=new Uint16Array([0,1,2,2,1,0]);geo.VertexGroup=new Uint8Array([0,1,0]);geo.Groups=[[7],[8]];geo.SkinWeights=Uint8Array.from({length:24},(_,i)=>i);geo.Tangents=Float32Array.from({length:12},(_,i)=>i/10);
  const model=paintFixtureModel([geo,structuredClone(geo)]),project=createPaintProject({sourceMode:'current'});project.preserveMaterials=true;
  const raster=createPaintRaster(32,16);for(let i=0;i<raster.data.length;i++)raster.data[i]=i%251;
  for(const target of enumeratePaintTargets(model))addPaintProjectTarget(project,target,raster);enablePaintMaterials(project,model);
  project.targets[0].coats[1].raster=createPaintRaster(32,16,[170,50,80,140]);project.targets[0].alphaMask=createPaintRaster(32,16,[255,255,255,180]);return{model,project,target:project.targets[0],region:{geosetIndex:0,faces:new Set([0])}};
}
test('selection space separates shared pixels without moving a face or resampling the original skin',()=>{
  const {model,project,target,region}=fixture(),before=structuredClone(model),staged=preparePaintSelectionSpace(paintProjectModel(model,project),project,target,region);
  assert.equal(staged.target.base.width,64);assert.equal(staged.target.base.height,16);
  for(const [source,destination] of [[target.base,staged.target.base],[target.alphaMask,staged.target.alphaMask],...target.coats.map((c,i)=>[c.raster,staged.target.coats[i].raster])])for(let y=0;y<16;y++)assert.deepEqual(destination.data.slice((y*64+1)*4,(y*64+33)*4),source.data.slice(y*32*4,(y+1)*32*4));
  recordPaintSurfaceChange(project,target.id,staged,'Separate selection');const painted=paintProjectModel(model,project),next=project.targets[0],geo=painted.Geosets[0];
  const selectedMask=paintGeosetMask(painted,regionPaintTarget(next,region),64,16),otherMask=paintGeosetMask(painted,regionPaintTarget(next,{geosetIndex:0,faces:new Set([1])}),64,16);
  assert.ok(selectedMask.some(Boolean));assert.equal(selectedMask.some((v,i)=>v&&otherMask[i]),false);
  for(let face=0;face<2;face++)for(let corner=0;corner<3;corner++){
    const old=model.Geosets[0].Faces[face*3+corner],id=geo.Faces[face*3+corner];
    for(const [key,stride] of [['Vertices',3],['Normals',3],['VertexGroup',1],['Tangents',4],['SkinWeights',8]])assert.deepEqual(geo[key].slice(id*stride,(id+1)*stride),model.Geosets[0][key].slice(old*stride,(old+1)*stride));
    assert.deepEqual(geo.TVertices[0].slice(id*2,id*2+2),model.Geosets[0].TVertices[0].slice(old*2,old*2+2));
  }
  assert.deepEqual(geo.Groups,model.Geosets[0].Groups);assert.equal(painted.Geosets.length,model.Geosets.length);assert.deepEqual(model,before);validatePaintAssignments(project,model);
  travelPaintHistory(project);assert.deepEqual(project.targets[0],target);assert.deepEqual(paintProjectModel(model,project).Geosets[0].TVertices,model.Geosets[0].TVertices);travelPaintHistory(project,true);assert.deepEqual(paintProjectModel(model,project),painted);
});
test('independent selection persists with every layer and alpha in a portable project',async()=>{
  const {model,project,target,region}=fixture();recordPaintSurfaceChange(project,target.id,preparePaintSelectionSpace(paintProjectModel(model,project),project,target,region),'Separate');
  const bytes=await paintProjectArchive(project,{modelBytes:new Uint8Array([1,2,3])}),restored=(await restorePaintProject(new Uint8Array(await bytes.arrayBuffer()))).project;
  const a=restored.targets[0],b=project.targets[0];assert.deepEqual(a.base,b.base);assert.deepEqual(a.alphaMask,b.alphaMask);assert.deepEqual(a.bindings,b.bindings);assert.deepEqual(a.coats.map(c=>c.raster),b.coats.map(c=>c.raster));
  // Geometry is owned by the archive's working MDX, not its raster manifest.
  validatePaintAssignments(restored,paintProjectModel(model,project));
});
test('view isolation preserves original face ids and never edits model streams',()=>{
  const {model}=fixture(),before=structuredClone(model),view=isolatePaintRegion(model,{geosetIndex:0,faces:new Set([1])});
  assert.deepEqual(view.Geosets[0].paintFaceIndices,[1]);assert.deepEqual([...view.Geosets[0].Faces],[2,1,0]);assert.equal(view.Geosets[0].Vertices,model.Geosets[0].Vertices);assert.deepEqual(model,before);
});
test('excessive texture growth and animated UVs reject selection separation atomically',()=>{
  const {model,project,target,region}=fixture(),working=paintProjectModel(model,project),before=structuredClone(project);
  working.Materials[working.Geosets[0].MaterialID].Layers[0].TVertexAnimId=0;assert.throws(()=>preparePaintSelectionSpace(working,project,target,region),/Animated UV/);assert.deepEqual(project,before);
  delete working.Materials[working.Geosets[0].MaterialID].Layers[0].TVertexAnimId;working.Geosets[0].TVertices[0][0]=-200;assert.throws(()=>preparePaintSelectionSpace(working,project,target,region),/no room/);assert.deepEqual(project,before);
});

test('compressed U or V selections gain detail space while exact nearest pixels, alpha and wrapped neighbors survive',()=>{
  for(const axis of [0,1])for(const flags of [0,3]){
    const uv=axis===0?[-.4,.15,-.396,.15,-.4,.65]:[.15,-.14,.65,-.14,.15,-.136],geo=triangleGeoset({uv}),model=paintFixtureModel([geo,structuredClone(geo)]),project=createPaintProject({sourceMode:'current'});project.preserveMaterials=true;model.Textures[0].Flags=flags;
    const raster=createPaintRaster(128,64);for(let y=0;y<64;y++)for(let x=0;x<128;x++)raster.data.set([x*2,y*4,(x+y)%255,(x*3+y)%255],(y*128+x)*4);
    for(const descriptor of enumeratePaintTargets(model))addPaintProjectTarget(project,descriptor,raster);enablePaintMaterials(project,model);
    const target=project.targets[0],staged=preparePaintSelectionSpace(paintProjectModel(model,project),project,target,{geosetIndex:0,faces:new Set([0])}),mapped=staged.geometry[0].TVertices.at(-1);
    const extent=(values,index,size)=>Math.abs(values[index+2]-values[index])*size+Math.abs(values[index+4]-values[index])*size;
    assert.ok(extent(mapped,axis,axis?staged.target.base.height:staged.target.base.width)>=extent(geo.TVertices[0],axis,axis?64:128)*4);
    const sample=(image,values,weights,wrap)=>{let u=0,v=0;for(let c=0;c<3;c++){u+=values[c*2]*weights[c];v+=values[c*2+1]*weights[c];}const address=(n,size,repeat)=>repeat?(n%size+size)%size:Math.max(0,Math.min(size-1,n)),x=address(Math.floor(u*image.width),image.width,wrap&1),y=address(Math.floor(v*image.height),image.height,wrap&2);return [...image.data.slice((y*image.width+x)*4,(y*image.width+x+1)*4)];};
    // Sample within cells: an exact integer texel boundary is ambiguous after
    // the Float32 UV translation, even for an otherwise identical mapping.
    for(const weights of [[.17,.23,.6],[.61,.28,.11],[.21,.42,.37]]){
      const before=sample(target.base,geo.TVertices[0],weights,flags);
      assert.deepEqual(sample(staged.target.base,mapped,weights,staged.target.flags),before,'selected appearance');
      assert.deepEqual(sample(staged.target.base,staged.geometry[1].TVertices.at(-1),weights,staged.target.flags),before,'shared neighbor appearance');
    }
    assert.deepEqual(target.base,raster,'source skin remains untouched');
  }
});

test('repeated selections reuse empty canvas space and their private UV set',()=>{
  const {model,project,region}=fixture();
  for(let i=0;i<6;i++){
    const target=project.targets[0],working=paintProjectModel(model,project),staged=preparePaintSelectionSpace(working,project,target,region);
    recordPaintSurfaceChange(project,target.id,staged,'Separate selection');
    assert.equal(paintProjectModel(model,project).Geosets[0].TVertices.length,2,'reuse generated UVs, retaining the authored set');
  }
  assert.ok(project.targets[0].base.width<=256,'unused space should prevent exponential canvas growth');
  const expected=structuredClone(project.targets[0]);travelPaintHistory(project);travelPaintHistory(project,true);assert.deepEqual(project.targets[0],expected);
});

test('a compressed outlier face does not inflate a mostly balanced selected surface',()=>{
  const parts=Array.from({length:10},(_,i)=>triangleGeoset({uv:i===0?[.1,.6,.6,.6,.1,.60001]:[.1,.1,.6,.1,.1,.6]})),geo={...parts[0]};
  for(const key of ['Vertices','Normals','VertexGroup'])if(geo[key])geo[key]=new geo[key].constructor(parts.flatMap(g=>[...g[key]]));
  geo.Faces=Uint16Array.from({length:30},(_,i)=>i);geo.TVertices=[Float32Array.from(parts.flatMap(g=>[...g.TVertices[0]]))];
  const model=paintFixtureModel([geo]),project=createPaintProject({sourceMode:'current'});project.preserveMaterials=true;
  for(const target of enumeratePaintTargets(model))addPaintProjectTarget(project,target,createPaintRaster(128,128,[71,82,93,255]));enablePaintMaterials(project,model);
  const target=project.targets[0],staged=preparePaintSelectionSpace(paintProjectModel(model,project),project,target,{geosetIndex:0,faces:new Set(parts.map((_,i)=>i))});
  assert.equal(staged.target.base.height,128);assert.equal(staged.target.base.width,256);
});

test('a selection collapsed to one UV point gains paintable charts without changing its color or other faces',()=>{
  const {model,project,target,region}=fixture();target.flags=3;
  for(const geo of model.Geosets)geo.TVertices[0]=new Float32Array([-.4,1.6,-.4,1.6,-.4,1.6]);
  const working=paintProjectModel(model,project),staged=preparePaintSelectionSpace(working,project,target,region),geo=staged.geometry[0],mapped=geo.TVertices.at(-1),ids=[...geo.Faces.slice(0,3)],point=[...model.Geosets[0].TVertices[0].slice(0,2)];
  const [a,b,c]=ids.map(id=>[mapped[id*2]*staged.target.base.width,mapped[id*2+1]*staged.target.base.height]);
  assert.ok(Math.abs((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))>40000,'The chosen triangle has room for an image');
  for(const [before,after] of [[target.base,staged.target.base],[target.alphaMask,staged.target.alphaMask],...target.coats.map((coat,i)=>[coat.raster,staged.target.coats[i].raster])]){
    const expected=samplePaintRaster(before,...point,target.flags);
    for(const weights of [[.2,.3,.5],[.6,.1,.3]]){const uv=[0,1].map(axis=>ids.reduce((sum,id,i)=>sum+mapped[id*2+axis]*weights[i],0));assert.deepEqual(samplePaintRaster(after,...uv,staged.target.flags),expected);}
    const neighbor=geo.Faces[3];assert.deepEqual(samplePaintRaster(after,mapped[neighbor*2],mapped[neighbor*2+1],staged.target.flags),expected,'Unselected shared face retains its authored color');
  }
  for(let corner=0;corner<geo.Faces.length;corner++)for(const [key,stride] of [['Vertices',3],['Normals',3],['VertexGroup',1],['Tangents',4],['SkinWeights',8],['TVertices',2]]){
    const source=model.Geosets[0].Faces[corner],id=geo.Faces[corner],before=key==='TVertices'?model.Geosets[0][key][0]:model.Geosets[0][key],after=key==='TVertices'?geo[key][0]:geo[key];assert.deepEqual(after.slice(id*stride,(id+1)*stride),before.slice(source*stride,(source+1)*stride));
  }
  recordPaintSurfaceChange(project,target.id,staged,'Separate collapsed selection');const expected=paintProjectModel(model,project);travelPaintHistory(project);assert.deepEqual(project.targets[0],target);travelPaintHistory(project,true);assert.deepEqual(paintProjectModel(model,project),expected);
});
