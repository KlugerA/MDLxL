const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

class CascReader {
  constructor(folder, cwd) {
    this.process = spawn(path.join(__dirname, 'casc', 'CascBridge-0.7.0.exe'), [path.resolve(folder)], { cwd, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    this.lines = []; this.waiters = []; this.error = null;
    createInterface({ input: this.process.stdout }).on('line', line => {
      const waiter = this.waiters.shift(); if (waiter) waiter.resolve(line); else this.lines.push(line);
    });
    this.process.stderr.resume();
    const fail = error => { this.error = error; for (const waiter of this.waiters.splice(0)) waiter.reject(error); };
    this.process.on('error', fail);
    this.process.on('exit', () => fail(Error('CASC reader closed.')));
    this.ready = this.line().then(line => { if (line !== 'READY') throw Error(line.startsWith('!') ? Buffer.from(line.slice(1),'base64').toString() : 'CASC reader could not start.'); });
  }
  line() {
    if (this.lines.length) return Promise.resolve(this.lines.shift());
    if (this.error) return Promise.reject(this.error);
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { this.close(); reject(Error('CASC lookup timed out.')); }, 30000);
      this.waiters.push({ resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    });
  }
  async read(name) {
    await this.ready;
    this.process.stdin.write(Buffer.from(name).toString('base64') + '\n');
    const line = await this.line();
    if (line.startsWith('!')) throw Error(Buffer.from(line.slice(1),'base64').toString());
    return line === '-' ? null : Buffer.from(line,'base64');
  }
  async list() {
    const records=(await this.read('@textures'))?.toString('utf8').split('\n').filter(Boolean)||[],names=[],keys={};
    for(const record of records){const [name,key]=record.split('\t');names.push(name);if(/^[a-f0-9]{32}$/i.test(key))keys[name.toLowerCase()]=key;}
    return {names,keys};
  }
  readKey(key) { return this.read('@ckey:'+key); }
  close() { this.process.stdin.end(); this.process.kill(); }
}

/** Cache native bytes by installation + build metadata + logical texture path. */
class CascTextures {
  constructor({ cacheDirectory, openReader = (folder,cwd) => new CascReader(folder,cwd), maxBytes = 256 * 1024 * 1024 } = {}) {
    this.directory = cacheDirectory; this.openReader = openReader; this.maxBytes = maxBytes;
    this.readers = new Map(); this.queue = Promise.resolve(); this.indexKeys = new Map();this.byteEntries=null;this.cachedBytes=0;
  }
  read(name, folders) {
    const operation = this.queue.catch(() => {}).then(() => this.lookup(name, folders));
    this.queue = operation; return operation;
  }
  // A preload captures an enumerated installation once. Reuse its build key
  // and open reader instead of rediscovering sources for each thumbnail.
  readSnapshot(name,folder,install) {
    if(!/^[a-f0-9]{64}$/.test(install))throw Error('Invalid native source fingerprint.');
    const operation=this.queue.catch(()=>{}).then(()=>this.lookup(name,[folder],new Map([[folder,install]])));
    this.queue=operation;return operation;
  }
  list(folders) {
    const operation = this.queue.catch(() => {}).then(() => this.listTextures(folders));
    this.queue = operation; return operation;
  }
  async listTextures(folders) {
    const sources = [], errors = [];
    for (const folder of [...new Set(folders || [])]) {
      try {
        const build = await fs.readFile(path.join(folder,'.build.info'));
        const install = digest(path.resolve(folder).toLowerCase() + '|' + digest(build));
        const file = this.directory && path.join(this.directory,install + '.textures.json');
        let names = null, keys = {}, fromCache = false;
        if (file) try {
          const info = await fs.stat(file);
          if (info.size <= 64 * 1024 * 1024) {
            const cached = JSON.parse(await fs.readFile(file,'utf8'));
            if (cached.version === 4 && Array.isArray(cached.names) && cached.names.length <= 300000 && cached.names.every(name => typeof name === 'string' && name.length <= 260)) { names = cached.names; keys=cached.keys||{}; fromCache = true; }
          }
        } catch {}
        if (!names) {
          if (this.directory) await fs.mkdir(this.directory,{recursive:true});
          const reader = this.openReader(folder,this.directory || __dirname);
          try { const listed=await reader.list();names=Array.isArray(listed)?listed:listed.names;keys=listed.keys||{}; } finally { reader.close(); }
          if (file) {
            const temporary = file + '.tmp'; await fs.writeFile(temporary,JSON.stringify({version:4,names,keys})); await fs.rename(temporary,file);
            const indexes = await Promise.all((await fs.readdir(this.directory)).filter(name => /^[a-f0-9]{64}\.textures\.json$/.test(name)).map(async name => ({file:path.join(this.directory,name),info:await fs.stat(path.join(this.directory,name))})));
            for (const old of indexes.sort((a,b)=>b.info.mtimeMs-a.info.mtimeMs).slice(8)) await fs.unlink(old.file);
          }
        }
        this.indexKeys.set(install,keys);
        sources.push({folder,key:install,names,fromCache});
      } catch (error) { errors.push({folder,message:error.message}); }
    }
    return {sources,errors};
  }
  async lookup(name, folders, snapshots) {
    for (const folder of folders || []) {
      let install=snapshots?.get(folder);
      if(!install){let build; try { build = await fs.readFile(path.join(folder,'.build.info')); } catch { continue; }
        install = digest(path.resolve(folder).toLowerCase() + '|' + digest(build));}
      const namedModule=name.includes(':');
      const key = digest(install + '|' + name.toLowerCase()+(namedModule?'|content-key-v1':'')), file = this.directory && path.join(this.directory,key + '.bin');
      if (file) try { const cached = await fs.readFile(file); if (!cached.length) continue; if (cached.length <= 64 * 1024 * 1024) return cached; } catch {}
      if (this.directory) await fs.mkdir(this.directory,{ recursive: true });
      let entry = this.readers.get(install);
      if (!entry) { entry = { reader: this.openReader(folder,this.directory || __dirname), timer: null }; this.readers.set(install,entry); }
      clearTimeout(entry.timer);
      let bytes;
      try {
        if(namedModule&&!this.indexKeys.has(install)&&this.directory)try{const cached=JSON.parse(await fs.readFile(path.join(this.directory,install+'.textures.json'),'utf8'));this.indexKeys.set(install,cached.version===4?cached.keys||{}:{});}catch{this.indexKeys.set(install,{});}
        const contentKey=this.indexKeys.get(install)?.[name.toLowerCase()];
        bytes = /^[a-f0-9]{32}$/i.test(contentKey||'')&&entry.reader.readKey ? await entry.reader.readKey(contentKey) : await entry.reader.read(name);
      }
      catch (error) { entry.reader.close(); this.readers.delete(install); throw error; }
      finally { if (this.readers.has(install)) entry.timer = setTimeout(() => { entry.reader.close(); this.readers.delete(install); },15000).unref(); }
      if (file) {
        const temporary = file + '.tmp';
        await fs.writeFile(temporary,bytes || Buffer.alloc(0)); await fs.rename(temporary,file);
        await this.trim(file,bytes?.length||0);
      }
      if (bytes?.length) return bytes;
    }
    return null;
  }
  async trim(writtenFile,writtenBytes) {
    if (!this.directory) return;
    // Directory inventory is loaded once, then maintained incrementally. A
    // game-wide preload must not stat every cached texture after every read.
    if(!this.byteEntries){
      this.byteEntries=new Map();
      for(const name of await fs.readdir(this.directory))if(/^[a-f0-9]{64}\.bin$/.test(name)){
        const file=path.join(this.directory,name);try{const info=await fs.stat(file);this.byteEntries.set(file,{size:info.size,time:info.mtimeMs});}catch{}
      }
      this.byteEntries=new Map([...this.byteEntries].sort((a,b)=>a[1].time-b[1].time));
      this.cachedBytes=[...this.byteEntries.values()].reduce((sum,entry)=>sum+entry.size,0);
    }
    if(writtenFile){this.cachedBytes-=this.byteEntries.get(writtenFile)?.size||0;this.byteEntries.delete(writtenFile);this.byteEntries.set(writtenFile,{size:writtenBytes,time:Date.now()});this.cachedBytes+=writtenBytes;}
    if(this.cachedBytes<=this.maxBytes&&this.byteEntries.size<=4096)return;
    for (const [file,entry] of this.byteEntries) {
      if (this.cachedBytes <= this.maxBytes && this.byteEntries.size <= 4096) break;
      await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});this.byteEntries.delete(file);this.cachedBytes-=entry.size;
    }
  }
  async close() { await this.queue.catch(() => {}); for (const {reader,timer} of this.readers.values()) { clearTimeout(timer); reader.close(); } this.readers.clear(); }
}
module.exports = { CascReader, CascTextures };
