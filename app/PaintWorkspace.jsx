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
import {paintDecalTransform,projectPaintDecal} from '../src/paint-decal.js';
import {paintMessage as msg} from '../src/paint-messages.js';
import {addPaintProjectTarget,compositePaintTarget,createPaintProject,paintProjectCoat,paintProjectTarget,recordPaintStroke,recordPaintStrokeGroup,recordPaintUV} from '../src/paint-project.js';
import {buildSmartPaintMasks,fillPaintMask,interpolatePaintStroke,preparePaintProjection,prepareTexturePaintProjection,stampProjectedBrush} from '../src/paint-projection.js';
import {paintGeosetMask,paintGeosetTarget,paintHalfModel,paintPartCenter,paintProjectModel,paintStandHidden} from '../src/paint-view.js';
import {clonePaintRaster,resizePaintRaster} from '../src/paint-raster.js';
import {enumeratePaintTargets,findTextureAsset,preferredPaintTarget} from '../src/paint-targets.js';
import {createFreshPaintAtlas} from '../src/paint-uv-atlas.js';
import {BRUSH_PRESETS,PAINT_COATS,normalizeBrushSettings} from '../src/paint-types.js';
import {readWarcraftDnc,sampleWarcraftDnc,wc3DncPath} from '../src/warcraft-dnc.js';
import {decodePaintImage,paintBaseRaster,paintRasterCanvas} from './paint-raster.js';
import './paint-workspace.css';

const NativeTextureLibrary=lazy(()=>import('./TextureLibrary.jsx'));
const emptyOverlays=Object.freeze({bones:false,wires:false,nodes:false,attachments:false,particles:false,vertices:false,grid:false,axes:false,cameras:false,normals:false});
const emptySelection=Object.freeze({}),emptyVertices=Object.freeze([]),noOverrides=new Map();
function Range({id,value,min=0,max=1,step=.01,percent=true,editable=false,onChange}){
  const label=msg('paint.'+id);
  const factor=percent?100:1,clamp=v=>Math.max(min,Math.min(max,Math.round(v/step)*step));
  return <label className={'paint-range'+(editable?' paint-range-editable':'')}><span>{label}</span><input aria-label={label} type="range" min={editable?0:min} max={editable?1000:max} step={editable?1:step} value={editable?Math.log(value/min)/Math.log(max/min)*1000:value} onChange={e=>onChange(editable?clamp(min*Math.pow(max/min,+e.target.value/1000)):+e.target.value)}/>{editable?<span className="paint-range-value"><input aria-label={label+' value'} type="number" min={min*factor} max={max*factor} step={step*factor} value={Math.round(value*factor)} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))onChange(clamp(e.target.valueAsNumber/factor));}}/>{percent?'%':'px'}</span>:<output>{percent?Math.round(value*100)+'%':Math.round(value)}</output>}</label>;
}

/** Owns editable coats, cutouts and view-only scene lights/backgrounds.
 * App owns applying completed paint/UVs to the model and portable texture files.
 * The original skin is retained for O.G and in saved presets. Stroke previews
 * composite/upload the changed target once per frame.
 */
