import { renderFixture } from './herrdave-render.js';

export function previewPresentationFixture() {
  const model=renderFixture('triangle'),geo=model.Geosets[0];
  model.Textures[0]={Image:'preview-checker.png',ReplaceableId:0,Flags:0};
  geo.Vertices=new Float32Array([-55,-30,0,5,-30,0,5,30,0,-55,30,0]);geo.Normals=new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]);geo.Faces=new Uint16Array([0,1,2,0,2,3]);geo.TVertices=[new Float32Array([0,0,1,0,1,1,0,1])];geo.VertexGroup=new Uint8Array(4);
  const second=structuredClone(geo);second.Vertices=new Float32Array(second.Vertices.map((v,i)=>i%3===0?v+70:v));model.Geosets.push(second);
  model.Sequences=[{Name:'Tint',Interval:new Uint32Array([0,1000])}];
  model.GeosetAnims=[{GeosetId:0,Flags:2,Alpha:1,Color:{LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([1,.25,.5])},{Frame:1000,Vector:new Float32Array([.25,.75,1])}]}},{GeosetId:1,Flags:2,Color:new Float32Array([.5,1,.25]),Alpha:1}];
  return model;
}
