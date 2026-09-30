import {Buffer} from 'buffer';
import {safeParticlePath} from './particle-data.js';
export const MAX_PARTICLE_PICTURE_BYTES=4*1024*1024;
export function validateParticleAssets(recipe){
 const items=recipe.embeddedAssets||[];
 if(!Array.isArray(items)||items.length>64)throw Error('Too many embedded pictures.');
 let total=0;const seen=new Set();
 for(const item of items){
  if(!item||!safeParticlePath(item.path)||!/^MDLxL_Forge\\Particle_[a-f0-9]{32}\.(png|blp|dds|tga|jpg|jpeg|webp)$/i.test(item.path)||seen.has(item.path.toLowerCase())||typeof item.data!=='string'||item.data.length>Math.ceil(MAX_PARTICLE_PICTURE_BYTES/3)*4||item.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(item.data))throw Error('Invalid embedded picture.');
  const length=item.data.length/4*3-(item.data.endsWith('==')?2:item.data.endsWith('=')?1:0);
  if(!length||length>MAX_PARTICLE_PICTURE_BYTES||(total+=length)>8*1024*1024)throw Error('Embedded pictures exceed the portable preset budget.');
  if(!recipe.native.Textures.some(t=>t.Image?.toLowerCase()===item.path.toLowerCase()))throw Error('Embedded picture is not a recipe dependency.');
  seen.add(item.path.toLowerCase());
 }
 return items;
}
export function embeddedParticleAssets(recipe){
 return new Map(validateParticleAssets(recipe).map(item=>[item.path.toLowerCase(),{name:item.path,bytes:new Uint8Array(Buffer.from(item.data,'base64')),origin:'particle-custom'}]));
}
export function includeParticleAssets(recipe,assets){
 const needed=new Set(recipe.native.Textures.map(t=>t.Image?.replaceAll('/','\\').toLowerCase()));
 recipe.embeddedAssets=[...assets.values()].filter(a=>a.origin==='particle-custom'&&needed.has(a.name.toLowerCase())).map(a=>({path:a.name,data:Buffer.from(a.bytes).toString('base64')}));
 validateParticleAssets(recipe);return recipe;
}
