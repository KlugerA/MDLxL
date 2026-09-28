import { allNodes, sampleTrack } from './animation.js';
import { protectedGeosetData } from './optimizexl-exclusions.js';

const properties=['Translation','Rotation','Scaling'];
const local=t=>t?.Keys&&(t.GlobalSeqId==null||t.GlobalSeqId===-1||t.GlobalSeqId===0xffffffff);
const fallback=p=>p==='Rotation'?[0,0,0,1]:p==='Scaling'?[1,1,1]:[0,0,0];
const value=(m,n,p,sequence,frame)=>Array.from(sampleTrack(n[p],frame,{interval:m.Sequences[sequence].Interval,globalSequences:m.GlobalSequences,globalTime:0,fallback:fallback(p),quaternion:p==='Rotation'}));
const error=(a,b,p)=>a.every((v,i)=>v===b[i])||p==='Rotation'&&a.every((v,i)=>v===-b[i])?0:p==='Rotation'?2*Math.acos(Math.min(1,Math.abs(a.reduce((sum,v,i)=>sum+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)||1))))*180/Math.PI:Math.hypot(...a.map((v,i)=>v-b[i]));
const name=s=>s.Name.toLowerCase().replace(/[^a-z]+/g,' ').trim();
const eligible=s=>/^(attack|death)( |$)/.test(name(s))||/^stand ready( |$)/.test(name(s));

/** Infer a reference from repeated complete rig poses, not a privileged name.
 * Only Death's first frame votes. An attack/ready proposal repairs both ends
 * together, preserving every interior key and the independent effect tracks. */
export function commonEndpointProposals(m) {
  const rig=protectedGeosetData(m,{excludedGeosets:m.Geosets.map((_,i)=>i)}).nodes;
  const channels=allNodes(m).filter(n=>rig.has(n.ObjectId)).flatMap(n=>properties.filter(p=>local(n[p])).map(p=>({node:n.ObjectId,property:p,n})));
  const endpoints=m.Sequences.flatMap((s,sequence)=>eligible(s)?[0,...(/^death( |$)/.test(name(s))?[]:[1])].map(end=>({sequence,end,frame:s.Interval[end],pose:channels.map(c=>value(m,c.n,c.property,sequence,s.Interval[end]))})):[]);
  if(!channels.length||endpoints.length<3)return [];
  const distance=(a,b)=>channels.map((c,i)=>error(a.pose[i],b.pose[i],c.property)/(c.property==='Rotation'?.5:.05));
  const ranked=endpoints.map(reference=>{const members=endpoints.filter(e=>distance(e,reference).every(v=>v<=1));return {reference,members,cost:members.reduce((sum,e)=>sum+distance(e,reference).reduce((n,v)=>n+v*v,0),0)};}).sort((a,b)=>b.members.length-a.members.length||a.cost-b.cost||a.reference.sequence-b.reference.sequence||a.reference.end-b.reference.end);
  const winner=ranked[0],support=[...new Set(winner.members.map(e=>e.sequence))];
  if(winner.members.length<=endpoints.length/2||support.length<2)return [];
  const reference=winner.reference,findings=[];
  for(const sequence of new Set(endpoints.map(e=>e.sequence))) {
    const targets=endpoints.filter(e=>e.sequence===sequence);
    if(m.Sequences.some((s,i)=>i!==sequence&&s.Interval[0]<=m.Sequences[sequence].Interval[1]&&s.Interval[1]>=m.Sequences[sequence].Interval[0]))continue;
    if(targets.every(e=>distance(e,reference).every(v=>v<=1)))continue;
    const changed=channels.filter((c,i)=>targets.some(e=>error(e.pose[i],reference.pose[i],c.property)>1e-6));
    // Do not advertise a complete endpoint correction when a differing spline
    // channel cannot be edited by this optimizer's linear/step repair.
    if(changed.some(c=>![0,1].includes(c.n[c.property].LineType)))continue;
    const frames=targets.map(e=>e.frame),s=m.Sequences[sequence];
    findings.push({id:`common-pose:${sequence}`,kind:'commonPose',sequence,frame:frames[0],frames,
      from:reference.sequence,fromFrame:reference.frame,support,
      channels:changed.map(c=>({node:c.node,property:c.property})),
      label:`${s.Name}: match common ${frames.length===2?'first/last pose':'first pose'}`,
      detail:`${support.map(i=>m.Sequences[i].Name).join(', ')} agree on the reference pose. Set ${frames.length===2?'both first and last frames':'the first frame only'} of ${s.Name} to that pose. Interior keys${frames.length===1?' and the final Death pose':''} stay unchanged.`});
  }
  return findings;
}

export function applyCommonEndpointPose(m,fix) {
  const nodes=new Map(allNodes(m).map(n=>[n.ObjectId,n])),interval=m.Sequences[fix.sequence].Interval;
  for(const {node,property}of fix.channels) {
    const n=nodes.get(node),t=n?.[property];
    if(!local(t)||![0,1].includes(t.LineType))throw Error('The common endpoint repair no longer matches this model.');
    const reference=value(m,n,property,fix.from,fix.fromFrame);
    const untouchedEnds=Array.from(interval).filter(f=>!fix.frames.includes(f)).map(frame=>({frame,vector:value(m,n,property,fix.sequence,frame)}));
    const set=(frame,vector)=>{const existing=t.Keys.find(k=>k.Frame===frame);if(existing)existing.Vector=new Float32Array(vector);else t.Keys.push({Frame:frame,Vector:new Float32Array(vector)});};
    for(const frame of fix.frames)set(frame,reference);
    t.Keys.sort((a,b)=>a.Frame-b.Frame);
    // A newly inserted first key must not change a formerly implicit last pose.
    for(const {frame,vector}of untouchedEnds)if(error(value(m,n,property,fix.sequence,frame),vector,property)>1e-6)set(frame,vector);
    t.Keys.sort((a,b)=>a.Frame-b.Frame);
  }
}
