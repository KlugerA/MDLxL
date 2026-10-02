import {PaintTool} from './PaintIcon.jsx';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {PAINT_ASSETS,cropNativePaintAsset} from '../src/paint-assets.js';
import {decodePaintImage,paintRasterCanvas} from './paint-raster.js';
import {resizePaintRaster} from '../src/paint-raster.js';
import {paintMessage as msg} from '../src/paint-messages.js';

const demoIds=new Set(['wc3-chainmail','wc3-steel','wc3-riveted-plate','wc3-orc-skin','wc3-wood']);
const demoAssets=PAINT_ASSETS.filter(a=>demoIds.has(a.id));
const thumbnailCache=new Map(),nativeSources=new Map();let thumbnailQueue=Promise.resolve();
async function readNativeSource(item){
  if(!window.desktop?.resolveTextures)throw Error('Open the desktop editor and connect Warcraft III data to use native sources.');
  let pending=nativeSources.get(item.sourcePath);
  if(!pending){pending=(async()=>{const assets=await window.desktop.resolveTextures({names:[item.sourcePath]}),asset=assets.find(a=>a.bytes?.length);if(!asset)throw Error('This source is unavailable in your configured Warcraft III data.');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',asset.bytes)),v=>v.toString(16).padStart(2,'0')).join('');return {raster:await decodePaintImage(asset.bytes,asset.name),hash};})();nativeSources.set(item.sourcePath,pending);pending.catch(()=>nativeSources.delete(item.sourcePath));}
  return pending;
}
function Tile({item,onUse,selected}) {
  const ref=useRef(),[url,setUrl]=useState(item.thumbnail||thumbnailCache.get(item.signature)||''),[error,setError]=useState('');
  useEffect(()=>{
    if(item.thumbnail)return;let active=true;
    const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();
      thumbnailQueue=thumbnailQueue.catch(()=>{}).then(async()=>{
        if(!active)return;let image=thumbnailCache.get(item.signature);
        if(!image){const {raster}=await readShelfTexture(item),scale=72/Math.max(raster.width,raster.height);image=paintRasterCanvas(resizePaintRaster(raster,Math.max(1,Math.round(raster.width*scale)),Math.max(1,Math.round(raster.height*scale)))).toDataURL();thumbnailCache.set(item.signature,image);if(thumbnailCache.size>256)thumbnailCache.delete(thumbnailCache.keys().next().value);}
        if(active)setUrl(image);
      }).catch(e=>{if(active)setError(e.message);});
    },{rootMargin:'40px'});observer.observe(ref.current);return()=>{active=false;observer.disconnect();};
  },[item.signature]);
  return <button ref={ref} className="paint-shelf-tile" title={error||item.sourcePath||item.name} aria-label={item.name} aria-pressed={selected} onClick={()=>onUse(item)}>{url?<img src={url} alt="" loading="lazy" draggable={false}/>:<span className="paint-source-missing">{error?'Unavailable':'Loading…'}</span>}<span>{item.name}</span></button>;
}
export async function readShelfTexture(item) {
  if(item.sourcePath){const source=await readNativeSource(item);return {name:item.name,raster:cropNativePaintAsset(item,source.raster),sourcePath:item.sourcePath,nativeSource:true,exactStamp:item.application==='detail',provenance:{...item.provenance,sourceSha256:source.hash}};}
  const asset=await window.desktop.readPaintTexture(item.id);return {name:asset.name,raster:await decodePaintImage(asset.bytes,asset.name)};
}
function PaintTextureShelf({onUse,onCut,onNative,onImport,onFolderChange,epoch=0,onStatus}) {
  const native=!!window.desktop?.listPaintTextures,[catalog,setCatalog]=useState({items:[],folders:['']}),[collection,setCollection]=useState('native'),[folder,setFolder]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(40),[selected,setSelected]=useState(null);
  const refresh=useCallback(async()=>{try{
    const next=native?await window.desktop.listPaintTextures():{items:[],folders:['']};
    setCatalog(next);onFolderChange?.(next.folders);
  }catch(e){onStatus?.(e.message,true);}},[native]);
  useEffect(()=>{refresh();window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[refresh,epoch]);
  const sourceCatalog=useMemo(()=>collection==='native'?{items:demoAssets.map(a=>({...a,folder:a.category,signature:a.id})),folders:['',...new Set(demoAssets.map(a=>a.category))]}:catalog,[collection,catalog]);
  const items=useMemo(()=>sourceCatalog.items.filter(item=>(!folder||item.folder===folder||item.folder.startsWith(folder+'/'))&&(!query||(item.name+' '+item.id).toLowerCase().includes(query.toLowerCase().trim()))),[sourceCatalog,folder,query]);
  useEffect(()=>setLimit(40),[folder,query]);
  useEffect(()=>{if(epoch){setCollection('mine');setFolder('');setQuery('');}},[epoch]);
  const act=async(item,callback)=>{try{await callback(await readShelfTexture(item));}catch(e){onStatus?.(e.message,true);}};
  return <section className="paint-material-section"><div className="paint-shelf-heading"><h3>Texture shelf</h3><PaintTool icon="crop" label="Crop selected palette texture" disabled={!selected} onClick={()=>act(selected,onCut)}/></div>
    <div className="paint-button-row"><button onClick={onNative}>WC3 library…</button><button onClick={onImport}>From file…</button></div>
    <div className="paint-brush-grid" role="group" aria-label="Source collection"><button aria-pressed={collection==='native'} onClick={()=>{setCollection('native');setFolder('');}}>5 starters</button><button aria-pressed={collection==='mine'} onClick={()=>{setCollection('mine');setFolder('');}}>My library</button></div>
    {collection==='mine'&&<select aria-label={msg('paint.textureFolder')} value={folder} onChange={e=>setFolder(e.target.value)}>{sourceCatalog.folders.map(id=><option key={id} value={id}>{id||msg('paint.allFolders')}</option>)}</select>}
    {collection==='mine'&&<input aria-label={msg('paint.searchTextures')} type="search" placeholder="Find texture…" value={query} onChange={e=>setQuery(e.target.value)}/>}
    <div className="paint-material-grid">{items.slice(0,limit).map(item=><Tile key={item.signature||item.id} item={item} selected={selected?.id===item.id} onUse={item=>act(item,source=>{onUse(source);setSelected(item);})}/>)}</div>
    {collection==='mine'&&!items.length&&<p className="paint-help">Your own texture collection. Import an image or cut a piece from Warcraft, then choose Keep.</p>}
    {items.length>limit&&<button onClick={()=>setLimit(n=>n+40)}>{msg('paint.showMore')}</button>}
    {collection==='mine'&&<div className="paint-button-row"><button onClick={refresh}>{msg('paint.refresh')}</button>{native&&<button onClick={()=>window.desktop.openPaintTextureFolder().catch(e=>onStatus?.(e.message,true))}>{msg('paint.openFolder')}</button>}</div>}
  </section>;
}

export default React.memo(PaintTextureShelf);
