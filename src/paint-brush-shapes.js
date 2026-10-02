export const PAINT_BRUSH_SHAPES=[
  {id:'round',name:'Round',hardness:.82,flow:.3,spacing:.06},
  {id:'soft',name:'Soft',hardness:0,flow:.12,spacing:.08},
  {id:'pencil',name:'Pencil',hardness:1,flow:1,spacing:.03},
  {id:'chisel',name:'Chisel',hardness:1,flow:.4,spacing:.06},
  {id:'speckle',name:'Speckle',hardness:1,flow:.3,spacing:.3},
];
const tips=new Map();
export function paintBrushTip(shape){
  if(!['chisel','speckle'].includes(shape))return null;
  if(tips.has(shape))return tips.get(shape);
  const width=64,data=new Uint8ClampedArray(width*width*4);
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const u=(x+.5)/32-1,v=(y+.5)/32-1;
    const alpha=shape==='chisel'?Math.abs(u+v*.5)<.28&&Math.abs(v)<.82:((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%19<3;
    data.set([255,255,255,alpha&&u*u+v*v<1?255:0],(y*width+x)*4);
  }
  const tip={width,height:width,data};tips.set(shape,tip);return tip;
}
