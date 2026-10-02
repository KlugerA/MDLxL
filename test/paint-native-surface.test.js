import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaintProject,addPaintProjectTarget,compositePaintTarget,recordPaintSurfaceChange,travelPaintHistory,restorePaintProject,paintProjectArchive,recordPaintStroke,encodePaintPng,decodePaintPng} from '../src/paint-project.js';
import {createPaintRaster,clonePaintRaster} from '../src/paint-raster.js';
import {enablePaintMaterials,validatePaintAssignments,createPaintMaterial} from '../src/paint-materials.js';
import {enumeratePaintTargets} from '../src/paint-targets.js';
import {paintProjectModel,paintGeosetMask} from '../src/paint-view.js';
import {preparePaintSurfaceChange} from '../src/paint-surface.js';
import {regionPaintTarget,connectedPaintFaces} from '../src/paint-region.js';
import {paintFixtureModel,triangleGeoset,squareSeamGeoset,IDENTITY_MATRIX} from './fixtures/paint-fixtures.js';
import {preparePaintProjection,stampProjectedBrush} from '../src/paint-projection.js';
import {buildPaintProjectArtifact} from '../src/paint-export.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {preparePaintModelCommit,commitPaintModel,adoptCommittedPaintUVs} from '../src/paint-model-integration.js';

const decodePng=decodePaintPng;
function preserved(model,width=128,height=64){const project=createPaintProject({sourceMode:'current'});project.preserveMaterials=true;for(const target of enumeratePaintTargets(model))addPaintProjectTarget(project,target,createPaintRaster(width,height,[52,94,133,190]));enablePaintMaterials(project,model);return project;}

test('portable layers preserve straight RGBA bytes at every alpha, including transparent pigment',async()=>{
  const model=paintFixtureModel([triangleGeoset()]),project=preserved(model,256,2),target=project.targets[0];
  for(const raster of [target.base,target.alphaMask,...target.coats.map(c=>c.raster)])for(let p=0;p<raster.data.length;p+=4)raster.data.set([(p*3+97)%256,(p*13+169)%256,(p*7+213)%256,(p/4)%256],p);
  const png=await encodePaintPng(target.coats[0].raster);assert.deepEqual(await decodePaintPng(png),target.coats[0].raster);
  const archive=await paintProjectArchive(project,{modelBytes:new Uint8Array([1,2,3])}),reopened=(await restorePaintProject(new Uint8Array(await archive.arrayBuffer()))).project.targets[0];
  assert.deepEqual(reopened.base,target.base);assert.deepEqual(reopened.alphaMask,target.alphaMask);for(let i=0;i<target.coats.length;i++)assert.deepEqual(reopened.coats[i].raster,target.coats[i].raster);
  await assert.rejects(decodePaintPng(png.slice(0,-1)),/truncated/);const corrupt=png.slice();corrupt[40]^=1;await assert.rejects(decodePaintPng(corrupt),/checksum/);
});

test('current-skin setup keeps full materials, animated properties, UV sets and nonpaint users',async()=>{
  const model=paintFixtureModel([triangleGeoset()]);model.Geosets[0].TVertices.push(Float32Array.from(model.Geosets[0].TVertices[0],v=>v*.6));
  model.Textures.push({Image:'Overlay.blp',Flags:0,ReplaceableId:0},{Image:'',Flags:0,ReplaceableId:1});
  model.Materials[0]={PriorityPlane:3,RenderMode:1,Layers:[{TextureID:2,CoordId:0,FilterMode:0,Alpha:1},{TextureID:0,CoordId:1,FilterMode:2,Shading:16,Alpha:{LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([.4])}]}},{TextureID:1,CoordId:0,FilterMode:3,Shading:2,Alpha:.6}]};
  model.ParticleEmitters2=[{TextureID:0}];const before=structuredClone(model),project=preserved(model),painted=paintProjectModel(model,project);
  assert.equal(project.targets.length,2);assert.deepEqual(model,before);assert.deepEqual(painted.Materials[0],before.Materials[0]);assert.deepEqual(painted.Textures.slice(0,3),before.Textures);assert.deepEqual(painted.ParticleEmitters2,before.ParticleEmitters2);
  const layers=painted.Materials[painted.Geosets[0].MaterialID].Layers;
  assert.equal(layers.length,3);assert.deepEqual(layers[0],before.Materials[0].Layers[0]);
  for(let i=1;i<3;i++){const expected={...before.Materials[0].Layers[i],TextureID:project.targets[i-1].textureId};assert.deepEqual(layers[i],expected);}
  assert.deepEqual(painted.Geosets[0].TVertices,before.Geosets[0].TVertices);assert.deepEqual([project.targets[0].base.width,project.targets[0].base.height],[128,64]);
  const archive=await paintProjectArchive(project,{modelBytes:new Uint8Array([1,2,3])}),restored=(await restorePaintProject(new Uint8Array(await archive.arrayBuffer()),decodePng)).project;
  assert.deepEqual(restored.preservedMaterials,project.preservedMaterials);assert.ok(restored.preservedMaterials[0].material.Layers[1].Alpha.Keys[0].Vector instanceof Float32Array);validatePaintAssignments(restored,model);
  assert.deepEqual(compositePaintTarget(restored),compositePaintTarget(project));
  const imported=createPaintMaterial(project,painted,{name:'Long wood',raster:createPaintRaster(240,47,[80,60,40,255]),geosets:[0],basecoat:false});
  const replaced=paintProjectModel(model,project);assert.equal(replaced.Materials[replaced.Geosets[0].MaterialID].Layers[1].TextureID,imported.textureId);assert.deepEqual(replaced.Materials[replaced.Geosets[0].MaterialID].Layers[2],layers[2]);validatePaintAssignments(project,model);
});

