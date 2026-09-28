import {timeShowcasePlaylist} from './showcase-effects.js';
// Match authored animation names, never reuse a numeric index from another model.
export function remapShowcasePlaylist(rows,previous,next){
  return (rows||[]).flatMap(row=>{
    const name=previous?.Sequences?.[row.sequence]?.Name;
    const sequence=next?.Sequences?.findIndex(item=>item.Name===name)??-1;
    return sequence<0?[]:[{...row,sequence}];
  });
}
export function remapShowcaseTake(take,previous,next){
  const setup={...take.setup,sequencePlaylist:timeShowcasePlaylist(next,remapShowcasePlaylist(take.setup.sequencePlaylist,previous,next)),portraitPlaylist:timeShowcasePlaylist(next,remapShowcasePlaylist(take.setup.portraitPlaylist,previous,next))};
  for(const [list,length] of [['sequencePlaylist','sequenceLength'],['portraitPlaylist','portraitLength']])if(setup[list].some(row=>row.useDuration))setup[length]=Math.max(Number(setup[length])||0,setup[list].reduce((sum,row)=>sum+Number(row.seconds),0));
  const rows=setup.mode==='portrait'?setup.portraitPlaylist:setup.sequencePlaylist;
  return {...take,setup,name:rows.map(row=>next.Sequences[row.sequence].Name).join(' → ')+' · '+(setup.mode==='portrait'?setup.portraitLength:setup.sequenceLength)+'s'};
}
