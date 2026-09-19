import { normalizeVersionFields } from './model-version.js';
import { openDocument, createNode, recalculateExtents } from './editor-document.js';

/** E32: a 64-unit cube centered on the origin, eight shared corner vertices.
 * The codec calls depth-write suppression NoDepthSet (bit 128); Shading=0
 * leaves that and all five other requested shading flags disabled.
 */
export function createStarterDocument(version = 800) {
  if (![800,1000].includes(version)) throw new Error('Choose MDX800 or MDX1000.');
  const empty = openDocument(`Version { FormatVersion ${version}, }\nModel "Untitled" { BlendTime 150, MinimumExtent {0,0,0}, MaximumExtent {0,0,0}, BoundsRadius 0, }`, 'Untitled.mdl');
  const doc = openDocument(empty.serialize('mdx'), 'Untitled.mdx');
  doc.apply('Create starter cube', ['Geosets','Materials','Textures','Nodes','Info'], model => {
    const root = createNode(model, 'Bone'); root.Name = 'Bone_Root';
    model.Textures.push({Image:'Textures/White.blp', ReplaceableId:0, Flags:0});
    model.Materials.push({PriorityPlane:0, RenderMode:0, Layers:[{FilterMode:0, Shading:0, TextureID:0, TVertexAnimId:null, CoordId:0, Alpha:1}]});
    const vertices = new Float32Array([-32,-32,-32, 32,-32,-32, 32,32,-32, -32,32,-32, -32,-32,32, 32,-32,32, 32,32,32, -32,32,32]);
    const normals = new Float32Array(Array.from(vertices, value => value / (32*Math.sqrt(3))));
    model.Geosets.push({Vertices:vertices, Normals:normals,
      TVertices:[new Float32Array([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1])],
      Faces:new Uint16Array([0,2,1,0,3,2, 4,5,6,4,6,7, 0,1,5,0,5,4, 1,2,6,1,6,5, 2,3,7,2,7,6, 3,0,4,3,4,7]),
      VertexGroup:new Uint8Array(8), Groups:[[root.ObjectId]], TotalGroupsCount:1, MaterialID:0, SelectionGroup:0, Unselectable:false,
      MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,Anims:[]});
    normalizeVersionFields(model,version);
    recalculateExtents(model);
  });
  return doc;
}
