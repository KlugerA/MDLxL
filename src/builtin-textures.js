// Exact white fallback for the conventional game path; a resolved native asset
// can replace it. Preview data never changes the model texture path on save.
export function builtinTextureAssets() {
  return new Map([['textures\\white.blp', {name:'white.tga',source:'builtin',bytes:new Uint8Array([0,0,2,0,0,0,0,0,0,0,0,0,1,0,1,0,32,40,255,255,255,255])}]]);
}
