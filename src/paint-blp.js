const WHITEOUT_COMMIT = '38d279c2a6d8d439377959c56fe4f1eb9ab12fa6';
let whiteoutModulePromise;

function defaultModuleUrl() {
  if (typeof document !== 'undefined') return new URL('./whiteout/whiteout-paint-blp.js', document.baseURI).href;
  if (typeof location !== 'undefined') return new URL('../whiteout/whiteout-paint-blp.js', location.href).href;
  return new URL('../public/whiteout/whiteout-paint-blp.js', import.meta.url).href;
}

async function loadWhiteoutModule(moduleUrl = defaultModuleUrl()) {
  if (!whiteoutModulePromise) {
    whiteoutModulePromise = import(/* @vite-ignore */ moduleUrl)
      .then(({ default: createWhiteout }) => createWhiteout())
      .catch(error => {
        whiteoutModulePromise = undefined;
        throw new Error(`The pinned WhiteoutLib BLP encoder could not start: ${error.message}`, { cause: error });
      });
  }
  return whiteoutModulePromise;
}

function copyNativeVector(vector) {
  try {
    return Uint8Array.from({ length: vector.size() }, (_, index) => vector.get(index));
  } finally {
    vector.delete();
  }
}

function nativeError(whiteout,error) {
  if(error instanceof Error)return error;
  try{const [,message]=whiteout.getExceptionMessage(error);whiteout.decrementExceptionRefcount(error);return Error(message||'Could not process this texture.');}
  catch{return Error('Could not process this texture.');}
}

/** Encode the painter's fixed Classic Warcraft III profile through WhiteoutLib. */
export async function encodePaintBlp1(raster, { jpegQuality = 90, moduleUrl } = {}) {
  if (!raster?.data || raster.data.length !== raster.width * raster.height * 4 || !Number.isInteger(raster.width) || !Number.isInteger(raster.height) || raster.width < 1 || raster.height < 1 || raster.width > 4096 || raster.height > 4096) {
    throw Error('BLP1 input must be an RGBA texture up to 4096×4096.');
  }
  const whiteout = await loadWhiteoutModule(moduleUrl);
  try{return copyNativeVector(whiteout.paintEncodeBlp1(
    new Uint8Array(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength),
    raster.width,
    raster.height,
    jpegQuality,
  ));}catch(error){throw nativeError(whiteout,error);}
}

/** DXT5/BC3 DDS retains alpha and a complete mip chain for game/editor use. */
export async function encodePaintDds(raster,{moduleUrl}={}) {
  if(!raster?.data||!Number.isInteger(raster.width)||!Number.isInteger(raster.height)||raster.width<1||raster.height<1||raster.width>4096||raster.height>4096||raster.data.length!==raster.width*raster.height*4)throw Error('DDS input must be an RGBA texture up to 4096×4096.');
  const whiteout=await loadWhiteoutModule(moduleUrl);
  try{return copyNativeVector(whiteout.paintEncodeDds(new Uint8Array(raster.data.buffer,raster.data.byteOffset,raster.data.byteLength),raster.width,raster.height));}
  catch(error){throw nativeError(whiteout,error);}
}

/** Lazy native decoder for BLPs unsupported by the small JavaScript decoder. */
export async function decodePaintBlp(input) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length<20||bytes.length>64*1024*1024)throw Error('Invalid BLP file size.');
  const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),magic=header.getUint32(0,true);
  if(magic!==0x31504c42&&magic!==0x32504c42)throw Error('Invalid BLP signature.');
  const width=header.getUint32(12,true),height=header.getUint32(16,true);
  if(!width||!height||width>4096||height>4096)throw Error('BLP dimensions must be from 1 to 4096.');
  const whiteout=await loadWhiteoutModule();
  try{const result=whiteout.paintDecodeBlp(bytes);return {...result,data:new Uint8ClampedArray(result.data)};}
  catch(error){throw nativeError(whiteout,error);}
}

export const PAINT_BLP_ENCODER = Object.freeze({
  id: 'whiteoutlib-blp1-jpeg',
  library: 'WhiteoutLib',
  source: 'https://github.com/FernandoS27/WhiteoutLib',
  pinnedCommit: WHITEOUT_COMMIT,
  license: 'BSD-3-Clause',
  format: 'BLP1',
  encoding: 'JPEG',
  pixelFormat: 'RGBA8',
  jpegQuality: 90,
  alphaBits: 8,
  mipmaps: true,
});
