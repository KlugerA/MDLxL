const assetKey=name=>String(name||'').replaceAll('/','\\').toLowerCase();
export const isForgeAssetPath=name=>/^MDLxL_(?:Forge|Parts|Citadel)\/[a-z0-9][a-z0-9_.-]{0,200}\.(blp|dds|tga)$/i.test(String(name||'').replaceAll('\\','/'));
export function forgeTexturePaths(model){return [...new Map((model.Textures||[]).filter(t=>isForgeAssetPath(t.Image)).map(t=>[assetKey(t.Image),t.Image])).values()];}
/** The reserved relative path survives reopening, rescans and recovery. Source
 * tags alone are transient: native lookup also reads textures beside a model. */
export function retainedForgeAssets(assets,model=null){
 const result=new Map(),add=(name,asset)=>{if(asset?.bytes?.byteLength)result.set(assetKey(name),{name,bytes:asset.bytes});};
 if(model){
  for(const name of forgeTexturePaths(model)){const key=assetKey(name),asset=assets.get(key)||assets.get(key.split('\\').at(-1))||[...assets.values()].find(a=>assetKey(a.name)===key);add(name,asset);}
 }else{
  for(const asset of assets.values())if(asset.source==='forge'||isForgeAssetPath(asset.name))add(asset.name,asset);
 }
 return [...result.values()];
}
export function missingForgeAssetPaths(assets,model){const available=new Set(retainedForgeAssets(assets,model).map(a=>assetKey(a.name)));return forgeTexturePaths(model).filter(name=>!available.has(assetKey(name)));}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const value of bytes)n=crcTable[(n^value)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
/** A deterministic stored ZIP keeps portable editor artifacts byte-exact. */
export function storedZipArchive(files){
 const parts=[],central=[];let offset=0;
 for(const item of files){const name=new TextEncoder().encode(item.name.replaceAll('\\','/')),bytes=new Uint8Array(item.bytes),crc=crc32(bytes);
  const head=new Uint8Array(30+name.length),h=new DataView(head.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);head.set(name,30);parts.push(head,bytes);
  const record=new Uint8Array(46+name.length),r=new DataView(record.buffer);r.setUint32(0,0x02014b50,true);r.setUint16(4,20,true);r.setUint16(6,20,true);r.setUint16(8,0x800,true);r.setUint32(16,crc,true);r.setUint32(20,bytes.length,true);r.setUint32(24,bytes.length,true);r.setUint16(28,name.length,true);r.setUint32(42,offset,true);record.set(name,46);central.push(record);offset+=head.length+bytes.length;
 }
 const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
}

/** A stored ZIP keeps browser exports and their game-readable textures together. */
export function forgeExportArchive(modelName,modelBytes,assets){return storedZipArchive([{name:modelName,bytes:modelBytes},...assets]);}
