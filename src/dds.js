import { decodeBlp2 } from './blp2.js';

/** Decode the first BC1/2/3 DDS mip using the shared, checked block decoder. */
export function decodeDds(input) {
  const source = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
  if (source.length < 128) throw Error('DDS header is truncated.');
  const view = new DataView(source.buffer,source.byteOffset,source.byteLength);
  if (view.getUint32(0,true) !== 0x20534444 || view.getUint32(4,true) !== 124) throw Error('Invalid DDS header.');
  const height=view.getUint32(12,true), width=view.getUint32(16,true), fourCC=view.getUint32(84,true);
  const encoding=({[0x31545844]:0,[0x33545844]:1,[0x35545844]:7})[fourCC];
  if (encoding === undefined) throw Error('Unsupported DDS texture encoding.');
  const size=Math.ceil(width/4)*Math.ceil(height/4)*(encoding===0?8:16);
  if (!width || !height || width*height*4>256*1024*1024 || size>source.length-128) throw Error('Invalid or truncated DDS dimensions.');
  const blp=new Uint8Array(148+size), header=new DataView(blp.buffer);
  blp.set([66,76,80,50]); header.setUint32(4,1,true); blp[8]=2; blp[9]=encoding===0?1:8; blp[10]=encoding;
  header.setUint32(12,width,true); header.setUint32(16,height,true); header.setUint32(20,148,true); header.setUint32(84,size,true);
  blp.set(source.subarray(128,128+size),148);
  return decodeBlp2(blp);
}
