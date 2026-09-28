import { sampleGeosetAnimation, sampleTrack } from './animation.js';
import { protectedGeosetData } from './optimizexl-exclusions.js';

function visibleFrame(model,index,sequence,from,to,preferred=from) {
  const g=model.Geosets[index],anim=model.GeosetAnims.find(a=>a.GeosetId===index),layers=model.Materials[g.MaterialID]?.Layers||[];
  const tracks=[anim?.Alpha,...layers.map(l=>l.Alpha)],bounds=new Set([from,to]);
  for(const t of tracks)for(const k of t?.Keys||[])if(k.Frame>=from&&k.Frame<=to)bounds.add(k.Frame);
  const sorted=[...bounds].sort((a,b)=>a-b),probes=new Set([Math.max(from,Math.min(to,preferred)),...sorted]);
  for(let i=1;i<sorted.length;i++)for(const fraction of [.25,.5,.75])probes.add(sorted[i-1]+(sorted[i]-sorted[i-1])*fraction);
  const options={interval:model.Sequences[sequence].Interval,globalSequences:model.GlobalSequences,fallback:1};
  for(const frame of probes)if(sampleGeosetAnimation(model,index,frame,sequence).alpha>.001&&(!layers.length||layers.some(l=>sampleTrack(l.Alpha,frame,{...options,globalTime:frame})>.001)))return frame;
  return null;
}

/** Review metadata comes from the reductions that actually ran. Node/resource
 * dependencies are resolved before renumbering, so unaffected geosets are not
 * reported merely because their numeric references changed. */
export function optimizationReview(model,stage,changes) {
  const dependencies=model.Geosets.map((_,i)=>protectedGeosetData(model,{excludedGeosets:[i]}));
  const geosets=new Map(),other=new Map();
  const entry=index=>{if(!geosets.has(index))geosets.set(index,{index,vertices:0,groups:0,bones:0,keys:0,animations:new Map()});return geosets.get(index);};
  const animation=(row,sequence,from,to,frame,keys=0)=>{
    const found=row.animations.get(sequence),visible=row.index==null?frame:visibleFrame(model,row.index,sequence,from,to,frame);
    if(!found)row.animations.set(sequence,{sequence,from,to,frame:visible??frame,visible:visible!==null,keys});
    else {found.from=Math.min(found.from,from);found.to=Math.max(found.to,to);found.keys+=keys;if(!found.visible&&visible!==null){found.frame=visible;found.visible=true;}}
  };
  for(const change of changes) {
    if(change.geoset!=null){const row=entry(change.geoset);for(const key of ['vertices','groups','bones'])row[key]+=change[key]||0;continue;}
    if(change.kind==='bones') {
      let used=false;
      dependencies.forEach((d,i)=>{const count=change.nodes.filter(id=>d.nodes.has(id)).length;if(count){entry(i).bones+=count;used=true;}});
      if(!used)other.set('bones',{label:`${change.nodes.length} equivalent unused bones`,keys:0,animations:new Map()});
      continue;
    }
    const [collection,index]=change.path,owner=model[collection]?.[index];
    const affected=dependencies.flatMap((d,i)=>d.nodes.has(owner?.ObjectId)||collection==='GeosetAnims'&&owner.GeosetId===i||collection==='Materials'&&d.materials.has(Number(index))||collection==='TextureAnims'&&d.textureAnims.has(Number(index))?[i]:[]);
    const add=row=>{row.keys++;animation(row,change.sequence,change.from,change.to,change.frame,1);};
    if(affected.length)for(const i of affected)add(entry(i));
    else {const label=`${owner?.Name||`${collection} ${Number(index)+1}`} · ${change.path.at(-1)}`;if(!other.has(label))other.set(label,{label,keys:0,animations:new Map()});add(other.get(label));}
  }
  if(stage==='duplicates')for(const row of geosets.values())for(let sequence=0;sequence<model.Sequences.length;sequence++){
    const [from,to]=model.Sequences[sequence].Interval,frame=visibleFrame(model,row.index,sequence,from,to);
    if(frame!==null)animation(row,sequence,from,to,frame);
  }
  const finish=row=>({...row,animations:[...row.animations.values()].sort((a,b)=>a.sequence-b.sequence)});
  return {geosets:[...geosets.values()].sort((a,b)=>a.index-b.index).map(finish),other:[...other.values()].map(finish)};
}
