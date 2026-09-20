import { paintRasterCanvas } from './paint-raster.js';

/** Cached by the caller when brush settings change, never during pointer movement. */
export function paintBrushPreview(brush, tip, material, color='#ffffff') {
  const rgb=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
  const size=128,alpha=new Uint8Array(size*size),pixels=new Uint8ClampedArray(size*size*4),inner=Math.min(.995,brush.hardness);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size,r=Math.hypot(u*2-1,v*2-1);if(r>1)continue;
    let value=r<=inner?1:1-(r-inner)/(1-inner);value=value*value*(3-2*value);
    if(tip)value*=tip.data[(Math.min(tip.height-1,Math.floor(v*tip.height))*tip.width+Math.min(tip.width-1,Math.floor(u*tip.width)))*4+3]/255;
    if(material&&brush.mode==='stamp')value*=material.data[(Math.floor(v*material.height)*material.width+Math.floor(u*material.width))*4+3]/255;
    alpha[y*size+x]=value>.08?1:0;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x;if(alpha[i]&&(!x||!y||x===size-1||y===size-1||!alpha[i-1]||!alpha[i+1]||!alpha[i-size]||!alpha[i+size]))pixels.set([...rgb,255],i*4);}
  return paintRasterCanvas({width:size,height:size,data:pixels}).toDataURL();
}
