import React,{useEffect,useMemo,useRef,useState} from 'react';
import {backgroundThumbnail} from './asset-preload-client.js';
import {createTextureAssetCache,createTextureLibrarySessions,createThumbnailQueue,createThumbnailLookup,warmTextureLibrarySession} from '../src/texture-library-session.js';
import {textureFolderTree,textureFormatMatches} from '../src/texture-library-search.js';
import {cachedThumbnail,saveThumbnail,peekThumbnail} from '../src/texture-library-cache.js';
import {getUVPreviewSelection} from '../src/uv-preview.js';
import './texture-library.css';
import { translate } from '../src/localization.js';

const librarySessions=createTextureLibrarySessions();
const loadAsset=createTextureAssetCache({resolve:options=>window.desktop?.resolveTextures(options)});
const readNativeThumbnail=createThumbnailLookup(options=>window.desktop?.textureLibraryThumbnails?.(options)||[]);
const thumbnailQueue=createThumbnailQueue({concurrency:4});
const thumbnailJobs=new Map();
let sharedWorker=null,searchSerial=0,libraryConsumers=0;
const warmJobs=new Map();
function preferredVibe(){try{return localStorage.getItem('mdlvis.texture-library.vibe')!=='false';}catch{return true;}}
function preferredFormat(){try{return localStorage.getItem('mdlvis.texture-library.blp-only')==='true'?'blp':'all';}catch{return'all';}}
function libraryWorker(){
  if(!sharedWorker){const created=new Worker(new URL('../src/texture-library-worker.js',import.meta.url),{type:'module'});created.addEventListener('message',({data})=>{if(data.type==='ready')created.warmSignature=data.signature;});created.addEventListener('error',()=>{if(sharedWorker===created){created.terminate();sharedWorker=null;}});sharedWorker=created;}
  return sharedWorker;
}
function warmSearch(catalog,options){
  const w=libraryWorker(),id=++searchSerial;
  return new Promise((resolve,reject)=>{
    const finish=(error,result)=>{clearTimeout(timer);w.removeEventListener('message',message);w.removeEventListener('error',failed);error?reject(error):resolve(result);};
    const search=()=>w.postMessage({type:'search',id,signature:catalog.signature,options});
    const message=({data})=>{if(data.type==='ready'&&data.signature===catalog.signature)search();else if(data.type==='result'&&data.id===id)finish(null,data.result);else if(data.type==='error'&&(data.id===id||data.id==null&&data.signature===catalog.signature))finish(Error(data.message));};
    const failed=event=>finish(Error(event.message||'Texture search could not start.'));
    const timer=setTimeout(()=>finish(Error('Texture search preparation timed out.')),30000);
    w.addEventListener('message',message);w.addEventListener('error',failed);
    if(w.warmSignature===catalog.signature)search();else w.postMessage({type:'init',items:catalog.items,signature:catalog.signature});
  });
}
/** Called only after explicit Yes; the browser opens with its search worker/results ready. */
export function warmTextureLibrary(modelPath){
  const key=String(modelPath||'');if(warmJobs.has(key))return warmJobs.get(key);
  const vibe=preferredVibe(),format=preferredFormat();
  const job=warmTextureLibrarySession({sessions:librarySessions,modelPath,vibe,format,loadCatalog:()=>window.desktop.textureLibraryCatalog({modelPath}),canWarm:()=>libraryConsumers===0,search:warmSearch});
  warmJobs.set(key,job);job.finally(()=>warmJobs.delete(key)).catch(()=>{});return job;
}
async function thumbnail(item,modelPath){
  if(thumbnailJobs.has(item.cacheKey))return thumbnailJobs.get(item.cacheKey);
  const job=(async()=>{
    const cached=await cachedThumbnail(item.cacheKey);if(cached)return cached;
    const native=await readNativeThumbnail(item.cacheKey).catch(()=>null);
    if(native){await saveThumbnail(item.cacheKey,native);return native;}
    return thumbnailQueue(item.cacheKey,async()=>{
      const asset=await loadAsset(item,modelPath),url=await backgroundThumbnail(asset,item.cacheKey);
      await saveThumbnail(item.cacheKey,url);
      if(window.desktop?.textureLibrarySaveThumbnail)await window.desktop.textureLibrarySaveThumbnail({key:item.cacheKey,url}).catch(()=>{});
      return url;
    });
  })();thumbnailJobs.set(item.cacheKey,job);try{return await job;}finally{thumbnailJobs.delete(item.cacheKey);}
}
function TextureTile({item,modelPath,selected,onSelect,cacheEpoch}){
  const ref=useRef(),[image,setImage]=useState(()=>peekThumbnail(item.cacheKey)),[error,setError]=useState('');
  useEffect(()=>{
    let active=true,started=false;setImage(peekThumbnail(item.cacheKey));setError('');
    const start=()=>{if(started)return;started=true;thumbnail(item,modelPath).then(url=>{if(active)setImage(url);}).catch(error=>{if(active)setError(error.message);});};
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();start();}},{rootMargin:'80px'});observer.observe(ref.current);
    return()=>{active=false;observer.disconnect();};
  },[item.cacheKey,modelPath,cacheEpoch]);
  return <button ref={ref} type="button" className={'tl-tile'+(selected?' selected':'')} onClick={()=>onSelect(item)} aria-pressed={selected} title={item.sourcePath}>
    <span className="tl-tile-image">{image?<img src={image} alt="" loading="lazy" decoding="async"/>:<span>{error?'Unavailable':'…'}</span>}</span><span className="tl-tile-name" translate="no">{item.name}</span>
    <small>{item.source==='custom'?'Model folder':item.variant==='reforged'?'Reforged':item._match?.type==='inspiration'?'Kitbash suggestion':item._match?.type==='close'?'Related surface':'Warcraft III'}</small>
  </button>;
}
function FolderBranch({node,selected,onSelect,depth=0}){
  const [open,setOpen]=useState(depth<1);
  return <div className="tl-folder-branch"><div className={'tl-folder-row'+(selected===node.path?' selected':'')} style={{paddingLeft:4+depth*12}}>
    {node.children.length?<button type="button" className="tl-expand" onClick={()=>setOpen(v=>!v)} aria-label={(open?'Collapse ':'Expand ')+node.name}>{open?'▾':'▸'}</button>:<span className="tl-expand"/>}
    <button type="button" className="tl-folder" translate="no" onClick={()=>onSelect(node.path)} title={node.path}><span translate={node.path && node.name !== 'Model folder' ? 'no' : undefined}>{node.name}</span><small>{node.count}</small></button>
  </div>{open&&node.children.map(child=><FolderBranch key={child.path} node={child} selected={selected} onSelect={onSelect} depth={depth+1}/>)}</div>;
}
export default function TextureLibrary({model,modelPath,onClose,onAddTexture,onPreviewTexture,previewEnabled=false,previewReason='',selectedGeosets,onOpenMaterials,onSelectTexture,selectLabel='Use in Forge'}){
  const initialCatalog=librarySessions.peek(modelPath);
  const [catalog,setCatalog]=useState(initialCatalog),[loading,setLoading]=useState(!initialCatalog),[error,setError]=useState(''),[query,setQuery]=useState(''),[vibe,setVibe]=useState(preferredVibe),[format,setFormat]=useState(preferredFormat),[folder,setFolder]=useState(''),[variant,setVariant]=useState('classic'),[kind,setKind]=useState('all'),[limit,setLimit]=useState(120),[result,setResult]=useState(()=>librarySessions.result(modelPath,initialCatalog?.signature,{query:'',vibe:preferredVibe(),folder:'',variant:'classic',kind:'all',format:preferredFormat(),limit:120})||{items:[],total:0}),[ready,setReady]=useState(false),[searching,setSearching]=useState(false),[selected,setSelected]=useState(null),[selectedAsset,setSelectedAsset]=useState(null),[selectedImage,setSelectedImage]=useState(null),[selectionError,setSelectionError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[cacheEpoch,setCacheEpoch]=useState(0);
  const worker=useRef(),requestId=useRef(0),requestOptions=useRef(null),expectedCatalog=useRef(null),dialog=useRef(),input=useRef();
  const [catalogFresh,setCatalogFresh]=useState(false);
  useEffect(()=>{
    const previous=document.activeElement;input.current?.focus();return()=>previous?.focus?.();
  },[]);
  useEffect(()=>{
    let active=true;expectedCatalog.current=null;setCatalogFresh(false);setLoading(!librarySessions.peek(modelPath));setReady(false);setError('');
    if(!window.desktop?.textureLibraryCatalog){setLoading(false);setError('The native texture library is available in the desktop app.');return;}
    const w=libraryWorker();worker.current=w;libraryConsumers++;
    const onMessage=({data})=>{if(!active)return;if(data.type==='ready'&&expectedCatalog.current!==null&&data.signature===expectedCatalog.current){setReady(true);setLoading(false);}else if(data.type==='result'&&data.id===requestId.current){librarySessions.remember(modelPath,expectedCatalog.current,requestOptions.current,data.result);setResult(data.result);setSearching(false);}else if(data.type==='error'&&(data.id===requestId.current||data.id==null&&expectedCatalog.current!==null&&data.signature===expectedCatalog.current)){setError(data.message);setLoading(false);setSearching(false);}};
    const onError=event=>{if(sharedWorker===w){w.terminate();sharedWorker=null;}if(active){setError(event.message||'Texture search could not start.');setLoading(false);}};
    w.addEventListener('message',onMessage);w.addEventListener('error',onError);
    const useCatalog=data=>{if(!active)return;if(expectedCatalog.current!==data.signature){requestId.current=++searchSerial;setSearching(false);}expectedCatalog.current=data.signature;setCatalog(data);setSelected(previous=>previous&&data.items.some(item=>item.cacheKey===previous.cacheKey)?previous:null);if(!data.items.some(item=>item.variant==='classic'))setVariant('all');if(data.signature&&w.warmSignature===data.signature){setReady(true);setLoading(false);}else{setReady(false);w.postMessage({type:'init',items:data.items,signature:data.signature});}};
    const refreshCatalog=()=>librarySessions.load(modelPath,()=>window.desktop.textureLibraryCatalog({modelPath})).then(data=>{useCatalog(data);if(active)setCatalogFresh(true);}).catch(error=>{if(active){setError(error.message);setLoading(false);}});
    const warm=librarySessions.peek(modelPath);if(warm)useCatalog(warm);
    refreshCatalog();
    const unsubscribe=window.desktop.onTextureLibraryPreloadProgress?.(status=>{if(['complete','cancelled'].includes(status.state)){setCacheEpoch(value=>value+1);refreshCatalog();}});
    return()=>{active=false;libraryConsumers--;unsubscribe?.();w.removeEventListener('message',onMessage);w.removeEventListener('error',onError);worker.current=null;};
  },[modelPath]);
  useEffect(()=>{setLimit(120);},[query,vibe,folder,variant,kind,format]);
  useEffect(()=>{
    if(!ready)return;const options={query,vibe,folder,variant,kind,format,limit},id=++searchSerial;requestId.current=id;requestOptions.current=options;
    const cached=librarySessions.result(modelPath,catalog?.signature,options);if(cached){setResult(cached);setSearching(false);return;}
    setSearching(true);const timer=setTimeout(()=>worker.current?.postMessage({type:'search',id,signature:catalog?.signature,options}),query?100:0);return()=>clearTimeout(timer);
  },[ready,catalog?.signature,modelPath,query,vibe,folder,variant,kind,format,limit]);
  useEffect(()=>{
    let active=true;setSelectedAsset(null);setSelectedImage(null);setSelectionError('');setMessage('');if(!selected)return;
    loadAsset(selected,modelPath).then(asset=>{if(active)setSelectedAsset(asset);}).catch(error=>{if(active)setSelectionError(error.message);});
    thumbnail(selected,modelPath).then(url=>{if(active)setSelectedImage(url);}).catch(error=>{if(active)setSelectionError(error.message);});
    return()=>{active=false;};
  },[selected?.cacheKey,modelPath]);
  const tree=useMemo(()=>textureFolderTree((catalog?.items||[]).filter(item=>(variant==='all'||item.variant===variant)&&textureFormatMatches(item,format))),[catalog,variant,format]);
  const used=useMemo(()=>new Set((model?.Textures||[]).map(t=>String(t.Image||'').replaceAll('/','\\').toLowerCase())),[model,model?.Textures?.length]);
  const checkedPreview=selectedGeosets==null?null:getUVPreviewSelection(model,selectedGeosets);
  const previewAllowed=previewEnabled&&(!checkedPreview||checkedPreview.enabled),disabledPreviewReason=previewReason||checkedPreview?.reason||'Texture preview is unavailable for this selection.';
  const act=async(callback,success)=>{if(!catalogFresh||!selectedAsset||!callback)return;setBusy(true);setSelectionError('');try{await callback(selectedAsset,selected);setMessage(success);}catch(error){setSelectionError(error.message);}finally{setBusy(false);}};
  const changeVariant=value=>{setVariant(value);setFolder('');};
  const keys=event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();if(!busy)onClose();}
    if(event.key==='Tab'){const elements=[...dialog.current.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  };
  return <div className="tl-overlay" onKeyDown={keys}><section ref={dialog} className="tl-dialog" role="dialog" aria-modal="true" aria-label="Material and Texture Library">
    <header className="tl-header"><img src="./classic/wc3-library.png" alt=""/><div><h2>Material &amp; Texture Library</h2><span>Warcraft III textures and textures beside your model</span></div>{onOpenMaterials&&<button type="button" onClick={onOpenMaterials}>Material Manager</button>}<button type="button" aria-label="Close texture library" onClick={onClose} disabled={busy}>✕</button></header>
    <div className="tl-toolbar"><input ref={input} type="search" value={query} placeholder={vibe?'Try rusty chain mail, Nurgle, or a texture name':'Search texture names and paths'} onChange={event=>setQuery(event.target.value)} aria-label="Search textures"/>
      <label title="Search surfaces, colours and kitbash associations"><input type="checkbox" checked={vibe} onChange={event=>{setVibe(event.target.checked);try{localStorage.setItem('mdlvis.texture-library.vibe',String(event.target.checked));}catch{}}}/>Vibe search</label>
      <label title="Hide DDS and other texture formats"><input aria-label="BLP textures only" type="checkbox" checked={format==='blp'} onChange={event=>{const next=event.target.checked?'blp':'all';setFormat(next);if(next==='blp')setSelected(previous=>textureFormatMatches(previous,next)?previous:null);try{localStorage.setItem('mdlvis.texture-library.blp-only',String(event.target.checked));}catch{}}}/>BLP only</label>
      <select aria-label="Texture source" value={variant} onChange={event=>changeVariant(event.target.value)}><option value="classic">Classic</option><option value="reforged">Reforged</option><option value="custom">Model folder</option><option value="all">All installed</option></select>
      <select aria-label="Texture kind" value={kind} onChange={event=>setKind(event.target.value)}><option value="all">All textures</option><option value="units">Units &amp; characters</option><option value="buildings">Buildings</option><option value="doodads">Doodads</option><option value="terrain">Terrain</option><option value="effects">Effects</option><option value="icons">Icons</option></select>
    </div>
    <div className="tl-body"><nav className="tl-folders" aria-label="Native texture folders"><button type="button" className={'tl-all-folders'+(!folder?' selected':'')} onClick={()=>setFolder('')}>All folders <small>{tree.count}</small></button>{tree.children.map(node=><FolderBranch key={node.path} node={node} selected={folder} onSelect={setFolder}/>)}</nav>
      <main className="tl-results"><div className="tl-result-status" aria-live="polite">{loading?'Loading texture library…':searching?'Searching…':`${result.total.toLocaleString()} textures`}{folder&&<span title={folder}>{folder}</span>}</div>
        {error&&<p className="tl-error" role="alert">{error}</p>}{catalog?.errors?.map((item,index)=><p key={index} className="tl-error">{item.message}</p>)}
        {!loading&&catalog?.nativeCount===0&&<p className="tl-note">No Warcraft textures were found. Choose your Warcraft III folder in Settings.</p>}
        {result.notice&&vibe&&<p className="tl-note">{result.notice}</p>}
        {result.unknown?.length>0&&vibe&&<p className="tl-note">Unrecognised words: {result.unknown.join(', ')}.</p>}
        {!loading&&!searching&&!error&&result.total===0&&<p className="tl-empty">No matching textures. Try a material, a Warcraft unit name, or a broader folder.</p>}
        <div className="tl-grid">{result.items.map(item=><TextureTile key={item.id} item={item} modelPath={modelPath} cacheEpoch={cacheEpoch} selected={selected?.id===item.id} onSelect={setSelected}/>)}</div>
        {result.hasMore&&<button type="button" className="tl-more" onClick={()=>setLimit(n=>n+120)} disabled={searching}>Show more textures</button>}
      </main>
      <aside className="tl-details">{selected?<><div className="tl-preview">{selectedImage?<img src={selectedImage} alt={selected.name} translate="no"/>:<span>{selectionError?'Preview unavailable':'Loading preview…'}</span>}</div><h3 translate="no">{selected.name}</h3><code translate="no">{selected.path}</code>{selected.sourcePath!==selected.path&&<details><summary>Native source path</summary><code translate="no">{selected.sourcePath}</code></details>}
        {selected.width>0&&<p className="tl-dimensions">{selected.width} × {selected.height}</p>}{selected._match?.type==='inspiration'&&<p className="tl-note">{selected._match.inspiration} kitbash suggestion<br/>{selected._match.reason.split(' · ').map(value=>translate(value)).join(' · ')}</p>}
        {selected.notes&&<p>{selected.notes}</p>}{selected._match?.missing?.length>0&&<p className="tl-note">Related result. Unconfirmed: {selected._match.missing.map(value=>translate(value)).join(', ')}.</p>}
        {selected.tags?.length>0&&<div className="tl-tags">{selected.tags.slice(0,12).map(tag=><button type="button" key={tag} onClick={()=>{setQuery(tag==='chain'?'chainmail':tag.replaceAll('-',' '));setVibe(true);}}>{tag==='chain'?'chainmail':tag.replaceAll('-',' ')}</button>)}</div>}
        {selectionError&&<p className="tl-error" role="alert">{selectionError}</p>}{message&&<p className="tl-success" role="status">{message}</p>}
        <div className="tl-actions">{!catalogFresh&&<p className="tl-note">Checking the current texture sources…</p>}{onSelectTexture?<button type="button" className="tl-primary" disabled={!catalogFresh||!selectedAsset||busy} onClick={()=>act(onSelectTexture,'')}>{selectLabel}</button>:<button type="button" disabled={!catalogFresh||!selectedAsset||busy||!onAddTexture} onClick={()=>act(onAddTexture,'Texture added to the model.')}>{used.has(selected.path.toLowerCase())?'Texture already in model':'Add texture to model'}</button>}
          {onPreviewTexture&&<><button type="button" className="tl-primary" disabled={!catalogFresh||!previewAllowed||!selectedAsset||busy} title={!previewAllowed?disabledPreviewReason:undefined} onClick={()=>act(onPreviewTexture,'Preview texture loaded.')}>Preview Texture in Editor</button>{!previewAllowed&&<p className="tl-preview-reason">{disabledPreviewReason}</p>}</>}
        </div>
      </>:<div className="tl-empty">Choose a texture to inspect or add it to your model.</div>}</aside>
    </div>
    <footer className="tl-footer"><span>{catalog?`${catalog.nativeCount.toLocaleString()} native · ${catalog.customCount} beside model`:''}</span><span>Previews are cached. Use Settings → Warcraft III → Preload Assets to prepare the library.</span></footer>
  </section></div>;
}
