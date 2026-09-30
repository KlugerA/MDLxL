
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createStarterRecipe,starterTextureAsset} from '../src/particle-starters.js';
import {stringifyParticleData,parseParticleData} from '../src/particle-data.js';
import {validateParticleRecipe} from '../src/particle-recipes.js';
import {includeParticleAssets,embeddedParticleAssets} from '../src/particle-assets.js';
import {particleGridChange,particleCellAt} from '../src/particle-picture.js';
import {particleRecipeDocument} from '../src/particle-recipes.js';
const {ParticleLibrary}=createRequire(import.meta.url)('../electron/particle-library.cjs');
const directory=path.resolve('out/particle-prototype/store-tests-'+Date.now());
const makeStore=()=>new ParticleLibrary({directory,discover:async()=>({cascFolders:[]})});
test('switching effects keeps independent working copies, pictures and undo across restart',async()=>{
 const store=makeStore(),recipe=createStarterRecipe();
 const picture='MDLxL_Forge\\Particle_'+'c'.repeat(32)+'.tga';recipe.native.Textures[0].Image=picture;recipe.dependencies[0].path=picture;
 const doc=particleRecipeDocument(recipe);
 const saved=await store.save({data:stringifyParticleData(recipe),name:'Original'}),original=await store.read(saved.id);
 doc.apply('Bigger sparks',['Nodes'],m=>{m.ParticleEmitters2[0].Speed=73;});
 const draft={schema:'mdlxl-particle-draft',version:1,state:doc.captureRecoveryState(),recipe:includeParticleAssets(recipe,new Map([[picture.toLowerCase(),{...starterTextureAsset(),name:picture,origin:'particle-custom'}]]))};
 await store.workingCopy({id:saved.id,data:stringifyParticleData(draft)});
 await store.workingCopy({id:'another-effect',data:stringifyParticleData({...draft,mode:'Classic'})});
 const restarted=makeStore(),reopened=parseParticleData(await restarted.workingCopy({id:saved.id}));
 const restored=doc.constructor.restoreRecoveryState(reopened.state);
 assert.equal(restored.model.ParticleEmitters2[0].Speed,73);assert.equal(restored.canUndo,true);
 restored.undo();assert.equal(restored.model.ParticleEmitters2[0].Speed,recipe.native.ParticleEmitters2[0].Speed);
 assert.ok(embeddedParticleAssets(reopened.recipe).size);
 assert.equal(reopened.mode,undefined);assert.equal(parseParticleData(await restarted.workingCopy({id:'another-effect'})).mode,'Classic');
 assert.equal(await restarted.read(saved.id),original,'Private working copy never overwrites the preset');
 assert.equal(await restarted.workingCopy({id:'missing'}),null);
 await assert.rejects(restarted.workingCopy({id:'',data:'{}'}),/working effect/);
 await assert.rejects(restarted.workingCopy({id:saved.id,data:'{}'}),/working effect/);
 assert.equal(await restarted.workingCopy({id:saved.id}),stringifyParticleData(draft));
});
test('personal preset persistence, independent duplication and metadata overrides survive restart',async()=>{
 const store=makeStore(),source=createStarterRecipe(),before=stringifyParticleData(source),saved=await store.save({data:before,name:'Original glow'});
 await store.annotate({id:saved.id,name:'Blue glow',tags:['blue','glow'],favorite:true});
 const restarted=makeStore(),catalog=await restarted.catalog(),item=catalog.items.find(i=>i.id===saved.id);
 assert.equal(item.name,'Blue glow');assert.deepEqual(item.tags,['blue','glow']);assert.equal(item.favorite,true);
 assert.equal(parseParticleData(await restarted.read(saved.id)).name,'Original glow','Metadata never rewrites source recipe');
 const copy=await restarted.duplicate(saved.id);assert.notEqual(copy.id,saved.id);assert.equal(copy.name,'Blue glow copy');
 assert.deepEqual(parseParticleData(await restarted.exportData(copy.id)).native,source.native);
 assert.equal(stringifyParticleData(source),before);
});
test('preset updates invalidate cached thumbnails and retain a recoverable previous file',async()=>{
 const store=makeStore(),source=createStarterRecipe(),saved=await store.save({data:stringifyParticleData(source),name:'Before'});
 const image='data:image/png;base64,iVBORw0KGgo=';
 const revision=(await store.thumbnails([saved.id]))[saved.id].revision;await store.thumbnail({id:saved.id,url:image,revision});assert.equal((await store.thumbnails([saved.id]))[saved.id].url,image);
 source.native.ParticleEmitters2[0].Speed=123;
 await store.save({id:saved.id,data:stringifyParticleData(source),name:'After'});
 assert.equal((await store.thumbnails([saved.id]))[saved.id].url,null);
 await assert.rejects(store.thumbnail({id:saved.id,url:image,revision}),/changed while/);
 const current=(await store.thumbnails([saved.id]))[saved.id];assert.notEqual(current.revision,revision);await store.thumbnail({id:saved.id,url:image,revision:current.revision});assert.equal((await store.thumbnails([saved.id]))[saved.id].url,image);
 const previous=parseParticleData(await fs.readFile(path.join(directory,'mine',saved.id+'.json.previous'),'utf8'));assert.equal(previous.name,'Before');
 await store.draft(stringifyParticleData({schema:'mdlxl-particle-draft',version:1,test:'kept'}));assert.equal(parseParticleData(await makeStore().draft()).test,'kept');
});
test('portable custom pictures reopen from preset bytes without their original directory',()=>{
 const recipe=createStarterRecipe(),asset=starterTextureAsset(),name='MDLxL_Forge\\Particle_'+'b'.repeat(32)+'.tga';recipe.native.Textures[0].Image=name;
 recipe.dependencies[0].path=name;const assets=new Map([[name.toLowerCase(),{name,bytes:asset.bytes,origin:'particle-custom'}]]);
 includeParticleAssets(recipe,assets);validateParticleRecipe(recipe);
 const reopened=parseParticleData(stringifyParticleData(recipe)),resolved=embeddedParticleAssets(reopened);
 assert.deepEqual(resolved.get(name.toLowerCase()).bytes,asset.bytes);
 const bad=structuredClone(recipe);bad.embeddedAssets[0].path='..\\outside.tga';assert.throws(()=>validateParticleRecipe(bad),/picture/);
 const huge=structuredClone(recipe);huge.native.ParticleEmitters2[0].ObjectId=1e9;assert.throws(()=>validateParticleRecipe(huge),/identity/);
});
test('picture grid changes are bounded only after explicit correction and preserve separate repeats',()=>{
 const p=structuredClone(createStarterRecipe().native.ParticleEmitters2[0]);p.Rows=4;p.Columns=8;
 p.LifeSpanUVAnim=new Uint32Array([10,20,3]);p.TailUVAnim=new Uint32Array([3,7,5]);const before=structuredClone(p);
 const proposal=particleGridChange(p,2,4);assert.deepEqual(p,before);assert.deepEqual(proposal.invalid,['Early sprites']);assert.equal(proposal.values.LifeSpanUVAnim,undefined);
 const accepted=particleGridChange(p,2,4,{correct:true});assert.deepEqual(Array.from(accepted.values.LifeSpanUVAnim),[7,8,3]);assert.equal(accepted.values.TailUVAnim,undefined);
 assert.equal(particleCellAt(159,127,256,256,4,8),12);assert.equal(particleCellAt(256,256,256,256,4,8),31);
});
test('malformed imports never overwrite an existing preset or allocate unbounded native identities',async()=>{
 const store=makeStore(),saved=await store.save({data:stringifyParticleData(createStarterRecipe()),name:'Keep'}),before=await store.read(saved.id),malformed=createStarterRecipe();
 malformed.native.ParticleEmitters2[0].Speed=1e200;
 await assert.rejects(store.save({id:saved.id,data:stringifyParticleData(malformed)}),/finite native/);
 assert.equal(await store.read(saved.id),before);
 await assert.rejects(store.read('../escape'),/identity/);
 await assert.rejects(store.thumbnails(Array(73).fill(saved.id)),/thumbnail/);
});

