import { openDocument, validateModel, createNode, NODE_TYPES } from './editor-document.js';
import { resources, assertRoundTripFields } from './model-optimizer.js';
import { allNodes, sampleTrack } from './animation.js';
import { mergeDuplicateVertices, removeUnusedVertices, reducePolygons } from './optimizexl-geometry.js';
import { protectedGeosetData } from './optimizexl-exclusions.js';
import { commonEndpointProposals, applyCommonEndpointPose } from './optimizexl-endpoints.js';
import { optimizationReview } from './optimizexl-review.js';
import { reduceAnimationTrack } from './optimizexl-animation.js';
import { boundsProposals, repairBounds } from './optimizexl-bounds.js';
import { repairMotionIrregularity, scanIrregularMotion } from './optimizexl-motion.js';
import { repairSuspiciousSnap, scanSuspiciousSnaps } from './optimizexl-snaps.js';
import { repairContextMotion, scanModelMotionContext } from './optimizexl-motion-context.js';
import { openingTrackProposals, applyOpeningTrack } from './optimizexl-opening-tracks.js';
import { unusedTrackProposals, applyUnusedTrack } from './optimizexl-unused-tracks.js';
import { effectVisibilityProposals } from './optimizexl-effect-visibility.js';
import { redundantTrackProposals, applyRedundantTrack } from './optimizexl-redundant-tracks.js';
import { splineTrackProposals, applySplineTrack } from './optimizexl-spline-tracks.js';

