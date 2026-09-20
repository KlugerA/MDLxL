import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {createPaintProject,compositePaintTarget} from '../src/paint-project.js';
import {createPaintMaterial,paintableGeosets,repairPaintMaterials} from '../src/paint-materials.js';
import {createPaintRaster} from '../src/paint-raster.js';
import {preparePaintModelCommit,commitPaintModel,adoptCommittedPaintUVs} from '../src/paint-model-integration.js';
import {paintProjectModel} from '../src/paint-view.js';
import {retainedForgeAssets,missingForgeAssetPaths} from '../src/forge-assets.js';
import {decodePaintBlp} from '../src/paint-blp.js';
const {saveForgeAssets}=createRequire(import.meta.url)('../electron/forge-assets.cjs');
function fixture(){
  const doc=createDemoDocument(),model=doc.model;
  const body=model.Geosets[0];
  model.Textures.push({Image:'',ReplaceableId:1,Flags:0},{Image:'',ReplaceableId:2,Flags:0});
  const team=model.Textures.length-2,glow=team+1;
  model.Materials[body.MaterialID].Layers=[{FilterMode:1,Shading:17,TextureID:team,Alpha:1,CoordId:0},{FilterMode:2,Shading:16,TextureID:0,Alpha:1,CoordId:0}];
  model.Textures[0]={Image:'Body.blp',ReplaceableId:0,Flags:3};
  model.Materials.push({Layers:[{FilterMode:0,Shading:1,TextureID:glow,Alpha:1,CoordId:0}]});
  model.Geosets.push({...structuredClone(body),MaterialID:model.Materials.length-1});
  return {doc,model};
}
test('primer never adopts transparent team-colour overlay or exposes replaceable helper plane',()=>{
  const {model}=fixture(),original=structuredClone(model),project=createPaintProject({sourceMode:'primer'}),geosets=paintableGeosets(model);
  assert.ok(!geosets.includes(model.Geosets.length-1));
  const target=createPaintMaterial(project,model,{raster:createPaintRaster(256,256,[90,100,120,255]),geosets});
  assert.equal(target.material.Layers[0].FilterMode,0);assert.equal(target.flags,3);
  const painted=paintProjectModel(model,project);assert.deepEqual(painted.Geosets.at(-1),original.Geosets.at(-1));assert.deepEqual(model,original);
});
test('repair preserves every saved paint pixel and restores helpers even from an already remapped working model',()=>{
  const {model}=fixture(),project=createPaintProject({sourceMode:'primer'}),last=model.Geosets.length-1;
  const target=createPaintMaterial(project,model,{raster:createPaintRaster(256,256,[90,100,120,255]),geosets:model.Geosets.map((_,i)=>i)});
  target.material.Layers[0].FilterMode=2;target.flags=0;
  const broken=paintProjectModel(model,project),before=compositePaintTarget(project);
  assert.equal(repairPaintMaterials(project,model),true);assert.equal(repairPaintMaterials(project,model),false);
  const repaired=paintProjectModel(broken,project,model);
  assert.equal(repaired.Geosets[last].MaterialID,model.Geosets[last].MaterialID);
  assert.ok(!target.geosetIndices.includes(last));assert.equal(target.flags,3);assert.equal(target.material.Layers[0].FilterMode,0);assert.deepEqual(compositePaintTarget(project),before);
});
test('paint -> Vertices -> save/reopen -> paint retains BLP pixels, one material assignment and editable coats',async()=>{
  const doc=createDemoDocument(),original=structuredClone(doc.model),project=createPaintProject({sourceMode:'primer'});
  const target=createPaintMaterial(project,doc.model,{name:'FootmanCitadel',raster:createPaintRaster(256,256,[42,190,67,255]),geosets:paintableGeosets(doc.model)});
  repairPaintMaterials(project,original);
  const first=await preparePaintModelCommit(doc.model,project,original);commitPaintModel(doc,first);
  const assets=new Map(first.assets.map(a=>[a.name.replaceAll('/','\\').toLowerCase(),a]));
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'citadel-model-roundtrip-'));
  try{
    const file=path.join(root,'Painted.mdx'),kept=retainedForgeAssets(assets,doc.model);
    assert.equal(kept.length,1);await saveForgeAssets(file,kept);await fs.writeFile(file,doc.serialize('mdx'));
    const reopened=openDocument(await fs.readFile(file),'Painted.mdx'),binding=target.bindings[0],layers=reopened.model.Materials[reopened.model.Geosets[binding.geosetIndex].MaterialID].Layers;
    assert.equal(layers.length,1);const name=reopened.model.Textures[layers[0].TextureID].Image;
    const decoded=await decodePaintBlp(await fs.readFile(path.join(root,name.replaceAll('\\','/'))));
    assert.ok(Math.abs(decoded.data[0]-42)<8&&Math.abs(decoded.data[1]-190)<8);assert.equal(decoded.data[3],255);
    assert.deepEqual(missingForgeAssetPaths(assets,reopened.model),[]);
    const again=await preparePaintModelCommit(reopened.model,project,original);assert.equal(again.assets[0].name,first.assets[0].name,'returning must not allocate different texture identities');
    target.coats[0].raster.data.set([220,45,20,255],0);target.revision=(target.revision||0)+1;const second=await preparePaintModelCommit(reopened.model,project,original);assert.notEqual(second.assets[0].name,first.assets[0].name);assert.ok(target.coats.length>0);
    const before=doc.serialize('mdx');await assert.rejects(preparePaintModelCommit(doc.model,project,original,{encode:async()=>{throw Error('encoder failed');}}),/encoder failed/);assert.deepEqual(doc.serialize('mdx'),before);
    assert.equal(doc.undo(),true);assert.deepEqual(doc.model,original);assert.equal(doc.redo(),true);
  }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));await fs.rm(root,{recursive:true,force:true});}
});
test('adopting applied UV0 allows later main-editor UV and vertex edits to survive returning to Citadel',async()=>{
  const doc=createDemoDocument(),original=structuredClone(doc.model),project=createPaintProject({sourceMode:'primer'}),geo=doc.model.Geosets[0];
  geo.TVertices.push(new Float32Array(geo.TVertices[0]));doc.model.Materials[geo.MaterialID].Layers[0].CoordId=1;
  const target=createPaintMaterial(project,doc.model,{raster:createPaintRaster(256,256,[42,190,67,255]),geosets:[0]});
  project.uvEdits['0:0']=Array.from(geo.TVertices[1],v=>v*.8);
  const first=await preparePaintModelCommit(doc.model,project,original);commitPaintModel(doc,first);adoptCommittedPaintUVs(project);
  assert.equal(target.bindings[0].sourceCoordId,0);assert.deepEqual(project.uvEdits,{});
  doc.apply('Edit vertex and UV',['Geosets'],m=>{m.Geosets[0].Vertices[0]+=3;m.Geosets[0].TVertices[0][0]=.314;});
  const returned=paintProjectModel(structuredClone(doc.model),project,original);
  assert.equal(returned.Geosets[0].Vertices[0],doc.model.Geosets[0].Vertices[0]);assert.equal(returned.Geosets[0].TVertices[0][0],doc.model.Geosets[0].TVertices[0][0]);
});
