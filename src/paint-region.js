/** A session mask selects authored faces. Coincident UVs still address the same
 * texels until the user deliberately prepares unique mapping. */
export const paintRegionEntries=region=>region?.byGeoset?[...region.byGeoset]:region?[[region.geosetIndex,region.faces]]:[];
export const paintRegionFaces=(region,index)=>region?.byGeoset?region.byGeoset.get(index):region?.geosetIndex===index?region.faces:null;
export function changePaintRegion(region,index,faces,operation='replace'){
  const byGeoset=new Map(operation==='replace'?[]:paintRegionEntries(region).map(([id,set])=>[id,new Set(set)]));
  const next=byGeoset.get(index)||new Set();
  for(const face of faces)operation==='subtract'?next.delete(face):next.add(face);
  if(next.size)byGeoset.set(index,next);else byGeoset.delete(index);
  const active=byGeoset.has(index)?index:byGeoset.has(region?.geosetIndex)?region.geosetIndex:byGeoset.keys().next().value??index;
  return {geosetIndex:active,faces:byGeoset.get(active)||new Set(),byGeoset};
}
export function regionPaintTarget(target,region,scope=null){
  return {...target,coverageBindings:target.coverageBindings||target.bindings,bindings:target.bindings.filter(b=>(region||scope==null||b.geosetIndex===scope)&&(!region||paintRegionFaces(region,b.geosetIndex)?.size)).map(b=>region?{...b,faceIndices:paintRegionFaces(region,b.geosetIndex)}:b)};
}

/** View-only face isolation. Keep original face IDs for picking/projection;
 * the model's geometry, UVs and parallel vertex streams are not rewritten. */
export function isolatePaintRegion(model,region){
  if(!region)return model;
  const Geosets=[...model.Geosets];
  for(const [index,faces] of paintRegionEntries(region)){
    const geo=model.Geosets[index];if(!geo)continue;
    const ids=[...faces].filter(id=>Number.isInteger(id)&&id>=0&&id<geo.Faces.length/3).sort((a,b)=>a-b);
    Geosets[index]={...geo,Faces:new geo.Faces.constructor(ids.flatMap(id=>Array.from(geo.Faces.subarray(id*3,id*3+3)))),paintFaceIndices:ids};
  }
  return {...model,Geosets};
}

const pieceCache=new WeakMap();
export function paintConnectedPieces(geo){
  if(pieceCache.has(geo))return pieceCache.get(geo);
  const count=geo.Faces.length/3,parent=Int32Array.from({length:count},(_,i)=>i),edges=new Map();
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const positions=Array.from({length:geo.Vertices.length/3},(_,i)=>Array.from(geo.Vertices.subarray(i*3,i*3+3)).map(v=>Math.round(v*1e5)).join(','));
  for(let f=0;f<count;f++)for(let c=0;c<3;c++){
    const a=positions[geo.Faces[f*3+c]],b=positions[geo.Faces[f*3+(c+1)%3]],key=a<b?a+'|'+b:b+'|'+a;
    if(edges.has(key))parent[root(f)]=root(edges.get(key));else edges.set(key,f);
  }
  const groups=new Map();for(let f=0;f<count;f++){const id=root(f);if(!groups.has(id))groups.set(id,new Set());groups.get(id).add(f);}
  const pieces=[...groups.values()],byFace=new Map();for(const faces of pieces)for(const f of faces)byFace.set(f,faces);
  const result={pieces,byFace};pieceCache.set(geo,result);return result;
}
export function connectedPaintFaces(geo,seed){return new Set(paintConnectedPieces(geo).byFace.get(seed)||[]);}