export const STAGES = [
  {id:'duplicates',name:'Duplicate data'}, {id:'animation',name:'Animation optimization'},
  {id:'unused',name:'Unused data'}, {id:'sanity',name:'Insanity FIxer'},
  {id:'irregularities',name:'Irregularities Fixer'}, {id:'spheres',name:'Sphereomancer'},
  {id:'nuclear',name:'Nuclear Polygon Destroyer'},
];
export const SPHERE_PRESETS = [
  {name:'Small unit',spheres:[[0,0,24,24]],source:'Scaled from the Hive basic-unit starting sphere.'},
  {name:'Standard unit',spheres:[[5.257450103759766,0,63.22100067138672,38.07600021362305],[3.239419937133789,0,22.847400665283203,38.07600021362305]],source:'Footman: two radius-38.076 collision spheres, matching its authored centers.'},
  {name:'Large unit',spheres:[[0,0,60,60]],source:'Hive collision-shape tutorial: radius 60 example.'},
  {name:'Tall unit',spheres:[[0,0,60,60],[0,0,140,60]],source:'Hive collision-shape tutorial: two radius-60 spheres, upper Z 140.'},
  {name:'Mounted rider',spheres:[[0,0,45,55],[35,0,95,55],[-15,0,75,55]],source:'The reviewed Khorne rider: three radius-55 spheres.'},
];
const collections = Object.values(NODE_TYPES).map(([key])=>key);
const sections = ['Info','Sequences','Geosets','GeosetAnims','Materials','Textures','TextureAnims','GlobalSequences','PivotPoints',...collections];
const json=x=>JSON.stringify(x,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
const same=(a,b)=>json(a)===json(b);
const local=t=>t?.Keys && (t.GlobalSeqId==null||t.GlobalSeqId===-1||t.GlobalSeqId===0xffffffff);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number(v)||0));
export const triangleCount=m=>m.Geosets.reduce((n,g)=>n+g.Faces.length/3,0);
export function dimensions(m){const points=m.Geosets.flatMap(g=>Array.from(g.Vertices));const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];points.forEach((v,i)=>{lo[i%3]=Math.min(lo[i%3],v);hi[i%3]=Math.max(hi[i%3],v);});return Math.max(1,...hi.map((v,i)=>v-lo[i]).filter(Number.isFinite));}
export function simpleSettings(stage,strength,m){const s=clamp(strength,0,100)/100,d=dimensions(m);switch(stage){
 case 'duplicates':return {position:d*.005*s*s,uv:.01*s*s,normal:10*s*s,bones:true};
 case 'animation':return {position:d*.005*s*s,rotation:3*s*s,scale:.02*s*s};
 case 'unused':return {vertices:true,resources:true,nodes:true};
 case 'spheres':return {preset:1,size:1,spheres:SPHERE_PRESETS[1].spheres};
 case 'nuclear':return {target:Math.round(triangleCount(m)*(1-.98*s)),error:.2*s*s,normalLimit:45,protectNormals:true,protectSeams:true,protectSkin:true};
 default:return {};
}}
function supported(doc){
 if(doc.readOnly||doc.model.Version!==800)throw Error('OptimizeXL currently supports editable Classic/SD MDL and MDX 800 models.');
 if(doc._unknownSections().length)throw Error('Unknown model sections must be resolved before optimization.');
 if(doc.model.BindPoses?.length||doc.model.Gliders?.length||doc.model.Geosets.some(g=>g.SkinWeights?.length||g.Tangents?.length))throw Error('Additional skin/bind-pose data is not supported by this Classic optimizer.');
 if(doc._container?.trailingBytes?.length)throw Error('Trailing model data cannot be safely optimized.');
}
export function prepareOptimizeXL(doc){supported(doc);const bytes=doc.serialize('mdx');const reopened=openDocument(bytes,'before.mdx');supported(reopened);return bytes;}
function rebuildNodes(m){m.Nodes=[];for(const n of collections.flatMap(k=>m[k]||[])){m.Nodes[n.ObjectId]=n;n.PivotPoint=m.PivotPoints[n.ObjectId];}}
function remapNodes(m,removed,replacements=new Map()){
 const old=allNodes(m).filter(n=>!removed.has(n.ObjectId)),map=new Map(old.map((n,i)=>[n.ObjectId,i]));
 for(const [id,target]of replacements)map.set(id,map.get(target));
 const pivots=old.map(n=>new Float32Array(n.PivotPoint||m.PivotPoints[n.ObjectId]||[0,0,0]));
 for(const key of collections)m[key]=(m[key]||[]).filter(n=>!removed.has(n.ObjectId));
 for(const n of old){n.ObjectId=map.get(n.ObjectId);n.Parent=n.Parent==null?null:map.get(n.Parent);}
 for(const g of m.Geosets)g.Groups=g.Groups.map(group=>group.map(id=>map.get(id)));
 m.PivotPoints=pivots;rebuildNodes(m);
}
function duplicateBones(m,settings,changes){
 const protectedNodes=protectedGeosetData(m,settings).nodes;
 const parents=new Set(allNodes(m).map(n=>n.Parent)),removed=new Set(),map=new Map(),known=new Map();
 for(const n of m.Bones){if(parents.has(n.ObjectId)||protectedNodes.has(n.ObjectId))continue;const {Name,ObjectId,...rest}=n,key=json(rest);if(known.has(key)){removed.add(ObjectId);map.set(ObjectId,known.get(key));}else known.set(key,ObjectId);}
 if(removed.size){changes.push({kind:'bones',nodes:[...removed]});remapNodes(m,removed,map);}return removed.size;
}
function unusedNodes(m,changes){const used=new Set(m.Geosets.flatMap(g=>g.Groups.flat()));const nodes=allNodes(m),byId=new Map(nodes.map(n=>[n.ObjectId,n]));for(const k of collections)if(!['Bones','Helpers'].includes(k))for(const n of m[k]||[])used.add(n.ObjectId);for(const n of [...m.Bones,...m.Helpers])if(n.GeosetId!=null||n.GeosetAnimId!=null)used.add(n.ObjectId);
 for(const id of [...used]){let n=byId.get(id),seen=new Set();while(n&&n.Parent!=null&&!seen.has(n.Parent)){seen.add(n.Parent);used.add(n.Parent);n=byId.get(n.Parent);}}
 const removed=new Set([...m.Bones,...m.Helpers].filter(n=>!used.has(n.ObjectId)).map(n=>n.ObjectId));for(const n of nodes)if(removed.has(n.ObjectId))changes.push({label:`${m.Bones.includes(n)?'Bone':'Helper'}: ${n.Name||n.ObjectId}`});if(removed.size)remapNodes(m,removed);return removed.size;}
