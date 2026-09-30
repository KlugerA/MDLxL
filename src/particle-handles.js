/** Latched screen-space mappings; camera/animation motion is never pointer input. */
export function particleAxisMapping(origin, unit) {
  const dx=unit[0]-origin[0],dy=unit[1]-origin[1],length=Math.hypot(dx,dy);
  // An edge-on axis has no useful projection. Its numeric/keyboard control remains available.
  return length>0.05 ? {dx,dy,unitsPerPixel:1/length} : null;
}
export function particleSpreadAtPointer(arc, reference, dx, dy, baseline) {
  if(dx===0&&dy===0)return baseline;
  const x=reference[0]+dx,y=reference[1]+dy;
  let result=baseline,best=Infinity;
  for(const item of arc) {
    const distance=(item.point[0]-x)**2+(item.point[1]-y)**2;
    if(distance<best-1e-6||(Math.abs(distance-best)<1e-6&&Math.abs(item.angle-baseline)<Math.abs(result-baseline))){best=distance;result=item.angle;}
  }
  return result;
}
function triangleWeights(point,a,b,c) {
  const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(d)<1e-8)return null;
  const x=((b[1]-c[1])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[1]))/d;
  const y=((c[1]-a[1])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[1]))/d,z=1-x-y;
  return Math.min(x,y,z)>=-1e-5?[x,y,z]:null;
}
/** Sprite and tail triangles use the renderer's actual UVs and effective blend coverage. */
export function particleSampleHit(sample,x,y,picture) {
  if(!picture?.data||sample.opacity<=0)return false;
  for(const indices of [[0,1,2],[2,1,3]]) {
    const weights=triangleWeights([x,y],...indices.map(i=>sample.points[i]));if(!weights)continue;
    const uv=[0,1].map(axis=>indices.reduce((sum,i,k)=>sum+sample.uv[i*2+axis]*weights[k],0));
    const coordinate=(n,size,repeat)=>Math.min(size-1,Math.max(0,Math.floor((repeat?((n%1)+1)%1:Math.max(0,Math.min(1,n)))*size)));
    const px=coordinate(uv[0],picture.width,picture.flags&1),py=coordinate(uv[1],picture.height,picture.flags&2),offset=(py*picture.width+px)*4;
    const alpha=picture.data[offset+3]/255,colors=[0,1,2].map(i=>picture.data[offset+i]/255*(sample.color?.[i]??1));
    const mode=sample.filterMode;
    if(alpha*sample.opacity<(mode===4?.83:mode===2||mode===3?.01:0))continue;
    const useful=mode===1?Math.max(...colors)*alpha*sample.opacity:mode===2?1-Math.min(...colors):mode===3?Math.max(...colors.map(v=>Math.abs(2*v-1))):mode===4?(alpha*sample.opacity>=.83?1:0):alpha*sample.opacity;
    if(useful>.025)return true;
  }
  return false;
}
export function pickParticleSamples(samples,x,y,pictures) {
  const owners=new Map();
  for(const sample of samples)if(particleSampleHit(sample,x,y,pictures.get(sample.textureId))) {
    const depth=sample.points.reduce((sum,p)=>sum+p[2],0)/4;
    if(!owners.has(sample.owner)||depth<owners.get(sample.owner).depth)owners.set(sample.owner,{sample,depth});
  }
  return [...owners.values()].sort((a,b)=>a.depth-b.depth).map(item=>item.sample);
}
