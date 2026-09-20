import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaintProject,addPaintProjectTarget,compositePaintTarget,recordPaintStroke,travelPaintHistory} from '../src/paint-project.js';
import {createPaintRaster,clonePaintRaster,blendPaintPixel} from '../src/paint-raster.js';
import {createPaintPreview,updatePaintPreview,createPaintDirtyRows,markPaintPixel} from '../src/paint-preview.js';
import {createPaintMaterial,assignPaintMaterial,enablePaintMaterials,repairPaintMaterials,validatePaintAssignments} from '../src/paint-materials.js';
import {enumeratePaintTargets} from '../src/paint-targets.js';
import {paintProjectModel} from '../src/paint-view.js';
import {paintFixtureModel,triangleGeoset} from './fixtures/paint-fixtures.js';

function sourceModel(){
  const model=paintFixtureModel([triangleGeoset(),triangleGeoset({materialId:1})]);
  model.Textures[0]={Image:'Units\\Human\\Footman\\Footman.blp',ReplaceableId:0,Flags:3};
  model.Textures.push({Image:'',ReplaceableId:1,Flags:0});
  const image={FilterMode:2,Shading:16,TextureID:0,CoordId:0,Alpha:1};
  model.Materials=[{Layers:[{FilterMode:1,Shading:17,TextureID:1,CoordId:0,Alpha:1},image]},{Layers:[{...image}]}];
  return model;
}
function skinRaster(){const raster=createPaintRaster(256,256,[110,70,35,128]);raster.data.set([70,80,90,0],0);return raster;}
function currentProject(model){const project=createPaintProject({sourceMode:'current'});for(const target of enumeratePaintTargets(model))addPaintProjectTarget(project,target,skinRaster());enablePaintMaterials(project,model);return project;}
function visiblePixel(model,index,raster,team,background=[40,50,60]){
  let color=[...background];
  for(const layer of model.Materials[model.Geosets[index].MaterialID].Layers){
    const tc=model.Textures[layer.TextureID].ReplaceableId===1,source=tc?team:raster.data,alpha=tc?1:source[3]/255;
    if(layer.FilterMode===1&&alpha<.75)continue;
    const amount=layer.FilterMode===0?1:alpha; color=color.map((v,c)=>Math.round(source[c]*amount+v*(1-amount)));
  }
  return color;
}

test('current skin preserves team colour and real cutouts while sharing one editable image',()=>{
  const model=sourceModel(),original=structuredClone(model),project=currentProject(model),target=project.targets[0],raster=compositePaintTarget(project),painted=paintProjectModel(model,project);
  assert.equal(project.targets.length,1);assert.equal(target.materialVariants.length,1);assert.notEqual(painted.Geosets[0].MaterialID,painted.Geosets[1].MaterialID);
  assert.deepEqual(raster,skinRaster(),'untouched native RGB and alpha are unchanged');
  for(const team of [[255,0,0],[0,0,255]])for(const index of [0,1])assert.deepEqual(visiblePixel(painted,index,raster,team),visiblePixel(original,index,skinRaster(),team));
  assert.deepEqual(visiblePixel(painted,0,raster,[0,0,255]),[0,0,255]);assert.deepEqual(visiblePixel(painted,1,raster,[0,0,255]),[40,50,60]);
  for(const index of [0,1])assert.equal(painted.Materials[painted.Geosets[index].MaterialID].Layers.filter(l=>l.TextureID===target.textureId).length,1);
  assert.deepEqual(model,original);validatePaintAssignments(project,model);
});

test('import after a blank basecoat restores destination WC3 alpha semantics and reuses material variants',()=>{
  const original=sourceModel(),project=createPaintProject({sourceMode:'primer'});
  const primer=createPaintMaterial(project,original,{raster:createPaintRaster(256,256,[90,100,110,255]),geosets:[0,1],basecoat:true});
  repairPaintMaterials(project,original);let working=paintProjectModel(original,project);
  const target=createPaintMaterial(project,working,{name:'Footman',sourcePath:original.Textures[0].Image,nativeSource:true,raster:skinRaster(),geosets:[0],basecoat:false,sourceModel:original});
  assert.equal(target.basecoat,false);assert.deepEqual(compositePaintTarget(project),skinRaster());
  for(let repeat=0;repeat<12;repeat++){assignPaintMaterial(project,working,target.id,[0,1],original);working=paintProjectModel(working,project);}
  assert.equal(target.materialVariants.length,1,'assigning or returning never grows duplicate variants');assert.equal(primer.bindings.length,0);
  assert.deepEqual(visiblePixel(working,0,compositePaintTarget(project),[255,0,0]),[255,0,0]);assert.deepEqual(visiblePixel(working,1,compositePaintTarget(project),[255,0,0]),[40,50,60]);
  const blank=createPaintMaterial(project,working,{name:'Blank',raster:createPaintRaster(256,256,[90,100,110,255]),geosets:[0],basecoat:true,sourceModel:original});
  assert.equal(blank.material.Layers.length,1);assert.equal(blank.material.Layers[0].FilterMode,0);validatePaintAssignments(project,working);
});

test('painting a native alpha hole becomes visible; preview, undo and alpha eraser agree',()=>{
  const model=sourceModel(),project=currentProject(model),target=project.targets[0],original=clonePaintRaster(target.base),coat=target.coats[0],before=clonePaintRaster(coat.raster),preview=createPaintPreview(target);
  updatePaintPreview(preview);coat.raster.data.set([20,220,60,255],0);recordPaintStroke(project,target.id,coat.id,before);
  const rows=createPaintDirtyRows(256);markPaintPixel(rows,0,0);updatePaintPreview(preview,rows);
  assert.deepEqual([...preview.raster.data.slice(0,4)],[20,220,60,255]);assert.deepEqual(preview.raster,compositePaintTarget(project));assert.deepEqual(target.base,original);
  assert.deepEqual(preview.raster.data.slice(4),original.data.slice(4),'pixels outside the stroke retain their alpha and RGB');
  travelPaintHistory(project);assert.deepEqual(compositePaintTarget(project),original);travelPaintHistory(project,true);
  blendPaintPixel(target.alphaMask.data,0,[0,0,0,0],.5,'erase');target.revision++;updatePaintPreview(preview,rows);
  assert.equal(preview.raster.data[3],128);assert.deepEqual(preview.raster,compositePaintTarget(project));
});

test('old current-skin material migration repairs underlays and preserves saved coats exactly',()=>{
  const original=sourceModel(),project=currentProject(original),target=project.targets[0];
  target.material.Layers=target.material.Layers.filter(l=>l.TextureID===target.textureId);target.materialVariants=[];target.bindings=target.bindings.map(b=>({...b,materialId:target.materialId,layerIndex:0}));target.materialIds=[target.materialId];
  delete target.preserveSourceAlpha;delete target.basecoat;project.paintMaterialsVersion=2;
  target.coats[0].raster.data.set([190,20,70,255],4);const base=clonePaintRaster(target.base),coat=clonePaintRaster(target.coats[0].raster),alpha=clonePaintRaster(target.alphaMask);
  assert.equal(repairPaintMaterials(project,original),true);assert.equal(repairPaintMaterials(project,original),false);
  assert.equal(project.paintMaterialsVersion,3);assert.equal(target.materialVariants.length,1);assert.equal(target.preserveSourceAlpha,false);
  assert.deepEqual(target.base,base);assert.deepEqual(target.coats[0].raster,coat);assert.deepEqual(target.alphaMask,alpha);validatePaintAssignments(project,original);
});
