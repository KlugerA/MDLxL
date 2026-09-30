import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { effectNodes, extractParticleRecipe, validateParticleRecipe } from '../src/particle-recipes.js';
import { stringifyParticleData, parseParticleData } from '../src/particle-data.js';
const require = createRequire(import.meta.url);
const { CascReader } = require('./casc.cjs');
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
      if (previous.schema === 2 && previous.sourceKey === sourceKey) { manifest = previous; entries = JSON.parse(await fs.readFile(path.join(cache,'catalog.json'),'utf8')); completed = new Set(manifest.processed); }
    } catch(error) { if (error.code !== 'ENOENT') throw error; }
    manifest ||= { schema:2, sourceKey, source:{installation:folder, buildInfo:build}, startedAt, totalEnumerated:inventory.names.length, namespaces, candidateAssets:candidates.length, parsedAssets:0, emitterCounts:{ParticleEmitters2:0,RibbonEmitters:0,ParticleEmitters:0,ParticleEmitterPopcorns:0}, processed:[], assets:[], failures:[], missingDependencies:[], unsupported:[], duplicates:[], extractionComplete:false, fullyPreviewableRecipes:0, insertableRecipes:0, reviewedNames:0, reviewNeededNames:0 };
    const byHash = new Map(entries.map(item => [item.recipeHash,item]));
    async function checkpoint() {
      manifest.processed = [...completed]; manifest.updatedAt = new Date().toISOString();
      manifest.reviewNeededNames = entries.filter(item => item.naming.state !== 'reviewed').length;
      manifest.recipeCount = entries.length;
      manifest.extractionComplete = completed.size === candidates.length;
      // Renderer compatibility is recorded independently from actual render/placement validation.
      manifest.previewCandidates = entries.filter(item => !item.unsupported.length && !item.missingDependencies).length;
      await atomic(path.join(cache,'catalog.json'),JSON.stringify(entries));
      await atomic(path.join(cache,'manifest.json'),JSON.stringify(manifest,null,2));
      await atomic(path.join(directory,'current.json'),JSON.stringify({sourceKey,folder}));
      onProgress({ sourceKey, processed:completed.size,total:candidates.length,recipes:entries.length,complete:manifest.extractionComplete,cancelled:shouldCancel() });
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
        for (const {family,node} of found) {
          manifest.emitterCounts[family]++;
          try {
            const recipe = extractParticleRecipe(doc.model,[node.ObjectId],{sources:[{...source,emitterId:node.ObjectId,emitterName:node.Name}],aliases:[node.Name,name]});
            Object.assign(recipe,suggestedName(recipe));
            for (const dependency of recipe.dependencies) {
              if (!dependency.path) { dependency.state = dependency.replaceableId ? 'replaceable' : 'missing'; continue; }
              const logical = dependency.path.includes(':') ? dependency.path : 'war3.w3mod:' + dependency.path;
              if (!dependencies.has(logical)) {
                try { const data = await reader.read(logical); dependencies.set(logical, data ? {state:'resolved',hash:hash(data),bytes:data.length} : {state:'missing'}); }
                catch(error) { dependencies.set(logical,{state:'missing',reason:error.message}); }
              }
              Object.assign(dependency,dependencies.get(logical));
              if (dependency.state === 'missing') manifest.missingDependencies.push({source:name,emitter:node.ObjectId,path:dependency.path,kind:dependency.kind});
            }
            // Preserve the entire native motion context in the fingerprint. Similar-looking
            // effects and shared textures are not enough to merge entries.
            const recipeHash = hash(stringifyParticleData({native:recipe.native,dependencies:recipe.dependencies}));
            const existing = byHash.get(recipeHash);
            if (existing) {
              existing.sources.push(...recipe.sources);
              manifest.duplicates.push({source:name,emitter:node.ObjectId,recipeId:existing.id});
              const stored = parseParticleData(await fs.readFile(path.join(cache,existing.id+'.json'),'utf8'));
              stored.sources.push(...recipe.sources); stored.aliases.push(...recipe.aliases);
              await atomic(path.join(cache,existing.id+'.json'),stringifyParticleData(stored));
              continue;
            }
            recipe.id = 'wc3-' + recipeHash.slice(0,24);
            validateParticleRecipe(recipe);
            for (const item of recipe.compatibility.unsupported) manifest.unsupported.push({source:name,emitter:node.ObjectId,family,reason:item.reason});
            const entry = { id:recipe.id,name:recipe.name,categories:recipe.categories,tags:recipe.tags,naming:recipe.naming,aliases:recipe.aliases,sources:recipe.sources,recipeHash,version:recipe.native.Version,family,unsupported:recipe.compatibility.unsupported,missingDependencies:recipe.dependencies.filter(d=>d.state==='missing').length,collection:'Warcraft' };
            entries.push(entry); byHash.set(recipeHash,entry);
            await atomic(path.join(cache,recipe.id+'.json'),stringifyParticleData(recipe));
          } catch(error) { manifest.failures.push({source:name,emitter:node.ObjectId,family,stage:'recipe',reason:error.message}); }
        }
      } catch(error) { manifest.failures.push({source:name,stage:'parse',reason:error.message}); }
      completed.add(name);
      if (count % 25 === 0) await checkpoint();
    }
    await checkpoint();
    return { manifest, entries, directory:cache };
  } finally { reader.close(); }
}
if (workerData) scanParticleLibrary({...workerData,onProgress:status=>parentPort.postMessage({type:'progress',status})}).then(result=>{parentPort.postMessage({type:'done',summary:{...result.manifest,assets:undefined,processed:undefined}});parentPort.close();},error=>{parentPort.postMessage({type:'error',message:error.message});parentPort.close();});
