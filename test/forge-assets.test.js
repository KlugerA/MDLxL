import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
import {retainedForgeAssets,forgeExportArchive,isForgeAssetPath,missingForgeAssetPaths} from '../src/forge-assets.js';
import {buildForgeMesh,commitForge,encodeForgeTga} from '../src/forge.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
const {saveForgeAssets}=createRequire(import.meta.url)('../electron/forge-assets.cjs');
const {TextureResolver}=createRequire(import.meta.url)('../electron/texture-resolver.cjs');
test('Forge texture saving reuses exact content, rejects traversal and never overwrites different assets',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mdlxl-forge-assets-'));try{
 const model=path.join(dir,'model.mdx'),asset={name:'MDLxL_Forge/01234-piece.tga',bytes:new Uint8Array([1,2,3])};
 await saveForgeAssets(model,[asset]);assert.deepEqual(await fs.readFile(path.join(dir,asset.name)),Buffer.from(asset.bytes));await saveForgeAssets(model,[asset]);
 await assert.rejects(saveForgeAssets(model,[{...asset,bytes:new Uint8Array([3])}]),/different texture/);
 await assert.rejects(saveForgeAssets(model,[{...asset,name:'../outside.tga'}]),/supported filename/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Forge export keeps model and used image together and excludes native library assets',async()=>{
 const custom={name:'MDLxL_Forge\\abc-piece.tga',bytes:new Uint8Array([1,2]),source:'forge'},native={name:'Textures\\white.blp',bytes:new Uint8Array([4]),source:'library'},unused={name:'MDLxL_Forge\\unused.tga',bytes:new Uint8Array([8]),source:'forge'};
 const assets=new Map([['full',custom],['short',custom],['native',native],['unused',unused]]),kept=retainedForgeAssets(assets,{Textures:[{Image:custom.name}]});assert.equal(kept.length,1);assert.equal(retainedForgeAssets(assets).length,2);
 const bytes=new Uint8Array(await forgeExportArchive('Hero.mdx',new Uint8Array([4,5]),kept).arrayBuffer());const text=new TextDecoder().decode(bytes);assert.ok(text.includes('Hero.mdx'));assert.ok(text.includes('MDLxL_Forge/abc-piece.tga'));assert.ok(!text.includes('white.blp'));assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);
});
test('reopened Forge sidecars survive game-data classification, recovery and Save As into another folder',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mdlxl-forge-relocation-')),resolver=new TextureResolver();
 try{
  const first=path.join(dir,'first'),second=path.join(dir,'second');await fs.mkdir(first);await fs.mkdir(second);
  const name='MDLxL_Forge\\0123456789-piece.tga',bytes=encodeForgeTga({width:1,height:1,data:new Uint8Array([14,88,235,140])}),asset={name,bytes};
  const doc=createDemoDocument(),mesh=buildForgeMesh({width:1,height:1,mask:new Uint8Array([1]),detail:0});doc.apply('Forge',[],m=>commitForge(m,mesh,{texturePath:name}));
  await saveForgeAssets(path.join(first,'Hero.mdx'),[asset]);await fs.writeFile(path.join(first,'Hero.mdx'),doc.serialize('mdx'));
  const reopened=openDocument(await fs.readFile(path.join(first,'Hero.mdx'))),records=await resolver.resolve([name],{folders:[first]});assert.equal(records.length,1);
  const loaded={...records[0],source:'gameData'},assets=new Map([[name.toLowerCase(),loaded]]);
  assert.deepEqual(missingForgeAssetPaths(assets,reopened.model),[]);assert.equal(retainedForgeAssets(assets).length,1,'Recovery must retain sidecars even from the old game-data path');
  await saveForgeAssets(path.join(second,'Hero copy.mdx'),retainedForgeAssets(assets,reopened.model));
  const relocated=await resolver.resolve([name],{folders:[second]});assert.equal(relocated.length,1);assert.deepEqual([...relocated[0].bytes],[...bytes]);
 }finally{await resolver.close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));await fs.rm(dir,{recursive:true,force:true});}
});
test('manual sidecar imports by basename satisfy a reopened model and missing payloads remain detectable',()=>{
 const name='MDLxL_Forge\\abcdef-piece.tga',model={Textures:[{Image:name},{Image:'Textures\\white.blp'}]},record={name:'abcdef-piece.tga',bytes:new Uint8Array([1]),source:'manual'},assets=new Map([['abcdef-piece.tga',record]]);
 assert.deepEqual(retainedForgeAssets(assets,model),[{name,bytes:record.bytes}]);assert.deepEqual(missingForgeAssetPaths(assets,model),[]);
 assert.deepEqual(missingForgeAssetPaths(new Map(),model),[name]);
 assert.equal(isForgeAssetPath(name),true);assert.equal(isForgeAssetPath('MDLxL_Forge/../../outside.tga'),false);assert.equal(isForgeAssetPath('Textures/white.blp'),false);
});