function unusedGlobals(m,changes){const owners=[...tracks(m).map(t=>t.track),...m.EventObjects],used=new Set(owners.map(t=>t.GlobalSeqId).filter(id=>Number.isInteger(id)&&id>=0&&id<m.GlobalSequences.length)),map=new Map(),kept=[];m.GlobalSequences.forEach((duration,id)=>{if(used.has(id)){map.set(id,kept.length);kept.push(duration);}else changes.push({label:`Global sequence ${id+1}`});});const removed=m.GlobalSequences.length-kept.length;for(const t of owners)if(map.has(t.GlobalSeqId))t.GlobalSeqId=map.get(t.GlobalSeqId);m.GlobalSequences=kept;return removed;}
function unusedResources(m,stats,skipped,changes){
 const beforeMaterials=[...m.Materials],beforeTextures=[...m.Textures],counts={materials:0,textures:0,originalMaterials:m.Materials.length};
 resources(m,counts,skipped);Object.assign(stats,counts);
 const materials=new Set(m.Materials),textures=new Set(m.Textures);
 beforeMaterials.forEach((item,i)=>{if(!materials.has(item))changes.push({label:`Material ${i+1}`});});
 beforeTextures.forEach((item,i)=>{if(!textures.has(item))changes.push({label:`Texture ${i+1}${item.Image?`: ${item.Image.split(/[\\/]/).pop()}`:''}`});});
}
function tracks(m){const result=[];function walk(x,p=[]){if(!x||typeof x!=='object'||ArrayBuffer.isView(x))return;if(x.Keys){result.push({track:x,path:p});return;}for(const[k,v]of Object.entries(x))if(k!=='Nodes')walk(v,[...p,k]);}walk(m);return result;}
const defaultValue=p=>p==='Rotation'?[0,0,0,1]:p==='Scaling'?[1,1,1]:p==='Translation'?[0,0,0]:1;
const sample=(m,t,p,si,frame)=>sampleTrack(t,frame,{interval:m.Sequences[si].Interval,globalSequences:m.GlobalSequences,globalTime:0,fallback:defaultValue(p),quaternion:p==='Rotation'});
function trackError(a,b,rotation){if(rotation){const norm=v=>Math.hypot(...v);const dot=Math.abs(a.reduce((s,v,i)=>s+v*b[i],0)/(norm(a)*norm(b)||1));return 2*Math.acos(Math.min(1,dot))*180/Math.PI;}return Math.hypot(...a.map((v,i)=>v-b[i]));}
function animationReduction(m,settings,changes){const protectedData=protectedGeosetData(m,settings);let removed=0;for(const {track:t,path}of tracks(m)){
 const [collection,index]=path;
 if(collections.includes(collection)&&protectedData.nodes.has(m[collection][index].ObjectId)||collection==='GeosetAnims'&&protectedData.geosets.has(m.GeosetAnims[index].GeosetId)||collection==='Materials'&&protectedData.materials.has(Number(index))||collection==='TextureAnims'&&protectedData.textureAnims.has(Number(index)))continue;
 const p=path.at(-1),transform=['Translation','Rotation','Scaling'].includes(p);
 const tolerance=transform?settings[p==='Translation'?'position':p==='Rotation'?'rotation':'scale']||0:0;
 removed+=reduceAnimationTrack(m,t,p,tolerance,change=>changes.push({path,...change}));
 }return removed;}
function setKey(t,frame,value){const i=t.Keys.findIndex(k=>k.Frame===frame),key={Frame:frame,Vector:new Float32Array(Array.isArray(value)||ArrayBuffer.isView(value)?value:[value])};if(i>=0)t.Keys[i]=key;else t.Keys.push(key);t.Keys.sort((a,b)=>a.Frame-b.Frame);}
function hideGeoset(m,gi,si){let a=m.GeosetAnims.find(a=>a.GeosetId===gi);if(!a){a={GeosetId:gi,Flags:0,Alpha:1,Color:new Float32Array([1,1,1])};m.GeosetAnims.push(a);}const existing=a.Alpha;let t=local(existing)?existing:null;if(!t){if(existing?.Keys)throw Error('Global visibility cannot be changed for only one sequence.');const value=typeof existing==='number'?existing:1;t={LineType:0,GlobalSeqId:null,Keys:[]};for(const s of m.Sequences){setKey(t,s.Interval[0],value);setKey(t,s.Interval[1],value);}a.Alpha=t;}
 const [lo,hi]=m.Sequences[si].Interval;for(const k of t.Keys)if(k.Frame>=lo&&k.Frame<=hi)k.Vector[0]=0;setKey(t,lo,0);setKey(t,hi,0);}
