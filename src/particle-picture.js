import {visitTextureReferences} from './texture-references.js';
import {STARTER_TEXTURE} from './particle-starters.js';

export function particlePictureShared(model,emitter,index){
 let shared=false;visitTextureReferences(model,(value,set,owner)=>{if(value===index&&owner!==emitter)shared=true;});return shared;
}
export function removeParticlePicture(model,id,index){
 const emitter=model.ParticleEmitters2.find(node=>node.ObjectId===id);
 if(!emitter||!model.Textures[index])throw Error('Choose a particle picture first.');
 if(particlePictureShared(model,emitter,index))throw Error('This picture is also used by another emitter or material. Choose a different picture for this particle.');
 if(emitter.TextureID===index){
  let next=model.Textures.findIndex((t,i)=>i!==index&&t.Image&&!t.ReplaceableId);
  if(next<0)next=model.Textures.push({Image:STARTER_TEXTURE,ReplaceableId:0,Flags:0})-1;
  emitter.TextureID=next;emitter.ReplaceableId=0;
 }
 model.Textures.splice(index,1);
 visitTextureReferences(model,(value,set)=>{if(value>index)set(value-1);});
}

export const particleFrameGroups=[['Early sprites','LifeSpanUVAnim'],['Late sprites','DecayUVAnim'],['Early streaks','TailUVAnim'],['Late streaks','TailDecayUVAnim']];
export const particleBlendNames=['Blend','Additive','Modulate','Modulate 2×','Alpha Key'];
export function particleGridChange(emitter,rows,columns,{correct=false}={}){
 if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows>65535||columns>65535)throw Error('Use positive grid dimensions up to 65,535.');
 const last=rows*columns-1,invalid=particleFrameGroups.filter(([,field])=>(emitter[field]?.[0]>last||emitter[field]?.[1]>last+1));
 const values={Rows:rows,Columns:columns};
 if(correct)for(const [,field]of invalid){const value=new Uint32Array(emitter[field]);value[0]=Math.min(value[0],last);value[1]=Math.min(value[1],last+1);values[field]=value;}
 return {values,invalid:invalid.map(([label])=>label),last};
}
export function particleCellAt(x,y,width,height,rows,columns){
 if(!(rows>0&&columns>0&&width>0&&height>0))return null;
 const column=Math.min(columns-1,Math.max(0,Math.floor(x/width*columns))),row=Math.min(rows-1,Math.max(0,Math.floor(y/height*rows)));
 return row*columns+column;
}
