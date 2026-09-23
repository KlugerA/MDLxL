const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { IMAGE_EXTENSIONS } = require('./texture-resolver.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0,24);
const normalized = value => String(value || '').replaceAll('/','\\').toLowerCase();
const imageKey = value => normalized(value).replace(/\.(?:dds|blp)$/i,'');
const title = value => value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ');
function textureVariant(sourcePath) {
  const source = sourcePath.toLowerCase();
  if (/(?:^|[\\/:])_de\.w3mod:|(?:^|[\\/])de\.w3addon[\\/]/.test(source)) return 'forsaken-kingdom';
  if (/(?:^|[\\/:])_hd\.w3mod:|(?:^|[\\/])hd\.w3addon[\\/]/.test(source)) return 'reforged';
  return source.startsWith('war3.w3mod:') ? 'classic' : 'unknown';
}

/** No model data is opened here. Custom textures are listed only beside an already-open model. */
class TextureLibrary {
  constructor({ casc, catalogFile = path.join(__dirname,'data','texture-library-catalog.json'), readFile = fs.readFile, readdir = fs.readdir, stat = fs.stat } = {}) {
    Object.assign(this,{casc,catalogFile,readFile,readdir,stat});
    this.metadata = null; this.native = new Map();
  }
  async annotations() {
    if (!this.metadata) this.metadata = this.readFile(this.catalogFile,'utf8').then(text => {
      const catalog = JSON.parse(text);
      return new Map(catalog.items.map(item => [imageKey(item.path),item]));
    }).catch(error => { this.metadata = null; throw error; });
    return this.metadata;
  }
  async custom(modelPath) {
    if (typeof modelPath !== 'string' || !path.isAbsolute(modelPath) || !/\.(mdl|mdx)$/i.test(modelPath)) return [];
    const folder = path.dirname(path.resolve(modelPath)), items = [];
    let entries; try { entries = await this.readdir(folder,{withFileTypes:true}); } catch { return items; }
    for (const entry of entries) {
      if (!entry.isFile() || !IMAGE_EXTENSIONS.includes(path.extname(entry.name).slice(1).toLowerCase())) continue;
      const file = path.join(folder,entry.name);
      let info; try { info = await this.stat(file); } catch { continue; }
      if (!info.isFile() || info.size > 64 * 1024 * 1024) continue;
      items.push({id:'custom:' + hash(normalized(file)),name:title(path.parse(entry.name).name),path:entry.name,lookupName:entry.name,sourcePath:entry.name,folder:'Model folder',source:'custom',variant:'custom',cacheKey:hash(normalized(file)+'|'+info.size+'|'+info.mtimeMs),kinds:['other'],tags:[],models:[],races:[],notes:'Custom texture beside the open model.',available:true});
    }
    return items.sort((a,b)=>a.path.localeCompare(b.path));
  }
  async catalog({modelPath = null,cascFolders = []} = {}) {
    const [metadata,listing,custom] = await Promise.all([this.annotations(),this.casc?.list(cascFolders) || {sources:[],errors:[]},this.custom(modelPath)]);
    const items = [], seen = new Set();
    for (const source of listing.sources) {
      let native = this.native.get(source.key);
      if (!native) {
        native = [];
        for (const sourcePath of source.names) {
          if (!IMAGE_EXTENSIONS.includes(path.extname(sourcePath).slice(1).toLowerCase())) continue;
          const logical = sourcePath.replace(/^war3\.w3mod:/i,''), classic = /^war3\.w3mod:/i.test(sourcePath) && !logical.includes(':');
          const annotation = classic ? metadata.get(imageKey(logical)) : null;
          const leaf = logical.split(/[\\:]/).at(-1), nativeId = normalized(sourcePath);
          const variant = textureVariant(sourcePath);
          native.push({...annotation,id:'native:' + hash(nativeId),name:annotation?.name || title(leaf.replace(/\.[^.]+$/,'')),path:annotation?.path || logical,lookupName:sourcePath,sourcePath,sourceKey:source.key,sourceFolder:source.folder,folder:sourcePath.slice(0,sourcePath.length-leaf.length).replace(/[\\:]$/,''),source:'native',variant,cacheKey:hash(source.key+'|'+nativeId),kinds:annotation?.kinds || (/(?:^|\\)replaceabletextures\\commandbuttons/i.test(sourcePath)?['icons']:['other']),tags:annotation?.tags || [],models:annotation?.models || [],races:annotation?.races || [],available:true});
        }
        native.sort((a,b)=>(b.priority||0)-(a.priority||0)||a.sourcePath.localeCompare(b.sourcePath));
        this.native.set(source.key,native);
        while (this.native.size > 4) this.native.delete(this.native.keys().next().value);
      }
      for (const item of native) if (!seen.has(item.id)) {seen.add(item.id);items.push(item);}
    }
    items.push(...custom);
    return {version:2,signature:hash('2|'+listing.sources.map(s=>s.key).join('|')+'|'+custom.map(item=>item.cacheKey).join('|')),items,roots:listing.sources.map(s=>({folder:s.folder,fromCache:s.fromCache})),errors:listing.errors,customCount:custom.length,nativeCount:items.length-custom.length};
  }
}
module.exports = {TextureLibrary,imageKey};
