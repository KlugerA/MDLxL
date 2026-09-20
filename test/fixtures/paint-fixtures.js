export const IDENTITY_MATRIX = Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);

export function triangleGeoset({ z = 0, uv = [0,1,1,1,0,0], materialId = 0 } = {}) {
  return {
    Vertices:new Float32Array([-1,-1,z,1,-1,z,-1,1,z]),
    Normals:new Float32Array([0,0,1,0,0,1,0,0,1]),
    Faces:new Uint16Array([0,1,2]),
    TVertices:[new Float32Array(uv)],
    MaterialID:materialId,
  };
}

export function squareSeamGeoset({ z = 0, materialId = 0 } = {}) {
  return {
    Vertices:new Float32Array([-1,-1,z,1,-1,z,-1,1,z,1,-1,z,1,1,z,-1,1,z]),
    Normals:new Float32Array(Array.from({length:6},()=>[0,0,1]).flat()),
    Faces:new Uint16Array([0,1,2,3,4,5]),
    TVertices:[new Float32Array([0,1,1,1,0,0,1,1,1,0,0,0])],
    MaterialID:materialId,
  };
}

export function paintFixtureModel(geosets = [triangleGeoset()]) {
  return {
    Version:800,
    Geosets:geosets,
    Materials:[{Layers:[{FilterMode:0,Shading:16,TextureID:0,CoordId:0,Alpha:1}]}],
    Textures:[{Image:'Textures\\Fixture.blp',ReplaceableId:0,Flags:0}],
  };
}

export function paintTarget(geosetIndices = [0], flags = 0) {
  return {
    id:'texture:0',textureId:0,texturePath:'Textures\\Fixture.blp',label:'Fixture.blp',flags,
    bindings:geosetIndices.map(geosetIndex=>({geosetIndex,materialId:0,layerIndex:0,coordId:0})),
    geosetIndices:[...geosetIndices],materialIds:[0],sharedUV:geosetIndices.length>1,
  };
}
