// Route the actual bundled-checker findings, not the absence of optimizer
// proposals. Every finding receives a disposition, including unknown types.
const collections={Bone:'Bones',Helper:'Helpers',Attachment:'Attachments',EventObject:'EventObjects',ParticleEmitter:'ParticleEmitters',ParticleEmitter2:'ParticleEmitters2',RibbonEmitter:'RibbonEmitters',Light:'Lights',Camera:'Cameras',GeosetAnimation:'GeosetAnims',GeosetAnim:'GeosetAnims',Material:'Materials',TextureAnimation:'TextureAnims',Texture:'Textures',GlobalSequence:'GlobalSequences',Geoset:'Geosets',CollisionShape:'CollisionShapes'};
export function hiveTrackPath(path=''){
  const root=/^\/([^/]+?)\s+(\d+)(?= - |\/|$)/.exec(path);if(!root)return null;
  const collection=collections[root[1].replace(/\s/g,'')];if(!collection)return null;
  // Names are descriptive only, and may themselves contain slashes.
  const tail=path.slice(root[0].length).replace(/^ - "[\s\S]*"(?=\/|$)/,'');
  const parts=[collection,root[2]];
  for(const part of tail.split('/').filter(Boolean)){
    const layer=/^Layer (\d+)$/.exec(part);if(layer)parts.push('Layers',layer[1]);
    else parts.push(part.replace(/\s/g,''));
  }
  return parts.join('.');
}
export function classifyHiveFindings(findings,proposals=[]){
  return findings.map(f=>{
    const message=f.message||f.name||'',frameMatch=/\bat frame (\d+)/.exec(message),frame=frameMatch?Number(frameMatch[1]):null;
    let kind='unsupported',owner=null;
    if(f.type==='unused'){
      if(/^Track \d+ at frame \d+ has (?:roughly|exactly) the same value as tracks \d+ and \d+$/.test(message)){kind='redundantTracks';owner='sanity';}
      else if(/^Track \d+ at frame \d+ is not in any sequence$/.test(message)){kind='unusedLocalKeys';owner='sanity';}
      else if(/^Track \d+ at frame \d+ is not in global sequence \d+$/.test(message)){kind='globalKeys';owner='sanity';}
      else if(message==='Unused object'){kind='unusedObject';owner='unused';}
    }else if(/^Missing opening track for /.test(message)){kind='openingTrack';owner='sanity';}
    else if(message==='Using a gravity animation.'){kind='gravity';owner='sanity';}
    const location=hiveTrackPath(f.path);
    const proposal=proposals.find(p=>p.kind==='splineResample'&&kind==='redundantTracks'&&location===p.path?.join('.')&&p.noticed.includes(frame))||proposals.find(p=>f.type!=='unused'&&/extent|radius/i.test(message)&&p.targets?.some(t=>(f.path||'').startsWith(t.hivePath))||
      p.kind==='gravity'&&location===`ParticleEmitters2.${p.emitter}.Gravity`||
      p.kind===kind&&location===p.path?.join('.')&&
      (kind==='openingTrack'?p.frame===frame:kind==='redundantTracks'?p.noticed.includes(frame):kind==='unusedLocalKeys'?p.frames.includes(frame):true));
    if(proposal){const manual=proposal.inspectionOnly||proposal.kind==='redundantTracks'&&!proposal.frames?.includes(frame);
      return {...f,kind,owner:'sanity',fixId:proposal.id,status:manual?'manual':'preview',
        reason:manual?'Detected; its curve or domain requires manual review.':'Supported correction available.'};}
    if(kind==='unusedObject')return {...f,kind,owner,status:'stage',reason:'Review reference-based removal in Unused data; retained dependencies remain reported here.'};
    return {...f,kind,owner,status:'manual',reason:kind==='unsupported'?'Detected by Hive; no supported automatic correction.':'Detected; no safe automatic correction for this domain.'};
  });
}
