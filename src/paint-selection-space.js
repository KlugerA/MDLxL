import {gather} from './mesh-tools.js';
import {createPaintRaster,samplePaintRaster} from './paint-raster.js';
import {createFreshPaintAtlas} from './paint-uv-atlas.js';

function selectionScale(geo,uv,faces,width,height){
  const ratios=[];let totalArea=0;
  for(const face of faces){
    const [a,b,c]=geo.Faces.subarray(face*3,face*3+3),du=(uv[b*2]-uv[a*2])*width,dv=(uv[b*2+1]-uv[a*2+1])*height,eu=(uv[c*2]-uv[a*2])*width,ev=(uv[c*2+1]-uv[a*2+1])*height,det=du*ev-dv*eu;
    if(Math.abs(det)<1e-8)continue;
    const p=[0,1,2].map(i=>geo.Vertices[b*3+i]-geo.Vertices[a*3+i]),q=[0,1,2].map(i=>geo.Vertices[c*3+i]-geo.Vertices[a*3+i]);
    const area=Math.hypot(p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]);
    const horizontal=Math.hypot(...p.map((v,i)=>(v*ev-q[i]*dv)/det)),vertical=Math.hypot(...p.map((v,i)=>(q[i]*du-v*eu)/det));
    if(area>0&&horizontal>0&&vertical>0){ratios.push({ratio:horizontal/vertical,area});totalArea+=area;}
  }
  // A wide surface can be squeezed into a one-pixel UV strip. Replicate those
  // existing pixels along the compressed axis before adding new detail. Keep
  // modest authored differences and genuinely collapsed mappings unchanged.
  // An isolated sliver must not inflate every face in a connected selection.
  // Let the majority of its physical surface determine the axis correction.
  ratios.sort((a,b)=>a.ratio-b.ratio);let accumulated=0,ratio=1;
  for(const item of ratios){accumulated+=item.area;if(accumulated>=totalArea/2){ratio=item.ratio;break;}}
  const scale=value=>Number.isFinite(value)&&value>=4?2**Math.ceil(Math.log2(value)):1;
  return {x:scale(ratio),y:scale(1/ratio)};
}

function occupiedWidth(target,uvMaximum){
  const width=target.base.width;
  // Reuse the empty tail from an earlier allocation. Authored image pixels,
  // hidden RGB, existing paint and every bound UV all reserve their columns.
  let used=Math.max(1,Math.min(width,Math.ceil(uvMaximum*width+.5)));
  for(const raster of [target.base,...target.coats.map(coat=>coat.raster)])for(let y=0;y<raster.height&&used<width;y++)for(let x=width-1;x>=used;x--){const i=(y*width+x)*4;if(raster.data[i]||raster.data[i+1]||raster.data[i+2]||raster.data[i+3]){used=x+1;break;}}
  return used;
}

/** Give selected faces their own copy of the pixels they already use. The
 * authored skin stays together on the left; only the chosen strip is copied
 * beside it. Compressed axes gain exact nearest-copy pixels; a constant UV
 * selection gets local charts. No whole-model chart packing, original-skin
 * resampling, geoset splitting or rig edits.
 * Returns the same atomic, undoable surface transaction as explicit resize. */
