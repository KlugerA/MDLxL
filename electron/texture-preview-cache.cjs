const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const PNG = Buffer.from([137,80,78,71,13,10,26,10]);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const validKey = key => typeof key === 'string' && /^[a-f0-9]{24,64}$/.test(key);
const imageInfo = bytes => {
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 || bytes.length > 1024*1024 || !bytes.subarray(0,8).equals(PNG) || bytes.toString('ascii',12,16) !== 'IHDR') throw Error('Invalid PNG thumbnail.');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if (!width || !height || width>256 || height>256) throw Error('Thumbnail must fit within 256 pixels.');
  return {width,height};
};

/** Persistent decoded previews, independent of the bounded native byte cache.
 * The journal makes every completed image resumable without rewriting a large
 * catalog per image. Only two source/decode requests are held at once by default.
 */
class TexturePreviewCache {
  constructor({directory,concurrency=2,onProgress=()=>{},now=()=>Date.now(),progressInterval=100}={}) {
    Object.assign(this,{directory,onProgress,now,progressInterval});this.lastProgress=-Infinity;
    this.concurrency=Math.max(1,Math.min(4,Math.floor(concurrency)||2));
    this.entries=new Map();this.known=new Set();this.writeQueue=Promise.resolve();this.ready=null;this.active=null;this.journalWrites=0;
    this.status={state:'idle',jobId:null,signature:null,total:0,completed:0,cached:0,failed:0,bytes:0,errors:[],elapsedMs:0};
  }
  async load() {
    if (!this.ready) this.ready=(async()=>{
      await fs.mkdir(this.directory,{recursive:true});
      try {
        const index=JSON.parse(await fs.readFile(path.join(this.directory,'index.json'),'utf8'));
        if(index.version===1){for(const [key,entry] of Object.entries(index.entries||{}))if(validKey(key)&&entry?.sha256)this.entries.set(key,entry);
          if(index.status)this.status={...this.status,...index.status,state:['running','indexing'].includes(index.status.state)?'cancelled':index.status.state};}
      }catch{}
      try {for(const line of (await fs.readFile(path.join(this.directory,'journal.ndjson'),'utf8')).split('\n')){try{const record=JSON.parse(line);if(validKey(record.key)){if(record.entry?.sha256)this.entries.set(record.key,record.entry);else if(record.deleted)this.entries.delete(record.key);}}catch{}}}catch{}
    })();
    return this.ready;
  }
  register(items) {for(const item of items||[])if(validKey(item.cacheKey))this.known.add(item.cacheKey);}
  snapshot() {return {...this.status,errors:this.status.errors.map(error=>({...error})),elapsedMs:this.active?this.now()-this.active.started:this.status.elapsedMs};}
  async getStatus() {await this.load();return this.snapshot();}
  publish(patch={}) {const time=this.now();Object.assign(this.status,patch,{updatedAt:time});if(patch.state||time-this.lastProgress>=this.progressInterval||this.status.completed===this.status.total){this.lastProgress=time;this.onProgress(this.snapshot());}}
  enqueue(operation) {const result=this.writeQueue.catch(()=>{}).then(operation);this.writeQueue=result;return result;}
  checkpoint() {return this.enqueue(async()=>{
    const file=path.join(this.directory,'index.json'),temporary=file+'.tmp';
    await fs.writeFile(temporary,JSON.stringify({version:1,entries:Object.fromEntries(this.entries),status:this.snapshot()}));await fs.rename(temporary,file);
    await fs.writeFile(path.join(this.directory,'journal.ndjson'),'');this.journalWrites=0;
  });}
  async read(key) {
    await this.load();if(!validKey(key)||!this.entries.has(key))return null;
    const entry=this.entries.get(key);
    try {const bytes=await fs.readFile(path.join(this.directory,key+'.png'));imageInfo(bytes);if(digest(bytes)!==entry.sha256)throw Error('Changed thumbnail');return 'data:image/png;base64,'+bytes.toString('base64');}
    catch {this.entries.delete(key);return null;}
  }
  async readMany(keys) {
    if(!Array.isArray(keys))throw Error('Missing thumbnail keys.');
    return (await Promise.all([...new Set(keys)].slice(0,128).map(async key=>{const url=await this.read(key);return url?{key,url}:null;}))).filter(Boolean);
  }
  async save(key,url,{trusted=false}={}) {
    await this.load();
    if(!validKey(key)||(!trusted&&!this.known.has(key)))throw Error('Unknown texture thumbnail.');
    if(typeof url!=='string'||!url.startsWith('data:image/png;base64,')||url.length>1400000)throw Error('Expected a PNG thumbnail.');
    const bytes=Buffer.from(url.slice(22),'base64'),dimensions=imageInfo(bytes),entry={...dimensions,bytes:bytes.length,sha256:digest(bytes)};
    await this.enqueue(async()=>{
      const file=path.join(this.directory,key+'.png'),temporary=file+'.tmp';await fs.writeFile(temporary,bytes);await fs.rename(temporary,file);
      this.entries.set(key,entry);await fs.appendFile(path.join(this.directory,'journal.ndjson'),JSON.stringify({key,entry})+'\n');this.journalWrites++;
    });
    if(this.journalWrites>=128)await this.checkpoint();
    return entry;
  }
  start(prepare) {
    if(this.active)return this.getStatus();
    const job={id:crypto.randomBytes(12).toString('hex'),started:this.now(),cancelled:false};this.active=job;
    const run=(async()=>{
      await this.load();
      this.publish({state:job.cancelled?'cancelled':'indexing',jobId:job.id,signature:null,total:0,completed:0,cached:0,failed:0,bytes:0,errors:[],current:null});
      await this.checkpoint();
      if(job.cancelled)return;
      const {catalog,readAsset,decode}=await prepare();
      const items=catalog.items.filter(item=>item.available!==false&&validKey(item.cacheKey));this.register(items);
      this.publish({state:job.cancelled?'cancelled':'running',signature:catalog.signature,total:items.length,errors:(catalog.errors||[]).slice(0,20)});
      let next=0;
      const worker=async()=>{while(!job.cancelled&&next<items.length){
        const item=items[next++];this.publish({current:item.path});
        try {
          const cached=await this.read(item.cacheKey);
          if(cached){this.status.cached++;this.status.bytes+=this.entries.get(item.cacheKey).bytes;}
          else {
            if(job.cancelled)break;
            const asset=await readAsset(item);if(!asset?.bytes?.length)throw Error('Texture source is unavailable.');
            if(job.cancelled)break;
            const url=await decode(asset);if(job.cancelled)break;
            const saved=await this.save(item.cacheKey,url,{trusted:true});this.status.bytes+=saved.bytes;
          }
        }catch(error){
          if(error.code==='ENOSPC'){job.cancelled=true;throw error;}
          this.status.failed++;if(this.status.errors.length<20)this.status.errors.push({path:item.path,message:error.message});
        }
        this.status.completed++;this.publish();
      }};
      const outcomes=await Promise.allSettled(Array.from({length:this.concurrency},worker));
      const failure=outcomes.find(result=>result.status==='rejected');if(failure)throw failure.reason;
      this.publish({state:job.cancelled?'cancelled':'complete',current:null,elapsedMs:this.now()-job.started});
    })().catch(error=>{job.cancelled=true;this.publish({state:'error',current:null,errors:[...this.status.errors,{message:error.message}].slice(-20),elapsedMs:this.now()-job.started});}).finally(async()=>{
      await this.checkpoint().catch(error=>this.publish({state:'error',errors:[{message:error.message}]}));if(this.active===job)this.active=null;
    });
    job.done=run;
    // Preparation runs asynchronously; callers receive a usable cancel token.
    return Promise.resolve({state:'indexing',jobId:job.id,total:0,completed:0,cached:0,failed:0,bytes:0,errors:[]});
  }
  cancel(jobId) {if(this.active&&(!jobId||jobId===this.active.id)){this.active.cancelled=true;this.publish({state:'cancelled'});}return this.snapshot();}
  async settle() {await this.active?.done;await this.writeQueue.catch(()=>{});return this.snapshot();}
  async close() {this.cancel();await this.settle();}
}
module.exports={TexturePreviewCache,validKey,imageInfo};
