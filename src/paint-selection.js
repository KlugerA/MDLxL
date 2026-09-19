import { createPaintRaster } from './paint-raster.js';

/** Cutout selections are masks over source image pixels. Source pixels are immutable. */
export function shapeSelection(width, height, shape, points) {
  const mask = new Uint8ClampedArray(width * height);
  if (!points.length) return mask;
  const first = points[0], last = points.at(-1), left = Math.min(first.x,last.x), top = Math.min(first.y,last.y);
  const w = Math.abs(last.x-first.x), h = Math.abs(last.y-first.y);
  const inside = (x,y) => {
    if (shape === 'rectangle') return x >= left && x <= left+w && y >= top && y <= top+h;
    if (shape === 'ellipse') return w > 0 && h > 0 && ((x-left-w/2)/(w/2))**2+((y-top-h/2)/(h/2))**2 <= 1;
    let hit = false;
    for (let i=0,j=points.length-1;i<points.length;j=i++) {
      const a=points[i],b=points[j];
      if ((a.y>y)!==(b.y>y) && x < (b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) hit=!hit;
    }
    return hit;
  };
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const p of points){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}
  const minX=Math.max(0,Math.floor(x0)),maxX=Math.min(width-1,Math.ceil(x1));
  const minY=Math.max(0,Math.floor(y0)),maxY=Math.min(height-1,Math.ceil(y1));
  if(shape!=='rectangle'&&shape!=='ellipse'){
    if(points.length<3)return mask;
    // Two scanlines per pixel row retain the same four coverage samples while
    // avoiding a complete polygon walk for every pixel in a long freehand path.
    for(let y=minY;y<=maxY;y++)for(const dy of [.25,.75]){
      const intersections=[],scan=y+dy;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[i],b=points[j];if((a.y>scan)!==(b.y>scan))intersections.push(a.x+(scan-a.y)*(b.x-a.x)/(b.y-a.y));
      }
      intersections.sort((a,b)=>a-b);
      for(let i=0;i+1<intersections.length;i+=2){
        const left=intersections[i],right=intersections[i+1];
        for(let x=Math.max(minX,Math.floor(left));x<=Math.min(maxX,Math.ceil(right));x++)for(const dx of [.25,.75])if(x+dx>=left&&x+dx<right)mask[y*width+x]++;
      }
    }
    for(let i=0;i<mask.length;i++)mask[i]=mask[i]*255/4;
    return mask;
  }
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    let coverage=0;for(const dy of [.25,.75])for(const dx of [.25,.75])coverage+=inside(x+dx,y+dy)?1:0;
    mask[y*width+x]=coverage*255/4;
  }
  return mask;
}

export function magicSelection(raster, x, y, tolerance=32, contiguous=true) {
  const {width,height,data}=raster, mask=new Uint8ClampedArray(width*height);
  x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=width||y>=height)return mask;
  const start=y*width+x,reference=Array.from(data.subarray(start*4,start*4+4)),limit=tolerance*tolerance*4;
  const matches=p=>{let distance=0;for(let c=0;c<4;c++)distance+=(data[p*4+c]-reference[c])**2;return distance<=limit;};
  if(!contiguous){for(let p=0;p<mask.length;p++)if(matches(p))mask[p]=255;return mask;}
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let head=0,tail=1;queue[0]=start;seen[start]=1;
  while(head<tail){const p=queue[head++];if(!matches(p))continue;mask[p]=255;const px=p%width;
    for(const next of [px>0?p-1:-1,px+1<width?p+1:-1,p>=width?p-width:-1,p+width<mask.length?p+width:-1])if(next>=0&&!seen[next]){seen[next]=1;queue[tail++]=next;}
  }
  return mask;
}

export function combineSelection(current, next, operation='replace') {
  if(operation==='replace')return next;
  return Uint8ClampedArray.from(current,(value,i)=>operation==='add'?Math.max(value,next[i]):operation==='intersect'?Math.min(value,next[i]):Math.max(0,value-next[i]));
}

export function featherSelection(mask,width,height,radius=0) {
  radius=Math.max(0,Math.min(32,Math.round(radius)));if(!radius)return mask;
  const horizontal=new Float32Array(mask.length),result=new Uint8ClampedArray(mask.length),span=radius*2+1;
  for(let y=0;y<height;y++){let sum=0;for(let x=-radius;x<=radius;x++)if(x>=0&&x<width)sum+=mask[y*width+x];
    for(let x=0;x<width;x++){horizontal[y*width+x]=sum/span;if(x-radius>=0)sum-=mask[y*width+x-radius];if(x+radius+1<width)sum+=mask[y*width+x+radius+1];}}
  for(let x=0;x<width;x++){let sum=0;for(let y=-radius;y<=radius;y++)if(y>=0&&y<height)sum+=horizontal[y*width+x];
    for(let y=0;y<height;y++){result[y*width+x]=sum/span;if(y-radius>=0)sum-=horizontal[(y-radius)*width+x];if(y+radius+1<height)sum+=horizontal[(y+radius+1)*width+x];}}
  return result;
}

export function extractPaintCutout(raster, mask) {
  let minX=raster.width,minY=raster.height,maxX=-1,maxY=-1;
  for(let p=0;p<mask.length;p++)if(mask[p]&&raster.data[p*4+3]){const x=p%raster.width,y=Math.floor(p/raster.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  if(maxX<minX)throw Error('Select a visible part of the texture first.');
  const result=createPaintRaster(maxX-minX+1,maxY-minY+1);
  for(let y=0;y<result.height;y++)for(let x=0;x<result.width;x++){const p=(y+minY)*raster.width+x+minX,o=(y*result.width+x)*4;result.data.set(raster.data.subarray(p*4,p*4+4),o);result.data[o+3]=raster.data[p*4+3]*mask[p]/255;}
  return result;
}
