import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const mainFile=fileURLToPath(new URL('../electron/main.cjs',import.meta.url));
const require=createRequire(mainFile);
const {CascTextures}=require('./casc.cjs');
const {GameDataDiscovery}=require('./game-data.cjs');

test('desktop rescan retains native texture resolution, cached bytes and build invalidation',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-rescan-'));
  t.after(async()=>{
    if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('mdlvis-rescan-'))throw Error('Unexpected rescan test cleanup location.');
    await fs.rm(root,{recursive:true,force:true});
  });
  const profile=path.join(root,'profile'),game=path.join(root,'Warcraft III');
  await fs.mkdir(path.join(game,'Data'),{recursive:true});
  await fs.writeFile(path.join(game,'.build.info'),'build-1');
  let opens=0,closes=0;
  // Exercise the real disk cache/resolver. Only the native process boundary is faked.
  class NativeFixtureTextures extends CascTextures {
    constructor(options){super({...options,openReader:()=>{
      const generation=++opens;
      return {read:async()=>Buffer.from('native-texture-'+generation),close(){closes++;}};
    }});}
  }
  const handlers=new Map();
  const electron={
    nativeTheme:{themeSource:'light'},
    app:{setName(){},setPath(){},getAppPath(){return root;},on(){},whenReady(){return {then(){}};}},
    ipcMain:{handle:(name,handler)=>handlers.set(name,handler),on(){}},
  };
  const context=vm.createContext({
    require:name=>name==='electron'?electron:name==='./casc.cjs'?{CascTextures:NativeFixtureTextures}:require(name),
    __dirname:path.dirname(mainFile),console,Buffer,setTimeout,clearTimeout,setImmediate,
    process:{env:{MDLXL_PROFILE:profile},argv:[],execPath:process.execPath},
    discovery:new GameDataDiscovery({cacheFile:path.join(profile,'discovery.json'),env:{},registry:async()=>[game],drives:async()=>[]}),
  });
  vm.runInContext(await fs.readFile(mainFile,'utf8'),context,{filename:mainFile});
  vm.runInContext('gameDataDiscovery=discovery',context);
  t.after(()=>vm.runInContext('textureResolver.close()',context));
  const resolve=()=>handlers.get('texture:resolve')({}, {names:['Textures\\Example.blp']});
  const first=await resolve();
  assert.equal(first[0].bytes.toString(),'native-texture-1');
  const discovered=await handlers.get('settings:rescanGameData')();
  assert.deepEqual(discovered.cascFolders,[game]);
  assert.equal(closes,1,'rescan closes the superseded native reader');
  const cached=await resolve();
  assert.equal(cached.length,1,'native texture lookup must remain available after rescan');
  assert.equal(cached[0].bytes.toString(),'native-texture-1');
  assert.equal(opens,1,'replacement resolver should reuse the persistent texture cache');

  await fs.writeFile(path.join(game,'.build.info'),'updated-build-2');
  await handlers.get('settings:rescanGameData')();
  const updated=await resolve();
  assert.equal(updated[0].bytes.toString(),'native-texture-2');
  assert.equal(opens,2,'a new Warcraft build must invalidate the old cached bytes');
});
