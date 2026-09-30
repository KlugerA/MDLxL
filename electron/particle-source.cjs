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
module.exports={particleSourceState,resolveParticleSourceAssets};