test('rectangular destination resize is one reversible operation including every coat and alpha',()=>{
  const model=paintFixtureModel([triangleGeoset()]),project=preserved(model),target=project.targets[0];target.coats[1].raster.data.set([200,20,40,180],0);target.alphaMask.data[3]=24;const before=structuredClone(target);
  recordPaintSurfaceChange(project,target.id,preparePaintSurfaceChange(paintProjectModel(model,project),project,target,{resolution:512}),'Resize');let next=project.targets[0];
  assert.deepEqual([next.base.width,next.base.height],[512,256]);assert.equal(next.coats[1].raster.data[3],180);assert.equal(next.alphaMask.data[3],24);assert.deepEqual(next.bindings,before.bindings);
  travelPaintHistory(project);assert.deepEqual(project.targets[0],before);travelPaintHistory(project,true);assert.deepEqual([project.targets[0].base.width,project.targets[0].base.height],[512,256]);
  travelPaintHistory(project);const coat=project.targets[0].coats[0],raster=clonePaintRaster(coat.raster);coat.raster.data.set([1,2,3,255],0);recordPaintStroke(project,target.id,coat.id,raster);assert.equal(project.history.redo.length,0);assert.ok(project.history.usedBytes>=0);
});


test('unique surface rebakes skin, coats and alpha while splitting shared UVs and retaining rig streams',()=>{
  const model=paintFixtureModel([triangleGeoset(),triangleGeoset()]);model.Geosets[1].Vertices=Float32Array.from(model.Geosets[1].Vertices,(v,i)=>v+(i%3===0?3:0));
  for(const geo of model.Geosets){const n=geo.Vertices.length/3;geo.VertexGroup=new Uint8Array(n);geo.Groups=[[0]];geo.Tangents=new Float32Array(n*4).fill(.5);geo.SkinWeights=new Uint8Array(n*8).fill(1);}
  const before=structuredClone(model),project=preserved(model),target=project.targets[0];target.coats[0].raster=createPaintRaster(128,64,[220,30,40,80]);target.alphaMask=createPaintRaster(128,64,[255,255,255,145]);
  recordPaintSurfaceChange(project,target.id,preparePaintSurfaceChange(paintProjectModel(model,project),project,target,{resolution:256,unique:true}),'Unique');
  const changed=paintProjectModel(model,project),next=project.targets[0],masks=next.bindings.map(binding=>paintGeosetMask(changed,{...next,bindings:[binding]},256));
  assert.equal(masks[0].some((v,i)=>v&&masks[1][i]),false);assert.equal(next.sharedUV,false);assert.equal(next.flags,0);
  for(let p=0;p<256*256;p++)if(masks[0][p]||masks[1][p]){assert.deepEqual([...next.base.data.subarray(p*4,p*4+4)],[52,94,133,190]);assert.equal(next.coats[0].raster.data[p*4+3],80);assert.equal(next.alphaMask.data[p*4+3],145);}
  for(let i=0;i<2;i++){for(const key of ['Vertices','Normals','VertexGroup','Groups','Tangents','SkinWeights','Faces'])assert.deepEqual(changed.Geosets[i][key],before.Geosets[i][key]);assert.deepEqual(changed.Geosets[i].TVertices[0],before.Geosets[i].TVertices[0]);}
  assert.deepEqual(model,before);validatePaintAssignments(project,model);
  travelPaintHistory(project);assert.deepEqual(paintProjectModel(model,project).Geosets.map(g=>g.TVertices),before.Geosets.map(g=>g.TVertices));travelPaintHistory(project,true);assert.deepEqual(paintProjectModel(model,project),changed);
});


