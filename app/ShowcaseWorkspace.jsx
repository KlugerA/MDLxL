import React, { lazy, useEffect, useMemo, useRef, useState, useCallback, Suspense } from 'react';
import AnimationPreviewTools from './AnimationPreviewTools.jsx';
import { cropBetween, cropPresetRect, SHOWCASE_CROP_PRESETS } from './showcase-crop.js';
import { createShowcaseDirector, overflowEntries, SHOWCASE_QUALITY } from './showcase-director.js';
import ShowcaseLayerTools from './ShowcaseLayerTools.jsx';
import './showcase.css';
import { translate } from '../src/localization.js';
import { flushSync } from 'react-dom';
import { SHOWCASE_PRESETS, builtinSetup, listShowcasePresets, saveShowcasePreset, snapshotShowcase, hydrateShowcase } from './showcase-presets.js';
import { validateShowcaseExport } from './showcase-export.js';
import { moveDragPoint } from './classic-gestures.js';
import { loopEffectTiming, timeShowcasePlaylist, showcaseEmitters } from './showcase-effects.js';
import { remapShowcasePlaylist, remapShowcaseTake, snapshotShowcaseModel, hydrateShowcaseModel } from './showcase-model.js';
import { alignShowcaseText } from './showcase-text.js';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const SHOWCASE_COLORS = [
  ['Black','#000000'], ['Charcoal','#292f38'], ['Slate','#546477'],
  ['Gray','#858d91'], ['Warm gray','#b5aa99'], ['Light gray','#e4e0d7'],
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
function ExtraTimeField({value,onChange,base,label='Extra Time'}) {
  const total=Math.round((base+Math.max(0,Number(value)||0))*100)/100;
  return <label className="showcase-extra-time">Extra Time<input aria-label={label} type="number" min={0} step={.01} value={value} onChange={event=>onChange(event.target.value===''?'':Math.max(0,Number(event.target.value)||0))}/><output title={`Sequence: ${base}s, including effects. Total: ${total}s.`}>{total}s</output></label>;
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
function AnimationDialog({ model, initial, portrait, exportTarget, definitions, onSave, onRemove, onClose }) {
  const duration=(row,loops=row.durationLoops??1)=>loopEffectTiming(model,row.sequence,loops,row.speed>0?row.speed:1,0,definitions,row.disabledEmitters).seconds;
  const [draft,setDraft]=useState(()=>({...initial,durationLoops:initial.durationLoops??1,extraTime:Math.max(0,Number(initial.extraTime)||0)})),[error,setError]=useState('');
  const sequence=model.Sequences[draft.sequence],base=duration(draft),emitters=showcaseEmitters(model),disabled=new Set(draft.disabledEmitters || []);
  const naturalSeconds=Math.max(0,(sequence?.Interval?.[1]||0)-(sequence?.Interval?.[0]||0))/1000;
  const change=patch=>setDraft(row=>({...row,...patch}));
  return <Dialog title={initial.editing ? 'Edit animation' : 'Add animation'} onClose={onClose} onSubmit={() => {
    const durationLoops=Number(draft.durationLoops);
    if(!Number.isSafeInteger(durationLoops)||durationLoops<1){setError('Enter a whole number of loops, at least 1.');return;}
    const extraTime=Math.max(0,Number(draft.extraTime)||0),seconds=Math.round((base+extraTime)*100)/100;
    try{validateShowcaseExport(exportTarget,seconds);}catch(error){setError(error.message);return;}
    onSave({sequence:draft.sequence,seconds,speed:draft.speed,loop:true,useDuration:true,durationLoops,extraTime,disabledEmitters:[...disabled]});
  }} footer={initial.editing && <button type="button" onClick={onRemove}>Remove</button>}>
    <label>Animation<select aria-label="Animation" value={draft.sequence} onChange={event => change({sequence:Number(event.target.value)})}>{model.Sequences.map((row,index)=>isPortrait(row)===portrait?<option translate="no" key={index} value={index}>{row.Name}</option>:null)}</select></label>
    <ExtraTimeField label="Animation Extra Time" value={draft.extraTime} base={base} onChange={extraTime=>change({extraTime})}/><label className="showcase-extra-time">Loops<input aria-label="Loops" type="number" min="1" step="1" disabled={draft.speed<=0||naturalSeconds<=0} value={draft.durationLoops} onChange={event=>change({durationLoops:event.target.value===''?'':Number(event.target.value)})}/><output>{base}s</output></label>{!portrait&&<Slider label="Speed" value={Math.round(draft.speed*100)} onChange={value=>change({speed:value/100})}/>}
    {emitters.length > 0 && <details className="showcase-emitters"><summary>Emitters{disabled.size ? ` · ${disabled.size} off` : ''}</summary><div>{emitters.map(emitter => <label key={emitter.id} translate="no" title={emitter.name}><input type="checkbox" translate="no" aria-label={emitter.name} checked={!disabled.has(emitter.id)} onChange={event => change({disabledEmitters: event.target.checked ? [...disabled].filter(id => id !== emitter.id) : [...disabled, emitter.id]})}/><span translate="no">{emitter.name}</span></label>)}</div></details>}
    {error&&<div className="showcase-error" role="alert">{error}</div>}
  </Dialog>;
}

export default function ShowcaseWorkspace({ model: inputModel, modelName: inputModelName, modelPath: inputModelPath, revision: inputRevision, textureAssets: inputTextureAssets, preferences, teamColor, sessionId: inputSessionId, background, backgroundLibrary, onBackground, onStatus, active=true, onLoadModel }) {
  const [recordingModel,setRecordingModel]=useState(null);
  useEffect(()=>()=>{for(const asset of new Set(recordingModel?.textureAssets.values()||[]))if(asset.url)URL.revokeObjectURL(asset.url);},[recordingModel]);
  const incomingModel=useRef({sessionId:inputSessionId,revision:inputRevision});
  const incomingChanged=incomingModel.current.sessionId!==inputSessionId||incomingModel.current.revision!==inputRevision;
  if(incomingChanged){incomingModel.current={sessionId:inputSessionId,revision:inputRevision};if(recordingModel)setRecordingModel(null);}
  const source=incomingChanged?null:recordingModel;
  const model=source?.model||inputModel,modelName=source?.modelName||inputModelName,modelPath=source?source.modelPath:inputModelPath;
  const revision=source?.revision??inputRevision,sessionId=source?.sessionId||inputSessionId,textureAssets=source?.textureAssets||inputTextureAssets;
  const [api,setAPI] = useState(null), [playing,setPlaying] = useState(false), [previewOrbit,setPreviewOrbit] = useState(false), [busy,setBusy] = useState(false);
  const [crop,setCrop] = useState(null), [cropPreset,setCropPreset] = useState('free'), [cropEditing,setCropEditing] = useState(false), cropDrag = useRef(null);
  const previewRef = useRef(null), [previewSize,setPreviewSize] = useState({width:1,height:1});
  const [exportTarget,setExportTarget]=useState(null),[mainPicture,setMainPicture]=useState(false);
  const modelInput=useRef(null);
  const selectedCrop = mainPicture?cropPresetRect(previewSize.width,previewSize.height,612/490):cropPreset === 'free' ? crop : cropPresetRect(previewSize.width,previewSize.height,SHOWCASE_CROP_PRESETS[cropPreset]);
  useEffect(() => {
    const node = previewRef.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setPreviewSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  const [mode,setMode] = useState('sequences'), [sequenceExtraTime,setSequenceExtraTime] = useState(0), [portraitExtraTime,setPortraitExtraTime] = useState(0), [orbitSpeed,setOrbitSpeed] = useState(150), [orbitDirection,setOrbitDirection] = useState(1), [orbitTiming,setOrbitTiming] = useState('speed'), [orbitRadius,setOrbitRadius] = useState(0), [orbitAngle,setOrbitAngle] = useState(0), [light,setLight] = useState('ingame');
  const [sequencePlaylist,setSequencePlaylist] = useState(() => { const index=model.Sequences?.findIndex(row=>!isPortrait(row)) ?? -1; return index<0?[]:timeShowcasePlaylist(model,[{sequence:index,speed:1,loop:true,useDuration:true,durationLoops:1,extraTime:0}]); });
  const [portraitPlaylist,setPortraitPlaylist] = useState(() => { const index=model.Sequences?.findIndex(isPortrait) ?? -1; return index<0?[]:timeShowcasePlaylist(model,[{sequence:index,speed:1,loop:true,useDuration:true,durationLoops:1,extraTime:0}]); });
  const sequenceBase=sequencePlaylist.reduce((sum,row)=>sum+Number(row.seconds),0),portraitBase=portraitPlaylist.reduce((sum,row)=>sum+Number(row.seconds),0);
  const sequenceLength=Math.max(.02,Math.round((sequenceBase+(Number(sequenceExtraTime)||0))*100)/100),portraitLength=Math.max(.02,Math.round((portraitBase+(Number(portraitExtraTime)||0))*100)/100);
  const portrait = mode === 'portrait', playlist = portrait ? portraitPlaylist : sequencePlaylist, length = portrait ? portraitLength : sequenceLength;
  const available = model.Sequences?.map((row,index)=>isPortrait(row)===portrait?index:-1).filter(index=>index>=0) || [];
  const portraitCameraIndex = model.Cameras?.findIndex(camera=>/portrait/i.test(String(camera.Name||''))) ?? -1;
  const cameraIndex = portraitCameraIndex >= 0 ? portraitCameraIndex : model.Cameras?.length ? 0 : -1;
  const [selected,setSelected] = useState(0), [animationDialog,setAnimationDialog] = useState(null);
  const [collapsed,setCollapsed] = useState({});
  const sectionClass = key => 'showcase-section' + (collapsed[key] ? ' is-collapsed' : '');
  function sectionToggle(key,label,iconOnly=false) {
    return <button type="button" className={'showcase-section-toggle'+(iconOnly?' showcase-collapse-icon':'')} aria-label={(collapsed[key]?'Expand ':'Collapse ')+label} aria-expanded={!collapsed[key]} onClick={()=>setCollapsed(values=>({...values,[key]:!values[key]}))}>{iconOnly?'':label}</button>;
  }

  const [quality,setQuality] = useState('high'), [fps,setFPS] = useState(30);
  const [backgroundMode,setBackgroundMode] = useState('color'), [color,setColor] = useState(SHOWCASE_COLORS[2][1]), [savedColors,setSavedColors] = useState(readSavedColors), [portraitZoom,setPortraitZoom] = useState(100), [media,setMedia] = useState(null), [videoDuration,setVideoDuration] = useState(0), [trim,setTrim] = useState({start:0,end:0});
  const mediaInput = useRef(null);
  const [layers,setLayers] = useState([]), [activeLayer,setActiveLayer] = useState(null), [layersEditing,setLayersEditing] = useState(false), [portraitFrameEnabled,setPortraitFrameEnabled] = useState(true);
  const framedPortrait = portrait && portraitFrameEnabled && !mainPicture;
  const [grid,setGrid]=useState(false),[gridDensity,setGridDensity]=useState(5);
  const [presets,setPresets]=useState([]),[presetDialog,setPresetDialog]=useState(null),[presetName,setPresetName]=useState(''),[presetId,setPresetId]=useState(SHOWCASE_PRESETS[0].id),[setupBusy,setSetupBusy]=useState(false);
  const [presetKind,setPresetKind]=useState('layout'),[presetEditing,setPresetEditing]=useState(null),[presetError,setPresetError]=useState('');
  const [recordingList,setRecordingList]=useState([]),[backgroundAsset,setBackgroundAsset]=useState(null),[applyVersion,setApplyVersion]=useState(0);
  const [editingRecording,setEditingRecording]=useState(null),recordingDraft=useRef(null),recordingEdits=useRef(new Map());
  const draggedRecording=useRef(null),[recordingDrop,setRecordingDrop]=useState(null);
  const recordingPlan=recordingList.map(take=>recordingEdits.current.get(take.id)||take);
  const setupURLs=useRef(new Set()),pendingApply=useRef(null),apiRef=useRef(null),captureSettings=useRef(null),batchRestore=useRef(null);
  const captureReady=useCallback(value=>{apiRef.current=value;setAPI(value);},[]);
  const previousModel=useRef({model,sessionId}),modelView=useRef(null);
  if(previousModel.current.sessionId!==sessionId){
    const previous=previousModel.current.model;
    modelView.current={view:apiRef.current?.showcaseView(),previousAPI:apiRef.current};
    previousModel.current={model,sessionId};
    // Only the working setup follows a newly loaded model. Queued takes and
    // the edit/batch return setup keep their own model and animation indices.
    if(!pendingApply.current){setSequencePlaylist(rows=>timeShowcasePlaylist(model,remapShowcasePlaylist(rows,previous,model)));setPortraitPlaylist(rows=>timeShowcasePlaylist(model,remapShowcasePlaylist(rows,previous,model)));}
    else modelView.current=null;
    setSelected(0);stopPreview();setAnimationDialog(null);
  }else previousModel.current.model=model;
  useEffect(()=>{if(!api)return;let live=true;api.whenReady().then(()=>{if(!live)return;const definitions=api.effectDefinitions();
    setSequencePlaylist(rows=>timeShowcasePlaylist(model,rows,definitions));setPortraitPlaylist(rows=>timeShowcasePlaylist(model,rows,definitions));
  }).catch(error=>{if(live&&apiRef.current===api)onStatus?.(error.message,true);});return()=>{live=false;};},[api,sessionId]);
  useEffect(()=>{if(!active)stopPreview();},[active]);
  useEffect(()=>{const pending=modelView.current;if(!pending||!api||api===pending.previousAPI)return;modelView.current=null;if(pending.view)api.restoreShowcaseView(pending.view);},[api,sessionId]);
  useEffect(()=>{let live=true;listShowcasePresets().then(rows=>{if(live)setPresets(rows);}).catch(error=>onStatus?.('Could not load Showcase presets: '+error.message,true));return()=>{live=false;};},[]);
  useEffect(()=>()=>{for(const url of setupURLs.current)URL.revokeObjectURL(url);pendingApply.current?.reject(Error('Showcase closed while loading a setup.'));pendingApply.current=null;},[]);
  useEffect(()=>{if(layersEditing){setCropEditing(false);stopPreview();}},[layersEditing]);
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
    const point={x:event.clientX,y:event.clientY};
    cropDrag.current = { start: cropPoint(event), motion:{pointer:point,point,shift:event.shiftKey,axis:null}, previous: crop, previousPreset: cropPreset };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function cropMotionPoint(event) {
    const box=event.currentTarget.getBoundingClientRect(),point=moveDragPoint(cropDrag.current.motion,{x:event.clientX,y:event.clientY},event.shiftKey);
    return {x:(point.x-box.left)/box.width,y:(point.y-box.top)/box.height};
  }
  function moveCrop(event) {
    if (!cropDrag.current) return;
    const selection = cropBetween(cropDrag.current.start, cropMotionPoint(event));
    if (selection.width >= .05 && selection.height >= .05) { setCropPreset('free'); setCrop(selection); }
  }
  useEffect(()=>{
    const shift=event=>{if(event.key==='Shift'&&cropDrag.current)moveDragPoint(cropDrag.current.motion,cropDrag.current.motion.pointer,event.shiftKey);};
    window.addEventListener('keydown',shift);window.addEventListener('keyup',shift);
    return()=>{window.removeEventListener('keydown',shift);window.removeEventListener('keyup',shift);};
  },[]);
  function finishCrop(event) {
    if (!cropDrag.current) return;
    const selection = cropBetween(cropDrag.current.start, cropMotionPoint(event));
    if (selection.width >= .05 && selection.height >= .05) { setCropPreset('free'); setCrop(selection); }
    else { setCropPreset(cropDrag.current.previousPreset); setCrop(cropDrag.current.previous); }
    cropDrag.current = null;
  }
  useEffect(() => () => { if (media?.url) URL.revokeObjectURL(media.url); }, [media?.url]);
  const current = useRef();
  current.current = {model,playlist,length,orbitSpeed,orbitDirection,orbitTiming:exportTarget==='hive'||mainPicture?'speed':orbitTiming,playing,previewOrbit,portrait,startAngle:orbitAngle};
  const director = useMemo(() => createShowcaseDirector(() => current.current), []);
  const overflow = overflowEntries(playlist,length);
  let exportError='';try{validateShowcaseExport(mainPicture?'hive-main':exportTarget,length,playlist);}catch(error){exportError=error.message;}
  function chooseExportTarget(value){const next=exportTarget===value?null:value;setExportTarget(next);stopPreview();}
  function chooseMainPicture(){setMainPicture(value=>!value);stopPreview();setCropEditing(false);}

  const center = () => api?.modelCenter() || [0,0,0];
  function stopPreview() { setPlaying(false); setPreviewOrbit(false); }
  function updatePlaylist(rows) { const timed=timeShowcasePlaylist(model,rows,apiRef.current?.effectDefinitions());(portrait?setPortraitPlaylist:setSequencePlaylist)(timed); stopPreview(); director.reset(api?.cameraView(),center()); api?.invalidate(); }
  function toggleAnimationPreview() {
    if (!playing) { director.clock.seconds=0; director.clock.revision++; }
    setPlaying(!playing); api?.invalidate();
  }
  function toggleOrbitPreview() {
    if (!previewOrbit) { director.clock.orbitSeconds=0; director.clock.angle=Number(orbitAngle)||0; }
    setPreviewOrbit(!previewOrbit); api?.invalidate();
  }
  function editAnimation(index) {
    stopPreview(); setSelected(index >= 0 ? index : selected);
    setAnimationDialog({index,sequence:index >= 0 ? playlist[index].sequence : available[0],speed:1,...(index<0?{useDuration:true,durationLoops:1,extraTime:0}:playlist[index]),editing:index >= 0});
  }
  function selectAnimation(index) {
    setSelected(index); stopPreview();
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
    viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color:portrait&&(!portraitFrameEnabled||mainPicture)?'#000000':color,imageData:'',display:'fill',opacity:1}},
    platform:{enabled:false},lighting:{...preferences.lighting,preset:'legacy'},capture:{fps,recordingQuality:quality},
  }),[preferences,quality,fps,color,portrait,portraitFrameEnabled,mainPicture]);
  captureSettings.current={api,preferences:localPreferences,length,crop:framedPortrait?null:selectedCrop,cropAspect:framedPortrait?undefined:mainPicture?612/490:SHOWCASE_CROP_PRESETS[cropPreset],mainPicture,loop:true,modelName};
  async function captureSetup(animations=false){
    if(!apiRef.current)throw Error('The Showcase preview is still loading.');
    if(backgroundMode==='folder'&&!backgroundAsset&&backgroundLibrary.loading)throw Error('Wait for the background to finish loading.');
    await apiRef.current.whenReady();
    return snapshotShowcase({version:1,orbitAngle:director.clock.angle,mainPicture,mode,sequenceLength,portraitLength,sequenceExtraTime,portraitExtraTime,orbitSpeed,orbitDirection,orbitTiming,orbitRadius,light,quality,fps,backgroundMode,color,crop,cropPreset,media,background,backgroundAsset:backgroundMode==='folder'&&(backgroundAsset?.url||backgroundLibrary.url)?{id:backgroundAsset?.id||background,name:backgroundAsset?.name||backgroundLibrary.items.find(item=>item.id===background)?.label||background,type:backgroundAsset?.type||backgroundLibrary.type,url:backgroundAsset?.url||backgroundLibrary.url,blob:backgroundAsset?.blob}:null,trim,portraitZoom,portraitFrameEnabled,grid,gridDensity,layers,view:apiRef.current.showcaseView(),...(animations?{sequencePlaylist,portraitPlaylist,modelSource:await snapshotShowcaseModel({model,modelName,modelPath,revision,sessionId,textureAssets})}:{})});
  }
  function applySetup(snapshot){
    return new Promise((resolve,reject)=>{
      const previousURLs=[...setupURLs.current],setup=hydrateShowcase(snapshot,setupURLs.current);
      const modelSource=setup.modelSource?hydrateShowcaseModel(setup.modelSource,new Set()):null;
      const targetModel=modelSource?.model||model,definitions=modelSource?undefined:apiRef.current?.effectDefinitions();
      pendingApply.current={setup,resolve,reject,previousURLs,previousAPI:apiRef.current,modelSource};
      flushSync(()=>{
        if(modelSource)setRecordingModel(modelSource);
        stopPreview();setCropEditing(false);setMainPicture(!!setup.mainPicture);setMode(setup.mode);setSequenceExtraTime(Math.max(0,Number(setup.sequenceExtraTime)||0));setPortraitExtraTime(Math.max(0,Number(setup.portraitExtraTime)||0));
        setOrbitTiming(setup.orbitTiming==='circle'?'circle':'speed');setOrbitSpeed(setup.orbitSpeed);setOrbitDirection(setup.orbitDirection===-1?-1:1);setOrbitRadius(setup.orbitRadius);setOrbitAngle(setup.orbitAngle||0);setLight(setup.light);setQuality(setup.quality);setFPS(setup.fps);
        setBackgroundMode(setup.backgroundMode);setColor(setup.color);setCrop(setup.crop);setCropPreset(setup.cropPreset);setMedia(setup.media);setBackgroundAsset(setup.backgroundAsset);onBackground(setup.background||'');setTrim(setup.trim);setVideoDuration(0);
        setPortraitZoom(setup.portraitZoom);setPortraitFrameEnabled(setup.portraitFrameEnabled);setGrid(!!setup.grid);setGridDensity(setup.gridDensity||5);setLayers(setup.layers);setActiveLayer(null);setLayersEditing(false);setSelected(0);
        if(setup.sequencePlaylist)setSequencePlaylist(timeShowcasePlaylist(targetModel,setup.sequencePlaylist,definitions));if(setup.portraitPlaylist)setPortraitPlaylist(timeShowcasePlaylist(targetModel,setup.portraitPlaylist,definitions));
        setApplyVersion(value=>value+1);
      });
      director.reset();
    });
  }
  useEffect(()=>{
    const pending=pendingApply.current;if(!pending||!api||apiRef.current!==api||(pending.modelSource&&api===pending.previousAPI))return;
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
  const presetType=row=>row.kind==='set'?'set':'layout';
  const matchingPresets=presets.filter(row=>presetType(row)===presetKind);
  function openPresetDialog(action){
    setPresetError('');setPresetDialog(action);
    setPresetName(presetEditing?.name||modelName.replace(/\.[^.]+$/,'')+(presetKind==='set'?' set':' layout'));
    setPresetId(action==='save'?'':matchingPresets[0]?.id||(presetKind==='layout'?SHOWCASE_PRESETS[0].id:''));
  }
  function changePresetKind(kind){
    setPresetKind(kind);setPresetError('');
    setPresetId(presetDialog==='save'?'':presets.find(row=>presetType(row)===kind)?.id||(kind==='layout'?SHOWCASE_PRESETS[0].id:''));
    setPresetName(modelName.replace(/\.[^.]+$/,'')+(kind==='set'?' set':' layout'));
  }
  async function presetContents(kind){
    if(kind==='layout')return {setup:await captureSetup()};
    const working=await captureSetup(true);
    const currentTake={id:editingRecording||crypto.randomUUID(),name:playlist.map(row=>model.Sequences[row.sequence]?.Name).join(' → ')+' · '+length+'s',setup:working};
    const recordings=recordingList.length?recordingPlan.map(row=>row.id===editingRecording?currentTake:row):[currentTake];
    return {working,recordings:structuredClone(recordings),exportTarget};
  }
  async function saveSetup(update=null){
    setSetupBusy(true);setPresetError('');
    try{
      const prior=update||presets.find(row=>row.id===presetId&&presetType(row)===presetKind),kind=update?.kind||presetKind;
      const name=(update?.name||presetName).trim();if(!name)throw Error('Enter a preset name.');
      const row={id:prior?.id||crypto.randomUUID(),name,kind,...await presetContents(kind)};
      await saveShowcasePreset(row);setPresets(await listShowcasePresets());setPresetId(row.id);setPresetDialog(null);setPresetEditing(null);
      onStatus?.('Saved '+(kind==='set'?'recording set: ':'layout: ')+name);
    }catch(error){setPresetError(error.message);onStatus?.('Could not save preset: '+error.message,true);}finally{setSetupBusy(false);}
  }
  async function loadSetup(){
    setSetupBusy(true);setPresetError('');
    try{
      const saved=matchingPresets.find(row=>row.id===presetId),builtin=presetKind==='layout'&&!saved?SHOWCASE_PRESETS.find(row=>row.id===presetId):null;
      if(!builtin&&!saved)throw Error('Choose a preset.');
      if(saved?.kind==='set'){
        if(!saved.recordings?.length||!saved.working)throw Error('This recording set is incomplete.');
        await applySetup(saved.working);recordingEdits.current.clear();recordingDraft.current=null;setRecordingList(structuredClone(saved.recordings));
        setExportTarget(saved.exportTarget==='hive'?'hive':null);
      }else{
        const frame=builtin?cropPresetRect(previewSize.width,previewSize.height,SHOWCASE_CROP_PRESETS[builtin.cropPreset]):null;
        await applySetup(builtin?builtinSetup(builtin,frame):saved.setup);
      }
      const chosen=saved||builtin;
      setPresetEditing(presetDialog==='edit'?{id:chosen.id,name:chosen.name,kind:presetKind}:null);
      setPresetDialog(null);onStatus?.((presetDialog==='edit'?'Editing preset: ':'Loaded preset: ')+chosen.name);
    }catch(error){setPresetError(error.message);onStatus?.('Could not load preset: '+error.message,true);}finally{setSetupBusy(false);}
  }
  async function loadModel(file){
    if(!onLoadModel||busy||setupBusy)return;
    setSetupBusy(true);
    try{
      const before=editingRecording?await captureSetup(true):null;
      const next=await onLoadModel(file);if(!next)return;
      if(before){
        const modelSource=await snapshotShowcaseModel({model:next.doc.model,modelName:next.doc.name,modelPath:next.path,revision:next.doc.revision,sessionId:next.id,textureAssets:next.assets});
        const take=remapShowcaseTake({setup:before},before.modelSource.model,next.doc.model);
        await applySetup({...take.setup,modelSource});
        onStatus?.('Recording model replaced. Save changes to keep it.');
      }
    }catch(error){onStatus?.('Could not load recording model: '+error.message,true);}finally{setSetupBusy(false);}
  }
  async function addRecording(){
    setSetupBusy(true);
    try{const setup=await captureSetup(true),names=playlist.map(row=>model.Sequences[row.sequence]?.Name).join(' → ');setRecordingList(rows=>[...rows,{id:crypto.randomUUID(),name:names+' · '+length+'s',setup}]);}
    catch(error){onStatus?.('Could not add recording: '+error.message,true);}finally{setSetupBusy(false);}
  }
  async function editRecording(take){
    if(busy||setupBusy||editingRecording===take.id)return;
    setSetupBusy(true);
    try{
      const setup=await captureSetup(true);
      if(editingRecording){
        const prior=recordingList.find(row=>row.id===editingRecording);
        recordingEdits.current.set(editingRecording,{...prior,setup,name:playlist.map(row=>model.Sequences[row.sequence]?.Name).join(' → ')+' · '+length+'s'});
      }else recordingDraft.current=setup;
      await applySetup((recordingEdits.current.get(take.id)||take).setup);
      setEditingRecording(take.id);
      onStatus?.('Editing recording. Other drafts are kept when switching.');
    }catch(error){onStatus?.('Could not open recording: '+error.message,true);}
    finally{setSetupBusy(false);}
  }
  async function finishRecordingEdit(save){
    if(busy||setupBusy||!editingRecording||!recordingDraft.current)return;
    setSetupBusy(true);
    try{
      const replacement=save?{setup:await captureSetup(true),name:playlist.map(row=>model.Sequences[row.sequence]?.Name).join(' → ')+' · '+length+'s'}:null;
      await applySetup(recordingDraft.current);
      if(replacement)setRecordingList(rows=>rows.map(row=>row.id===editingRecording?{...row,...replacement}:row));
      recordingEdits.current.delete(editingRecording);
      recordingDraft.current=null;setEditingRecording(null);
      onStatus?.(save?'Recording saved. Other drafts kept.':'Recording changes cancelled. Other drafts kept.');
    }catch(error){onStatus?.('Could not '+(save?'update recording':'return to your setup')+': '+error.message,true);}
    finally{setSetupBusy(false);}
  }
  function removeRecording(id){
    recordingEdits.current.delete(id);setRecordingList(rows=>rows.filter(row=>row.id!==id));
  }
  function startRecordingDrag(event,id){
    if(busy||setupBusy){event.preventDefault();return;}
    draggedRecording.current=id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);
  }
  function overRecording(event,id){
    if(!draggedRecording.current||busy||setupBusy)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
    const rect=event.currentTarget.getBoundingClientRect(),after=event.clientY>rect.top+rect.height/2;
    setRecordingDrop(current=>current?.id===id&&current.after===after?current:{id,after});
  }
  function dropRecording(event,id){
    event.preventDefault();const moved=draggedRecording.current;
    const rect=event.currentTarget.getBoundingClientRect(),after=event.clientY>rect.top+rect.height/2;
    draggedRecording.current=null;setRecordingDrop(null);
    if(!moved||moved===id||busy||setupBusy)return;
    setRecordingList(rows=>{
      const take=rows.find(row=>row.id===moved);if(!take||!rows.some(row=>row.id===id))return rows;
      const next=rows.filter(row=>row.id!==moved),index=next.findIndex(row=>row.id===id);
      next.splice(index+(after?1:0),0,take);return next;
    });
  }
  async function alignText(id,x,y){
    const layer=layers.find(row=>row.id===id);if(!layer)return;
    try{const stage=previewRef.current?.querySelector('.showcase-layer-stage'),width=stage?.clientWidth||previewSize.width,height=stage?.clientHeight||previewSize.height;
      const rect=await alignShowcaseText(layer,x,y,framedPortrait?null:selectedCrop,width,height);setLayers(rows=>rows.map(row=>row.id===id?{...row,rect}:row));
    }catch(error){onStatus?.(error.message,true);}
  }
  return <div className="showcase-workspace">
    <aside className="showcase-sidebar" aria-label="Showcase controls">
      <AnimationPreviewTools exportTarget={exportTarget} onExportTarget={chooseExportTarget} mainPicture={mainPicture} cropAspect={framedPortrait?undefined:mainPicture?612/490:SHOWCASE_CROP_PRESETS[cropPreset]} active={active} sessionId={inputSessionId} modelName={modelName} captureAPI={api} preferences={localPreferences} loop length={length} crop={framedPortrait?null:selectedCrop} locked={setupBusy||!!editingRecording} recordingList={recordingPlan} prepareTake={take=>applySetup(take.setup)} onTakeComplete={removeRecording} beforeBatch={async()=>{batchRestore.current=await captureSetup(true);}} afterBatch={async()=>{const saved=batchRestore.current;batchRestore.current=null;if(saved)await applySetup(saved);}} disabled={!!exportError || setupBusy || overflow.some(Boolean) || !playlist.length || portrait && cameraIndex < 0 || !portrait && backgroundMode === 'folder' && !backgroundAsset && backgroundLibrary.loading} onStatus={onStatus} onBusy={value=>{setBusy(value);if(value)stopPreview();}}/>
      {exportError&&<div className="showcase-error" role="alert">{exportError}</div>}
      <fieldset disabled={busy||setupBusy} className="showcase-fields">
        <div className="showcase-model-file"><button title={editingRecording?'Replace this recording’s model':'Load Showcase model'} onClick={()=>window.desktop?loadModel():modelInput.current.click()}>Load model</button><small title={modelPath||modelName}>{modelName}</small></div>
        <input ref={modelInput} type="file" accept=".mdl,.mdx" hidden onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)loadModel(file);}}/>
        <div className="showcase-preset-actions" aria-label="Presets">{presetEditing?<><button disabled={!api||!!editingRecording} title={presetEditing.name} onClick={()=>saveSetup(presetEditing)}>Update preset</button><button onClick={()=>setPresetEditing(null)}>Done</button></>:<><button disabled={!api} onClick={()=>openPresetDialog('save')}>Save preset</button><button disabled={!api||!!editingRecording} onClick={()=>openPresetDialog('load')}>Load</button><button disabled={!api||!!editingRecording} onClick={()=>openPresetDialog('edit')}>Edit</button></>}</div>
        {editingRecording?<div className="showcase-preset-actions"><button disabled={!api||overflow.some(Boolean)||!playlist.length||(portrait&&cameraIndex<0)||(backgroundMode==='folder'&&!backgroundAsset&&backgroundLibrary.loading)} onClick={()=>finishRecordingEdit(true)}>Save changes</button><button onClick={()=>finishRecordingEdit(false)}>Cancel</button></div>:<button className="showcase-wide" disabled={!api||overflow.some(Boolean)||!playlist.length||(portrait&&cameraIndex<0)||(backgroundMode==='folder'&&!backgroundAsset&&backgroundLibrary.loading)} onClick={addRecording}>Add to recording list{recordingList.length?' · '+recordingList.length:''}</button>}
        {recordingList.length>0&&<ol className="showcase-recording-list" aria-label="Recording list">{recordingPlan.map((take,index)=><li key={take.id} draggable={!busy&&!setupBusy} data-drop={recordingDrop?.id===take.id?(recordingDrop.after?'after':'before'):undefined} onDragStart={event=>startRecordingDrag(event,take.id)} onDragOver={event=>overRecording(event,take.id)} onDrop={event=>dropRecording(event,take.id)} onDragEnd={()=>{draggedRecording.current=null;setRecordingDrop(null);}}><button translate="no" className="showcase-recording-edit" aria-label={translate('Edit recording '+(index+1))} aria-pressed={editingRecording===take.id} title={translate((recordingEdits.current.has(take.id)?'Unsaved draft · ':'Edit ')+take.name+(take.setup.modelSource?' · '+take.setup.modelSource.modelName:'')+' · Drag to reorder')} onClick={()=>editRecording(take)}>{index+1}. {recordingEdits.current.has(take.id)?'* ':''}{take.name}</button><button disabled={!!editingRecording} aria-label={'Remove recording '+(index+1)} onClick={()=>removeRecording(take.id)}>×</button></li>)}</ol>}
        <ExtraTimeField value={portrait?portraitExtraTime:sequenceExtraTime} base={portrait?portraitBase:sequenceBase} onChange={portrait?setPortraitExtraTime:setSequenceExtraTime}/>
        {(!portrait||framedPortrait)&&<section className={sectionClass('background')} aria-label={portrait?"Portrait color":"Background"}>
          <header>{sectionToggle('background',portrait?'Color':'Background')}{!portrait&&!collapsed.background&&<select aria-label="Background source" value={backgroundMode} onChange={event=>setBackgroundMode(event.target.value)}><option value="folder">Backgrounds</option><option value="color">Color</option><option value="media">Image/Video</option></select>}</header>
          {!portrait&&backgroundMode === 'folder' && <select className="showcase-wide" aria-label="Backgrounds" value={backgroundAsset?.id||background} onFocus={backgroundLibrary.refresh} onChange={event=>{setBackgroundAsset(null);onBackground(event.target.value);}}><option value="">None</option>{backgroundAsset&&!backgroundLibrary.items.some(item=>item.id===backgroundAsset.id)&&<option translate="no" value={backgroundAsset.id}>{backgroundAsset.name}</option>}{backgroundLibrary.items.map(item=><option translate="no" key={item.id} value={item.id}>{item.label}</option>)}</select>}
          {(portrait||backgroundMode === 'color') && colorPicker()}
          {!portrait&&backgroundMode === 'media' && <><button translate="no" className="showcase-wide showcase-file" onClick={()=>mediaInput.current.click()} title={media?.name}>{media?.name || translate('Choose image/video…')}</button><input hidden ref={mediaInput} type="file" accept="image/*,video/*,.mp4,.webm,.mov,.m4v,.ogv,.avi,.mkv,.wmv,.wav" onChange={chooseFile}/>
            {backgroundType?.startsWith('video/') && videoDuration > 0 && <div className="showcase-trim"><NumberField label="From (s)" min={0} max={Math.max(0,(trim.end || videoDuration)-.02)} step={.1} value={trim.start} onChange={value=>setTrim({...trim,start:Math.max(0,Math.min(Number(value)||0,(trim.end||videoDuration)-.02))})}/><NumberField label="To (s)" min={trim.start+.02} max={videoDuration} step={.1} value={trim.end || videoDuration} onChange={value=>setTrim({...trim,end:Math.max(trim.start+.02,Math.min(videoDuration,Number(value)||videoDuration))})}/></div>}
          </>}
        </section>}
        <section className={sectionClass('sequences')} aria-label="Sequences / Portrait">
          <header>{sectionToggle('sequences','Sequences / Portrait',true)}<div className="showcase-tabs" role="tablist" aria-label="Sequences / Portrait"><button role="tab" aria-selected={!portrait} onClick={()=>{setCollapsed(values=>({...values,sequences:false}));setMode('sequences');setSelected(0);stopPreview();director.reset();}}>Sequences</button><button role="tab" aria-selected={portrait} onClick={()=>{setCollapsed(values=>({...values,sequences:false}));setMode('portrait');setSelected(0);stopPreview();director.reset();}}>Portrait</button></div><button hidden={!!collapsed.sequences} disabled={!available.length} onClick={()=>{setCollapsed(values=>({...values,sequences:false}));editAnimation(-1);}}>Add</button></header>
          <ol className="showcase-list" aria-label="Animation sequence">{playlist.map((row,index)=><li key={index} className={(selected===index?' selected':'')+(overflow[index]?' overflow':'')} onClick={()=>{selectAnimation(index);editAnimation(index);}} onContextMenu={event=>{event.preventDefault();editAnimation(index);}} tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectAnimation(index);editAnimation(index);}if(event.key==='Delete')updatePlaylist(playlist.filter((_,i)=>i!==index));}} title="Click to edit">
            <span translate="no">{index+1}. {model.Sequences[row.sequence]?.Name}</span><small>{row.seconds+'s'+(portrait?'':' / '+Math.round(row.speed*100)+'%')}</small>
          </li>)}</ol>
          {overflow.some(Boolean)&&<div className="showcase-error" role="alert">Sequence too short</div>}
          {portrait&&cameraIndex<0&&<div className="showcase-error" role="alert">This model has no portrait camera.</div>}
          <div className="showcase-list-actions"><button className="showcase-sequence-preview" disabled={!api || !playlist.length} aria-pressed={playing} onClick={toggleAnimationPreview}>{playing?'Stop animation':'Preview animation'}</button><button disabled={selected<=0 || !playlist[selected]} aria-label="Move animation up" onClick={()=>{const rows=[...playlist];[rows[selected-1],rows[selected]]=[rows[selected],rows[selected-1]];updatePlaylist(rows);setSelected(selected-1);}}>↑</button><button disabled={selected>=playlist.length-1 || !playlist[selected]} aria-label="Move animation down" onClick={()=>{const rows=[...playlist];[rows[selected+1],rows[selected]]=[rows[selected],rows[selected+1]];updatePlaylist(rows);setSelected(selected+1);}}>↓</button>
          </div>
        </section>
        <section className={sectionClass('camera')} aria-label="Camera Control" hidden={portrait}>
          <header>{sectionToggle('camera','Camera Control')}<button hidden={!!collapsed.camera} disabled={!api} title="Fit the current pose through a complete orbit inside the crop" onClick={()=>{stopPreview();setCropEditing(false);api?.maximalZoom(selectedCrop);}}>Maximal Zoom</button></header>
          {exportTarget!=='hive'&&!mainPicture&&<label>Timing<select aria-label="Orbit timing" value={orbitTiming} onChange={event=>setOrbitTiming(event.target.value)}><option value="speed">Speed</option><option value="circle">Complete Full Circle</option></select></label>}
          {(exportTarget==='hive'||mainPicture||orbitTiming==='speed')&&<Slider label="Orbit speed" value={orbitSpeed} onChange={setOrbitSpeed}/>}
          <div className="showcase-model-tools"><details className="showcase-align"><summary title="Align model within crop">Align model</summary><div className="showcase-align-menu"><div className="showcase-align-grid">{[0,1,2].flatMap(y=>[0,1,2].map(x=><button key={x+':'+y} title={['Top','Middle','Bottom'][y]+' '+['left','center','right'][x]} aria-label={'Place model '+['top','middle','bottom'][y]+' '+['left','center','right'][x]} disabled={!api} onClick={event=>{stopPreview();setCropEditing(false);api?.alignModel(selectedCrop,x,y);event.currentTarget.closest('details').open=false;}}>{[['↖','↑','↗'],['←','·','→'],['↙','↓','↘']][y][x]}</button>))}</div></div></details></div>
          <Slider label="Radius" value={orbitRadius} max={100} onChange={setOrbitRadius}/>
          <div className="showcase-orbit-direction"><small>Z axis · 0% spins in place</small><button title="Reverse orbit direction" aria-label="Reverse orbit direction" aria-pressed={orbitDirection===-1} onClick={()=>setOrbitDirection(value=>-value)}>{orbitDirection===1?'↶':'↷'}</button></div>
          <button className="showcase-wide" disabled={!api} aria-pressed={previewOrbit} onClick={toggleOrbitPreview}>{previewOrbit?'Stop orbit':'Preview orbit'}</button>

        </section>
        {portrait&&<section className={sectionClass('portrait')} aria-label="Portrait zoom"><header>{sectionToggle('portrait','Portrait')}</header><label>Portrait frame<input type="checkbox" aria-label="Portrait frame" disabled={mainPicture} checked={portraitFrameEnabled&&!mainPicture} onChange={event=>{setPortraitFrameEnabled(event.target.checked);setCropEditing(false);}}/></label><label>Size<select aria-label="Portrait zoom preset" value={[75,100,125,150].includes(portraitZoom)?portraitZoom:"custom"} onChange={event=>setPortraitZoom(Number(event.target.value))}><option value="custom" disabled>Custom</option><option value="75">Small 75%</option><option value="100">Frame 100%</option><option value="125">Close 125%</option><option value="150">Detail 150%</option></select></label><Slider label="Zoom" min={50} max={200} value={portraitZoom} onChange={setPortraitZoom}/></section>}
        {!framedPortrait&&!mainPicture&&<section className={sectionClass('crop')} aria-label="Crop">
          <header>{sectionToggle('crop','Crop size')}{!collapsed.crop&&<select aria-label="Crop size" value={cropPreset} onChange={event=>{const preset=event.target.value;if(preset==='free'){setCrop(selectedCrop);setCropEditing(true);}else setCropEditing(false);setCropPreset(preset);}}><option value="free">Free selection</option><option value="square">Square · 1:1</option><option value="classic">Classic · 4:3</option><option value="wide">Wide · 16:9</option><option value="portrait">Portrait · 3:4</option></select>}</header>
          <div className="showcase-crop-controls"><button disabled={!api} title={selectedCrop?'Center unit in crop; zoom out only if needed':'Center unit in viewport; zoom out only if needed'} onClick={()=>{stopPreview();setCropEditing(false);api?.centerModel(selectedCrop);}}>Center</button><button disabled={!api} onClick={()=>{stopPreview();setCropEditing(!cropEditing);}}>{cropEditing?'Done':selectedCrop?'Edit crop':'Crop'}</button>{selectedCrop&&<button onClick={()=>{setCrop(null);setCropPreset('free');setCropEditing(false);}}>Reset</button>}</div>
        </section>}
        <button className="showcase-wide" aria-pressed={mainPicture} onClick={chooseMainPicture}>Hive Main Picture</button>
        <ShowcaseLayerTools key={applyVersion} grid={grid} onGrid={setGrid} gridDensity={gridDensity} onGridDensity={setGridDensity} onAlign={alignText} length={length} layers={layers} onLayers={setLayers} activeId={activeLayer} onActive={setActiveLayer} onEditing={setLayersEditing} onStatus={onStatus}/>
        <section className={sectionClass('graphics')} aria-label="Graphics">
          <header>{sectionToggle('graphics','Graphics')}</header>
          <label>Quality<select aria-label="Graphics quality" value={quality} onChange={event=>setQuality(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">Highest</option></select></label>
          <label>FPS{exportTarget||mainPicture?<output aria-label="Recording FPS">30</output>:<select aria-label="Recording FPS" value={fps} onChange={event=>setFPS(Number(event.target.value))}>{[10,15,20,24,25,30,50].map(value=><option key={value}>{value}</option>)}</select>}</label>
          {!portrait&&<label>Light<select aria-label="Light" value={light} onChange={event=>setLight(event.target.value)}><option value="ingame">Ingame</option><option value="portrait">Portrait</option><option value="none">None</option></select></label>}
          <small>{quality==='low'?'1× · no AA · bilinear':quality==='medium'?'1.5× · AA · 4× filtering':'2× · AA · 16× filtering'}</small>
        </section>
      </fieldset>
    </aside>
    {presetDialog&&<Dialog title={presetDialog==='save'?'Save preset':presetDialog==='edit'?'Edit preset':'Load preset'} onClose={()=>!setupBusy&&setPresetDialog(null)} onSubmit={()=>!setupBusy&&(presetDialog==='save'?saveSetup():loadSetup())}>
      <fieldset disabled={setupBusy} className="showcase-fields">
        <div className="showcase-preset-actions" role="group" aria-label="Preset type"><button type="button" aria-pressed={presetKind==='layout'} onClick={()=>changePresetKind('layout')}>Layout</button><button type="button" aria-pressed={presetKind==='set'} onClick={()=>changePresetKind('set')}>Recording set</button></div>
        <label>{presetDialog==='save'?'Save to':'Preset'}<select aria-label="Showcase presets" value={presetId} onChange={event=>{setPresetId(event.target.value);const row=matchingPresets.find(item=>item.id===event.target.value);if(row)setPresetName(row.name);}}>
          {presetDialog==='save'?<option value="">New preset</option>:<option value="" disabled>Choose preset</option>}
          {presetDialog!=='save'&&presetKind==='layout'&&<optgroup label="Included">{SHOWCASE_PRESETS.filter(row=>!presets.some(saved=>saved.id===row.id)).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</optgroup>}
          {matchingPresets.length>0&&<optgroup label="Saved">{matchingPresets.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</optgroup>}
        </select></label>
        {presetDialog==='save'&&<label>Name<input autoFocus aria-label="Showcase preset name" value={presetName} onChange={event=>setPresetName(event.target.value)}/></label>}
        <small>{presetKind==='set'?'All recordings, models, animations and settings.':'Presentation settings without models or animations.'}</small>
        {presetError&&<div className="showcase-error" role="alert">{presetError}</div>}
      </fieldset>
    </Dialog>}
    <section ref={previewRef} className={`showcase-preview${framedPortrait?" portrait":portrait?" portrait-frameless":""}`} aria-label="Showcase preview" style={framedPortrait?{"--portrait-zoom":portraitZoom/125,backgroundColor:color}:portrait?{backgroundColor:"#000000"}:undefined} inert={busy || setupBusy || undefined}><Suspense fallback={<div className="classic-empty-view">Loading model preview…</div>}><GamePreview suspended={!active} showcase={director} presentation="preview" previewMode="textured" mode="textured" overlays={CLEAN} showGrid={false} showAxes={false} showParticles playing={false} sequenceIndex={0} time={model.Sequences?.[0]?.Interval?.[0]||0} model={model} revision={revision} modelPath={modelPath} textureAssets={textureAssets} preferences={localPreferences} teamColor={teamColor} view="perspective" cameraMode="rotate" showcaseLight={light} showcaseCrop={framedPortrait?null:selectedCrop} showcaseRadius={orbitRadius} showcasePortraitMode={portrait} showcasePortraitFrame={portraitFrameEnabled&&!mainPicture} showcasePortraitZoom={portraitZoom} portraitCameraIndex={cameraIndex} showcaseGrid={grid&&!busy} showcaseGridDensity={gridDensity} showcaseLayers={layers} showcaseLayerEditing={layersEditing&&!cropEditing} showcaseActiveLayer={activeLayer} onShowcaseLayerSelect={setActiveLayer} onShowcaseLayerChange={(id,patch)=>setLayers(values=>values.map(layer=>layer.id===id?{...layer,...patch}:layer))} onShowcaseLayerError={message=>onStatus?.(message,true)} onCaptureReady={captureReady} backgroundUrl={backgroundUrl} backgroundType={backgroundType} backgroundTrim={trim} onBackgroundMetadata={setVideoDuration} preserveCameraView showcasePlaying={playing&&active} showcaseConfig={[playlist,length,previewOrbit,orbitSpeed,orbitDirection,orbitTiming,exportTarget,mainPicture,orbitRadius,orbitAngle,light,portrait,portraitZoom,portraitFrameEnabled]}/></Suspense>
      {!framedPortrait&&(cropEditing||selectedCrop)&&<div className={'showcase-crop-overlay'+(cropEditing?' editing':'')} aria-label="Crop area" onPointerDown={cropEditing?startCrop:undefined} onPointerMove={cropEditing?moveCrop:undefined} onPointerUp={cropEditing?finishCrop:undefined} onPointerCancel={cropEditing?finishCrop:undefined}>
        <div className="showcase-crop-selection" style={{left:(selectedCrop?.x||0)*100+'%',top:(selectedCrop?.y||0)*100+'%',width:(selectedCrop?.width??1)*100+'%',height:(selectedCrop?.height??1)*100+'%'}}/>
        {cropEditing&&<div className="showcase-crop-hint">Drag to select the GIF area</div>}
      </div>}
    </section>
    {animationDialog&&<AnimationDialog definitions={api?.effectDefinitions()} exportTarget={mainPicture?'hive-main':exportTarget} model={model} initial={animationDialog} portrait={portrait} onClose={()=>setAnimationDialog(null)} onSave={row=>{updatePlaylist(animationDialog.index<0?[...playlist,row]:playlist.map((item,index)=>index===animationDialog.index?row:item));setSelected(animationDialog.index<0?playlist.length:animationDialog.index);setAnimationDialog(null);}} onRemove={()=>{updatePlaylist(playlist.filter((_,index)=>index!==animationDialog.index));setSelected(Math.max(0,animationDialog.index-1));setAnimationDialog(null);}}/>}
  </div>;
}
