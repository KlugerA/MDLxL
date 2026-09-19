const mod=(value,size)=>(value%size+size)%size;

export function paintUVTriangles(model,bindings){
  const triangles=[],seen=new Set();
  for(const binding of bindings||[]){
    const key=binding.geosetIndex+':'+binding.coordId;if(seen.has(key))continue;seen.add(key);
    const geo=model.Geosets?.[binding.geosetIndex],uv=geo?.TVertices?.[binding.coordId]||geo?.TVertices?.[0];if(!uv)continue;
    for(let i=0;i<geo.Faces.length;i+=3)triangles.push([0,1,2].map(j=>({x:uv[geo.Faces[i+j]*2],y:uv[geo.Faces[i+j]*2+1]})));
  }
  return triangles;
}

/** Include the filter texels just outside a UV island. Their barycentrics lie
 * on its nearest edge, so a dab reaches the seam without projecting behind it.
 * Interior coverage is kept separately to protect neighbouring UV islands. */
export function forEachPaintUVTexel(uv,width,height,flags,visit,padding=0){
  const points=uv.map(p=>({x:p.x*width,y:p.y*height})),[a,b,c]=points;
  const minU=Math.min(a.x,b.x,c.x),maxU=Math.max(a.x,b.x,c.x),minV=Math.min(a.y,b.y,c.y),maxV=Math.max(a.y,b.y,c.y);
  if(!(flags&1)&&(minU>=width||maxU<=0)||!(flags&2)&&(minV>=height||maxV<=0))return;
  const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(denominator)<1e-9)return;
  const minX=Math.max(flags&1?-width*4:0,Math.floor(minU-padding)),maxX=Math.min(flags&1?width*4:width-1,Math.ceil(maxU+padding));
  const minY=Math.max(flags&2?-height*4:0,Math.floor(minV-padding)),maxY=Math.min(flags&2?height*4:height-1,Math.ceil(maxV+padding));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const px=x+.5,py=y+.5;let u=((b.y-c.y)*(px-c.x)+(c.x-b.x)*(py-c.y))/denominator,v=((c.y-a.y)*(px-c.x)+(a.x-c.x)*(py-c.y))/denominator,w=1-u-v;
    const gutter=u< -1e-5||v< -1e-5||w< -1e-5;
    if(gutter){
      if(!padding)continue;let best=Infinity,side=0,tBest=0;
      for(let j=0;j<3;j++){const from=points[j],to=points[(j+1)%3],dx=to.x-from.x,dy=to.y-from.y,t=Math.max(0,Math.min(1,((px-from.x)*dx+(py-from.y)*dy)/(dx*dx+dy*dy||1))),distance=(px-from.x-t*dx)**2+(py-from.y-t*dy)**2;if(distance<best){best=distance;side=j;tBest=t;}}
      if(best>padding*padding)continue;
      u=side===0?1-tBest:side===2?tBest:0;v=side===0?tBest:side===1?1-tBest:0;w=1-u-v;
    }
    visit(mod(x,width),mod(y,height),u,v,w,gutter);
  }
}

export function paintUVCoverage(triangles,width,height,flags=0){
  const mask=new Uint8Array(width*height);
  for(const uv of triangles)forEachPaintUVTexel(uv,width,height,flags,(x,y)=>{mask[y*width+x]=255;});
  return mask;
}

/** Pixels actually sampled by the selected faces, including bilinear taps.
 * A texel may also belong to another island: that makes it shared, not locked.
 * Edges also cover faces mapped to a line or a single texture coordinate. */
export function paintUVFilterCoverage(triangles,width,height,flags=0){
  const mask=paintUVCoverage(triangles,width,height,flags);
  for(const uv of triangles)for(let side=0;side<3;side++)forEachPaintUVEdgeTexel(uv[side],uv[(side+1)%3],width,height,flags,(x,y)=>{mask[y*width+x]=255;});
  return mask;
}

/** Texels used by filtering an actual 3D seam. Unlike triangle padding, this
 * includes the first texel on both sides of the UV edge, even when its centre
 * projects onto the face around the corner. The sample remains on the seam. */
export function forEachPaintUVEdgeTexel(a,b,width,height,flags,visit){
  const clamp=(value,size,wrap)=>wrap?value:Math.max(0,Math.min(size,value));
  const ax=clamp(a.x*width,width,flags&1),ay=clamp(a.y*height,height,flags&2),bx=clamp(b.x*width,width,flags&1),by=clamp(b.y*height,height,flags&2),dx=bx-ax,dy=by-ay;
  const margin=1;
  const minX=Math.max(flags&1?-width*4:0,Math.floor(Math.min(ax,bx)-margin)),maxX=Math.min(flags&1?width*4:width-1,Math.ceil(Math.max(ax,bx)+margin));
  const minY=Math.max(flags&2?-height*4:0,Math.floor(Math.min(ay,by)-margin)),maxY=Math.min(flags&2?height*4:height-1,Math.ceil(Math.max(ay,by)+margin));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    // Bilinear sampling uses this texel while the UV point lies inside the
    // one-texel square around its centre. Keep that interval along the edge,
    // not just a point: at high zoom the interval can be wider than the brush.
    let from=0,to=1;
    for(const [origin,delta,center] of [[ax,dx,x+.5],[ay,dy,y+.5]]){
      if(Math.abs(delta)<1e-12){if(Math.abs(origin-center)>1){from=1;to=0;break;}continue;}
      const first=(center-1-origin)/delta,last=(center+1-origin)/delta;
      from=Math.max(from,Math.min(first,last));to=Math.min(to,Math.max(first,last));
    }
    if(from<=to)visit(mod(x,width),mod(y,height),from,to);
  }
}