test('source-bound pictures reject build changes, missing installs and mismatching bytes before substitution',async()=>{
 const {particleSourceState,resolveParticleSourceAssets}=createRequire(import.meta.url)('../electron/particle-source.cjs'),crypto=await import('node:crypto');
 const folder=path.join(directory,'installation');await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'.build.info'),'test-build');
 const discover=async()=>({cascFolders:[folder]}),state=await particleSourceState(discover,'0'.repeat(64));assert.equal(state.state,'changed');
 const bytes=Buffer.from('source-picture'),hash=crypto.createHash('sha256').update(bytes).digest('hex'),payload={sourceKey:state.sourceKey,dependencies:[{kind:'texture',path:'Textures\\Smoke.blp',physicalPath:'war3.w3mod:_teen.w3mod:Textures\\Smoke.blp',hash}]};
 const calls=[],casc={readSnapshot:async(...args)=>{calls.push(args);return bytes;}};
 const result=await resolveParticleSourceAssets(payload,{discover,casc});assert.equal(result[0].physicalPath,payload.dependencies[0].physicalPath);assert.deepEqual(calls[0],[payload.dependencies[0].physicalPath,folder,state.sourceKey]);
 await assert.rejects(resolveParticleSourceAssets(payload,{discover,casc:{readSnapshot:async()=>Buffer.from('different')}}),/no longer matches/);
 await fs.writeFile(path.join(folder,'.build.info'),'changed-build');const before=calls.length;await assert.rejects(resolveParticleSourceAssets(payload,{discover,casc}),/build changed/);assert.equal(calls.length,before);
 assert.equal((await particleSourceState(async()=>({cascFolders:[]}),state.sourceKey)).state,'missing');
});
test('dependency namespaces stay in the source variant and preserve fallback order',async()=>{
 const {particleDependencyCandidates}=await import('../electron/particle-library-worker.mjs');
 assert.deepEqual(particleDependencyCandidates('Textures\\Smoke.blp','war3.w3mod:_teen.w3mod:Units\\Source.mdx'),['war3.w3mod:_teen.w3mod:Textures\\Smoke.blp','war3.w3mod:Textures\\Smoke.blp']);
 assert.deepEqual(particleDependencyCandidates('war3.w3mod:_hd.w3mod:Exact.blp','war3.w3mod:Source.mdx'),['war3.w3mod:_hd.w3mod:Exact.blp']);
});

