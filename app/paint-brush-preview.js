import {samplePaintSource} from '../src/paint-projection.js';

/** Outline only, with a thin stroke even for a very large brush. */
export function paintBrushPreview(brush, tip, material, color='#ffffff') {
  const size=128,mask=new Uint8Array(size*size);
  const shaped=!!tip||!!material?.data?.some((value,index)=>index%4===3&&value<255);
  let shape='<circle cx="64" cy="64" r="63"/>';
  if(shaped){
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=(x+.5)/size,v=(y+.5)/size,dx=u*2-1,dy=v*2-1;
      if(dx*dx+dy*dy>1)continue;
      let alpha=material?samplePaintSource(material,dx*brush.size/2,dy*brush.size/2,{zoom:brush.zoom})[3]/255:1;
      if(tip)alpha*=tip.data[(Math.min(tip.height-1,Math.floor(v*tip.height))*tip.width+Math.min(tip.width-1,Math.floor(u*tip.width)))*4+3]/255;
      mask[y*size+x]=alpha>.08?1:0;
    }
    const edges=[];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(mask[y*size+x]){
      if(!x||!mask[y*size+x-1])edges.push(`M${x} ${y}v1`);
      if(x===size-1||!mask[y*size+x+1])edges.push(`M${x+1} ${y}v1`);
      if(!y||!mask[(y-1)*size+x])edges.push(`M${x} ${y}h1`);
      if(y===size-1||!mask[(y+1)*size+x])edges.push(`M${x} ${y+1}h1`);
    }
    shape=`<path d="${edges.join('')}"/>`;
  }
  const outline=/^#[0-9a-f]{6}$/i.test(color)?color:'#ffffff';
  const stroke=(value,width)=>shape.replace('/>',` fill="none" stroke="${value}" stroke-width="${width}" vector-effect="non-scaling-stroke"/>`);
  return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${stroke('#000000',3)}${stroke(outline,1)}</svg>`);
}