export default function PaintWorkspace({model,originalModel=model,revision,modelName,modelPath,textureAssets,project,activeGeoset,onGeosetChange,onProjectChange,onWorkingModelChange,onEnsureTarget,onSaveProject,onOpenProject,onExport,onApply,onExit,onStatus,preferences,cameraProps={},cameraMode='work',view='perspective',teamColor='#ff0303',readOnly=false,onInteractionChange}){
  const [resolution,setResolution]=useState(512),[sourceMode,setSourceMode]=useState('primer'),[busy,setBusy]=useState(false);
  const [brush,setBrush]=useState(()=>normalizeBrushSettings({id:'normal',color:'#718b45',filterColor:'#ffffff'})),[material,setMaterial]=useState(null),[targetMode,setTargetMode]=useState('free');
  const [paintRevision,setPaintRevision]=useState(0),[pickPart,setPickPart]=useState(false),[isolate,setIsolate]=useState(false),[showHelpers,setShowHelpers]=useState(false);
  const [outline,setOutline]=useState({visible:true,color:'#35d9ff',thickness:2}),[halfHidden,setHalfHidden]=useState(false),[mirrorAxis,setMirrorAxis]=useState('y'),[mirrorSide,setMirrorSide]=useState(1),[cutPosition,setCutPosition]=useState(0),[lowPower,setLowPower]=useState(false);
  const [textureView,setTextureView]=useState(false),[showOriginal,setShowOriginal]=useState(false),[dialog,setDialog]=useState(null),[cutoutSource,setCutoutSource]=useState(null),[importIntent,setImportIntent]=useState('cutout'),[selectedLamp,setSelectedLamp]=useState(null),[lampTransform,setLampTransform]=useState('move'),[saveSource,setSaveSource]=useState(null);
  const [scene,setScene]=useState(()=>({...DEFAULT_PAINT_SCENE,...project?.viewSettings})),[dncModel,setDncModel]=useState(null),[dncStatus,setDncStatus]=useState(''),[lampAction,setLampAction]=useState(null),[shelfEpoch,setShelfEpoch]=useState(0),[folders,setFolders]=useState(['']);
  const stroke=useRef(null),frame=useRef(0),projectionCache=useRef(null),smartMaskCache=useRef(null),canvasCache=useRef(new Map()),dirtyTargets=useRef(new Map()),mounted=useRef(true),cameraAPI=useRef(null),imageInput=useRef(null),dncCache=useRef(new Map());
  const currentProject=useRef(project);currentProject.current=project;const shelfAPI=useRef();
  const endCurrentStroke=useRef(null);endCurrentStroke.current=endStroke;
  const toolCommand=useRef(null);toolCommand.current=chooseTool;
  const baseModel=useMemo(()=>paintProjectModel(model,project,originalModel),[model,originalModel,revision,project,project?.uvRevision,project?.materialRevision]);
  const catalog=useMemo(()=>enumeratePaintTargets(baseModel),[baseModel,revision]),allGeosets=useMemo(()=>new Set(baseModel.Geosets.map((_,i)=>i)),[baseModel]);
  const freshMapping=project?!!project.paintAtlasVersion:sourceMode==='primer';
  const paintable=useMemo(()=>new Set(paintableGeosets(originalModel,{requireUV:!freshMapping})),[originalModel,freshMapping]);
  const standHidden=useMemo(()=>paintStandHidden(originalModel),[originalModel]);
  const hiddenGeosets=useMemo(()=>new Set([...allGeosets].filter(i=>(isolate&&i!==activeGeoset)||(!showHelpers&&(!paintable.has(i)||(standHidden.has(i)&&i!==activeGeoset))))),[isolate,showHelpers,allGeosets,activeGeoset,paintable,standHidden]);
  const viewModel=showOriginal?originalModel:baseModel;
  const displayModel=useMemo(()=>paintHalfModel(viewModel,halfHidden?{axis:mirrorAxis,side:mirrorSide,position:cutPosition}:null),[viewModel,halfHidden,mirrorAxis,mirrorSide,cutPosition]);
  // Navigation belongs to the shared editor preferences, including MDLVis's
  // middle-click Rotation/Work toggle. Citadel never reverses those bindings.
  const viewportPreferences=useMemo(()=>({...preferences,graphics:{...preferences?.graphics,...(lowPower?{pixelRatio:1,antialias:false}:{})}}),[preferences,lowPower]);
  const navigation=cameraBindings(preferences),navigationHint=`Right-drag: ${navigation.right} · ${navigation.middle==='toggle'?'Middle-click: rotation / work':'Middle-drag: '+navigation.middle} · Wheel: zoom`;
  const paintAppearance=useMemo(()=>normalizePaintAppearance(preferences?.citadelPaint),[preferences?.citadelPaint]);
  const activeTarget=project?paintProjectTarget(project):null,activeCoat=project?paintProjectCoat(project):null;
  const coordId=activeTarget?.bindings.find(b=>b.geosetIndex===activeGeoset)?.coordId||0;
  const targetOptions=catalog.filter(target=>target.geosetIndices.includes(activeGeoset));
  const materialRaster=material?.raster||null,geosetReady=!!project&&activeTarget?.geosetIndices.includes(activeGeoset)&&!busy&&!readOnly&&!showOriginal;
  const ready=!!project&&(targetMode==='free'?project.targets.some(target=>target.bindings?.length):geosetReady)&&!busy&&!readOnly&&!showOriginal;
  const decal=useMemo(()=>material?.exactStamp&&brush.materialId&&brush.mode!=='erase'?{...paintDecalTransform(material.raster,brush),url:material.preview}:null,[material,brush.materialId,brush.mode,brush.size,brush.zoom,brush.opacity,brush.strength]);
  const footprint=useMemo(()=>paintBrushPreview(brush,null,brush.materialId&&brush.mode!=='erase'?materialRaster:null,paintAppearance.brushCursor),[brush.id,brush.size,brush.materialId,brush.zoom,materialRaster,paintAppearance.brushCursor]);
  const flatProjection=useMemo(()=>project?prepareTexturePaintProjection(project.resolution):null,[project?.resolution]);
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
  useEffect(()=>{projectionCache.current=null;smartMaskCache.current=null;setMaterial(null);setCutoutSource(null);setSaveSource(null);setTargetMode('free');setBrush(value=>({...value,materialId:null,filterColor:'#ffffff'}));},[project?.id]);
  useEffect(()=>{const flush=()=>endCurrentStroke.current?.();window.addEventListener('mdlxl-paint-flush',flush);window.addEventListener('beforeunload',flush,true);return()=>{window.removeEventListener('mdlxl-paint-flush',flush);window.removeEventListener('beforeunload',flush,true);};},[]);
  function chooseTool(tool){if(!project||busy||readOnly)return;endStroke();cameraProps.onWorkMode?.();setTextureView(false);setPickPart(tool==='select');setLampAction(null);if(tool==='draw'){setSelectedLamp(null);setShowOriginal(false);}}
  function chooseTargetMode(mode){endStroke();setTargetMode(mode);setPickPart(false);setSelectedLamp(null);setShowOriginal(false);if(mode==='free')setIsolate(false);}
  useEffect(()=>{cameraProps.onWorkMode?.();const select=event=>toolCommand.current?.(event.detail);window.addEventListener('mdlxl-paint-tool',select);return()=>window.removeEventListener('mdlxl-paint-tool',select);},[]);
  useEffect(()=>{
    if(!project)return;try{const upgraded=enablePaintMaterials(project,model),repaired=repairPaintMaterials(project,originalModel,model);if(upgraded||repaired)notify();}catch(e){onStatus?.(e.message,true);return;}const target=paintProjectTarget(project);if(target&&!target.geosetIndices.includes(activeGeoset))onGeosetChange?.(target.geosetIndices[0]);
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
      const next=createPaintProject({modelName,resolution,sourceMode});next.viewSettings=scene;next.dirty=true;let working=model;
      if(sourceMode==='primer'){
        const geosets=paintableGeosets(originalModel,{requireUV:false});if(!geosets.length)throw Error(msg('paint.empty'));
        const atlas=createFreshPaintAtlas(model,geosets,resolution);working=atlas.model;next.generatedUVSets=atlas.coordIds;next.paintAtlasVersion=1;
        createPaintMaterial(next,working,{name:'Material 1',raster:await paintBaseRaster(null,resolution,'primer'),geosets,basecoat:true,generatedUV:true,sourceModel:originalModel});
        onWorkingModelChange?.(working);
      }else{
        for(const descriptor of catalog){const asset=findTextureAsset(textureAssets,descriptor.texturePath);await initializeTarget({...descriptor,nativeSource:['gameData','library'].includes(asset?.source)},next);}
        if(!next.targets.length)throw Error(msg('paint.empty'));enablePaintMaterials(next,model);
      }
      repairPaintMaterials(next,originalModel,working);const selected=next.targets.find(t=>t.geosetIndices.includes(activeGeoset))||next.targets[0];next.activeTargetId=selected.id;
      if(!mounted.current)return;onGeosetChange?.(selected.geosetIndices.includes(activeGeoset)?activeGeoset:selected.geosetIndices[0]);onProjectChange?.(next);setPaintRevision(n=>n+1);onStatus?.(msg('paint.ready'));
    }catch(e){onStatus?.(e.message,true);}finally{if(mounted.current)setBusy(false);}
  }
  async function selectGeoset(index){
    if(!project||busy||readOnly)return;endStroke();setSelectedLamp(null);
    const selected=project.targets.find(t=>t.geosetIndices.includes(index));
    if(selected)project.activeTargetId=selected.id;
    onGeosetChange?.(index);notify();
  }
  function selectMaterial(id){if(busy||readOnly)return;endStroke();const target=project.targets.find(item=>item.id===id);if(!target)return;project.activeTargetId=id;setSelectedLamp(null);if(target.geosetIndices.length&&!target.geosetIndices.includes(activeGeoset))onGeosetChange?.(target.geosetIndices[0]);notify();}
  function assignTexture(id,all=false){if(busy||readOnly)return;endStroke();try{assignPaintMaterial(project,model,id,all?[...paintable]:[activeGeoset],originalModel);setSelectedLamp(null);notify();}catch(e){onStatus?.(e.message,true);}}
  function renameTexture(name){try{endStroke();renamePaintMaterial(project,activeTarget,name);notify();return true;}catch(e){onStatus?.(e.message,true);return false;}}
  async function createTexture(source=null){
    if(busy||readOnly)return;endStroke();setBusy(true);
    try{const raster=source?resizePaintRaster(source.raster,project.resolution,project.resolution):await paintBaseRaster(null,project.resolution,'primer');let working=model,generatedUV=!source;
      if(!mounted.current||currentProject.current!==project)return;
      if(generatedUV&&!project.paintAtlasVersion){const geosets=paintableGeosets(originalModel,{requireUV:false}),atlas=createFreshPaintAtlas(model,geosets,project.resolution);working=atlas.model;project.generatedUVSets=atlas.coordIds;project.paintAtlasVersion=1;onWorkingModelChange?.(working);}
      createPaintMaterial(project,working,{name:source?paintTextureStem(source.name):'Material '+(project.targets.length+1),raster,geosets:[activeGeoset],nativeSource:!!source?.nativeSource,sourcePath:source?.sourcePath||source?.name||'',basecoat:!source,generatedUV,sourceModel:originalModel});
      setMaterial(null);setBrush(v=>({...v,materialId:null,filterColor:'#ffffff'}));setSelectedLamp(null);setShowOriginal(false);setDialog(null);setPickPart(false);notify();
    }catch(e){onStatus?.(e.message,true);}finally{setBusy(false);}
  }
  async function importModelTexture(texture){
    try{const asset=findTextureAsset(textureAssets,texture.Image);if(!asset?.bytes)throw Error('This model texture is not loaded. Choose Warcraft data in Settings, or import its file.');
      const raster=await decodePaintImage(asset.bytes,asset.name);await createTexture({name:texture.Image,sourcePath:texture.Image,raster,nativeSource:['gameData','library'].includes(asset.source)});
    }catch(e){onStatus?.(e.message,true);}
  }
  function changeLamp(id,change){updateScene({...scene,lamps:scene.lamps.map(lamp=>lamp.id===id?{...lamp,...change}:lamp)});}
  function deleteLamp(){if(!selectedLamp)return;updateScene({...scene,lamps:scene.lamps.filter(l=>l.id!==selectedLamp)});setSelectedLamp(null);}
  function projectionFor(hit,target,geosetIndex=null){
    if(hit.textureView)return flatProjection;
    const scoped=geosetIndex==null?target:paintGeosetTarget(target,geosetIndex),key=target.id+':'+(geosetIndex??'free')+':'+[...hiddenGeosets]+':'+hit.viewport.width+':'+hit.viewport.height+':'+hit.viewProjectionMatrix.join(',');
    let cache=projectionCache.current;if(!(cache instanceof Map))projectionCache.current=cache=new Map();let cached=cache.get(key);
    if(!cached||cached.model!==displayModel||cached.revision!==revision){cached={model:displayModel,revision,projection:preparePaintProjection(displayModel,scoped,hit.viewProjectionMatrix,hit.viewport.width,hit.viewport.height,384,hiddenGeosets)};cache.set(key,cached);}
    return cached.projection;
  }
  function brushOptions(target,scope,texture=false){
    let masks=null;
    if(brush.mode==='wash'||brush.mode==='drybrush'){
      const key=target.id+':'+(scope??'free')+':'+project.resolution;let cache=smartMaskCache.current;if(!(cache instanceof Map))smartMaskCache.current=cache=new Map();let cached=cache.get(key);
      if(!cached||cached.model!==baseModel){const paintTarget=scope==null?target:paintGeosetTarget(target,scope);cached={model:baseModel,masks:buildSmartPaintMasks(baseModel,paintTarget,project.resolution)};cache.set(key,cached);}
      masks=cached.masks;
    }
    return {flags:texture?0:target.flags,mask:masks?.[brush.mode],materialRaster:brush.materialId&&brush.mode!=='erase'?materialRaster:null,decalRaster:material?.exactStamp&&brush.materialId&&brush.mode!=='erase'?materialRaster:null};
  }
  function startStroke(hit){
    if(!ready)return;if(targetMode==='geoset'&&!hit.textureView&&hit.geosetIndex!==activeGeoset){onStatus?.(msg('paint.locked'));return;}
    const targets=hit.textureView||targetMode==='geoset'?[activeTarget]:project.targets,scope=hit.textureView?activeGeoset:targetMode==='geoset'?activeGeoset:null;
    const parts=targets.filter(Boolean).map(target=>{const coat=paintProjectCoat(project,target.id,brush.mode==='erase'?'__alpha':project.activeCoatId);if(!coat||brush.mode!=='erase'&&coat.visible===false)return null;return{target,coat,coatId:coat.id,before:clonePaintRaster(coat.raster),projection:projectionFor(hit,target,scope),options:brushOptions(target,scope,hit.textureView),changed:0};}).filter(Boolean);
    if(!parts.length){onStatus?.(msg('paint.hiddenCoat'));return;}
    onInteractionChange?.(true);stroke.current={parts,last:null,lastStamp:null,pending:[],brush:{...brush}};moveStroke(hit);
  }
  function flushStroke(){
    frame.current=0;const current=stroke.current;if(!current)return;let changed=0;
    for(const part of current.parts){part.rows=createPaintDirtyRows(project.resolution);part.options.dirtyRows=part.rows;}
    for(const next of current.pending){if(current.last&&next.x===current.last.x&&next.y===current.last.y)continue;for(const point of interpolatePaintStroke(current.last,next,current.brush)){const dragging=!!current.lastStamp,motion=current.lastStamp?{x:point.x-current.lastStamp.x,y:point.y-current.lastStamp.y}:null;for(const part of current.parts)part.changed+=part.options.decalRaster?projectPaintDecal(part.coat.raster,part.projection,part.options.decalRaster,point,paintDecalTransform(part.options.decalRaster,current.brush,dragging),{...part.options,mode:current.brush.mode,filterColor:current.brush.filterColor}):stampProjectedBrush(part.coat.raster,part.projection,point,current.brush,{...part.options,dragging,motion});current.lastStamp=point;}current.last=next;}
    current.pending=[];for(const part of current.parts)if(part.changed){changed+=part.changed;refreshTarget(part.target,part.rows);part.changed=0;}
  }
  function moveStroke(hit){const current=stroke.current;if(!current)return;current.pending.push(hit.screen);if(!frame.current)frame.current=requestAnimationFrame(flushStroke);}
  function endStroke(){onInteractionChange?.(false);cancelAnimationFrame(frame.current);flushStroke();const current=stroke.current;stroke.current=null;if(current&&project&&recordPaintStrokeGroup(project,current.parts.map(part=>({targetId:part.target.id,coatId:part.coatId,before:part.before})),current.brush.name+' stroke',current.brush)){for(const part of current.parts){markPaintMaterialEdited(project,part.target);const cached=canvasCache.current.get(part.target.id);if(cached)cached.version=part.target.revision;}notify();}}
  function cancelStroke(){onInteractionChange?.(false);cancelAnimationFrame(frame.current);frame.current=0;const current=stroke.current;stroke.current=null;if(!current)return;for(const part of current.parts){if(part.coatId==='__alpha')part.target.alphaMask=part.before;else part.coat.raster=part.before;refreshTarget(part.target);}}
  function chooseBrush(preset){endStroke();setPickPart(false);setBrush(previous=>normalizeBrushSettings({...previous,...preset,size:previous.size,zoom:previous.zoom,opacity:previous.opacity,color:previous.color,filterColor:previous.filterColor,materialId:previous.materialId,tipId:null}));}
  function chooseMaterial(source){endStroke();const id=crypto.randomUUID(),thumbnail=paintRasterCanvas(resizePaintRaster(source.raster,64,64)).toDataURL(),preview=source.exactStamp?paintRasterCanvas(source.raster).toDataURL():thumbnail;setMaterial({...source,id,thumbnail,preview});setPickPart(false);setBrush(value=>source.exactStamp?normalizeBrushSettings({...value,id:'normal',size:Math.max(source.raster.width,source.raster.height),zoom:1,opacity:1,strength:1,materialId:id,filterColor:'#ffffff',tipId:null}):({...value,materialId:id,filterColor:'#ffffff'}));onStatus?.(msg('paint.materialSelected'));}
  function useCutout(source){
    if(importIntent==='texture')createTexture({...cutoutSource,...source});else{chooseMaterial({...cutoutSource,...source,exactStamp:!source.whole});setShowOriginal(false);setDialog(null);}
  }
  function pick(hit){
    if(lampAction){const {id,action}=lampAction,pose=cameraAPI.current?.(),position=hit.worldPosition.map((v,i)=>v+hit.normal[i]*(pose?.radius||100)*.5);
      updateScene({...scene,lamps:scene.lamps.map(lamp=>lamp.id===id?{...lamp,...(action==='place'?{position,target:hit.worldPosition}:{target:hit.worldPosition})}:lamp)});setLampAction(null);return;}
    selectGeoset(hit.geosetIndex);
  }
  function fillGeoset(){
    if(!geosetReady||!activeCoat)return;endStroke();const layer=brush.mode==='erase'?paintProjectCoat(project,activeTarget.id,'__alpha'):activeCoat;
    if(layer.visible===false){onStatus?.(msg('paint.hiddenCoat'));return;}
    const before=clonePaintRaster(layer.raster),mask=paintGeosetMask(displayModel,paintGeosetTarget(activeTarget,activeGeoset),project.resolution),options=brushOptions(activeTarget,activeGeoset);
    fillPaintMask(layer.raster,mask,brush,options);
    if(recordPaintStroke(project,activeTarget.id,layer.id,before,msg('paint.fillPart'),brush)){markPaintMaterialEdited(project,activeTarget);notify();onStatus?.(msg('paint.filled',{number:activeGeoset+1}));}
  }
  function mutateCoat(change){if(!ready||!activeCoat)return;change(activeCoat);activeTarget.revision=(activeTarget.revision||0)+1;project.dirty=true;project.revision++;notify();}
  function editUV(next){if(!geosetReady)return;endStroke();const before=baseModel.Geosets[activeGeoset].TVertices[coordId];if(recordPaintUV(project,activeGeoset+':'+coordId,before,next))notify();}
  function hideHalf(){endStroke();setHalfHidden(value=>!value);}
  async function importFile(file){try{const raster=await decodePaintImage(new Uint8Array(await file.arrayBuffer()),file.name);if(importIntent==='texture')await createTexture({name:file.name,raster});else{setCutoutSource({name:file.name,raster});setDialog('cutout');}}catch(e){onStatus?.(e.message,true);}}
  function saveTexture(source){setSaveSource(source);setDialog('saveTexture');}
  const activeCanvas=activeTarget?textureOverrides.get(activeTarget.textureId)?.canvas:null;
  const textureName=activeTarget?.paintName??activeTarget?.label??'';
  const brushButton=preset=><button key={preset.id} aria-pressed={brush.id===preset.id} onClick={()=>chooseBrush(preset)}>{msg(preset.messageId)}</button>;
  shelfAPI.current={onUse:chooseMaterial,onCut:source=>{setImportIntent('cutout');setCutoutSource(source);setDialog('cutout');},onNative:()=>{setImportIntent('cutout');setDialog('native');},onImport:()=>{setImportIntent('cutout');imageInput.current.click();},onStatus};
  const shelfCallbacks=useMemo(()=>Object.fromEntries(['onUse','onCut','onNative','onImport','onStatus'].map(key=>[key,(...args)=>shelfAPI.current[key]?.(...args)])),[]);
  const viewport=<PaintViewport {...cameraProps} key="paint-viewport" model={displayModel} revision={revision} selectedGeoset={activeGeoset} selectedVertices={emptyVertices} selectableGeosets={allGeosets} selectionByGeoset={emptySelection} hiddenVertices={emptySelection} hiddenGeosets={hiddenGeosets} mode="textured" overlays={emptyOverlays} showVertices={false} showSkeleton={false} showGrid={false} showAxes={false} shaded view={view} cameraMode={cameraMode} workplane="xy" transformMode="select" sequenceIndex={-1} time={0} playing={false} teamColor={teamColor} textureAssets={textureAssets} preferences={viewportPreferences} paintWorkspace paintMode={!!project} paintSelectOnly={pickPart||!!lampAction} paintDisabled={!ready} paintOutline={{...outline,visible:outline.visible&&targetMode==='geoset'}} paintBrushSize={brush.size} paintBrushPreview={footprint} paintDecal={decal} paintLights={lights} paintLampPickingDisabled={!!lampAction} onPaintInteractionChange={onInteractionChange} paintSelectedLamp={selectedLamp} paintLampTransform={lampTransform} paintLampColor={paintAppearance.lampSelection} onPaintLampSelect={id=>{setSelectedLamp(id);setPickPart(true);}} onPaintLampChange={changeLamp} paintBackground={background} paintTextureOverrides={showOriginal?noOverrides:textureOverrides} paintTextureSmoothing={scene.textureSmoothing} paintTextureRevision={paintRevision+Number(project?.revision||0)} onPaintCameraReady={api=>{cameraAPI.current=api;}} onPaintPick={pick} onPaintStart={startStroke} onPaintMove={moveStroke} onPaintEnd={endStroke} onPaintCancel={cancelStroke} suspended={textureView}/>;
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
      <section><h3>{msg('paint.mode')}</h3><div className="paint-brush-grid" role="group" aria-label={msg('paint.mode')}>
        <button aria-pressed={targetMode==='free'} onClick={()=>chooseTargetMode('free')}>{msg('paint.mode.free')}</button><button aria-pressed={targetMode==='geoset'} onClick={()=>chooseTargetMode('geoset')}>{msg('paint.mode.geoset')}</button>
      </div><p className="paint-help">{msg(targetMode==='free'?'paint.mode.freeHelp':'paint.mode.geosetHelp')}</p></section>
      <PaintTextureManager targets={project.targets} activeId={project.activeTargetId} onSelect={selectMaterial} onRename={renameTexture} onNew={()=>createTexture()} onImport={()=>{endStroke();setImportIntent('texture');setDialog('import');}} onAll={()=>assignTexture(project.activeTargetId,true)} disabled={busy||readOnly}/>
      {targetMode==='geoset'&&<section><h3>{msg('paint.geoset')}</h3><div className="paint-geosets" role="group" aria-label={msg('paint.geoset')}>{model.Geosets.map((geo,index)=><button key={index} aria-label={msg('paint.geosetNumber',{number:index+1})} aria-pressed={activeGeoset===index&&!selectedLamp} disabled={!paintable.has(index)} title={paintable.has(index)?undefined:"Helper / team glow"} onClick={()=>selectGeoset(index)}>{index+1}</button>)}</div>
        <label className="paint-check"><input type="checkbox" checked={isolate} onChange={e=>setIsolate(e.target.checked)}/>{msg('paint.isolate')}</label><label className="paint-check"><input type="checkbox" checked={outline.visible} onChange={e=>setOutline(v=>({...v,visible:e.target.checked}))}/>{msg('paint.highlight')}</label>
      </section>}
      <section><h3>{msg('paint.source')}</h3><div className="paint-brush-grid" role="group" aria-label={msg('paint.source')}>
        <button aria-pressed={!brush.materialId} onClick={()=>{endStroke();setBrush(v=>({...v,materialId:null}));setPickPart(false);}}>{msg('paint.source.color')}</button><button aria-pressed={!!brush.materialId} disabled={!material} onClick={()=>{endStroke();if(material)setBrush(v=>({...v,materialId:material.id}));setPickPart(false);}}>{msg('paint.source.texture')}</button>
      </div>
        <label className="paint-color">{msg(brush.materialId?'paint.filterColor':'paint.color')}<input type="color" value={brush.materialId?brush.filterColor:brush.color} onChange={e=>{setBrush(v=>brush.materialId?{...v,filterColor:e.target.value}:{...v,color:e.target.value});setPickPart(false);}}/></label>
        {brush.materialId&&brush.filterColor!=='#ffffff'&&<button onClick={()=>setBrush(v=>({...v,filterColor:'#ffffff'}))}>{msg('paint.resetFilter')}</button>}
      </section>
      <section><h3>{msg('paint.technique')}</h3><div className="paint-brush-grid">{BRUSH_PRESETS.map(brushButton)}</div>
        <Range id="size" min={1} max={2048} step={1} editable value={brush.size} percent={false} onChange={size=>setBrush(v=>({...v,size}))}/>{brush.materialId&&<Range id="brushZoom" min={.01} max={64} step={.01} editable value={brush.zoom} onChange={zoom=>setBrush(v=>({...v,zoom}))}/>}<Range id="opacity" value={brush.opacity} onChange={opacity=>setBrush(v=>({...v,opacity}))}/>
        <label className="paint-check" title={msg('paint.bleedHelp')}><input type="checkbox" checked={scene.textureSmoothing} onChange={e=>{endStroke();updateScene({...scene,textureSmoothing:e.target.checked});}}/>{msg('paint.bleed')}</label>
        <p className="paint-help">{msg('paint.brushHelp')}</p>
      </section>
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
      {project&&textureView&&activeCanvas&&<PaintTextureCanvas version={textureOverrides.get(activeTarget.textureId)?.revision} canvas={activeCanvas} geoset={baseModel.Geosets[activeGeoset]} coordId={coordId} brush={brush} brushPreview={footprint} decal={decal} textureSmoothing={scene.textureSmoothing} disabled={!geosetReady} onStart={startStroke} onMove={moveStroke} onEnd={endStroke} onCancel={cancelStroke} onUVChange={editUV} />}
      {!project?<section className="paint-start-card"><img className="paint-start-logo" src="./branding/citadel-paint.svg" alt="Citadel Paint"/><h2>{msg('paint.start.title')}</h2><div className="paint-start-options">{['current','primer'].map(id=><button key={id} disabled={busy||readOnly} aria-pressed={sourceMode===id} onClick={()=>setSourceMode(id)}><strong>{msg('paint.start.'+id)}</strong><span>{msg('paint.start.'+id+'Help')}</span></button>)}</div><label className="paint-resolution">{msg('paint.resolution')}<select value={resolution} onChange={e=>setResolution(+e.target.value)}><option value="256">{msg('paint.size256')}</option><option value="512">512 × 512</option></select></label><p>{msg('paint.presetHelp')}</p><div className="paint-button-row"><button onClick={onOpenProject}>{msg('paint.openPreset')}</button><button disabled={busy||readOnly} onClick={begin}>{msg(busy?'paint.loading':'paint.start.begin')}</button></div></section>:
        !textureView&&<><div className="paint-stage-label">{showOriginal?msg('paint.viewingOriginal'):lampAction?msg('paint.lampPickHelp'):pickPart?msg('paint.pickHelp'):targetMode==='free'?msg('paint.mode.free'):msg('paint.paintingPart',{number:activeGeoset+1})}{halfHidden&&<span>{msg('paint.mirrorHidden')}</span>}</div><div className="paint-orbit-hint">{navigationHint}</div></>}
    </section>
    {project&&<aside key="right" className="paint-panel paint-right"><fieldset disabled={busy||readOnly}>
      <PaintTextureShelf key={project.id} epoch={shelfEpoch} {...shelfCallbacks} onFolderChange={setFolders}/>
      <div className="paint-active-material">{brush.materialId&&material?<><img src={material.thumbnail} alt=""/><span>{material.name.split(/[\\/]/).at(-1)}</span></>:<><span className="paint-solid-swatch" style={{backgroundColor:brush.color}}/><span>{msg('paint.solidColor')}</span></>}</div>
      {targetMode==='geoset'&&<button disabled={!geosetReady} onClick={fillGeoset}>{msg('paint.fillPart')}</button>}
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
