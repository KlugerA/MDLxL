import { protectedGeosetData } from './optimizexl-exclusions.js';
// Count each actual key removal once, even when its bone affects many geosets.
// Duplicate review identifies geometry only; unused review names removed data.
export function optimizationReview(model,stage,changes) {
  const geosets=new Set(),animations=new Map(),removed=[];
  for(const change of changes) {
    if(stage==='animation') {
      const row=animations.get(change.sequence);
      if(row)row.changes++;
      else animations.set(change.sequence,{sequence:change.sequence,frame:change.frame,changes:1});
    } else if(stage==='duplicates') {
      if(change.geoset!=null)geosets.add(change.geoset);
      if(change.kind==='bones')model.Geosets.forEach((g,index)=>{
        const nodes=protectedGeosetData(model,{excludedGeosets:[index]}).nodes;
        if(change.nodes.some(id=>nodes.has(id)))geosets.add(index);
      });
    } else if(stage==='unused') {
      if(change.geoset!=null) {
        const parts=[];
        if(change.vertices)parts.push(`${change.vertices} unused ${change.vertices===1?'vertex':'vertices'}`);
        if(change.groups)parts.push(`${change.groups} unused bone ${change.groups===1?'group':'groups'}`);
        removed.push({geoset:change.geoset,label:`Geoset ${change.geoset+1}: ${parts.join(', ')}`});
      } else removed.push(change);
    }
  }
  return {stage,geosets:[...geosets].sort((a,b)=>a-b).map(index=>({index})),animations:[...animations.values()].sort((a,b)=>a.sequence-b.sequence),removed};
}
