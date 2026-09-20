import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaintProject,addPaintProjectTarget,readStoredZip} from '../src/paint-project.js';
import {createPaintRaster} from '../src/paint-raster.js';
import {assignPaintMaterial,createPaintMaterial,enablePaintMaterials,markPaintMaterialEdited,renamePaintMaterial,validatePaintAssignments} from '../src/paint-materials.js';
import {enumeratePaintTargets} from '../src/paint-targets.js';
import {paintProjectModel} from '../src/paint-view.js';
import {buildPaintExportArtifact} from '../src/paint-export.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {paintFixtureModel,triangleGeoset} from './fixtures/paint-fixtures.js';
const raster=()=>createPaintRaster(256,256,[51,82,134,255]);
test('new/share/reassign preserves one material and image layer per geoset, without changing the original',()=>{
  const model=paintFixtureModel([triangleGeoset(),triangleGeoset(),triangleGeoset()]),original=structuredClone(model),project=createPaintProject({sourceMode:'primer'});
  const first=createPaintMaterial(project,model,{name:'Armour',raster:raster(),geosets:[0,1,2]}),second=createPaintMaterial(project,model,{name:'Cloth',raster:raster(),geosets:[1]});
  assert.deepEqual(first.geosetIndices,[0,2]);assert.deepEqual(second.geosetIndices,[1]);validatePaintAssignments(project,model);
  let painted=paintProjectModel(model,project);assert.equal(painted.Geosets[0].MaterialID,painted.Geosets[2].MaterialID);assert.notEqual(painted.Geosets[0].MaterialID,painted.Geosets[1].MaterialID);
  for(const geo of painted.Geosets)assert.equal(painted.Materials[geo.MaterialID].Layers.length,1);
  assignPaintMaterial(project,model,first.id,[0,1,2]);assert.equal(second.bindings.length,0);assert.equal(first.bindings.length,3);assert.deepEqual(model,original);
});
test('invalid texture creation and assignment leave the entire project and current pixels intact',()=>{
  const model=paintFixtureModel([triangleGeoset()]),project=createPaintProject();createPaintMaterial(project,model,{name:'Armour',raster:raster(),geosets:[0]});const before=structuredClone(project);
  assert.throws(()=>createPaintMaterial(project,model,{raster:createPaintRaster(8),geosets:[0]}),/prepared/);assert.deepEqual(project,before);
  assert.throws(()=>createPaintMaterial(project,model,{raster:raster(),geosets:[999]}),/UV/);assert.deepEqual(project,before);
  assert.throws(()=>assignPaintMaterial(project,model,project.activeTargetId,[0,999]),/UV/);assert.deepEqual(project,before);
});
test('native first edit creates a unique Citadel name once and updates its material texture reference',()=>{
  const model=paintFixtureModel([triangleGeoset()]),project=createPaintProject();
  const target=createPaintMaterial(project,model,{name:'Footman.blp',sourcePath:'Units\\Human\\Footman\\Footman.blp',nativeSource:true,raster:raster(),geosets:[0]});
  assert.equal(target.paintName,'Footman');assert.equal(markPaintMaterialEdited(project,target),true);assert.equal(target.paintName,'FootmanCitadel');assert.equal(markPaintMaterialEdited(project,target),false);
  const painted=paintProjectModel(model,project),layer=painted.Materials[painted.Geosets[0].MaterialID].Layers[0];assert.equal(painted.Textures[layer.TextureID].Image,'Textures\\FootmanCitadel.blp');
  const other=createPaintMaterial(project,model,{name:'FootmanCitadel',raster:raster(),geosets:[]});assert.equal(other.paintName,'FootmanCitadel 2');assert.throws(()=>renamePaintMaterial(project,target,''),/name/);
});
test('legacy multi-image materials become one paint assignment and keep the primary source UV channel',()=>{
  const model=paintFixtureModel([triangleGeoset()]);model.Textures.push({Image:'Detail.blp',ReplaceableId:0,Flags:0});model.Geosets[0].TVertices.push(new Float32Array([.2,.2,.8,.2,.5,.8]));model.Materials[0].Layers[0].CoordId=1;model.Materials[0].Layers.push({...model.Materials[0].Layers[0],TextureID:1,CoordId:0});
  const project=createPaintProject();for(const t of enumeratePaintTargets(model))addPaintProjectTarget(project,t,raster());enablePaintMaterials(project,model);validatePaintAssignments(project,model);
  assert.equal(project.targets.reduce((sum,t)=>sum+t.bindings.length,0),1);const painted=paintProjectModel(model,project);assert.deepEqual(painted.Geosets[0].TVertices[0],model.Geosets[0].TVertices[1]);assert.equal(painted.Materials[painted.Geosets[0].MaterialID].Layers.length,1);
});
test('exported model uses the Citadel texture name, one editable image, and portable assignment metadata',async()=>{
  const doc=createDemoDocument(),original=doc.serialize('mdx'),project=createPaintProject({modelName:doc.name});
  const target=createPaintMaterial(project,doc.model,{name:'Footman.blp',sourcePath:'Units\\Human\\Footman\\Footman.blp',nativeSource:true,raster:raster(),geosets:[0]});markPaintMaterialEdited(project,target);
  const result=await buildPaintExportArtifact(doc,project,new Map(),original),files=readStoredZip(new Uint8Array(await result.archive.arrayBuffer())),painted=openDocument(files.get(result.modelName),result.modelName).model;
  assert.ok(files.has('Textures/FootmanCitadel.blp'));const layers=painted.Materials[painted.Geosets[0].MaterialID].Layers,imageLayers=layers.filter(l=>!painted.Textures[l.TextureID].ReplaceableId);assert.equal(imageLayers.length,1);assert.equal(painted.Textures[imageLayers[0].TextureID].Image,'Textures\\FootmanCitadel.blp');assert.deepEqual(doc.serialize('mdx'),original);
  const preset=readStoredZip(files.get(result.projectName)),manifest=JSON.parse(new TextDecoder().decode(preset.get('project.json')));assert.equal(manifest.materialMode,true);assert.equal(manifest.targets[0].material.Layers.filter(l=>l.TextureID===target.textureId).length,1);assert.equal(manifest.targets[0].citadelCopy,true);
});

test('current-skin migration chooses the first image layer per geoset rather than global texture order',()=>{
  const model=paintFixtureModel([triangleGeoset(),triangleGeoset({materialId:1})]);model.Textures.push({Image:'Base2.blp',ReplaceableId:0,Flags:0});
  model.Materials.push({Layers:[{...model.Materials[0].Layers[0],TextureID:1},{...model.Materials[0].Layers[0],TextureID:0}]});
  const project=createPaintProject();for(const t of enumeratePaintTargets(model))addPaintProjectTarget(project,t,raster());
  assert.equal(project.targets[0].textureId,0);enablePaintMaterials(project,model);
  const first=project.targets.find(t=>t.sourcePath==='Textures\\Fixture.blp'),second=project.targets.find(t=>t.sourcePath==='Base2.blp');
  assert.deepEqual(first.geosetIndices,[0]);assert.deepEqual(second.geosetIndices,[1]);validatePaintAssignments(project,model);
});