export function preparePaintSelectionSpace(model,project,target,region){
  const chosen=model.Geosets[region?.geosetIndex],selected=region?.faces;
  if(!chosen||!selected?.size)throw Error('Select a piece or some faces first.');
  const binding=target.bindings.find(b=>b.geosetIndex===region.geosetIndex);
  if(!binding)throw Error('The selected piece does not use this texture.');
  const width=target.base.width,height=target.base.height,chosenUV=chosen.TVertices[binding.coordId];
  let minimum=0,maximum=-Infinity,minV=0,maxV=1;
  for(const item of target.bindings){
    const uv=model.Geosets[item.geosetIndex]?.TVertices?.[item.coordId];
    if(!uv||[...uv].some(v=>!Number.isFinite(v)))throw Error('This texture has invalid UV coordinates.');
    for(let i=0;i<uv.length;i+=2){minimum=Math.min(minimum,uv[i]);maximum=Math.max(maximum,uv[i]);minV=Math.min(minV,uv[i+1]);maxV=Math.max(maxV,uv[i+1]);}
  }
  const usedWidth=occupiedWidth(target,maximum),leftPad=Math.max(1,Math.ceil(-minimum*width+.5)),rightPad=usedWidth===width?Math.max(1,Math.ceil((maximum-1)*width+.5)):0;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,pointUV=null,constantUV=true;
  for(const face of selected){
    if(!Number.isInteger(face)||face<0||face>=chosen.Faces.length/3)throw Error('The face selection is no longer available.');
    for(let corner=0;corner<3;corner++){const id=chosen.Faces[face*3+corner]*2,u=chosenUV[id],v=chosenUV[id+1];pointUV||=[u,v];if(u!==pointUV[0]||v!==pointUV[1])constantUV=false;left=Math.min(left,Math.floor(u*width));right=Math.max(right,Math.ceil(u*width));top=Math.min(top,Math.floor(v*height));bottom=Math.max(bottom,Math.ceil(v*height));}
  }
  // A single authored UV point has a constant color on this selection. Give
  // only those faces fresh local charts, reusing the existing atlas builder;
  // copying that color preserves the skin while making new imagery possible.
  // The complete original image and all other faces keep their arrangement.
  const localFaces=[...selected],localAtlas=constantUV?createFreshPaintAtlas({Geosets:[{...chosen,Faces:new chosen.Faces.constructor(localFaces.flatMap(face=>[...chosen.Faces.subarray(face*3,face*3+3)])),TVertices:[]}]},[0],256).model.Geosets[0]:null;
  const localOffsets=new Map(localFaces.map((face,index)=>[face,index*3]));
  right=Math.max(left+1,right);
  const scale=selectionScale(chosen,chosenUV,selected,width,height);
  if(scale.y===1){top=0;bottom=height;}else bottom=Math.max(top+1,bottom);
  const patchWidth=localAtlas?256:(right-left)*scale.x,patchHeight=localAtlas?256:(bottom-top)*scale.y,patchX=leftPad+usedWidth+rightPad+2,patchY=localAtlas||scale.y===1?0:1,nextWidth=Math.max(width,2**Math.ceil(Math.log2(patchX+patchWidth+1)));
  const growY=patchY+patchHeight+Number(patchY>0)>height,topPad=growY?Math.max(1,Math.ceil(-minV*height+.5)):0,bottomPad=growY?Math.max(1,Math.ceil((maxV-1)*height+.5)):0,nextHeight=growY?2**Math.ceil(Math.log2(Math.max(height+topPad+bottomPad,patchY+patchHeight+1))):height;
  if(nextWidth>4096||nextHeight>4096)throw Error('This texture has no room for another independent selection. Undo an earlier separation or use a smaller texture.');
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
    const paintedLayers=new Set(target.bindings.filter(b=>b.geosetIndex===index).map(b=>b.layerIndex));
    const usedElsewhere=model.Materials[original.MaterialID]?.Layers?.some((layer,layerIndex)=>!paintedLayers.has(layerIndex)&&(layer.CoordId||0)===item.coordId);
    const reuse=project.generatedUVSets[index]===item.coordId&&!usedElsewhere;
    if(!reuse&&original.TVertices.length>=16)throw Error('This geoset has no free UV set for independent paint.');
    for(const [key,stride] of [['Vertices',3],['Normals',3],['VertexGroup',1],['Tangents',4],['SkinWeights',8]])if(original[key]!=null&&(!ArrayBuffer.isView(original[key])||original[key].length!==count*stride))throw Error('The '+key+' stream does not match the vertices.');
    for(const values of original.TVertices)if(!ArrayBuffer.isView(values)||values.length!==count*2)throw Error('A UV stream does not match the vertices.');
    const sources=Array.from({length:count},(_,i)=>i),faces=new original.Faces.constructor(original.Faces),owners=new Map(),claimed=new Set();
    for(let face=0;face<faces.length/3;face++)for(let corner=0;corner<3;corner++){
      const offset=face*3+corner,source=original.Faces[offset],side=index===region.geosetIndex&&selected.has(face)?1:0,key=source+':'+side+(side&&localAtlas?':'+localAtlas.Faces[localOffsets.get(face)+corner]:'');
      let vertex=owners.get(key);
      if(vertex===undefined){vertex=claimed.has(source)?sources.length:source;if(vertex===sources.length)sources.push(source);claimed.add(source);owners.set(key,vertex);}
      faces[offset]=vertex;
    }
    if(sources.length>65536)throw Error('Separating this selection would exceed the Warcraft geoset vertex limit.');
    // gather is the mesh editor's existing parallel-stream copier.
    const copied=sources.length===count?original:{...original,...gather({...original,VertexGroup:original.VertexGroup||new Uint8Array(count)},sources)},mapped=new Float32Array(sources.length*2);
    for(let vertex=0;vertex<sources.length;vertex++){const source=sources[vertex];mapped[vertex*2]=(leftPad+uv[source*2]*width)/nextWidth;mapped[vertex*2+1]=(topPad+uv[source*2+1]*height)/nextHeight;}
    if(index===region.geosetIndex)for(const face of selected)for(let corner=0;corner<3;corner++){
      const vertex=faces[face*3+corner],source=sources[vertex],localVertex=localAtlas?.Faces[localOffsets.get(face)+corner],localUV=localAtlas?.TVertices[0];
      mapped[vertex*2]=(patchX+(localAtlas?localUV[localVertex*2]*patchWidth:(uv[source*2]*width-left)*scale.x))/nextWidth;
      mapped[vertex*2+1]=(patchY+(localAtlas?localUV[localVertex*2+1]*patchHeight:(uv[source*2+1]*height-top)*scale.y))/nextHeight;
    }
    const coordId=reuse?item.coordId:copied.TVertices.length,TVertices=[...copied.TVertices];TVertices[coordId]=mapped;geometry[index]={...copied,Faces:faces,TVertices};previousGeometry[index]=original;coordIds[index]=coordId;generatedUVSets[index]=coordId;
    for(const key of Object.keys(uvEdits))if(key.startsWith(index+':'))delete uvEdits[key];
  }
  const copy=raster=>{
    const result=createPaintRaster(nextWidth,nextHeight),address=(value,size,wrap)=>wrap?(value%size+size)%size:Math.max(0,Math.min(size-1,value));
    for(let y=-topPad;y<height+bottomPad;y++){
      const sy=address(y,height,target.flags&2),row=(y+topPad)*nextWidth;
      result.data.set(raster.data.subarray(sy*width*4,(sy*width+usedWidth)*4),(row+leftPad)*4);
      for(let x=-leftPad;x<usedWidth+rightPad;x++)if(x<0||x>=usedWidth){const source=sy*width+address(x,width,target.flags&1);result.data.set(raster.data.subarray(source*4,source*4+4),(row+x+leftPad)*4);}
    }
    const constant=localAtlas?samplePaintRaster(raster,...pointUV,target.flags):null;
    for(let y=patchY?-1:0;y<patchHeight+(patchY?1:0);y++)for(let x=-1;x<=patchWidth;x++){const source=address(top+Math.floor(y/scale.y),height,target.flags&2)*width+address(left+Math.floor(x/scale.x),width,target.flags&1);result.data.set(constant||raster.data.subarray(source*4,source*4+4),((patchY+y)*nextWidth+patchX+x)*4);}
    return result;
  };
  const after={...target,base:copy(target.base),alphaMask:copy(target.alphaMask),coats:target.coats.map(coat=>({...coat,raster:copy(coat.raster)})),flags:target.flags&~(growY?3:1),revision:(target.revision||0)+1,
    bindings:target.bindings.map(b=>project.preserveMaterials?{...b,coordId:coordIds[b.geosetIndex]}:{...b,coordId:0,sourceCoordId:coordIds[b.geosetIndex]})};
  return {target:after,geometry,previousGeometry,uvEdits,generatedUVSets};
}
