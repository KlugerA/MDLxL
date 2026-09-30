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
export const PARTICLE_STARTERS=[['sparks','Soft sparks'],['smoke','Soft smoke'],['glow','Magic glow'],['impact','Impact burst'],['streak','Weapon streak'],['ribbon','Ribbon trail']];
export function createStarterRecipe(kind='sparks') {
  const model=emptyParticleModel();
  model.Sequences=[{Name:'Preview',Interval:new Uint32Array([0,5000]),NonLooping:false,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-64,-64,-16]),MaximumExtent:new Float32Array([64,64,128]),BoundsRadius:120}];
  model.Textures=[{Image:STARTER_TEXTURE,ReplaceableId:0,Flags:0}];
  const p=createNode(model,'ParticleEmitter2');p.Name='Soft sparks';p.LifeSpan=2;p.Speed=45;p.EmissionRate=28;p.Width=8;p.Length=8;p.Latitude=30;p.ParticleScaling=new Float32Array([3,8,0]);
  let ids=[p.ObjectId],category='Sparks';
  const colors=(...rgb)=>Array.from({length:3},()=>new Float32Array(rgb));
  if(kind==='smoke'){category='Smoke';Object.assign(p,{Name:'Soft smoke',FilterMode:0,LifeSpan:4,Speed:14,Gravity:-2,EmissionRate:12,Latitude:15,Width:12,Length:12,ParticleScaling:new Float32Array([5,18,35]),Alpha:new Uint8Array([45,100,0]),SegmentColor:colors(.5,.53,.58)});}
  if(kind==='glow'){category='Glows';Object.assign(p,{Name:'Glow accent',LifeSpan:1,Speed:0,EmissionRate:18,Width:0,Length:0,ParticleScaling:new Float32Array([4,12,0]),SegmentColor:colors(.22,.4,1)});const core=createNode(model,'ParticleEmitter2');Object.assign(core,{Name:'Glow core',LifeSpan:1,Speed:0,EmissionRate:10,Width:0,Length:0,ParticleScaling:new Float32Array([1,3,0]),SegmentColor:colors(.7,.85,1)});ids.push(core.ObjectId);}
  if(kind==='impact'){category='Bursts';Object.assign(p,{Name:'Impact sparks',Squirt:true,LifeSpan:.7,Speed:100,Latitude:85,Width:0,Length:0,Gravity:50,ParticleScaling:new Float32Array([2,3,0]),SegmentColor:colors(1,.65,.12),EmissionRate:{LineType:0,GlobalSeqId:null,Keys:[[0,0],[600,30],[601,0],[5000,0]].map(([Frame,n])=>({Frame,Vector:new Float32Array([n])}))}});}
  if(kind==='streak'){category='Trails';Object.assign(p,{Name:'Weapon streak',FrameFlags:2,TailLength:.18,LifeSpan:.3,Speed:100,Latitude:3,Width:2,Length:2,ParticleScaling:new Float32Array([2,3,0])});}
  if(kind==='ribbon'){category='Trails';model.ParticleEmitters2=[];model.Nodes=[];model.PivotPoints=[];model.Materials=[{RenderMode:0,PriorityPlane:0,Layers:[{FilterMode:3,Shading:16,TextureID:0,CoordId:0,Alpha:1}]}];const ribbon=createNode(model,'RibbonEmitter');Object.assign(ribbon,{Name:'Ribbon trail',Visibility:1,EmissionRate:45,LifeSpan:.5});ids=[ribbon.ObjectId];}
  const label=PARTICLE_STARTERS.find(([id])=>id===kind)?.[1]||'Soft sparks';
  const recipe=extractParticleRecipe(model,ids,{id:'mdlxl-'+kind,name:'MDLxL starter · '+label,categories:[category],tags:[kind,'original']});
  recipe.naming={state:'original'};recipe.sources=[{creator:'MDLxL',license:'CC0-1.0',original:true}];
  return recipe;
}