test('observed stock names overlay exact source identities and user names survive rescan',async()=>{
 const reviews=JSON.parse(await fs.readFile(new URL('../src/particle-reviewed-names.json',import.meta.url))),[id,review]=Object.entries(reviews)[0],sourceKey='a'.repeat(64),root=path.join(directory,'curated'),cache=path.join(root,sourceKey);
 await fs.mkdir(cache,{recursive:true});const item={id,name:'Generated name',collection:'Warcraft',sources:[{contentHash:review.naming.sourceContentHash}],naming:{state:'review-needed'}};
 await fs.writeFile(path.join(root,'current.json'),JSON.stringify({sourceKey}));await fs.writeFile(path.join(cache,'catalog.json'),JSON.stringify([item]));await fs.writeFile(path.join(cache,'manifest.json'),JSON.stringify({sourceKey,processed:[],failures:[],missingDependencies:[],unsupported:[]}));
 const store=new ParticleLibrary({directory:root,discover:async()=>({cascFolders:[]})}),before=await fs.readFile(path.join(cache,'catalog.json'),'utf8');
 let catalog=await store.catalog();assert.equal(catalog.items[0].name,review.name);assert.equal(catalog.coverage.reviewedNames,1);assert.equal(await fs.readFile(path.join(cache,'catalog.json'),'utf8'),before);
 await store.annotate({id,name:'My reviewed name',tags:['mine']});await fs.writeFile(path.join(cache,'catalog.json'),JSON.stringify([{...item,name:'Rescanned automatic name'}]));catalog=await store.catalog();assert.equal(catalog.items[0].name,'My reviewed name');assert.deepEqual(catalog.items[0].tags,['mine']);
 await fs.writeFile(path.join(root,'metadata.json'),'{}');item.sources[0].contentHash='changed';await fs.writeFile(path.join(cache,'catalog.json'),JSON.stringify([item]));catalog=await store.catalog();assert.equal(catalog.items[0].name,'Generated name');assert.equal(catalog.coverage.reviewedNames,0);
});

