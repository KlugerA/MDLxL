import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {PaintTextureLibrary}=createRequire(import.meta.url)('../electron/paint-textures.cjs');
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
