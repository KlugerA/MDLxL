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
