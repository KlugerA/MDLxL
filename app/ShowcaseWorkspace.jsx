import React, { lazy, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import AnimationPreviewTools from './AnimationPreviewTools.jsx';
import { cropBetween, cropPresetRect, SHOWCASE_CROP_PRESETS } from './showcase-crop.js';
import { createShowcaseDirector, overflowEntries, SHOWCASE_QUALITY } from './showcase-director.js';
import { listSignaturePresets, saveSignaturePreset, deleteSignaturePreset } from './showcase-signature.js';
import './showcase.css';

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
  const [mode,setMode] = useState('sequences'), [sequenceLength,setSequenceLength] = useState(10), [portraitLength,setPortraitLength] = useState(10), [orbitSpeed,setOrbitSpeed] = useState(100), [orbitRadius,setOrbitRadius] = useState(0), [light,setLight] = useState('ingame');
  const [sequencePlaylist,setSequencePlaylist] = useState(() => { const index=model.Sequences?.findIndex(row=>!isPortrait(row)) ?? -1; return index<0?[]:[{sequence:index,seconds:3,speed:1,loop:true}]; });
  const [portraitPlaylist,setPortraitPlaylist] = useState(() => { const index=model.Sequences?.findIndex(isPortrait) ?? -1; return index<0?[]:[{sequence:index,seconds:3,speed:1,loop:true}]; });
  const portrait = mode === 'portrait', playlist = portrait ? portraitPlaylist : sequencePlaylist, length = portrait ? portraitLength : sequenceLength;
  const available = model.Sequences?.map((row,index)=>isPortrait(row)===portrait?index:-1).filter(index=>index>=0) || [];
  const portraitCameraIndex = model.Cameras?.findIndex(camera=>/portrait/i.test(String(camera.Name||''))) ?? -1;
  const cameraIndex = portraitCameraIndex >= 0 ? portraitCameraIndex : model.Cameras?.length ? 0 : -1;
  const [selected,setSelected] = useState(0), [animationDialog,setAnimationDialog] = useState(null);
  const [quality,setQuality] = useState('high'), [fps,setFPS] = useState(30), [tool,setTool] = useState('rotate');
  const [backgroundMode,setBackgroundMode] = useState('folder'), [color,setColor] = useState('#000000'), [savedColors,setSavedColors] = useState(readSavedColors), [portraitZoom,setPortraitZoom] = useState(100), [media,setMedia] = useState(null), [videoDuration,setVideoDuration] = useState(0), [trim,setTrim] = useState({start:0,end:0});
  const mediaInput = useRef(null), signatureInput = useRef(null);
  const [signature,setSignature] = useState(null), [signatureOpen,setSignatureOpen] = useState(false), [signatureName,setSignatureName] = useState(''), [signaturePresets,setSignaturePresets] = useState([]);
  useEffect(() => { let active=true; listSignaturePresets().then(rows=>{if(active)setSignaturePresets(rows);}).catch(error=>onStatus?.('Could not load signature presets: '+error.message,true)); return ()=>{active=false;}; }, []);
  useEffect(() => () => { if(signature?.url) URL.revokeObjectURL(signature.url); }, [signature?.url]);
  function applySignature(blob,name,type,presetId=null,rect={x:.68,y:.82,width:.28,height:.12}) {
    setSignature({blob,name,type,url:URL.createObjectURL(blob),presetId,rect});
    setSignatureName(presetId ? name : name.replace(/\.[^.]+$/,''));
  }
  function chooseSignature(event) {
    const file=event.target.files?.[0]; event.target.value=''; if(!file)return;
    if(!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)) { onStatus?.('Choose an image or GIF for the signature.',true); return; }
    applySignature(file,file.name,/\.gif$/i.test(file.name)?'image/gif':file.type||'image/png');
  }
  async function storeSignature() {
    if(!signature)return;
    try {
      const preset={id:signature.presetId||crypto.randomUUID(),name:signatureName.trim()||signature.name,type:signature.type,blob:signature.blob,rect:signature.rect};
      await saveSignaturePreset(preset); setSignature(value=>value?{...value,presetId:preset.id}:value);
      setSignaturePresets(await listSignaturePresets()); onStatus?.('Signature preset saved.');
    } catch(error) { onStatus?.('Could not save signature preset: '+error.message,true); }
  }
  async function removeSignaturePreset() {
    if(!signature?.presetId)return;
    try { await deleteSignaturePreset(signature.presetId); setSignaturePresets(await listSignaturePresets()); setSignature(value=>value?{...value,presetId:null}:value); onStatus?.('Signature preset removed.'); }
    catch(error) { onStatus?.('Could not remove signature preset: '+error.message,true); }
  }
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
  current.current = {model,playlist,length,orbitSpeed,playing,portrait};
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
    setMedia({url:URL.createObjectURL(file),type:video ? file.type || 'video/mp4' : file.type || (/\.gif$/i.test(file.name)?'image/gif':'image/png'),name:file.name});
    setVideoDuration(0); setTrim({start:0,end:0});
  }
  const backgroundUrl = portrait ? '' : backgroundMode === 'folder' ? backgroundLibrary.url : backgroundMode === 'media' ? media?.url : '';
  const backgroundType = portrait ? '' : backgroundMode === 'folder' ? backgroundLibrary.type : backgroundMode === 'media' ? media?.type : '';
  const localPreferences = useMemo(() => ({ ...preferences,
    graphics:{...preferences.graphics,...SHOWCASE_QUALITY[quality],textures:true,lighting:true,particles:true,maxFps:60,pauseWhenHidden:false},
    viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color,imageData:'',display:'fill',opacity:1}},
    platform:{enabled:false},lighting:{...preferences.lighting,preset:'legacy'},capture:{fps,recordingQuality:quality},
  }),[preferences,quality,fps,color]);
  return <div className="showcase-workspace">
    <aside className="showcase-sidebar" aria-label="Showcase controls">
      <AnimationPreviewTools active sessionId={sessionId} modelName={modelName} captureAPI={api} preferences={localPreferences} loop length={length} crop={portrait?null:selectedCrop} disabled={overflow.some(Boolean) || !playlist.length || portrait && cameraIndex < 0 || !portrait && backgroundMode === 'folder' && backgroundLibrary.loading} onStatus={onStatus} onBusy={value=>{setBusy(value);if(value)setPlaying(false);}}/>
      <fieldset disabled={busy} className="showcase-fields">
        <NumberField label="Length" aria-label="Record length seconds" min={.02} step={.01} value={length} onChange={portrait?setPortraitLength:setSequenceLength}/>
        <section className="showcase-section" aria-label={portrait?"Portrait color":"Background"}>
          {portrait&&<header><strong>Color</strong></header>}
          {!portrait&&<label>Background<select aria-label="Background source" value={backgroundMode} onChange={event=>setBackgroundMode(event.target.value)}><option value="folder">Backgrounds</option><option value="color">Color</option><option value="media">Image/Video</option></select></label>}
          {!portrait&&backgroundMode === 'folder' && <select className="showcase-wide" aria-label="Backgrounds" value={background} onFocus={backgroundLibrary.refresh} onChange={event=>onBackground(event.target.value)}><option value="">None</option>{backgroundLibrary.items.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>}
          {(portrait||backgroundMode === 'color') && colorPicker()}
          {!portrait&&backgroundMode === 'media' && <><button className="showcase-wide showcase-file" onClick={()=>mediaInput.current.click()} title={media?.name}>{media?.name || 'Choose image/video…'}</button><input hidden ref={mediaInput} type="file" accept="image/*,video/*,.mp4,.webm,.mov,.m4v,.ogv,.avi,.mkv,.wmv,.wav" onChange={chooseFile}/>
            {backgroundType?.startsWith('video/') && videoDuration > 0 && <div className="showcase-trim"><NumberField label="From (s)" min={0} max={Math.max(0,(trim.end || videoDuration)-.02)} step={.1} value={trim.start} onChange={value=>setTrim({...trim,start:Math.max(0,Math.min(Number(value)||0,(trim.end||videoDuration)-.02))})}/><NumberField label="To (s)" min={trim.start+.02} max={videoDuration} step={.1} value={trim.end || videoDuration} onChange={value=>setTrim({...trim,end:Math.max(trim.start+.02,Math.min(videoDuration,Number(value)||videoDuration))})}/></div>}
          </>}
        </section>
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
          <header><strong>Camera Control</strong><div>{['rotate','zoom'].map(value=><button key={value} aria-pressed={tool===value} onClick={()=>{setPlaying(false);setTool(value);}}>{value==='rotate'?'Rotate':'Zoom'}</button>)}<button onClick={()=>{setPlaying(false);api?.fit();}}>Fit</button></div></header>
          <Slider label="Orbit speed" value={orbitSpeed} onChange={setOrbitSpeed}/>
          <Slider label="Radius" value={orbitRadius} max={100} onChange={setOrbitRadius}/>
          <small>Z axis · 0% radius spins in place</small>
          <button className="showcase-wide" disabled={!api} onClick={()=>{if(!playing)restart();setPlaying(!playing);}}>{playing?'Pause preview':'Preview orbit'}</button>
          <label>Crop size<select aria-label="Crop size" value={cropPreset} onChange={event=>{const preset=event.target.value;if(preset==='free'){setCrop(selectedCrop);setCropEditing(true);}else setCropEditing(false);setCropPreset(preset);}}><option value="free">Free selection</option><option value="square">Square · 1:1</option><option value="classic">Classic · 4:3</option><option value="wide">Wide · 16:9</option><option value="portrait">Portrait · 3:4</option></select></label>
          <div className="showcase-crop-controls"><button disabled={!api} onClick={()=>{setPlaying(false);setCropEditing(!cropEditing);}}>{cropEditing?'Done':selectedCrop?'Edit crop':'Crop'}</button>{selectedCrop&&<button onClick={()=>{setCrop(null);setCropPreset('free');setCropEditing(false);}}>Reset</button>}</div>
        </section>
        {portrait&&<section className="showcase-section" aria-label="Portrait zoom"><header><strong>Portrait zoom</strong></header><label>Size<select aria-label="Portrait zoom preset" value={[75,100,125,150].includes(portraitZoom)?portraitZoom:"custom"} onChange={event=>setPortraitZoom(Number(event.target.value))}><option value="custom" disabled>Custom</option><option value="75">Small 75%</option><option value="100">Frame 100%</option><option value="125">Close 125%</option><option value="150">Detail 150%</option></select></label><Slider label="Zoom" min={50} max={200} value={portraitZoom} onChange={setPortraitZoom}/></section>}
        <section className="showcase-section" aria-label="Graphics">
          <header><strong>Graphics</strong></header>
          <label>Quality<select aria-label="Graphics quality" value={quality} onChange={event=>setQuality(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">Highest</option></select></label>
          <label>FPS<select aria-label="Recording FPS" value={fps} onChange={event=>setFPS(Number(event.target.value))}>{[10,15,20,24,25,30,50].map(value=><option key={value}>{value}</option>)}</select></label>
          {!portrait&&<label>Light<select aria-label="Light" value={light} onChange={event=>setLight(event.target.value)}><option value="ingame">Ingame</option><option value="portrait">Portrait</option><option value="none">None</option></select></label>}
          <small>{quality==='low'?'1× · no AA · bilinear':quality==='medium'?'1.5× · AA · 4× filtering':'2× · AA · 16× filtering'}</small>
        </section>
        <button className="showcase-wide showcase-signature-button" aria-expanded={signatureOpen} onClick={()=>{setSignatureOpen(!signatureOpen);setCropEditing(false);setPlaying(false);}}>Signature{signature?' *':''}</button>
      </fieldset>
    </aside>
    <section ref={previewRef} className={`showcase-preview${portrait?" portrait":""}`} aria-label="Showcase preview" style={portrait?{"--portrait-zoom":portraitZoom/125,backgroundColor:color}:undefined} inert={busy || undefined}><Suspense fallback={<div className="classic-empty-view">Loading model preview…</div>}><GamePreview showcase={director} presentation="preview" previewMode="textured" mode="textured" overlays={CLEAN} showGrid={false} showAxes={false} showParticles playing={false} sequenceIndex={0} time={model.Sequences?.[0]?.Interval?.[0]||0} model={model} revision={revision} modelPath={modelPath} textureAssets={textureAssets} preferences={localPreferences} teamColor={teamColor} view="perspective" cameraMode={tool} showcaseLight={light} showcaseRadius={orbitRadius} showcasePortraitMode={portrait} portraitCameraIndex={cameraIndex} showcaseSignature={signature&&{url:signature.url,type:signature.type,rect:signature.rect}} showcaseSignatureEditing={signatureOpen} onShowcaseSignatureChange={rect=>setSignature(value=>value?{...value,rect}:value)} onShowcaseSignatureError={message=>onStatus?.(message,true)} onCaptureReady={setAPI} backgroundUrl={backgroundUrl} backgroundType={backgroundType} backgroundTrim={trim} onBackgroundMetadata={setVideoDuration} preserveCameraView showcasePlaying={playing} showcaseConfig={[playlist,length,orbitSpeed,orbitRadius,light,portrait,portraitZoom]}/></Suspense>
      {!portrait&&(cropEditing||selectedCrop)&&<div className={'showcase-crop-overlay'+(cropEditing?' editing':'')} aria-label="Crop area" onPointerDown={cropEditing?startCrop:undefined} onPointerMove={cropEditing?moveCrop:undefined} onPointerUp={cropEditing?finishCrop:undefined} onPointerCancel={cropEditing?finishCrop:undefined}>
        <div className="showcase-crop-selection" style={{left:(selectedCrop?.x||0)*100+'%',top:(selectedCrop?.y||0)*100+'%',width:(selectedCrop?.width??1)*100+'%',height:(selectedCrop?.height??1)*100+'%'}}/>
        {cropEditing&&<div className="showcase-crop-hint">Drag to select the GIF area</div>}
      </div>}
      {signatureOpen&&<div className="showcase-signature-panel" aria-label="Signature editor">
        <header><strong>Signature</strong><button aria-label="Close signature editor" onClick={()=>setSignatureOpen(false)}>�</button></header>
        <button onClick={()=>signatureInput.current?.click()}>Add image/GIF�</button><input hidden ref={signatureInput} type="file" accept="image/*,.gif" onChange={chooseSignature}/>
        <select aria-label="Signature presets" value={signature?.presetId||''} onChange={event=>{const preset=signaturePresets.find(row=>row.id===event.target.value);if(preset)applySignature(preset.blob,preset.name,preset.type,preset.id,preset.rect);}}><option value="">Presets</option>{signaturePresets.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>
        {signature&&<><small>Drag the signature; drag its corner to resize.</small><input aria-label="Signature preset name" value={signatureName} onChange={event=>setSignatureName(event.target.value)} placeholder="Preset name"/>
          <div className="showcase-signature-actions"><button onClick={storeSignature}>Save preset</button><button onClick={()=>{setSignature(null);setSignatureOpen(false);}}>Remove</button>{signature.presetId&&<button onClick={removeSignaturePreset}>Delete preset</button>}</div></>}
      </div>}</section>
    {animationDialog&&<AnimationDialog model={model} initial={animationDialog} portrait={portrait} onClose={()=>setAnimationDialog(null)} onSave={row=>{updatePlaylist(animationDialog.index<0?[...playlist,row]:playlist.map((item,index)=>index===animationDialog.index?row:item));setSelected(animationDialog.index<0?playlist.length:animationDialog.index);setAnimationDialog(null);}} onRemove={()=>{updatePlaylist(playlist.filter((_,index)=>index!==animationDialog.index));setSelected(Math.max(0,animationDialog.index-1));setAnimationDialog(null);}}/>}
  </div>;
}
