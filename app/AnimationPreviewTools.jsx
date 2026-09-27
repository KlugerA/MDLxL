import React, { useEffect, useRef, useState } from 'react';
import { CAPTURE_QUALITIES, normalizeCapture } from '../src/capture-settings.js';
import { recordingTimeline } from './showcase-timeline.js';
import { centeredView, screenshotPlan } from './showcase-director.js';

export default function AnimationPreviewTools({ active, sessionId, captureAPI, modelName, loop, mode, length, playlist, model, shotOptions, disabled, onStatus, onBusy, preferences }) {
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
      const canvas=document.createElement('canvas');canvas.width=initial.width;canvas.height=initial.height;
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
      let inFlight=null,failure=null,nextFrame=0,count=0,lastTime=0;
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
          if(mounted.current)setProgress((time/1000).toFixed(1)+' / '+(timing.duration/1000).toFixed(1)+' seconds');
          if(time+.01<nextFrame || inFlight)return;
          // A slow encoder can reduce frame density, but cannot slow model/camera time.
          const timestamp=count===0?0:time;
          nextFrame=(Math.floor(time/(1000/settings.fps))+1)*1000/settings.fps;
          try {
            api.copyVisibleFrame(canvas);
            const pixels=context.getImageData(0,0,canvas.width,canvas.height);
            lastTime=timestamp;count++;
            inFlight=request({type:'frame',width:canvas.width,height:canvas.height,time:timestamp,buffer:pixels.data.buffer})
              .then(result=>{if(result.limit)throw Error(result.reason||'Recording reached the storage limit.');})
              .catch(cause=>{failure=cause;job.stop=true;job.finish();})
              .finally(()=>{inFlight=null;});
          } catch(cause){failure=cause;job.stop=true;job.finish();}
        };
        api.beginRecording({live:true,duration:timing.duration,onFrame});
        timer=setTimeout(job.finish,Math.max(0,timing.duration-(performance.now()-started)));
      });
      await inFlight;
      if(failure)throw failure;
      if(!count)throw Error('No recording frames were captured.');
      status('finishing');
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
  async function screenshots(job) {
    const api=job.api;await api.whenReady();if(job.stop)return;
    const base=centeredView(api.cameraView(),api.modelCenter());
    const plan=screenshotPlan(model,playlist,base,shotOptions),groups=new Map();
    let count=0,lastResult;
    api.beginRecording();
    status('shooting');
    for(const shot of plan){
      if(job.stop)break;
      if(!groups.has(shot.entry))groups.set(shot.entry,crypto.randomUUID());
      if(mounted.current)setProgress((count+1)+' / '+plan.length+' shots · '+shot.animationName);
      const canvas=await api.screenshotFrame(shot,{maxDimension:CAPTURE_QUALITIES[settings.screenshotQuality].screenshotSize});
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Screenshot could not be created.')),'image/png'));
      lastResult=await save({format:'png',modelName,animationName:shot.animationName,screenshotBatch:groups.get(shot.entry),shotIndex:shot.index+1,bytes:new Uint8Array(await blob.arrayBuffer())});
      if(retained.current)break;
      count++;
    }
    if(!retained.current)latest.current.onStatus?.('Saved '+count+' screenshots'+(lastResult?' in '+lastResult.modelDirectory:''));
  }
  async function start(){
    if(running.current||retained.current)return;
    const job={stop:false,promise:null,api:captureAPI};running.current=job;
    setError('');setProgress('Preparing…');status('starting');
    job.promise=(async()=>{
      try{
        if(!job.api)throw Error('The Showcase preview is still loading.');
        if(mode==='record')await record(job);else await screenshots(job);
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
  const stoppable=['recording','shooting'].includes(state);
  return <div className="showcase-capture">
    <button className="showcase-record" disabled={!stoppable&&(state!=='idle'||!captureAPI||disabled)} onClick={stoppable?stop:start}>{stoppable?'STOP':'RECORD'}</button>
    {state!=='idle'&&<div className="showcase-capture-status" role="status">{state==='retry'?'Save needs retry':state==='saving'?'Saving…':progress}</div>}
    {state==='retry'&&<button onClick={retry}>Retry Save</button>}
    {error&&<div className="capture-error" role="alert">{error}</div>}
  </div>;
}