test('unsupported rig streams and animated UV mapping reject unique mapping atomically',()=>{
  const model=paintFixtureModel([triangleGeoset()]),project=preserved(model),target=project.targets[0],working=paintProjectModel(model,project);
  working.Materials[working.Geosets[0].MaterialID].Layers[0].TVertexAnimId=0;const before=structuredClone(project);
  assert.throws(()=>preparePaintSurfaceChange(working,project,target,{unique:true}),/animated UVs/);assert.deepEqual(project,before);
  delete working.Materials[working.Geosets[0].MaterialID].Layers[0].TVertexAnimId;working.Geosets[0].SkinWeights=new Uint8Array(2);
  assert.throws(()=>preparePaintSurfaceChange(working,project,target,{unique:true}),/unsupported SkinWeights/);assert.deepEqual(project,before);
});

test('rebaking a painted edge preserves its pigment without dark transparent fringes',()=>{
  const model=paintFixtureModel([triangleGeoset()]),project=preserved(model,2,2),target=project.targets[0];target.coats[0].raster.data.set([230,80,40,255],0);
  const next=preparePaintSurfaceChange(paintProjectModel(model,project),project,target,{resolution:256,unique:true}).target.coats[0].raster;let edge=0;
  for(let p=0;p<next.data.length;p+=4)if(next.data[p+3]>0&&next.data[p+3]<255){assert.deepEqual([...next.data.subarray(p,p+3)],[230,80,40]);edge++;}assert.ok(edge>100);
});

test('region masks restrict projected paint to selected faces and connected selection crosses geometric seams',()=>{
  const model=paintFixtureModel([squareSeamGeoset()]),project=preserved(model,128,128),target=project.targets[0],working=paintProjectModel(model,project),region={geosetIndex:0,faces:new Set([0])},scoped=regionPaintTarget(target,region),projection=preparePaintProjection(working,scoped,IDENTITY_MATRIX,128,128),raster=createPaintRaster(128);
  assert.equal(connectedPaintFaces(model.Geosets[0],0).size,2);
  stampProjectedBrush(raster,projection,{x:64,y:64},{mode:'paint',size:180,opacity:1,strength:1,hardness:1,color:'#ff0000',zoom:1},{mask:paintGeosetMask(working,scoped,128)});
  const allowed=paintGeosetMask(working,scoped,128);let count=0;for(let i=0;i<allowed.length;i++)if(raster.data[i*4+3]){assert.ok(allowed[i]);count++;}assert.ok(count>100);
});

test('unique surface saves and reopens in portable project and applied MDX without repeating UV changes',async()=>{
  const doc=createDemoDocument();doc.model.Textures[0]={Image:'Skin.blp',ReplaceableId:0,Flags:0};const original=structuredClone(doc.model),bytes=doc.serialize('mdx'),project=preserved(doc.model),target=project.targets[0];
  recordPaintSurfaceChange(project,target.id,preparePaintSurfaceChange(paintProjectModel(doc.model,project),project,target,{resolution:256,unique:true}),'Unique');
  const painted=paintProjectModel(doc.model,project),artifact=await buildPaintProjectArtifact(doc,project,new Map(),bytes),restored=await restorePaintProject(new Uint8Array(await artifact.arrayBuffer()),decodePng),working=openDocument(restored.workingModelBytes,'reopened.mdx');
  assert.deepEqual(restored.originalModelBytes,bytes);validatePaintAssignments(restored.project,working.model);const reopened=paintProjectModel(working.model,restored.project);
  assert.deepEqual(reopened.Geosets[0].TVertices,painted.Geosets[0].TVertices);assert.deepEqual(compositePaintTarget(restored.project),compositePaintTarget(project));
  const prepared=await preparePaintModelCommit(doc.model,project,original);commitPaintModel(doc,prepared);adoptCommittedPaintUVs(project);assert.deepEqual(project.geometryEdits,{});
  const saved=openDocument(doc.serialize('mdx'),'painted.mdx');assert.deepEqual(saved.model.Geosets[0].TVertices,painted.Geosets[0].TVertices);
  doc.apply('Move vertex',['Geosets'],m=>{m.Geosets[0].Vertices[0]+=8;});assert.equal(paintProjectModel(doc.model,project).Geosets[0].Vertices[0],doc.model.Geosets[0].Vertices[0]);
  travelPaintHistory(project);assert.deepEqual(paintProjectModel(doc.model,project).Geosets[0].TVertices,original.Geosets[0].TVertices,'surface undo still restores authored geometry after applying to model');
});
