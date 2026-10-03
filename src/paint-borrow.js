// Image borrowing operates on the visible destination, not an empty paint coat.
// The result is still ordinary RGBA paint and uses the existing layer/history path.
const averages=new WeakMap();
const luma=(data,i)=>data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;
export function paintSourceLuminance(source){
  if(averages.has(source))return averages.get(source);
  let sum=0,weight=0;
  for(let i=0;i<source.data.length;i+=4){const a=source.data[i+3]/255;sum+=luma(source.data,i)*a;weight+=a;}
  const value=weight?sum/weight:128;averages.set(source,value);return value;
}
export function borrowPaintPixel(source,offset,destination,pixel,mode,out){
  const base=pixel*4,light=luma(source.data,offset),mean=paintSourceLuminance(source);
  for(let c=0;c<3;c++){
    const color=destination.data[base+c];
    if(mode==='texture')out[c]=Math.round(Math.max(0,Math.min(255,color*light/Math.max(1,mean))));
    else if(mode==='highlights')out[c]=Math.round(color+(255-color)*Math.max(0,(light-mean)/Math.max(1,255-mean)));
    else out[c]=source.data[offset+c];
  }
  out[3]=source.data[offset+3];return out;
}
