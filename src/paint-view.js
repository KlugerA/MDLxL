import {paintUVTriangles,paintUVCoverage,paintUVFilterCoverage,forEachPaintUVTexel} from './paint-uv-coverage.js';
import {applyPaintMaterials,paintableGeosets} from './paint-materials.js';
import {sampleGeosetAnimation} from './animation.js';

/** Use the model's own living/Stand visibility for initial framing. Corpse and
 * portrait parts remain in the model and can be revealed through selection. */
export function paintStandHidden(model){
  const sequence=model.Sequences?.findIndex(s=>/^Stand(?:$|[ -])/i.test(s.Name||''))??-1;
  if(sequence<0)return new Set();
  const frame=model.Sequences[sequence].Interval[0];
  return new Set(model.Geosets.map((_,i)=>i).filter(i=>sampleGeosetAnimation(model,i,frame,sequence,frame).alpha<=.001));
}
export function visiblePaintGeosets(model,reveal=null){const hidden=paintStandHidden(model);return paintableGeosets(model).filter(i=>i===reveal||!hidden.has(i));}
/** Paint-only display geometry. Source geometry, UVs and exported models stay intact.
 * The same clipped rest-pose model feeds picking, depth and brush projection.
 * Shared UV pixels still share paint when the hidden half is shown again.
 */
export function paintHalfModel(model, half) {
  if (!half) return model;
  const axis = ['x', 'y', 'z'].indexOf(half.axis), sign = half.side === -1 ? -1 : 1;
  if (axis < 0) throw Error('Invalid mirror axis.');
  // A weapon, corpse or helper geoset must not move the symmetry plane.
  // The caller chooses an explicit plane; Warcraft unit origins default to 0.
  const center = Number.isFinite(half.position) ? half.position : 0;
  const Geosets = model.Geosets.map(geo => {
    const positions = [], normals = [], faces = [], uvs = (geo.TVertices || []).map(() => []);
    const vertex = id => [...geo.Vertices.slice(id * 3, id * 3 + 3), ...(geo.Normals?.length === geo.Vertices.length ? geo.Normals.slice(id * 3, id * 3 + 3) : [0, 0, 1]), ...uvs.flatMap((_, set) => [geo.TVertices[set][id * 2], geo.TVertices[set][id * 2 + 1]])];
    for (let offset = 0; offset < geo.Faces.length; offset += 3) {
      const polygon = [vertex(geo.Faces[offset]), vertex(geo.Faces[offset + 1]), vertex(geo.Faces[offset + 2])], clipped = [];
      for (let i = 0; i < 3; i++) {
        const a = polygon[i], b = polygon[(i + 1) % 3], da = sign * (a[axis] - center), db = sign * (b[axis] - center);
        if (da >= 0) clipped.push(a);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); clipped.push(a.map((value, channel) => value + (b[channel] - value) * t)); }
      }
      for (let i = 1; i + 1 < clipped.length; i++) for (const v of [clipped[0], clipped[i], clipped[i + 1]]) {
        faces.push(positions.length / 3); positions.push(...v.slice(0, 3)); normals.push(...v.slice(3, 6));
        uvs.forEach((values, set) => values.push(v[6 + set * 2], v[7 + set * 2]));
      }
    }
    return { ...geo, Vertices: new Float32Array(positions), Normals: new Float32Array(normals), Faces: new Uint32Array(faces), TVertices: uvs.map(values => new Float32Array(values)) };
  });
  return { ...model, Geosets };
}

export function paintPartCenter(model, index, axis = 'y') {
  const component = ['x','y','z'].indexOf(axis), positions = model.Geosets[index]?.Vertices || [];
  if(component<0)throw Error('Invalid mirror axis.');
  let min = Infinity, max = -Infinity;
  for (let i = component; i < positions.length; i += 3) { min = Math.min(min, positions[i]); max = Math.max(max, positions[i]); }
  return Number.isFinite(min) ? (min + max) / 2 : 0;
}

