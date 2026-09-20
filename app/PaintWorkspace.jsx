import {assignPaintMaterial,createPaintMaterial,enablePaintMaterials,repairPaintMaterials,markPaintMaterialEdited,paintTextureStem,paintableGeosets,renamePaintMaterial} from '../src/paint-materials.js';
import {paintLampLight} from './paint-lamps.js';
import {normalizePaintAppearance} from '../src/paint-appearance.js';
import {cameraBindings} from '../src/preferences.js';
import PaintTextureManager from './PaintTextureManager.jsx';
import {PaintTool} from './PaintIcon.jsx';
import {createPaintDirtyRows,createPaintPreview,updatePaintPreview,paintRowsBounds} from '../src/paint-preview.js';
import React,{lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import PaintViewport from './PaintViewport.jsx';
import PaintTextureShelf from './PaintTextureShelf.jsx';
import PaintTextureCanvas from './PaintTextureCanvas.jsx';
import PaintSceneOptions,{DEFAULT_PAINT_SCENE} from './PaintSceneOptions.jsx';
import PaintCutoutEditor from './PaintCutoutEditor.jsx';
import PaintSaveTexture from './PaintSaveTexture.jsx';
import {usePreviewBackgrounds} from './usePreviewBackgrounds.js';
import {paintBrushPreview} from './paint-brush-preview.js';
import {PAINT_BRUSH_TIPS,paintBrushTipById} from '../src/paint-brushes.js';
import {paintMessage as msg} from '../src/paint-messages.js';
import {addPaintProjectTarget,compositePaintTarget,createPaintProject,paintProjectCoat,paintProjectTarget,recordPaintStroke,recordPaintUV,replacePaintTexture,travelPaintHistory} from '../src/paint-project.js';
import {buildSmartPaintMasks,interpolatePaintStroke,preparePaintProjection,prepareTexturePaintProjection,stampProjectedBrush} from '../src/paint-projection.js';
import {paintGeosetMask,paintGeosetTarget,paintHalfModel,paintPartCenter,paintProjectModel,paintStandHidden} from '../src/paint-view.js';
import {pastePaintDecal,projectPaintDecal} from '../src/paint-decal.js';
import {blendPaintPixel,clonePaintRaster,resizePaintRaster,rgbaColor} from '../src/paint-raster.js';
import {enumeratePaintTargets,findTextureAsset,preferredPaintTarget} from '../src/paint-targets.js';
import {BRUSH_PRESETS,PAINT_COATS,normalizeBrushSettings} from '../src/paint-types.js';
import {readWarcraftDnc,sampleWarcraftDnc,wc3DncPath} from '../src/warcraft-dnc.js';
import {decodePaintImage,fetchPaintRaster,paintBaseRaster,paintRasterCanvas} from './paint-raster.js';
import './paint-workspace.css';

const NativeTextureLibrary=lazy(()=>import('./TextureLibrary.jsx'));
const emptyOverlays=Object.freeze({bones:false,wires:false,nodes:false,attachments:false,particles:false,vertices:false,grid:false,axes:false,cameras:false,normals:false});
const emptySelection=Object.freeze({}),emptyVertices=Object.freeze([]),noOverrides=new Map();
function Range({id,value,min=0,max=1,step=.01,percent=true,onChange}){
  const label=msg('paint.'+id);
  return <label className="paint-range"><span>{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}/><output>{percent?Math.round(value*100)+'%':Math.round(value)}</output></label>;
}

/** Owns editable coats, cutouts and view-only scene lights/backgrounds.
 * App owns applying completed paint/UVs to the model and portable texture files.
 * The original skin is retained for O.G and in saved presets. Stroke previews
 * composite/upload the changed target once per frame.
 */
export default function PaintWorkspace({model,originalModel=model,revision,modelName,modelPath,textureAssets,project,activeGeoset,onGeosetChange,onProjectChange,onEnsureTarget,onSaveProject,onOpenProject,onExport,onApply,onExit,onStatus,preferences,cameraProps={},cameraMode='work',view='perspective',teamColor='#ff0303',readOnly=false,onInteractionChange}){
  const [resolution,setResolution]=useState(256),[sourceMode,setSourceMode]=useState('primer'),[busy,setBusy]=useState(false);
  const [brush,setBrush]=useState(()=>normalizeBrushSettings({id:'round',color:'#718b45'})),[material,setMaterial]=useState(null),[tipRaster,setTipRaster]=useState(null);
  const [paintRevision,setPaintRevision]=useState(0),[pickPart,setPickPart]=useState(false),[isolate,setIsolate]=useState(false),[showHelpers,setShowHelpers]=useState(false);
  const [outline,setOutline]=useState({visible:true,color:'#35d9ff',thickness:2}),[halfHidden,setHalfHidden]=useState(false),[mirrorAxis,setMirrorAxis]=useState('y'),[mirrorSide,setMirrorSide]=useState(1),[cutPosition,setCutPosition]=useState(0),[lowPower,setLowPower]=useState(false);
  const [textureView,setTextureView]=useState(false),[showOriginal,setShowOriginal]=useState(false),[dialog,setDialog]=useState(null),[cutoutSource,setCutoutSource]=useState(null),[importIntent,setImportIntent]=useState('cutout'),[selectedLamp,setSelectedLamp]=useState(null),[lampTransform,setLampTransform]=useState('move'),[saveSource,setSaveSource]=useState(null);
  const [decal,setDecal]=useState(null),[placing,setPlacing]=useState(false),[decalTransform,setDecalTransform]=useState({width:72,height:72,angle:0,opacity:1,flipX:false,flipY:false});
  const [scene,setScene]=useState(()=>({...DEFAULT_PAINT_SCENE,...project?.viewSettings})),[dncModel,setDncModel]=useState(null),[dncStatus,setDncStatus]=useState(''),[lampAction,setLampAction]=useState(null),[shelfEpoch,setShelfEpoch]=useState(0),[folders,setFolders]=useState(['']);
  const stroke=useRef(null),frame=useRef(0),projectionCache=useRef(null),smartMaskCache=useRef(null),canvasCache=useRef(new Map()),dirtyTargets=useRef(new Map()),mounted=useRef(true),cameraAPI=useRef(null),imageInput=useRef(null),dncCache=useRef(new Map());
  const currentProject=useRef(project);currentProject.current=project;const shelfAPI=useRef();
  const endCurrentStroke=useRef(null);endCurrentStroke.current=endStroke;
  const toolCommand=useRef(null);toolCommand.current=chooseTool;
  const baseModel=useMemo(()=>paintProjectModel(model,project,originalModel),[model,originalModel,revision,project,project?.uvRevision,project?.materialRevision]);
  const catalog=useMemo(()=>enumeratePaintTargets(baseModel),[baseModel,revision]),allGeosets=useMemo(()=>new Set(baseModel.Geosets.map((_,i)=>i)),[baseModel]);
  const paintable=useMemo(()=>new Set(paintableGeosets(originalModel)),[originalModel]);
  const standHidden=useMemo(()=>paintStandHidden(originalModel),[originalModel]);
  const hiddenGeosets=useMemo(()=>new Set([...allGeosets].filter(i=>(isolate&&i!==activeGeoset)||(!showHelpers&&(!paintable.has(i)||(standHidden.has(i)&&i!==activeGeoset))))),[isolate,showHelpers,allGeosets,activeGeoset,paintable,standHidden]);
  const viewModel=showOriginal?originalModel:baseModel;
  const displayModel=useMemo(()=>paintHalfModel(viewModel,halfHidden?{axis:mirrorAxis,side:mirrorSide,position:cutPosition}:null),[viewModel,halfHidden,mirrorAxis,mirrorSide,cutPosition]);
  // Navigation belongs to the shared editor preferences, including MDLVis's
  // middle-click Rotation/Work toggle. Citadel never reverses those bindings.
  const viewportPreferences=useMemo(()=>({...preferences,graphics:{...preferences?.graphics,...(lowPower?{pixelRatio:1,antialias:false}:{})}}),[preferences,lowPower]);
  const navigation=cameraBindings(preferences),navigationHint=`Right-drag: ${navigation.right} · ${navigation.middle==='toggle'?'Middle-click: rotation / work':'Middle-drag: '+navigation.middle} · Wheel: zoom`;
  const paintAppearance=useMemo(()=>normalizePaintAppearance(preferences?.citadelPaint),[preferences?.citadelPaint]);
  const selectedTip=paintBrushTipById(brush.tipId),activeTarget=project?paintProjectTarget(project):null,activeCoat=project?paintProjectCoat(project):null;
  const coordId=activeTarget?.bindings.find(b=>b.geosetIndex===activeGeoset)?.coordId||0;
  const targetOptions=catalog.filter(target=>target.geosetIndices.includes(activeGeoset));
  const materialRaster=useMemo(()=>material&&project?resizePaintRaster(material.raster,project.resolution,project.resolution):null,[material,project?.resolution]);
  const ready=!!project&&activeTarget?.geosetIndices.includes(activeGeoset)&&(!brush.tipId||tipRaster?.id===brush.tipId)&&!busy&&!readOnly&&!showOriginal;
  const footprint=useMemo(()=>paintBrushPreview(brush,tipRaster?.raster,materialRaster,paintAppearance.brushCursor),[brush.id,brush.hardness,brush.tipId,tipRaster,materialRaster,paintAppearance.brushCursor]);
  const flatProjection=useMemo(()=>project?prepareTexturePaintProjection(project.resolution):null,[project?.resolution]);
  const decalPreview=useMemo(()=>placing&&decal?{url:decal.url,...decalTransform}:null,[placing,decal,decalTransform]);
  const backgrounds=usePreviewBackgrounds(true,scene.background,value=>updateScene({...scene,background:value}),onStatus);
  const background=useMemo(()=>({type:scene.customBackground||backgrounds.url?'image':'color',color:scene.backgroundColor,imageData:scene.customBackground||backgrounds.url||'',display:scene.backgroundDisplay,opacity:1}),[scene.customBackground,scene.backgroundColor,scene.backgroundDisplay,backgrounds.url]);
  const lights=useMemo(()=>{
    const values=scene.lighting==='dnc'&&dncModel?sampleWarcraftDnc(dncModel,scene.hour):[];
    if(scene.lighting!=='flat')for(const lamp of scene.lamps.filter(l=>l.enabled)){
      values.push(paintLampLight(lamp));
    }
    return {flat:scene.lighting==='flat',lights:values,markers:scene.showLamps?scene.lamps:[]};
  },[scene,dncModel]);
  function notify(){onProjectChange?.(project);setPaintRevision(n=>n+1);}
  function refreshTarget(target,rows=null){markPaintMaterialEdited(project,target);const cached=canvasCache.current.get(target.id);if(cached?.target===target){updatePaintPreview(cached,rows);cached.canvas=paintRasterCanvas(cached.raster,cached.canvas,rows?paintRowsBounds(rows,project.resolution,project.resolution):null);}else dirtyTargets.current.set(target.id,null);setPaintRevision(n=>n+1);}
  function updateScene(next){if(scene.lamps.length&&!next.lamps.length&&next.lighting==='lamps')next={...next,lighting:'flat'};if(!Array.isArray(next.lamps)||next.lamps.length>4||next.lamps.some(l=>![...(l.position||[]),...(l.target||[])].every(Number.isFinite)||l.position?.length!==3||l.target?.length!==3)){onStatus?.('Enter valid lamp coordinates.',true);return;}setScene(next);if(project){project.viewSettings=next;project.dirty=true;project.revision++;onProjectChange?.(project);}}
  useEffect(()=>setOutline(v=>({...v,color:paintAppearance.geosetBorder,thickness:paintAppearance.borderThickness})),[paintAppearance.geosetBorder,paintAppearance.borderThickness]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancelAnimationFrame(frame.current);};},[]);
  useEffect(()=>{projectionCache.current=null;smartMaskCache.current=null;setMaterial(null);setDecal(null);setPlacing(false);setCutoutSource(null);setSaveSource(null);setBrush(value=>({...value,materialId:null}));},[project?.id]);
  useEffect(()=>{const flush=()=>endCurrentStroke.current?.();window.addEventListener('mdlxl-paint-flush',flush);window.addEventListener('beforeunload',flush,true);return()=>{window.removeEventListener('mdlxl-paint-flush',flush);window.removeEventListener('beforeunload',flush,true);};},[]);
  function chooseTool(tool){if(!project||busy||readOnly)return;endStroke();cameraProps.onWorkMode?.();setTextureView(false);setPickPart(tool==='select');setLampAction(null);setPlacing(false);if(tool==='draw'){setSelectedLamp(null);setShowOriginal(false);}}
  useEffect(()=>{cameraProps.onWorkMode?.();const select=event=>toolCommand.current?.(event.detail);window.addEventListener('mdlxl-paint-tool',select);return()=>window.removeEventListener('mdlxl-paint-tool',select);},[]);
  useEffect(()=>{
    let cancelled=false;setTipRaster(null);if(!selectedTip)return;
    fetchPaintRaster(selectedTip.file,256).then(raster=>{if(!cancelled)setTipRaster({id:selectedTip.id,raster});}).catch(e=>onStatus?.(e.message,true));return()=>{cancelled=true;};
  },[selectedTip?.id]);
  useEffect(()=>{
    if(!project)return;try{const upgraded=enablePaintMaterials(project,model),repaired=repairPaintMaterials(project,originalModel);if(upgraded||repaired)notify();}catch(e){onStatus?.(e.message,true);return;}const target=paintProjectTarget(project);if(target&&!target.geosetIndices.includes(activeGeoset))onGeosetChange?.(target.geosetIndices[0]);
    setScene({...DEFAULT_PAINT_SCENE,...project.viewSettings});setShowOriginal(false);setTextureView(false);
    const id=requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('mdlvis-frame')));return()=>cancelAnimationFrame(id);
  },[project]);
  useEffect(()=>{
    let active=true;setDncModel(null);setDncStatus('');
    if(scene.lighting!=='dnc')return;
    if(scene.dncModel){setDncModel(scene.dncModel);setDncStatus(msg('paint.dncLoaded'));return;}
    const path=wc3DncPath(scene.environment);setDncStatus(msg('paint.dncLoading'));
    const load=async()=>{
      if(!window.desktop?.resolveEventResources)throw Error(msg('paint.dncDesktop'));
      if(!dncCache.current.has(path)){const records=await window.desktop.resolveEventResources({names:[path],path:modelPath});if(!records[0]?.bytes)throw Error(msg('paint.dncMissing'));dncCache.current.set(path,readWarcraftDnc(records[0].bytes,path));}
      if(active){setDncModel(dncCache.current.get(path));setDncStatus(msg('paint.dncLoaded'));}
    };
    load().catch(e=>{if(active)setDncStatus(e.message);});return()=>{active=false;};
  },[scene.lighting,scene.environment,scene.dncModel,modelPath]);
  const textureOverrides=useMemo(()=>{
    const result=new Map(),liveIds=new Set((project?.targets||[]).map(t=>t.id));
    for(const id of canvasCache.current.keys())if(!liveIds.has(id)){canvasCache.current.delete(id);dirtyTargets.current.delete(id);}
    for(const target of project?.targets||[]){
      let entry=canvasCache.current.get(target.id);
      if(!entry||entry.target!==target){entry=createPaintPreview(target);updatePaintPreview(entry);entry.canvas=paintRasterCanvas(entry.raster);canvasCache.current.set(target.id,entry);}
      else if(entry.version!==(target.revision||0)||dirtyTargets.current.has(target.id)){updatePaintPreview(entry);entry.canvas=paintRasterCanvas(entry.raster,entry.canvas);}
      dirtyTargets.current.delete(target.id);
      result.set(target.textureId,entry);
    }
    return result;
  },[project,project?.revision,paintRevision]);
  async function initializeTarget(value,next){
    const existing=paintProjectTarget(next,value.id);if(existing)return existing;
    const base=await paintBaseRaster(findTextureAsset(textureAssets,value.texturePath),next.resolution,next.sourceMode);return addPaintProjectTarget(next,value,base);
  }
  async function begin(){
    if(busy||readOnly)return;setBusy(true);
    try{
      const next=createPaintProject({modelName,resolution,sourceMode});next.viewSettings=scene;next.dirty=true;
      if(sourceMode==='primer'){
        const geosets=[...paintable];if(!geosets.length)throw Error(msg('paint.empty'));
        createPaintMaterial(next,model,{name:'Texture 1',raster:await paintBaseRaster(null,resolution,'primer'),geosets,basecoat:true,sourceModel:originalModel});
      }else{
        for(const descriptor of catalog){const asset=findTextureAsset(textureAssets,descriptor.texturePath);await initializeTarget({...descriptor,nativeSource:['gameData','library'].includes(asset?.source)},next);}
        if(!next.targets.length)throw Error(msg('paint.empty'));enablePaintMaterials(next,model);
      }
      repairPaintMaterials(next,originalModel);const selected=next.targets.find(t=>t.geosetIndices.includes(activeGeoset))||next.targets[0];next.activeTargetId=selected.id;
      if(!mounted.current)return;onGeosetChange?.(selected.geosetIndices.includes(activeGeoset)?activeGeoset:selected.geosetIndices[0]);onProjectChange?.(next);setPaintRevision(n=>n+1);onStatus?.(msg('paint.ready'));
    }catch(e){onStatus?.(e.message,true);}finally{if(mounted.current)setBusy(false);}
  }
  async function selectGeoset(index){
    if(!project||busy||readOnly)return;endStroke();setSelectedLamp(null);
    const selected=project.targets.find(t=>t.geosetIndices.includes(index));
    if(selected)project.activeTargetId=selected.id;
    onGeosetChange?.(index);notify();
  }
  function assignTexture(id,all=false){if(busy||readOnly)return;endStroke();try{assignPaintMaterial(project,model,id,all?[...paintable]:[activeGeoset],originalModel);setSelectedLamp(null);notify();}catch(e){onStatus?.(e.message,true);}}
  function renameTexture(name){try{endStroke();renamePaintMaterial(project,activeTarget,name);notify();return true;}catch(e){onStatus?.(e.message,true);return false;}}
  async function createTexture(source=null){
    if(busy||readOnly)return;endStroke();setBusy(true);
    try{const raster=source?resizePaintRaster(source.raster,project.resolution,project.resolution):await paintBaseRaster(null,project.resolution,'primer');
      if(!mounted.current||currentProject.current!==project)return;
      createPaintMaterial(project,model,{name:source?paintTextureStem(source.name):'Texture '+(project.targets.length+1),raster,geosets:[activeGeoset],nativeSource:!!source?.nativeSource,sourcePath:source?.sourcePath||source?.name||'',basecoat:!source,sourceModel:originalModel});
      setMaterial(null);setBrush(v=>({...v,materialId:null}));setSelectedLamp(null);setShowOriginal(false);setDialog(null);setPickPart(false);setPlacing(false);notify();
    }catch(e){onStatus?.(e.message,true);}finally{setBusy(false);}
  }
  async function importModelTexture(texture){
    try{const asset=findTextureAsset(textureAssets,texture.Image);if(!asset?.bytes)throw Error('This model texture is not loaded. Choose Warcraft data in Settings, or import its file.');
      const raster=await decodePaintImage(asset.bytes,asset.name);await createTexture({name:texture.Image,sourcePath:texture.Image,raster,nativeSource:['gameData','library'].includes(asset.source)});
    }catch(e){onStatus?.(e.message,true);}
  }
  function changeLamp(id,change){updateScene({...scene,lamps:scene.lamps.map(lamp=>lamp.id===id?{...lamp,...change}:lamp)});}
  function deleteLamp(){if(!selectedLamp)return;updateScene({...scene,lamps:scene.lamps.filter(l=>l.id!==selectedLamp)});setSelectedLamp(null);}
  function projectionFor(hit){
    if(hit.textureView)return flatProjection;
    const key=activeTarget.id+':'+activeGeoset+':'+[...hiddenGeosets]+':'+hit.viewport.width+':'+hit.viewport.height+':'+hit.viewProjectionMatrix.join(',');
    let cached=projectionCache.current;
    if(!cached||cached.model!==displayModel||cached.revision!==revision||cached.key!==key){cached={model:displayModel,revision,key,projection:preparePaintProjection(displayModel,paintGeosetTarget(activeTarget,activeGeoset),hit.viewProjectionMatrix,hit.viewport.width,hit.viewport.height,384,hiddenGeosets)};projectionCache.current=cached;}
    return cached.projection;
  }
  function brushOptions(target,texture=false){
    let masks=null;
    if(brush.mode==='wash'||brush.mode==='drybrush'){
      const key=target.id+':'+activeGeoset+':'+project.resolution;let cached=smartMaskCache.current;
      if(!cached||cached.model!==baseModel||cached.key!==key){cached={model:baseModel,key,masks:buildSmartPaintMasks(baseModel,paintGeosetTarget(target,activeGeoset),project.resolution)};smartMaskCache.current=cached;}
      masks=cached.masks;
    }
    return {flags:texture?0:target.flags,mask:masks?.[brush.mode],materialRaster:brush.materialId?materialRaster:null,tipRaster:tipRaster?.raster,seed:project.history.undo.length+1};
  }
  function startStroke(hit){
    if(!ready)return;if(!hit.textureView&&hit.geosetIndex!==activeGeoset){onStatus?.(msg('paint.locked'));return;}
    if(placing&&decal){placeDecal(hit);return;}
    const target=activeTarget,coat=paintProjectCoat(project,target.id,brush.mode==='erase'?'__alpha':project.activeCoatId);
    if(!coat||(brush.mode!=='erase'&&activeCoat?.visible===false)){onStatus?.(msg('paint.hiddenCoat'));return;}
    onInteractionChange?.(true);stroke.current={target,coat,coatId:coat.id,before:clonePaintRaster(coat.raster),projection:projectionFor(hit),last:null,pending:[],options:brushOptions(target,hit.textureView),brush:{...brush}};moveStroke(hit);
  }
  function flushStroke(){
    frame.current=0;const current=stroke.current;if(!current)return;let changed=0;
    const rows=createPaintDirtyRows(project.resolution);current.options.dirtyRows=rows;
    for(const next of current.pending){if(current.last&&next.x===current.last.x&&next.y===current.last.y)continue;for(const point of interpolatePaintStroke(current.last,next,current.brush))changed+=stampProjectedBrush(current.coat.raster,current.projection,point,current.brush,current.options);current.last=next;}
    current.pending=[];if(changed)refreshTarget(current.target,rows);
  }
  function moveStroke(hit){const current=stroke.current;if(!current)return;current.pending.push(hit.screen);if(!frame.current)frame.current=requestAnimationFrame(flushStroke);}
  function endStroke(){onInteractionChange?.(false);cancelAnimationFrame(frame.current);flushStroke();const current=stroke.current;stroke.current=null;if(current&&project&&recordPaintStroke(project,current.target.id,current.coatId,current.before,current.brush.name+' stroke',current.brush)){markPaintMaterialEdited(project,current.target);const cached=canvasCache.current.get(current.target.id);if(cached)cached.version=current.target.revision;notify();}}
  function cancelStroke(){onInteractionChange?.(false);cancelAnimationFrame(frame.current);frame.current=0;const current=stroke.current;stroke.current=null;if(!current)return;if(current.coatId==='__alpha')current.target.alphaMask=current.before;else current.coat.raster=current.before;refreshTarget(current.target);}
  function chooseBrush(preset){endStroke();setPickPart(false);setPlacing(false);setBrush(previous=>normalizeBrushSettings({...previous,...preset,color:previous.color,materialId:previous.materialId,tipId:preset.tipId||null}));}
  function chooseMaterial(source){endStroke();const id=crypto.randomUUID(),thumbnail=paintRasterCanvas(resizePaintRaster(source.raster,64,64)).toDataURL();setMaterial({...source,id,thumbnail});setPickPart(false);setPlacing(false);setBrush(value=>({...value,materialId:id}));onStatus?.(msg('paint.materialSelected'));}
  function useCutout(source){
    if(source.whole){if(importIntent==='texture')createTexture({...cutoutSource,...source});else{applyTexture(source);setDialog(null);}return;}
    setDecal({...source,url:paintRasterCanvas(source.raster).toDataURL()});setDecalTransform({width:96,height:96*source.raster.height/source.raster.width,angle:0,opacity:1,flipX:false,flipY:false});setPlacing(true);setPickPart(false);setShowOriginal(false);setDialog(null);onStatus?.(msg('paint.placeHelp'));
  }
  function applyTexture(source){
    if(!activeCoat||activeCoat.visible===false)throw Error(msg('paint.hiddenCoat'));endStroke();const next=resizePaintRaster(source.raster,project.resolution,project.resolution);
    if(replacePaintTexture(project,activeTarget.id,activeCoat.id,next)){markPaintMaterialEdited(project,activeTarget);notify();onStatus?.(msg('paint.textureApplied'));}
    chooseMaterial(source);
  }
  function placeDecal(hit){
    if(!ready||!decal||activeCoat?.visible===false)return;endStroke();
    if(!hit.textureView&&hit.geosetIndex!==activeGeoset){onStatus?.(msg('paint.locked'));return;}
    const before=clonePaintRaster(activeCoat.raster);
    if(hit.textureView)pastePaintDecal(activeCoat.raster,decal.raster,hit.screen,decalTransform);
    else projectPaintDecal(activeCoat.raster,projectionFor(hit),decal.raster,hit.screen,decalTransform,activeTarget.flags);
    if(recordPaintStroke(project,activeTarget.id,activeCoat.id,before,msg('paint.placeCutout'))){markPaintMaterialEdited(project,activeTarget);notify();onStatus?.(msg('paint.cutoutPlaced'));}
  }
  function pick(hit){
    if(lampAction){const {id,action}=lampAction,pose=cameraAPI.current?.(),position=hit.worldPosition.map((v,i)=>v+hit.normal[i]*(pose?.radius||100)*.5);
      updateScene({...scene,lamps:scene.lamps.map(lamp=>lamp.id===id?{...lamp,...(action==='place'?{position,target:hit.worldPosition}:{target:hit.worldPosition})}:lamp)});setLampAction(null);return;}
    selectGeoset(hit.geosetIndex);
  }
  function fillGeoset(){
    if(!ready||!activeCoat)return;endStroke();const layer=brush.mode==='erase'?paintProjectCoat(project,activeTarget.id,'__alpha'):activeCoat;
    if(layer.visible===false){onStatus?.(msg('paint.hiddenCoat'));return;}
    const before=clonePaintRaster(layer.raster),mask=paintGeosetMask(displayModel,paintGeosetTarget(activeTarget,activeGeoset),project.resolution),options=brushOptions(activeTarget),color=rgbaColor(brush.color),raster=options.materialRaster;
    for(let pixel=0;pixel<mask.length;pixel++){if(!mask[pixel])continue;const offset=pixel*4;if(raster)for(let channel=0;channel<4;channel++)color[channel]=raster.data[offset+channel];blendPaintPixel(layer.raster.data,offset,color,brush.opacity*brush.strength*(options.mask?options.mask[pixel]/255:1),brush.mode==='erase'?'erase':'paint');}
    if(recordPaintStroke(project,activeTarget.id,layer.id,before,msg('paint.fillPart'),brush)){markPaintMaterialEdited(project,activeTarget);notify();onStatus?.(msg('paint.filled',{number:activeGeoset+1}));}
  }
  function travel(redo){if(readOnly||busy)return;endStroke();if(travelPaintHistory(project,redo))notify();}
  function mutateCoat(change){if(!ready||!activeCoat)return;change(activeCoat);activeTarget.revision=(activeTarget.revision||0)+1;project.dirty=true;project.revision++;notify();}
  function editUV(next){if(!ready)return;endStroke();const before=baseModel.Geosets[activeGeoset].TVertices[coordId];if(recordPaintUV(project,activeGeoset+':'+coordId,before,next))notify();}
  function hideHalf(){endStroke();setHalfHidden(value=>!value);}
  async function importFile(file){try{const raster=await decodePaintImage(new Uint8Array(await file.arrayBuffer()),file.name);if(importIntent==='texture')await createTexture({name:file.name,raster});else{setCutoutSource({name:file.name,raster});setDialog('cutout');}}catch(e){onStatus?.(e.message,true);}}
  function saveTexture(source){setSaveSource(source);setDialog('saveTexture');}
  const activeCanvas=activeTarget?textureOverrides.get(activeTarget.textureId)?.canvas:null;
  const textureName=activeTarget?.paintName??activeTarget?.label??'';
  const brushButton=preset=><button key={preset.id} aria-pressed={brush.id===preset.id&&!placing} onClick={()=>chooseBrush(preset)}>{msg(preset.messageId)}</button>;
  shelfAPI.current={onUse:chooseMaterial,onCut:source=>{setImportIntent('cutout');setCutoutSource(source);setDialog('cutout');},onNative:()=>{setImportIntent('cutout');setDialog('native');},onImport:()=>{setImportIntent('cutout');imageInput.current.click();},onStatus};
  const shelfCallbacks=useMemo(()=>Object.fromEntries(['onUse','onCut','onNative','onImport','onStatus'].map(key=>[key,(...args)=>shelfAPI.current[key]?.(...args)])),[]);
  const viewport=<PaintViewport {...cameraProps} key="paint-viewport" model={displayModel} revision={revision} selectedGeoset={activeGeoset} selectedVertices={emptyVertices} selectableGeosets={allGeosets} selectionByGeoset={emptySelection} hiddenVertices={emptySelection} hiddenGeosets={hiddenGeosets} mode="textured" overlays={emptyOverlays} showVertices={false} showSkeleton={false} showGrid={false} showAxes={false} shaded view={view} cameraMode={cameraMode} workplane="xy" transformMode="select" sequenceIndex={-1} time={0} playing={false} teamColor={teamColor} textureAssets={textureAssets} preferences={viewportPreferences} paintWorkspace paintMode={!!project} paintSelectOnly={pickPart||!!lampAction} paintDisabled={!ready} paintOutline={outline} paintBrushSize={brush.size} paintBrushPreview={footprint} paintDecal={decalPreview} paintLights={lights} paintLampPickingDisabled={!!lampAction} onPaintInteractionChange={onInteractionChange} paintSelectedLamp={selectedLamp} paintLampTransform={lampTransform} paintLampColor={paintAppearance.lampSelection} onPaintLampSelect={id=>{setSelectedLamp(id);setPickPart(true);setPlacing(false);}} onPaintLampChange={changeLamp} paintBackground={background} paintTextureOverrides={showOriginal?noOverrides:textureOverrides} paintTextureRevision={paintRevision+Number(project?.revision||0)} onPaintCameraReady={api=>{cameraAPI.current=api;}} onPaintPick={pick} onPaintStart={startStroke} onPaintMove={moveStroke} onPaintEnd={endStroke} onPaintCancel={cancelStroke} onPaintDrop={placeDecal} suspended={textureView}/>;
  return <div className={'paint-workspace'+(project?'':' paint-setup')} style={{'--paint-tip':preferences?.theme==='light'?paintAppearance.brushTipLight:paintAppearance.brushTipDark,'--paint-selection':paintAppearance.geosetSelection}} onKeyDownCapture={e=>{if(selectedLamp&&!dialog&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopPropagation();deleteLamp();}if(e.key==='Escape')setSelectedLamp(null);}}}>
    {project&&<div key="toolbar" className="paint-toolbar">
      <PaintTool icon="select" label="Select" action="paint:select" active={pickPart&&!textureView&&cameraMode==='work'} onClick={()=>chooseTool('select')}/>
      <PaintTool icon="paint" label={msg('paint.paint')} action="paint:draw" active={!pickPart&&!lampAction&&!textureView&&cameraMode==='work'} onClick={()=>chooseTool('draw')}/>
      <PaintTool icon="uv" label={msg('paint.textureUV')} active={textureView} onClick={()=>{endStroke();setTextureView(v=>!v);setShowOriginal(false);setSelectedLamp(null);}}/>
      <PaintTool icon="fit" label={msg('paint.fit')} onClick={()=>window.dispatchEvent(new CustomEvent('mdlvis-frame'))}/>
      <PaintTool icon="save" label={msg('paint.saveTexture')} disabled={!activeTarget} onClick={()=>{endStroke();saveTexture({name:textureName,raster:compositePaintTarget(project),targetId:activeTarget.id});}}/>
      <img className="paint-logo" src="./branding/citadel-paint.svg" alt="Citadel Paint"/>
      <span className="paint-toolbar-spacer"/>
      <PaintTool icon="half" label={msg(halfHidden?'paint.viewBoth':'paint.freezeMirror')} active={halfHidden} onClick={hideHalf}/>
      <PaintTool icon="original" label={msg(showOriginal?'paint.resume':'paint.originalSkin')} active={showOriginal} onClick={()=>{endStroke();setTextureView(false);setShowOriginal(v=>!v);}}/>
      <PaintTool icon="lamp" label={msg('paint.scene')} onClick={()=>{endStroke();setDialog('scene');}}/>
    </div>}
    {project&&<aside key="left" className="paint-panel paint-left"><fieldset disabled={busy||readOnly}>
      <PaintTextureManager targets={project.targets} activeId={project.activeTargetId} onAssign={assignTexture} onRename={renameTexture} onNew={()=>createTexture()} onImport={()=>{endStroke();setImportIntent('texture');setDialog('import');}} onAll={()=>assignTexture(project.activeTargetId,true)} disabled={busy||readOnly}/>
      <section><h3>{msg('paint.geoset')}</h3><div className="paint-geosets" role="group" aria-label={msg('paint.geoset')}>{model.Geosets.map((geo,index)=><button key={index} aria-label={msg('paint.geosetNumber',{number:index+1})} aria-pressed={activeGeoset===index&&!selectedLamp} disabled={!paintable.has(index)} title={paintable.has(index)?undefined:"Helper / team glow"} onClick={()=>selectGeoset(index)}>{index+1}</button>)}</div>
        <label className="paint-check"><input type="checkbox" checked={isolate} onChange={e=>setIsolate(e.target.checked)}/>{msg('paint.isolate')}</label><label className="paint-check"><input type="checkbox" checked={outline.visible} onChange={e=>setOutline(v=>({...v,visible:e.target.checked}))}/>{msg('paint.highlight')}</label>
      </section>
      <section><h3>{msg('paint.brushes')}</h3><div className="paint-brush-grid">{BRUSH_PRESETS.filter(p=>['round','soft','eraser'].includes(p.id)).map(brushButton)}</div>
        <Range id="size" min={1} max={160} step={1} value={brush.size} percent={false} onChange={size=>setBrush(v=>({...v,size}))}/><Range id="opacity" value={brush.opacity} onChange={opacity=>setBrush(v=>({...v,opacity}))}/>
        <label className="paint-color">{msg('paint.color')}<input type="color" value={brush.color} onChange={e=>{setBrush(v=>({...v,color:e.target.value,materialId:null}));setPlacing(false);setPickPart(false);}}/></label>
        {brush.materialId&&<button onClick={()=>{setBrush(v=>({...v,materialId:null}));setPlacing(false);}}>{msg('paint.useColor')}</button>}
        <h3>{msg('paint.brushTips')}</h3><div className="paint-tip-grid"><button title={msg('paint.tip.basic')} aria-label={msg('paint.tip.basic')} aria-pressed={!brush.tipId} onClick={()=>setBrush(v=>({...v,tipId:null}))}><span className="paint-round-tip"/></button>{PAINT_BRUSH_TIPS.map(tip=><button key={tip.id} title={tip.name} aria-label={tip.name} aria-pressed={brush.tipId===tip.id} onClick={()=>{setBrush(v=>({...v,tipId:tip.id}));setPlacing(false);}}><span className="paint-tip-mask" style={{maskImage:`url("${tip.thumbnail}")`}}/></button>)}</div>
        <small>{selectedTip?.name||msg('paint.tip.basic')}</small><div className="paint-history"><button disabled={!project.history.undo.length} onClick={()=>travel(false)}>{msg('paint.undo')}</button><button disabled={!project.history.redo.length} onClick={()=>travel(true)}>{msg('paint.redo')}</button></div>
      </section>
      <details><summary>{msg('paint.moreBrushes')}</summary><div className="paint-brush-grid">{BRUSH_PRESETS.filter(p=>!['round','soft','eraser'].includes(p.id)).map(brushButton)}</div><p className="paint-help">{msg('paint.brushHelp')}</p>{['hardness','flow','spacing','strength'].map(id=><Range key={id} id={id} min={id==='flow'?.01:id==='spacing'?.03:0} value={brush[id]} onChange={value=>setBrush(v=>({...v,[id]:value}))}/>)}</details>
      <details open={halfHidden||undefined}><summary>{msg('paint.viewOptions')}</summary>
        <label className="paint-check"><input type="checkbox" checked={showHelpers} onChange={e=>setShowHelpers(e.target.checked)}/>{msg('paint.showHelpers')}</label>
        <label className="paint-color">{msg('paint.outlineColor')}<input aria-label={msg('paint.outlineColor')} type="color" value={outline.color} onChange={e=>setOutline(v=>({...v,color:e.target.value}))}/></label><Range id="outlineWidth" value={outline.thickness} min={1} max={6} step={1} percent={false} onChange={thickness=>setOutline(v=>({...v,thickness}))}/>
        <label>{msg('paint.mirrorAxis')}<select value={mirrorAxis} onChange={e=>{setMirrorAxis(e.target.value);setCutPosition(paintPartCenter(baseModel,activeGeoset,e.target.value));}}>{['x','y','z'].map(axis=><option key={axis} value={axis}>{axis.toUpperCase()}</option>)}</select></label>
        <label>{msg('paint.keepSide')}<select value={mirrorSide} onChange={e=>setMirrorSide(+e.target.value)}><option value="1">{msg('paint.positive')}</option><option value="-1">{msg('paint.negative')}</option></select></label>
        <label>{msg('paint.cutPosition')}<input type="number" step=".5" value={Number(cutPosition.toFixed(3))} onChange={e=>setCutPosition(+e.target.value)}/></label><div className="paint-button-row"><button onClick={()=>setCutPosition(0)}>{msg('paint.origin')}</button><button onClick={()=>setCutPosition(paintPartCenter(baseModel,activeGeoset,mirrorAxis))}>{msg('paint.centerPart')}</button></div>
        <label className="paint-check"><input type="checkbox" checked={lowPower} onChange={e=>setLowPower(e.target.checked)}/>{msg('paint.lowPower')}</label>
      </details>
    </fieldset></aside>}
    <section key="stage" className="paint-stage">{selectedLamp&&pickPart&&!textureView&&<div className="paint-lamp-tools" role="group" aria-label="Selected lamp"><span>Lamp {scene.lamps.findIndex(l=>l.id===selectedLamp)+1}</span><PaintTool icon="move" label="Move lamp" active={lampTransform==='move'} onClick={()=>setLampTransform('move')}/><button aria-pressed={lampTransform==='depth'} onClick={()=>setLampTransform('depth')}>Near / far</button><PaintTool icon="rotate" label="Around model" active={lampTransform==='rotate'} onClick={()=>setLampTransform('rotate')}/><PaintTool icon="delete" label="Delete lamp" onClick={deleteLamp}/><small>Drag lamp · Arrows move · Page Up/Down: depth · Shift: fine</small></div>}<div className="paint-model-view" style={{visibility:textureView?'hidden':'visible'}}>{viewport}</div>
      {project&&textureView&&activeCanvas&&<PaintTextureCanvas version={textureOverrides.get(activeTarget.textureId)?.revision} canvas={activeCanvas} geoset={baseModel.Geosets[activeGeoset]} coordId={coordId} brush={brush} brushPreview={footprint} decal={decalPreview} disabled={!ready} onStart={startStroke} onMove={moveStroke} onEnd={endStroke} onCancel={cancelStroke} onDrop={placeDecal} onUVChange={editUV} />}
      {!project?<section className="paint-start-card"><img className="paint-start-logo" src="./branding/citadel-paint.svg" alt="Citadel Paint"/><h2>{msg('paint.start.title')}</h2><div className="paint-start-options">{['current','primer'].map(id=><button key={id} disabled={busy||readOnly} aria-pressed={sourceMode===id} onClick={()=>setSourceMode(id)}><strong>{msg('paint.start.'+id)}</strong><span>{msg('paint.start.'+id+'Help')}</span></button>)}</div><label className="paint-resolution">{msg('paint.resolution')}<select value={resolution} onChange={e=>setResolution(+e.target.value)}><option value="256">{msg('paint.size256')}</option><option value="512">512 × 512</option></select></label><p>{msg('paint.presetHelp')}</p><div className="paint-button-row"><button onClick={onOpenProject}>{msg('paint.openPreset')}</button><button disabled={busy||readOnly} onClick={begin}>{msg(busy?'paint.loading':'paint.start.begin')}</button></div></section>:
        !textureView&&<><div className="paint-stage-label">{msg(showOriginal?'paint.viewingOriginal':lampAction?'paint.lampPickHelp':pickPart?'paint.pickHelp':'paint.paintingPart',{number:activeGeoset+1})}{halfHidden&&<span>{msg('paint.mirrorHidden')}</span>}</div><div className="paint-orbit-hint">{placing?msg('paint.placeHelp'):navigationHint}</div></>}
    </section>
    {project&&<aside key="right" className="paint-panel paint-right"><fieldset disabled={busy||readOnly}>
      {decal&&<section className="paint-placement"><h3>{msg('paint.cutout')}</h3><div className="paint-cutout-preview" draggable onDragStart={e=>{setPlacing(true);setShowOriginal(false);setPickPart(false);e.dataTransfer.setData('application/x-citadel-cutout','cutout');e.dataTransfer.effectAllowed='copy';}}><img src={decal.url} alt={decal.name}/><span>{msg('paint.dragCutout')}</span></div>
        <button aria-pressed={placing} onClick={()=>{setPlacing(v=>!v);setShowOriginal(false);}}>{msg(placing?'paint.returnBrush':'paint.placeCutout')}</button>
        <Range id="size" value={decalTransform.width} min={4} max={project.resolution*2} step={1} percent={false} onChange={width=>setDecalTransform(v=>({...v,width,height:width*decal.raster.height/decal.raster.width}))}/><Range id="angle" value={decalTransform.angle} min={-180} max={180} step={1} percent={false} onChange={angle=>setDecalTransform(v=>({...v,angle}))}/><Range id="opacity" value={decalTransform.opacity} onChange={opacity=>setDecalTransform(v=>({...v,opacity}))}/>
        <div className="paint-button-row"><button aria-pressed={decalTransform.flipX} onClick={()=>setDecalTransform(v=>({...v,flipX:!v.flipX}))}>{msg('paint.flipX')}</button><button aria-pressed={decalTransform.flipY} onClick={()=>setDecalTransform(v=>({...v,flipY:!v.flipY}))}>{msg('paint.flipY')}</button><button onClick={()=>{setDecal(null);setPlacing(false);}}>{msg('paint.close')}</button></div>
      </section>}
      <PaintTextureShelf key={project.id} epoch={shelfEpoch} {...shelfCallbacks} onFolderChange={setFolders}/>
      <div className="paint-active-material">{brush.materialId&&material?<><img src={material.thumbnail} alt=""/><span>{material.name.split(/[\\/]/).at(-1)}</span></>:<><span className="paint-solid-swatch" style={{backgroundColor:brush.color}}/><span>{msg('paint.solidColor')}</span></>}</div>
      <button disabled={!ready} onClick={fillGeoset}>{msg('paint.fillPart')}</button>
      <details><summary>{msg('paint.coats')}</summary><p className="paint-help">{msg('paint.coatHelp')}</p><select aria-label={msg('paint.coats')} value={project.activeCoatId} onChange={e=>{endStroke();project.activeCoatId=e.target.value;notify();}}>{PAINT_COATS.map(coat=><option key={coat.id} value={coat.id}>{msg(coat.messageId)}</option>)}</select>{activeCoat&&<><label className="paint-check"><input type="checkbox" checked={activeCoat.visible!==false} onChange={e=>mutateCoat(c=>{c.visible=e.target.checked;})}/>{msg('paint.visible')}</label><Range id="coatOpacity" value={activeCoat.opacity} onChange={opacity=>mutateCoat(c=>{c.opacity=opacity;})}/></>}</details>
      <p className="paint-help">{msg('paint.sharedUV')}</p>
    </fieldset></aside>}
    {project&&<footer key="footer" className="paint-footer"><span role="status">{msg(project.dirty?'paint.unsaved':'paint.saved')} · {project.resolution} × {project.resolution} · {textureName}</span><button disabled={busy||readOnly} onClick={()=>{endStroke();setDialog('new');}}>{msg('paint.newPreset')}</button><button disabled={busy} onClick={onOpenProject}>{msg('paint.openPreset')}</button><button disabled={busy||readOnly} onClick={()=>{endStroke();onSaveProject?.(project);}}>{msg('paint.saveProject')}</button><button disabled={busy||readOnly} onClick={()=>{endStroke();onExport?.(project);}}>{msg('paint.export')}</button><button disabled={busy} onClick={()=>{endStroke();onExit?.();}}>Use paint on model</button></footer>}
    <input hidden ref={imageInput} type="file" accept=".blp,.dds,.tga,.png,.jpg,.jpeg,.webp" onChange={async e=>{const file=e.target.files[0];if(file)await importFile(file);e.target.value='';}}/>
    {dialog==='import'&&<div className="paint-modal-shade"><section className="paint-save-dialog" role="dialog" aria-modal="true" aria-label="Import texture"><header><strong>Import texture</strong><button onClick={()=>setDialog(null)}>Close</button></header><div className="paint-button-row"><button onClick={()=>setDialog('native')}>WC3 library…</button><button onClick={()=>imageInput.current.click()}>From file…</button></div><h3>Textures in this model</h3><div className="paint-model-textures">{originalModel.Textures.filter(t=>t.Image&&!t.ReplaceableId).map((texture,i)=><button key={i} onClick={()=>importModelTexture(texture)}>{paintTextureStem(texture.Image)}</button>)}</div></section></div>}
    {dialog==='native'&&<Suspense fallback={<div className="paint-modal-shade">{msg('paint.loading')}</div>}><NativeTextureLibrary model={model} modelPath={modelPath} onClose={()=>setDialog(null)} selectLabel={importIntent==='texture'?'Use texture':msg('paint.crop')} onSelectTexture={async asset=>{try{const source={name:asset.name,sourcePath:asset.name,nativeSource:true,raster:await decodePaintImage(asset.bytes,asset.name)};if(importIntent==='texture')await createTexture(source);else{setCutoutSource(source);setDialog('cutout');}}catch(e){onStatus?.(e.message,true);}}}/></Suspense>}
    {dialog==='cutout'&&cutoutSource&&<PaintCutoutEditor source={cutoutSource} onClose={()=>setDialog(null)} onUse={useCutout} onSave={saveTexture}/>}
    {dialog==='saveTexture'&&saveSource&&<PaintSaveTexture source={saveSource} folders={folders} onClose={()=>setDialog(null)} onSaved={async saved=>{setShelfEpoch(v=>v+1);if(saveSource.targetId&&onApply){const target=project.targets.find(t=>t.id===saveSource.targetId);if(target&&saved.textureName!==target.paintName)renamePaintMaterial(project,target,saved.textureName);if(!await onApply())throw Error("The texture file was saved, but could not be applied to the model. Your paint is still open.");}else onStatus?.(msg('paint.textureSaved'));}}/>}
    {dialog==='scene'&&<PaintSceneOptions selectedLampId={selectedLamp} onSelectedLamp={id=>{setSelectedLamp(id);setPickPart(true);setTextureView(false);}} value={scene} onChange={updateScene} backgrounds={backgrounds} onClose={()=>setDialog(null)} onCamera={()=>cameraAPI.current?.()} onMove={id=>{setSelectedLamp(id);setPickPart(true);setTextureView(false);setLampTransform('move');setLampAction(null);}} onPlace={id=>{setTextureView(false);setLampAction({id,action:'place'});}} dncStatus={dncStatus} onDncFile={async file=>{try{const dncModel=readWarcraftDnc(new Uint8Array(await file.arrayBuffer()),file.name);updateScene({...scene,dncModel,environment:'custom',lighting:'dnc'});}catch(e){setDncStatus(e.message);}}}/>}
    {dialog==='new'&&<div className="paint-modal-shade"><section className="paint-save-dialog" role="dialog" aria-modal="true" aria-label={msg('paint.newPreset')}><h3>{msg('paint.newPreset')}</h3><p>{msg('paint.newPresetHelp')}</p><footer><button onClick={async()=>{endStroke();if(!project.dirty||await onSaveProject?.(project)){setDialog(null);onProjectChange?.(null);}}}>{msg('paint.saveAndNew')}</button><button onClick={()=>{setDialog(null);onProjectChange?.(null);}}>{msg('paint.discardAndNew')}</button><button onClick={()=>setDialog(null)}>{msg('paint.cancel')}</button></footer></section></div>}
  </div>;
}
