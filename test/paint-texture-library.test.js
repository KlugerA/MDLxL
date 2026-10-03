import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const {PaintTextureLibrary}=createRequire(import.meta.url)('../electron/paint-textures.cjs');

test('bundled defaults seed all 31 exact images, preserve collisions and respect later edits and deletions',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'citadel-defaults-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const seeds=path.resolve('public/paint-library'),manifest=JSON.parse(await fs.readFile(path.join(seeds,'manifest.json'),'utf8'));
  assert.equal(manifest.entries.length,31);assert.equal(new Set(manifest.entries.map(e=>e.path)).size,31);
  const collision=manifest.entries[0].path;
  await fs.mkdir(path.dirname(path.join(root,collision)),{recursive:true});await fs.writeFile(path.join(root,collision),'personal edited texture');
  await fs.writeFile(path.join(root,'Personal.png'),'personal image');
  const lib=new PaintTextureLibrary(root,seeds),catalog=await lib.list();assert.equal(catalog.items.length,32);
  for(const entry of manifest.entries){
    const source=await fs.readFile(path.join(seeds,entry.path));
    assert.equal(createHash('sha256').update(source).digest('hex'),entry.sha256);
    assert.equal(source.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(source.readUInt32BE(16),entry.width);assert.equal(source.readUInt32BE(20),entry.height);
    if(entry.path!==collision)assert.deepEqual(await fs.readFile(path.join(root,entry.path)),source);
  }
  assert.equal(await fs.readFile(path.join(root,collision),'utf8'),'personal edited texture');
  const deleted=manifest.entries[1].path,edited=manifest.entries[2].path;
  await fs.unlink(path.join(root,deleted));await fs.writeFile(path.join(root,edited),'user repaint');
  const reopened=new PaintTextureLibrary(root,seeds);await reopened.list();
  await assert.rejects(fs.access(path.join(root,deleted)),{code:'ENOENT'});assert.equal(await fs.readFile(path.join(root,edited),'utf8'),'user repaint');
  assert.equal(await fs.readFile(path.join(root,'Personal.png'),'utf8'),'personal image');
});

test('retirement deletes only unchanged seed bytes at their exact known path',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'citadel-retirement-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const stock=Buffer.from('known auto-seeded PNG bytes'),hash=createHash('sha256').update(stock).digest('hex');
  await fs.mkdir(path.join(root,'Metal'));await fs.mkdir(path.join(root,'Personal'));
  await fs.writeFile(path.join(root,'Metal','Old.png'),stock);await fs.writeFile(path.join(root,'Metal','Modified.png'),'personal changes');await fs.writeFile(path.join(root,'Metal','Renamed.png'),stock);await fs.writeFile(path.join(root,'Personal','Old.png'),stock);
  const library=new PaintTextureLibrary(root,null,[{path:'Metal/Old.png',sha256:hash},{path:'Metal/Modified.png',sha256:hash}]);
  const catalog=await library.list();assert.deepEqual(catalog.items.map(i=>i.id).sort(),['Metal/Modified.png','Metal/Renamed.png','Personal/Old.png']);assert.equal(await fs.readFile(path.join(root,'Metal','Modified.png'),'utf8'),'personal changes');
  await fs.writeFile(path.join(root,'Metal','Old.png'),'new user file');await library.list();assert.equal(await fs.readFile(path.join(root,'Metal','Old.png'),'utf8'),'new user file');
});
test('texture folders mirror disk renames, include empty folders and copy without overwriting',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'citadel-textures-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const lib=new PaintTextureLibrary(path.join(root,'Textures'));
  const a=await lib.save({folder:'Custom/Armour',name:'Steel.blp',bytes:new Uint8Array([1,2,3])});
  assert.equal(a.path,path.join(root,'Textures','Custom','Armour','Steel.blp'),'Return the actual saved path for model material assignment');
  const b=await lib.save({folder:'Custom/Armour',name:'Steel.blp',bytes:new Uint8Array([9])});assert.notEqual(a.id,b.id);assert.deepEqual([...((await lib.read(a.id)).bytes)],[1,2,3]);
  await fs.rename(path.join(root,'Textures/Custom'),path.join(root,'Textures/My folder'));
  await fs.mkdir(path.join(root,'Textures/Empty'));const catalog=await lib.list();assert.equal(catalog.items.length,2);assert.ok(catalog.folders.includes('Empty'));assert.ok(catalog.items.every(i=>i.id.startsWith('My folder/')));
  await assert.rejects(lib.save({folder:'../outside',name:'a.png',bytes:new Uint8Array([1])}),/inside Textures/);
  await assert.rejects(lib.read('../outside.blp'),/inside Textures/);await assert.rejects(lib.save({name:'script.exe',bytes:new Uint8Array([1])}),/supported/);
});

test('texture shelf accepts a DDS copy and keeps its path available for model assignment',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'citadel-dds-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const lib=new PaintTextureLibrary(path.join(root,'Textures'));
  const saved=await lib.save({name:'Painted.dds',bytes:new Uint8Array([68,68,83,32])});
  assert.equal(saved.name,'Painted.dds');assert.deepEqual([...await fs.readFile(saved.path)],[68,68,83,32]);
  assert.equal((await lib.list()).items[0].id,'Painted.dds');
});
