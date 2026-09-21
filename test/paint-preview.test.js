import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaintRaster,clonePaintRaster,compositePaintRasters} from '../src/paint-raster.js';
import {createPaintDirtyRows,markPaintPixel,paintRowRanges,createPaintPreview,updatePaintPreview,acknowledgePaintUpload} from '../src/paint-preview.js';
import {configurePaintTexture,configureEditorTexture,viewportPixelRatio} from '../app/viewport-quality.js';
import {DataTexture,NearestFilter,LinearFilter,LinearMipmapLinearFilter} from 'three';

// Previous compositor, kept as an independent pixel-equivalence oracle.
function reference(base,coats,mask){const out=clonePaintRaster(base);for(const coat of coats){if(coat.visible===false)continue;for(let i=0;i<out.data.length;i+=4){const sa=coat.raster.data[i+3]/255*coat.opacity;if(sa<=0)continue;const da=out.data[i+3]/255,a=sa+da*(1-sa);for(let c=0;c<3;c++)out.data[i+c]=Math.round((coat.raster.data[i+c]*sa+out.data[i+c]*da*(1-sa))/a);out.data[i+3]=Math.round(a*255);}}for(let i=3;i<out.data.length;i+=4)out.data[i]=Math.round(base.data[i]*mask.data[i]/255);return out;}
test('dirty-row compositor preserves all layer and alpha bytes; rows outside the stroke stay untouched',()=>{
  const base=createPaintRaster(31,23),mask=createPaintRaster(31,23),coats=[.4,1,0,.8].map((opacity,k)=>({opacity,visible:k!==2,raster:createPaintRaster(31,23)}));
  for(let i=0;i<base.data.length;i++){base.data[i]=(i*43+17)%256;mask.data[i]=(i*29)%256;coats.forEach((c,k)=>c.raster.data[i]=(i*11+k*31)%256);}
  const expected=reference(base,coats,mask);assert.deepEqual(compositePaintRasters(base,coats,{alphaMask:mask}),expected);
  const rows=createPaintDirtyRows(31,23);for(const [x,y]of [[0,0],[30,0],[5,8],[9,8],[30,22]])markPaintPixel(rows,x,y);
  const output=createPaintRaster(31,23,[9,8,7,6]);compositePaintRasters(base,coats,{alphaMask:mask,output,rows});
  for(let y=0;y<23;y++)for(let x=0;x<31;x++){const offset=(y*31+x)*4;assert.deepEqual([...output.data.slice(offset,offset+4)],x>=rows[y*2]&&x<=rows[y*2+1]?[...expected.data.slice(offset,offset+4)]:[9,8,7,6]);}
});
test('preview upload ranges accumulate across coalesced frames and reset only on GPU acknowledgement',()=>{
  const target={base:createPaintRaster(16,16,[1,2,3,255]),coats:[{opacity:1,visible:true,raster:createPaintRaster(16)}],alphaMask:createPaintRaster(16,16,[255,255,255,255])};
  const entry=createPaintPreview(target);updatePaintPreview(entry);const identity=entry.raster;acknowledgePaintUpload(entry);
  for(const [x,y]of [[2,3],[10,3],[14,12]]){const rows=createPaintDirtyRows(16);markPaintPixel(rows,x,y);target.coats[0].raster.data.set([100,120,140,255],(y*16+x)*4);updatePaintPreview(entry,rows);}
  assert.equal(entry.raster,identity);assert.deepEqual(paintRowRanges(entry.uploadRows,16),[{start:(3*16+2)*4,count:9*4},{start:(12*16+14)*4,count:4}]);
  assert.deepEqual(entry.raster,compositePaintRasters(target.base,target.coats,{alphaMask:target.alphaMask}));acknowledgePaintUpload(entry);assert.deepEqual(paintRowRanges(entry.uploadRows,16),[]);
  updatePaintPreview(entry);assert.equal(entry.fullUpload,true);
});
test('Citadel low-power resolution obeys its limit without changing main-editor physical-pixel mode',()=>{
  for(const device of [1,1.25,1.5,2]){assert.equal(viewportPixelRatio({antialias:false,pixelRatio:1},device,true),1);assert.equal(viewportPixelRatio({antialias:false,pixelRatio:1},device),device);}
});

test('Bleed switches only live texture sampling, retaining pixels, dimensions and upload invalidation',()=>{
  const raster=createPaintRaster(16,16,[40,50,60,255]);raster.data.set([200,120,40,255],(8*16+8)*4);
  const before=raster.data.slice(),texture=new DataTexture(raster.data,16,16);
  for(const smoothing of [false,true,false]){
    const version=texture.version;
    assert.equal(configurePaintTexture(texture,smoothing),texture);
    assert.equal(texture.magFilter,smoothing?LinearFilter:NearestFilter);
    assert.equal(texture.minFilter,smoothing?LinearFilter:NearestFilter);
    assert.equal(texture.generateMipmaps,false);assert.equal(texture.anisotropy,1);assert.ok(texture.version>version);
    assert.equal(texture.image.data,raster.data);assert.deepEqual(raster.data,before);
    assert.equal(texture.image.width,16);assert.equal(texture.image.height,16);
  }
  // The general model editor's Warcraft-style filtering remains unchanged.
  configureEditorTexture(texture,8);
  assert.equal(texture.magFilter,LinearFilter);assert.equal(texture.minFilter,LinearMipmapLinearFilter);
  assert.equal(texture.generateMipmaps,true);assert.equal(texture.anisotropy,8);
  texture.dispose();
});
