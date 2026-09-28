// Native encoding jobs outlive the preview. Results stay for this model and
// recording batch; finishing an older batch must not replace the current links.
const jobs=new Map(),listeners=new Set();
let failure='',session=null,generation=0,results=[],snapshot={pending:0,retry:0,error:'',results:[]};
function publish(){
  const rows=[...jobs.values()];
  snapshot={pending:rows.filter(row=>row.state!=='retry').length,retry:rows.filter(row=>row.state==='retry').length,error:failure||rows.find(row=>row.error)?.error||'',results:results.map(row=>({...row}))};
  for(const listener of listeners)listener();
}
export function subscribeRecordings(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function recordingQueueSnapshot(){return snapshot;}
export function setRecordingSession(value){if(value!==session){session=value;generation++;results=[];failure='';publish();}}
export function beginRecordingGroup(value){setRecordingSession(value);generation++;results=[];failure='';publish();return {session,generation};}
function visible(group){return group?.session===session&&group?.generation===generation;}
async function uploadResult(row){
  if(row.state==='uploading'||row.url)return;
  row.state='uploading';row.error='';publish();
  try{
    const response=await row.desktop.uploadPreviewToCatbox(row.exportId);
    if(!response.ok)throw Error(response.error.message);
    row.url=response.url;row.state='uploaded';
  }catch(error){row.state='failed';row.error=error.message||'Catbox upload failed. Your GIF is saved locally.';}
  finally{publish();}
}
export function retryCatboxUpload(exportId){const row=results.find(row=>row.exportId===exportId);return row?uploadResult(row):Promise.resolve();}
async function save(row){
  row.state='saving';row.error='';publish();
  let result;
  try{result=await row.desktop.savePreviewRecording(row.jobId);}
  catch(error){row.state='retry';row.error='GIF retained. Save failed: '+error.message;row.onStatus?.(row.error,true);publish();return false;}
  jobs.delete(row.jobId);
  row.onStatus?.('Saved '+result.path+(row.output?.width?' · '+row.output.width+' × '+row.output.height+' · '+(result.size/1_000_000).toFixed(1)+' MB':''));
  if(row.upload){
    const item={...result,desktop:row.desktop,state:'saved',url:'',error:''};
    if(visible(row.group))results.push(item);
    // Consent is captured at the user's Record & Upload click, never inferred
    // from whichever profile happens to be selected when encoding completes.
    await uploadResult(item);
  }
  publish();return true;
}
export function queueRecording({jobId,time,onStatus,upload=false,group}){
  const row={jobId,desktop:window.desktop,onStatus,upload,group,state:'encoding',error:'',promise:null};
  jobs.set(jobId,row);failure='';publish();
  row.promise=(async()=>{
    try{row.output=await row.desktop.finishPreviewRecording({jobId,time});}
    catch(error){jobs.delete(jobId);failure='GIF encoding failed: '+error.message;row.onStatus?.(failure,true);publish();return false;}
    return save(row);
  })();
  return row.promise;
}
export function retryRecordingSaves(){return Promise.all([...jobs.values()].filter(row=>row.state==='retry').map(row=>(row.promise=save(row))));}
export async function flushRecordingQueue(){
  await Promise.all([...jobs.values()].map(row=>row.promise));await retryRecordingSaves();
  if([...jobs.values()].some(row=>row.state==='retry'))throw Error('A GIF could not be saved. Use Retry Save in Showcase before closing.');
}
