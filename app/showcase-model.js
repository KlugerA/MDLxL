import {showcaseEmitters, timeShowcasePlaylist} from './showcase-effects.js';
// Match authored animation names, never reuse a numeric index from another model.
export function remapShowcasePlaylist(rows,previous,next){
  return (rows||[]).flatMap(row=>{
    const name=previous?.Sequences?.[row.sequence]?.Name;
    const sequence=next?.Sequences?.findIndex(item=>item.Name===name)??-1;
    const before = showcaseEmitters(previous || {}), after = showcaseEmitters(next);
    const disabledEmitters = (row.disabledEmitters || []).flatMap(id => {
      const emitter = before.find(item => item.id === id);
      if (!emitter) return [];
      const peers = before.filter(item => item.kind === emitter.kind && item.name === emitter.name);
      const match = after.filter(item => item.kind === emitter.kind && item.name === emitter.name)[peers.indexOf(emitter)];
      return match ? [match.id] : [];
    });
    return sequence<0?[]:[{...row,sequence,disabledEmitters}];
  });
}
export function remapShowcaseTake(take,previous,next){
  const setup={...take.setup,sequencePlaylist:timeShowcasePlaylist(next,remapShowcasePlaylist(take.setup.sequencePlaylist,previous,next)),portraitPlaylist:timeShowcasePlaylist(next,remapShowcasePlaylist(take.setup.portraitPlaylist,previous,next))};
  for(const [list,length,extra] of [['sequencePlaylist','sequenceLength','sequenceExtraTime'],['portraitPlaylist','portraitLength','portraitExtraTime']]){setup[extra]=Math.max(0,Number(take.setup[extra])||0);setup[length]=Math.max(.02,Math.round((setup[list].reduce((sum,row)=>sum+Number(row.seconds),0)+setup[extra])*100)/100);}
  const rows=setup.mode==='portrait'?setup.portraitPlaylist:setup.sequencePlaylist;
  return {...take,setup,name:rows.map(row=>next.Sequences[row.sequence].Name).join(' → ')+' · '+(setup.mode==='portrait'?setup.portraitLength:setup.sequenceLength)+'s'};
}

// A queued recording owns a frozen model and its textures. Loading a different
// editor model must not rebind that recording or revoke the textures it needs.
export async function snapshotShowcaseModel({model, modelName, modelPath, revision, sessionId, textureAssets}) {
  const source=structuredClone({model,modelName,modelPath,revision,sessionId,textureAssets});
  for (const asset of new Set(source.textureAssets.values())) {
    if (!asset.url) continue;
    if (!asset.blob) {
      const response=await fetch(asset.url);
      if (!response.ok) throw Error('Could not preserve model texture: '+asset.name);
      asset.blob=await response.blob();
    }
    delete asset.url;
  }
  return source;
}
export function hydrateShowcaseModel(source, urls) {
  const restored=structuredClone(source);
  for (const asset of new Set(restored.textureAssets.values())) if (asset.blob) {
    asset.url=URL.createObjectURL(asset.blob);urls.add(asset.url);
  }
  return restored;
}
