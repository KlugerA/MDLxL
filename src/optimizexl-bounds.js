import { ModelRenderer } from 'war3-model';
import { Matrix4 } from 'three';
import { allNodes, skinGeoset } from './animation.js';

const invalid=b=>!b||b.MinimumExtent?.length!==3||b.MaximumExtent?.length!==3||Array.from(b.MinimumExtent).some((v,i)=>!Number.isFinite(v)||!Number.isFinite(b.MaximumExtent[i])||v>b.MaximumExtent[i])||!Number.isFinite(b.BoundsRadius)||b.BoundsRadius<0;
export function boundsProposals(model){
 const targets=[];
 if(invalid(model.Info))targets.push({path:['Info'],label:'Model',hivePath:'/Model'});
 model.Sequences.forEach((s,sequence)=>{if(invalid(s))targets.push({path:['Sequences',sequence],sequence,label:s.Name,hivePath:`/Sequence ${sequence} -`});});
 model.Geosets.forEach((g,geoset)=>{
  if(invalid(g))targets.push({path:['Geosets',geoset],geoset,label:`Geoset ${geoset+1}`,hivePath:`/Geoset ${geoset}/Extent`});
  g.Anims?.forEach((a,sequence)=>{if(invalid(a))targets.push({path:['Geosets',geoset,'Anims',sequence],geoset,sequence,label:`Geoset ${geoset+1}, ${model.Sequences[sequence]?.Name||'animation '+(sequence+1)}`,hivePath:`/Geoset ${geoset}/Extent`});});
 });
 if(!targets.length)return [];
 const sequence=targets.find(t=>t.sequence!=null)?.sequence??0;
 return [{id:'invalidBounds',kind:'bounds',targets,sequence,frame:model.Sequences[sequence]?.Interval[0]||0,label:`Recalculate invalid bounds (${targets.length})`,detail:'Rebuild the broken extent boxes from model geometry and sampled animation poses. Meshes, keys and visibility stay unchanged.'}];
}
function box(){return {min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};}
function include(b,vertices){for(let i=0;i<vertices.length;i++){const v=vertices[i];if(!Number.isFinite(v))throw Error('Cannot calculate bounds for non-finite geometry.');b.min[i%3]=Math.min(b.min[i%3],v);b.max[i%3]=Math.max(b.max[i%3],v);}}
function finish(b){
 if(!Number.isFinite(b.min[0]))return {MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0};
 const pad=Math.max(1,...b.max.map((v,i)=>v-b.min[i]))*1e-5;
 return {MinimumExtent:new Float32Array(b.min.map(v=>v-pad)),MaximumExtent:new Float32Array(b.max.map(v=>v+pad)),BoundsRadius:Math.fround(Math.hypot(...b.max.map((v,i)=>(v-b.min[i])/2+pad)))};
}
export function repairBounds(model,fix){
 const renderer=new ModelRenderer(structuredClone(model)),cache=new Map();
 function animated(sequence){
  if(cache.has(sequence))return cache.get(sequence);
  const s=model.Sequences[sequence];if(!s)throw Error('The invalid extent has no matching animation.');
  const [lo,hi]=s.Interval,frames=new Set([lo,hi]),boxes=model.Geosets.map(box);
  for(const node of allNodes(model))for(const property of ['Translation','Rotation','Scaling'])for(const k of node[property]?.Keys||[])if(k.Frame>=lo&&k.Frame<=hi)frames.add(k.Frame);
  // Include all authored poses plus regular subframes; never substitute bind
  // bounds for a moving sequence (the Footman Decay Bone box is a sentinel).
  const steps=Math.max(1,Math.ceil((hi-lo)/33));for(let i=0;i<=steps;i++)frames.add(lo+(hi-lo)*i/steps);
  renderer.setSequence(sequence);
  for(const frame of [...frames].sort((a,b)=>a-b)){
   renderer.setFrame(frame);model.GlobalSequences.forEach((duration,i)=>renderer.rendererData.globalSequencesFrames[i]=duration>0?(frame-lo)%duration:0);renderer.updateNode(renderer.rendererData.rootNode);
   const matrices=new Map(renderer.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,new Matrix4().fromArray(n.matrix)]));
   model.Geosets.forEach((g,i)=>include(boxes[i],skinGeoset(g,matrices)));
  }
  cache.set(sequence,boxes);return boxes;
 }
 for(const target of fix.targets){
  const b=box();
  if(target.sequence!=null){const boxes=animated(target.sequence);for(const g of target.geoset!=null?[boxes[target.geoset]]:boxes)if(Number.isFinite(g.min[0])){include(b,g.min);include(b,g.max);}}
  else if(target.geoset!=null)include(b,model.Geosets[target.geoset].Vertices);
  else{
   for(const g of model.Geosets)include(b,g.Vertices);
   for(let i=0;i<model.Sequences.length;i++)for(const g of animated(i))if(Number.isFinite(g.min[0])){include(b,g.min);include(b,g.max);}
  }
  let owner=model;for(const key of target.path)owner=owner[key];Object.assign(owner,finish(b));
 }
}
