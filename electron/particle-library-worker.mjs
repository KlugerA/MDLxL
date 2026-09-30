import fs from 'node:fs/promises';
import {activeParticleSample} from '../src/particle-sampling.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { effectNodes, extractParticleRecipe, validateParticleRecipe } from '../src/particle-recipes.js';
import { stringifyParticleData, parseParticleData } from '../src/particle-data.js';
const require = createRequire(import.meta.url);
const { CascReader } = require('./casc.cjs');
const reviewedNames=require('../src/particle-reviewed-names.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
let cancelled = false;
parentPort?.on('message', message => { if (message === 'cancel') cancelled = true; });
const atomic = async (file, content) => { await fs.writeFile(file + '.tmp', content); await fs.rename(file + '.tmp', file); };
function suggestedName(recipe) {
  const p = recipe.native.ParticleEmitters2[0], ribbon = recipe.native.RibbonEmitters[0];
  if (ribbon) return { name: 'Ribbon trail', categories: ['Trails'], tags: ['ribbon','weapon','trail'], naming: { state: 'review-needed' } };
  if (!p) return { name: 'Model particles', categories: ['Other'], tags: ['external'], naming: { state: 'review-needed' } };
  const [r,g,b] = p.SegmentColor?.[0] || [1,1,1];
  const color = r > g*1.5 && r > b*1.5 ? 'Red' : g > r*1.5 && g > b*1.5 ? 'Green' : b > r*1.5 ? 'Blue' : r > b*1.7 && g > b*1.7 ? 'Golden' : r > g*1.3 && b > g*1.3 ? 'Purple' : 'Pale';
  const streak = (p.FrameFlags & 2) !== 0, burst = !!p.Squirt;
  return { name: color + (burst ? ' particle burst' : streak ? ' streaks' : ' particles'), categories: [burst ? 'Bursts' : streak ? 'Trails' : 'Other'], tags: [color.toLowerCase(), burst ? 'burst' : streak ? 'trail' : 'particles'], naming: { state: 'review-needed', basis: 'native tint and frame flags; texture appearance awaits preview review' } };
}
export function particleDependencyCandidates(logical,source){
 if(logical.includes(':'))return [logical];const parts=source.split(':');parts.pop();const result=[];
 while(parts.length){result.push(parts.join(':')+':'+logical);parts.pop();}return result.length?result:['war3.w3mod:'+logical];
}
export async function scanParticleLibrary({ folder, directory, maxAssets = Infinity, onProgress = () => {}, shouldCancel = () => cancelled }) {
  await fs.mkdir(directory, {recursive:true});
  const build = await fs.readFile(path.join(folder,'.build.info'),'utf8');
  const sourceKey = hash(path.resolve(folder).toLowerCase() + '|' + hash(build));
  const cache = path.join(directory, sourceKey); await fs.mkdir(cache,{recursive:true});
  const reader = new CascReader(folder, cache);
  const startedAt = new Date().toISOString();
  let manifest, entries = [], inventory, completed = new Set();
  const dependencies = new Map();
  try {
    inventory = await reader.list('models');
    const candidates = inventory.names.filter(name => !/(?:^|:)_(?:hd|de)\.w3mod:/i.test(name));
    const namespaces = Object.fromEntries([...new Set(inventory.names.map(n => n.split(':').slice(0,-1).join(':')))].map(ns => [ns, inventory.names.filter(n => n.startsWith(ns + ':') && n.split(':').length === ns.split(':').length+1).length]));
    try {
      const previous = JSON.parse(await fs.readFile(path.join(cache,'manifest.json'),'utf8'));
      if (previous.schema === 3 && previous.sourceKey === sourceKey) { manifest = previous; entries = JSON.parse(await fs.readFile(path.join(cache,'catalog.json'),'utf8')); completed = new Set(manifest.processed); }
    } catch(error) { if (error.code !== 'ENOENT') throw error; }
    manifest ||= { schema:3, sourceKey, source:{installation:folder, buildInfo:build}, startedAt, totalEnumerated:inventory.names.length, namespaces, candidateAssets:candidates.length, parsedAssets:0, emitterCounts:{ParticleEmitters2:0,RibbonEmitters:0,ParticleEmitters:0,ParticleEmitterPopcorns:0}, processed:[], assets:[], failures:[], missingDependencies:[], unsupported:[], duplicates:[], extractionComplete:false, fullyPreviewableRecipes:0, insertableRecipes:0, reviewedNames:0, reviewNeededNames:0 };
    const pictures=await reader.list('textures'),keys={...pictures.keys,...inventory.keys};
    const byHash = new Map(entries.filter(item=>!item.blocked).map(item => [item.recipeHash,item]));
    async function checkpoint() {
      manifest.processed = [...completed]; manifest.updatedAt = new Date().toISOString();
      manifest.reviewedNames=entries.filter(item=>item.naming.state==='reviewed'||item.sources?.some(source=>source.contentHash===reviewedNames[item.id]?.naming.sourceContentHash)).length;manifest.reviewNeededNames=entries.length-manifest.reviewedNames;
      manifest.recipeCount=entries.filter(item=>!item.blocked).length;manifest.blockedEntries=entries.filter(item=>item.blocked).length;manifest.catalogEntries=entries.length;manifest.sourceGroups=entries.filter(item=>item.grouping&&!item.blocked).length;
      manifest.extractionComplete = completed.size === candidates.length;
      // Renderer compatibility is recorded independently from actual render/placement validation.
      manifest.previewCandidates = entries.filter(item => !item.blocked&&!item.unsupported.length && !item.missingDependencies).length;
      await atomic(path.join(cache,'catalog.json'),JSON.stringify(entries));
      await atomic(path.join(cache,'manifest.json'),JSON.stringify(manifest,null,2));
      await atomic(path.join(directory,'current.json'),JSON.stringify({sourceKey,folder}));
      onProgress({ sourceKey, processed:completed.size,total:candidates.length,recipes:entries.length,complete:manifest.extractionComplete,cancelled:shouldCancel() });
    }
    function blocked(name,selection,error,source={logicalPath:name.split(':').at(-1),physicalPath:name,buildKey:sourceKey,installation:folder}){
      const id='wc3-'+hash(sourceKey+'|blocked|'+name+'|'+(selection?.ids||[]).join(',')).slice(0,24);
      entries.push({id,name:selection?.ids.length>1?'Unavailable particle group':'Unavailable particle',categories:['Other'],tags:[],aliases:[name,...selection?.names||[]],sources:[source],naming:{state:'review-needed'},collection:'Warcraft',unsupported:[],blocked:{stage:selection?'recipe':'parse',reason:error.message},grouping:selection?.grouping});
    }
    async function resolveDependency(dependency,source,trail=new Set()){
      if(!dependency.path){dependency.state=dependency.replaceableId?'replaceable':'missing';return;}
      const candidates=particleDependencyCandidates(dependency.path,source),logical=candidates.find(n=>keys[n.toLowerCase()])||candidates.at(-1);
      if(trail.has(logical)){Object.assign(dependency,{state:'cycle',physicalPath:logical});return;}
      if(!dependencies.has(logical)){
        try{const contentKey=keys[logical.toLowerCase()],data=contentKey?await reader.readKey(contentKey):await reader.read(logical),record=data?{state:'resolved',hash:hash(data),bytes:data.length,physicalPath:logical,contentKey}:{state:'missing',physicalPath:logical};
          if(data&&dependency.kind==='model'){
            if(trail.size>=8)record.referenceError='External model depth exceeds eight; further references are unverified.';
            else {const external=openDocument(data,logical),next=new Set([...trail,logical]);record.external={version:external.model.Version,readOnly:external.readOnly,emitters:effectNodes(external.model).map(({family,node})=>({family,id:node.ObjectId,name:node.Name})),dependencies:[...external.model.Textures.filter(t=>t.Image).map(t=>({kind:'texture',path:t.Image})),...external.model.ParticleEmitters.filter(n=>n.Path).map(n=>({kind:'model',path:n.Path}))]};
              if(record.external.dependencies.length>256)record.referenceError='External dependency count exceeds 256; further references are unverified.';else for(const child of record.external.dependencies)await resolveDependency(child,logical,next);
            }
          }
          dependencies.set(logical,record);
        }catch(error){dependencies.set(logical,{state:'missing',physicalPath:logical,reason:error.message});}
      }
      Object.assign(dependency,structuredClone(dependencies.get(logical)));
    }
    let count = 0;
    for (const name of candidates) {
      if (completed.has(name)) continue;
      if (shouldCancel() || count++ >= maxAssets) break;
      try {
        const bytes = await reader.readKey(inventory.keys[name.toLowerCase()]);
        if (!bytes?.length) throw Error('CASC model bytes are missing.');
        const doc = openDocument(bytes,name);
        if (doc.readOnly) throw Error('Source is read-only: ' + doc.diagnostics.filter(d=>d.severity==='error').map(d=>d.code).join(', '));
        manifest.parsedAssets++;
        const found = effectNodes(doc.model), source = {installation:folder,buildKey:sourceKey,logicalPath:name.split(':').at(-1),physicalPath:name,contentKey:inventory.keys[name.toLowerCase()],contentHash:hash(bytes)};
        manifest.assets.push({path:name,hash:source.contentHash,version:doc.model.Version,emitters:found.map(({family,node})=>({family,id:node.ObjectId,name:node.Name}))});
        for(const {family}of found)manifest.emitterCounts[family]++;
        const selections=found.map(({family,node})=>({family,node,ids:[node.ObjectId],names:[node.Name]}));
        if(found.length>1)selections.push({family:'SourceGroup',node:found[0].node,ids:found.map(({node})=>node.ObjectId),names:found.map(({node})=>node.Name),grouping:{kind:'all particle emitters in one source model',source:name,sourceIds:found.map(({node})=>node.ObjectId),excludes:['geosets','lights','events','attachments']}});
        for (const selection of selections) {
          const {family,node,ids,grouping}=selection;
          try {
            const recipe = extractParticleRecipe(doc.model,ids,{grouping,sources:[{...source,emitterIds:ids,emitterId:ids.length===1?node.ObjectId:undefined,emitterName:ids.length===1?node.Name:undefined}],aliases:[...selection.names,name]});
            Object.assign(recipe,suggestedName(recipe));if(grouping){recipe.name+=' group';recipe.tags.push('layered');}
            for (const dependency of recipe.dependencies) {
              await resolveDependency(dependency,name);
              if (dependency.state === 'missing') manifest.missingDependencies.push({source:name,emitter:node.ObjectId,path:dependency.path,kind:dependency.kind});
            }
            // Preserve the entire native motion context in the fingerprint. Similar-looking
            // effects and shared textures are not enough to merge entries.
            const recipeHash = hash(stringifyParticleData({native:recipe.native,dependencies:recipe.dependencies.map(dep=>Object.fromEntries(Object.entries(dep).filter(([key])=>!['physicalPath','contentKey','external','referenceError'].includes(key))))}));
            const existing = byHash.get(recipeHash);
            if (existing) {
              existing.sources.push(...recipe.sources);existing.aliases=[...new Set([...existing.aliases,...recipe.aliases])];
              manifest.duplicates.push({source:name,emitter:node.ObjectId,recipeId:existing.id});
              const stored = parseParticleData(await fs.readFile(path.join(cache,existing.id+'.json'),'utf8'));
              stored.sources.push(...recipe.sources); stored.aliases.push(...recipe.aliases);
              await atomic(path.join(cache,existing.id+'.json'),stringifyParticleData(stored));
              continue;
            }
            recipe.id = 'wc3-' + recipeHash.slice(0,24);
            validateParticleRecipe(recipe);recipe.previewSample=activeParticleSample(recipe.native);recipe.defaultSequence=recipe.previewSample.sequence;
            for (const item of recipe.compatibility.unsupported) manifest.unsupported.push({source:name,emitter:node.ObjectId,family,reason:item.reason});
            const entry = { id:recipe.id,name:recipe.name,categories:recipe.categories,tags:recipe.tags,naming:recipe.naming,aliases:recipe.aliases,sources:recipe.sources,recipeHash,version:recipe.native.Version,family,grouping,unsupported:recipe.compatibility.unsupported,missingDependencies:recipe.dependencies.filter(d=>d.state==='missing').length,collection:'Warcraft' };
            entries.push(entry); byHash.set(recipeHash,entry);
            await atomic(path.join(cache,recipe.id+'.json'),stringifyParticleData(recipe));
          } catch(error) { manifest.failures.push({source:name,emitter:node.ObjectId,emitterIds:ids,family,stage:'recipe',reason:error.message});blocked(name,selection,error,source); }
        }
      } catch(error) { manifest.failures.push({source:name,stage:'parse',reason:error.message});blocked(name,null,error); }
      completed.add(name);
      if (count % 25 === 0) await checkpoint();
    }
    await checkpoint();
    return { manifest, entries, directory:cache };
  } finally { reader.close(); }
}
if (workerData) scanParticleLibrary({...workerData,onProgress:status=>parentPort.postMessage({type:'progress',status})}).then(result=>{parentPort.postMessage({type:'done',summary:{...result.manifest,assets:undefined,processed:undefined}});parentPort.close();},error=>{parentPort.postMessage({type:'error',message:error.message});parentPort.close();});
