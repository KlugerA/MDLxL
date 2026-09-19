import {createPaintRaster, compositePaintRasters} from './paint-raster.js';

/** One min/max interval per texture row. Disconnected UV islands never force
 * intervening rows through the compositor or GPU upload. */
export function createPaintDirtyRows(width,height=width){const rows=new Int32Array(height*2);for(let y=0;y<height;y++){rows[y*2]=width;rows[y*2+1]=-1;}return rows;}
export function markPaintPixel(rows,x,y){const i=y*2;rows[i]=Math.min(rows[i],x);rows[i+1]=Math.max(rows[i+1],x);}
export function mergePaintRows(destination,source){for(let i=0;i<source.length;i+=2){destination[i]=Math.min(destination[i],source[i]);destination[i+1]=Math.max(destination[i+1],source[i+1]);}}
export function paintRowRanges(rows,width){const ranges=[];for(let y=0;y<rows.length/2;y++)if(rows[y*2+1]>=rows[y*2])ranges.push({start:(y*width+rows[y*2])*4,count:(rows[y*2+1]-rows[y*2]+1)*4});return ranges;}
export function paintRowsBounds(rows,width,height){let x0=width,y0=height,x1=-1,y1=-1;for(let y=0;y<height;y++){if(rows[y*2+1]<rows[y*2])continue;x0=Math.min(x0,rows[y*2]);x1=Math.max(x1,rows[y*2+1]);y0=Math.min(y0,y);y1=y;}return x1<0?null:{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};}

/** Preview raster identity stays stable. Rows accumulate until the renderer
 * acknowledges its upload, including when rendering is paused/frames coalesce. */
export function createPaintPreview(target){return {target,raster:createPaintRaster(target.base.width,target.base.height),uploadRows:createPaintDirtyRows(target.base.width,target.base.height),fullUpload:true,revision:0,version:-1};}
export function updatePaintPreview(entry,rows=null){
  const target=entry.target;compositePaintRasters(target.base,target.coats,{alphaMask:target.alphaMask,preserveSourceAlpha:target.preserveSourceAlpha??true,output:entry.raster,rows});
  if(rows)mergePaintRows(entry.uploadRows,rows);else entry.fullUpload=true;
  entry.version=target.revision||0;entry.revision++;return entry;
}
export function acknowledgePaintUpload(entry){entry.uploadRows=createPaintDirtyRows(entry.raster.width,entry.raster.height);entry.fullUpload=false;}
