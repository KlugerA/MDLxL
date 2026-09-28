import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { moveDragPoint } from './classic-gestures.js';
import { scaleTextRuns } from './showcase-rich-text.js';
import { createAnimatedPreviewBackground } from './animated-preview-background.js';
import { paintShowcaseText, textFonts } from './showcase-text.js';

export default forwardRef(function ShowcaseLayers({layers=[],activeId,editing,onSelect,onChange,onError,onInvalidate,grid=false,gridDensity=5,crop},ref) {
  const root=useRef(null),canvas=useRef(null),records=useRef(new Map()),drag=useRef(null),lastTime=useRef(0),lastCinematic=useRef({enabled:false,time:0}),latest=useRef();
  latest.current={layers,activeId,editing,onSelect,onChange,onError,onInvalidate};
  function paint(context,width,height,time=lastTime.current,cinematic=lastCinematic.current){
    for(const layer of latest.current.layers){
      context.save();context.globalAlpha=layer.opacity??1;
      if(layer.kind==='text')paintShowcaseText(context,layer,width,height,time,cinematic);
      else{
        const image=records.current.get(layer.id)?.image,rect=layer.rect;
        if(image){const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
          if(iw>0&&ih>0){const bw=rect.width*width,bh=rect.height*height,s=Math.min(bw/iw,bh/ih);
            context.drawImage(image,rect.x*width+(bw-iw*s)/2,rect.y*height+(bh-ih*s)/2,iw*s,ih*s);}
        }
      }
      context.restore();
    }
  }
  function draw(time=lastTime.current,cinematic=lastCinematic.current){
    lastTime.current=time;lastCinematic.current=cinematic;const node=canvas.current,box=root.current;if(!node||!box)return;
    const ratio=Math.min(2,window.devicePixelRatio||1),width=Math.max(1,Math.round(box.clientWidth*ratio)),height=Math.max(1,Math.round(box.clientHeight*ratio));
    if(node.width!==width)node.width=width;if(node.height!==height)node.height=height;
    const context=node.getContext('2d');context.clearRect(0,0,width,height);paint(context,width,height,time,cinematic);
  }
  const imageKey=layers.filter(layer=>layer.kind==='image').map(layer=>layer.id+':'+layer.url).join('|');
  useEffect(()=>{
    const images=latest.current.layers.filter(layer=>layer.kind==='image');
    for(const [id,entry] of records.current)if(!images.some(layer=>layer.id===id&&layer.url===entry.url)){entry.dispose();records.current.delete(id);}
    for(const layer of images){
      if(records.current.has(layer.id))continue;
      const entry={url:layer.url,status:'loading',image:null,animation:null,dispose:()=>{},promise:null};records.current.set(layer.id,entry);
      const live=()=>records.current.get(layer.id)===entry;
      const show=image=>{if(!live())return;entry.image=image;entry.status='ready';latest.current.onInvalidate?.();};
      const fail=error=>{if(!live())return;entry.status='failed';entry.error=error;latest.current.onError?.(error.message);};
      if(layer.type==='image/gif'){
        entry.animation=createAnimatedPreviewBackground(layer.url,{onFrame:show,onError:fail});
        entry.promise=entry.animation.ready;entry.dispose=()=>entry.animation.dispose();
      }else{
        const image=new Image();if(/^https?:/i.test(layer.url))image.crossOrigin='anonymous';
        entry.promise=new Promise((resolve,reject)=>{image.onload=()=>{show(image);resolve();};image.onerror=()=>{const error=Error('Could not load signature: '+layer.name);fail(error);reject(error);};});
        entry.dispose=()=>{image.onload=image.onerror=null;};image.src=layer.url;
      }
      entry.promise.catch(()=>{});
    }
    draw();
  },[imageKey]);
  const fontKey=[...new Set(layers.filter(layer=>layer.kind==='text').flatMap(textFonts))].sort().join('|');
  useEffect(()=>{let active=true;Promise.all(latest.current.layers.filter(layer=>layer.kind==='text').flatMap(textFonts).map(font=>document.fonts.load(font))).then(()=>{if(active){draw();latest.current.onInvalidate?.();}}).catch(error=>{if(active)latest.current.onError?.('Could not load text font: '+error.message);});return()=>{active=false;};},[fontKey]);
  useEffect(()=>{draw();},[layers]);
  useEffect(()=>{const observer=new ResizeObserver(()=>draw());if(root.current)observer.observe(root.current);return()=>observer.disconnect();},[]);
  useEffect(()=>()=>{for(const entry of records.current.values())entry.dispose();records.current.clear();},[]);
  useImperativeHandle(ref,()=>({
    get isReady(){return [...records.current.values()].every(entry=>entry.status==='ready')&&latest.current.layers.filter(layer=>layer.kind==='text').flatMap(textFonts).every(font=>document.fonts.check(font));},
    async whenReady(){await Promise.all([...records.current.values()].map(entry=>entry.promise));await Promise.all(latest.current.layers.filter(layer=>layer.kind==='text').flatMap(textFonts).map(font=>document.fonts.load(font)));},
    pause(){for(const entry of records.current.values())entry.animation?.pause();},
    resume(){for(const entry of records.current.values())entry.animation?.resume();},
    async seek(seconds){await Promise.all([...records.current.values()].map(entry=>entry.animation?.seek(seconds)));},
    draw,paint,
  }),[]);
  function start(event,layer){
    if(!latest.current.editing||event.button!==0)return;
    const box=root.current.getBoundingClientRect();latest.current.onSelect?.(layer.id);
    const centerX=box.left+(layer.rect.x+layer.rect.width/2)*box.width,centerY=box.top+(layer.rect.y+layer.rect.height/2)*box.height;
    const point={x:event.clientX,y:event.clientY};
    drag.current={motion:{pointer:point,point,shift:event.shiftKey,axis:null},id:layer.id,x:event.clientX,y:event.clientY,width:box.width,height:box.height,rect:layer.rect,size:layer.size,layer,angle:(layer.kind==='text'?Number(layer.rotation)||0:0)*Math.PI/180,resize:event.target.dataset.layerResize==='true',rotate:layer.kind==='text'&&!!event.target.closest('[data-layer-rotate]'),centerX,centerY,pointerAngle:Math.atan2(event.clientY-centerY,event.clientX-centerX)};
    event.currentTarget.setPointerCapture(event.pointerId);event.stopPropagation();event.preventDefault();
  }
  function move(event){
    const row=drag.current;if(!row)return;const point=moveDragPoint(row.motion,{x:event.clientX,y:event.clientY},event.shiftKey),dx=(point.x-row.x)/row.width,dy=(point.y-row.y)/row.height,rect=row.rect;
    if(row.rotate){
      const angle=row.angle+Math.atan2(event.clientY-row.centerY,event.clientX-row.centerX)-row.pointerAngle;
      const rotation=((Math.round(angle*180/Math.PI)+180)%360+360)%360-180;
      latest.current.onChange?.(row.id,{rotation});event.stopPropagation();return;
    }
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const c=Math.cos(row.angle),s=Math.sin(row.angle),localX=(c*dx*row.width+s*dy*row.height)/row.width,localY=(-s*dx*row.width+c*dy*row.height)/row.height;
    const next=row.resize?{...rect,width:clamp(rect.width+localX,.03,2),height:clamp(rect.height+localY,.03,2)}:
      {...rect,x:clamp(rect.x+dx,-rect.width+.01,.99),y:clamp(rect.y+dy,-rect.height+.01,.99)};
    if(row.resize){const dw=(next.width-rect.width)*row.width,dh=(next.height-rect.height)*row.height;next.x+=((c-1)*dw-s*dh)/2/row.width;next.y+=(s*dw+(c-1)*dh)/2/row.height;}
    latest.current.onChange?.(row.id,{rect:next,...(row.resize&&row.size?{size:Math.max(6,Math.min(300,Math.round(row.size*next.width/rect.width))),runs:scaleTextRuns(row.layer,next.width/rect.width)}:{})});event.stopPropagation();
  }
  useEffect(()=>{
    const shift=event=>{if(event.key==='Shift'&&drag.current)moveDragPoint(drag.current.motion,drag.current.motion.pointer,event.shiftKey);};
    const cancel=()=>{drag.current=null;};
    window.addEventListener('keydown',shift);window.addEventListener('keyup',shift);window.addEventListener('blur',cancel);
    return()=>{window.removeEventListener('keydown',shift);window.removeEventListener('keyup',shift);window.removeEventListener('blur',cancel);};
  },[]);
  function end(event){drag.current=null;event.stopPropagation();}
  const selected=layers.find(layer=>layer.id===activeId),frame=crop||{x:0,y:0,width:1,height:1},divisions=3+Math.max(1,Math.min(99,gridDensity));
  const gridPath=Array.from({length:divisions+1},(_,i)=>{const n=i*100/divisions;return `M${n} 0V100M0 ${n}H100`;}).join(' ');
  return <div className="showcase-layer-stage" ref={root}><canvas ref={canvas} aria-label="Showcase image and text layers"/>
    {grid&&<svg className="showcase-alignment-grid" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{left:frame.x*100+'%',top:frame.y*100+'%',width:frame.width*100+'%',height:frame.height*100+'%'}}><path d={gridPath} fill="none" stroke="#084817" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/><path d={gridPath} fill="none" stroke="#39ff58" strokeWidth=".6" vectorEffect="non-scaling-stroke"/></svg>}
    {editing&&selected&&<div className="showcase-layer-selection" style={{left:selected.rect.x*100+'%',top:selected.rect.y*100+'%',width:selected.rect.width*100+'%',height:selected.rect.height*100+'%',transform:selected.kind==='text'?'rotate('+(selected.rotation||0)+'deg)':undefined}} onPointerDown={event=>start(event,selected)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      {selected.kind==='text'&&<button type="button" className="showcase-text-rotate" data-layer-rotate="true" aria-label="Rotate text" title="Drag to rotate text">↻</button>}
      <span className="showcase-signature-handle" data-layer-resize="true" aria-hidden="true"/>
    </div>}
  </div>;
});
