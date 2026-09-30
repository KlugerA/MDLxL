import {createNode} from './editor-document.js';
import {Vector3} from 'three';
import {allNodes,sampleTrack} from './animation.js';
import {samplePreviewMatrices} from '../app/preview-pose.js';
const vector=value=>new Float32Array([value]);
/** Inspection samples use the same project pose evaluator as movement handles. */
export function particleSweepPath(model,id,sequence,range,camera,count=65) {
  const node=allNodes(model).find(n=>n.ObjectId===id);if(!node||!range||range[1]<=range[0])return [];
  return Array.from({length:count},(_,i)=>{
    const time=range[0]+(range[1]-range[0])*i/(count-1),matrix=samplePreviewMatrices(model,time,sequence,time,camera).get(id);
    const world=new Vector3().fromArray(node.PivotPoint||[0,0,0]);if(matrix)world.applyMatrix4(matrix);
    return {time,world:world.toArray()};
  });
}
/** Return separate time neighborhoods at a crossing; never choose a distant branch silently. */
export function particleSweepTimes(points,x,y,current) {
  const hits=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.point[0]-a.point[0],dy=b.point[1]-a.point[1],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-a.point[0])*dx+(y-a.point[1])*dy)/length)):0;
    hits.push({time:a.time+(b.time-a.time)*t,distance:Math.hypot(x-a.point[0]-dx*t,y-a.point[1]-dy*t)});
  }
  if(!hits.length)return [];
  const best=Math.min(...hits.map(p=>p.distance)),span=points.at(-1).time-points[0].time;
  const candidates=hits.filter(p=>p.distance<=best+3).sort((a,b)=>Math.abs(a.time-current)-Math.abs(b.time-current));
  const result=[];for(const hit of candidates)if(!result.some(p=>Math.abs(p.time-hit.time)<span/20))result.push(hit);
  return result.slice(0,4);
}
export function setParticleEmissionWindow(node,interval,window) {
  if(Number.isInteger(node.Visibility?.GlobalSeqId)&&node.Visibility.GlobalSeqId>=0)throw Error('Emitting uses a global loop. Edit that loop in Classic before choosing a local emission window.');
  const [start,end]=interval,[from,to]=window.map(Math.round);
  if(from<start||to>end||to<=from)throw Error('Choose an emission window inside this animation.');
  const prior=node.Visibility,keys=prior?.Keys||[];
  if(prior?.LineType>0&&keys.some(k=>k.Frame<start||k.Frame>end))throw Error('Other animations share interpolated visibility. Keep that track and edit its keys in Classic.');
  const outside=keys.filter(k=>k.Frame<start||k.Frame>end).map(k=>structuredClone(k));
  const chosen=new Map([[start,0],[from,1],[to,0]]);
  node.Visibility={...(prior?.Keys?structuredClone(prior):{}),LineType:0,GlobalSeqId:null,Keys:[...outside,...[...chosen].map(([Frame,v])=>({Frame,Vector:vector(v)}))].sort((a,b)=>a.Frame-b.Frame)};
}
export function particleBurstTrack(node,interval,impact,amount) {
  const [start,end]=interval;impact=Math.round(impact);amount=Math.round(amount);
  if(impact<start||impact>=end||!Number.isFinite(amount)||amount<0)throw Error('Choose an impact inside the animation and a non-negative burst amount.');
  const prior=node.EmissionRate;
  if(Number.isInteger(prior?.GlobalSeqId)&&prior.GlobalSeqId>=0)throw Error('Amount uses a global loop. Edit that loop in Classic before creating a local burst.');
  const keys=prior?.Keys||[];
  if(prior?.LineType>0&&keys.some(k=>k.Frame<start||k.Frame>end))throw Error('Other animations share interpolated amount. Keep that track and edit its keys in Classic.');
  const values=new Map([[start,0],[impact,amount],[impact+1,0],[end,0]]);
  return {...(prior?.Keys?structuredClone(prior):{}),LineType:0,GlobalSeqId:null,Keys:[...keys.filter(k=>k.Frame<start||k.Frame>end).map(k=>structuredClone(k)),...[...values].map(([Frame,v])=>({Frame,Vector:vector(v)}))].sort((a,b)=>a.Frame-b.Frame)};
}
export function particleBurstAmount(node,frame,interval,globalSequences=[]) {
  return Number(sampleTrack(node.EmissionRate,frame,{interval,globalSequences,globalTime:frame,fallback:0}));
}

/** Explicit preview-only demonstration wrapper. Never pass this clone to document commands. */
export function addParticleDemonstration(model,range) {
 const roots=allNodes(model).filter(n=>n.Parent==null||n.Parent===-1),wrapper=createNode(model,'Helper');
 wrapper.Name='Preview demonstration';const [a,b]=range;
 // Keep the disposable demonstration above the preview floor, including flat ribbons.
 wrapper.Translation={LineType:1,GlobalSeqId:null,Keys:Array.from({length:17},(_,i)=>{const angle=-Math.PI*.75+i/16*Math.PI*1.5;return {Frame:Math.round(a+(b-a)*i/16),Vector:new Float32Array([80*Math.cos(angle),80*Math.sin(angle),32])};})};
 model.__particleDemoParents=Object.fromEntries(roots.map(n=>[n.ObjectId,wrapper.ObjectId]));
 for(const n of roots)n.Parent=wrapper.ObjectId;
 return wrapper.ObjectId;
}
