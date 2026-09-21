import {addPaintProjectTarget} from './paint-project.js';
import {enumeratePaintTargets} from './paint-targets.js';

/** Each managed geoset has one material and one editable paint image. Warcraft
 * team colour remains an engine underlay, not another user paint texture. Image
 * sharing may require material variants when source geosets use different alpha
 * semantics. Source model materials and native images remain immutable.
 * Validate/decode first, then commit assignments together; a failed import must
 * leave the existing target, paint and material bindings intact. */
export function paintTextureStem(value){return String(value||'Texture').split(/[\\/]/).at(-1).replace(/\.(blp|png|jpe?g|webp|dds|tga)$/i,'').trim()||'Texture';}
export function uniquePaintTextureName(project,value,exceptId=null){
  const stem=paintTextureStem(value).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,80)||'Texture';
  const used=new Set(project.targets.filter(t=>t.id!==exceptId).map(t=>String(t.paintName||paintTextureStem(t.label)).toLowerCase()));
  let name=stem,suffix=2;while(used.has(name.toLowerCase()))name=stem+' '+suffix++;return name;
}
const layerFor=(model,geo)=>{
  const material=model.Materials?.[model.Geosets[geo]?.MaterialID];
  return material?.Layers?.find(l=>Number.isInteger(l.TextureID)&&model.Textures?.[l.TextureID]?.Image&&!model.Textures[l.TextureID].ReplaceableId)||material?.Layers?.[0]||{};
};
const materialEntries=target=>[{materialId:target.materialId,material:target.material},...(target.materialVariants||[])];
function nextIndex(project,model,key,collection){
  const entries=key==='materialId'?project.targets.flatMap(materialEntries):project.targets;
  return Math.max(model[collection]?.length||0,...entries.map(t=>Number.isInteger(t[key])?t[key]+1:0));
}
function materialTemplate(model,index,textureId,basecoat,sourceLayer=null){
  const source=model.Materials?.[model.Geosets[index]?.MaterialID]||{},layers=source.Layers||[];
  const imageIndex=layers.findIndex(l=>Number.isInteger(l.TextureID)&&model.Textures?.[l.TextureID]?.Image&&!model.Textures[l.TextureID].ReplaceableId),image=sourceLayer||layers[imageIndex]||{};
  const underlays=basecoat?[]:layers.slice(0,imageIndex<0?layers.length:imageIndex).filter(l=>model.Textures?.[l.TextureID]?.ReplaceableId===1).map(l=>({...structuredClone(l),CoordId:0}));
  const layer={FilterMode:basecoat?0:imageIndex<0&&underlays.length?2:Number(image.FilterMode)||0,Shading:basecoat?Number(layerFor(model,index).Shading)&16:Number(image.Shading??(Number(layers[0]?.Shading)&16)),TextureID:textureId,TVertexAnimId:null,CoordId:0,Alpha:basecoat?1:structuredClone(image.Alpha??1)};
  return {...structuredClone(source),PriorityPlane:source.PriorityPlane||0,RenderMode:source.RenderMode||0,Layers:[...underlays,layer]};
}
function bindingMaterial(project,model,target,material){
  const signature=JSON.stringify(material),existing=materialEntries(target).find(entry=>JSON.stringify(entry.material)===signature);
  if(existing)return existing;
  const entry={materialId:nextIndex(project,model,'materialId','Materials'),material};(target.materialVariants||=[]).push(entry);return entry;
}
function updateTargetBindings(target,bindings){
  target.bindings=bindings;target.geosetIndices=bindings.map(b=>b.geosetIndex);target.materialIds=materialEntries(target).map(m=>m.materialId);target.sharedUV=bindings.length>1;
}
function sourceFor(model,sourceModel,index){return sourceModel?.Geosets?.[index]?sourceModel:model;}
export function paintableGeosets(model,{requireUV=true}={}){
  if(!requireUV)return model.Geosets.map((g,i)=>{
    const layers=model.Materials?.[g.MaterialID]?.Layers||[],teamGlowOnly=layers.length&&layers.every(l=>model.Textures?.[l.TextureID]?.ReplaceableId===2);
    return !teamGlowOnly&&g.Vertices?.length&&g.Faces?.length?i:-1;
  }).filter(i=>i>=0);
  const imageParts=new Set(enumeratePaintTargets(model).flatMap(t=>t.geosetIndices));
  // Solid team-colour geometry can receive a new basecoat too. Team-glow
  // billboard planes (replaceable 2) are view helpers, never the miniature.
  model.Geosets.forEach((g,i)=>{if(model.Materials?.[g.MaterialID]?.Layers?.some(l=>model.Textures?.[l.TextureID]?.ReplaceableId===1))imageParts.add(i);});
  return model.Geosets.map((g,i)=>imageParts.has(i)&&g.Vertices?.length&&g.TVertices?.some(uv=>uv?.length===g.Vertices.length/3*2)?i:-1).filter(i=>i>=0);
}
/** Older primer presets accidentally painted replaceable helper planes and
 * inherited the skin's transparent overlay. Repair assignments, never pixels.
 * Classification always uses the original materials, before Citadel remaps them. */
