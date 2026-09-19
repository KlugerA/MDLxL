const fs = require('node:fs/promises');
const path = require('node:path');
const { constants } = require('node:fs');
const { IMAGE_EXTENSIONS } = require('./texture-resolver.cjs');

/** User-owned texture folders. Seed once; subsequent listings mirror the disk.
 * Reads/writes remain inside this root; imports copy bytes, never move sources.
 */
class PaintTextureLibrary {
  constructor(directory, seedDirectory=null) { this.directory=path.resolve(directory);this.seedDirectory=seedDirectory;this.ready=null; }
  async ensure() {
    if(!this.ready)this.ready=(async()=>{
      const created=await fs.mkdir(this.directory,{recursive:true});
      if(created&&this.seedDirectory){
        const manifest=JSON.parse(await fs.readFile(path.join(this.seedDirectory,'manifest.json'),'utf8'));
        for(const asset of manifest.assets){
          const folder=path.join(this.directory,asset.category),source=path.join(this.seedDirectory,'512',asset.id+'.png');
          await fs.mkdir(folder,{recursive:true});await fs.copyFile(source,path.join(folder,asset.name+'.png'),constants.COPYFILE_EXCL);
        }
      }
      const info=await fs.lstat(this.directory);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Textures must be a regular folder.');
    })().catch(error=>{this.ready=null;throw error;});
    return this.ready;
  }
  async resolve(relative, createFolder=false) {
    await this.ensure();
    if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes(':')||relative.split(/[\\/]/).some(part=>part==='..'))throw Error('Choose a folder inside Textures.');
    const file=path.resolve(this.directory,relative),within=path.relative(this.directory,file);
    if(within==='..'||within.startsWith('..'+path.sep)||path.isAbsolute(within))throw Error('Choose a folder inside Textures.');
    let current=this.directory;const parts=within?within.split(path.sep):[];
    for(let i=0;i<parts.length;i++){
      current=path.join(current,parts[i]);
      if(createFolder)await fs.mkdir(current).catch(error=>{if(error.code!=='EEXIST')throw error;});
      const info=await fs.lstat(current);if(info.isSymbolicLink())throw Error('Texture links are not supported.');
      if(i<parts.length-1&&!info.isDirectory())throw Error('Texture folder is not a directory.');
    }
    return file;
  }
  async list() {
    await this.ensure();const items=[],folders=[''];
    const walk=async(relative)=>{
      for(const entry of await fs.readdir(path.join(this.directory,relative),{withFileTypes:true})){
        if(entry.isSymbolicLink())continue;
        const id=relative?relative+'/'+entry.name:entry.name;
        if(entry.isDirectory()){folders.push(id);await walk(id);}
        else if(entry.isFile()&&IMAGE_EXTENSIONS.includes(path.extname(entry.name).slice(1).toLowerCase())){
          const info=await fs.stat(path.join(this.directory,id));if(info.size>0&&info.size<=64*1024*1024)items.push({id,name:path.parse(entry.name).name,folder:relative,signature:id+'|'+info.size+'|'+info.mtimeMs});
        }
      }
    };
    await walk('');items.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));folders.sort();
    return {directory:this.directory,items,folders};
  }
  async read(id) {
    if(!IMAGE_EXTENSIONS.includes(path.extname(String(id)).slice(1).toLowerCase()))throw Error('Unsupported texture format.');
    const file=await this.resolve(id),info=await fs.stat(file);
    if(!info.isFile()||info.size<=0||info.size>64*1024*1024)throw Error('Choose a texture smaller than 64 MiB.');
    return {name:id,bytes:new Uint8Array(await fs.readFile(file))};
  }
  async save({folder='',name,bytes}) {
    const filename=path.basename(String(name||''));
    if(filename!==name||!IMAGE_EXTENSIONS.includes(path.extname(filename).slice(1).toLowerCase()))throw Error('Choose a supported texture filename.');
    const data=Buffer.from(bytes||[]);if(!data.length||data.length>64*1024*1024)throw Error('Texture must be between 1 byte and 64 MiB.');
    const directory=await this.resolve(folder,true),parsed=path.parse(filename);
    for(let index=0;index<10000;index++){
      const candidate=index?parsed.name+' ('+index+')'+parsed.ext:filename,file=path.join(directory,candidate);
      try{await fs.writeFile(file,data,{flag:'wx'});return {id:[folder,candidate].filter(Boolean).join('/'),name:candidate,path:file};}
      catch(error){if(error.code!=='EEXIST')throw error;}
    }
    throw Error('Choose a different texture filename.');
  }
}
module.exports={PaintTextureLibrary};