test('source-context preview is bound to the exact indexed model and source namespaces',async()=>{
 const {resolveParticleSourceContext,particleSourceState}=createRequire(import.meta.url)('../electron/particle-source.cjs'),{particleRecipeDocument}=await import('../src/particle-recipes.js'),crypto=await import('node:crypto'),folder=path.join(directory,'context-install');await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'.build.info'),'context-build');
 const discover=async()=>({cascFolders:[folder]}),state=await particleSourceState(discover,'0'.repeat(64)),recipe=createStarterRecipe(),doc=particleRecipeDocument(recipe),bytes=doc.serialize('mdx'),hash=crypto.createHash('sha256').update(bytes).digest('hex'),source={physicalPath:'war3.w3mod:_teen.w3mod:Test.mdx',logicalPath:'Test.mdx',contentHash:hash,buildKey:state.sourceKey},calls=[];
 const casc={readSnapshot:async name=>{calls.push(name);return name===source.physicalPath?bytes:starterTextureAsset().bytes;}};
 const result=await resolveParticleSourceContext(source,{discover,casc});assert.equal(result.name,'Test.mdx');assert.equal(result.assets.length,1);assert.ok(calls[1].startsWith('war3.w3mod:_teen.w3mod:'));assert.deepEqual(Buffer.from(result.bytes),Buffer.from(bytes));
 await assert.rejects(resolveParticleSourceContext({...source,contentHash:'a'.repeat(64)},{discover,casc}),/indexed identity/);await assert.rejects(resolveParticleSourceContext({...source,physicalPath:'..\\secret'},{discover,casc}),/no indexed source/);
});


test('stock thumbnail revisions separate game builds and reject a late capture from the old build',async()=>{
 const root=path.join(directory,'thumbnail-builds'),id='wc3-'+'1'.repeat(24),image='data:image/png;base64,iVBORw0KGgo=',store=new ParticleLibrary({directory:root,discover:async()=>({cascFolders:[]})});
 for(const key of ['a','b']){const cache=path.join(root,key.repeat(64));await fs.mkdir(cache,{recursive:true});const recipe=createStarterRecipe();recipe.id=id;await fs.writeFile(path.join(cache,id+'.json'),stringifyParticleData(recipe));}
 await fs.writeFile(path.join(root,'current.json'),JSON.stringify({sourceKey:'a'.repeat(64)}));const old=(await store.thumbnails([id]))[id].revision;await store.thumbnail({id,url:image,revision:old});assert.equal((await store.thumbnails([id]))[id].url,image);
 await fs.writeFile(path.join(root,'current.json'),JSON.stringify({sourceKey:'b'.repeat(64)}));const current=(await store.thumbnails([id]))[id];assert.equal(current.url,null);assert.notEqual(current.revision,old);await assert.rejects(store.thumbnail({id,url:image,revision:old}),/changed while/);await store.thumbnail({id,url:image,revision:current.revision});assert.equal((await store.thumbnails([id]))[id].url,image);
});