function alpha(m,gi,si,f){const a=m.GeosetAnims.find(a=>a.GeosetId===gi);return sampleTrack(a?.Alpha,f,{interval:m.Sequences[si].Interval,globalSequences:m.GlobalSequences,globalTime:0,fallback:1});}
function allVisible(m,gi,si){const s=m.Sequences[si];return [s.Interval[0],(s.Interval[0]+s.Interval[1])/2,s.Interval[1]].some(f=>alpha(m,gi,si,f)>.001);}
const seqName=s=>s.Name.toLowerCase().replace(/[^a-z]+/g,' ').trim();
export function findIrregularities(m){const findings=[],seq=m.Sequences,live=seq.map((s,i)=>({s,i})).filter(({s})=>/^(stand|walk|attack)( |$)/.test(seqName(s))),portraits=seq.map((s,i)=>({s,i})).filter(({s})=>/^portrait/.test(seqName(s))),bone=seq.findIndex(s=>seqName(s)==='decay bone'),flesh=seq.findIndex(s=>seqName(s)==='decay flesh'),death=seq.findIndex(s=>seqName(s)==='death');
 findings.push(...scanIrregularMotion(m));
 for(let gi=0;gi<m.Geosets.length;gi++){
  const a=m.GeosetAnims.find(a=>a.GeosetId===gi),t=a?.Alpha;if(t?.Keys&&!local(t))continue;
  const visible=live.filter(({i})=>allVisible(m,gi,i));
  if(live.length>=3&&visible.length>0&&visible.length<=Math.max(1,Math.floor(live.length/4))){const portrait=portraits.some(({i})=>allVisible(m,gi,i)),corpse=bone>=0&&allVisible(m,gi,bone);if(portrait||corpse)for(const {i,s}of visible)findings.push({id:`visibility:${gi}:${i}`,kind:'hide',geoset:gi,sequence:i,frame:s.Interval[0],label:`Geoset ${gi+1} appears in ${s.Name}`,detail:`Visible in only ${visible.length} of ${live.length} living animations and also in ${corpse?'Decay Bone':'Portrait'}. Review whether it belongs here.`});}
  if(bone>=0&&flesh>=0&&allVisible(m,gi,bone)&&alpha(m,gi,flesh,seq[flesh].Interval[1])<.001&&visible.length>=Math.max(2,live.length/2))findings.push({id:`decay:${gi}`,kind:'hide',geoset:gi,sequence:bone,frame:seq[bone].Interval[0],label:`Geoset ${gi+1} reappears in Decay Bone`,detail:'A living body part disappears by the end of Decay Flesh, then becomes visible again.'});
 }
 const addPose=(from,to,fromFrame,toFrame,label)=>{const diffs=[];for(const n of allNodes(m))for(const p of ['Translation','Rotation','Scaling']){const t=n[p];if(!local(t)||![0,1].includes(t.LineType))continue;const a=sample(m,t,p,from,fromFrame),b=sample(m,t,p,to,toFrame);if(trackError(a,b,p==='Rotation')>(p==='Rotation'?.5:.05))diffs.push({node:n.ObjectId,property:p});}if(diffs.length)findings.push({id:`pose:${from}:${fromFrame}:${to}:${toFrame}`,kind:'pose',from,sequence:to,fromFrame,frame:toFrame,label,detail:`${diffs.length} transform channels differ. Copy the reference pose to this endpoint after reviewing the preview.`,channels:diffs});};
 if(death>=0&&flesh>=0)addPose(death,flesh,seq[death].Interval[1],seq[flesh].Interval[0],'Death → Decay Flesh pose mismatch');
 const common=commonEndpointProposals(m);findings.push(...common);
 for(let si=0;si<seq.length;si++)if(!common.some(f=>f.sequence===si)&&!seq[si].NonLooping&&/^(stand|walk|portrait)( |$)/.test(seqName(seq[si])))addPose(si,si,seq[si].Interval[0],seq[si].Interval[1],`${seq[si].Name}: loop endpoints differ`);
 // Dissipate is inferred only when most animated roots travel substantially
 // while a small, separately rooted visible component remains stationary.
 const dissipate=seq.findIndex(s=>seqName(s)==='dissipate');if(dissipate>=0){const [lo,hi]=seq[dissipate].Interval,nodes=allNodes(m),byId=new Map(nodes.map(n=>[n.ObjectId,n]));const root=id=>{let n=byId.get(id),seen=new Set();while(n?.Parent!=null&&!seen.has(n.Parent)){seen.add(n.Parent);n=byId.get(n.Parent);}return n;};const motion=gi=>Math.max(0,...m.Geosets[gi].Groups.flat().map(id=>{const n=root(id);return n?trackError(sample(m,n.Translation,'Translation',dissipate,lo),sample(m,n.Translation,'Translation',dissipate,hi),false):0;}));const vis=m.Geosets.map((_,gi)=>gi).filter(gi=>allVisible(m,gi,dissipate)),moving=vis.filter(gi=>motion(gi)>dimensions(m)*.15);if(moving.length>vis.length*.75)for(const gi of vis)if(motion(gi)<.01)findings.push({id:`dissipate:${gi}`,kind:'hide',geoset:gi,sequence:dissipate,frame:hi,label:`Geoset ${gi+1} remains behind during Dissipate`,detail:'Most visible geometry travels away, but this separately rooted component stays still. Proposed correction hides this component in Dissipate.'});}
 findings.push(...scanSuspiciousSnaps(m,findings.filter(f=>f.kind==='motion')));
 const context=scanModelMotionContext(m,findings.filter(f=>f.kind==='motion'||f.kind==='snap'));
 return [...findings.map(f=>context.review.has(f.id)?{...f,motionContext:context.review.get(f.id)}:f),...context.findings,...effectVisibilityProposals(m)];
}
export function sanityProposals(m){const findings=boundsProposals(m);for(const [i,e]of m.ParticleEmitters2.entries())if(e.Gravity?.Keys)findings.push({id:`gravity:${i}`,kind:'gravity',emitter:i,value:e.Gravity.Keys[0]?.Vector[0]||0,sequence:0,frame:m.Sequences[0]?.Interval[0]||0,label:`${e.Name}: animated gravity`,detail:'Hive flags animated gravity. Choose a static value and review its particle motion.'});
 for(const {track:t,path}of tracks(m)){if(t.GlobalSeqId>=0&&m.GlobalSequences[t.GlobalSeqId]>0&&t.Keys.some(k=>k.Frame>m.GlobalSequences[t.GlobalSeqId])&&t.Keys.some(k=>k.Frame<=m.GlobalSequences[t.GlobalSeqId]))findings.push({id:`outside:${path.join('.')}`,kind:'globalKeys',path,sequence:0,frame:m.Sequences[0]?.Interval[0]||0,label:`${path.join('.')}: keys beyond global duration`,detail:'Remove keys outside the declared global sequence. Review effects and animation before approval.'});}
 const proposals=[...findings,...openingTrackProposals(m,tracks(m)),...unusedTrackProposals(m,tracks(m)),...redundantTrackProposals(m,tracks(m))];
 // Static gravity replaces its entire track. It owns that track's diagnostics;
 // do not also queue key-level corrections against data it removes.
 const owned=proposals.filter(p=>!p.path||!findings.some(owner=>owner.kind==='gravity'&&p.path.join('.')===`ParticleEmitters2.${owner.emitter}.Gravity`));
 return [...owned,...splineTrackProposals(m,tracks(m),owned)];}
