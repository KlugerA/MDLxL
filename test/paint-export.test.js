import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBLP, getBLPImageData } from 'war3-model';
import { createDemoDocument, openDocument, EditorDocument } from '../src/editor-document.js';
import { buildPaintExportArtifact, buildPaintProjectArtifact } from '../src/paint-export.js';
import { addPaintProjectTarget, createPaintProject, readStoredZip, recordPaintUV } from '../src/paint-project.js';
import { createPaintRaster } from '../src/paint-raster.js';
import { enumeratePaintTargets, installFreshPaintLayer } from '../src/paint-targets.js';
import {createPaintMaterial,repairPaintMaterials} from '../src/paint-materials.js';
import {paintProjectModel} from '../src/paint-view.js';

const asBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);

test('UV and fresh texture names export in a model copy; preview lamps never become model lights',async()=>{
  const doc=createDemoDocument();doc.apply('Layer',['Materials','Textures'],m=>installFreshPaintLayer(m,0,'OldName.blp'));
  const original=doc.serialize('mdx'),snapshot=structuredClone(doc.model),project=createPaintProject({sourceMode:'primer'}),target=enumeratePaintTargets(doc.model).find(t=>t.texturePath==='OldName.blp');
  addPaintProjectTarget(project,target,createPaintRaster(256,256,[40,80,120,255])).paintName='New armour';
  const uv=doc.model.Geosets[0].TVertices[0],after=Float32Array.from(uv,v=>v+.1);recordPaintUV(project,'0:0',uv,after);project.viewSettings={lighting:'dnc',hour:0,lamps:[{intensity:8,color:'#ff0000'}]};
  const result=await buildPaintExportArtifact(doc,project,new Map(),original),files=readStoredZip(new Uint8Array(await result.archive.arrayBuffer())),painted=openDocument(files.get(result.modelName),result.modelName);
  assert.ok(painted.model.Geosets[0].TVertices[0].every((value,i)=>Math.abs(value-after[i])<1e-6));assert.equal(painted.model.Lights.length,doc.model.Lights.length);assert.match(result.textures[0].name,/New-armour_paint_/);assert.doesNotMatch(result.textures[0].name,/OldName/);assert.deepEqual(doc.model,snapshot);assert.deepEqual(doc.serialize('mdx'),original);
});

for(const [format,resolution] of [['mdl',256],['mdx',512]])test(`paint/export/reopen vertical slice works for ${format.toUpperCase()} v800 at ${resolution}×${resolution}`,async()=>{
  const source=createDemoDocument().serialize(format),doc=openDocument(source,`Hero.${format}`);
  doc.apply('Add paint layer',['Materials','Textures'],model=>{
    installFreshPaintLayer(model,0,'MDLxL_Forge\\primer.blp');
    model.Textures.push({Image:'MDLxL_Forge\\Hero_paint_1.blp',ReplaceableId:0,Flags:0});
  });
  const target=enumeratePaintTargets(doc.model).find(item=>item.texturePath.endsWith('primer.blp')),project=createPaintProject({modelName:doc.name,resolution,sourceMode:'primer'}),entry=addPaintProjectTarget(project,target,createPaintRaster(resolution,resolution,[110,112,105,255]));
  entry.paintName='Hero';entry.coats[0].raster.data.set([60,130,40,255],(Math.floor(resolution/2)*resolution+Math.floor(resolution/2))*4);project.dirty=true;
  const result=await buildPaintExportArtifact(doc,project,new Map(),doc.originalBytes),zip=new Uint8Array(await result.archive.arrayBuffer()),files=readStoredZip(zip);
  assert.ok(result.modelName.endsWith(`.${format}`));assert.ok(result.projectName.endsWith('.mdlxlpaint'));assert.equal(result.textures.length,1);
  assert.match(result.textures[0].name,/^MDLxL_Forge\/Hero_paint_2\.blp$/i);
  const modelBytes=files.get(result.modelName),paintBytes=files.get(result.projectName),blpBytes=files.get(result.textures[0].name);
  assert.ok(modelBytes);assert.ok(paintBytes);assert.ok(blpBytes);assert.ok(files.has('MDLxL_Forge/paint-export.json'));
  const reopened=openDocument(modelBytes,result.modelName);assert.equal(reopened.model.Version,800);assert.equal(reopened.model.Textures[target.textureId].Image,result.textures[0].name.replaceAll('/','\\'));
  const decoded=getBLPImageData(decodeBLP(asBuffer(blpBytes)),0);assert.deepEqual([decoded.width,decoded.height],[resolution,resolution]);
  const projectFiles=readStoredZip(paintBytes),manifest=JSON.parse(new TextDecoder().decode(projectFiles.get('project.json'))),assetManifest=JSON.parse(new TextDecoder().decode(projectFiles.get('assets/manifest.json')));
  assert.ok(projectFiles.has(manifest.modelFiles.original));assert.ok(projectFiles.has(manifest.modelFiles.working));assert.ok(projectFiles.has(manifest.targets[0].coats[0].file));assert.ok(projectFiles.has(manifest.targets[0].alphaMask));
  assert.equal(assetManifest.logicalAssetCount,50);assert.equal(assetManifest.brushTips.count,8);
  const metadata=JSON.parse(new TextDecoder().decode(files.get('MDLxL_Forge/paint-export.json')));assert.equal(metadata.textureEncoder.id,'whiteoutlib-blp1-jpeg');
});

