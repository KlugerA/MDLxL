import {textureFromAsset} from './Viewport.jsx';
import {decodeDds} from '../src/dds.js';
import {nativeTeamColor} from './viewport-quality.js';
const decoded=new WeakMap(),replacements=new Map();
export function particlePictureCanvas(asset,{replaceableId=0,teamColor='#ed3333'}={}){
 if(replaceableId===1||replaceableId===2){
  const key=replaceableId+':'+teamColor;if(replacements.has(key))return Promise.resolve(replacements.get(key));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d'),pixels=context.createImageData(64,64),color=nativeTeamColor(teamColor);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const factor=replaceableId===2?Math.sin(Math.max(0,Math.min(1,1-Math.hypot((x+.5)/64-.5,(y+.5)/64-.5)*2*1.4))):1,offset=(y*64+x)*4;for(let k=0;k<3;k++)pixels.data[offset+k]=Math.round(255*color[k]*factor);pixels.data[offset+3]=255;}
  context.putImageData(pixels,0,0);if(replacements.size>=32)replacements.delete(replacements.keys().next().value);replacements.set(key,canvas);return Promise.resolve(canvas);
 }
 if(replaceableId)return Promise.reject(Error('Source-specific replaceable picture '+replaceableId+' is unavailable'));
 if(!asset)return Promise.reject(Error('Picture unavailable'));
 if(decoded.has(asset))return decoded.get(asset);
 const promise=(async()=>{
  const texture=await textureFromAsset(asset);
  try{const image=texture.isCompressedTexture?decodeDds(asset.bytes):texture.image;
   if(image.width*image.height>16*1024*1024)throw Error('Picture exceeds the preview pixel budget.');
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const context=canvas.getContext('2d');if(image.data)context.putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);else context.drawImage(image,0,0);
   return canvas;
  }finally{texture.dispose();}
 })();decoded.set(asset,promise);return promise;
}
