import { Buffer } from 'buffer';
import { parseMdx } from './mdx-container.js';
import { mdxChunk, mdxRecords } from './mdx-compatibility.js';
import { mdlMembers } from './mdl-compatibility.js';

const fingerprint = value => JSON.stringify(value,(key,v)=>key==='PivotPoint'?undefined:ArrayBuffer.isView(v)?Array.from(v):typeof v==='number'&&!Number.isFinite(v)?String(v):v);
const recordTags = new Set(['SEQS','TEXS','MTLS','TXAN','GEOS','GEOA','BONE','HELP','ATCH','LITE','PREM','PRE2','RIBB','CORN','CAMS','CLID','EVTS','PIVT','GLBS']);
function matches(before,after) {
  const pool=new Map();
  before.forEach((v,i)=>{const f=fingerprint(v);if(!pool.has(f))pool.set(f,[]);pool.get(f).push(i);});
  return after.map(v=>pool.get(fingerprint(v))?.shift());
}

/** Retain untouched siblings, including padding and authored track order. */
export function preserveMdxRecords(original,generated,before,after,sections) {
  const oldBytes=Buffer.from(original),newBytes=Buffer.from(generated),oldChunks=new Map(parseMdx(oldBytes).chunks.map(c=>[c.tag,c]));
  const keys=new Map(Object.entries(sections).map(([key,[,tag]])=>[tag,key]));
  return Buffer.concat([Buffer.from('MDLX'),...parseMdx(newBytes).chunks.map(c=>{
    const key=keys.get(c.tag),old=oldChunks.get(c.tag),payload=newBytes.subarray(c.payloadOffset,c.payloadOffset+c.declaredSize);
    if(!recordTags.has(c.tag)||!old||!Array.isArray(before[key])||!Array.isArray(after[key]))return mdxChunk(c.tag,payload);
    const previous=mdxRecords(oldBytes.subarray(old.payloadOffset,old.payloadOffset+old.declaredSize),c.tag),fresh=mdxRecords(payload,c.tag),indices=matches(before[key],after[key]);
    if(previous.length!==before[key].length||fresh.length!==after[key].length)throw new Error(`Cannot match ${c.tag} source records safely.`);
    return mdxChunk(c.tag,Buffer.concat(fresh.map((b,i)=>indices[i]===undefined?b:previous[indices[i]])));
  })]);
}

const containers={Sequences:'Anim',Textures:'Bitmap',Materials:'Material',TextureAnims:'TVertexAnim'};
export function preserveMdlRecords(original,generated,before,after,sections) {
  const oldTree=mdlMembers(original),newTree=mdlMembers(generated),edits=[];
  for(const [key,[name]]of Object.entries(sections)) {
    if(!Array.isArray(before[key])||!Array.isArray(after[key])||['PivotPoints','GlobalSequences','BindPoses'].includes(key))continue;
    const collect=tree=>tree.members.filter(m=>m.name===name).flatMap(m=>containers[name]?(m.children||[]).filter(c=>c.name===containers[name]):[m]);
    const previous=collect(oldTree),fresh=collect(newTree),indices=matches(before[key],after[key]);
    if(previous.length!==before[key].length||fresh.length!==after[key].length)continue;
    fresh.forEach((m,i)=>{if(indices[i]!==undefined){const old=previous[indices[i]];edits.push({start:m.start,end:m.end,bytes:oldTree.bytes.subarray(old.start,old.end)});}});
  }
  const parts=[];let p=0;for(const e of edits.sort((a,b)=>a.start-b.start)){parts.push(newTree.bytes.subarray(p,e.start),e.bytes);p=e.end;}parts.push(newTree.bytes.subarray(p));return Buffer.concat(parts);
}
