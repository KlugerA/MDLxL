/** Current-skin painting keeps the entire authored material, including extra
 * image layers, team colour, animation references and their original UV sets.
 * Private texture/material copies prevent painting a surface from changing a
 * particle or unpainted geoset which happens to reuse the original resource. */
export function enableCurrentPaintMaterials(project,model) {
  const materials=[],byGeoset=new Map();
  for(const target of project.targets)for(const binding of target.bindings){
    if(byGeoset.has(binding.geosetIndex))continue;
    const source=model.Materials[model.Geosets[binding.geosetIndex].MaterialID];
    const entry={materialId:model.Materials.length+materials.length,geosetIndex:binding.geosetIndex,material:structuredClone(source)};
    materials.push(entry);byGeoset.set(binding.geosetIndex,entry);
  }
  const names=new Set();
  project.targets=project.targets.map((target,index)=>{
    const stem=target.paintName||target.label?.replace(/\.[^.]+$/,'')||'Texture';let paintName=stem,suffix=2;
    while(names.has(paintName.toLowerCase()))paintName=stem+' '+suffix++;names.add(paintName.toLowerCase());
    const bindings=target.bindings.map(binding=>({...binding,materialId:byGeoset.get(binding.geosetIndex).materialId}));
    return {...target,sourceTextureId:target.textureId,textureId:model.Textures.length+index,paintName,sourcePath:target.texturePath,citadelCopy:false,basecoat:false,preserveSourceAlpha:false,bindings,materialIds:[...new Set(bindings.map(binding=>binding.materialId))]};
  });
  project.preservedMaterials=materials;project.materialMode=true;project.paintMaterialsVersion=4;
  project.materialRevision=(project.materialRevision||0)+1;project.revision++;project.dirty=true;
  validateCurrentPaintMaterials(project,model);return true;
}

export function validateCurrentPaintMaterials(project,model) {
  const materials=new Map(),geosets=new Set(),textures=new Set(),ids=new Set(),bindings=new Set();
  for(const entry of project.preservedMaterials||[]){
    if(!Number.isInteger(entry.materialId)||entry.materialId<0||entry.materialId>=model.Materials.length+project.preservedMaterials.length||materials.has(entry.materialId)||!Array.isArray(entry.material?.Layers)||!model.Geosets[entry.geosetIndex]||geosets.has(entry.geosetIndex))throw Error('The preset contains an invalid preserved material.');
    materials.set(entry.materialId,entry);geosets.add(entry.geosetIndex);
  }
  for(const target of project.targets){
    if(ids.has(target.id)||textures.has(target.textureId)||!Number.isInteger(target.textureId)||target.textureId<0||target.textureId>=model.Textures.length+project.targets.length)throw Error('The preset contains an invalid paint texture.');
    ids.add(target.id);textures.add(target.textureId);
    for(const binding of target.bindings){
      const entry=materials.get(binding.materialId),geo=project.geometryEdits?.[binding.geosetIndex]||model.Geosets[binding.geosetIndex],uv=geo?.TVertices?.[binding.coordId],key=binding.geosetIndex+':'+binding.layerIndex;
      if(!entry||entry.geosetIndex!==binding.geosetIndex||!Number.isInteger(binding.layerIndex)||!entry.material.Layers[binding.layerIndex]||!uv||uv.length!==geo.Vertices.length/3*2||bindings.has(key))throw Error('The preset contains an invalid current-skin assignment.');
      bindings.add(key);
    }
  }
  return true;
}

export function applyCurrentPaintMaterials(model,project) {
  const Textures=[...model.Textures],Materials=[...model.Materials],Geosets=[...model.Geosets];
  for(const entry of project.preservedMaterials){
    Materials[entry.materialId]=structuredClone(entry.material);
    Geosets[entry.geosetIndex]={...Geosets[entry.geosetIndex],MaterialID:entry.materialId};
  }
  for(const target of project.targets){
    Textures[target.textureId]={Image:target.texturePath,ReplaceableId:0,Flags:target.flags||0};
    for(const binding of target.bindings)Object.assign(Materials[binding.materialId].Layers[binding.layerIndex],{TextureID:target.textureId,CoordId:binding.coordId});
  }
  return {...model,Textures,Materials,Geosets};
}

export function assignCurrentPaintMaterial(project,target,indices) {
  const choices=indices.map(geosetIndex=>{
    const binding=project.targets.flatMap(t=>t.bindings).filter(b=>b.geosetIndex===geosetIndex).sort((a,b)=>a.layerIndex-b.layerIndex)[0];
    if(!binding)throw Error('This part has no existing image layer to replace.');
    return {...binding};
  });
  const keys=new Set(choices.map(b=>b.geosetIndex+':'+b.layerIndex));
  for(const item of project.targets){
    item.bindings=item.bindings.filter(b=>!keys.has(b.geosetIndex+':'+b.layerIndex));
    if(item===target)item.bindings.push(...choices);
    item.geosetIndices=[...new Set(item.bindings.map(b=>b.geosetIndex))];item.materialIds=[...new Set(item.bindings.map(b=>b.materialId))];item.sharedUV=item.bindings.length>1;
  }
  project.activeTargetId=target.id;project.materialRevision=(project.materialRevision||0)+1;project.revision++;project.dirty=true;return target;
}