export function repairPaintMaterials(project,sourceModel,validationModel=sourceModel){
  if(!project?.materialMode||project.paintMaterialsVersion===3)return false;
  const eligible=new Set(paintableGeosets(sourceModel,{requireUV:!project.paintAtlasVersion}));
  const staged={...project,targets:project.targets.map(target=>({...target,bindings:target.bindings.filter(b=>eligible.has(b.geosetIndex)),materialVariants:[]}))};
  for(const target of staged.targets){
    target.basecoat??=project.sourceMode==='primer'&&!target.nativeSource&&!target.sourcePath;
    target.preserveSourceAlpha??=false;
    target.revision=(target.revision||0)+1;
    const first=target.bindings[0]?.geosetIndex;
    target.material=materialTemplate(sourceModel,first,target.textureId,target.basecoat);
    if(target.basecoat){const source=layerFor(sourceModel,first);target.flags=target.generatedUV?0:Number(sourceModel.Textures?.[source.TextureID]?.Flags)||0;}
    updateTargetBindings(target,target.bindings.map(binding=>{
      const entry=bindingMaterial(staged,sourceModel,target,materialTemplate(sourceModel,binding.geosetIndex,target.textureId,target.basecoat));
      return {...binding,materialId:entry.materialId,layerIndex:entry.material.Layers.length-1,coordId:0,sourceCoordId:binding.sourceCoordId??binding.coordId??0};
    }));
  }
  validatePaintAssignments(staged,validationModel);
  for(let i=0;i<project.targets.length;i++)Object.assign(project.targets[i],staged.targets[i]);
  project.excludedGeosets=sourceModel.Geosets.map((_,i)=>i).filter(i=>!eligible.has(i));
  project.paintMaterialsVersion=3;touch(project);return true;
}
export function validatePaintAssignments(project,model){
  const assigned=new Set(),ids=new Set(),textures=new Set(),materials=new Set();
  for(const target of project.targets){
    if(ids.has(target.id)||textures.has(target.textureId))throw Error('The preset has duplicate texture or material identities.');
    ids.add(target.id);textures.add(target.textureId);
    if(!Number.isInteger(target.textureId)||target.textureId<0)throw Error('A paint material has an invalid identity.');
    if(target.textureId>=(model.Textures?.length||0)+project.targets.length)throw Error('A paint material points outside the model.');
    const variants=materialEntries(target),materialLimit=(model.Materials?.length||0)+project.targets.reduce((n,t)=>n+materialEntries(t).length,0);
    for(const entry of variants){
      if(!Number.isInteger(entry.materialId)||entry.materialId<0||entry.materialId>=materialLimit)throw Error('A paint material has an invalid identity.');
      if(materials.has(entry.materialId))throw Error('The preset has duplicate texture or material identities.');materials.add(entry.materialId);
      const layers=entry.material?.Layers;
      if(!Array.isArray(layers)||layers.at(-1)?.TextureID!==target.textureId||layers.at(-1)?.CoordId!==0||layers.slice(0,-1).some(l=>l.TextureID===target.textureId||model.Textures?.[l.TextureID]?.ReplaceableId!==1))throw Error('Each paint material must contain one editable image; only Warcraft team colour may sit underneath it.');
    }
    if(!Array.isArray(target.bindings)||!Array.isArray(target.geosetIndices)||target.bindings.length!==target.geosetIndices.length)throw Error('A paint assignment is incomplete.');
    for(const binding of target.bindings){
      const material=variants.find(v=>v.materialId===binding.materialId)?.material;
      if(material?.Layers?.[binding.layerIndex]?.TextureID!==target.textureId||binding.coordId!==0||!target.geosetIndices.includes(binding.geosetIndex))throw Error('A geoset has inconsistent material bindings.');
      const geo=model.Geosets[binding.geosetIndex];
      if(!geo||assigned.has(binding.geosetIndex))throw Error('Each geoset must have one paint texture and material.');
      const uv=geo.TVertices?.[binding.sourceCoordId||0];if(!uv||uv.length!==geo.Vertices.length/3*2)throw Error('This geoset has no usable UV map.');
      assigned.add(binding.geosetIndex);
    }
  }
  return true;
}
function touch(project){project.materialRevision=(project.materialRevision||0)+1;project.revision++;project.dirty=true;}
export function assignPaintMaterial(project,model,targetId,indices,sourceModel=model){
  const target=project.targets.find(t=>t.id===targetId);if(!target)throw Error('Choose a texture first.');
  const selected=[...new Set(indices)],sources=new Map();
  for(const index of selected){
    const geo=model.Geosets[index],sourceCoordId=target.generatedUV?project.generatedUVSets?.[index]:(layerFor(sourceFor(model,sourceModel,index),index).CoordId||0);
    if(!geo||!geo.TVertices?.[sourceCoordId]||geo.TVertices[sourceCoordId].length!==geo.Vertices.length/3*2)throw Error('This geoset has no usable UV map.');
    sources.set(index,sourceCoordId);
  }
  const staged={...project,targets:project.targets.map(t=>({...t,materialVariants:[...(t.materialVariants||[])],bindings:t.bindings.filter(b=>!sources.has(b.geosetIndex))}))},replacement=staged.targets.find(t=>t.id===targetId);
  for(const index of selected){
    const material=materialTemplate(sourceFor(model,sourceModel,index),index,target.textureId,!!target.basecoat),entry=bindingMaterial(staged,model,replacement,material);
    replacement.bindings.push({geosetIndex:index,materialId:entry.materialId,layerIndex:entry.material.Layers.length-1,coordId:0,sourceCoordId:sources.get(index)});
  }
  for(const item of staged.targets)updateTargetBindings(item,item.bindings);
  validatePaintAssignments(staged,model);
  for(let i=0;i<project.targets.length;i++)Object.assign(project.targets[i],staged.targets[i]);
  project.activeTargetId=target.id;touch(project);return target;
}
export function createPaintMaterial(project,model,{name='Texture',raster,geosets=[],nativeSource=false,sourcePath='',sourceLayer=null,sourceModel=model,basecoat=project.sourceMode==='primer',generatedUV=false}={}){
  if(!raster||raster.width!==project.resolution||raster.height!==project.resolution||raster.data?.length!==project.resolution**2*4)throw Error('The imported texture could not be prepared.');
  const textureId=nextIndex(project,model,'textureId','Textures'),materialId=nextIndex(project,model,'materialId','Materials');
  const context=sourceFor(model,sourceModel,geosets[0]),paintName=uniquePaintTextureName(project,name),layer=sourceLayer||layerFor(context,geosets[0]);
  const descriptor={id:'paint:'+crypto.randomUUID(),textureId,materialId,paintName,label:paintName,texturePath:nativeSource?sourcePath:'Textures\\'+paintName+'.blp',nativeSource,sourcePath,citadelCopy:false,basecoat:!!basecoat,generatedUV:!!generatedUV,preserveSourceAlpha:false,flags:generatedUV?0:Number(context.Textures?.[layer.TextureID]?.Flags)||0,bindings:[],geosetIndices:[],materialIds:[materialId],materialVariants:[],sharedUV:false,
    material:materialTemplate(context,geosets[0],textureId,basecoat,sourceLayer)};
  // Allocation happens on a staged project; no half-created target on failure.
  const staged={...project,targets:[...project.targets]},entry=addPaintProjectTarget(staged,descriptor,raster);
  assignPaintMaterial(staged,model,entry.id,geosets,sourceModel);
  project.targets=staged.targets;project.activeTargetId=entry.id;project.materialMode=true;project.materialRevision=staged.materialRevision;project.revision=staged.revision;project.dirty=true;return entry;
}
export function renamePaintMaterial(project,target,name){
  const value=String(name||'').trim();if(!value)throw Error('Enter a texture name.');
  target.paintName=uniquePaintTextureName(project,value,target.id);target.label=target.paintName;target.texturePath='Textures\\'+target.paintName+'.blp';target.citadelCopy=true;touch(project);return target.paintName;
}
export function markPaintMaterialEdited(project,target){
  if(!project.materialMode||!target.nativeSource||target.citadelCopy)return false;
  const stem=paintTextureStem(target.sourcePath||target.paintName);renamePaintMaterial(project,target,/Citadel$/i.test(stem)?stem:stem+'Citadel');return true;
}
/** Upgrade earlier presets once, preserving their pixels. Extra image layers
 * remain in the original model, but the paint working copy uses one per geoset. */
