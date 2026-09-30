import { createNode } from './editor-document.js';
import { emptyParticleModel, extractParticleRecipe } from './particle-recipes.js';
export const STARTER_TEXTURE = 'MDLxL_Forge\\Particle_SoftDisc_v1.tga';
/** Original mathematical soft disc, generated locally. No game assets are bundled. */
export function starterTextureAsset() {
  const size=64,bytes=new Uint8Array(18+size*size*4);
  bytes[2]=2;bytes[12]=size;bytes[14]=size;bytes[16]=32;bytes[17]=40;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const radius=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2)),alpha=Math.round(255*Math.max(0,1-radius)**2);
    const i=18+(y*size+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=255;bytes[i+3]=alpha;
  }
  return {name:STARTER_TEXTURE,bytes};
}
export function createStarterRecipe() {
  const model=emptyParticleModel();
  model.Sequences=[{Name:'Preview',Interval:new Uint32Array([0,5000]),NonLooping:false,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-64,-64,-16]),MaximumExtent:new Float32Array([64,64,128]),BoundsRadius:120}];
  model.Textures=[{Image:STARTER_TEXTURE,ReplaceableId:0,Flags:0}];
  const p=createNode(model,'ParticleEmitter2');p.Name='Soft sparks';p.LifeSpan=2;p.Speed=45;p.EmissionRate=28;p.Width=8;p.Length=8;p.Latitude=30;p.ParticleScaling=new Float32Array([3,8,0]);
  const recipe=extractParticleRecipe(model,[p.ObjectId],{id:'mdlxl-soft-sparks',name:'MDLxL starter · Soft sparks',categories:['Sparks'],tags:['blue','soft','sparks']});
  recipe.naming={state:'original'};recipe.sources=[{creator:'MDLxL',license:'CC0-1.0',original:true}];
  return recipe;
}