function applyRepair(m,fix,settings,evidenceModel=m){
 if(!fix)return;
 if(fix.kind==='batch'){
  if(!['sanity','irregularities'].includes(fix.stage)||!fix.entries?.length)throw Error('Select at least one fix to preview.');
  const baseline=structuredClone(m),catalog=fix.stage==='sanity'?sanityProposals(baseline):findIrregularities(baseline);
  const selected=new Map();for(const entry of fix.entries){const actual=catalog.find(f=>f.id===entry.fix?.id);if(!actual||!same(actual,entry.fix))throw Error('A selected finding changed. Select the fixes again.');if(selected.has(actual.id))throw Error('A fix was selected twice.');selected.set(actual.id,entry);}
  // Validate every finding against the same snapshot, then apply in the normal
  // stage order. A new snap repair can refine an existing curve repair without
  // invalidating its original evidence or silently dropping selected work.
  for(const f of catalog)if(selected.has(f.id)){const entry=selected.get(f.id);applyRepair(m,entry.fix,entry.settings||{},baseline);}
  return;
 }
 if(fix.kind==='motion'){repairMotionIrregularity(m,fix,evidenceModel);return;}
 if(fix.kind==='snap'){repairSuspiciousSnap(m,fix,evidenceModel);return;}
 if(fix.kind==='motionContext'){repairContextMotion(m,fix,evidenceModel);return;}
 if(fix.kind==='openingTrack'){
  const current=openingTrackProposals(evidenceModel,tracks(evidenceModel)).find(f=>f.id===fix.id);
  if(!current||!same(current,fix))throw Error('This opening-track finding changed. Select it again.');
  applyOpeningTrack(m,current);return;
 }
 if(fix.kind==='unusedLocalKeys'){
  const current=unusedTrackProposals(evidenceModel,tracks(evidenceModel)).find(f=>f.id===fix.id);
  if(!current||!same(current,fix))throw Error('This unused-key finding changed. Select it again.');
  applyUnusedTrack(m,current);return;
 }
 if(fix.kind==='redundantTracks'){
  const current=redundantTrackProposals(evidenceModel,tracks(evidenceModel)).find(f=>f.id===fix.id);
  if(!current||current.inspectionOnly||!same(current,fix))throw Error('This redundant-key finding changed or needs manual review. Select it again.');
  applyRedundantTrack(m,current);return;
 }
 if(fix.kind==='splineResample'){
  const current=sanityProposals(evidenceModel).find(f=>f.id===fix.id);
  if(!current||!same(current,fix))throw Error('This spline finding changed. Select it again.');
  // Resampling owns the complete track, so key-level writes cannot coexist.
  if(!same(tracks(m).find(t=>t.path.join('.')===fix.path.join('.'))?.track,
      tracks(evidenceModel).find(t=>t.path.join('.')===fix.path.join('.'))?.track))throw Error('This spline track has another selected correction. Approve it first and rescan.');
  applySplineTrack(m,current);return;
 }
 if(fix.kind==='effectVisibility'){
  const current=effectVisibilityProposals(evidenceModel).find(f=>f.id===fix.id);
  if(!current||current.inspectionOnly||!same(current,fix))throw Error('This visibility finding changed. Select it again.');
  hideGeoset(m,current.geoset,current.sequence);return;
 }
 if(fix.kind==='gravity'){
  const emitter=m.ParticleEmitters2[fix.emitter];emitter.Gravity=Number(settings.gravity??fix.value);
  // The animated field's separate MDX base ceases to exist when it is static.
  if(emitter._MdxDefaults){delete emitter._MdxDefaults.Gravity;if(!Object.keys(emitter._MdxDefaults).length)delete emitter._MdxDefaults;}
  return;
 }
 if(fix.kind==='bounds'){repairBounds(m,fix);return;}if(fix.kind==='commonPose'){applyCommonEndpointPose(m,fix);return;}switch(fix.kind){case'hide':hideGeoset(m,fix.geoset,fix.sequence);break;case'globalKeys':{let t=m;for(const p of fix.path)t=t[p];t.Keys=t.Keys.filter(k=>k.Frame<=m.GlobalSequences[t.GlobalSeqId]);break;}case'pose':{const source=settings.reverse?fix.sequence:fix.from,sourceFrame=settings.reverse?fix.frame:fix.fromFrame,target=settings.reverse?fix.from:fix.sequence,targetFrame=settings.reverse?fix.fromFrame:fix.frame;for(const n of allNodes(m))for(const p of ['Translation','Rotation','Scaling']){const t=n[p];if(!local(t)||![0,1].includes(t.LineType))continue;const value=sample(m,t,p,source,sourceFrame),before=sample(m,t,p,target,targetFrame);if(same(value,before))continue;const interval=m.Sequences[target].Interval,keys=t.Keys.filter(k=>k.Frame>=interval[0]&&k.Frame<=interval[1]);setKey(t,targetFrame,value);if(keys.length<=1)setKey(t,targetFrame===interval[0]?interval[1]:interval[0],value);}}break;}}
