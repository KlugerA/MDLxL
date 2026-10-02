import test from 'node:test';
import assert from 'node:assert/strict';
import {forEachPaintUVEdgeTexel,forEachPaintUVTexel} from '../src/paint-uv-coverage.js';

// Independent rectangle/slab reference: the optimization must preserve every
// tap and interval, including repeated coordinates and degenerate UV edges.
function reference(a,b,width,height,flags){
  const clamp=(v,size,wrap)=>wrap?v:Math.max(0,Math.min(size,v)),mod=(v,size)=>(v%size+size)%size;
  const ax=clamp(a.x*width,width,flags&1),ay=clamp(a.y*height,height,flags&2),bx=clamp(b.x*width,width,flags&1),by=clamp(b.y*height,height,flags&2),dx=bx-ax,dy=by-ay,result=[];
  for(let y=Math.max(flags&2?-height*4:0,Math.floor(Math.min(ay,by)-1));y<=Math.min(flags&2?height*4:height-1,Math.ceil(Math.max(ay,by)+1));y++)
    for(let x=Math.max(flags&1?-width*4:0,Math.floor(Math.min(ax,bx)-1));x<=Math.min(flags&1?width*4:width-1,Math.ceil(Math.max(ax,bx)+1));x++){
      let from=0,to=1;
      for(const [origin,delta,center] of [[ax,dx,x+.5],[ay,dy,y+.5]]){
        if(Math.abs(delta)<1e-12){if(Math.abs(origin-center)>1){from=1;to=0;break;}continue;}
        const first=(center-1-origin)/delta,last=(center+1-origin)/delta;from=Math.max(from,Math.min(first,last));to=Math.min(to,Math.max(first,last));
      }
      if(from<=to)result.push([mod(x,width),mod(y,height),from,to]);
    }
  return result;
}
test('scanline seam coverage exactly preserves bilinear intervals across wrapping and collapsed edges',()=>{
  let seed=1327;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const cases=[[{x:0,y:0},{x:1,y:1}],[{x:1,y:0},{x:0,y:1}],[{x:.5,y:0},{x:.5,y:1}],[{x:0,y:.5},{x:1,y:.5}],[{x:.5,y:.5},{x:.5,y:.5}]];
  for(let i=0;i<80;i++)cases.push([{x:random()*3-1,y:random()*3-1},{x:random()*3-1,y:random()*3-1}]);
  for(const [a,b] of cases)for(let flags=0;flags<4;flags++){
    const actual=[];forEachPaintUVEdgeTexel(a,b,32,24,flags,(...sample)=>actual.push(sample));assert.deepEqual(actual,reference(a,b,32,24,flags),JSON.stringify({a,b,flags}));
  }
});

const mod=(value,size)=>(value%size+size)%size;
function referenceTriangle(uv,width,height,flags,visit,padding=0){
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

test('triangle scanline clipping preserves every texel and barycentric including padded and wrapped UVs',()=>{
  let seed=821;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const cases=[[[0,0],[1,0],[0,1]],[[0,0],[0,1],[1,0]],[[.5,.5],[.5,.5],[.5,.5]],[[.5,0],[.5,1],[.500001,.5]],[[0,.5],[1,.5],[.5,.500001]]].map(points=>points.map(([x,y])=>({x,y})));
  for(let i=0;i<100;i++)cases.push(Array.from({length:3},()=>({x:random()*3-1,y:random()*3-1})));
  for(const uv of cases)for(let flags=0;flags<4;flags++)for(const padding of [0,Math.SQRT2]){
    const actual=[],expected=[];forEachPaintUVTexel(uv,31,19,flags,(...args)=>actual.push(args),padding);referenceTriangle(uv,31,19,flags,(...args)=>expected.push(args),padding);assert.deepEqual(actual,expected,JSON.stringify({uv,flags,padding}));
  }
});
