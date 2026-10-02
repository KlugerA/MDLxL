import {preparePaintSurface,paintSurfaceTile,stampProjectedBrush} from './paint-projection.js';

/** A soft mixing brush carries pigment along a stroke. It samples only visible,
 * selected texels, so a nearby unselected part cannot contaminate the mixture. */
export function blendProjectedPaint(raster,projection,center,brush,options,state){
  const radius=Math.max(1,brush.size/2),{tileSize,columns}=preparePaintSurface(projection,raster,options.flags);
  const pixels=new Set(),sum=[0,0,0];let weight=0;
  for(let ty=Math.max(0,Math.floor((center.y-radius)/tileSize));ty<=Math.min(Math.ceil(projection.height/tileSize)-1,Math.floor((center.y+radius)/tileSize));ty++)for(let tx=Math.max(0,Math.floor((center.x-radius)/tileSize));tx<=Math.min(columns-1,Math.floor((center.x+radius)/tileSize));tx++){
    const points=paintSurfaceTile(projection,raster,options.flags,tx,ty);if(!points)continue;
    for(let i=0;i<points.length;i+=3){
      const pixel=points[i+2],distance=Math.hypot(points[i]-center.x,points[i+1]-center.y);
      if(distance>radius||pixels.has(pixel)||options.mask&&!options.mask[pixel])continue;pixels.add(pixel);
      const amount=(1-distance/radius)*(options.mask?options.mask[pixel]/255:1)*options.reference.data[pixel*4+3]/255;
      weight+=amount;for(let c=0;c<3;c++)sum[c]+=options.reference.data[pixel*4+c]*amount;
    }
  }
  if(!weight)return 0;
  const picked=sum.map(value=>value/weight);
  state.color=state.color?state.color.map((value,c)=>value*.8+picked[c]*.2):picked;
  const color='#'+state.color.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('');
  return stampProjectedBrush(raster,projection,center,{...brush,color,mode:'paint',hardness:0,flow:.2},{...options,materialRaster:null,decalRaster:null,dragging:true});
}
