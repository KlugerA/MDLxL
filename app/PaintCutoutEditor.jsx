import React,{useEffect,useMemo,useRef,useState} from 'react';
import {shapeSelection,magicSelection,combineSelection,featherSelection,extractPaintCutout} from '../src/paint-selection.js';
import {flattenPaintRasterAlpha} from '../src/paint-raster.js';
import {paintRasterCanvas} from './paint-raster.js';
import {usePaintImageNavigation} from './usePaintImageNavigation.js';
import {paintMessage as msg} from '../src/paint-messages.js';

/** Selection tools operate on a copyable mask. Closing never changes the source asset. */
export default function PaintCutoutEditor({source,onClose,onUse,onSave,onMask,initialMask}) {
  const {name}=source,raster=useMemo(()=>source.nativeSource?flattenPaintRasterAlpha(source.raster):source.raster,[source]),canvas=useRef(),maskCanvas=useRef(),drag=useRef(null),scroll=useRef(),image=useRef();
  const [tool,setTool]=useState('crop'),[cropShape,setCropShape]=useState('rectangle'),[operation,setOperation]=useState('replace'),[tolerance,setTolerance]=useState(32),[contiguous,setContiguous]=useState(true),[feather,setFeather]=useState(0),[zoom,setZoom]=useState(()=>[8,4,2,1,.5,.25].find(v=>raster.width*v<window.innerWidth-160&&raster.height*v<window.innerHeight-300)||.25);
  const [mask,setMask]=useState(()=>initialMask?new Uint8ClampedArray(initialMask):new Uint8ClampedArray(raster.width*raster.height).fill(255)),[points,setPoints]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const navigation=usePaintImageNavigation(scroll,image,zoom,setZoom);
  const history=useRef([]),redo=useRef([]);
  const [hoverPoint,setHoverPoint]=useState(null),[crop,setCrop]=useState(null),polygonOperation=useRef('replace');
  const selectedCount=useMemo(()=>mask.reduce((n,value)=>n+(value>127?1:0),0),[mask]);
  const instructions={crop:crop?'Drag inside to move it. Drag a corner to resize it.':'Drag to set the crop.',lasso:'Draw around the patch. Release to close it.',polygon:'Click corners. Click the first point or press Enter to finish. Backspace removes a point.',wand:'Click a color. Tolerance controls how much is selected.'};
  const maskShape=id=>id==='square'?'rectangle':id==='circle'?'ellipse':id;
  const cropBounds=value=>{const left=Math.min(value.start.x,value.end.x),right=Math.max(value.start.x,value.end.x),top=Math.min(value.start.y,value.end.y),bottom=Math.max(value.start.y,value.end.y);return{left,right,top,bottom,width:right-left,height:bottom-top};};
  const cropMask=value=>combineSelection(value.baseMask,shapeSelection(raster.width,raster.height,maskShape(value.shape),[value.start,value.end]),value.operation);
  function cropPoints(shape,start,end){
    const a={x:Math.round(start.x),y:Math.round(start.y)},pointer={x:Math.round(end.x),y:Math.round(end.y)};
    if(shape==='square'||shape==='circle'){const size=Math.round(Math.max(Math.abs(pointer.x-a.x),Math.abs(pointer.y-a.y)));pointer.x=a.x+Math.sign(pointer.x-a.x||1)*size;pointer.y=a.y+Math.sign(pointer.y-a.y||1)*size;}
    return[{x:Math.min(a.x,pointer.x),y:Math.min(a.y,pointer.y)},{x:Math.max(a.x,pointer.x),y:Math.max(a.y,pointer.y)}];
  }
  function remember(previous){history.current.push(previous);while(history.current.length>16||history.current.length*previous.length>64*1024*1024)history.current.shift();redo.current=[];}
  function changeTool(id){drag.current=null;setTool(id);setCrop(null);setPoints([]);setHoverPoint(null);}
  useEffect(()=>{paintRasterCanvas(raster,canvas.current);},[raster]);
  const softened=useMemo(()=>featherSelection(mask,raster.width,raster.height,feather),[mask,feather,raster]);
  useEffect(()=>{
    const data=new Uint8ClampedArray(mask.length*4),w=raster.width;
    for(let i=0;i<mask.length;i++){const x=i%w;data.set([10,12,18,Math.round((255-softened[i])*.6)],i*4);
      if(softened[i]>127&&(!x||i<w||x===w-1||i>=mask.length-w||softened[i-1]<128||softened[i+1]<128||softened[i-w]<128||softened[i+w]<128))data.set([255,230,100,255],i*4);}
    paintRasterCanvas({width:w,height:raster.height,data},maskCanvas.current);
  },[softened,raster]);
  const point=event=>{const rect=canvas.current.getBoundingClientRect();return{x:(event.clientX-rect.left)*raster.width/rect.width,y:(event.clientY-rect.top)*raster.height/rect.height};};
  function commit(next){remember(mask);setMask(next);setCrop(null);setError('');}
  function select(next,event){commit(combineSelection(mask,next,event?.shiftKey?'add':event?.ctrlKey||event?.altKey?'subtract':operation));}
  function beginCrop(p,event){
    const bounds=crop&&cropBounds(crop),corners=bounds&&[
      ['nw',{x:bounds.left,y:bounds.top},{x:bounds.right,y:bounds.bottom}],['ne',{x:bounds.right,y:bounds.top},{x:bounds.left,y:bounds.bottom}],
      ['se',{x:bounds.right,y:bounds.bottom},{x:bounds.left,y:bounds.top}],['sw',{x:bounds.left,y:bounds.bottom},{x:bounds.right,y:bounds.top}],
    ],near=corners?.find(([,corner])=>Math.hypot(p.x-corner.x,p.y-corner.y)*zoom<=10);
    if(near){drag.current={type:'crop',mode:'resize',anchor:near[2],source:crop,beforeMask:mask};return;}
    if(bounds&&p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<=bounds.bottom){drag.current={type:'crop',mode:'move',anchor:p,source:crop,beforeMask:mask};return;}
    const shape=cropShape,operationAtStart=event.shiftKey?'add':event.ctrlKey||event.altKey?'subtract':operation,[start,end]=cropPoints(shape,p,p),next={shape,start,end,baseMask:mask,operation:operationAtStart};
    drag.current={type:'crop',mode:'new',anchor:p,source:null,beforeMask:mask,next};setCrop(next);setMask(cropMask(next));
  }
  function down(event){
    if(event.button!==0)return;event.preventDefault();const p=point(event);
    if(tool==='wand'){select(magicSelection(raster,p.x,p.y,tolerance,contiguous),event);return;}
    if(tool==='polygon'){
      if(points.length>=3&&Math.hypot(p.x-points[0].x,p.y-points[0].y)*zoom<=9){polygon();return;}
      if(!points.length)polygonOperation.current=event.shiftKey?'add':event.ctrlKey||event.altKey?'subtract':operation;
      if(event.detail!==2)setPoints(previous=>[...previous,p]);return;
    }
    if(tool==='crop')beginCrop(p,event);else{drag.current={type:'lasso',points:[p],operation:event.shiftKey?'add':event.ctrlKey||event.altKey?'subtract':operation};setPoints([p,p]);}
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event){
    const pointer=point(event);if(tool==='polygon')setHoverPoint(pointer);
    if(!drag.current)return;const current=drag.current;
    if(current.type==='crop'){
      let next;
      if(current.mode==='move'){
        const bounds=cropBounds(current.source),dx=Math.max(-bounds.left,Math.min(raster.width-bounds.right,Math.round(pointer.x-current.anchor.x))),dy=Math.max(-bounds.top,Math.min(raster.height-bounds.bottom,Math.round(pointer.y-current.anchor.y)));
        next={...current.source,start:{x:current.source.start.x+dx,y:current.source.start.y+dy},end:{x:current.source.end.x+dx,y:current.source.end.y+dy}};
      }else{const shape=current.source?.shape||cropShape,[start,end]=cropPoints(shape,current.mode==='resize'?current.anchor:current.anchor,pointer);next={...(current.source||current.next),shape,start,end};}
      current.next=next;setCrop(next);setMask(cropMask(next));return;
    }
    const previous=current.points.at(-1);if(Math.hypot(pointer.x-previous.x,pointer.y-previous.y)<1)return;current.points.push(pointer);setPoints([...current.points]);
  }
  function up(event){if(!drag.current)return;move(event);const current=drag.current;drag.current=null;if(current.type==='crop'){const next=current.next;if(!next||!cropBounds(next).width||!cropBounds(next).height){setMask(current.beforeMask);setCrop(current.source);return;}remember(current.beforeMask);setCrop(next);setMask(cropMask(next));setError('');return;}commit(combineSelection(mask,shapeSelection(raster.width,raster.height,'lasso',current.points),current.operation));setPoints([]);}
  function cancelDrag(){const current=drag.current;drag.current=null;if(current?.type==='crop'){setMask(current.beforeMask);setCrop(current.source);}setPoints([]);}
  function polygon(){if(points.length<3)return;commit(combineSelection(mask,shapeSelection(raster.width,raster.height,'polygon',points),polygonOperation.current));setPoints([]);}
  async function act(callback,whole=false){if(busy)return;setBusy(true);setError('');try{await callback({name,raster:whole?raster:extractPaintCutout(raster,softened),whole});}catch(e){setError(e.message);}finally{setBusy(false);}}
  function changeCropShape(shape){
    setCropShape(shape);if(!crop)return;const bounds=cropBounds(crop),side=Math.min(bounds.width,bounds.height),end=shape==='square'||shape==='circle'?{x:bounds.left+side,y:bounds.top+side}:{x:bounds.right,y:bounds.bottom},next={...crop,shape,start:{x:bounds.left,y:bounds.top},end};remember(mask);setCrop(next);setMask(cropMask(next));
  }
  const a=points[0],b=points.at(-1);
  const keyHint=keys=><kbd className="paint-key" aria-hidden="true">{keys}</kbd>;
  function keydown(event){
    event.stopPropagation();if(event.key!=='Escape'&&(event.target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)))return;
    const key=/^Key[A-Z]$/.test(event.code)?event.code.slice(3).toLowerCase():event.key.toLowerCase(),ctrl=event.ctrlKey||event.metaKey;let action;
    if(key==='escape')action=()=>{if(drag.current||points.length)cancelDrag();else if(!busy)onClose();};
    else if(key==='backspace'&&tool==='polygon')action=()=>setPoints(previous=>previous.slice(0,-1));
    else if(ctrl&&points.length&&['enter','s'].includes(key))action=()=>setError('Finish the outline first: Enter. Esc cancels it.');
    else if(ctrl)action=({z:()=>{if(history.current.length){redo.current.push(mask);setMask(history.current.pop());setCrop(null);}},y:()=>{if(redo.current.length){history.current.push(mask);setMask(redo.current.pop());setCrop(null);}},enter:()=>onMask?onMask(softened):act(onUse),s:()=>onSave&&act(onSave),t:()=>onUse&&act(onUse,true)})[key];
    else if(['r','l','p','w'].includes(key))action=()=>changeTool(({r:'crop',l:'lasso',p:'polygon',w:'wand'})[key]);
    else action=({a:()=>commit(new Uint8ClampedArray(mask.length).fill(255)),n:()=>commit(new Uint8ClampedArray(mask.length)),i:()=>commit(Uint8ClampedArray.from(mask,v=>255-v)),o:()=>setOperation(v=>{const a=['replace','add','subtract','intersect'];return a[(a.indexOf(v)+1)%a.length];}),c:()=>setContiguous(v=>!v),f:()=>document.querySelector('[aria-label="Selection feather"]')?.focus(),t:()=>document.querySelector('[aria-label="Selection tolerance"]')?.focus(),'=':()=>setZoom(v=>Math.min(32,v*1.25)),'+':()=>setZoom(v=>Math.min(32,v*1.25)),'-':()=>setZoom(v=>Math.max(.05,v/1.25)),'0':()=>setZoom([8,4,2,1,.5,.25].find(v=>raster.width*v<window.innerWidth-160&&raster.height*v<window.innerHeight-300)||.25),enter:()=>{if(tool==='polygon')polygon();else if(onMask)onMask(softened);else act(onUse);}})[key];
    if(action){event.preventDefault();action();}
  }

  return <div className="paint-modal-shade" tabIndex={-1} onKeyDown={keydown}>
    <section className="paint-cutout-dialog" role="dialog" aria-modal="true" aria-label={onMask?'Paint region':msg('paint.cutout')}>
      <header><strong>{onMask?'Paint region · Destination':msg('paint.cutout')} · {name}</strong><button autoFocus disabled={busy} onClick={onClose}>{msg('paint.close')}{keyHint('Esc')}</button></header>
      <div className="paint-cutout-toolbar">{['crop','lasso','polygon','wand'].map(id=><button key={id} aria-pressed={tool===id} onClick={()=>changeTool(id)}>{msg('paint.select.'+id)}{keyHint(({crop:'R',lasso:'L',polygon:'P',wand:'W'})[id])}</button>)}
        {keyHint('O')}<select aria-label={msg('paint.selectionMode')} value={operation} onChange={e=>setOperation(e.target.value)}>{['replace','add','subtract','intersect'].map(id=><option key={id} value={id}>{msg('paint.select.'+id)}</option>)}</select>
        <button onClick={()=>commit(new Uint8ClampedArray(mask.length).fill(255))}>{msg('paint.select.all')}{keyHint('A')}</button><button onClick={()=>commit(new Uint8ClampedArray(mask.length))}>{msg('paint.select.none')}{keyHint('N')}</button><button onClick={()=>commit(Uint8ClampedArray.from(mask,v=>255-v))}>{msg('paint.select.invert')}{keyHint('I')}</button>
        <button disabled={!history.current.length} onClick={()=>{redo.current.push(mask);setMask(history.current.pop());setCrop(null);}}>{msg('paint.undo')}{keyHint('Ctrl+Z')}</button><button disabled={!redo.current.length} onClick={()=>{history.current.push(mask);setMask(redo.current.pop());setCrop(null);}}>{msg('paint.redo')}{keyHint('Ctrl+Y')}</button>
      </div>
      <div className="paint-cutout-toolbar">
        {tool==='crop'&&<label>{msg('paint.cropShape')} <select aria-label={msg('paint.cropShape')} value={cropShape} onChange={e=>changeCropShape(e.target.value)}>{['rectangle','square','ellipse','circle'].map(id=><option key={id} value={id}>{msg('paint.select.'+id)}</option>)}</select></label>}
        {tool==='wand'&&<><label>{msg('paint.tolerance')} {keyHint('T')}<input aria-label="Selection tolerance" type="range" min="0" max="255" value={tolerance} onChange={e=>setTolerance(+e.target.value)}/>{tolerance}</label><label><input type="checkbox" checked={contiguous} onChange={e=>setContiguous(e.target.checked)}/>{msg('paint.contiguous')}{keyHint('C')}</label></>}
        <label>{msg('paint.feather')} {keyHint('F')}<input aria-label="Selection feather" type="number" min="0" max="32" value={feather} onChange={e=>setFeather(Math.max(0,Math.min(32,+e.target.value)))}/></label>
        <label>{msg('paint.zoom')} {keyHint('− + / 0')}<select value={zoom} onChange={e=>setZoom(+e.target.value)}>{[...new Set([.25,.5,1,2,4,8,zoom])].sort((a,b)=>a-b).map(v=><option key={v} value={v}>{Math.round(v*100)}%</option>)}</select></label>
        {tool==='polygon'&&<button disabled={points.length<3} onClick={polygon}>{msg('paint.finishSelection')}{keyHint('Enter')}</button>}
        <small>{raster.width} × {raster.height} · Wheel zoom / Right-drag pan</small>
      </div>
      <div className="paint-selection-guide" role="status"><strong>{msg('paint.select.'+tool)}</strong><span>{instructions[tool]}</span><small>{points.length?'Esc cancels the outline':'Bright area = selected. Dark area = protected.'}</small><span>{Math.round(selectedCount/mask.length*100)}% selected</span></div>
      <div ref={scroll} className="paint-cutout-scroll" {...navigation}><div ref={image} className="paint-cutout-image" style={{width:raster.width*zoom,height:raster.height*zoom}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancelDrag} onDoubleClick={()=>{if(tool==='polygon')polygon();}}>
        <canvas ref={canvas}/><canvas ref={maskCanvas}/><svg viewBox={`0 0 ${raster.width} ${raster.height}`}>{tool==='crop'&&crop&&(()=>{const bounds=cropBounds(crop),size=8/zoom,corners=[['nw',bounds.left,bounds.top],['ne',bounds.right,bounds.top],['se',bounds.right,bounds.bottom],['sw',bounds.left,bounds.bottom]];return <>{crop.shape==='ellipse'||crop.shape==='circle'?<ellipse className="paint-crop-shape" cx={(bounds.left+bounds.right)/2} cy={(bounds.top+bounds.bottom)/2} rx={bounds.width/2} ry={bounds.height/2}/>:<rect className="paint-crop-shape" x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height}/>}<g>{corners.map(([id,x,y])=><rect key={id} data-corner={id} className="paint-crop-handle" x={x-size/2} y={y-size/2} width={size} height={size}/>)}</g></>;})()}{a&&b&&tool==='lasso'&&<><polygon className="paint-selection-fill" points={points.map(p=>p.x+','+p.y).join(' ')}/><polyline points={points.map(p=>p.x+','+p.y).join(' ')}/></>}{tool==='polygon'&&a&&b&&<><polygon className="paint-selection-fill" points={[...points,...(hoverPoint?[hoverPoint]:[])].map(p=>p.x+','+p.y).join(' ')}/><polyline points={points.map(p=>p.x+','+p.y).join(' ')}/>{hoverPoint&&<path className="paint-selection-closing" d={`M${b.x},${b.y}L${hoverPoint.x},${hoverPoint.y}L${a.x},${a.y}`}/>}<g>{points.map((p,i)=><g key={i}><circle className={i===0?'paint-selection-first':''} cx={p.x} cy={p.y} r={(i===0?6:4)/zoom}/><text x={p.x+9/zoom} y={p.y-8/zoom} fontSize={12/zoom}>{i+1}</text></g>)}</g></>}</svg>
      </div></div>
      {error&&<p role="alert">{error}</p>}
      <footer>{onMask?<><button disabled={!!points.length} onClick={()=>onMask(softened)}>Use paint region{keyHint('Ctrl+Enter')}</button><span>Only the selected destination pixels can receive paint. Subtract around details to protect them.</span></>:<><button disabled={busy||!!points.length} onClick={()=>act(onUse)}>{msg('paint.useCutout')}{keyHint('Ctrl+Enter')}</button><button disabled={busy} onClick={()=>act(onUse,true)}>{msg('paint.useTexture')}{keyHint('Ctrl+T')}</button><button disabled={busy||!!points.length} onClick={()=>act(onSave)}>{msg('paint.saveTexture')}{keyHint('Ctrl+S')}</button><span>{msg('paint.cutoutHelp')}</span></>}</footer>
    </section>
  </div>;
}
