import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePaintSelectionSpace} from '../src/paint-selection-space.js';
import {isolatePaintRegion} from '../src/paint-region.js';
import {createPaintProject,addPaintProjectTarget,recordPaintSurfaceChange,travelPaintHistory,paintProjectArchive,restorePaintProject} from '../src/paint-project.js';
import {createPaintRaster} from '../src/paint-raster.js';
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
