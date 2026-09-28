import React, { lazy, useEffect, useMemo, useRef, useState, useCallback, Suspense } from 'react';
import AnimationPreviewTools from './AnimationPreviewTools.jsx';
import { cropBetween, cropPresetRect, SHOWCASE_CROP_PRESETS } from './showcase-crop.js';
import { createShowcaseDirector, overflowEntries, SHOWCASE_QUALITY } from './showcase-director.js';
import ShowcaseLayerTools from './ShowcaseLayerTools.jsx';
import './showcase.css';
import { flushSync } from 'react-dom';
import { SHOWCASE_PRESETS, builtinSetup, listShowcasePresets, saveShowcasePreset, snapshotShowcase, hydrateShowcase } from './showcase-presets.js';
import { alignShowcaseText } from './showcase-text.js';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const SHOWCASE_COLORS = [
  ['Black','#000000'], ['Charcoal','#292f38'], ['Slate','#546477'],
  ['Gray','#858d91'], ['Warm gray','#b5aa99'], ['Light','#e4e0d7'],
];
const SAVED_COLORS_KEY = 'mdlxl-showcase-saved-colors-v1';
function readSavedColors() {
  try {
    const values = JSON.parse(localStorage.getItem(SAVED_COLORS_KEY) || '[]');
    return Array.isArray(values) ? values.slice(0, 3).map(value => /^#[0-9a-f]{6}$/i.test(value) ? value : null) : [];
  } catch { return []; }
}
const isPortrait = sequence => /portrait/i.test(String(sequence?.Name || ''));
const CLEAN = Object.fromEntries(['bones','nodes','attachments','particles','boneLines','wires','vertices','grid','axes','normals','cameras'].map(key => [key, false]));
function NumberField({ label, value, onChange, min, max, step = 1, ...rest }) {
  return <label>{label}<input aria-label={label} type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} {...rest}/></label>;
}
function Slider({ label, value, onChange, min = 0, max = 200 }) {
  return <label className="showcase-slider">{label}<input aria-label={label} type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))}/><output>{value}%</output></label>;
}
function Dialog({ title, children, onClose, onSubmit, footer }) {
  const element = useRef(null);
  useEffect(() => { element.current.showModal(); }, []);
  return <dialog className="classic-modal-window showcase-dialog" ref={element} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header>{title}<button aria-label="Close dialog" onClick={onClose}>×</button></header>
    <form onSubmit={event => { event.preventDefault(); onSubmit?.(); }}>
      <div className="classic-modal-body">{children}</div>
      <footer>{footer}<button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer>
    </form>
  </dialog>;
}
function AnimationDialog({ model, initial, portrait, onSave, onRemove, onClose }) {
  const [draft, setDraft] = useState(initial);
  const change = patch => setDraft(row => ({ ...row, ...patch }));
  return <Dialog title={initial.editing ? 'Edit animation' : 'Add animation'} onClose={onClose} onSubmit={() => onSave({ sequence: draft.sequence, seconds: Math.max(.02,Number(draft.seconds)||3), speed: draft.speed, loop: true })} footer={initial.editing && <button type="button" onClick={onRemove}>Remove</button>}>
    <label>Animation<select aria-label="Animation" value={draft.sequence} onChange={event => change({sequence:Number(event.target.value)})}>{model.Sequences.map((row,index)=>isPortrait(row)===portrait?<option key={index} value={index}>{row.Name}</option>:null)}</select></label>
    <NumberField label="Length (seconds)" min={.02} step={.01} value={draft.seconds} onChange={seconds=>change({seconds})}/>{!portrait&&<Slider label="Speed" value={Math.round(draft.speed*100)} onChange={value=>change({speed:value/100})}/>}
  </Dialog>;
}
export default function ShowcaseWorkspace({ model, modelName, modelPath, revision, textureAssets, preferences, teamColor, sessionId, background, backgroundLibrary, onBackground, onStatus }) {
  const [api,setAPI] = useState(null), [playing,setPlaying] = useState(false), [busy,setBusy] = useState(false);
  const [crop,setCrop] = useState(null), [cropPreset,setCropPreset] = useState('free'), [cropEditing,setCropEditing] = useState(false), cropDrag = useRef(null);
  const previewRef = useRef(null), [previewSize,setPreviewSize] = useState({width:1,height:1});
  const selectedCrop = cropPreset === 'free' ? crop : cropPresetRect(previewSize.width,previewSize.height,SHOWCASE_CROP_PRESETS[cropPreset]);
  useEffect(() => {
    const node = previewRef.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setPreviewSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  const [mode,setMode] = useState('sequences'), [sequenceLength,setSequenceLength] = useState(10), [portraitLength,setPortraitLength] = useState(10), [orbitSpeed,setOrbitSpeed] = useState(150), [orbitRadius,setOrbitRadius] = useState(0), [orbitAngle,setOrbitAngle] = useState(0), [light,setLight] = useState('ingame');
  const [sequencePlaylist,setSequencePlaylist] = useState(() => { const index=model.Sequences?.findIndex(row=>!isPortrait(row)) ?? -1; return index<0?[]:[{sequence:index,seconds:3,speed:1,loop:true}]; });
  const [portraitPlaylist,setPortraitPlaylist] = useState(() => { const index=model.Sequences?.findIndex(isPortrait) ?? -1; return index<0?[]:[{sequence:index,seconds:3,speed:1,loop:true}]; });
  const portrait = mode === 'portrait', playlist = portrait ? portraitPlaylist : sequencePlaylist, length = portrait ? portraitLength : sequenceLength;
  const available = model.Sequences?.map((row,index)=>isPortrait(row)===portrait?index:-1).filter(index=>index>=0) || [];
  const portraitCameraIndex = model.Cameras?.findIndex(camera=>/portrait/i.test(String(camera.Name||''))) ?? -1;
  const cameraIndex = portraitCameraIndex >= 0 ? portraitCameraIndex : model.Cameras?.length ? 0 : -1;
  const [selected,setSelected] = useState(0), [animationDialog,setAnimationDialog] = useState(null);
  const [quality,setQuality] = useState('high'), [fps,setFPS] = useState(30);
  const [backgroundMode,setBackgroundMode] = useState('color'), [color,setColor] = useState(SHOWCASE_COLORS[2][1]), [savedColors,setSavedColors] = useState(readSavedColors), [portraitZoom,setPortraitZoom] = useState(100), [media,setMedia] = useState(null), [videoDuration,setVideoDuration] = useState(0), [trim,setTrim] = useState({start:0,end:0});
  const mediaInput = useRef(null);
  const [layers,setLayers] = useState([]), [activeLayer,setActiveLayer] = useState(null), [layersEditing,setLayersEditing] = useState(false), [portraitFrameEnabled,setPortraitFrameEnabled] = useState(true);
  const framedPortrait = portrait && portraitFrameEnabled;
  const [grid,setGrid]=useState(false),[gridDensity,setGridDensity]=useState(5);
  const [presets,setPresets]=useState([]),[presetDialog,setPresetDialog]=useState(null),[presetName,setPresetName]=useState(''),[presetId,setPresetId]=useState(SHOWCASE_PRESETS[0].id),[setupBusy,setSetupBusy]=useState(false);
  const [recordingList,setRecordingList]=useState([]),[backgroundAsset,setBackgroundAsset]=useState(null),[applyVersion,setApplyVersion]=useState(0);
  const setupURLs=useRef(new Set()),pendingApply=useRef(null),apiRef=useRef(null),captureSettings=useRef(null),batchRestore=useRef(null);
  const captureReady=useCallback(value=>{apiRef.current=value;setAPI(value);},[]);
  useEffect(()=>{let live=true;listShowcasePresets().then(rows=>{if(live)setPresets(rows);}).catch(error=>onStatus?.('Could not load Showcase presets: '+error.message,true));return()=>{live=false;};},[]);
  useEffect(()=>()=>{for(const url of setupURLs.current)URL.revokeObjectURL(url);pendingApply.current?.reject(Error('Showcase closed while loading a setup.'));pendingApply.current=null;},[]);
  useEffect(()=>{if(layersEditing){setCropEditing(false);setPlaying(false);}},[layersEditing]);
  function saveColor(index) {
    const next=[...savedColors]; if (next[index]) setColor(next[index]); else { next[index]=color; setSavedColors(next); }
  }
  function clearColor(index) { const next=[...savedColors]; next[index]=null; setSavedColors(next); }
  useEffect(()=>{ try { localStorage.setItem(SAVED_COLORS_KEY,JSON.stringify(savedColors.slice(0,3))); } catch { /* Browser storage can be unavailable. */ } },[savedColors]);
  function colorPicker() { return <div className="showcase-colors" role="group" aria-label="Colors">{SHOWCASE_COLORS.map(([name,value])=><button key={name} type="button" aria-label={name} aria-pressed={color===value} title={name} style={{backgroundColor:value}} onClick={()=>setColor(value)}/>)}
    {[0,1,2].map(index=><button key={index} className={savedColors[index]?'saved':'empty'} type="button" aria-label={savedColors[index]?`Saved color ${index+1}: ${savedColors[index]}`:`Save color ${index+1}`} title={savedColors[index]?'Click to use; right-click to clear':'Click to save current color'} style={{backgroundColor:savedColors[index]||undefined}} onClick={()=>saveColor(index)} onContextMenu={event=>{event.preventDefault();clearColor(index);}}>{savedColors[index]?'':'+'}</button>)}
    <input aria-label="Background color" type="color" value={color} onChange={event=>setColor(event.target.value)}/></div>; }
  const cropPoint = event => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
  };
  function startCrop(event) {
    if (event.button !== 0) return;
    cropDrag.current = { start: cropPoint(event), previous: crop, previousPreset: cropPreset };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function moveCrop(event) {
    if (!cropDrag.current) return;
    const selection = cropBetween(cropDrag.current.start, cropPoint(event));
    if (selection.width >= .05 && selection.height >= .05) { setCropPreset('free'); setCrop(selection); }
  }
  function finishCrop(event) {
    if (!cropDrag.current) return;
    const selection = cropBetween(cropDrag.current.start, cropPoint(event));
    if (selection.width >= .05 && selection.height >= .05) { setCropPreset('free'); setCrop(selection); }
    else { setCropPreset(cropDrag.current.previousPreset); setCrop(cropDrag.current.previous); }
    cropDrag.current = null;
  }
  useEffect(() => () => { if (media?.url) URL.revokeObjectURL(media.url); }, [media?.url]);
  const current = useRef();
  current.current = {model,playlist,length,orbitSpeed,playing,portrait,startAngle:orbitAngle};
  const director = useMemo(() => createShowcaseDirector(() => current.current), []);
  const overflow = overflowEntries(playlist,length);
  const center = () => api?.modelCenter() || [0,0,0];
  function restart() { director.reset(api?.cameraView(),center()); api?.invalidate(); }
  function updatePlaylist(rows) { (portrait?setPortraitPlaylist:setSequencePlaylist)(rows); setPlaying(false); director.reset(api?.cameraView(),center()); api?.invalidate(); }
  function editAnimation(index) {
    setPlaying(false); setSelected(index >= 0 ? index : selected);
    setAnimationDialog({index,sequence:index >= 0 ? playlist[index].sequence : available[0],seconds:3,speed:1,...playlist[index],editing:index >= 0});
  }
  function selectAnimation(index) {
    setSelected(index); setPlaying(false);
    director.clock.seconds = playlist.slice(0,index).reduce((sum,row)=>sum+Number(row.seconds),0);
    director.clock.revision++; api?.invalidate();
  }
  function chooseFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.type.startsWith('audio/') || /\.wav$/i.test(file.name)) { onStatus?.('WAV contains audio only. Choose an image or a video with a picture track.',true); return; }
    const video = file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|ogv|mkv|avi|wmv)$/i.test(file.name);
    setMedia({blob:file,url:URL.createObjectURL(file),type:video ? file.type || 'video/mp4' : file.type || (/\.gif$/i.test(file.name)?'image/gif':'image/png'),name:file.name});
    setVideoDuration(0); setTrim({start:0,end:0});
  }
  const backgroundUrl = portrait ? '' : backgroundMode === 'folder' ? backgroundAsset?.url || backgroundLibrary.url : backgroundMode === 'media' ? media?.url : '';
  const backgroundType = portrait ? '' : backgroundMode === 'folder' ? backgroundAsset?.type || backgroundLibrary.type : backgroundMode === 'media' ? media?.type : '';
  const localPreferences = useMemo(() => ({ ...preferences,
    graphics:{...preferences.graphics,...SHOWCASE_QUALITY[quality],textures:true,lighting:true,particles:true,maxFps:60,pauseWhenHidden:false},
    viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color:portrait&&!portraitFrameEnabled?'#000000':color,imageData:'',display:'fill',opacity:1}},
    platform:{enabled:false},lighting:{...preferences.lighting,preset:'legacy'},capture:{fps,recordingQuality:quality},
  }),[preferences,quality,fps,color,portrait,portraitFrameEnabled]);
  captureSettings.current={api,preferences:localPreferences,length,crop:framedPortrait?null:selectedCrop,loop:true,modelName};
  async function captureSetup(animations=false){
    if(!apiRef.current)throw Error('The Showcase preview is still loading.');
    if(backgroundMode==='folder'&&!backgroundAsset&&backgroundLibrary.loading)throw Error('Wait for the background to finish loading.');
    await apiRef.current.whenReady();
    return snapshotShowcase({version:1,orbitAngle:director.clock.angle,mode,sequenceLength,portraitLength,orbitSpeed,orbitRadius,light,quality,fps,backgroundMode,color,crop,cropPreset,media,background,backgroundAsset:backgroundMode==='folder'&&(backgroundAsset?.url||backgroundLibrary.url)?{id:backgroundAsset?.id||background,name:backgroundAsset?.name||backgroundLibrary.items.find(item=>item.id===background)?.label||background,type:backgroundAsset?.type||backgroundLibrary.type,url:backgroundAsset?.url||backgroundLibrary.url,blob:backgroundAsset?.blob}:null,trim,portraitZoom,portraitFrameEnabled,grid,gridDensity,layers,view:apiRef.current.showcaseView(),...(animations?{sequencePlaylist,portraitPlaylist}:{})});
  }
  function applySetup(snapshot){
    return new Promise((resolve,reject)=>{
      const previousURLs=[...setupURLs.current],setup=hydrateShowcase(snapshot,setupURLs.current);
      pendingApply.current={setup,resolve,reject,previousURLs};
      flushSync(()=>{
        setPlaying(false);setCropEditing(false);setMode(setup.mode);setSequenceLength(setup.sequenceLength);setPortraitLength(setup.portraitLength);
        setOrbitSpeed(setup.orbitSpeed);setOrbitRadius(setup.orbitRadius);setOrbitAngle(setup.orbitAngle||0);setLight(setup.light);setQuality(setup.quality);setFPS(setup.fps);
        setBackgroundMode(setup.backgroundMode);setColor(setup.color);setCrop(setup.crop);setCropPreset(setup.cropPreset);setMedia(setup.media);setBackgroundAsset(setup.backgroundAsset);onBackground(setup.background||'');setTrim(setup.trim);setVideoDuration(0);
        setPortraitZoom(setup.portraitZoom);setPortraitFrameEnabled(setup.portraitFrameEnabled);setGrid(!!setup.grid);setGridDensity(setup.gridDensity||5);setLayers(setup.layers);setActiveLayer(null);setLayersEditing(false);setSelected(0);
        if(setup.sequencePlaylist)setSequencePlaylist(setup.sequencePlaylist);if(setup.portraitPlaylist)setPortraitPlaylist(setup.portraitPlaylist);
        setApplyVersion(value=>value+1);
      });
      director.reset();
    });
  }
  useEffect(()=>{
    const pending=pendingApply.current;if(!pending||!api||apiRef.current!==api)return;
    let cancelled=false;
    (async()=>{
      await new Promise(requestAnimationFrame);if(cancelled)return;await api.whenReady();if(cancelled||apiRef.current!==api)return;
      if(pending.setup.view)api.restoreShowcaseView(pending.setup.view);
      if(pending.setup.layout)api.maximalZoom(pending.setup.layout);
      api.invalidate();await new Promise(requestAnimationFrame);if(cancelled)return;
      await api.whenReady();if(cancelled||apiRef.current!==api)return;
      for(const url of pending.previousURLs){URL.revokeObjectURL(url);setupURLs.current.delete(url);}
      pendingApply.current=null;pending.resolve({...captureSettings.current,api});
    })().catch(error=>{if(!cancelled&&pendingApply.current===pending){pendingApply.current=null;pending.reject(error);}});
    return()=>{cancelled=true;};
  },[api,applyVersion]);
  async function saveSetup(){
    setSetupBusy(true);
    try{const name=presetName.trim()||'Showcase setup',prior=presets.find(row=>row.name===name);const row={id:prior?.id||crypto.randomUUID(),name,setup:await captureSetup()};await saveShowcasePreset(row);setPresets(await listShowcasePresets());setPresetId(row.id);setPresetDialog(null);onStatus?.('Saved preset: '+name);}
    catch(error){onStatus?.('Could not save preset: '+error.message,true);}finally{setSetupBusy(false);}
  }
  async function loadSetup(){
    setSetupBusy(true);
    try{const builtin=SHOWCASE_PRESETS.find(row=>row.id===presetId),saved=presets.find(row=>row.id===presetId);if(!builtin&&!saved)throw Error('Choose a preset.');
      const frame=builtin?cropPresetRect(previewSize.width,previewSize.height,SHOWCASE_CROP_PRESETS[builtin.cropPreset]):null;
      await applySetup(builtin?builtinSetup(builtin,frame):saved.setup);setPresetDialog(null);onStatus?.('Loaded preset: '+(builtin||saved).name);
    }catch(error){onStatus?.('Could not load preset: '+error.message,true);}finally{setSetupBusy(false);}
  }
  async function addRecording(){
    setSetupBusy(true);
    try{const setup=await captureSetup(true),names=playlist.map(row=>model.Sequences[row.sequence]?.Name).join(' → ');setRecordingList(rows=>[...rows,{id:crypto.randomUUID(),name:names+' · '+length+'s',setup}]);}
    catch(error){onStatus?.('Could not add recording: '+error.message,true);}finally{setSetupBusy(false);}
  }
  async function alignText(id,x,y){
    const layer=layers.find(row=>row.id===id);if(!layer)return;
    try{const stage=previewRef.current?.querySelector('.showcase-layer-stage'),width=stage?.clientWidth||previewSize.width,height=stage?.clientHeight||previewSize.height;
      const rect=await alignShowcaseText(layer,x,y,framedPortrait?null:selectedCrop,width,height);setLayers(rows=>rows.map(row=>row.id===id?{...row,rect}:row));
    }catch(error){onStatus?.(error.message,true);}
  }
  return <div className="showcase-workspace">
    <aside className="showcase-sidebar" aria-label="Showcase controls">
      <AnimationPreviewTools active sessionId={sessionId} modelName={modelName} captureAPI={api} preferences={localPreferences} loop length={length} crop={framedPortrait?null:selectedCrop} locked={setupBusy} recordingList={recordingList} prepareTake={take=>applySetup(take.setup)} onTakeComplete={id=>setRecordingList(rows=>rows.filter(row=>row.id!==id))} beforeBatch={async()=>{batchRestore.current=await captureSetup(true);}} afterBatch={async()=>{const saved=batchRestore.current;batchRestore.current=null;if(saved)await applySetup(saved);}} disabled={setupBusy || overflow.some(Boolean) || !playlist.length || portrait && cameraIndex < 0 || !portrait && backgroundMode === 'folder' && !backgroundAsset && backgroundLibrary.loading} onStatus={onStatus} onBusy={value=>{setBusy(value);if(value)setPlaying(false);}}/>
      <fieldset disabled={busy||setupBusy} className="showcase-fields">
        <div className="showcase-preset-actions"><button disabled={!api} onClick={()=>{setPresetName(modelName.replace(/\.[^.]+$/,'')+' setup');setPresetDialog('save');}}>Save Preset</button><button disabled={!api} onClick={()=>setPresetDialog('load')}>Load Preset</button></div>
        <button className="showcase-wide" disabled={!api||overflow.some(Boolean)||!playlist.length||(portrait&&cameraIndex<0)||(backgroundMode==='folder'&&!backgroundAsset&&backgroundLibrary.loading)} onClick={addRecording}>Add to recording list{recordingList.length?' · '+recordingList.length:''}</button>
        {recordingList.length>0&&<ol className="showcase-recording-list" aria-label="Recording list">{recordingList.map((take,index)=><li key={take.id}><span title={take.name}>{index+1}. {take.name}</span><button aria-label={'Remove recording '+(index+1)} onClick={()=>setRecordingList(rows=>rows.filter(row=>row.id!==take.id))}>×</button></li>)}</ol>}
        <NumberField label="Length" aria-label="Record length seconds" min={.02} step={.01} value={length} onChange={portrait?setPortraitLength:setSequenceLength}/>
        {(!portrait||portraitFrameEnabled)&&<section className="showcase-section" aria-label={portrait?"Portrait color":"Background"}>
          {portrait&&<header><strong>Color</strong></header>}
          {!portrait&&<label>Background<select aria-label="Background source" value={backgroundMode} onChange={event=>setBackgroundMode(event.target.value)}><option value="folder">Backgrounds</option><option value="color">Color</option><option value="media">Image/Video</option></select></label>}
          {!portrait&&backgroundMode === 'folder' && <select className="showcase-wide" aria-label="Backgrounds" value={backgroundAsset?.id||background} onFocus={backgroundLibrary.refresh} onChange={event=>{setBackgroundAsset(null);onBackground(event.target.value);}}><option value="">None</option>{backgroundAsset&&!backgroundLibrary.items.some(item=>item.id===backgroundAsset.id)&&<option value={backgroundAsset.id}>{backgroundAsset.name}</option>}{backgroundLibrary.items.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>}
          {(portrait||backgroundMode === 'color') && colorPicker()}
          {!portrait&&backgroundMode === 'media' && <><button className="showcase-wide showcase-file" onClick={()=>mediaInput.current.click()} title={media?.name}>{media?.name || 'Choose image/video…'}</button><input hidden ref={mediaInput} type="file" accept="image/*,video/*,.mp4,.webm,.mov,.m4v,.ogv,.avi,.mkv,.wmv,.wav" onChange={chooseFile}/>
            {backgroundType?.startsWith('video/') && videoDuration > 0 && <div className="showcase-trim"><NumberField label="From (s)" min={0} max={Math.max(0,(trim.end || videoDuration)-.02)} step={.1} value={trim.start} onChange={value=>setTrim({...trim,start:Math.max(0,Math.min(Number(value)||0,(trim.end||videoDuration)-.02))})}/><NumberField label="To (s)" min={trim.start+.02} max={videoDuration} step={.1} value={trim.end || videoDuration} onChange={value=>setTrim({...trim,end:Math.max(trim.start+.02,Math.min(videoDuration,Number(value)||videoDuration))})}/></div>}
          </>}
        </section>}
        <section className="showcase-section" aria-label="Sequences / Portrait">
          <header><div className="showcase-tabs" role="tablist" aria-label="Sequences / Portrait"><button role="tab" aria-selected={!portrait} onClick={()=>{setMode('sequences');setSelected(0);setPlaying(false);director.reset();}}>Sequences</button><button role="tab" aria-selected={portrait} onClick={()=>{setMode('portrait');setSelected(0);setPlaying(false);director.reset();}}>Portrait</button></div><button disabled={!available.length} onClick={()=>editAnimation(-1)}>Add</button></header>
          <ol className="showcase-list" aria-label="Animation sequence">{playlist.map((row,index)=><li key={index} className={(selected===index?' selected':'')+(overflow[index]?' overflow':'')} onClick={()=>selectAnimation(index)} onDoubleClick={()=>editAnimation(index)} onContextMenu={event=>{event.preventDefault();editAnimation(index);}} tabIndex={0} onKeyDown={event=>{if(event.key==='Enter')editAnimation(index);if(event.key==='Delete')updatePlaylist(playlist.filter((_,i)=>i!==index));}} title="Right-click to edit">
            <span>{index+1}. {model.Sequences[row.sequence]?.Name}</span><small>{row.seconds+'s'+(portrait?'':' / '+Math.round(row.speed*100)+'%')}</small>
          </li>)}</ol>
          {overflow.some(Boolean)&&<div className="showcase-error" role="alert">Sequence too short</div>}
          {portrait&&cameraIndex<0&&<div className="showcase-error" role="alert">This model has no portrait camera.</div>}
          <div className="showcase-list-actions"><button disabled={selected<=0 || !playlist[selected]} aria-label="Move animation up" onClick={()=>{const rows=[...playlist];[rows[selected-1],rows[selected]]=[rows[selected],rows[selected-1]];updatePlaylist(rows);setSelected(selected-1);}}>↑</button><button disabled={selected>=playlist.length-1 || !playlist[selected]} aria-label="Move animation down" onClick={()=>{const rows=[...playlist];[rows[selected+1],rows[selected]]=[rows[selected],rows[selected+1]];updatePlaylist(rows);setSelected(selected+1);}}>↓</button>
          </div>
        </section>
        <section className="showcase-section" aria-label="Camera Control" hidden={portrait}>
          <header><strong>Camera Control</strong><button disabled={!api} title="Fit the current pose through a complete orbit inside the crop" onClick={()=>{setPlaying(false);setCropEditing(false);api?.maximalZoom(selectedCrop);}}>Maximal Zoom</button></header>
          <Slider label="Orbit speed" value={orbitSpeed} onChange={setOrbitSpeed}/>
          <Slider label="Radius" value={orbitRadius} max={100} onChange={setOrbitRadius}/>
          <small>Z axis · 0% radius spins in place</small>
          <button className="showcase-wide" disabled={!api} onClick={()=>{if(!playing)restart();setPlaying(!playing);}}>{playing?'Pause preview':'Preview orbit'}</button>

        </section>
        {portrait&&<section className="showcase-section" aria-label="Portrait zoom"><header><strong>Portrait</strong></header><label>Portrait frame<input type="checkbox" aria-label="Portrait frame" checked={portraitFrameEnabled} onChange={event=>{setPortraitFrameEnabled(event.target.checked);setCropEditing(false);}}/></label><label>Size<select aria-label="Portrait zoom preset" value={[75,100,125,150].includes(portraitZoom)?portraitZoom:"custom"} onChange={event=>setPortraitZoom(Number(event.target.value))}><option value="custom" disabled>Custom</option><option value="75">Small 75%</option><option value="100">Frame 100%</option><option value="125">Close 125%</option><option value="150">Detail 150%</option></select></label><Slider label="Zoom" min={50} max={200} value={portraitZoom} onChange={setPortraitZoom}/></section>}
        {!framedPortrait&&<section className="showcase-section" aria-label="Crop">
          <label>Crop size<select aria-label="Crop size" value={cropPreset} onChange={event=>{const preset=event.target.value;if(preset==='free'){setCrop(selectedCrop);setCropEditing(true);}else setCropEditing(false);setCropPreset(preset);}}><option value="free">Free selection</option><option value="square">Square · 1:1</option><option value="classic">Classic · 4:3</option><option value="wide">Wide · 16:9</option><option value="portrait">Portrait · 3:4</option></select></label>
          <div className="showcase-crop-controls"><button disabled={!api} title={selectedCrop?'Center unit in crop; zoom out only if needed':'Center unit in viewport; zoom out only if needed'} onClick={()=>{setPlaying(false);setCropEditing(false);api?.centerModel(selectedCrop);}}>Center</button><button disabled={!api} onClick={()=>{setPlaying(false);setCropEditing(!cropEditing);}}>{cropEditing?'Done':selectedCrop?'Edit crop':'Crop'}</button>{selectedCrop&&<button onClick={()=>{setCrop(null);setCropPreset('free');setCropEditing(false);}}>Reset</button>}</div>
        </section>}
        <ShowcaseLayerTools key={applyVersion} grid={grid} onGrid={setGrid} gridDensity={gridDensity} onGridDensity={setGridDensity} onAlign={alignText} length={length} layers={layers} onLayers={setLayers} activeId={activeLayer} onActive={setActiveLayer} onEditing={setLayersEditing} onStatus={onStatus}/>
        <section className="showcase-section" aria-label="Graphics">
          <header><strong>Graphics</strong></header>
          <label>Quality<select aria-label="Graphics quality" value={quality} onChange={event=>setQuality(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">Highest</option></select></label>
          <label>FPS<select aria-label="Recording FPS" value={fps} onChange={event=>setFPS(Number(event.target.value))}>{[10,15,20,24,25,30,50].map(value=><option key={value}>{value}</option>)}</select></label>
          {!portrait&&<label>Light<select aria-label="Light" value={light} onChange={event=>setLight(event.target.value)}><option value="ingame">Ingame</option><option value="portrait">Portrait</option><option value="none">None</option></select></label>}
          <small>{quality==='low'?'1× · no AA · bilinear':quality==='medium'?'1.5× · AA · 4× filtering':'2× · AA · 16× filtering'}</small>
        </section>
      </fieldset>
    </aside>
    {presetDialog&&<Dialog title={presetDialog==='save'?'Save Preset':'Load Preset'} onClose={()=>{if(!setupBusy)setPresetDialog(null);}} onSubmit={()=>{if(!setupBusy)(presetDialog==='save'?saveSetup:loadSetup)();}}>
      {presetDialog==='save'?<label>Name<input autoFocus aria-label="Showcase preset name" value={presetName} onChange={event=>setPresetName(event.target.value)} disabled={setupBusy}/></label>:<label>Preset<select aria-label="Showcase presets" value={presetId} onChange={event=>setPresetId(event.target.value)} disabled={setupBusy}><optgroup label="Included">{SHOWCASE_PRESETS.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</optgroup>{presets.length>0&&<optgroup label="Saved">{presets.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</optgroup>}</select></label>}
      <small>{setupBusy?'Loading…':'Includes layout, media, text and camera settings. Animations stay as selected.'}</small>
    </Dialog>}
    <section ref={previewRef} className={`showcase-preview${framedPortrait?" portrait":portrait?" portrait-frameless":""}`} aria-label="Showcase preview" style={framedPortrait?{"--portrait-zoom":portraitZoom/125,backgroundColor:color}:portrait?{backgroundColor:"#000000"}:undefined} inert={busy || setupBusy || undefined}><Suspense fallback={<div className="classic-empty-view">Loading model preview…</div>}><GamePreview showcase={director} presentation="preview" previewMode="textured" mode="textured" overlays={CLEAN} showGrid={false} showAxes={false} showParticles playing={false} sequenceIndex={0} time={model.Sequences?.[0]?.Interval?.[0]||0} model={model} revision={revision} modelPath={modelPath} textureAssets={textureAssets} preferences={localPreferences} teamColor={teamColor} view="perspective" cameraMode="rotate" showcaseLight={light} showcaseCrop={framedPortrait?null:selectedCrop} showcaseRadius={orbitRadius} showcasePortraitMode={portrait} showcasePortraitFrame={portraitFrameEnabled} showcasePortraitZoom={portraitZoom} portraitCameraIndex={cameraIndex} showcaseGrid={grid&&!busy} showcaseGridDensity={gridDensity} showcaseLayers={layers} showcaseLayerEditing={layersEditing&&!cropEditing} showcaseActiveLayer={activeLayer} onShowcaseLayerSelect={setActiveLayer} onShowcaseLayerChange={(id,patch)=>setLayers(values=>values.map(layer=>layer.id===id?{...layer,...patch}:layer))} onShowcaseLayerError={message=>onStatus?.(message,true)} onCaptureReady={captureReady} backgroundUrl={backgroundUrl} backgroundType={backgroundType} backgroundTrim={trim} onBackgroundMetadata={setVideoDuration} preserveCameraView showcasePlaying={playing} showcaseConfig={[playlist,length,orbitSpeed,orbitRadius,orbitAngle,light,portrait,portraitZoom,portraitFrameEnabled]}/></Suspense>
      {!framedPortrait&&(cropEditing||selectedCrop)&&<div className={'showcase-crop-overlay'+(cropEditing?' editing':'')} aria-label="Crop area" onPointerDown={cropEditing?startCrop:undefined} onPointerMove={cropEditing?moveCrop:undefined} onPointerUp={cropEditing?finishCrop:undefined} onPointerCancel={cropEditing?finishCrop:undefined}>
        <div className="showcase-crop-selection" style={{left:(selectedCrop?.x||0)*100+'%',top:(selectedCrop?.y||0)*100+'%',width:(selectedCrop?.width??1)*100+'%',height:(selectedCrop?.height??1)*100+'%'}}/>
        {cropEditing&&<div className="showcase-crop-hint">Drag to select the GIF area</div>}
      </div>}
    </section>
    {animationDialog&&<AnimationDialog model={model} initial={animationDialog} portrait={portrait} onClose={()=>setAnimationDialog(null)} onSave={row=>{updatePlaylist(animationDialog.index<0?[...playlist,row]:playlist.map((item,index)=>index===animationDialog.index?row:item));setSelected(animationDialog.index<0?playlist.length:animationDialog.index);setAnimationDialog(null);}} onRemove={()=>{updatePlaylist(playlist.filter((_,index)=>index!==animationDialog.index));setSelected(Math.max(0,animationDialog.index-1));setAnimationDialog(null);}}/>}
  </div>;
}
