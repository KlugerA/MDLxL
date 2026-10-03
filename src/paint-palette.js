const hex=rgb=>'#'+rgb.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
/** Retain the chosen midtone, with warm shadows and pale highlights. */
export function relatedPaintColors(color){
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  if(rgb.some(v=>!Number.isFinite(v)))return [];
  const shadow=rgb.map((v,i)=>v*[.27,.20,.16][i]),light=[255,253,240];
  return [0,.28,.55,.8].map(t=>hex(mix(shadow,rgb,t))).concat(color.toLowerCase(),[.3,.58,.8,.95].map(t=>hex(mix(rgb,light,t))));
}
export function paintRampColor(colors,value){
  const p=Math.max(0,Math.min(1,value))*(colors.length-1),i=Math.floor(p),rgb=c=>[1,3,5].map(k=>parseInt(c.slice(k,k+2),16));
  return hex(mix(rgb(colors[i]),rgb(colors[Math.min(i+1,colors.length-1)]),p-i));
}
