/** A session mask selects authored faces. Coincident UVs still address the same
 * texels until the user deliberately prepares unique mapping. */
export function regionPaintTarget(target,region,scope=null){
  return {...target,coverageBindings:target.coverageBindings||target.bindings,bindings:target.bindings.filter(b=>(scope==null||b.geosetIndex===scope)&&(!region||b.geosetIndex===region.geosetIndex)).map(b=>region?{...b,faceIndices:region.faces}:b)};
}

export function connectedPaintFaces(geo,seed){
  const count=geo.Faces.length/3;if(!Number.isInteger(seed)||seed<0||seed>=count)return new Set();
  const positions=Array.from({length:geo.Vertices.length/3},(_,i)=>Array.from(geo.Vertices.subarray(i*3,i*3+3)).map(v=>Math.round(v*1e5)).join(',')),edges=new Map(),faceEdges=[];
  for(let face=0;face<count;face++){
    const ids=Array.from(geo.Faces.subarray(face*3,face*3+3)),keys=ids.map((id,i)=>[positions[id],positions[ids[(i+1)%3]]].sort().join('|'));faceEdges.push(keys);
    for(const key of keys){if(!edges.has(key))edges.set(key,[]);edges.get(key).push(face);}
  }
  const faces=new Set([seed]),queue=[seed];
  for(let i=0;i<queue.length;i++)for(const key of faceEdges[queue[i]])for(const face of edges.get(key))if(!faces.has(face)){faces.add(face);queue.push(face);}
  return faces;
}