test('on-demand targets keep untouched custom textures in export and portable project, including colliding flattened names',async()=>{
  const doc=createDemoDocument();
  doc.apply('Paint layer',['Materials','Textures'],model=>{
    installFreshPaintLayer(model,0,'MDLxL_Forge\\primer.blp');
    model.Textures.push({Image:'Custom\\a-b.blp',Flags:0,ReplaceableId:0},{Image:'Custom-a\\b.blp',Flags:0,ReplaceableId:0});
  });
  const target=enumeratePaintTargets(doc.model).find(t=>t.texturePath.endsWith('primer.blp')),project=createPaintProject();
  addPaintProjectTarget(project,target,createPaintRaster(256));
  const assets=new Map([['custom\\a-b.blp',{name:'a-b.blp',bytes:new Uint8Array([1,2,3])}],['custom-a\\b.blp',{name:'b.blp',bytes:new Uint8Array([4,5,6])}]]);
  const portable=readStoredZip(new Uint8Array(await (await buildPaintProjectArtifact(doc,project,assets)).arrayBuffer()));
  const manifest=JSON.parse(new TextDecoder().decode(portable.get('project.json')));
  assert.equal(manifest.sourceTextures.length,2);assert.notEqual(manifest.sourceTextures[0].file,manifest.sourceTextures[1].file);
  const exported=await buildPaintExportArtifact(doc,project,assets),files=readStoredZip(new Uint8Array(await exported.archive.arrayBuffer()));
  assert.deepEqual(files.get('Custom/a-b.blp'),new Uint8Array([1,2,3]));assert.deepEqual(files.get('Custom-a/b.blp'),new Uint8Array([4,5,6]));
  assert.equal(project.targets.length,1);
});

test('saving a migrated preset or Warcraft export before Apply restores the original helper material',async()=>{
  const doc=createDemoDocument();
  doc.apply('Fixture with a model skin and helper plane',['Textures','Materials','Geosets'],model=>{
    installFreshPaintLayer(model,0,'OriginalSkin.blp');
    const textureId=model.Textures.length,materialId=model.Materials.length;
    model.Textures.push({Image:'',ReplaceableId:2,Flags:0});
    model.Materials.push({PriorityPlane:0,RenderMode:0,Layers:[{FilterMode:3,Shading:1,TextureID:textureId,TVertexAnimId:null,CoordId:0,Alpha:1}]});
    model.Geosets.push({...structuredClone(model.Geosets[0]),MaterialID:materialId});
  });
  const original=doc.serialize('mdx'),originalModel=structuredClone(doc.model),helper=doc.model.Geosets.length-1;
  const project=createPaintProject({sourceMode:'primer'}),target=createPaintMaterial(project,doc.model,{name:'Armour',raster:createPaintRaster(256,256,[60,130,170,255]),geosets:doc.model.Geosets.map((_,i)=>i)});
  const badWorking=paintProjectModel(doc.model,project);
  badWorking.Geosets[helper].MaterialID=target.materialId;
  assert.equal(badWorking.Geosets[helper].MaterialID,target.materialId,'Reproduce the rejected build material assignment');
  repairPaintMaterials(project,originalModel);
  const staged=EditorDocument.restoreRecoveryState(doc.captureRecoveryState({includeHistory:false}));staged.model=badWorking;
  const verify=bytes=>{
    const reopened=openDocument(bytes,'check.mdx'),geo=reopened.model.Geosets[helper];
    assert.equal(geo.MaterialID,originalModel.Geosets[helper].MaterialID);
    const textureId=reopened.model.Materials[geo.MaterialID].Layers[0].TextureID;
    assert.equal(reopened.model.Textures[textureId].ReplaceableId,2,'Helper remains the original replaceable glow, not painted skin');
  };
  const preset=readStoredZip(new Uint8Array(await (await buildPaintProjectArtifact(staged,project,new Map(),original)).arrayBuffer()));
  const manifest=JSON.parse(new TextDecoder().decode(preset.get('project.json')));
  verify(preset.get(manifest.modelFiles.working));assert.deepEqual(preset.get(manifest.modelFiles.original),original);
  const exported=await buildPaintExportArtifact(staged,project,new Map(),original),files=readStoredZip(new Uint8Array(await exported.archive.arrayBuffer()));
  verify(files.get(exported.modelName));
  const bundledPreset=readStoredZip(files.get(exported.projectName)),bundledManifest=JSON.parse(new TextDecoder().decode(bundledPreset.get('project.json')));
  verify(bundledPreset.get(bundledManifest.modelFiles.working));
  assert.equal(staged.model.Geosets[helper].MaterialID,target.materialId,'Saving does not mutate the current working model');
});
