// Native jobs own their captured frames and settings. They outlive the preview
// component so another take, model, or workspace cannot interrupt an encode.
const jobs=new Map(),listeners=new Set();
let failure='',snapshot={pending:0,retry:0,error:''};
function publish(){
  const rows=[...jobs.values()];
  snapshot={pending:rows.filter(row=>row.state!=='retry').length,retry:rows.filter(row=>row.state==='retry').length,error:failure||rows.find(row=>row.error)?.error||''};
  for(const listener of listeners)listener();
}
export function subscribeRecordings(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function recordingQueueSnapshot(){return snapshot;}
async function save(row){
  row.state='saving';row.error='';publish();
  try{
    const result=await row.desktop.savePreviewRecording(row.jobId);
    jobs.delete(row.jobId);row.onStatus?.('Saved '+result.path+(row.output?.width?' · '+row.output.width+' × '+row.output.height+' · '+(result.size/1_000_000).toFixed(1)+' MB':''));return true;
  }catch(error){
    row.state='retry';row.error='GIF retained. Save failed: '+error.message;
    row.onStatus?.(row.error,true);return false;
  }finally{publish();}
}
export function queueRecording({jobId,time,onStatus}){
  const row={jobId,desktop:window.desktop,onStatus,state:'encoding',error:'',promise:null};
  jobs.set(jobId,row);failure='';publish();
  row.promise=(async()=>{
    try{row.output=await row.desktop.finishPreviewRecording({jobId,time});}
    catch(error){jobs.delete(jobId);failure='GIF encoding failed: '+error.message;row.onStatus?.(failure,true);publish();return false;}
    return save(row);
  })();
}
export function retryRecordingSaves(){
  return Promise.all([...jobs.values()].filter(row=>row.state==='retry').map(row=>(row.promise=save(row))));
}
export async function flushRecordingQueue(){
  await Promise.all([...jobs.values()].map(row=>row.promise));
  await retryRecordingSaves();
  if([...jobs.values()].some(row=>row.state==='retry'))throw Error('A GIF could not be saved. Use Retry Save in Showcase before closing.');
}
