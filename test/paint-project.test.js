import test from 'node:test';
import assert from 'node:assert/strict';
import { addPaintProjectTarget, compositePaintTarget, createPaintProject, markPaintProjectSaved, paintProjectArchive, paintProjectCoat, readStoredZip, recordPaintStroke, recordPaintStrokeGroup, recordPaintUV, replacePaintTexture, restorePaintProject, travelPaintHistory } from '../src/paint-project.js';
import { clonePaintRaster, createPaintRaster } from '../src/paint-raster.js';
import { paintTarget,paintFixtureModel,triangleGeoset } from './fixtures/paint-fixtures.js';
import {enablePaintMaterials,validatePaintAssignments} from '../src/paint-materials.js';
import {enumeratePaintTargets} from '../src/paint-targets.js';

async function decodeOwnPng(bytes){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),view=new DataView(data.buffer,data.byteOffset,data.byteLength);assert.deepEqual([...data.slice(0,8)],[137,80,78,71,13,10,26,10]);
  let offset=8,width=0,height=0;const parts=[];
  while(offset+12<=data.length){const length=view.getUint32(offset),name=new TextDecoder().decode(data.slice(offset+4,offset+8)),part=data.slice(offset+8,offset+8+length);offset+=length+12;if(name==='IHDR'){const header=new DataView(part.buffer,part.byteOffset,part.byteLength);width=header.getUint32(0);height=header.getUint32(4);}else if(name==='IDAT')parts.push(part);else if(name==='IEND')break;}
  const packed=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let cursor=0;for(const part of parts){packed.set(part,cursor);cursor+=part.length;}
  const raw=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()),pixels=new Uint8ClampedArray(width*height*4),stride=width*4+1;
  for(let y=0;y<height;y++){assert.equal(raw[y*stride],0);pixels.set(raw.subarray(y*stride+1,(y+1)*stride),y*width*4);}
  return{width,height,data:pixels};
}

test('fresh named textures, UV edits and preview lamps reopen without changing original pixels; mixed undo works',async()=>{
  const project=createPaintProject({sourceMode:'primer'}),target=addPaintProjectTarget(project,paintTarget(),createPaintRaster(256,256,[15,25,35,255])),coat=paintProjectCoat(project),base=target.base.data.slice();
  assert.equal(target.paintName,'Texture 1');target.paintName='Armour';
  const before=clonePaintRaster(coat.raster);coat.raster.data.set([200,100,50,255],0);recordPaintStroke(project,target.id,coat.id,before);
  recordPaintUV(project,'0:0',new Float32Array([0,0,1,0,0,1]),new Float32Array([.25,0,1,0,0,1]));
  travelPaintHistory(project);assert.equal(project.uvEdits['0:0'][0],0);assert.equal(coat.raster.data[3],255);
  travelPaintHistory(project);assert.equal(coat.raster.data[3],0);travelPaintHistory(project,true);travelPaintHistory(project,true);assert.equal(project.uvEdits['0:0'][0],.25);
  project.viewSettings={hour:18,lighting:'dnc',lamps:[{color:'#ff8800',intensity:2,position:[1,2,3],target:[0,0,0]}]};
  const blob=await paintProjectArchive(project,{modelBytes:new Uint8Array([1,2,3])});const restored=await restorePaintProject(new Uint8Array(await blob.arrayBuffer()),decodeOwnPng);
  assert.equal(restored.project.targets[0].paintName,'Armour');assert.deepEqual(restored.project.uvEdits,project.uvEdits);assert.deepEqual(restored.project.viewSettings,project.viewSettings);assert.deepEqual(target.base.data,base);assert.equal(restored.project.history.undo.length,0);
});

test('Use as texture replaces RGB and alpha together, and one undo restores both',()=>{
  const project=createPaintProject({sourceMode:'primer'}),target=addPaintProjectTarget(project,paintTarget(),createPaintRaster(256,256,[50,60,70,255])),original=compositePaintTarget(project),source=createPaintRaster(256,256,[200,100,20,255]);source.data[3]=0;
  assert.equal(replacePaintTexture(project,target.id,'base',source),true);let result=compositePaintTarget(project);assert.equal(result.data[3],0);assert.deepEqual([...result.data.slice(4,8)],[200,100,20,255]);assert.equal(project.history.undo.length,1);
  travelPaintHistory(project);assert.deepEqual(compositePaintTarget(project).data,original.data);travelPaintHistory(project,true);assert.deepEqual(compositePaintTarget(project).data,result.data);
});

