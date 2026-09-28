// UTF-16 offsets match textarea selections, including pasted text and line breaks.
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function characterStyles(layer){
  const styles=Array.from({length:String(layer.text||'').length},()=>({}));
  for(const run of layer.runs||[])for(let i=Math.max(0,run.start);i<Math.min(styles.length,run.end);i++)styles[i]={...run.style};
  return styles;
}
function pack(styles){
  const runs=[];
  for(let start=0;start<styles.length;){let end=start+1;while(end<styles.length&&same(styles[start],styles[end]))end++;
    if(Object.keys(styles[start]).length)runs.push({start,end,style:styles[start]});start=end;
  }
  return runs;
}
export function textStyleAt(layer,index){
  return {...layer,...(layer.runs||[]).find(run=>index>=run.start&&index<run.end)?.style};
}
export function formatTextRange(layer,start,end,patch){
  const styles=characterStyles(layer);
  if(end>start){for(let i=start;i<Math.min(end,styles.length);i++)styles[i]={...styles[i],...patch};return {runs:pack(styles)};}
  // With no highlight, a control still formats the entire text box.
  for(const style of styles)for(const key of Object.keys(patch))delete style[key];
  return {...patch,runs:pack(styles)};
}
export function replaceRichText(layer,text,selection){
  const before=String(layer.text||''),styles=characterStyles(layer);
  let start=0,oldEnd=before.length,newEnd=text.length;
  // Use the edit's selection where possible, avoiding ambiguity in repeated letters.
  if(selection&&text.startsWith(before.slice(0,selection.start))&&text.endsWith(before.slice(selection.end))&&text.length>=before.length-(selection.end-selection.start)){
    start=selection.start;oldEnd=selection.end;newEnd=text.length-(before.length-oldEnd);
  }else{
    while(start<before.length&&start<text.length&&before[start]===text[start])start++;
    while(oldEnd>start&&newEnd>start&&before[oldEnd-1]===text[newEnd-1]){oldEnd--;newEnd--;}
  }
  const inherited=styles[start<oldEnd?start:Math.max(0,start-1)]||{};
  styles.splice(start,oldEnd-start,...Array.from({length:newEnd-start},()=>({...inherited})));
  return {text,runs:pack(styles)};
}
export function styledTextRuns(layer){
  const text=String(layer.text||''),parts=[];
  let start=0;
  for(const run of layer.runs||[]){
    if(run.start>start)parts.push({...layer,text:text.slice(start,run.start),runs:undefined,start});
    parts.push({...layer,...run.style,text:text.slice(run.start,run.end),runs:undefined,start:run.start});start=run.end;
  }
  if(start<text.length)parts.push({...layer,text:text.slice(start),runs:undefined,start});
  return parts.length?parts:[{...layer,runs:undefined,start:0}];
}
export function scaleTextRuns(layer,scale){
  return (layer.runs||[]).map(run=>({...run,style:{...run.style,...(run.style.size!=null?{size:Math.max(6,Math.min(300,run.style.size*scale))}:{})}}));
}
