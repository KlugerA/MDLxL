import { blendPaintPixel } from './paint-raster.js';
import { preparePaintSurface, paintSurfaceTile } from './paint-projection.js';

function decalSampler(source,center,transform) {
  const width=Math.max(1,transform.width),height=Math.max(1,transform.height),angle=-(transform.angle||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  return (x,y)=>{
    const dx=x-center.x,dy=y-center.y,u=(dx*c-dy*s)/width+.5,v=(dx*s+dy*c)/height+.5;
    if(u<0||v<0||u>=1||v>=1)return -1;
    return (Math.min(source.height-1,Math.floor((transform.flipY?1-v:v)*source.height))*source.width+Math.min(source.width-1,Math.floor((transform.flipX?1-u:u)*source.width)))*4;
  };
}
export function pastePaintDecal(target,source,center,transform,mask=null) {
  const sample=decalSampler(source,center,transform),color=[0,0,0,0];let changed=0;
  const radius=Math.hypot(transform.width,transform.height)/2;
  for(let y=Math.max(0,Math.floor(center.y-radius));y<Math.min(target.height,center.y+radius);y++)for(let x=Math.max(0,Math.floor(center.x-radius));x<Math.min(target.width,center.x+radius);x++){
    const pixel=y*target.width+x,offset=sample(x+.5,y+.5);if(offset<0||mask&&!mask[pixel])continue;
    for(let c=0;c<4;c++)color[c]=source.data[offset+c];
    if(blendPaintPixel(target.data,pixel*4,color,(transform.opacity??1)*(mask?mask[pixel]/255:1),'paint'))changed++;
  }
  return changed;
}
export function projectPaintDecal(target,projection,source,center,transform,flags=0) {
  const {bins,tileSize,columns}=preparePaintSurface(projection,target,flags),sample=decalSampler(source,center,transform),color=[0,0,0,0],radius=Math.hypot(transform.width,transform.height)/2;let changed=0;
  // Mirrored faces and seam filter samples may address one texture pixel many
  // times. A placed cutout is one operation, so blend that pixel only once.
  const selected=new Map();
  for(let ty=Math.max(0,Math.floor((center.y-radius)/tileSize));ty<=Math.min(Math.ceil(projection.height/tileSize)-1,Math.floor((center.y+radius)/tileSize));ty++)for(let tx=Math.max(0,Math.floor((center.x-radius)/tileSize));tx<=Math.min(columns-1,Math.floor((center.x+radius)/tileSize));tx++){
    const points=paintSurfaceTile(projection,target,flags,tx,ty);if(!points)continue;
    for(let i=0;i<points.length;i+=3){
      const offset=sample(points[i],points[i+1]);if(offset<0||!source.data[offset+3])continue;
      const pixel=points[i+2],distance=(points[i]-center.x)**2+(points[i+1]-center.y)**2,previous=selected.get(pixel);
      if(!previous||source.data[offset+3]>source.data[previous.offset+3]||source.data[offset+3]===source.data[previous.offset+3]&&distance<previous.distance)selected.set(pixel,{offset,distance});
    }
  }
  for(const [pixel,{offset}] of selected){for(let c=0;c<4;c++)color[c]=source.data[offset+c];if(blendPaintPixel(target.data,pixel*4,color,transform.opacity??1,'paint'))changed++;}
  return changed;
}
