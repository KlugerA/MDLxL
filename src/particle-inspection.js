import {emptyParticleModel,extractParticleRecipe,placeParticleRecipe} from './particle-recipes.js';
/** Repeated-instance inspection owns a disposable model; it never becomes export data. */
export function particleInspectionModel(source,ids,{instances=1,spacing=140}={}){
 if(![1,4,9].includes(instances)||!Number.isFinite(spacing)||spacing<=0)throw Error('Choose 1, 4 or 9 inspection instances.');
 const recipe=extractParticleRecipe(source,ids,{name:'Inspection effect'}),model=emptyParticleModel(source.Version);model.Sequences=structuredClone(source.Sequences);model.Info=structuredClone(recipe.native.Info);
 const side=Math.sqrt(instances),start=model.Sequences[0]?.Interval?.[0]||0;
 for(let i=0;i<instances;i++){
  const position=[(i%side-(side-1)/2)*spacing,(Math.floor(i/side)-(side-1)/2)*spacing,0],result=placeParticleRecipe(model,recipe,{position,targetInterval:[start,model.Sequences[0]?.Interval?.[1]||5000]});
  if(position.some(v=>v!==0))model.Nodes[result.anchorId].Translation={LineType:0,GlobalSeqId:null,Keys:model.Sequences.map(clip=>({Frame:clip.Interval[0],Vector:new Float32Array(position)}))};
 }
 return model;
}
export function particleConstantRateEstimate(model,instances=1){
 const emitters=model.ParticleEmitters2||[];
 if(!emitters.length||emitters.some(p=>p.Squirt||typeof p.EmissionRate!=='number'))return null;
 return emitters.reduce((total,p)=>total+Math.max(0,p.EmissionRate)*Math.max(0,p.LifeSpan),0)*instances;
}
