const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const CATBOX_API = 'https://catbox.moe/user/api.php';
const CATBOX_GIF_LIMIT = 20 * 1024 * 1024;
class CatboxError extends Error {
  constructor(code,message,cause){super(message,{cause});this.code=code;}
}
function checkSize(size){
  if(size>CATBOX_GIF_LIMIT)throw new CatboxError('too_large',`Catbox allows GIF uploads up to 20 MB. This GIF is ${(size/1024/1024).toFixed(1)} MB.`);
}
function validGIF(bytes){return bytes.length>=14&&['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('ascii'))&&bytes.readUInt16LE(6)>0&&bytes.readUInt16LE(8)>0&&bytes.at(-1)===0x3b;}
async function readGIF(file){
  let handle;
  try{
    handle=await fs.open(file,'r');const stat=await handle.stat();
    if(!stat.isFile())throw new CatboxError('unreadable','The exported GIF is missing or unreadable.');
    checkSize(stat.size);
    // Bound the read even if the file changes after stat; validate the same bytes we send.
    const bytes=Buffer.alloc(stat.size+1);let length=0;
    while(length<bytes.length){const result=await handle.read(bytes,length,bytes.length-length,length);if(!result.bytesRead)break;length+=result.bytesRead;}
    checkSize(length);
    if(length!==stat.size)throw new CatboxError('unreadable','The exported GIF changed while being read. Try again.');
    const gif=bytes.subarray(0,length);
    if(!validGIF(gif))throw new CatboxError('invalid_gif','This file is not a valid GIF.');
    return gif;
  }catch(error){if(error instanceof CatboxError)throw error;throw new CatboxError('unreadable','The exported GIF is missing or unreadable.',error);}
  finally{await handle?.close();}
}
function catboxForm(bytes,name='preview.gif'){
  checkSize(bytes.length);
  if(!validGIF(bytes))throw new CatboxError('invalid_gif','This file is not a valid GIF.');
  const form=new FormData();form.set('reqtype','fileupload');
  form.set('fileToUpload',new Blob([bytes],{type:'image/gif'}),path.basename(name).replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.gif$/i,'')+'.gif');
  return form;
}
function parseCatboxURL(body){
  const text=String(body).trim();let url;
  try{url=new URL(text);}catch{}
  if(!url||url.protocol!=='https:'||url.hostname!=='files.catbox.moe'||url.port||url.username||url.password||url.search||url.hash||!/^\/[a-zA-Z0-9_-]+\.gif$/i.test(url.pathname)||/\s/.test(text))
    throw new CatboxError('unexpected_response','Catbox returned an unexpected response instead of a GIF link.',Error('Response body: '+text.slice(0,512)));
  return url.href;
}
async function uploadGIF(file,{fetchImpl=globalThis.fetch,timeoutMs=120000}={}){
  const bytes=await readGIF(file),controller=new AbortController();let timer;
  try{
    return await Promise.race([
      (async()=>{
        const response=await fetchImpl(CATBOX_API,{method:'POST',body:catboxForm(bytes,path.basename(file)),signal:controller.signal,credentials:'omit',redirect:'error'});
        if(!response.ok)throw new CatboxError('http',`Catbox upload failed (HTTP ${response.status}).`);
        return parseCatboxURL(await response.text());
      })(),
      new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new CatboxError('timeout','Catbox upload timed out. Your GIF is saved locally.'));controller.abort();},timeoutMs);}),
    ]);
  }catch(error){
    if(error instanceof CatboxError)throw error;
    if(controller.signal.aborted||error?.name==='TimeoutError'||error?.name==='AbortError')throw new CatboxError('timeout','Catbox upload timed out. Your GIF is saved locally.',error);
    throw new CatboxError('network','Could not connect to Catbox. Check your internet connection. Your GIF is saved locally.',error);
  }finally{clearTimeout(timer);}
}
// Only freshly exported GIFs receive an opaque upload handle. Renderer input
// cannot name arbitrary local paths. Successful requests are never repeated.
class CatboxUploads {
  constructor(options={}){this.options=options;this.exports=new Map();}
  remember(owner,result){const exportId=randomUUID();this.exports.set(exportId,{owner,file:result.path,url:null,pending:false});return {...result,exportId};}
  get(owner,id){const row=this.exports.get(id);if(!row||row.owner!==owner)throw new CatboxError('unreadable','This exported GIF is no longer available.');return row;}
  async upload(owner,id){
    const row=this.get(owner,id);
    if(row.pending)throw new CatboxError('duplicate','This GIF is already uploading.');
    if(row.url)return row.url;
    row.pending=true;
    try{return row.url=await uploadGIF(row.file,this.options);}finally{row.pending=false;}
  }
  link(owner,id,bbcode=false){const url=this.get(owner,id).url;if(!url)throw new CatboxError('unexpected_response','Upload the GIF before copying its link.');return bbcode?`[IMG]${url}[/IMG]`:url;}
}
module.exports={CATBOX_API,CATBOX_GIF_LIMIT,CatboxError,readGIF,catboxForm,parseCatboxURL,uploadGIF,CatboxUploads};
