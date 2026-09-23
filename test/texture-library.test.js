import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {prepareTextureLibrary,searchTextureLibrary,folderContains,textureFolderTree} from '../src/texture-library-search.js';
import {russianTextureQuery} from '../src/texture-library/russian-query.mjs';
const require=createRequire(import.meta.url);
const {TextureLibrary}=require('../electron/texture-library.cjs');
const {CascTextures}=require('../electron/casc.cjs');
const {TextureResolver}=require('../electron/texture-resolver.cjs');
const data=JSON.parse(await fs.readFile(new URL('../electron/data/texture-library-catalog.json',import.meta.url),'utf8'));
const annotated=data.items.map(t=>({...t,source:'native',sourcePath:'war3.w3mod:'+t.path,folder:'war3.w3mod:'+t.path.slice(0,t.path.lastIndexOf('\\')),variant:'classic'}));
const prepared=prepareTextureLibrary(annotated);

test('vibe rusty chain mail finds usable mail panels and labels missing rust',()=>{
  const result=searchTextureLibrary(prepared,{query:'rusty chain mail'});
  assert.ok(result.items.length);assert.match(result.items[0].name,/Human Campaign Footman/);
  assert.ok(result.items[0]._match.missing.some(word=>/rust/i.test(word)));
  assert.ok(result.items.every(item=>item.tags.includes('chain')));
});
test('Russian descriptions use the same reviewed texture results as English, retaining original names and paths',()=>{
  for(const [russian,english] of [['ржавая кольчуга','rusty chainmail'],['Нургл','Nurgle'],['Мордор','Mordor'],['синяя ткань','blue cloth'],['металл без крови','metal without blood']]){
    const translated=searchTextureLibrary(prepared,{query:russian}),original=searchTextureLibrary(prepared,{query:english});
    assert.ok(original.items.length,russian);assert.deepEqual(translated.items.map(item=>item.id),original.items.map(item=>item.id),russian);
    assert.deepEqual(translated.items.map(item=>[item.name,item.path]),original.items.map(item=>[item.name,item.path]));
  }
  assert.equal(searchTextureLibrary(prepared,{query:'несуществующаяабракадабра'}).total,0,'unknown Cyrillic must not become an empty query');
});
test('literal Russian names and paths remain literal; descriptive aliases respect protected fields',()=>{
  assert.equal(russianTextureQuery('name:Кожа ржавый металл'),'name:Кожа rusty metal');
  assert.equal(russianTextureQuery('"Кожа" металл'),'"Кожа" metal');
  assert.equal(russianTextureQuery('Textures\\Кожа.blp'),'Textures\\Кожа.blp');
  assert.equal(searchTextureLibrary(prepared,{query:'Нургл',vibe:false}).total,0);
  const named=prepareTextureLibrary([{id:'ru',name:'Кожа',path:'Кожа.blp',sourcePath:'Кожа.blp',kinds:['other'],tags:[],variant:'classic'}]);
  assert.equal(searchTextureLibrary(named,{query:'Кожа',vibe:false}).total,1);
  assert.equal(searchTextureLibrary(named,{query:'Дерево',vibe:false}).total,0);
  const ice=prepareTextureLibrary([{id:'ice',name:'Лёд',path:'Текстуры\\Лёд.blp',sourcePath:'Текстуры\\Лёд.blp',kinds:['other'],tags:[],variant:'classic'}]);
  assert.equal(searchTextureLibrary(ice,{query:'Лёд',vibe:false}).total,1);
  assert.equal(searchTextureLibrary(ice,{query:'Текстуры\\Лёд.blp',vibe:false}).total,1);
});
test('vibe ugly rusty nail offers grounded metal references with an explicit approximation',()=>{
  const result=searchTextureLibrary(prepared,{query:'ugly rusty nail'});
  assert.ok(result.items.length);assert.match(result.notice,/may suit a nail/);
  assert.ok(result.items.slice(0,3).every(item=>item.tags.includes('metal')));
  assert.equal(result.unknown.length,0);
});
test('Nurgle and Mordor are native kitbash suggestions, not invented textures',()=>{
  for(const [query,subject] of [['Nurgle',/Abomination|Flesh|Zombie/],['Mordor',/Grunt|Chaos|Orc/]]){
    const result=searchTextureLibrary(prepared,{query});
    assert.ok(result.items.length);assert.match(result.items[0].name,subject);
    assert.ok(result.items.every(item=>item._match.type==='inspiration'&&item._match.reason));
    assert.match(result.notice,/Native Warcraft textures/);
  }
});
test('name search disables descriptive and fantasy matching',()=>{
  assert.equal(searchTextureLibrary(prepared,{query:'Nurgle',vibe:false}).total,0);
  assert.equal(searchTextureLibrary(prepared,{query:'rusty chain mail',vibe:false}).total,0);
  const result=searchTextureLibrary(prepared,{query:'Footman',vibe:false});
  assert.ok(result.total>0);assert.ok(result.items.every(item=>/footman/i.test(item.name+' '+item.path)));
});
test('BLP-only search filters by the displayed model texture path',()=>{
  const items=prepareTextureLibrary([
    {id:'blp',name:'Classic skin',path:'Textures\\Classic.blp',lookupName:'war3.w3mod:textures\\classic.dds',sourcePath:'war3.w3mod:textures\\classic.dds',kinds:['units'],tags:[],variant:'classic'},
    {id:'dds',name:'HD skin',path:'_hd.w3mod:Textures\\HD.dds',lookupName:'war3.w3mod:_hd.w3mod:textures\\hd.dds',sourcePath:'war3.w3mod:_hd.w3mod:textures\\hd.dds',kinds:['units'],tags:[],variant:'reforged'},
    {id:'png',name:'Loose skin',path:'Loose.png',sourcePath:'Loose.png',kinds:['other'],tags:[],variant:'custom'},
  ]);
  assert.deepEqual(searchTextureLibrary(items,{query:'',variant:'all',format:'blp'}).items.map(item=>item.id),['blp']);
  assert.equal(searchTextureLibrary(items,{query:'',variant:'all',format:'all'}).total,3);
});
test('native folder boundaries preserve module and source hierarchy',()=>{
  assert.equal(folderContains('war3.w3mod:units\\orc\\grunt.dds','war3.w3mod:units\\orc'),true);
  assert.equal(folderContains('war3.w3mod:units\\orcs2\\grunt.dds','war3.w3mod:units\\orc'),false);
  const result=searchTextureLibrary(prepared,{query:'',folder:'war3.w3mod:Units\\Orc'});
  assert.ok(result.items.length);assert.ok(result.items.every(item=>folderContains(item.sourcePath,'war3.w3mod:Units\\Orc')));
  const tree=textureFolderTree(annotated);
  assert.equal(tree.children[0].name,'war3.w3mod');
  assert.ok(tree.children[0].children.some(item=>item.name.toLowerCase()==='textures'));
});
test('unknown native files remain searchable without fabricated surface evidence',()=>{
  const items=prepareTextureLibrary([{id:'x',name:'Special',path:'special.dds',sourcePath:'war3.w3mod:_hd.w3mod:special.dds',kinds:['other'],tags:[],variant:'reforged'}]);
  assert.equal(searchTextureLibrary(items,{query:'Special'}).total,1);
  assert.equal(searchTextureLibrary(items,{query:'rusty metal'}).total,0);
});
test('library joins only native paths which exist, and never borrows SD appearance for HD',async()=>{
  const library=new TextureLibrary({casc:{list:async()=>({sources:[{folder:'game',key:'build',names:['war3.w3mod:textures\\footman.dds','war3.w3mod:_hd.w3mod:textures\\footman.dds'],fromCache:true}],errors:[]})}});
  const result=await library.catalog();assert.equal(result.nativeCount,2);
  const sd=result.items.find(i=>i.variant==='classic'),hd=result.items.find(i=>i.variant==='reforged');
  assert.equal(sd.path,'Textures\\Footman.blp');assert.equal(sd.lookupName,'war3.w3mod:textures\\footman.dds');assert.ok(sd.tags.includes('plate'));
  assert.equal(hd.notes,undefined);assert.deepEqual(hd.tags,[]);
});
test('library labels installed Classic, Reforged, and Forsaken Kingdom sources independently',async()=>{
  const names=[
    'war3.w3mod:textures\\footman.dds',
    'war3.w3mod:_hd.w3mod:units\\human\\footman\\footman_diffuse.dds',
    'war3.w3mod:_de.w3mod:units\\human\\footman\\footman_diffuse.dds',
    'war3.w3mod:campaign\\forsakenkingdom\\undeadre02.w3x\\_de.w3mod:textures\\banner.dds',
    'war3.w3mod:_tilesets\\a.w3mod:terrainart\\ground.dds',
  ];
  const library=new TextureLibrary({casc:{list:async()=>({sources:[{folder:'game',key:'build',names}],errors:[]})}});
  const result=await library.catalog();
  assert.deepEqual(Object.fromEntries(result.items.map(item=>[item.sourcePath,item.variant])),{
    [names[0]]:'classic',[names[1]]:'reforged',[names[2]]:'forsaken-kingdom',[names[3]]:'forsaken-kingdom',[names[4]]:'classic',
  });
  assert.equal(searchTextureLibrary(prepareTextureLibrary(result.items),{query:'',variant:'forsaken-kingdom'}).total,2);
  assert.equal(result.items.find(item=>item.sourcePath===names[2]).path,'_de.w3mod:units\\human\\footman\\footman_diffuse.dds');
});
test('custom catalog lists only immediate texture files and never reads a model',async()=>{
  const calls=[],folder=path.resolve(os.tmpdir(),'mdlvis-library-test');
  const directoryEntry=(name,isFile)=>({name,isFile:()=>isFile});
  const library=new TextureLibrary({readdir:async(directory,options)=>{calls.push({directory,options});return [directoryEntry('skin.blp',true),directoryEntry('photo.png',true),directoryEntry('model.mdx',true),directoryEntry('nested',false),directoryEntry('linked.dds',false)];},stat:async file=>({isFile:()=>true,size:100,mtimeMs:5}),readFile:()=>{throw Error('No file contents should be read.');}});
  const result=await library.custom(path.join(folder,'open.mdx'));
  assert.deepEqual(result.map(i=>i.path),['photo.png','skin.blp']);assert.equal(calls.length,1);assert.equal(calls[0].directory,folder);
  assert.deepEqual(await library.custom('relative.mdx'),[]);
});
test('CASC native path catalog survives restart and invalidates with game build',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-library-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const install=path.join(root,'game'),cache=path.join(root,'cache');await fs.mkdir(install);await fs.writeFile(path.join(install,'.build.info'),'build1');
  let opens=0,closes=0;
  const openReader=()=>{opens++;return {list:async()=>['war3.w3mod:textures\\footman.dds'],close:()=>closes++};};
  const first=new CascTextures({cacheDirectory:cache,openReader});const result=await first.list([install]);assert.equal(result.sources[0].fromCache,false);assert.equal(opens,1);assert.equal(closes,1);await first.close();
  const second=new CascTextures({cacheDirectory:cache,openReader});assert.equal((await second.list([install])).sources[0].fromCache,true);assert.equal(opens,1);
  await fs.writeFile(path.join(install,'.build.info'),'build2');assert.equal((await second.list([install])).sources[0].fromCache,false);assert.equal(opens,2);await second.close();
});
test('native enumeration failure preserves custom folder entries and reports the failure',async()=>{
  const library=new TextureLibrary({casc:{list:async()=>({sources:[],errors:[{folder:'game',message:'Cannot open storage'}]})}});
  library.custom=async()=>[{id:'custom:1',path:'custom.blp',source:'custom'}];
  const result=await library.catalog();assert.equal(result.items.length,1);assert.equal(result.errors[0].message,'Cannot open storage');
});
test('module textures use persisted native content keys after restart',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-library-key-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const install=path.join(root,'game'),cache=path.join(root,'cache'),name='_addons\\hd.w3addon\\units.w3mod:_hd.w3mod:units\\peon.dds',key='0123456789abcdef0123456789abcdef';
  await fs.mkdir(install);await fs.writeFile(path.join(install,'.build.info'),'build1');
  let reads=0;
  const first=new CascTextures({cacheDirectory:cache,openReader:()=>({list:async()=>({names:[name],keys:{[name]:key}}),close(){}})});
  await first.list([install]);await first.close();
  const second=new CascTextures({cacheDirectory:cache,openReader:()=>({read:()=>{throw Error('Module texture must use native key');},readKey:async actual=>{assert.equal(actual,key);reads++;return Buffer.from('DDS sample');},close(){}})});
  assert.equal((await second.read(name,[install])).toString(),'DDS sample');assert.equal(reads,1);await second.close();
  const third=new CascTextures({cacheDirectory:cache,openReader:()=>{throw Error('Cached bytes must not reopen storage');}});
  assert.equal((await third.read(name,[install])).toString(),'DDS sample');await third.close();
});
test('explicit native module paths bypass custom basename collisions and respect chosen CASC order',async()=>{
  const attempts=[];let looseReads=0;
  const resolver=new TextureResolver({stat:async()=>({isFile:()=>true,size:20}),readFile:async()=>{looseReads++;return Buffer.from('custom texture');},openArchive:async()=>{throw Error('Explicit native paths must not read MPQ files');},casc:{read:async(name,folders)=>{attempts.push({name,folders});return folders.includes('selected')?Buffer.from('selected native'):Buffer.from('fallback native');},close(){}}});
  const sources={folders:[path.resolve('custom')],archives:['archive.mpq'],cascFolders:['selected'],fallbackCascFolders:['automatic']};
  const native=await resolver.resolve(['war3.w3mod:textures\\footman.dds'],sources);
  assert.equal(native[0].bytes.toString(),'selected native');assert.equal(looseReads,0);assert.deepEqual(attempts,[{name:'war3.w3mod:textures\\footman.dds',folders:['selected']}]);
  const definitive=await resolver.resolve(['_de.w3mod:replaceabletextures\\commandbuttons\\btnforsakenpaladin.dds'],sources);
  assert.equal(definitive[0].bytes.toString(),'selected native');assert.equal(looseReads,0);
  assert.deepEqual(attempts[1],{name:'war3.w3mod:_de.w3mod:replaceabletextures\\commandbuttons\\btnforsakenpaladin.dds',folders:['selected']});
  const ordinary=await resolver.resolve(['Textures\\Footman.dds'],sources);
  assert.equal(ordinary[0].bytes.toString(),'custom texture');assert.equal(looseReads,1);await resolver.close();
});
