import test from 'node:test';
import assert from 'node:assert/strict';
import {forEachPaintUVEdgeTexel} from '../src/paint-uv-coverage.js';

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
