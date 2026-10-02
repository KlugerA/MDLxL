import {gather} from './mesh-tools.js';
import {createPaintRaster} from './paint-raster.js';

/** Give selected faces their own copy of the pixels they already use. The
 * authored skin stays together on the left; only the chosen strip is copied
 * beside it. No chart packing, resampling, geoset splitting or rig edits.
 * Returns the same atomic, undoable surface transaction as explicit resize. */
export function preparePaintSelectionSpace(model,project,target,region){
  const chosen=model.Geosets[region?.geosetIndex],selected=region?.faces;
  if(!chosen||!selected?.size)throw Error('Select a piece or some faces first.');
  const binding=target.bindings.find(b=>b.geosetIndex===region.geosetIndex);
  if(!binding)throw Error('The selected piece does not use this texture.');
  const width=target.base.width,height=target.base.height,chosenUV=chosen.TVertices[binding.coordId];
  let minimum=0,maximum=1;
  for(const item of target.bindings){
    const uv=model.Geosets[item.geosetIndex]?.TVertices?.[item.coordId];
    if(!uv||[...uv].some(v=>!Number.isFinite(v)))throw Error('This texture has invalid UV coordinates.');
    for(let i=0;i<uv.length;i+=2){minimum=Math.min(minimum,uv[i]);maximum=Math.max(maximum,uv[i]);}
  }
  const leftPad=Math.max(1,Math.ceil(-minimum*width+.5)),rightPad=Math.max(1,Math.ceil((maximum-1)*width+.5));
  let left=Infinity,right=-Infinity;
  for(const face of selected){
    if(!Number.isInteger(face)||face<0||face>=chosen.Faces.length/3)throw Error('The face selection is no longer available.');
    for(let corner=0;corner<3;corner++){const u=chosenUV[chosen.Faces[face*3+corner]*2];left=Math.min(left,Math.floor(u*width));right=Math.max(right,Math.ceil(u*width));}
  }
  right=Math.max(left+1,right);
  const patchWidth=right-left,patchX=leftPad+width+rightPad+2,nextWidth=2**Math.ceil(Math.log2(patchX+patchWidth+1));
  if(nextWidth>4096)throw Error('This texture has no room for another independent selection. Undo an earlier separation or use a smaller texture.');
  const geometry={},previousGeometry={},coordIds={},generatedUVSets={...project.generatedUVSets},uvEdits={...project.uvEdits};
  const byGeoset=new Map();
  for(const item of target.bindings){
    const layer=model.Materials[model.Geosets[item.geosetIndex].MaterialID]?.Layers?.[item.layerIndex];
    if(Number.isInteger(layer?.TVertexAnimId)&&layer.TVertexAnimId>=0)throw Error('Animated UVs cannot be separated into a stationary paint area.');
    if(byGeoset.has(item.geosetIndex)&&byGeoset.get(item.geosetIndex).coordId!==item.coordId)throw Error('This texture uses different UV sets on one geoset. Keep its existing mapping.');
    byGeoset.set(item.geosetIndex,item);
  }
  for(const [index,item] of byGeoset){
    const original=model.Geosets[index],uv=original.TVertices[item.coordId],count=original.Vertices.length/3,layer=model.Materials[original.MaterialID]?.Layers?.[item.layerIndex];
    if(Number.isInteger(layer?.TVertexAnimId)&&layer.TVertexAnimId>=0)throw Error('Animated UVs cannot be separated into a stationary paint area.');
    if(original.TVertices.length>=16)throw Error('This geoset has no free UV set for independent paint.');
    for(const [key,stride] of [['Vertices',3],['Normals',3],['VertexGroup',1],['Tangents',4],['SkinWeights',8]])if(original[key]!=null&&(!ArrayBuffer.isView(original[key])||original[key].length!==count*stride))throw Error('The '+key+' stream does not match the vertices.');
    for(const values of original.TVertices)if(!ArrayBuffer.isView(values)||values.length!==count*2)throw Error('A UV stream does not match the vertices.');
    const sources=Array.from({length:count},(_,i)=>i),faces=new original.Faces.constructor(original.Faces),owners=new Map();
    for(let face=0;face<faces.length/3;face++)for(let corner=0;corner<3;corner++){
      const offset=face*3+corner,source=original.Faces[offset],side=index===region.geosetIndex&&selected.has(face)?1:0,key=source+':'+side;
      let vertex=owners.get(key);
      if(vertex===undefined){vertex=owners.has(source+':'+(1-side))?sources.length:source;if(vertex===sources.length)sources.push(source);owners.set(key,vertex);}
      faces[offset]=vertex;
    }
    if(sources.length>65536)throw Error('Separating this selection would exceed the Warcraft geoset vertex limit.');
    // gather is the mesh editor's existing parallel-stream copier.
    const copied=sources.length===count?original:{...original,...gather({...original,VertexGroup:original.VertexGroup||new Uint8Array(count)},sources)},mapped=new Float32Array(sources.length*2);
    for(let vertex=0;vertex<sources.length;vertex++){const source=sources[vertex];mapped[vertex*2]=(leftPad+uv[source*2]*width)/nextWidth;mapped[vertex*2+1]=uv[source*2+1];}
    if(index===region.geosetIndex)for(const face of selected)for(let corner=0;corner<3;corner++){const vertex=faces[face*3+corner],source=sources[vertex];mapped[vertex*2]=(patchX+uv[source*2]*width-left)/nextWidth;}
    const coordId=copied.TVertices.length;geometry[index]={...copied,Faces:faces,TVertices:[...copied.TVertices,mapped]};previousGeometry[index]=original;coordIds[index]=coordId;generatedUVSets[index]=coordId;
    for(const key of Object.keys(uvEdits))if(key.startsWith(index+':'))delete uvEdits[key];
  }
  const copy=raster=>{
    const result=createPaintRaster(nextWidth,height),address=x=>target.flags&1?(x%width+width)%width:Math.max(0,Math.min(width-1,x));
    for(let y=0;y<height;y++){
      result.data.set(raster.data.subarray(y*width*4,(y+1)*width*4),(y*nextWidth+leftPad)*4);
      for(let x=-leftPad;x<width+rightPad;x++)if(x<0||x>=width){const source=address(x);result.data.set(raster.data.subarray((y*width+source)*4,(y*width+source+1)*4),(y*nextWidth+x+leftPad)*4);}
      for(let x=-1;x<=patchWidth;x++){const source=address(left+x);result.data.set(raster.data.subarray((y*width+source)*4,(y*width+source+1)*4),(y*nextWidth+patchX+x)*4);}
    }
    return result;
  };
  const after={...target,base:copy(target.base),alphaMask:copy(target.alphaMask),coats:target.coats.map(coat=>({...coat,raster:copy(coat.raster)})),flags:target.flags&~1,revision:(target.revision||0)+1,
    bindings:target.bindings.map(b=>project.preserveMaterials?{...b,coordId:coordIds[b.geosetIndex]}:{...b,coordId:0,sourceCoordId:coordIds[b.geosetIndex]})};
  return {target:after,geometry,previousGeometry,uvEdits,generatedUVSets};
}
