import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createAnimatedPreviewBackground } from './animated-preview-background.js';
import { paintShowcaseText, textFont } from './showcase-text.js';

export default forwardRef(function ShowcaseLayers({layers=[],activeId,editing,onSelect,onChange,onError,onInvalidate},ref) {
  const root=useRef(null),canvas=useRef(null),records=useRef(new Map()),drag=useRef(null),lastTime=useRef(0),latest=useRef();
  latest.current={layers,activeId,editing,onSelect,onChange,onError,onInvalidate};
  function paint(context,width,height,time=lastTime.current){
    for(const layer of latest.current.layers){
      context.save();context.globalAlpha=layer.opacity??1;
      if(layer.kind==='text')paintShowcaseText(context,layer,width,height,time);
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
  function draw(time=lastTime.current){
    lastTime.current=time;const node=canvas.current,box=root.current;if(!node||!box)return;
    const ratio=Math.min(2,window.devicePixelRatio||1),width=Math.max(1,Math.round(box.clientWidth*ratio)),height=Math.max(1,Math.round(box.clientHeight*ratio));
    if(node.width!==width)node.width=width;if(node.height!==height)node.height=height;
    const context=node.getContext('2d');context.clearRect(0,0,width,height);paint(context,width,height,time);
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
  const fontKey=[...new Set(layers.filter(layer=>layer.kind==='text').map(textFont))].sort().join('|');
  useEffect(()=>{let active=true;Promise.all(latest.current.layers.filter(layer=>layer.kind==='text').map(layer=>document.fonts.load('48px "'+textFont(layer)+'"'))).then(()=>{if(active){draw();latest.current.onInvalidate?.();}}).catch(error=>{if(active)latest.current.onError?.('Could not load text font: '+error.message);});return()=>{active=false;};},[fontKey]);
  useEffect(()=>{draw();},[layers]);
  useEffect(()=>{const observer=new ResizeObserver(()=>draw());if(root.current)observer.observe(root.current);return()=>observer.disconnect();},[]);
  useEffect(()=>()=>{for(const entry of records.current.values())entry.dispose();records.current.clear();},[]);
  useImperativeHandle(ref,()=>({
    get isReady(){return [...records.current.values()].every(entry=>entry.status==='ready')&&latest.current.layers.filter(layer=>layer.kind==='text').every(layer=>document.fonts.check('48px "'+textFont(layer)+'"'));},
    async whenReady(){await Promise.all([...records.current.values()].map(entry=>entry.promise));await Promise.all(latest.current.layers.filter(layer=>layer.kind==='text').map(layer=>document.fonts.load('48px "'+textFont(layer)+'"')));},
    pause(){for(const entry of records.current.values())entry.animation?.pause();},
    resume(){for(const entry of records.current.values())entry.animation?.resume();},
    async seek(seconds){await Promise.all([...records.current.values()].map(entry=>entry.animation?.seek(seconds)));},
    draw,paint,
  }),[]);
  function start(event,layer){
    if(!latest.current.editing||event.button!==0)return;
    const box=root.current.getBoundingClientRect();latest.current.onSelect?.(layer.id);
    drag.current={id:layer.id,x:event.clientX,y:event.clientY,width:box.width,height:box.height,rect:layer.rect,size:layer.size,resize:event.target.dataset.layerResize==='true'};
    event.currentTarget.setPointerCapture(event.pointerId);event.stopPropagation();event.preventDefault();
  }
  function move(event){
    const row=drag.current;if(!row)return;const dx=(event.clientX-row.x)/row.width,dy=(event.clientY-row.y)/row.height,rect=row.rect;
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const next=row.resize?{...rect,width:clamp(rect.width+dx,.03,2),height:clamp(rect.height+dy,.03,2)}:
      {...rect,x:clamp(rect.x+dx,-rect.width+.01,.99),y:clamp(rect.y+dy,-rect.height+.01,.99)};
    latest.current.onChange?.(row.id,{rect:next,...(row.resize&&row.size?{size:Math.max(6,Math.round(row.size*next.width/rect.width))}:{})});event.stopPropagation();
  }
  function end(event){drag.current=null;event.stopPropagation();}
  const selected=layers.find(layer=>layer.id===activeId);
  return <div className="showcase-layer-stage" ref={root}><canvas ref={canvas} aria-label="Showcase image and text layers"/>
    {editing&&selected&&<div className="showcase-layer-selection" style={{left:selected.rect.x*100+'%',top:selected.rect.y*100+'%',width:selected.rect.width*100+'%',height:selected.rect.height*100+'%'}} onPointerDown={event=>start(event,selected)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <span className="showcase-signature-handle" data-layer-resize="true" aria-hidden="true"/>
    </div>}
  </div>;
});