test('projects enforce v1 resolution and stroke history is bounded, branch-safe, and alpha-aware',()=>{
  assert.throws(()=>createPaintProject({resolution:128}),/256/);
  const project=createPaintProject({modelName:'Hero.mdx',resolution:256,historyBudgetBytes:8*1024*1024}),target=addPaintProjectTarget(project,paintTarget(),createPaintRaster(256,256,[20,30,40,127])),coat=paintProjectCoat(project);
  const before=clonePaintRaster(coat.raster);coat.raster.data.set([200,100,50,255],0);
  assert.equal(recordPaintStroke(project,target.id,coat.id,before,'Basecoat',{id:'basecoat',tipId:'painted_bristle',materialId:'orc_green'}),true);
  assert.deepEqual(project.brushReferences,[{presetId:'basecoat',tipId:'painted_bristle',materialId:'orc_green'}]);
  travelPaintHistory(project);assert.deepEqual([...coat.raster.data.slice(0,4)],[0,0,0,0]);
  travelPaintHistory(project,true);assert.deepEqual([...coat.raster.data.slice(0,4)],[200,100,50,255]);
  travelPaintHistory(project);const branchBefore=clonePaintRaster(coat.raster);coat.raster.data.set([4,5,6,255],4);recordPaintStroke(project,target.id,coat.id,branchBefore,'Branch');
  assert.equal(project.history.redo.length,0);assert.ok(project.history.usedBytes<=project.history.budgetBytes);
  const alpha=paintProjectCoat(project,target.id,'__alpha'),alphaBefore=clonePaintRaster(alpha.raster);alpha.raster.data[3]=0;recordPaintStroke(project,target.id,'__alpha',alphaBefore,'Erase',{id:'eraser'});
  assert.equal(compositePaintTarget(project,target.id).data[3],0);
  travelPaintHistory(project);assert.equal(compositePaintTarget(project,target.id).data[3],127);
  markPaintProjectSaved(project);assert.equal(project.dirty,false);
});

test('one free-paint gesture across materials is one undo and redo step',()=>{
  const project=createPaintProject({sourceMode:'primer'}),first=addPaintProjectTarget(project,{...paintTarget([0]),id:'first'},createPaintRaster(256)),second=addPaintProjectTarget(project,{...paintTarget([1]),id:'second',textureId:1},createPaintRaster(256));
  const firstCoat=paintProjectCoat(project,first.id),secondCoat=paintProjectCoat(project,second.id),firstBefore=clonePaintRaster(firstCoat.raster),secondBefore=clonePaintRaster(secondCoat.raster);
  firstCoat.raster.data.set([220,30,10,255],0);secondCoat.raster.data.set([10,40,230,255],0);
  assert.equal(recordPaintStrokeGroup(project,[{targetId:first.id,coatId:firstCoat.id,before:firstBefore},{targetId:second.id,coatId:secondCoat.id,before:secondBefore}],'Free Paint',{id:'normal'}),true);
  assert.equal(project.history.undo.length,1);travelPaintHistory(project);assert.deepEqual([...firstCoat.raster.data.slice(0,4)],[0,0,0,0]);assert.deepEqual([...secondCoat.raster.data.slice(0,4)],[0,0,0,0]);
  travelPaintHistory(project,true);assert.deepEqual([...firstCoat.raster.data.slice(0,4)],[220,30,10,255]);assert.deepEqual([...secondCoat.raster.data.slice(0,4)],[10,40,230,255]);
});

