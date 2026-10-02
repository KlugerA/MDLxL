import {preparePaintSurfaceChange} from './paint-surface.js';
import {paintProjectModel} from './paint-view.js';
import {createPaintRaster} from './paint-raster.js';

export function needsTexturePaintSpace(target){return target.bindings.length&&(!target.generatedUV||Math.max(target.base.width,target.base.height)<1024);}

/** Stage enough independent texels for native imagery. The caller renders this
 * proposal for hover, and records it together with the first real gesture.
 * Existing project pixels, geometry and history remain untouched throughout. */
export function prepareTexturePaintSpace(model,project,textureRegion=null,targetIds=null){
  const next={...project,targets:[...project.targets],geometryEdits:{...project.geometryEdits},uvEdits:{...project.uvEdits},generatedUVSets:{...project.generatedUVSets},paintPreparationOriginalGeometry:{}};
  let region=textureRegion;
  for(const original of project.targets){
    if(targetIds&&!targetIds.has(original.id)||!needsTexturePaintSpace(original))continue;
    let target=original;
    if(textureRegion?.targetId===target.id){
      const raster=createPaintRaster(target.base.width,target.base.height,[255,255,255,255]);for(let p=0;p<textureRegion.data.length;p++)raster.data[p*4+3]=textureRegion.data[p];
      target={...target,coats:[...target.coats,{id:'__regionTransfer',raster}]};
    }
    const staged=preparePaintSurfaceChange(paintProjectModel(model,next),next,target,{resolution:1024,unique:!target.generatedUV});
    if(target!==original){const mask=staged.target.coats.pop().raster;region={...textureRegion,width:mask.width,height:mask.height,data:Uint8Array.from({length:mask.width*mask.height},(_,p)=>mask.data[p*4+3])};}
    next.targets=next.targets.map(t=>t.id===target.id?staged.target:t);Object.assign(next.geometryEdits,staged.geometry);
    for(const [index,geometry] of Object.entries(staged.previousGeometry))if(!Object.hasOwn(next.paintPreparationOriginalGeometry,index))next.paintPreparationOriginalGeometry[index]=geometry;
    next.uvEdits=staged.uvEdits;next.generatedUVSets=staged.generatedUVSets;
  }
  // Other destinations may receive the same free-paint gesture. They need
  // private coats even if their mapping was already suitable.
  next.targets=next.targets.map(t=>project.targets.includes(t)?structuredClone(t):t);
  next.uvRevision=(project.uvRevision||0)+1;next.materialRevision=(project.materialRevision||0)+1;
  return {project:next,textureRegion:region};
}
