import {placeParticleRecipe} from './particle-recipes.js';

/** A chosen visibility window belongs to the newly inserted effect only. */
export function particlePlacementInterval(model,placement,{preview=false}={}) {
 if(!model.Sequences.length)return null;
 const clip=model.Sequences[placement.sequence];if(!clip)throw Error('Choose an animation.');
 const [start,end]=clip.Interval,from=Number(placement.from),to=Number(placement.to);
 if(placement.from===''||!Number.isInteger(from)||from<start||from>=end)throw Error('Choose a start inside this animation.');
 if(placement.to===''||placement.to==null){if(preview)return [from,end];throw Error('Choose when the effect ends.');}
 if(!Number.isInteger(to)||to<=from||to>end)throw Error('Choose an end after the start, inside this animation.');
 return [from,to];
}

export function placeTimedParticleRecipe(model,recipe,placement,{preview=false}={}) {
 const window=placement.ribbon?model.Sequences[placement.sequence]?.Interval:particlePlacementInterval(model,placement,{preview});
 const sourceInterval=Array.from(recipe.native.Sequences[recipe.defaultSequence||0]?.Interval||[0,5000]);
 const result=placeParticleRecipe(model,recipe,{parent:placement.parent===''?null:Number(placement.parent),position:placement.position,sourceInterval,targetInterval:window||sourceInterval,fit:placement.fit,motion:placement.motion});
 if(placement.ribbon){
  const selected=new Set(placement.sequences),visibility=new Map(),boundaries=new Set();
  for(let i=0;i<model.Sequences.length;i++)for(const frame of model.Sequences[i].Interval){visibility.set(frame,selected.has(i)?1:0);boundaries.add(frame);}
  for(const id of result.ids){
   const node=model.Nodes[id];
   node.Visibility=visibility.size?{LineType:0,GlobalSeqId:null,Keys:[...visibility].sort((a,b)=>a[0]-b[0]).map(([Frame,value])=>({Frame,Vector:new Float32Array([value])}))}:1;
   // The fitted edge is constant in the weapon's space in every animation.
   const rotation=node.Rotation?.Keys?.[0]?.Vector;
   if(rotation&&boundaries.size)node.Rotation={LineType:0,GlobalSeqId:null,Keys:[...boundaries].sort((a,b)=>a-b).map(Frame=>({Frame,Vector:new Float32Array(rotation)}))};
  }
 }else if(window){
  const values=new Map();
  for(const clip of model.Sequences)for(const boundary of clip.Interval)if(boundary<window[0]||boundary>window[1])values.set(boundary,0);
  values.set(window[0],1);values.set(window[1],0);
  for(const id of result.ids)model.Nodes[id].Visibility={LineType:0,GlobalSeqId:null,Keys:[...values].sort((a,b)=>a[0]-b[0]).map(([Frame,value])=>({Frame,Vector:new Float32Array([value])}))};
 }
 return {...result,interval:window||sourceInterval};
}