export function enablePaintMaterials(project,model){
  if(project.materialMode){validatePaintAssignments(project,model);return false;}
  const used=new Set(),catalog=enumeratePaintTargets(model),baseTexture=model.Textures?.length||0,baseMaterial=model.Materials?.length||0;
  // A texture may be an overlay on one geoset and the base on another.
  // Choose each geoset's first image layer, independent of target list order.
  const primary=new Map();
  for(const target of project.targets)for(const binding of target.bindings||catalog.find(t=>t.id===target.id)?.bindings||[]){
    const layerIndex=binding.layerIndex||0,previous=primary.get(binding.geosetIndex);
    if(!previous||layerIndex<previous.layerIndex)primary.set(binding.geosetIndex,{targetId:target.id,layerIndex});
  }
  const targets=project.targets.map((target,i)=>{
    const original=catalog.find(t=>t.id===target.id),textureId=baseTexture+i,materialId=baseMaterial+i;
    const bindings=(target.bindings||original?.bindings||[]).filter(b=>{const choice=primary.get(b.geosetIndex);if(used.has(b.geosetIndex)||choice?.targetId!==target.id||choice.layerIndex!==(b.layerIndex||0))return false;used.add(b.geosetIndex);return true;}).map(b=>({...b,sourceCoordId:b.coordId||0,coordId:0,layerIndex:0,materialId}));
    const first=bindings[0]?.geosetIndex,paintName=paintTextureStem(target.paintName||target.label||target.texturePath);
    return {...target,textureId,materialId,paintName,label:paintName,sourcePath:target.texturePath,nativeSource:target.nativeSource??(project.sourceMode==='current'),citadelCopy:false,basecoat:project.sourceMode==='primer',preserveSourceAlpha:false,bindings,geosetIndices:bindings.map(b=>b.geosetIndex),materialIds:[materialId],materialVariants:[],material:materialTemplate(model,first,textureId,project.sourceMode==='primer')};
  });
  const staged={...project,targets,materialMode:true,paintMaterialsVersion:undefined};repairPaintMaterials(staged,model);project.targets=targets;project.materialMode=true;project.paintMaterialsVersion=staged.paintMaterialsVersion;project.excludedGeosets=staged.excludedGeosets;touch(project);return true;
}

export function applyPaintMaterials(model,project){
  if(!project?.materialMode)return model;
  const Textures=[...(model.Textures||[])],Materials=[...(model.Materials||[])],Geosets=[...model.Geosets];
  for(const target of project.targets){
    Textures[target.textureId]={Image:target.texturePath,ReplaceableId:0,Flags:target.flags||0};for(const entry of materialEntries(target))Materials[entry.materialId]=entry.material;
    for(const binding of target.bindings){const geo=Geosets[binding.geosetIndex];if(!geo)throw Error('A texture refers to a missing geoset.');const coord=binding.sourceCoordId||0,TVertices=coord?[geo.TVertices[coord],...geo.TVertices.filter((_,set)=>set!==coord)]:geo.TVertices;Geosets[binding.geosetIndex]={...geo,MaterialID:binding.materialId,TVertices};}
  }
  return {...model,Textures,Materials,Geosets};
}
