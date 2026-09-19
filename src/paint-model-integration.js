import {encodePaintBlp1} from './paint-blp.js';
import {compositePaintTarget} from './paint-project.js';
import {paintProjectModel} from './paint-view.js';
import {decodeBLP,getBLPImageData} from 'war3-model';
const encodedTargets=new WeakMap();

/** Prepare every texture before changing the document. Leaving Citadel applies
 * real materials and portable BLP assets, so Vertices and normal model saving
 * show the same paint. Coats remain editable in the separate paint preset.
 * Content-addressed files keep saved models and editor undo independent. */
export async function preparePaintModelCommit(model,project,originalModel=model,{encode=encodePaintBlp1}={}){
  const painted=paintProjectModel(model,project,originalModel),assets=[];
  for(const target of project.targets){
    if(!target.bindings.length)continue;
    const version=JSON.stringify([target.revision||0,target.preserveSourceAlpha??true,target.coats.map(c=>[c.visible,c.opacity])]);
    let cached=encode===encodePaintBlp1&&encodedTargets.get(target);
    if(!cached||cached.version!==version){
      const raster=compositePaintTarget(project,target.id),bytes=await encode(raster,{jpegQuality:95});
      const decoded=getBLPImageData(decodeBLP(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),0);
      if(decoded.width!==raster.width||decoded.height!==raster.height)throw Error('The painted BLP could not be verified.');
      const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
      cached={version,bytes,hash:Array.from(digest.subarray(0,12),v=>v.toString(16).padStart(2,'0')).join('')};
      if(encode===encodePaintBlp1)encodedTargets.set(target,cached);
    }
    const {bytes,hash}=cached;
    const stem=String(target.paintName||target.label||'Texture').replace(/\.[a-z0-9]+$/i,'').replace(/[^a-z0-9_.-]+/gi,'_').replace(/^[^a-z0-9]+/i,'').slice(0,80)||'Texture';
    const name=`MDLxL_Citadel/${stem}_${hash}.blp`;
    painted.Textures[target.textureId]={...painted.Textures[target.textureId],Image:name.replaceAll('/','\\')};
    assets.push({name,bytes,source:'paint'});
  }
  return {model:painted,assets};
}

export function commitPaintModel(doc,prepared){
  return doc.apply('Apply Citadel paint',['Textures','Materials','Geosets'],model=>{
    model.Textures=structuredClone(prepared.model.Textures);
    model.Materials=structuredClone(prepared.model.Materials);
    model.Geosets=structuredClone(prepared.model.Geosets);
  });
}

/** Once the document owns the edited UVs, its UV0 is the next working base.
 * Keeping absolute preset overrides here would erase later edits in UV maps. */
export function adoptCommittedPaintUVs(project){
  let changed=false;
  for(const target of project.targets)for(const binding of target.bindings){if(binding.sourceCoordId){binding.sourceCoordId=0;changed=true;}}
  if(Object.keys(project.uvEdits||{}).length){project.uvEdits={};project.uvRevision=(project.uvRevision||0)+1;changed=true;}
  if(changed){project.materialRevision=(project.materialRevision||0)+1;project.revision++;project.dirty=true;}
}
