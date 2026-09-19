export const nodeCollections = ['Bones','Helpers','Attachments','Lights','ParticleEmitters','ParticleEmitters2','RibbonEmitters','EventObjects','CollisionShapes','ParticleEmitterPopcorns'];
export function nodeKind(model,node){return nodeCollections.find(k=>model[k]?.some(n=>n.ObjectId===node.ObjectId))||'Nodes';}
export function setKey(target,property,frame,values,options={}) {
  if(!Number.isInteger(frame)||frame<0||frame>0xffffffff)throw new Error('Keyframe time must be a non-negative integer.');
  if(!values.length||values.some(n=>!Number.isFinite(n)))throw new Error('Key values must be finite numbers.');
  const previous=target[property];
  const track=previous?.Keys?previous:{LineType:options.lineType??1,Keys:[]};
  if(options.lineType!==undefined)track.LineType=options.lineType;
  const Typed=property==='TextureID'||property==='TextureSlot'?Int32Array:Float32Array;
  const key={Frame:frame,Vector:new Typed(values)};
  if(track.LineType>=2){key.InTan=new Typed(options.inTan||values);key.OutTan=new Typed(options.outTan||values);}
  const index=track.Keys.findIndex(k=>k.Frame===frame);
  if(index<0)track.Keys.push(key);else track.Keys[index]=key;
  track.Keys.sort((a,b)=>a.Frame-b.Frame);target[property]=track;
}
function selectedIndices(geoset,indices,{allowEmpty=false}={}) {
  const count=geoset.Vertices?.length/3;
  if(!Number.isInteger(count)||count<0)throw new Error('Geoset vertex data must contain complete XYZ coordinates.');
  const ids=[...new Set(indices)];
  if(!ids.length&&!allowEmpty)throw new Error('Select vertices first.');
  if(ids.some(i=>!Number.isInteger(i)||i<0||i>=count))throw new Error('Vertex selection is out of range.');
  return ids;
}
function checkAttribute(array,count,stride,label) {
  if(array?.length&&array.length!==count*stride)throw new Error(`${label} do not match the vertex count.`);
}
export function transformVertices(geoset,indices,translation=[0,0,0],scale=[1,1,1],rotation=[0,0,0],pivot,{allowSingularScale=false}={}) {
  const ids=selectedIndices(geoset,indices);
  for(const vector of [translation,scale,rotation])if(vector?.length!==3||[...vector].some(v=>!Number.isFinite(v)))throw new Error('Transforms need three finite values per vector.');
  // A singular transform has no inverse normal matrix or tangent handedness.
  // Zoom is the one intentional exception: it may collapse distinct vertices
  // onto a shared pivot while preserving their independent vertex attributes.
  const singular=scale.some(v=>Math.abs(v)<1e-8);
  if(singular&&!allowSingularScale)throw new Error('Scale cannot be zero or nearly zero.');
  const count=geoset.Vertices.length/3;
  checkAttribute(geoset.Normals,count,3,'Normals');checkAttribute(geoset.Tangents,count,4,'Tangents');
  if(pivot&&(pivot.length!==3||[...pivot].some(v=>!Number.isFinite(v))))throw new Error('Transform pivot must have three finite coordinates.');
  const center=pivot?[...pivot]:[0,0,0];if(!pivot)for(const i of ids)for(let a=0;a<3;a++)center[a]+=geoset.Vertices[i*3+a]/ids.length;
  const angles=rotation.map(d=>d*Math.PI/180);
  const rotate=v=>{let [x,y,z]=v;let c=Math.cos(angles[0]),s=Math.sin(angles[0]);[y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(angles[1]);s=Math.sin(angles[1]);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(angles[2]);s=Math.sin(angles[2]);return [x*c-y*s,x*s+y*c,z];};
  const mirrored=scale.filter(v=>v<0).length%2===1;
  for(const i of ids){const p=rotate([0,1,2].map(a=>(geoset.Vertices[i*3+a]-center[a])*scale[a]));for(let a=0;a<3;a++)geoset.Vertices[i*3+a]=p[a]+center[a]+translation[a];
    // At a zero zoom factor positions intentionally coincide, but there is no
    // valid inverse normal matrix. Leave normal/tangent records untouched.
    let normal;
    if(!singular&&geoset.Normals?.length){normal=rotate([0,1,2].map(a=>geoset.Normals[i*3+a]/scale[a]));const length=Math.hypot(...normal)||1;normal=normal.map(v=>v/length);for(let a=0;a<3;a++)geoset.Normals[i*3+a]=normal[a];}
    if(!singular&&geoset.Tangents?.length){
      // Tangents are directions, normals are covectors. Apply R*S to T and
      // R*inverse(S) to N, then remove roundoff/non-orthogonality from T.
      let tangent=rotate([0,1,2].map(a=>geoset.Tangents[i*4+a]*scale[a]));
      if(normal){const dot=tangent.reduce((sum,v,a)=>sum+v*normal[a],0);tangent=tangent.map((v,a)=>v-dot*normal[a]);}
      const length=Math.hypot(...tangent)||1;
      for(let a=0;a<3;a++)geoset.Tangents[i*4+a]=tangent[a]/length;
      if(mirrored)geoset.Tangents[i*4+3]*=-1;
    }
  }
  if(mirrored&&!singular){const selected=new Set(ids);for(let i=0;i<geoset.Faces.length;i+=3)if([0,1,2].every(a=>selected.has(geoset.Faces[i+a])))[geoset.Faces[i+1],geoset.Faces[i+2]]=[geoset.Faces[i+2],geoset.Faces[i+1]];}
}
export function deleteVertices(geoset,indices){
  const removed=new Set(selectedIndices(geoset,indices,{allowEmpty:true}));if(!removed.size)return;
  const oldCount=geoset.Vertices.length/3;const kept=Array.from({length:oldCount},(_,i)=>i).filter(i=>!removed.has(i));
  for(const [array,stride,label] of [[geoset.Normals,3,'Normals'],[geoset.VertexGroup,1,'Vertex groups'],[geoset.Tangents,4,'Tangents'],[geoset.SkinWeights,8,'Skin weights'],...(geoset.TVertices||[]).map(uv=>[uv,2,'UV coordinates'])])checkAttribute(array,oldCount,stride,label);
  const remap=new Map(kept.map((id,i)=>[id,i]));
  const gather=(array,stride)=>{if(!array?.length)return array;const out=new array.constructor(kept.length*stride);kept.forEach((id,i)=>out.set(array.subarray(id*stride,id*stride+stride),i*stride));return out;};
  const faces=[];for(let i=0;i<geoset.Faces.length;i+=3){const tri=Array.from(geoset.Faces.subarray(i,i+3));if(tri.every(id=>remap.has(id)))faces.push(...tri.map(id=>remap.get(id)));}
  geoset.Vertices=gather(geoset.Vertices,3);geoset.Normals=gather(geoset.Normals,3);geoset.VertexGroup=gather(geoset.VertexGroup,1);geoset.TVertices=(geoset.TVertices||[]).map(uv=>gather(uv,2));geoset.Faces=new Uint16Array(faces);
  if(geoset.Tangents)geoset.Tangents=gather(geoset.Tangents,4);
  if(geoset.SkinWeights)geoset.SkinWeights=gather(geoset.SkinWeights,8);
}
export function bindVertices(model,geoset,indices,boneId){
  const ids=selectedIndices(geoset,indices);
  if(!Number.isInteger(boneId)||boneId<0||!model.Bones.some(n=>n.ObjectId===boneId))throw new Error('Choose a bone to bind vertices.');
  const count=geoset.Vertices.length/3;
  if(geoset.VertexGroup?.length!==count)throw new Error('Vertex groups do not match the vertex count.');
  checkAttribute(geoset.SkinWeights,count,8,'Skin weights');
  if(geoset.SkinWeights?.length&&boneId>255)throw new Error('This skin uses 8-bit bone IDs.');
  let group=geoset.Groups.findIndex(g=>g.length===1&&g[0]===boneId);
  if(group<0){if(geoset.Groups.length>=256)throw new Error('Classic vertex groups are limited to 256 by the file format.');group=geoset.Groups.push([boneId])-1;}
  if(group>255)throw new Error('Classic vertex groups are limited to 256 by the file format.');
  for(const i of ids){geoset.VertexGroup[i]=group;if(geoset.SkinWeights?.length)geoset.SkinWeights.set([boneId,0,0,0,255,0,0,0],i*8);}
  geoset.TotalGroupsCount=geoset.Groups.reduce((sum,g)=>sum+g.length,0);
}
export function addTriangle(geoset,indices){
  if(indices.length!==3)throw new Error('Select exactly three vertices in winding order.');
  const ids=selectedIndices(geoset,indices);
  if(ids.length!==3)throw new Error('A triangle needs three distinct vertices.');
  if(ids.some(id=>id>65535))throw new Error('Triangle indices exceed the file format’s 16-bit limit.');
  const face=new Uint16Array(geoset.Faces.length+3);face.set(geoset.Faces);face.set(ids,geoset.Faces.length);geoset.Faces=face;
}
export function makeCube(model){
  const vertices=new Float32Array([-30,-15,0,30,-15,0,30,15,0,-30,15,0,-30,-15,60,30,-15,60,30,15,60,-30,15,60]);
  const faces=new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);
  const bone=model.Bones[0]?.ObjectId;
  return {Vertices:vertices,Normals:new Float32Array(vertices.length),TVertices:[new Float32Array([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1])],Faces:faces,VertexGroup:new Uint8Array(8),Groups:bone===undefined?[[]]:[[bone]],TotalGroupsCount:bone===undefined?0:1,MaterialID:0,SelectionGroup:0,Unselectable:false,MinimumExtent:new Float32Array([-30,-15,0]),MaximumExtent:new Float32Array([30,15,60]),BoundsRadius:68,Anims:[]};
}
