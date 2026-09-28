import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CAPTURE_QUALITIES, normalizeCapture } from '../src/capture-settings.js';
import { recordingTimeline } from './showcase-timeline.js';
import { validateShowcaseExport, showcaseExportPreferences } from './showcase-export.js';
import { cropPixels } from './showcase-crop.js';
import { queueRecording, subscribeRecordings, recordingQueueSnapshot, retryRecordingSaves, setRecordingSession, beginRecordingGroup, retryCatboxUpload } from './preview-recording-queue.js';

export default function AnimationPreviewTools({ active, sessionId, captureAPI, modelName, loop, length, crop, disabled, onStatus, onBusy, preferences, locked=false,recordingList=[],prepareTake,onTakeComplete,beforeBatch,afterBatch,exportTarget='hive',onExportTarget }) {
  const [copyStatus,setCopyStatus]=useState('');
  const [state,setState] = useState('idle'), [progress,setProgress] = useState(''), [error,setError] = useState(''), [batchLabel,setBatchLabel]=useState('');
  const latest = useRef(); latest.current = {onStatus,onBusy,prepareTake,onTakeComplete,beforeBatch,afterBatch};
  const running = useRef(null), retained = useRef(null), mounted = useRef(true);
  const background = useSyncExternalStore(subscribeRecordings,recordingQueueSnapshot);
  function status(next) { if(mounted.current)setState(next); latest.current.onBusy?.(next!=='idle'); }
  async function save(payload) {
    retained.current = payload;
    try {
      let result;
      if(window.desktop) result = payload.nativeJobId ? await window.desktop.savePreviewRecording(payload.nativeJobId) : await window.desktop.saveCapture(payload);
      else {
        const url=URL.createObjectURL(new Blob([payload.bytes],{type:payload.format==='gif'?'image/gif':'image/png'}));
        const anchor=document.createElement('a');anchor.href=url;anchor.download=(payload.animationName||modelName||'Model')+'-'+Date.now()+'.'+payload.format;anchor.click();
        setTimeout(()=>URL.revokeObjectURL(url),10000);
      }
      retained.current=null;
      return result;
    } catch(cause) {
      if(mounted.current)setError(cause.message);
      status('retry');latest.current.onStatus?.('Capture retained. Save failed: '+cause.message,true);
      return null;
    }
  }
  function stop() { if(running.current){running.current.stop=true;running.current.finish?.();} }
  async function record(job,take) {
    const {length,crop,preferences,loop,modelName}=take;validateShowcaseExport(job.exportTarget,length);
    const settings=normalizeCapture(showcaseExportPreferences(preferences,job.exportTarget).capture);
    let worker,jobId;
    const api=job.api, timing=recordingTimeline(length,settings.fps), quality=CAPTURE_QUALITIES[settings.recordingQuality];
    try {
      await api.prepareRecording(); if(job.stop)return;
      // Size allocation and encoder preparation happen before the visible clock starts.
      const initial=api.captureFrame({maxDimension:quality.gifSize});
      const selection=cropPixels(initial.width,initial.height,crop);
      const canvas=document.createElement('canvas');canvas.width=selection.width;canvas.height=selection.height;
      const context=canvas.getContext('2d',{willReadFrequently:true});
      let request;
      if(window.desktop){
        ({jobId}=await window.desktop.beginPreviewRecording({width:canvas.width,height:canvas.height,quality:settings.recordingQuality,loop:!!loop,modelName,exportTarget:job.exportTarget}));
        request=message=>window.desktop.writePreviewRecordingFrame({jobId,...message});
      } else {
        worker=new Worker(new URL('./preview-gif.worker.js',import.meta.url),{type:'module'});
        worker.postMessage({type:'start',loop,colors:quality.colors,dither:quality.dither});
        request=message=>new Promise((resolve,reject)=>{
          worker.onmessage=({data})=>data.type==='error'?reject(Error(data.message)):resolve(data);
          worker.onerror=event=>reject(Error(event.message||'GIF encoding failed.'));
          worker.postMessage(message,message.buffer?[message.buffer]:[]);
        });
      }
      if(job.stop)return;
      let lastProgress=-Infinity;
      const started=performance.now();
      status('recording');
      const duration=await new Promise(resolve=>{
        let done=false,timer;
        job.finish=()=>{
          if(done)return;done=true;clearTimeout(timer);
          const time=job.stop?Math.min(timing.duration,Math.max(20,performance.now()-started)):timing.duration;
          api.freezeRecording(time);resolve(time);
        };
        const onFrame=time=>{
          if(done || time>=timing.duration)return;
          if(mounted.current && time-lastProgress>=100){lastProgress=time;setProgress((time/1000).toFixed(1)+' / '+(timing.duration/1000).toFixed(1)+' seconds');}
        };
        api.beginRecording({live:true,duration:timing.duration,onFrame});
        timer=setTimeout(job.finish,Math.max(0,timing.duration-(performance.now()-started)));
      });
      status('finishing');
      let pendingFrame;
      async function acceptFrame(){
        if(!pendingFrame)return;
        const outcome=await pendingFrame;pendingFrame=null;
        if(outcome.error)throw outcome.error;
        if(outcome.result.limit)throw Error(outcome.result.reason||'Recording reached the storage limit.');
      }
      for(let index=0;timing.time(index)<duration;index++){
        const time=timing.time(index);
        await api.seekRecordingFrame(time);
        api.copyVisibleFrame(canvas,crop);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height);
        // Render the next frame while the previous frame is written losslessly.
        // At most two pixel buffers are in flight; no frames are skipped.
        await acceptFrame();
        pendingFrame=request({type:'frame',width:canvas.width,height:canvas.height,time,buffer:pixels.data.buffer}).then(result=>({result}),error=>({error}));
        if(mounted.current && index%5===0)setProgress('Capturing GIF frames… '+Math.min(100,Math.round(time/duration*100))+'%');
      }
      await acceptFrame();
      await api.seekRecordingFrame(duration);
      if(mounted.current)setProgress('Creating GIF…');
      const end=Math.max(20,duration);
      let result;
      if(jobId){
        queueRecording({jobId,time:end,onStatus:latest.current.onStatus,upload:job.exportTarget==='catbox',group:job.group});
        // The queue now owns this job, including save retries. Release the
        // preview immediately; its next take must never share this cleanup.
        jobId=null;return;
      } else {
        const encoded=await request({type:'finish',time:end});status('saving');
        result=await save({format:'gif',bytes:encoded.bytes,modelName});
      }
      if(!retained.current)latest.current.onStatus?.(result?'Saved '+result.path:'Saved recording');
    } finally {
      worker?.terminate();
      if(jobId)await window.desktop.discardPreviewRecording(jobId);
    }
  }
  async function start(){
    if(running.current||retained.current)return;
    try{
      if(exportTarget==='catbox'&&!window.desktop?.uploadPreviewToCatbox)throw Error('Catbox upload requires the desktop app.');
      if(recordingList.length)for(const item of recordingList){const setup=item.setup,portrait=setup.mode==='portrait';validateShowcaseExport(exportTarget,portrait?setup.portraitLength:setup.sequenceLength,portrait?setup.portraitPlaylist:setup.sequencePlaylist);}
      else validateShowcaseExport(exportTarget,length);
    }catch(error){setError(error.message);return;}
    // Snapshot the list once: editing or completing one row cannot alter later takes.
    const plan=recordingList.slice(),job={stop:false,promise:null,api:captureAPI,exportTarget,group:beginRecordingGroup(sessionId)};running.current=job;setCopyStatus('');
    setError('');setProgress('Preparing…');status('starting');
    job.promise=(async()=>{
      let batchStarted=false;
      try{
        if(plan.length){
          await latest.current.beforeBatch?.();batchStarted=true;
          for(let index=0;index<plan.length&&!job.stop;index++){
            if(mounted.current){setBatchLabel('Take '+(index+1)+' / '+plan.length+' · ');setProgress('Loading setup…');}status('starting');
            const take=await latest.current.prepareTake(plan[index]);job.api=take.api;
            if(job.stop)break;
            try{await record(job,take);}finally{job.api?.endRecording();job.api=null;job.finish=null;}
            if(retained.current)break;
            if(!job.stop)latest.current.onTakeComplete?.(plan[index].id);
          }
        }else{
          if(!job.api)throw Error('The Showcase preview is still loading.');
          await record(job,{length,crop,preferences,loop,modelName});
        }
      }catch(cause){if(mounted.current)setError(cause.message);latest.current.onStatus?.(cause.message,true);}
      finally{
        job.api?.endRecording();
        if(batchStarted&&mounted.current){
          try{if(mounted.current)setProgress('Restoring setup…');await latest.current.afterBatch?.();}
          catch(cause){if(mounted.current)setError(cause.message);latest.current.onStatus?.('Could not restore setup: '+cause.message,true);}
        }
        running.current=null;if(mounted.current)setBatchLabel('');if(!retained.current)status('idle');
      }
    })();
    await job.promise;
  }
  async function retry(){status('saving');const result=await save(retained.current);if(!retained.current){setError('');status('idle');latest.current.onStatus?.(result?'Saved '+result.path:'Saved capture');}}
  useEffect(()=>{window.desktop?.setCaptureBusy?.(state!=='idle');},[state]);
  useEffect(()=>{
    const flush=event=>event.detail.push((async()=>{stop();await running.current?.promise;if(retained.current){await retry();if(retained.current)throw Error('Capture could not be saved. Use Retry Save before closing.');}})());
    window.addEventListener('mdlvis-flush-captures',flush);return()=>window.removeEventListener('mdlvis-flush-captures',flush);
  },[]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop();};},[sessionId]);
  useEffect(()=>{if(!active)stop();},[active]);
  useEffect(()=>{setRecordingSession(sessionId);setCopyStatus('');},[sessionId]);
  async function copyLink(row,bbcode){try{await window.desktop.copyPreviewLink(row.exportId,bbcode);setCopyStatus(bbcode?'Hive BBCode copied':'Link copied');}catch{setCopyStatus('Could not copy the link. Select and copy the text.');}}
  const stoppable=['starting','recording','finishing'].includes(state);
  return <div className="showcase-capture">
    <button className="showcase-record" disabled={!stoppable&&(state!=='idle'||!captureAPI||locked||(disabled&&!recordingList.length))} onClick={stoppable?stop:start}>{stoppable?'STOP':exportTarget==='catbox'?'RECORD & UPLOAD':'RECORD'}</button>
    <div className="showcase-export-target" role="group" aria-label="GIF destination"><button disabled={state!=='idle'||locked} aria-pressed={exportTarget==='hive'} onClick={()=>onExportTarget?.('hive')}>HIVE</button><button disabled={state!=='idle'||locked} aria-pressed={exportTarget==='catbox'} title="Record saves locally, then uploads the exact GIF anonymously to Catbox" onClick={()=>onExportTarget?.('catbox')}>CATBOX</button></div>
    <small className="showcase-export-note">{exportTarget==='catbox'?'864 px max · 30 FPS · ≤20 MB · uploads after Record':'Hive · 5s max · 30 FPS'}</small>
    {background.results.length>0&&<div className="showcase-upload-results" aria-label="Catbox links">{background.results.map((row,index)=><div className="showcase-upload-result" key={row.exportId}><small title={row.path}>{index+1}. {row.name}</small>{row.url?<><label><input readOnly aria-label={'Link '+(index+1)} value={row.url} onFocus={event=>event.target.select()}/><button onClick={()=>copyLink(row,false)}>Copy Link</button></label><label><input readOnly aria-label={'Hive BBCode '+(index+1)} value={'[IMG]'+row.url+'[/IMG]'} onFocus={event=>event.target.select()}/><button onClick={()=>copyLink(row,true)}>Copy Hive BBCode</button></label></>:<><span role="status">{row.state==='uploading'?'Uploading...':''}</span>{row.error&&<div className="capture-error" role="alert">{row.error}</div>}<button disabled={row.state==='uploading'} onClick={()=>retryCatboxUpload(row.exportId)}>{row.state==='failed'?'Retry Upload':'Upload to Catbox'}</button><small>GIF saved locally</small></>}</div>)}</div>}
    {copyStatus&&<small role="status">{copyStatus}</small>}
    {state!=='idle'&&<div className="showcase-capture-status" role="status">{state==='retry'?'Save needs retry':state==='saving'?'Saving…':batchLabel+progress}</div>}
    {background.pending>0&&<div className="showcase-capture-status" role="status">Making GIFs… {background.pending}</div>}
    {state==='retry'&&<button onClick={retry}>Retry Save</button>}
    {background.retry>0&&<button onClick={retryRecordingSaves}>Retry Save{background.retry>1?' · '+background.retry:''}</button>}
    {(error||background.error)&&<div className="capture-error" role="alert">{error||background.error}</div>}
  </div>;
}
