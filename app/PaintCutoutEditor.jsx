import React,{useEffect,useMemo,useRef,useState} from 'react';
import {shapeSelection,magicSelection,combineSelection,featherSelection,extractPaintCutout} from '../src/paint-selection.js';
import {flattenPaintRasterAlpha} from '../src/paint-raster.js';
import {paintRasterCanvas} from './paint-raster.js';
import {paintMessage as msg} from '../src/paint-messages.js';

/** Selection tools operate on a copyable mask. Closing never changes the source asset. */
export default function PaintCutoutEditor({source,onClose,onUse,onSave}) {
  const {name}=source,raster=useMemo(()=>source.nativeSource?flattenPaintRasterAlpha(source.raster):source.raster,[source]),canvas=useRef(),maskCanvas=useRef(),drag=useRef(null);
  const [tool,setTool]=useState('rectangle'),[operation,setOperation]=useState('replace'),[tolerance,setTolerance]=useState(32),[contiguous,setContiguous]=useState(true),[feather,setFeather]=useState(0),[zoom,setZoom]=useState(1);
  const [mask,setMask]=useState(()=>new Uint8ClampedArray(raster.width*raster.height).fill(255)),[points,setPoints]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const history=useRef([]),redo=useRef([]),[square,setSquare]=useState(false);
  useEffect(()=>{paintRasterCanvas(raster,canvas.current);},[raster]);
  const softened=useMemo(()=>featherSelection(mask,raster.width,raster.height,feather),[mask,feather,raster]);
  useEffect(()=>{
    const data=new Uint8ClampedArray(mask.length*4),w=raster.width;
    for(let i=0;i<mask.length;i++){const x=i%w;data.set([10,12,18,Math.round((255-softened[i])*.6)],i*4);
      if(softened[i]>127&&(!x||i<w||x===w-1||i>=mask.length-w||softened[i-1]<128||softened[i+1]<128||softened[i-w]<128||softened[i+w]<128))data.set([255,230,100,255],i*4);}
    paintRasterCanvas({width:w,height:raster.height,data},maskCanvas.current);
  },[softened,raster]);
  const point=event=>{const rect=canvas.current.getBoundingClientRect();return{x:(event.clientX-rect.left)*raster.width/rect.width,y:(event.clientY-rect.top)*raster.height/rect.height};};
  function commit(next){history.current.push(mask);while(history.current.length>16||history.current.length*mask.length>64*1024*1024)history.current.shift();redo.current=[];setMask(next);setError('');}
  function select(next,event){commit(combineSelection(mask,next,event?.shiftKey?'add':event?.ctrlKey||event?.altKey?'subtract':operation));}
  function down(event){
    if(event.button!==0)return;event.preventDefault();const p=point(event);
    if(tool==='wand'){select(magicSelection(raster,p.x,p.y,tolerance,contiguous),event);return;}
    if(tool==='polygon'){setPoints(previous=>[...previous,p]);return;}
    drag.current={points:[p],square,operation:event.shiftKey?'add':event.ctrlKey||event.altKey?'subtract':operation};
    event.currentTarget.setPointerCapture(event.pointerId);setPoints([p,p]);
  }
  function move(event){
    if(!drag.current)return;let p=point(event),current=drag.current;
    if(tool==='lasso'){const previous=current.points.at(-1);if(Math.hypot(p.x-previous.x,p.y-previous.y)<1)return;current.points.push(p);setPoints([...current.points]);}
    else{if(current.square){const a=current.points[0],size=Math.max(Math.abs(p.x-a.x),Math.abs(p.y-a.y));p={x:a.x+Math.sign(p.x-a.x||1)*size,y:a.y+Math.sign(p.y-a.y||1)*size};}current.points=[current.points[0],p];setPoints(current.points);}
  }
  function up(event){if(!drag.current)return;move(event);const current=drag.current;drag.current=null;commit(combineSelection(mask,shapeSelection(raster.width,raster.height,tool,current.points),current.operation));setPoints([]);}
  function polygon(){if(points.length<3)return;select(shapeSelection(raster.width,raster.height,'polygon',points));setPoints([]);}
  async function act(callback,whole=false){if(busy)return;setBusy(true);setError('');try{await callback({name,raster:whole?raster:extractPaintCutout(raster,softened),whole});}catch(e){setError(e.message);}finally{setBusy(false);}}
  const a=points[0],b=points.at(-1);
  return <div className="paint-modal-shade" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){if(points.length)setPoints([]);else if(!busy)onClose();}if(event.key==='Enter'&&tool==='polygon')polygon();}}>
    <section className="paint-cutout-dialog" role="dialog" aria-modal="true" aria-label={msg('paint.cutout')}>
      <header><strong>{msg('paint.cutout')} · {name}</strong><button disabled={busy} onClick={onClose}>{msg('paint.close')}</button></header>
      <div className="paint-cutout-toolbar">{['rectangle','ellipse','lasso','polygon','wand'].map(id=><button key={id} aria-pressed={tool===id} onClick={()=>{setTool(id);setPoints([]);}}>{msg('paint.select.'+id)}</button>)}
        <select aria-label={msg('paint.selectionMode')} value={operation} onChange={e=>setOperation(e.target.value)}>{['replace','add','subtract','intersect'].map(id=><option key={id} value={id}>{msg('paint.select.'+id)}</option>)}</select>
        <button onClick={()=>commit(new Uint8ClampedArray(mask.length).fill(255))}>{msg('paint.select.all')}</button><button onClick={()=>commit(new Uint8ClampedArray(mask.length))}>{msg('paint.select.none')}</button><button onClick={()=>commit(Uint8ClampedArray.from(mask,v=>255-v))}>{msg('paint.select.invert')}</button>
        <button disabled={!history.current.length} onClick={()=>{redo.current.push(mask);setMask(history.current.pop());}}>{msg('paint.undo')}</button><button disabled={!redo.current.length} onClick={()=>{history.current.push(mask);setMask(redo.current.pop());}}>{msg('paint.redo')}</button>
      </div>
      <div className="paint-cutout-toolbar">
        {(tool==='rectangle'||tool==='ellipse')&&<label><input type="checkbox" checked={square} onChange={e=>setSquare(e.target.checked)}/>{msg('paint.select.square')}</label>}
        {tool==='wand'&&<><label>{msg('paint.tolerance')} <input type="range" min="0" max="255" value={tolerance} onChange={e=>setTolerance(+e.target.value)}/>{tolerance}</label><label><input type="checkbox" checked={contiguous} onChange={e=>setContiguous(e.target.checked)}/>{msg('paint.contiguous')}</label></>}
        <label>{msg('paint.feather')} <input type="number" min="0" max="32" value={feather} onChange={e=>setFeather(Math.max(0,Math.min(32,+e.target.value)))}/></label>
        <label>{msg('paint.zoom')} <select value={zoom} onChange={e=>setZoom(+e.target.value)}>{[.25,.5,1,2,4,8].map(v=><option key={v} value={v}>{v*100}%</option>)}</select></label>
        {tool==='polygon'&&<button disabled={points.length<3} onClick={polygon}>{msg('paint.finishSelection')}</button>}
        <small>{raster.width} × {raster.height} · {msg(tool==='polygon'?'paint.polygonHelp':'paint.selectionHelp')}</small>
      </div>
      <div className="paint-cutout-scroll"><div className="paint-cutout-image" style={{width:raster.width*zoom,height:raster.height*zoom}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;setPoints([]);}} onDoubleClick={()=>{if(tool==='polygon')polygon();}}>
        <canvas ref={canvas}/><canvas ref={maskCanvas}/><svg viewBox={`0 0 ${raster.width} ${raster.height}`}>{a&&b&&(tool==='rectangle'?<rect x={Math.min(a.x,b.x)} y={Math.min(a.y,b.y)} width={Math.abs(b.x-a.x)} height={Math.abs(b.y-a.y)}/>:tool==='ellipse'?<ellipse cx={(a.x+b.x)/2} cy={(a.y+b.y)/2} rx={Math.abs(b.x-a.x)/2} ry={Math.abs(b.y-a.y)/2}/>:<polyline points={points.map(p=>p.x+','+p.y).join(' ')}/>)}</svg>
      </div></div>
      {error&&<p role="alert">{error}</p>}
      <footer><button disabled={busy} onClick={()=>act(onUse)}>{msg('paint.useCutout')}</button><button disabled={busy} onClick={()=>act(onUse,true)}>{msg('paint.useTexture')}</button><button disabled={busy} onClick={()=>act(onSave)}>{msg('paint.saveTexture')}</button><span>{msg('paint.cutoutHelp')}</span></footer>
    </section>
  </div>;
}
