import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {paintMessage as msg} from '../src/paint-messages.js';

/** A texture/UV view of the current paint target. Pixel edits share the 3D
 * painter's coats and history; UV edits are owned by the portable preset.
 */
export default function PaintTextureCanvas({canvas,version,title,geoset,coordId=0,brush,brushPreview,textureSmoothing=false,decal,disabled,onStart,onMove,onEnd,onCancel,onHover,onUVChange,regionMask,onGrab}) {
  const display=useRef(),regionCanvas=useRef(),image=useRef(),scroll=useRef(),cursor=useRef(),gesture=useRef(null);
  const [zoomChoice,setZoomChoice]=useState('fit'),[fit,setFit]=useState(1),[mesh,setMesh]=useState(false),[tool,setTool]=useState('paint'),[draft,setDraft]=useState(null),[angle,setAngle]=useState(0),[scale,setScale]=useState(100);
  const width=canvas?.width||256,height=canvas?.height||256,zoom=zoomChoice==='fit'?fit:Number(zoomChoice),uv=draft||geoset?.TVertices?.[coordId];
  const uvPath=useMemo(()=>uv?Array.from({length:Math.floor((geoset?.Faces.length||0)/3)},(_,i)=>{const ids=Array.from(geoset.Faces.slice(i*3,i*3+3));return ids.map((id,j)=>(j?'L':'M')+uv[id*2]*width+','+uv[id*2+1]*height).join(' ')+'Z';}).join(' '):'', [uv,geoset?.Faces,width,height]);
  useEffect(()=>{const element=scroll.current,resize=()=>setFit(Math.max(.01,Math.min((element.clientWidth-32)/width,(element.clientHeight-32)/height)));const observer=new ResizeObserver(resize);observer.observe(element);resize();return()=>observer.disconnect();},[width,height]);
  useLayoutEffect(()=>{if(!canvas||!display.current)return;if(display.current.width!==canvas.width)display.current.width=canvas.width;if(display.current.height!==canvas.height)display.current.height=canvas.height;display.current.getContext('2d').clearRect(0,0,canvas.width,canvas.height);display.current.getContext('2d').drawImage(canvas,0,0);},[canvas,version]);
  useEffect(()=>{if(!regionCanvas.current||!regionMask)return;const c=regionCanvas.current;c.width=width;c.height=height;const data=new Uint8ClampedArray(width*height*4);for(let i=0;i<regionMask.length;i++)data.set([5,20,30,Math.round((255-regionMask[i])*.35)],i*4);c.getContext('2d').putImageData(new ImageData(data,width,height),0,0);},[regionMask,width,height]);
  useEffect(()=>{setDraft(null);},[geoset,coordId]);
  const point=e=>{const rect=image.current.getBoundingClientRect();return{x:(e.clientX-rect.left)/zoom,y:(e.clientY-rect.top)/zoom};};
  const hit=e=>({textureView:true,screen:point(e),viewport:{width,height}});
  function down(e){if(e.button!==0||disabled)return;e.preventDefault();image.current.setPointerCapture(e.pointerId);
    if(tool==='moveUV'&&uv){gesture.current={start:point(e),uv:new Float32Array(uv)};return;}
    gesture.current={paint:true};onStart(hit(e));
  }
  function move(e){const p=point(e);if(cursor.current)Object.assign(cursor.current.style,{display:tool==='paint'?'block':'none',left:p.x*zoom+'px',top:p.y*zoom+'px'});
    const drag=gesture.current;if(!drag){if(tool==='paint'&&!disabled)onHover?.(hit(e));return;}if(drag.paint){onMove(hit(e));return;}
    setDraft(Float32Array.from(drag.uv,(value,i)=>value+(i%2?(p.y-drag.start.y)/height:(p.x-drag.start.x)/width)));
  }
  function end(e){const drag=gesture.current;if(!drag)return;gesture.current=null;if(drag.paint)onEnd();else{const p=point(e),next=Float32Array.from(drag.uv,(value,i)=>value+(i%2?(p.y-drag.start.y)/height:(p.x-drag.start.x)/width));onUVChange(next);setDraft(null);}}
  function transform(){if(!uv)return;let x=0,y=0;for(let i=0;i<uv.length;i+=2){x+=uv[i];y+=uv[i+1];}x/=uv.length/2;y/=uv.length/2;const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180),next=new Float32Array(uv.length);for(let i=0;i<uv.length;i+=2){const dx=(uv[i]-x)*scale/100,dy=(uv[i+1]-y)*scale/100;next[i]=x+dx*c-dy*s;next[i+1]=y+dx*s+dy*c;}onUVChange(next);setAngle(0);setScale(100);}
  return <div className="paint-texture-view"><div className="paint-texture-heading" title={title}>Destination · {title}</div><div className="paint-texture-toolbar"><button aria-pressed={tool==='moveUV'} onClick={()=>{onHover?.(null);setTool(tool==='moveUV'?'paint':'moveUV');if(tool!=='moveUV')setMesh(true);}}>Adjust mapping</button><label><input type="checkbox" checked={mesh} onChange={e=>setMesh(e.target.checked)}/>{msg('paint.uvMesh')}</label><label>{msg('paint.zoom')}<select value={zoomChoice} onChange={e=>{onHover?.(null);setZoomChoice(e.target.value);}}><option value="fit">Fit</option>{[.25,.5,1,1.5,2,3,4,6,8].map(v=><option key={v} value={v}>{v*100}%</option>)}</select></label>{onGrab&&<button onClick={onGrab}>Copy a patch</button>}</div>
    {tool==='moveUV'&&<div className="paint-texture-toolbar"><label>{msg('paint.scale')}<input type="number" min="1" value={scale} onChange={e=>setScale(+e.target.value)}/>%</label><label>{msg('paint.angle')}<input type="number" value={angle} onChange={e=>setAngle(+e.target.value)}/>°</label><button onClick={transform}>{msg('paint.applyUV')}</button><small>{msg('paint.uvEditHelp')}</small></div>}
    <div ref={scroll} className="paint-texture-scroll"><div ref={image} className="paint-texture-image" style={{width:width*zoom,height:height*zoom,cursor:tool==='moveUV'?'move':'crosshair'}} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{gesture.current=null;setDraft(null);onCancel();}} onPointerLeave={()=>{if(cursor.current)cursor.current.style.display='none';onHover?.(null);}}>
      <canvas ref={display} style={{imageRendering:textureSmoothing?'auto':'pixelated'}}/>{mesh&&uv&&<svg viewBox={`0 0 ${width} ${height}`}><path d={uvPath}/></svg>}
      {regionMask&&<canvas ref={regionCanvas} aria-label="Paint region mask"/>}
      <div ref={cursor} className={'paint-texture-cursor'+(decal?' paint-detail-outline':'')} style={{width:(decal?.width||brush.size)*zoom,height:(decal?.height||brush.size)*zoom,transform:`translate(-50%,-50%) rotate(${decal?.angle||0}deg)`}}>{!decal&&<img src={brushPreview}/>}</div>
    </div></div>
  </div>;
}
