const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');
const THUMBNAIL_VERSION = 'native-4.0.1-authoring-5';
const {particleSourceState}=require('./particle-source.cjs');
const reviewedNames = require('../src/particle-reviewed-names.json');
const reviewFor = item => {const review=reviewedNames[item.id];return review&&item.sources?.some(source=>source.contentHash===review.naming.sourceContentHash)?review:{};};
const ID = /^(?:wc3-[a-f0-9]{24}|my-[a-f0-9-]{36})$/;
const atomic = async(file,data) => {
  await fs.mkdir(path.dirname(file),{recursive:true});
  try { await fs.copyFile(file,file+'.previous'); } catch(error) { if(error.code!=='ENOENT')throw error; }
  await fs.writeFile(file+'.tmp',data); await fs.rename(file+'.tmp',file);
};
class ParticleLibrary {
  constructor({directory,discover,onProgress=()=>{}}) { Object.assign(this,{directory,discover,onProgress});this.worker=null;this.status={running:false};this.queue=Promise.resolve(); }
  async current() {
    try { const data=JSON.parse(await fs.readFile(path.join(this.directory,'current.json'),'utf8'));if(!/^[a-f0-9]{64}$/.test(data.sourceKey))throw Error('Invalid library source.');return data; }
    catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  async metadata() { try{return JSON.parse(await fs.readFile(path.join(this.directory,'metadata.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw error;} }
  async catalog() {
    const current=await this.current(), meta=await this.metadata();
    let items=[],coverage=null;
    if(current) {
      const base=path.join(this.directory,current.sourceKey);
      items=JSON.parse(await fs.readFile(path.join(base,'catalog.json'),'utf8'));
      const manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));
      coverage={sourceKey:manifest.sourceKey,candidateAssets:manifest.candidateAssets,parsedAssets:manifest.parsedAssets,processed:manifest.processed.length,recipes:manifest.recipeCount,extractionComplete:manifest.extractionComplete,failures:manifest.failures.length,missingDependencies:manifest.missingDependencies.length,unsupported:manifest.unsupported.length,fullyPreviewableRecipes:manifest.fullyPreviewableRecipes,insertableRecipes:manifest.insertableRecipes,reviewedNames:manifest.reviewedNames};
    }
    try {
      for(const file of await fs.readdir(path.join(this.directory,'mine')))if(/^my-[a-f0-9-]{36}\.json$/.test(file)){
        const {parseParticleData}=await import('../src/particle-data.js');
        const recipe=parseParticleData(await fs.readFile(path.join(this.directory,'mine',file),'utf8'));
        items.push({id:recipe.id,name:recipe.name,tags:recipe.tags,categories:recipe.categories,naming:{state:'personal'},collection:'My presets',unsupported:recipe.compatibility?.unsupported||[]});
      }
    }catch(error){if(error.code!=='ENOENT')throw error;}
    items=items.map(item=>({...item,...reviewFor(item),...meta[item.id],favorite:!!meta[item.id]?.favorite}));
    items.sort((a,b)=>Number(!!a.blocked)-Number(!!b.blocked)||Number(['reviewed','user-reviewed'].includes(b.naming?.state))-Number(['reviewed','user-reviewed'].includes(a.naming?.state)));
    if(coverage){coverage.reviewedNames=items.filter(item=>item.collection==='Warcraft'&&['reviewed','user-reviewed'].includes(item.naming?.state)).length;coverage.reviewNeededNames=items.filter(item=>item.collection==='Warcraft').length-coverage.reviewedNames;}
    const thumbnails=await this.thumbnails(items.slice(0,36).map(item=>item.id));
    for(const item of items)if(thumbnails[item.id]?.url)item.thumbnail=thumbnails[item.id].url;
    const sourceStatus=current?await particleSourceState(this.discover,current.sourceKey):null;
    return {sourceStatus,items,coverage,status:this.status};
  }

  async thumbnailRevision(id,current) {
    if(!ID.test(id))throw Error('Invalid effect identity.');
    if(current===undefined)current=await this.current();
    if(id.startsWith('wc3-')&&!current)return null;
    try {
      const file=path.join(this.directory,id.startsWith('my-')?'mine':current.sourceKey,id+'.json'),info=await fs.stat(file,{bigint:true});
      return crypto.createHash('sha256').update(JSON.stringify([THUMBNAIL_VERSION,id.startsWith('wc3-')?current.sourceKey:null,info.size.toString(),info.mtimeNs.toString(),reviewedNames[id]?.previewSample])).digest('hex');
    }catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  async thumbnails(ids){
    if(!Array.isArray(ids)||ids.length>72||ids.some(id=>!ID.test(id)))throw Error('Invalid thumbnail request.');
    const current=await this.current(),values=await Promise.all(ids.map(async id=>{
      const revision=await this.thumbnailRevision(id,current),empty=[id,{url:null,revision}];if(!revision)return empty;
      const file=path.join(this.directory,'thumbnails',THUMBNAIL_VERSION,id+'.json');
      try {
        if((await fs.stat(file)).size>1024*1024+256)return empty;
        const entry=JSON.parse(await fs.readFile(file,'utf8'));
        return entry.revision===revision&&typeof entry.url==='string'?[id,entry]:empty;
      }catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return empty;throw error;}
    }));return Object.fromEntries(values);
  }
  async exportData(id){
    const {parseParticleData,stringifyParticleData}=await import('../src/particle-data.js'),{validateParticleRecipe}=await import('../src/particle-recipes.js');
    const recipe=parseParticleData(await this.read(id)),meta={...reviewFor(recipe),...(await this.metadata())[id]};
    for(const key of ['name','tags','categories','naming','previewSample'])if(meta[key]!==undefined)recipe[key]=meta[key];
    validateParticleRecipe(recipe);return stringifyParticleData(recipe);
  }
  async duplicate(id){const data=await this.exportData(id),{parseParticleData}=await import('../src/particle-data.js');return this.save({data,name:(parseParticleData(data).name+' copy').slice(0,120)});}
  async thumbnail({id,url,revision}) {
    if(!ID.test(id)||typeof url!=='string'||!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(url)||url.length>1024*1024||typeof revision!=='string'||!/^[a-f0-9]{64}$/.test(revision))throw Error('Invalid effect thumbnail.');
    return this.enqueue(async()=>{
      if(revision!==await this.thumbnailRevision(id))throw Error('The effect changed while its preview was rendering. Reopen the library to refresh it.');
      return atomic(path.join(this.directory,'thumbnails',THUMBNAIL_VERSION,id+'.json'),JSON.stringify({revision,url}));
    });
  }
  async read(id) {
    if(!ID.test(id))throw Error('Invalid effect identity.');
    const current=await this.current();
    if(id.startsWith('wc3-')&&!current)throw Error('Index Warcraft assets first.');
    const file=path.join(this.directory,id.startsWith('my-')?'mine':current.sourceKey,id+'.json');
    const info=await fs.stat(file);if(info.size>16*1024*1024)throw Error('Preset exceeds 16 MiB.');
    return fs.readFile(file,'utf8');
  }
  enqueue(operation){const next=this.queue.then(operation);this.queue=next.catch(()=>{});return next;}
  async save({data,name,id}) { return this.enqueue(async()=>{
    const {parseParticleData,stringifyParticleData}=await import('../src/particle-data.js');
    const {validateParticleRecipe}=await import('../src/particle-recipes.js');
    const recipe=parseParticleData(data);
    recipe.id=id&&/^my-[a-f0-9-]{36}$/.test(id)?id:'my-'+crypto.randomUUID();
    recipe.name=String(name||recipe.name).trim();validateParticleRecipe(recipe);
    await atomic(path.join(this.directory,'mine',recipe.id+'.json'),stringifyParticleData(recipe));await fs.rm(path.join(this.directory,'thumbnails',THUMBNAIL_VERSION,recipe.id+'.json'),{force:true});return {id:recipe.id,name:recipe.name};
  }); }
  async annotate({id,name,tags,categories,favorite}) { return this.enqueue(async()=>{
    if(!ID.test(id))throw Error('Invalid effect identity.');
    const metadata=await this.metadata(), next={...metadata[id]};
    if(name!==undefined){if(typeof name!=='string'||!name.trim()||name.length>120)throw Error('Use a short effect name.');next.name=name.trim();next.naming={state:'user-reviewed'};}
    for(const [key,value]of Object.entries({tags,categories}))if(value!==undefined){if(!Array.isArray(value)||value.length>32||value.some(v=>typeof v!=='string'||v.length>80))throw Error('Invalid effect tags.');next[key]=value;}
    if(favorite!==undefined)next.favorite=!!favorite;
    metadata[id]=next;await atomic(path.join(this.directory,'metadata.json'),JSON.stringify(metadata));return next;
  }); }
  async remove(id){return this.enqueue(async()=>{if(!/^my-[a-f0-9-]{36}$/.test(id))throw Error('Only personal presets can be deleted.');await fs.mkdir(path.join(this.directory,'trash'),{recursive:true});await fs.rename(path.join(this.directory,'mine',id+'.json'),path.join(this.directory,'trash',id+'-'+Date.now()+'.json'));return true;});}
  async draft(data){
    if(data===undefined){try{return await fs.readFile(path.join(this.directory,'draft.json'),'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}}
    const {parseParticleData}=await import('../src/particle-data.js');parseParticleData(data);
    return this.enqueue(()=>atomic(path.join(this.directory,'draft.json'),data));
  }
  async workingCopy({id,data}){
    if(typeof id!=='string'||!id||id.length>200)throw Error('Invalid working effect.');
    const file=path.join(this.directory,'working',crypto.createHash('sha256').update(id).digest('hex')+'.json');
    if(data===undefined){
      try{if((await fs.stat(file)).size>16*1024*1024)throw Error('Working effect exceeds 16 MiB.');return await fs.readFile(file,'utf8');}
      catch(error){if(error.code==='ENOENT')return null;throw error;}
    }
    const {parseParticleData}=await import('../src/particle-data.js'),draft=parseParticleData(data);
    if(draft.schema!=='mdlxl-particle-draft'||draft.version!==1||!draft.state||!draft.recipe)throw Error('Invalid working effect.');
    return this.enqueue(()=>atomic(file,data));
  }
  async scan() {
    if(this.worker)return this.status;
    const found=await this.discover(), folder=found.cascFolders?.[0];
    if(!folder)throw Error('Connect your Warcraft III installation in Settings.');
    this.status={running:true,processed:0,total:0,recipes:0};
    const worker=this.worker=new Worker(path.join(__dirname,'particle-library-worker.mjs'),{workerData:{folder,directory:this.directory}});
    worker.on('message',message=>{
      if(message.type==='progress')this.status={running:true,...message.status};
      if(message.type==='done')this.status={...this.status,running:false,complete:message.summary.extractionComplete};
      if(message.type==='error')this.status={...this.status,running:false,error:message.message};
      this.onProgress(this.status);
    });
    worker.on('error',error=>{this.status={...this.status,running:false,error:error.message};this.onProgress(this.status);});
    worker.on('exit',()=>{this.worker=null;this.status={...this.status,running:false};this.onProgress(this.status);});
    return this.status;
  }
  cancel(){this.worker?.postMessage('cancel');return this.status;}
  async close(){this.cancel();if(this.worker)await new Promise(resolve=>this.worker.once('exit',resolve));await this.queue;}
}
module.exports={ParticleLibrary};
