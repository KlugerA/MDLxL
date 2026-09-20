import {PaintTool} from './PaintIcon.jsx';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {PAINT_ASSETS} from '../src/paint-assets.js';
import {decodePaintImage,fetchPaintRaster,paintRasterCanvas} from './paint-raster.js';
import {resizePaintRaster} from '../src/paint-raster.js';
import {paintMessage as msg} from '../src/paint-messages.js';

const thumbnailCache=new Map();let thumbnailQueue=Promise.resolve();
function Tile({item,onUse,selected}) {
  const ref=useRef(),[url,setUrl]=useState(item.thumbnail||thumbnailCache.get(item.signature)||''),[error,setError]=useState('');
  useEffect(()=>{
    if(item.thumbnail)return;let active=true;
    const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();
      thumbnailQueue=thumbnailQueue.catch(()=>{}).then(async()=>{
        if(!active)return;let image=thumbnailCache.get(item.signature);
        if(!image){const asset=await window.desktop.readPaintTexture(item.id),raster=await decodePaintImage(asset.bytes,asset.name),scale=72/Math.max(raster.width,raster.height);image=paintRasterCanvas(resizePaintRaster(raster,Math.max(1,Math.round(raster.width*scale)),Math.max(1,Math.round(raster.height*scale)))).toDataURL();thumbnailCache.set(item.signature,image);if(thumbnailCache.size>256)thumbnailCache.delete(thumbnailCache.keys().next().value);}
        if(active)setUrl(image);
      }).catch(e=>{if(active)setError(e.message);});
    },{rootMargin:'40px'});observer.observe(ref.current);return()=>{active=false;observer.disconnect();};
  },[item.signature]);
  return <button ref={ref} className="paint-shelf-tile" title={error||item.name} aria-label={item.name} aria-pressed={selected} onClick={()=>onUse(item)}><img src={url||undefined} alt="" loading="lazy" draggable={false}/><span>{item.name}</span></button>;
}
export async function readShelfTexture(item) {
  if(item.file)return {name:item.name+'.png',raster:await fetchPaintRaster(item.file,512)};
  const asset=await window.desktop.readPaintTexture(item.id);return {name:asset.name,raster:await decodePaintImage(asset.bytes,asset.name)};
}
function PaintTextureShelf({onUse,onCut,onNative,onImport,onFolderChange,epoch=0,onStatus}) {
  const native=!!window.desktop?.listPaintTextures,[catalog,setCatalog]=useState({items:[],folders:['']}),[folder,setFolder]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(40),[selected,setSelected]=useState(null);
  const refresh=useCallback(async()=>{try{
    const next=native?await window.desktop.listPaintTextures():{items:PAINT_ASSETS.map(a=>({id:a.id,name:a.name,folder:a.category,file:a.files[512],thumbnail:a.thumbnail})),folders:['',...new Set(PAINT_ASSETS.map(a=>a.category))]};
    setCatalog(next);onFolderChange?.(next.folders);setFolder(previous=>next.folders.includes(previous)?previous:'');
  }catch(e){onStatus?.(e.message,true);}},[native]);
  useEffect(()=>{refresh();window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[refresh,epoch]);
  const items=useMemo(()=>catalog.items.filter(item=>(!folder||item.folder===folder||item.folder.startsWith(folder+'/'))&&(!query||(item.name+' '+item.id).toLowerCase().includes(query.toLowerCase().trim()))),[catalog,folder,query]);
  useEffect(()=>setLimit(40),[folder,query]);
  const act=async(item,callback)=>{try{await callback(await readShelfTexture(item));}catch(e){onStatus?.(e.message,true);}};
  return <section className="paint-material-section"><div className="paint-shelf-heading"><h3>{msg('paint.materials')}</h3><PaintTool icon="crop" label="Crop selected palette texture" disabled={!selected} onClick={()=>act(selected,onCut)}/></div>
    <select aria-label={msg('paint.textureFolder')} value={folder} onChange={e=>setFolder(e.target.value)}>{catalog.folders.map(id=><option key={id} value={id}>{id||msg('paint.allFolders')}</option>)}</select>
    <input aria-label={msg('paint.searchTextures')} type="search" placeholder="Find texture…" value={query} onChange={e=>setQuery(e.target.value)}/>
    <div className="paint-material-grid">{items.slice(0,limit).map(item=><Tile key={item.signature||item.id} item={item} selected={selected?.id===item.id} onUse={item=>act(item,source=>{onUse(source);setSelected(item);})}/>)}</div>
    {items.length>limit&&<button onClick={()=>setLimit(n=>n+40)}>{msg('paint.showMore')}</button>}
    <details className="paint-library-options"><summary>Library options</summary><div className="paint-button-row"><button onClick={onNative}>{msg('paint.nativeLibrary')}</button><button onClick={onImport}>{msg('paint.addTexture')}</button></div><div className="paint-button-row"><button onClick={refresh}>{msg('paint.refresh')}</button>{native&&<button onClick={()=>window.desktop.openPaintTextureFolder().catch(e=>onStatus?.(e.message,true))}>{msg('paint.openFolder')}</button>}</div></details>
  </section>;
}

export default React.memo(PaintTextureShelf);
