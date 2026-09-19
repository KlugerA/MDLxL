const fs=require('node:fs/promises'),path=require('node:path'),v8=require('node:v8'),zlib=require('node:zlib'),util=require('node:util');
const gzip=util.promisify(zlib.gzip),gunzip=util.promisify(zlib.gunzip),LIMIT=768*1024*1024;
// V8 deserialization commonly packs thousands of small typed views into a few
// large backing buffers. Electron's context bridge copies those buffers for
// individual views; a sub-megabyte model can otherwise allocate gigabytes.
// Compact views before IPC, retaining aliases to the same view/node object.
function compactRecoveryBuffers(value, seen=new WeakMap()) {
  if(value===null||typeof value!=='object')return value;
  if(seen.has(value))return seen.get(value);
  let out;
  if(Buffer.isBuffer(value)){
    out=Buffer.allocUnsafeSlow(value.byteLength);out.set(value);
  }else if(value instanceof DataView){
    const bytes=new Uint8Array(value.byteLength);bytes.set(new Uint8Array(value.buffer,value.byteOffset,value.byteLength));
    out=new DataView(bytes.buffer);
  }else if(ArrayBuffer.isView(value)){
    out=new value.constructor(value.length);out.set(value);
  }else if(value instanceof ArrayBuffer){
    out=value.slice(0);
  }else if(value instanceof Date){
    out=new Date(value.getTime());
  }else if(value instanceof RegExp){
    out=new RegExp(value.source,value.flags);out.lastIndex=value.lastIndex;
  }else if(value instanceof Map){
    out=new Map();seen.set(value,out);for(const [key,child]of value)out.set(compactRecoveryBuffers(key,seen),compactRecoveryBuffers(child,seen));return out;
  }else if(value instanceof Set){
    out=new Set();seen.set(value,out);for(const child of value)out.add(compactRecoveryBuffers(child,seen));return out;
  }else{
    out=Array.isArray(value)?new Array(value.length):Object.create(Object.getPrototypeOf(value));seen.set(value,out);
    for(const key of Object.keys(value))Object.defineProperty(out,key,{value:compactRecoveryBuffers(value[key],seen),enumerable:true,writable:true,configurable:true});
    return out;
  }
  seen.set(value,out);return out;
}
// Metadata and data live in ONE atomically replaced file. A crash can never
// leave a newer dirty snapshot hidden behind an older clean sidecar manifest.
class RecoveryStore{
  constructor(root){this.root=root;this.queues=new Map();this.versions=new Map();}
  file(id){if(typeof id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(id))throw Error('Invalid recovery identifier.');return path.join(this.root,id+'.recovery');}
  async write(payload){
    const file=this.file(payload.id);if(!payload.state||!Number.isSafeInteger(payload.version)||payload.version<0)throw Error('Invalid recovery state.');
    const prev=this.queues.get(payload.id)||Promise.resolve();
    const op=prev.catch(()=>{}).then(async()=>{
      if(payload.version<(this.versions.get(payload.id)||0))return;
      const date=new Date().toISOString(),raw=v8.serialize({...payload,date});if(raw.length>LIMIT)throw Error('Recovery snapshot exceeds768MB. Reduce the undo cache budget.');
      const packed=await gzip(raw,{level:1});
      const metadata={id:payload.id,version:payload.version,name:payload.state.name||path.basename(payload.path||'Untitled'),date,bytes:packed.length,dirty:payload.dirty!==false,path:payload.path};
      const json=Buffer.from(JSON.stringify(metadata));if(json.length>1024*1024)throw Error('Recovery metadata is too large.');
      const header=Buffer.alloc(8);header.write('MDLR');header.writeUInt32LE(json.length,4);
      await fs.mkdir(this.root,{recursive:true});const temp=file+'.tmp';
      await fs.writeFile(temp,Buffer.concat([header,json,packed]));await fs.rename(temp,file);this.versions.set(payload.id,payload.version);
    });
    this.queues.set(payload.id,op);try{await op;}finally{if(this.queues.get(payload.id)===op)this.queues.delete(payload.id);}
  }
  async metadata(id){const fd=await fs.open(this.file(id),'r');try{const head=Buffer.alloc(8);const read=await fd.read(head,0,8,0);if(read.bytesRead!==8||head.toString('ascii',0,4)!=='MDLR')throw Error('Invalid recovery header.');const n=head.readUInt32LE(4);if(n>1024*1024)throw Error('Invalid recovery metadata length.');const json=Buffer.alloc(n),r=await fd.read(json,0,n,8);if(r.bytesRead!==n)throw Error('Truncated recovery metadata.');const info=JSON.parse(json.toString('utf8'));if(info.id!==id)throw Error('Recovery identifier mismatch.');return info;}finally{await fd.close();}}
  async list(){await fs.mkdir(this.root,{recursive:true});const results=[];for(const file of await fs.readdir(this.root)){if(!file.endsWith('.recovery'))continue;const id=file.slice(0,-9);try{results.push(await this.metadata(id));}catch{try{const envelope=await this.read(id);results.push({id,version:envelope.version,name:envelope.state?.name||'Recovered model',date:envelope.date||'',dirty:envelope.dirty!==false,path:envelope.path});}catch{}}}return results.sort((a,b)=>b.date.localeCompare(a.date));}
  async read(id){const data=await fs.readFile(this.file(id));if(data.length>LIMIT)throw Error('Recovery file is too large.');let offset=0;if(data.toString('ascii',0,4)==='MDLR'){if(data.length<8)throw Error('Truncated recovery header.');offset=8+data.readUInt32LE(4);if(offset>1024*1024+8||offset>=data.length)throw Error('Invalid recovery metadata length.');}const payload=v8.deserialize(await gunzip(data.subarray(offset),{maxOutputLength:LIMIT}));if(payload.id!==id)throw Error('Recovery identifier mismatch.');return compactRecoveryBuffers(payload);}
  async flush(){await Promise.allSettled([...this.queues.values()]);}
}
module.exports={RecoveryStore};