/** UV edits belong to the portable paint preset, never the source document. */
export function paintProjectModel(model, project, originalModel = null) {
  if(originalModel&&project?.excludedGeosets?.length){
    const excluded=new Set(project.excludedGeosets);
    model={...model,Geosets:model.Geosets.map((g,i)=>excluded.has(i)&&originalModel.Geosets[i]?{...g,MaterialID:originalModel.Geosets[i].MaterialID}:g)};
  }
  model=applyPaintMaterials(model,project);
  // A fresh Citadel material replaces the model's authored surface colour.
  // Keep visibility/drop-shadow animation, but do not multiply the new paint
  // by the old skin's RGB track in either the viewport or the saved model.
  const freshGeosets=new Set((project?.targets||[]).filter(target=>target.basecoat&&target.generatedUV).flatMap(target=>(target.bindings||[]).map(binding=>binding.geosetIndex)));
  if(freshGeosets.size&&(model.GeosetAnims||[]).some(animation=>freshGeosets.has(animation.GeosetId)&&((animation.Flags||0)&2||animation.Color!=null))){
    model={...model,GeosetAnims:model.GeosetAnims.map(animation=>freshGeosets.has(animation.GeosetId)?{...animation,Flags:(animation.Flags||0)&~2,Color:null}:animation)};
  }
  const edits = project?.uvEdits;
  if (!edits || !Object.keys(edits).length) return model;
  return { ...model, Geosets: model.Geosets.map((geo, index) => {
    const sets = (geo.TVertices||[]).map((uv, set) => {
      const edit=edits[`${index}:${set}`];if(!edit)return uv;
      if(edit.length!==uv.length||!Array.from(edit).every(Number.isFinite))throw Error('The preset contains invalid UV coordinates.');
      return new Float32Array(edit);
    });
    return sets.some((uv, set) => uv !== geo.TVertices[set]) ? { ...geo, TVertices: sets } : geo;
  }) };
}

/** Silhouette/open boundaries only; weld positional UV seams so no triangle grid
 * covers the painted surface. Rebuild on camera/part changes, never on paint dabs.
 */
const outlineTopology=new WeakMap();
export function paintOutlinePositions(geoset,matrix) {
  if(!geoset)return new Float32Array();
  const vertices=geoset.Vertices,faces=geoset.Faces;
  let topology=outlineTopology.get(geoset);
  // Paint geometry is immutable between model/geoset changes. Camera changes
  // reuse welded edges and scratch arrays, including seams in clipped models.
  if(!topology||topology.vertices!==vertices||topology.faces!==faces){
    const keys=Array.from({length:vertices.length/3},(_,id)=>`${Math.round(vertices[id*3]*10000)},${Math.round(vertices[id*3+1]*10000)},${Math.round(vertices[id*3+2]*10000)}`),edges=new Map();
    for(let i=0;i<faces.length;i+=3)for(let j=0;j<3;j++){
      const first=faces[i+j],last=faces[i+(j+1)%3],a=keys[first],b=keys[last],key=a<b?a+'|'+b:b+'|'+a,existing=edges.get(key);
      if(existing)existing.triangles.push(i/3);else edges.set(key,{first,last,triangles:[i/3]});
    }
    topology={vertices,faces,edges:[...edges.values()],projected:new Float64Array(vertices.length/3*2),front:new Uint8Array(faces.length/3)};outlineTopology.set(geoset,topology);
  }
  const {projected,front}=topology;
  for(let id=0;id<vertices.length/3;id++){const x=vertices[id*3],y=vertices[id*3+1],z=vertices[id*3+2],w=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];projected[id*2]=(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])/w;projected[id*2+1]=(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])/w;}
  for(let i=0;i<faces.length;i+=3){const a=faces[i]*2,b=faces[i+1]*2,c=faces[i+2]*2;front[i/3]=(projected[b]-projected[a])*(projected[c+1]-projected[a+1])-(projected[b+1]-projected[a+1])*(projected[c]-projected[a])>=0?1:0;}
  const positions=[];
  for(const edge of topology.edges)if(edge.triangles.length===1||edge.triangles.some(face=>front[face]!==front[edge.triangles[0]]))for(const id of [edge.first,edge.last])positions.push(vertices[id*3],vertices[id*3+1],vertices[id*3+2]);
  return new Float32Array(positions);
}

/** Restrict brush projection/fill to the explicitly selected geoset. */
export function paintGeosetTarget(target, geosetIndex) {
  return { ...target, coverageBindings: target.coverageBindings||target.bindings, bindings: target.bindings.filter(binding => binding.geosetIndex === geosetIndex), geosetIndices: [geosetIndex] };
}

export function paintGeosetMask(model,target,size){
  const triangles=paintUVTriangles(model,target.bindings),coverage=paintUVCoverage(paintUVTriangles(model,target.coverageBindings||target.bindings),size,size,target.flags),mask=paintUVFilterCoverage(triangles,size,size,target.flags);
  for(const uv of triangles)forEachPaintUVTexel(uv,size,size,target.flags,(x,y,u,v,w,gutter)=>{const pixel=y*size+x;if(!gutter||!coverage[pixel])mask[pixel]=255;},Math.SQRT2);
  return mask;
}
