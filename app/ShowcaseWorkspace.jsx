import React, { lazy, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import AnimationPreviewTools from './AnimationPreviewTools.jsx';
import { centeredView, createShowcaseDirector, overflowEntries, shotCount, SHOWCASE_QUALITY } from './showcase-director.js';
import './showcase.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
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
function AnimationDialog({ model, mode, initial, onSave, onRemove, onClose }) {
  const [draft, setDraft] = useState(initial);
  const change = patch => setDraft(row => ({ ...row, ...patch }));
  return <Dialog title={initial.editing ? 'Edit animation' : 'Add animation'} onClose={onClose} onSubmit={() => onSave({ sequence: draft.sequence, seconds: Math.max(.02,Number(draft.seconds)||3), speed: draft.speed, loop: true, shots: shotCount(draft.shots) })} footer={initial.editing && <button type="button" onClick={onRemove}>Remove</button>}>
    <label>Animation<select aria-label="Animation" value={draft.sequence} onChange={event => change({sequence:Number(event.target.value)})}>{model.Sequences.map((row,index)=><option key={index} value={index}>{row.Name}</option>)}</select></label>
    {mode === 'record' ? <><NumberField label="Length (seconds)" min={.02} step={.01} value={draft.seconds} onChange={seconds=>change({seconds})}/><Slider label="Speed" value={Math.round(draft.speed*100)} onChange={value=>change({speed:value/100})}/></> : <NumberField label="Screenshots" min={1} max={20} value={draft.shots} onChange={shots=>change({shots})}/>}
  </Dialog>;
}
export default function ShowcaseWorkspace({ model, modelName, modelPath, revision, textureAssets, preferences, teamColor, sessionId, background, backgroundLibrary, onBackground, onStatus }) {
  const [api,setAPI] = useState(null), [playing,setPlaying] = useState(false), [busy,setBusy] = useState(false);
  const [mode,setMode] = useState('record'), [length,setLength] = useState(10), [shots,setShots] = useState(5);
  const [playlist,setPlaylist] = useState(() => model.Sequences?.length ? [{sequence:0,seconds:3,speed:1,loop:true,shots:5}] : []);
  const [selected,setSelected] = useState(0), [animationDialog,setAnimationDialog] = useState(null);
  const [points,setPoints] = useState([]), [selectedCamera,setSelectedCamera] = useState(-1), [cameraDialog,setCameraDialog] = useState(false);
  const [cameraMode,setCameraMode] = useState('sequence'), [orbitBase,setOrbitBase] = useState(null), [orbitAxis,setOrbitAxis] = useState('z'), [orbitStep,setOrbitStep] = useState(null);
  const [motion,setMotion] = useState({speed:100,curve:'arc',smoothness:50}), [viewpoint,setViewpoint] = useState('frontal'), [shotAxis,setShotAxis] = useState('z');
  const [quality,setQuality] = useState('high'), [fps,setFPS] = useState(30), [tool,setTool] = useState('rotate');
  const [backgroundMode,setBackgroundMode] = useState('folder'), [color,setColor] = useState('#cccccc'), [media,setMedia] = useState(null), [videoDuration,setVideoDuration] = useState(0), [trim,setTrim] = useState({start:0,end:0});
  const mediaInput = useRef(null);
  useEffect(() => () => { if (media?.url) URL.revokeObjectURL(media.url); }, [media?.url]);
  const current = useRef();
  current.current = {model,playlist,length,points,cameraMode,orbitBase,orbitAxis,motion,playing};
  const director = useMemo(() => createShowcaseDirector(() => current.current), []);
  const overflow = overflowEntries(playlist,length);
  const center = () => api?.modelCenter() || [0,0,0];
  const camera = () => centeredView(api.cameraView(),center());
  function restart() { director.reset(api?.cameraView(),center()); api?.invalidate(); }
  function updatePlaylist(rows) { setPlaylist(rows); setPlaying(false); director.reset(api?.cameraView(),center()); api?.invalidate(); }
  function editAnimation(index) {
    setPlaying(false); setSelected(index >= 0 ? index : selected);
    setAnimationDialog({index,sequence:index >= 0 ? playlist[index].sequence : 0,seconds:3,speed:1,shots:shotCount(shots),...playlist[index],editing:index >= 0});
  }
  function selectAnimation(index) {
    setSelected(index); setPlaying(false);
    director.clock.seconds = playlist.slice(0,index).reduce((sum,row)=>sum+Number(row.seconds),0);
    director.clock.revision++; api?.invalidate();
  }
  function addCamera() { setPlaying(false); setCameraMode('sequence'); setOrbitStep(null); setPoints(rows=>[...rows,{view:camera()}]); setSelectedCamera(points.length); }
  function showCamera(index) { setPlaying(false); setSelectedCamera(index); api?.setCameraView(points[index].view); }
  function chooseFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.type.startsWith('audio/') || /\.wav$/i.test(file.name)) { onStatus?.('WAV contains audio only. Choose an image or a video with a picture track.',true); return; }
    const video = file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|ogv|mkv|avi|wmv)$/i.test(file.name);
    setMedia({url:URL.createObjectURL(file),type:video ? file.type || 'video/mp4' : file.type || (/\.gif$/i.test(file.name)?'image/gif':'image/png'),name:file.name});
    setVideoDuration(0); setTrim({start:0,end:0});
  }
  const backgroundUrl = backgroundMode === 'folder' ? backgroundLibrary.url : backgroundMode === 'media' ? media?.url : '';
  const backgroundType = backgroundMode === 'folder' ? backgroundLibrary.type : backgroundMode === 'media' ? media?.type : '';
  const localPreferences = useMemo(() => ({ ...preferences,
    graphics:{...preferences.graphics,...SHOWCASE_QUALITY[quality],textures:true,lighting:true,particles:true,maxFps:60,pauseWhenHidden:false},
    viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color,imageData:'',display:'fill',opacity:1}},
    platform:{enabled:false},capture:{fps,recordingQuality:quality,screenshotQuality:quality},
  }),[preferences,quality,fps,color]);
  return <div className="showcase-workspace">
    <aside className="showcase-sidebar" aria-label="Showcase controls">
      <AnimationPreviewTools active sessionId={sessionId} modelName={modelName} captureAPI={api} preferences={localPreferences} loop mode={mode} length={length} playlist={playlist} model={model} shotOptions={{viewpoint,axis:shotAxis}} disabled={mode === 'record' && overflow.some(Boolean) || !playlist.length || backgroundMode === 'folder' && backgroundLibrary.loading} onStatus={onStatus} onBusy={value=>{setBusy(value);if(value)setPlaying(false);}}/>
      <fieldset disabled={busy} className="showcase-fields">
        <div className="showcase-mode"><span>Mode:</span>{['record','screenshot'].map(value=><button key={value} aria-pressed={mode===value} onClick={()=>{setMode(value);setPlaying(false);}}>{value === 'record' ? 'Record' : 'Screenshot'}</button>)}</div>
        {mode === 'record' ? <NumberField label="Length" aria-label="Record length seconds" min={.02} step={.01} value={length} onChange={setLength}/> : <NumberField label="Shots" title="Default takes for newly added animations" min={1} max={20} value={shots} onChange={value=>setShots(shotCount(value))}/>}
        <section className="showcase-section" aria-label="Background">
          <label>Background<select aria-label="Background source" value={backgroundMode} onChange={event=>setBackgroundMode(event.target.value)}><option value="folder">Backgrounds</option><option value="color">Color</option><option value="media">Image/Video</option></select></label>
          {backgroundMode === 'folder' && <select className="showcase-wide" aria-label="Backgrounds" value={background} onFocus={backgroundLibrary.refresh} onChange={event=>onBackground(event.target.value)}><option value="">None</option>{backgroundLibrary.items.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>}
          {backgroundMode === 'color' && <label>Color<input aria-label="Background color" type="color" value={color} onChange={event=>setColor(event.target.value)}/></label>}
          {backgroundMode === 'media' && <><button className="showcase-wide showcase-file" onClick={()=>mediaInput.current.click()} title={media?.name}>{media?.name || 'Choose image/video…'}</button><input hidden ref={mediaInput} type="file" accept="image/*,video/*,.mp4,.webm,.mov,.m4v,.ogv,.avi,.mkv,.wmv,.wav" onChange={chooseFile}/>
            {backgroundType?.startsWith('video/') && videoDuration > 0 && <div className="showcase-trim"><NumberField label="From (s)" min={0} max={Math.max(0,(trim.end || videoDuration)-.02)} step={.1} value={trim.start} onChange={value=>setTrim({...trim,start:Math.max(0,Math.min(Number(value)||0,(trim.end||videoDuration)-.02))})}/><NumberField label="To (s)" min={trim.start+.02} max={videoDuration} step={.1} value={trim.end || videoDuration} onChange={value=>setTrim({...trim,end:Math.max(trim.start+.02,Math.min(videoDuration,Number(value)||videoDuration))})}/></div>}
          </>}
        </section>
        <section className="showcase-section" aria-label="Sequence">
          <header><strong>Sequence</strong><button disabled={!model.Sequences?.length} onClick={()=>editAnimation(-1)}>Add</button></header>
          <ol className="showcase-list" aria-label="Animation sequence">{playlist.map((row,index)=><li key={index} className={(selected===index?' selected':'')+(mode==='record'&&overflow[index]?' overflow':'')} onClick={()=>selectAnimation(index)} onDoubleClick={()=>editAnimation(index)} onContextMenu={event=>{event.preventDefault();editAnimation(index);}} tabIndex={0} onKeyDown={event=>{if(event.key==='Enter')editAnimation(index);if(event.key==='Delete')updatePlaylist(playlist.filter((_,i)=>i!==index));}} title="Right-click to edit">
            <span>{index+1}. {model.Sequences[row.sequence]?.Name}</span><small>{mode==='record'?row.seconds+'s · '+Math.round(row.speed*100)+'%':shotCount(row.shots)+' shots'}</small>
          </li>)}</ol>
          {mode==='record'&&overflow.some(Boolean)&&<div className="showcase-error" role="alert">Sequence too short</div>}
          <div className="showcase-list-actions"><button disabled={selected<=0 || !playlist[selected]} aria-label="Move animation up" onClick={()=>{const rows=[...playlist];[rows[selected-1],rows[selected]]=[rows[selected],rows[selected-1]];updatePlaylist(rows);setSelected(selected-1);}}>↑</button><button disabled={selected>=playlist.length-1 || !playlist[selected]} aria-label="Move animation down" onClick={()=>{const rows=[...playlist];[rows[selected+1],rows[selected]]=[rows[selected],rows[selected+1]];updatePlaylist(rows);setSelected(selected+1);}}>↓</button>
          {mode==='record'&&<><button disabled={!api} onClick={()=>{if(!playing)restart();setPlaying(!playing);}}>{playing?'Pause':'Play'}</button></>}</div>
        </section>
        <section className="showcase-section" aria-label="Camera Control">
          <header><strong>Camera Control</strong><div>{['rotate','zoom'].map(value=><button key={value} aria-pressed={tool===value} onClick={()=>{setPlaying(false);setTool(value);}}>{value==='rotate'?'Rotate':'Zoom'}</button>)}<button onClick={()=>{setPlaying(false);api?.fit();}}>Fit</button></div></header>
          {mode==='screenshot' ? <>
            <NumberField label="Takes" title={playlist[selected] ? model.Sequences[playlist[selected].sequence]?.Name : 'Select an animation'} min={1} max={20} disabled={!playlist[selected]} value={shotCount(playlist[selected]?.shots || shots)} onChange={value=>updatePlaylist(playlist.map((row,index)=>index===selected?{...row,shots:shotCount(value)}:row))}/>
            <label>Viewpoint<select aria-label="Viewpoint" value={viewpoint} onChange={event=>setViewpoint(event.target.value)}><option value="frontal">Frontal</option><option value="orbital">Orbital</option><option value="zoom">Zoom</option><option value="free">Free</option></select></label>
            {['orbital','zoom'].includes(viewpoint)&&<label>Axis<select aria-label="Screenshot axis" value={shotAxis} onChange={event=>setShotAxis(event.target.value)}>{['x','y','z'].map(axis=><option key={axis} value={axis}>{axis.toUpperCase()}</option>)}</select></label>}
          </> : <>
            <div className="showcase-camera-actions"><button disabled={!api} onClick={addCamera}>Add camera</button><button disabled={!api} aria-pressed={cameraMode==='orbit'} onClick={()=>{setPlaying(false);setOrbitStep('position');}}>Orbital</button></div>
            {orbitStep==='position'&&<div className="showcase-orbit-prompt">Set your camera angle in the preview.<button onClick={()=>{setOrbitBase(camera());setOrbitStep('axis');}}>Confirm angle</button><button onClick={()=>setOrbitStep(null)}>Cancel</button></div>}
            {orbitStep==='axis'&&<Dialog title="Orbit axis" onClose={()=>setOrbitStep(null)} onSubmit={()=>{setCameraMode('orbit');setOrbitStep(null);restart();}}><label>Axis<select aria-label="Orbit axis" value={orbitAxis} onChange={event=>setOrbitAxis(event.target.value)}>{['x','y','z'].map(axis=><option key={axis} value={axis}>{axis.toUpperCase()}</option>)}</select></label></Dialog>}
            {cameraMode==='orbit' ? <div className="showcase-orbit-summary">Orbital · {orbitAxis.toUpperCase()} · {length}s<button onClick={()=>{setCameraMode('sequence');setPlaying(false);}}>Free cameras</button></div> : <>
              <ol className="showcase-list showcase-camera-list" aria-label="Camera sequence">{points.map((row,index)=><li key={index} tabIndex={0} className={selectedCamera===index?'selected':''} onClick={()=>showCamera(index)} onContextMenu={event=>{event.preventDefault();setSelectedCamera(index);setCameraDialog(true);}} onKeyDown={event=>{if(event.key==='Enter'){setSelectedCamera(index);setCameraDialog(true);}}}>Camera {index+1}</li>)}</ol>
              {points.length>0&&<div className="showcase-list-actions"><button disabled={selectedCamera<=0} aria-label="Move camera up" onClick={()=>{const rows=[...points];[rows[selectedCamera-1],rows[selectedCamera]]=[rows[selectedCamera],rows[selectedCamera-1]];setPoints(rows);setSelectedCamera(selectedCamera-1);}}>↑</button><button disabled={selectedCamera<0||selectedCamera>=points.length-1} aria-label="Move camera down" onClick={()=>{const rows=[...points];[rows[selectedCamera+1],rows[selectedCamera]]=[rows[selectedCamera],rows[selectedCamera+1]];setPoints(rows);setSelectedCamera(selectedCamera+1);}}>↓</button><button disabled={selectedCamera<0} onClick={()=>setCameraDialog(true)}>Edit</button></div>}
              {points.length>1&&<><Slider label="Camera speed" min={25} value={motion.speed} onChange={speed=>setMotion({...motion,speed})}/><label>Curve<select aria-label="Camera curve" value={motion.curve} onChange={event=>setMotion({...motion,curve:event.target.value})}><option value="arc">Arc</option><option value="straight">Straight</option></select></label><Slider label="Smoothness" max={100} value={motion.smoothness} onChange={smoothness=>setMotion({...motion,smoothness})}/></>}
            </>}
          </>}
        </section>
        <section className="showcase-section" aria-label="Graphics">
          <header><strong>Graphics</strong></header>
          <label>Quality<select aria-label="Graphics quality" value={quality} onChange={event=>setQuality(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">Highest</option></select></label>
          {mode==='record'&&<label>FPS<select aria-label="Recording FPS" value={fps} onChange={event=>setFPS(Number(event.target.value))}>{[10,15,20,24,25,30,50].map(value=><option key={value}>{value}</option>)}</select></label>}
          <small>{quality==='low'?'1× · no AA · bilinear':quality==='medium'?'1.5× · AA · 4× filtering':'2× · AA · 16× filtering'}</small>
        </section>
      </fieldset>
    </aside>
    <section className="showcase-preview" aria-label="Showcase preview" inert={busy || undefined}><Suspense fallback={<div className="classic-empty-view">Loading model preview…</div>}><GamePreview showcase={director} presentation="preview" previewMode="textured" mode="textured" overlays={CLEAN} showGrid={false} showAxes={false} showParticles playing={false} sequenceIndex={0} time={model.Sequences?.[0]?.Interval?.[0]||0} model={model} revision={revision} modelPath={modelPath} textureAssets={textureAssets} preferences={localPreferences} teamColor={teamColor} view="perspective" cameraMode={tool} portraitCameraIndex={0} preparePortraitFrame={playlist.some(row=>/portrait/i.test(model.Sequences[row.sequence]?.Name||''))} onCaptureReady={setAPI} backgroundUrl={backgroundUrl} backgroundType={backgroundType} backgroundTrim={trim} onBackgroundMetadata={setVideoDuration} preserveCameraView showcasePlaying={playing} showcaseConfig={[playlist,length,points,cameraMode,orbitAxis,motion]}/></Suspense></section>
    {animationDialog&&<AnimationDialog model={model} mode={mode} initial={animationDialog} onClose={()=>setAnimationDialog(null)} onSave={row=>{updatePlaylist(animationDialog.index<0?[...playlist,row]:playlist.map((item,index)=>index===animationDialog.index?row:item));setSelected(animationDialog.index<0?playlist.length:animationDialog.index);setAnimationDialog(null);}} onRemove={()=>{updatePlaylist(playlist.filter((_,index)=>index!==animationDialog.index));setSelected(Math.max(0,animationDialog.index-1));setAnimationDialog(null);}}/>}
    {cameraDialog&&points[selectedCamera]&&<Dialog title={'Camera '+(selectedCamera+1)} onClose={()=>setCameraDialog(false)} onSubmit={()=>setCameraDialog(false)} footer={<button type="button" onClick={()=>{setPoints(points.filter((_,index)=>index!==selectedCamera));setSelectedCamera(-1);setCameraDialog(false);}}>Remove</button>}><button type="button" onClick={()=>{setPoints(points.map((row,index)=>index===selectedCamera?{view:camera()}:row));setCameraDialog(false);}}>Use current view</button><button type="button" onClick={()=>{showCamera(selectedCamera);setCameraDialog(false);}}>View camera</button></Dialog>}
  </div>;
}
