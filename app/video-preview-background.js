/** Muted local video with a loop restricted to the selected source interval. */
export function createVideoPreviewBackground(url,{onFrame,onMetadata,onError,getTrim=()=>({start:0,end:0}),createVideo=()=>document.createElement('video')}){
  const video=createVideo();video.muted=true;video.defaultMuted=true;video.volume=0;video.playsInline=true;video.preload='auto';
  let disposed=false,paused=false,callback=null,resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
  const range=()=>{const trim=getTrim(),duration=Number.isFinite(video.duration)?video.duration:0;const start=Math.max(0,Math.min(Number(trim.start)||0,Math.max(0,duration-.02)));return{start,end:Math.max(start+.02,Math.min(Number(trim.end)||duration,duration))};};
  const fail=()=>{if(disposed)return;const error=Error('This video could not be decoded. Choose a supported MP4, WebM, or image.');rejectReady(error);onError(error);};
  const draw=()=>{if(disposed||video.readyState<2)return;onFrame(video);resolveReady();};
  function tick(){
    if(disposed||paused)return;
    const {start,end}=range();
    if(video.currentTime>=end-.015||video.currentTime<start-.015)video.currentTime=start;
    draw();callback=video.requestVideoFrameCallback(tick);
  }
  const play=()=>{if(disposed)return;paused=false;video.play().catch(fail);if(callback===null)callback=video.requestVideoFrameCallback(tick);};
  video.onloadedmetadata=()=>{if(disposed)return;onMetadata?.(video.duration);video.currentTime=range().start;};
  video.onloadeddata=()=>{draw();play();};
  video.onseeked=draw;
  video.onended=()=>{video.currentTime=range().start;play();};
  video.onerror=fail;video.src=url;
  return{
    ready,video,
    setRange(){const {start,end}=range();if(video.currentTime<start||video.currentTime>=end)video.currentTime=start;},
    async seek(seconds=0){
      await ready;if(disposed)throw Error('This video is no longer open.');
      const {start,end}=range(),time=start+Math.max(0,seconds)%Math.max(.02,end-start);
      if(Math.abs(video.currentTime-time)<.001){draw();return;}
      await new Promise((resolve,reject)=>{
        const done=()=>{cleanup();draw();resolve();},error=()=>{cleanup();reject(Error('Could not seek the background video.'));};
        const cleanup=()=>{video.removeEventListener('seeked',done);video.removeEventListener('error',error);};
        video.addEventListener('seeked',done,{once:true});video.addEventListener('error',error,{once:true});video.currentTime=time;
      });
    },
    restart(){video.currentTime=range().start;play();},
    pause(){paused=true;video.pause();if(callback!==null)video.cancelVideoFrameCallback(callback);callback=null;},
    resume:play,
    dispose(){disposed=true;video.pause();if(callback!==null)video.cancelVideoFrameCallback(callback);video.onloadedmetadata=video.onloadeddata=video.onseeked=video.onended=video.onerror=null;video.removeAttribute('src');video.load();resolveReady();},
  };
}
