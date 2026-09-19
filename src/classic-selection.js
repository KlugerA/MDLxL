// Geoset selection is separate from visibility and vertex selection.
export function chooseGeosets(current,index,{shift=false,ctrl=false,anchor=index,count=0,checked}={}){
  const next=new Set(current);
  if(!Number.isInteger(index)||index<0||index>=count)return next;
  const enabled=checked??!next.has(index);
  if(shift){for(let i=Math.max(0,Math.min(anchor,index));i<=Math.min(count-1,Math.max(anchor,index));i++)enabled?next.add(i):next.delete(i);}
  else if(ctrl||checked!==undefined){enabled?next.add(index):next.delete(index);}
  else {next.clear();next.add(index);}
  return next;
}
export function allGeosets(count){return new Set(Array.from({length:count},(_,i)=>i));}
export function initialGeosetSelection(count){return count>0?new Set([0]):new Set();}
export function invertGeosets(current,count){return new Set([...allGeosets(count)].filter(i=>!current.has(i)));}
export function filterVertexSelection(selection,geosets,model){return Object.fromEntries(Object.entries(selection).filter(([i])=>geosets.has(Number(i))&&model.Geosets[i]).map(([i,ids])=>[i,[...new Set(ids)].filter(v=>v>=0&&v<model.Geosets[i].Vertices.length/3)]));}