function spheres(m,settings){const chosen=settings.spheres||SPHERE_PRESETS[settings.preset||0].spheres,size=clamp(settings.size??1,.01,20),old=m.CollisionShapes;
 if(allNodes(m).some(n=>!old.includes(n)&&old.some(c=>c.ObjectId===n.Parent)))throw Error('A collision shape has non-collision child nodes; adjust that hierarchy before replacing spheres.');
 for(let i=0;i<chosen.length;i++){const [x,y,z,r]=chosen[i];if(![x,y,z,r].every(Number.isFinite)||r<=0)throw Error('Sphere coordinates must be finite and radius must be positive.');let n=old[i];if(!n)n=createNode(m,'CollisionShape');Object.assign(n,{Shape:2,Name:`OptimizeXL Sphere ${i+1}`,Parent:null,Vertices:new Float32Array([x*size,y*size,z*size]),BoundsRadius:r*size});for(const k of ['Translation','Rotation','Scaling'])delete n[k];}
 const removed=new Set(m.CollisionShapes.slice(chosen.length).map(n=>n.ObjectId));if(removed.size)remapNodes(m,removed);rebuildNodes(m);
}
export function runOptimizeStage(bytes,stage,settings={},fix=null){const doc=openDocument(new Uint8Array(bytes),'working.mdx');supported(doc);const baseline=validateModel(doc.model).filter(d=>d.severity==='error').map(d=>d.code+':'+d.path),stats={},skipped=new Set(),changes=[],reviewBase=['duplicates','animation','unused'].includes(stage)?structuredClone(doc.model):null;
 doc.apply('OptimizeXL '+stage,sections,m=>{switch(stage){case'duplicates':if(settings.bones)stats.duplicateBones=duplicateBones(m,settings,changes);Object.assign(stats,mergeDuplicateVertices(m,settings,change=>changes.push(change)));break;case'animation':stats.keys=animationReduction(m,settings,changes);break;case'unused':if(settings.vertices)stats.vertices=removeUnusedVertices(m,settings,change=>changes.push(change));if(settings.resources)unusedResources(m,stats,skipped,changes);if(settings.nodes)stats.nodes=unusedNodes(m,changes);if(settings.resources)stats.globalSequences=unusedGlobals(m,changes);break;case'sanity':case'irregularities':applyRepair(m,fix,settings);break;case'spheres':spheres(m,settings);stats.spheres=m.CollisionShapes.length;break;case'nuclear':Object.assign(stats,reducePolygons(m,settings));break;default:throw Error('Unknown OptimizeXL stage.');}});
 const after=doc.serialize('mdx'),reopened=openDocument(after,'after.mdx');if(reopened.readOnly)throw Error('The candidate could not be reopened.');const errors=validateModel(reopened.model).filter(d=>d.severity==='error'&&!baseline.includes(d.code+':'+d.path));if(errors.length)throw Error(errors[0].message);
 assertRoundTripFields(doc.model,reopened.model);
 if(!same(doc.model.Sequences,reopened.model.Sequences)||triangleCount(doc.model)!==triangleCount(reopened.model))throw Error('Candidate changed during save verification.');
 const changed=bytes.byteLength!==after.byteLength||new Uint8Array(after).some((value,i)=>value!==bytes[i]);
 return {bytes:new Uint8Array(after),changed,review:reviewBase?optimizationReview(reviewBase,stage,changes):null,beforeBytes:bytes.byteLength,afterBytes:after.byteLength,saved:bytes.byteLength-after.byteLength,stats,skipped:[...skipped],triangles:triangleCount(reopened.model)};
}
