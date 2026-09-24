/** Live selection is opt-in and independent of editing visibility/model data. */
export const DEFAULT_UV_PREVIEW_DISPLAY = Object.freeze({mesh:'none',size:1,textureFrame:false});

export function normalizeUVPreviewDisplay(value) {
  const input = value && typeof value === 'object' ? value : {};
  const size = Number(input.size);
  return {
    mesh: ['none','all','selected'].includes(input.mesh) ? input.mesh : 'none',
    size: input.size !== null && input.size !== '' && Number.isFinite(size) ? Math.round(Math.max(.25,Math.min(3,size))*100)/100 : 1,
    textureFrame: input.textureFrame === true,
  };
}

/** Read-only Show mesh may reveal the entire model without expanding UV edits. */
export function previewMeshDomain(model) {
  const result = {};
  for (const [index,geoset] of (model?.Geosets || []).entries()) {
    const positions=geoset?.Vertices;
    const vertices=[];
    for(let vertex=0;vertex<Math.floor((positions?.length||0)/3);vertex++) {
      if([0,1,2].every(axis=>Number.isFinite(positions[vertex*3+axis])))vertices.push(vertex);
    }
    if(vertices.length)result[index]=vertices;
  }
  return result;
}

/** Editor-only isolation for the geosets that supplied the current UV work. */
export function hiddenUVPreviewGeosets(model, eligibleSelection, onlySelected) {
  if (!onlySelected) return undefined;
  const selected = new Set(Object.entries(eligibleSelection || {}).filter(([, ids]) => ids?.length).map(([index]) => Number(index)));
  return new Set((model?.Geosets || []).flatMap((_, index) => selected.has(index) ? [] : [index]));
}

/** Return repeated texture tiles containing eligible UV faces. Exact edge
 * coordinates remain in the face they enclose, so a normal 0..1 island marks
 * one frame instead of the neighbouring repeats. */
export function occupiedUVTextureFrames(values,faces=[],vertices=[],bounds={}) {
  const uv=values||[],result=new Map(),maximum=Math.max(1,Number(bounds.maxFrames)||4096);
  const limits={minU:Number.isFinite(bounds.minU)?Math.floor(bounds.minU):-Infinity,maxU:Number.isFinite(bounds.maxU)?Math.floor(bounds.maxU):Infinity,minV:Number.isFinite(bounds.minV)?Math.floor(bounds.minV):-Infinity,maxV:Number.isFinite(bounds.maxV)?Math.floor(bounds.maxV):Infinity};
  const add=(u,v)=>{if(result.size<maximum&&u>=limits.minU&&u<=limits.maxU&&v>=limits.minV&&v<=limits.maxV)result.set(`${u}:${v}`,[u,v]);};
  let validFace=false;
  for(const face of faces||[]) {
    const points=Array.from(face||[]).map(index=>[Number(uv[index*2]),Number(uv[index*2+1])]).filter(point=>point.every(Number.isFinite));
    if(!points.length)continue;validFace=true;
    const us=points.map(point=>point[0]),vs=points.map(point=>point[1]),minU=Math.min(...us),maxU=Math.max(...us),minV=Math.min(...vs),maxV=Math.max(...vs);
    const firstU=Math.max(limits.minU,Math.floor(minU)),lastU=Math.min(limits.maxU,maxU>minU?Math.ceil(maxU)-1:Math.floor(minU));
    const firstV=Math.max(limits.minV,Math.floor(minV)),lastV=Math.min(limits.maxV,maxV>minV?Math.ceil(maxV)-1:Math.floor(minV));
    for(let v=firstV;v<=lastV&&result.size<maximum;v++)for(let u=firstU;u<=lastU&&result.size<maximum;u++)add(u,v);
  }
  if(!validFace)for(const index of vertices||[]){const u=Number(uv[index*2]),v=Number(uv[index*2+1]);if(Number.isFinite(u)&&Number.isFinite(v))add(Math.floor(u),Math.floor(v));}
  return [...result.values()].sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
}

/** Only the active UV map is manipulated; selections on other maps stay private. */
export function uvPreviewOverlay(domain, selectionOrGeoset, selectedVertices, display, color = '#ff3030') {
  const options=normalizeUVPreviewDisplay(display),singleGeoset=Number(selectionOrGeoset),allowed=new Set(domain?.[singleGeoset]||[]);
  const selectionByGeoset = typeof selectionOrGeoset === 'object' && selectionOrGeoset !== null
    ? Object.fromEntries(Object.entries(selectionOrGeoset).map(([index, ids]) => { const valid = new Set(domain?.[index] || []); return [index, [...new Set(ids || [])].filter(id => Number.isInteger(id) && valid.has(id))]; }).filter(([, ids]) => ids.length))
    : Object.hasOwn(domain || {}, singleGeoset) ? { [singleGeoset]: [...new Set(selectedVertices || [])].filter(index => Number.isInteger(index) && allowed.has(index)) } : {};
  return {
    allMesh:options.mesh==='all',highlightSelection:options.mesh==='selected',size:options.size,
    color:/^#[0-9a-f]{6}$/i.test(color)?color:'#ff3030', eligibleByGeoset:domain||{},selectionByGeoset,
  };
}
