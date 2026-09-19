/** Lossless opaque RGB storage, QOI v1 (https://qoiformat.org/qoi-specification.pdf).
 * Original encoder implementation; no palette, color transform or quantization.
 * Bound allocation to at most four bytes per pixel plus the header/trailer. */
function encodeCaptureQOI(rgba, width, height) {
  const out=Buffer.allocUnsafe(width*height*4+22), index=new Uint32Array(64);
  out.write('qoif');out.writeUInt32BE(width,4);out.writeUInt32BE(height,8);out[12]=3;out[13]=0;
  let position=14, previous=255, pr=0,pg=0,pb=0,run=0;
  for(let i=0;i<rgba.length;i+=4){
    const r=rgba[i],g=rgba[i+1],b=rgba[i+2],pixel=((r<<24)|(g<<16)|(b<<8)|255)>>>0;
    if(pixel===previous){
      run++;
      if(run===62||i===rgba.length-4){out[position++]=0xc0|(run-1);run=0;}
      continue;
    }
    if(run){out[position++]=0xc0|(run-1);run=0;}
    const hash=(r*3+g*5+b*7+255*11)&63;
    if(index[hash]===pixel)out[position++]=hash;
    else{
      index[hash]=pixel;
      const dr=r-pr,dg=g-pg,db=b-pb,rg=dr-dg,bg=db-dg;
      if(dr>=-2&&dr<=1&&dg>=-2&&dg<=1&&db>=-2&&db<=1)out[position++]=0x40|((dr+2)<<4)|((dg+2)<<2)|(db+2);
      else if(dg>=-32&&dg<=31&&rg>=-8&&rg<=7&&bg>=-8&&bg<=7){out[position++]=0x80|(dg+32);out[position++]=((rg+8)<<4)|(bg+8);}
      else {out[position++]=0xfe;out[position++]=r;out[position++]=g;out[position++]=b;}
    }
    previous=pixel;pr=r;pg=g;pb=b;
  }
  out.fill(0,position,position+7);out[position+7]=1;
  return out.subarray(0,position+8);
}
module.exports={encodeCaptureQOI};
