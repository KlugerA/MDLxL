const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
/** Only the configured installation is read; recipe metadata cannot select arbitrary local paths. */
async function particleSourceState(discover,expected){
 const found=await discover(),folder=found.cascFolders?.[0];if(!folder)return {state:'missing',message:'Connect your Warcraft III installation in Settings.'};
 let build;try{build=await fs.readFile(path.join(folder,'.build.info'));}catch(error){return {state:'missing',message:'The indexed Warcraft installation is unavailable. Reconnect it in Settings.'};}
 const sourceKey=hash(path.resolve(folder).toLowerCase()+'|'+hash(build));
 return sourceKey===expected?{state:'ready',sourceKey,folder}:{state:'changed',sourceKey,folder,message:'The Warcraft source or build changed. Index Warcraft assets again before opening its effects.'};
}
async function resolveParticleSourceAssets(payload,{discover,casc}){
 const {safeParticlePath}=await import('../src/particle-data.js');
 if(!payload||!Array.isArray(payload.dependencies)||payload.dependencies.length>1024||!/^[a-f0-9]{64}$/.test(payload.sourceKey||''))throw Error('Invalid particle source request.');
 const state=await particleSourceState(discover,payload.sourceKey);if(state.state!=='ready')throw Error(state.message);
 const result=[];
 for(const dep of payload.dependencies){
  if(dep.kind!=='texture'||!dep.path)continue;
  const physical=dep.physicalPath||'war3.w3mod:'+dep.path;
  if(!safeParticlePath(dep.path)||!safeParticlePath(physical)||!/^war3[.]w3mod:/i.test(physical)||!/^[a-f0-9]{64}$/.test(dep.hash||''))throw Error('This recipe needs its source dependencies indexed again.');
  const bytes=await casc.readSnapshot(physical,state.folder,state.sourceKey);
  if(!bytes)throw Error('Missing particle picture: '+dep.path);
  if(hash(bytes)!==dep.hash)throw Error('The particle picture no longer matches its indexed source. Index Warcraft assets again.');
  result.push({name:dep.path,bytes,source:'particle-casc',sourceKey:state.sourceKey,physicalPath:physical});
 }
 return result;
}
/** Resolve an explicit, read-only context view from a recorded recipe identity. */
async function resolveParticleSourceContext(source,{discover,casc}){
 const {safeParticlePath}=await import('../src/particle-data.js'),{openDocument}=await import('../src/editor-document.js'),{particleDependencyCandidates}=await import('./particle-library-worker.mjs');
 if(!source||!safeParticlePath(source.physicalPath)||!/^war3[.]w3mod:/i.test(source.physicalPath)||!/^[a-f0-9]{64}$/.test(source.contentHash||'')||!/^[a-f0-9]{64}$/.test(source.buildKey||''))throw Error('This preset has no indexed source-model context.');
 const state=await particleSourceState(discover,source.buildKey);if(state.state!=='ready')throw Error(state.message);
 const bytes=await casc.readSnapshot(source.physicalPath,state.folder,state.sourceKey);if(!bytes)throw Error('The source model is unavailable. Index Warcraft assets again.');if(bytes.byteLength>128*1024*1024)throw Error('Source model exceeds the context preview budget.');if(hash(bytes)!==source.contentHash)throw Error('The source model no longer matches its indexed identity. Index Warcraft assets again.');
 const doc=openDocument(bytes,source.logicalPath),assets=[],missing=[];let total=bytes.byteLength;
 if(doc.model.Textures.length>1024)throw Error('Source model has too many pictures for context preview.');
 for(const texture of doc.model.Textures){if(!texture.Image||texture.ReplaceableId)continue;if(!safeParticlePath(texture.Image))throw Error('Source model contains an invalid picture path.');let found=false;
  for(const physicalPath of particleDependencyCandidates(texture.Image,source.physicalPath)){const picture=await casc.readSnapshot(physicalPath,state.folder,state.sourceKey);if(!picture)continue;total+=picture.byteLength;if(picture.byteLength>16*1024*1024||total>128*1024*1024)throw Error('Source context pictures exceed the preview budget.');assets.push({name:texture.Image,bytes:picture,source:'particle-casc',sourceKey:state.sourceKey,physicalPath});found=true;break;}
  if(!found)missing.push(texture.Image);
 }
 return {name:source.logicalPath,bytes,assets,missing,unsupported:{modelParticles:doc.model.ParticleEmitters.length,popcorn:doc.model.ParticleEmitterPopcorns.length}};
}
module.exports={particleSourceState,resolveParticleSourceAssets,resolveParticleSourceContext};
