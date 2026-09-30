import {textureFromAsset} from './Viewport.jsx';
import {decodeDds} from '../src/dds.js';
const decoded=new WeakMap();
export function particlePictureCanvas(asset){
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