test('portable project ZIP restores source/coat/alpha pixels, both model copies, texture sources, and provenance',async()=>{
  const project=createPaintProject({modelName:'Hero.mdx',resolution:256,sourceMode:'current'}),target=addPaintProjectTarget(project,paintTarget(),createPaintRaster(256,256,[11,22,33,44]));
  project.generatedUVSets={0:1};project.paintAtlasVersion=1;target.generatedUV=true;
  target.coats[2].raster.data.set([90,80,70,200],(9*256+7)*4);target.alphaMask.data[(4*256+3)*4+3]=61;project.activeCoatId='detail';
  const original=new Uint8Array([1,2,3,4]),working=new Uint8Array([9,8,7]),source=new Uint8Array([6,5,4]);
  const blob=await paintProjectArchive(project,{modelBytes:original,workingModelBytes:working,modelName:'Hero.mdx',sourceTextures:[{name:'Textures\\Fixture.blp',bytes:source}],assetManifest:{schema:'mdlxl-paint-assets',version:1,logicalAssetCount:50}}),bytes=new Uint8Array(await blob.arrayBuffer()),files=readStoredZip(bytes);
  assert.ok(files.has('project.json'));assert.ok(files.has('layers/texture-0/alpha-mask.png'));assert.ok(files.has('assets/manifest.json'));
  const restored=await restorePaintProject(bytes,decodeOwnPng),restoredTarget=restored.project.targets[0];
  assert.deepEqual(restored.originalModelBytes,original);assert.deepEqual(restored.workingModelBytes,working);assert.deepEqual(restored.sourceTextures[0].bytes,source);
  assert.deepEqual([...restoredTarget.base.data.slice(0,4)],[11,22,33,44]);
  assert.deepEqual([...restoredTarget.coats[2].raster.data.slice((9*256+7)*4,(9*256+7)*4+4)],[90,80,70,200]);
  assert.equal(restoredTarget.alphaMask.data[(4*256+3)*4+3],61);assert.equal(restoredTarget.generatedUV,true);assert.deepEqual(restored.project.generatedUVSets,{0:1});assert.equal(restored.project.paintAtlasVersion,1);assert.equal(restored.project.dirty,false);assert.equal(restored.project.history.undo.length,0);
});

test('stored project reader rejects traversal and truncated payloads',()=>{
  const unsafe=new Uint8Array(30+6),view=new DataView(unsafe.buffer);view.setUint32(0,0x04034b50,true);view.setUint16(26,6,true);unsafe.set(new TextEncoder().encode('../x.y'),30);
  assert.throws(()=>readStoredZip(unsafe),/unsafe path/);
  const truncated=new Uint8Array(31),truncatedView=new DataView(truncated.buffer);truncatedView.setUint32(0,0x04034b50,true);truncatedView.setUint32(18,8,true);truncatedView.setUint32(22,8,true);truncatedView.setUint16(26,1,true);truncated[30]=65;
  assert.throws(()=>readStoredZip(truncated),/truncated/);
});

test('portable current-skin presets retain shared-image material variants and editable native alpha',async()=>{
  const model=paintFixtureModel([triangleGeoset(),triangleGeoset({materialId:1})]);model.Textures.push({Image:'',ReplaceableId:1,Flags:0});
  model.Materials[0].Layers[0].FilterMode=2;model.Materials.push(structuredClone(model.Materials[0]));model.Materials[0].Layers.unshift({TextureID:1,FilterMode:1,Shading:17,CoordId:0,Alpha:1});
  const project=createPaintProject({sourceMode:'current'});for(const descriptor of enumeratePaintTargets(model))addPaintProjectTarget(project,descriptor,createPaintRaster(256,256,[30,50,70,0]));enablePaintMaterials(project,model);
  const target=project.targets[0];target.coats[0].raster.data.set([180,70,30,255],0);target.revision++;
  const archive=await paintProjectArchive(project,{modelBytes:new Uint8Array([1,2,3])}),restored=await restorePaintProject(new Uint8Array(await archive.arrayBuffer()),decodeOwnPng),copy=restored.project.targets[0];
  assert.deepEqual(copy.materialVariants,target.materialVariants);assert.deepEqual(copy.bindings,target.bindings);assert.equal(copy.basecoat,false);assert.equal(copy.preserveSourceAlpha,false);assert.equal(restored.project.paintMaterialsVersion,3);
  assert.deepEqual(compositePaintTarget(restored.project),compositePaintTarget(project));validatePaintAssignments(restored.project,model);
});
