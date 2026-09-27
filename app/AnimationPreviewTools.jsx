import React, { useEffect, useRef, useState } from 'react';
import { CAPTURE_QUALITIES, normalizeCapture } from '../src/capture-settings.js';
import { recordingTimeline } from './showcase-timeline.js';
import { cropPixels } from './showcase-crop.js';

export default function AnimationPreviewTools({ active, sessionId, captureAPI, modelName, loop, length, crop, disabled, onStatus, onBusy, preferences }) {
  const [state,setState] = useState('idle'), [progress,setProgress] = useState(''), [error,setError] = useState('');
  const latest = useRef(); latest.current = {onStatus,onBusy};
  const running = useRef(null), retained = useRef(null), mounted = useRef(true);
  const settings = normalizeCapture(preferences?.capture);
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
  async function record(job) {
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
        ({jobId}=await window.desktop.beginPreviewRecording({width:canvas.width,height:canvas.height,quality:settings.recordingQuality,loop:!!loop,modelName}));
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
      for(let index=0;timing.time(index)<duration;index++){
        const time=timing.time(index);
        await api.seekRecordingFrame(time);
        api.copyVisibleFrame(canvas,crop);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height);
        const result=await request({type:'frame',width:canvas.width,height:canvas.height,time,buffer:pixels.data.buffer});
        if(result.limit)throw Error(result.reason||'Recording reached the storage limit.');
        if(mounted.current && index%5===0)setProgress('Capturing GIF frames… '+Math.min(100,Math.round(time/duration*100))+'%');
      }
      await api.seekRecordingFrame(duration);
      if(mounted.current)setProgress('Creating GIF…');
      const end=Math.max(20,duration);
      let result;
      if(jobId){
        await window.desktop.finishPreviewRecording({jobId,time:end});
        status('saving');result=await save({format:'gif',nativeJobId:jobId,modelName});
        // A failed save retains the native job for Retry Save.
        jobId=null;
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
    const job={stop:false,promise:null,api:captureAPI};running.current=job;
    setError('');setProgress('Preparing…');status('starting');
    job.promise=(async()=>{
      try{
        if(!job.api)throw Error('The Showcase preview is still loading.');
        await record(job);
      }catch(cause){if(mounted.current)setError(cause.message);latest.current.onStatus?.(cause.message,true);}
      finally{job.api?.endRecording();running.current=null;if(!retained.current)status('idle');}
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
  const stoppable=state==='recording';
  return <div className="showcase-capture">
    <button className="showcase-record" disabled={!stoppable&&(state!=='idle'||!captureAPI||disabled)} onClick={stoppable?stop:start}>{stoppable?'STOP':'RECORD'}</button>
    {state!=='idle'&&<div className="showcase-capture-status" role="status">{state==='retry'?'Save needs retry':state==='saving'?'Saving…':progress}</div>}
    {state==='retry'&&<button onClick={retry}>Retry Save</button>}
    {error&&<div className="capture-error" role="alert">{error}</div>}
  </div>;
}
