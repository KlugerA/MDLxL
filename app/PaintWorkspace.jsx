import {createPaintMaterial,enablePaintMaterials,repairPaintMaterials,markPaintMaterialEdited,paintableGeosets} from '../src/paint-materials.js';
import {paintLampLight} from './paint-lamps.js';
import {normalizePaintAppearance} from '../src/paint-appearance.js';
import {APPLICATION_THEMES,cameraBindings} from '../src/preferences.js';
import {createPaintDirtyRows,createPaintPreview,updatePaintPreview,paintRowsBounds,mergePaintRows} from '../src/paint-preview.js';
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
import {blendProjectedPaint} from '../src/paint-blend.js';
import PaintStudioLayout from './PaintStudioLayout.jsx';
import {paintMessage as msg} from '../src/paint-messages.js';
import {addPaintProjectTarget,compositePaintTarget,createPaintProject,paintProjectCoat,paintProjectTarget,recordPaintStroke,recordPaintStrokeGroup,recordPaintUV,recordPaintSurfaceChange,travelPaintHistory} from '../src/paint-project.js';
import {buildSmartPaintMasks,fillPaintMask,interpolatePaintStroke,preparePaintProjection,prepareTexturePaintProjection,stampProjectedBrush} from '../src/paint-projection.js';
import {paintGeosetMask,paintProjectModel,paintStandHidden} from '../src/paint-view.js';
import {rgbaColor,clonePaintRaster,resizePaintRaster,compositePaintRasters,createPaintRaster} from '../src/paint-raster.js';
import {enumeratePaintTargets,findTextureAsset,preferredPaintTarget} from '../src/paint-targets.js';
import {preparePaintSurfaceChange} from '../src/paint-surface.js';
import {preparePaintSelectionSpace} from '../src/paint-selection-space.js';
import {regionPaintTarget,connectedPaintFaces,isolatePaintRegion} from '../src/paint-region.js';
import {createFreshPaintAtlas} from '../src/paint-uv-atlas.js';
import {PAINT_COATS,normalizeBrushSettings} from '../src/paint-types.js';
import {readWarcraftDnc,sampleWarcraftDnc,wc3DncPath} from '../src/warcraft-dnc.js';
import {decodePaintImage,paintBaseRaster,paintRasterCanvas} from './paint-raster.js';
import './paint-workspace.css';
import './paint-studio.css';

const NativeTextureLibrary=lazy(()=>import('./TextureLibrary.jsx'));
const emptyOverlays=Object.freeze({bones:false,wires:false,nodes:false,attachments:false,particles:false,vertices:false,grid:false,axes:false,cameras:false,normals:false});
const emptySelection=Object.freeze({}),emptyVertices=Object.freeze([]),noOverrides=new Map();
/** Owns editable coats, cutouts and view-only scene lights/backgrounds.
 * App owns applying completed paint/UVs to the model and portable texture files.
 * The original skin is retained for O.G and in saved presets. Stroke previews
 * composite/upload the changed target once per frame.
 */
export default function PaintWorkspace({model,originalModel=model,revision,modelName,modelPath,textureAssets,project,activeGeoset,onGeosetChange,onProjectChange,onWorkingModelChange,onEnsureTarget,onSaveProject,onOpenProject,onExport,onApply,onExit,onStatus,preferences,cameraProps={},cameraMode='work',view='perspective',teamColor='#ff0303',readOnly=false,onInteractionChange}){
  const [resolution,setResolution]=useState(512),[sourceMode,setSourceMode]=useState('current'),[busy,setBusy]=useState(false);
  const [brush,setBrush]=useState(()=>normalizeBrushSettings({id:'normal',color:'#a6a5a1',filterColor:'#ffffff'})),[material,setMaterial]=useState(null),[targetMode,setTargetMode]=useState('free');
  const [paintRevision,setPaintRevision]=useState(0),[pickPart,setPickPart]=useState(false),[isolate,setIsolate]=useState(false),[showHelpers,setShowHelpers]=useState(false);
  const [outline,setOutline]=useState({visible:true,color:'#35d9ff',thickness:2}),[lowPower,setLowPower]=useState(false);
  const [textureView,setTextureView]=useState(false),[showOriginal,setShowOriginal]=useState(false),[dialog,setDialog]=useState(null),[cutoutSource,setCutoutSource]=useState(null),[selectedLamp,setSelectedLamp]=useState(null),[lampTransform,setLampTransform]=useState('move'),[saveSource,setSaveSource]=useState(null);
  const [scene,setScene]=useState(()=>({...DEFAULT_PAINT_SCENE,...project?.viewSettings})),[dncModel,setDncModel]=useState(null),[dncStatus,setDncStatus]=useState(''),[lampAction,setLampAction]=useState(null),[shelfEpoch,setShelfEpoch]=useState(0),[folders,setFolders]=useState(['']);
  const [region,setRegion]=useState(null),[textureRegion,setTextureRegion]=useState(null),[regionTool,setRegionTool]=useState(false),[surfaceSize,setSurfaceSize]=useState(1024),[split,setSplit]=useState(60);
  const hover=useRef(null),hoverFrame=useRef(0),hoverHit=useRef(null);
  const [studioTool,setStudioTool]=useState('paint'),[borrowMode,setBorrowMode]=useState('image'),[stampAngle,setStampAngle]=useState(0),[stampFlip,setStampFlip]=useState(false),[placing,setPlacing]=useState(false),[selectionKind,setSelectionKind]=useState('piece');
  const placement=useRef(null);
  const stroke=useRef(null),frame=useRef(0),projectionCache=useRef(null),smartMaskCache=useRef(null),canvasCache=useRef(new Map()),dirtyTargets=useRef(new Map()),mounted=useRef(true),cameraAPI=useRef(null),imageInput=useRef(null),dncCache=useRef(new Map());
  const shelfAPI=useRef();
  const endCurrentStroke=useRef(null);endCurrentStroke.current=()=>{endStroke();commitPlacement();};
  const toolCommand=useRef(null);toolCommand.current=chooseTool;
  const baseModel=useMemo(()=>paintProjectModel(model,project,originalModel),[model,originalModel,revision,project,project?.uvRevision,project?.materialRevision]);
  const catalog=useMemo(()=>enumeratePaintTargets(baseModel),[baseModel,revision]),allGeosets=useMemo(()=>new Set(baseModel.Geosets.map((_,i)=>i)),[baseModel]);
  const freshMapping=project?!!project.paintAtlasVersion:sourceMode==='primer';
  const paintable=useMemo(()=>new Set(paintableGeosets(originalModel,{requireUV:!freshMapping})),[originalModel,freshMapping]);
  const standHidden=useMemo(()=>paintStandHidden(originalModel),[originalModel]);
  const hiddenGeosets=useMemo(()=>new Set([...allGeosets].filter(i=>(isolate&&i!==activeGeoset)||(!showHelpers&&(!paintable.has(i)||(standHidden.has(i)&&i!==activeGeoset))))),[isolate,showHelpers,allGeosets,activeGeoset,paintable,standHidden]);
  const viewModel=showOriginal?originalModel:baseModel;
  const displayModel=useMemo(()=>isolate?isolatePaintRegion(viewModel,region):viewModel,[viewModel,isolate,region]);
  // Navigation belongs to the shared editor preferences, including MDLVis's
  // middle-click Rotation/Work toggle. Citadel never reverses those bindings.
  const viewportPreferences=useMemo(()=>({...preferences,graphics:{...preferences?.graphics,...(lowPower?{pixelRatio:1,antialias:false}:{})}}),[preferences,lowPower]);
  const navigation=cameraBindings(preferences),navigationHint=`Right-drag: ${navigation.right} · ${navigation.middle==='toggle'?'Middle-click: rotation / work':'Middle-drag: '+navigation.middle} · Wheel: zoom`;
  const paintAppearance=useMemo(()=>normalizePaintAppearance(preferences?.citadelPaint),[preferences?.citadelPaint]);
  const activeTarget=project?paintProjectTarget(project):null,activeCoat=project?paintProjectCoat(project):null;
  const coordId=activeTarget?.bindings.find(b=>b.geosetIndex===activeGeoset)?.coordId||0;
  const materialRaster=material?.raster||null,geosetReady=!!project&&activeTarget?.geosetIndices.includes(activeGeoset)&&!busy&&!readOnly&&!showOriginal;
  const ready=!!project&&(targetMode==='free'?project.targets.some(target=>target.bindings?.length):geosetReady)&&!busy&&!readOnly&&!showOriginal;
  const imageZoom=hover.current?.brush?.zoom??stroke.current?.brush.zoom??brush.zoom;
  const decal=useMemo(()=>material?.exactStamp&&brush.materialId&&brush.mode!=='erase'?{...paintDecalTransform(material.raster,{...brush,zoom:imageZoom}),angle:stampAngle,flipX:stampFlip,url:material.preview}:null,[material,brush.materialId,brush.mode,brush.size,imageZoom,brush.opacity,brush.strength,stampAngle,stampFlip]);
  const footprint=useMemo(()=>paintBrushPreview(brush,null,brush.materialId&&brush.mode!=='erase'?materialRaster:null,paintAppearance.brushCursor),[brush.id,brush.size,brush.materialId,brush.zoom,materialRaster,paintAppearance.brushCursor]);
  const flatProjection=useMemo(()=>activeTarget?prepareTexturePaintProjection(activeTarget.base.width,activeTarget.base.height):null,[activeTarget?.base.width,activeTarget?.base.height]);
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
  function refreshTarget(target,rows=null){const cached=canvasCache.current.get(target.id);if(cached?.target===target){updatePaintPreview(cached,rows);cached.canvas=paintRasterCanvas(cached.raster,cached.canvas,rows?paintRowsBounds(rows,target.base.width,target.base.height):null);}else dirtyTargets.current.set(target.id,null);setPaintRevision(n=>n+1);}
  function updateScene(next){if(scene.lamps.length&&!next.lamps.length&&next.lighting==='lamps')next={...next,lighting:'flat'};if(!Array.isArray(next.lamps)||next.lamps.length>4||next.lamps.some(l=>![...(l.position||[]),...(l.target||[])].every(Number.isFinite)||l.position?.length!==3||l.target?.length!==3)){onStatus?.('Enter valid lamp coordinates.',true);return;}setScene(next);if(project){project.viewSettings=next;project.dirty=true;project.revision++;onProjectChange?.(project);}}
  useEffect(()=>setOutline(v=>({...v,color:paintAppearance.geosetBorder,thickness:paintAppearance.borderThickness})),[paintAppearance.geosetBorder,paintAppearance.borderThickness]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancelAnimationFrame(frame.current);cancelAnimationFrame(hoverFrame.current);};},[]);
  useEffect(()=>{projectionCache.current=null;smartMaskCache.current=null;setMaterial(null);setCutoutSource(null);setSaveSource(null);setTargetMode('free');setBrush(value=>({...value,materialId:null,filterColor:'#ffffff'}));},[project?.id]);
  useEffect(()=>{const flush=()=>endCurrentStroke.current?.();window.addEventListener('mdlxl-paint-flush',flush);window.addEventListener('beforeunload',flush,true);return()=>{window.removeEventListener('mdlxl-paint-flush',flush);window.removeEventListener('beforeunload',flush,true);};},[]);
  function chooseTool(tool){if(!project||busy||readOnly)return;chooseStudioTool(tool==='select'?'select':'paint');}
  useEffect(()=>{projectionCache.current=null;smartMaskCache.current=null;},[baseModel,project?.activeTargetId,region]);
  useEffect(()=>{clearHover(true);if(placement.current)renderHover(placement.current.hit);},[brush,material,borrowMode,stampAngle,stampFlip,activeGeoset,project?.activeTargetId,project?.activeCoatId,project?.revision,targetMode,dialog,showOriginal,pickPart,region,textureRegion,regionTool]);
  useEffect(()=>{const target=project&&paintProjectTarget(project);if(textureRegion&&(textureRegion.targetId!==target?.id||textureRegion.width!==target?.base.width||textureRegion.height!==target?.base.height))setTextureRegion(null);},[project,project?.activeTargetId,project?.revision,textureRegion]);
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
      result.set(target.textureId,hover.current?.entries.get(target.id)||entry);
    }
    return result;
  },[project,project?.revision,paintRevision]);
  async function initializeTarget(value,next){
    const existing=paintProjectTarget(next,value.id);if(existing)return existing;
    let asset=findTextureAsset(textureAssets,value.texturePath);
    if(next.sourceMode==='current'&&!asset?.bytes&&window.desktop?.resolveTextures){const resolved=await window.desktop.resolveTextures({names:[value.texturePath],path:modelPath});const found=resolved.find(item=>item?.bytes);if(found)asset={...found,source:'gameData'};}
    if(next.sourceMode==='current'&&!asset?.bytes)throw Error('The existing skin '+value.texturePath+' is not loaded. Connect its Warcraft data or import that texture first.');
    let base=await paintBaseRaster(asset,next.resolution,next.sourceMode);
    // SD skins have very small allocations for broad geometry. Start with a
    // larger pixel canvas while retaining the complete authored arrangement.
    // Hidden corpse textures keep their native size until explicitly resized.
    const visible=value.geosetIndices.some(index=>!standHidden.has(index)||index===activeGeoset),longest=Math.max(base.width,base.height);
    if(next.sourceMode==='current'&&visible&&resolution>longest)base=resizePaintRaster(base,Math.round(base.width*resolution/longest),Math.round(base.height*resolution/longest));
    return addPaintProjectTarget(next,{...value,nativeSource:['gameData','library'].includes(asset?.source)},base);
  }
  async function begin(){
    if(busy||readOnly)return;setBusy(true);
    try{
      const next=createPaintProject({modelName,resolution:resolution||256,sourceMode});next.preserveMaterials=sourceMode==='current';next.viewSettings=scene;next.dirty=true;let working=model;
      if(sourceMode==='primer'){
        const geosets=paintableGeosets(originalModel,{requireUV:false});if(!geosets.length)throw Error(msg('paint.empty'));
        const atlas=createFreshPaintAtlas(model,geosets,resolution);working=atlas.model;next.generatedUVSets=atlas.coordIds;next.paintAtlasVersion=1;
        createPaintMaterial(next,working,{name:'Material 1',raster:createPaintRaster(resolution,resolution,rgbaColor(brush.color)),geosets,basecoat:true,generatedUV:true,sourceModel:originalModel});
        onWorkingModelChange?.(working);
      }else{
        for(const descriptor of catalog){const asset=findTextureAsset(textureAssets,descriptor.texturePath);await initializeTarget({...descriptor,nativeSource:['gameData','library'].includes(asset?.source)},next);}
        if(!next.targets.length)throw Error(msg('paint.empty'));enablePaintMaterials(next,model);
      }
      repairPaintMaterials(next,originalModel,working);const selected=next.targets.find(t=>t.geosetIndices.includes(activeGeoset))||next.targets[0];next.activeTargetId=selected.id;
      if(!mounted.current)return;onGeosetChange?.(selected.geosetIndices.includes(activeGeoset)?activeGeoset:selected.geosetIndices[0]);onProjectChange?.(next);setPaintRevision(n=>n+1);onStatus?.('Ready. Paint on the model, or choose an image from the shelf.');
    }catch(e){onStatus?.(e.message,true);}finally{if(mounted.current)setBusy(false);}
  }
  async function selectGeoset(index){
    if(!project||busy||readOnly)return;endStroke();setSelectedLamp(null);
    const selected=project.targets.find(t=>t.geosetIndices.includes(index));
    if(selected)project.activeTargetId=selected.id;
    onGeosetChange?.(index);notify();
  }
  function selectMaterial(id){if(busy||readOnly)return;endStroke();const target=project.targets.find(item=>item.id===id);if(!target)return;project.activeTargetId=id;setSelectedLamp(null);if(target.geosetIndices.length&&!target.geosetIndices.includes(activeGeoset))onGeosetChange?.(target.geosetIndices[0]);notify();}
  function changeLamp(id,change){updateScene({...scene,lamps:scene.lamps.map(lamp=>lamp.id===id?{...lamp,...change}:lamp)});}
  function paintScope(target,scope){return regionPaintTarget(target,region,scope);}
  function projectionFor(hit,target,geosetIndex=null){
    if(hit.textureView)return flatProjection;
    const scoped=paintScope(target,geosetIndex),pose=hit.viewport.width+':'+hit.viewport.height+':'+hit.viewProjectionMatrix.join(','),key=target.id+':'+(geosetIndex??'free')+':'+[...hiddenGeosets]+':'+(region?[...region.faces]:'');
    let cache=projectionCache.current;
    if(!cache||cache.pose!==pose||cache.model!==displayModel||cache.revision!==revision)projectionCache.current=cache={pose,model:displayModel,revision,entries:new Map()};
    if(!cache.entries.has(key))cache.entries.set(key,preparePaintProjection(displayModel,scoped,hit.viewProjectionMatrix,hit.viewport.width,hit.viewport.height,384,hiddenGeosets));
    return cache.entries.get(key);
  }
  function brushOptions(target,scope,texture=false){
    let mask=null;
    if(brush.mode==='wash'||brush.mode==='drybrush'||region||texture&&scope!=null){
      const key=target.id+':'+(scope??'free')+':'+target.base.width+'x'+target.base.height+':'+(region?[...region.faces]:'');let cache=smartMaskCache.current;if(!(cache instanceof Map))smartMaskCache.current=cache=new Map();let cached=cache.get(key);
      if(!cached||cached.model!==baseModel){const paintTarget=paintScope(target,scope);cached={model:baseModel,masks:buildSmartPaintMasks(baseModel,paintTarget,target.base.width,target.base.height),region:paintGeosetMask(baseModel,paintTarget,target.base.width,target.base.height)};cache.set(key,cached);if(cache.size>16)cache.delete(cache.keys().next().value);}
      mask=cached.masks[brush.mode]||null;
      if(region||texture&&scope!=null)mask=mask?Uint8Array.from(mask,(value,i)=>Math.round(value*cached.region[i]/255)):cached.region;
    }
    if(textureRegion?.targetId===target.id)mask=mask?Uint8Array.from(mask,(v,i)=>Math.round(v*textureRegion.data[i]/255)):textureRegion.data;
    return {flags:texture?0:target.flags,mask,sourceOrigin:{x:0,y:0},materialRaster:brush.materialId&&brush.mode!=='erase'?materialRaster:null,decalRaster:material?.exactStamp&&brush.materialId&&brush.mode!=='erase'?materialRaster:null};
  }
  function strokeParts(hit,preview=false){
    const scope=targetMode==='geoset'?activeGeoset:null;
    // Free painting chooses one image layer for each part. Additional authored
    // layers are retained and can be selected explicitly as the destination.
    const choices=new Map();
    for(const target of project.targets)for(const binding of target.bindings){const prior=choices.get(binding.geosetIndex);if(!prior||target===activeTarget||prior.target!==activeTarget&&binding.layerIndex<prior.binding.layerIndex)choices.set(binding.geosetIndex,{target,binding});}
    const targets=hit.textureView||targetMode==='geoset'?[activeTarget]:project.targets;
    return targets.filter(target=>target&&(!textureRegion||textureRegion.targetId===target.id)).map(target=>{
      const coat=paintProjectCoat(project,target.id,project.activeCoatId);if(!coat||coat.visible===false)return null;
      const scoped=scope==null?{...target,bindings:target.bindings.filter(b=>choices.get(b.geosetIndex)?.binding===b)}:target;
      if(!paintScope(scoped,scope).bindings.length)return null;
      const before=clonePaintRaster(coat.raster),editable=preview?{...coat,raster:clonePaintRaster(before)}:coat;
      return {target,coat:editable,coatId:coat.id,before,projection:projectionFor(hit,scoped,scope),options:{...brushOptions(scoped,scope,hit.textureView),reference:compositePaintTarget(project,target.id)},blend:{},changed:0};
    }).filter(Boolean);
  }
  function applyPoint(part,point,settings,dragging=false){
    if(studioTool==='blend'){
      const changed=blendProjectedPaint(part.coat.raster,part.projection,point,settings,part.options,part.blend);
      compositePaintRasters(part.target.base,part.target.coats,{alphaMask:part.target.alphaMask,preserveSourceAlpha:part.target.preserveSourceAlpha??true,output:part.options.reference,rows:part.options.dirtyRows});return changed;
    }
    return part.options.decalRaster?projectPaintDecal(part.coat.raster,part.projection,part.options.decalRaster,point,{...paintDecalTransform(part.options.decalRaster,settings),angle:stampAngle,flipX:stampFlip},{...part.options,borrowMode,mode:settings.mode,filterColor:settings.filterColor}):stampProjectedBrush(part.coat.raster,part.projection,point,settings,{...part.options,dragging});
  }
  function clearHover(force=false){
    if(placement.current&&!force)return;
    cancelAnimationFrame(hoverFrame.current);hoverFrame.current=0;hoverHit.current=null;
    if(hover.current){hover.current=null;if(mounted.current)setPaintRevision(n=>n+1);}
  }
  function previewHover(hit){
    if(placement.current)return;
    if(!hit||!ready||pickPart||regionTool||stroke.current||dialog||!brush.materialId){clearHover();return;}
    if(targetMode==='geoset'&&!hit.textureView&&hit.geosetIndex!==activeGeoset){clearHover();return;}
    hoverHit.current=hit;if(hoverFrame.current)return;
    hoverFrame.current=requestAnimationFrame(()=>{
      hoverFrame.current=0;const value=hoverHit.current;if(!value)return;renderHover(value);
    });
  }
  function renderHover(value){
      const key=value.textureView?'texture':value.viewProjectionMatrix.join(',')+':'+value.viewport.width+':'+value.viewport.height;
      if(!hover.current||hover.current.key!==key){
        const parts=strokeParts(value,true),entries=new Map();
        for(const part of parts){const target={...part.target,coats:part.target.coats.map(c=>c.id===part.coatId?part.coat:c),alphaMask:part.coatId==='__alpha'?part.coat.raster:part.target.alphaMask},entry=createPaintPreview(target);updatePaintPreview(entry);entry.canvas=paintRasterCanvas(entry.raster);entries.set(target.id,entry);}
        hover.current={key,parts,entries};
      }
      hover.current.brush=brush;
      for(const part of hover.current.parts){
        part.coat.raster.data.set(part.before.data);const rows=createPaintDirtyRows(part.target.base.width,part.target.base.height);part.options.dirtyRows=rows;applyPoint(part,value.screen,hover.current.brush);
        const currentRows=rows.slice();if(part.rows)mergePaintRows(rows,part.rows);part.rows=currentRows;
        const entry=hover.current.entries.get(part.target.id);updatePaintPreview(entry,rows);entry.canvas=paintRasterCanvas(entry.raster,entry.canvas,paintRowsBounds(rows,part.target.base.width,part.target.base.height));
      }
      setPaintRevision(n=>n+1);
  }
  function cancelPlacement(){placement.current=null;setPlacing(false);clearHover(true);}
  function commitPlacement(){
    if(!placement.current||!project)return;
    cancelAnimationFrame(hoverFrame.current);hoverFrame.current=0;renderHover(placement.current.hit);
    const parts=hover.current?.parts||[];
    for(const part of parts)paintProjectCoat(project,part.target.id,part.coatId).raster.data.set(part.coat.raster.data);
    if(recordPaintStrokeGroup(project,parts.map(part=>({targetId:part.target.id,coatId:part.coatId,before:part.before})),'Place '+(material?.name||'image'),brush)){
      for(const part of parts){markPaintMaterialEdited(project,part.target);refreshTarget(part.target);}notify();
    }
    cancelPlacement();
  }
  function chooseStudioTool(tool){
    endStroke();cancelPlacement();cameraProps.onWorkMode?.();setStudioTool(tool);setPickPart(tool==='select');setRegionTool(tool==='select');setShowOriginal(false);
    setBrush(value=>({...value,mode:tool==='erase'?'erase':'paint',materialId:tool==='stamp'?material?.id||null:null}));
  }
  function studioHistory(redo=false){endStroke();cancelPlacement();if(travelPaintHistory(project,redo))notify();}
  function studioPick(hit){
    if(selectionKind==='geoset'){setRegion(null);setTargetMode('geoset');selectGeoset(hit.geosetIndex);return;}
    if(selectionKind==='piece'){setRegion({geosetIndex:hit.geosetIndex,faces:connectedPaintFaces(baseModel.Geosets[hit.geosetIndex],hit.triangle),seed:hit.triangle});setTargetMode('geoset');selectGeoset(hit.geosetIndex);return;}
    pick(hit);setTargetMode('geoset');
  }
  function startStroke(hit){
    if(!ready)return;if(targetMode==='geoset'&&!hit.textureView&&hit.geosetIndex!==activeGeoset){onStatus?.(msg('paint.locked'));return;}
    if(studioTool==='sample'){
      const target=hit.textureView?activeTarget:project.targets.find(t=>t.bindings.some(b=>b.geosetIndex===hit.geosetIndex)),raster=target&&compositePaintTarget(project,target.id);
      if(raster){const x=hit.textureView?hit.screen.x:hit.uv[0]*raster.width,y=hit.textureView?hit.screen.y:hit.uv[1]*raster.height,offset=(Math.max(0,Math.min(raster.height-1,Math.floor(y)))*raster.width+Math.max(0,Math.min(raster.width-1,Math.floor(x))))*4,color='#'+[...raster.data.slice(offset,offset+3)].map(v=>v.toString(16).padStart(2,'0')).join('');chooseStudioTool('paint');setBrush(v=>({...v,color}));}return;
    }
    if(studioTool==='stamp'){
      if(!material){onStatus?.('Choose a texture from the shelf first.');return;}
      clearHover(true);placement.current={hit};setPlacing(true);renderHover(hit);return;
    }
    clearHover();const parts=strokeParts(hit);
    if(!parts.length){onStatus?.(region?'Choose a face inside the paint region.':msg('paint.hiddenCoat'));return;}
    if(!hit.textureView&&hit.geosetIndex!==activeGeoset){const target=parts.find(p=>p.target.bindings.some(b=>b.geosetIndex===hit.geosetIndex))?.target;if(target)project.activeTargetId=target.id;onGeosetChange?.(hit.geosetIndex);}
    onInteractionChange?.(true);stroke.current={parts,last:null,lastStamp:null,pending:[],settings:brush,brush:brush};moveStroke(hit);
  }
  function flushStroke(){
    frame.current=0;const current=stroke.current;if(!current)return;
    const detail=!!current.parts[0]?.options.decalRaster;
    for(const part of current.parts){part.rows=createPaintDirtyRows(part.target.base.width,part.target.base.height);part.options.dirtyRows=part.rows;}
    if(detail&&current.pending.length){
      const hit=current.pending.at(-1),point=hit.screen;current.brush=current.settings;
      for(const part of current.parts){part.coat.raster.data.set(part.before.data);part.changed=applyPoint(part,point,current.brush);refreshTarget(part.target);}
      current.last=point;
    }else for(const hit of current.pending){
      const next=hit.screen;current.brush=current.settings;
      if(current.last&&next.x===current.last.x&&next.y===current.last.y)continue;
      for(const point of interpolatePaintStroke(current.last,next,current.brush)){for(const part of current.parts)part.changed+=applyPoint(part,point,current.brush,!!current.lastStamp);current.lastStamp=point;}current.last=next;
    }
    current.pending=[];for(const part of current.parts)if(part.changed){if(!detail)refreshTarget(part.target,part.rows);part.changed=0;}
  }
  function moveStroke(hit){if(placement.current){placement.current.hit={...placement.current.hit,screen:hit.screen};hoverHit.current=placement.current.hit;if(!hoverFrame.current)hoverFrame.current=requestAnimationFrame(()=>{hoverFrame.current=0;if(placement.current)renderHover(placement.current.hit);});return;}const current=stroke.current;if(!current)return;current.pending.push(hit);if(!frame.current)frame.current=requestAnimationFrame(flushStroke);}
  function endStroke(){if(placement.current)return;clearHover();onInteractionChange?.(false);cancelAnimationFrame(frame.current);flushStroke();const current=stroke.current;stroke.current=null;if(current&&project){
    const revisions=new Map(current.parts.map(part=>[part.target.id,part.target.revision]));if(recordPaintStrokeGroup(project,current.parts.map(part=>({targetId:part.target.id,coatId:part.coatId,before:part.before})),current.brush.name+' stroke',current.brush)){for(const part of current.parts){if(revisions.get(part.target.id)!==part.target.revision)markPaintMaterialEdited(project,part.target);const cached=canvasCache.current.get(part.target.id);if(cached)cached.version=part.target.revision;}notify();}}}
  function cancelStroke(){cancelPlacement();clearHover();onInteractionChange?.(false);cancelAnimationFrame(frame.current);frame.current=0;const current=stroke.current;stroke.current=null;if(!current)return;for(const part of current.parts){if(part.coatId==='__alpha')part.target.alphaMask=part.before;else part.coat.raster=part.before;refreshTarget(part.target);}}
  async function prepareSurface(){
    endStroke();setBusy(true);
    try{await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));const staged=preparePaintSurfaceChange(baseModel,project,activeTarget,{resolution:surfaceSize,unique:false});markPaintMaterialEdited({...project,targets:project.targets.map(t=>t===activeTarget?staged.target:t)},staged.target);recordPaintSurfaceChange(project,activeTarget.id,staged,'Resize paint destination');setRegion(null);setTextureRegion(null);setRegionTool(false);setDialog(null);notify();onStatus?.('Texture resized. Undo restores its original resolution.');}
    catch(e){onStatus?.(e.message,true);}finally{setBusy(false);}
  }
  function separateSelection(){
    endStroke();cancelPlacement();
    try{
      const selected=region||{geosetIndex:activeGeoset,faces:new Set(Array.from({length:baseModel.Geosets[activeGeoset].Faces.length/3},(_,i)=>i))},staged=preparePaintSelectionSpace(baseModel,project,activeTarget,selected);
      markPaintMaterialEdited({...project,targets:project.targets.map(t=>t===activeTarget?staged.target:t)},staged.target);
      recordPaintSurfaceChange(project,activeTarget.id,staged,'Make selection independent');notify();onStatus?.('Selection has its own paint pixels. The skin layout and geosets stay together. Undo restores shared painting.');
    }catch(e){onStatus?.(e.message,true);}
  }
  function chooseMaterial(source){endStroke();cancelPlacement();cameraProps.onWorkMode?.();const id=crypto.randomUUID(),preview=paintRasterCanvas(source.raster).toDataURL();setMaterial({...source,exactStamp:true,id,thumbnail:preview,preview});setStudioTool('stamp');setPickPart(false);setRegionTool(false);setStampAngle(0);setStampFlip(false);setBrush(value=>normalizeBrushSettings({...value,id:'normal',size:Math.max(80,Math.min(220,Math.max(source.raster.width,source.raster.height))),zoom:1,opacity:1,strength:1,materialId:id,filterColor:'#ffffff',tipId:null}));onStatus?.('Click the model to place a preview. Adjust it, then Apply stamp.');}
  function useCutout(source){
    chooseMaterial({...cutoutSource,...source});setShowOriginal(false);setDialog(null);
  }
  function pick(hit){
    if(regionTool){setRegion(value=>{const faces=new Set(value?.geosetIndex===hit.geosetIndex?value.faces:[]);if(hit.subtract)faces.delete(hit.triangle);else faces.add(hit.triangle);return {geosetIndex:hit.geosetIndex,faces,seed:hit.triangle};});if(activeGeoset!==hit.geosetIndex)selectGeoset(hit.geosetIndex);return;}
    if(lampAction){const {id,action}=lampAction,pose=cameraAPI.current?.(),position=hit.worldPosition.map((v,i)=>v+hit.normal[i]*(pose?.radius||100)*.5);
      updateScene({...scene,lamps:scene.lamps.map(lamp=>lamp.id===id?{...lamp,...(action==='place'?{position,target:hit.worldPosition}:{target:hit.worldPosition})}:lamp)});setLampAction(null);return;}
    selectGeoset(hit.geosetIndex);
  }
  function fillGeoset(){
    if(!geosetReady||!activeCoat)return;endStroke();const layer=brush.mode==='erase'?paintProjectCoat(project,activeTarget.id,'__alpha'):activeCoat;
    if(layer.visible===false){onStatus?.(msg('paint.hiddenCoat'));return;}
    const before=clonePaintRaster(layer.raster),mask=paintGeosetMask(displayModel,paintScope(activeTarget,activeGeoset),activeTarget.base.width,activeTarget.base.height),options=brushOptions(activeTarget,activeGeoset);
    fillPaintMask(layer.raster,mask,brush,options);
    if(recordPaintStroke(project,activeTarget.id,layer.id,before,msg('paint.fillPart'),brush)){markPaintMaterialEdited(project,activeTarget);notify();onStatus?.(msg('paint.filled',{number:activeGeoset+1}));}
  }
  function mutateCoat(change){if(!ready||!activeCoat)return;const target=paintProjectTarget(project),coat=paintProjectCoat(project);change(coat);target.revision=(target.revision||0)+1;project.dirty=true;project.revision++;notify();}
  function editUV(next){if(!geosetReady)return;endStroke();const key=activeGeoset+':'+coordId,before=baseModel.Geosets[activeGeoset].TVertices[coordId];if(recordPaintUV(project,key,before,next))notify();}
  async function importFile(file){try{const raster=await decodePaintImage(new Uint8Array(await file.arrayBuffer()),file.name);setCutoutSource({name:file.name,raster});setDialog('cutout');}catch(e){onStatus?.(e.message,true);}}
  function saveTexture(source){setSaveSource(source);setDialog('saveTexture');}
  const activeCanvas=activeTarget?textureOverrides.get(activeTarget.textureId)?.canvas:null;
  const textureName=activeTarget?.paintName??activeTarget?.label??'';
  shelfAPI.current={onUse:chooseMaterial,onCut:source=>{setCutoutSource(source);setDialog('cutout');},onNative:()=>{setDialog('native');},onImport:()=>{imageInput.current.click();},onStatus};
  const shelfCallbacks=useMemo(()=>Object.fromEntries(['onUse','onCut','onNative','onImport','onStatus'].map(key=>[key,(...args)=>shelfAPI.current[key]?.(...args)])),[]);
  const viewport=<PaintViewport {...cameraProps} key="paint-viewport" model={displayModel} revision={revision} selectedGeoset={activeGeoset} selectedVertices={emptyVertices} selectableGeosets={allGeosets} selectionByGeoset={emptySelection} hiddenVertices={emptySelection} hiddenGeosets={hiddenGeosets} mode="textured" overlays={emptyOverlays} showVertices={false} showSkeleton={false} showGrid={false} showAxes={false} shaded view={view} cameraMode={cameraMode} workplane="xy" transformMode="select" sequenceIndex={-1} time={0} playing={false} teamColor={teamColor} textureAssets={textureAssets} preferences={viewportPreferences} paintWorkspace paintMode={!!project} paintSelectOnly={studioTool==='select'} paintRegion={studioTool==='select'?region:null} paintDisabled={!ready} paintOutline={{...outline,visible:outline.visible&&targetMode==='geoset'}} paintBrushSize={brush.size} paintBrushPreview={footprint} paintDecal={decal} paintLights={lights} paintLampPickingDisabled={!!lampAction||regionTool} onPaintInteractionChange={onInteractionChange} paintSelectedLamp={selectedLamp} paintLampTransform={lampTransform} paintLampColor={paintAppearance.lampSelection} onPaintLampSelect={id=>{setSelectedLamp(id);if(id)setPickPart(true);}} onPaintLampChange={changeLamp} paintBackground={background} paintTextureOverrides={showOriginal?noOverrides:textureOverrides} paintTextureSmoothing={scene.textureSmoothing} paintTextureRevision={paintRevision+Number(project?.revision||0)} onPaintCameraReady={api=>{cameraAPI.current=api;}} onPaintPick={studioPick} paintSelectFaces={selectionKind==='faces'} onPaintStart={startStroke} onPaintMove={moveStroke} onPaintEnd={endStroke} onPaintCancel={cancelStroke} onPaintHover={previewHover} onPaintCameraChange={()=>clearHover()}/>;
  return <PaintStudioLayout project={project} tool={studioTool} onTool={chooseStudioTool} brush={brush} onBrush={patch=>setBrush(v=>({...v,...patch}))} material={material} borrowMode={borrowMode} onBorrowMode={setBorrowMode} stampAngle={stampAngle} onStampAngle={setStampAngle} stampFlip={stampFlip} onFlip={()=>setStampFlip(v=>!v)} placing={placing} onCommit={commitPlacement} onCancel={cancelStroke}
    style={{'--paint-tip':APPLICATION_THEMES[preferences?.theme]?.scheme!=='dark'?paintAppearance.brushTipLight:paintAppearance.brushTipDark,'--paint-selection':paintAppearance.geosetSelection}}
    disabled={busy||readOnly} busy={busy} dialog={dialog} viewport={viewport} original={showOriginal} onOriginal={()=>{endStroke();cancelPlacement();setShowOriginal(v=>!v);}} onFrame={()=>window.dispatchEvent(new CustomEvent('mdlvis-frame'))} navigationHint={navigationHint}
    sourceMode={sourceMode} onSourceMode={value=>{setSourceMode(value);if(value==='primer'&&!resolution)setResolution(512);}} resolution={resolution} onResolution={setResolution} onBegin={begin} onOpen={onOpenProject} split={split} onSplit={value=>{cancelPlacement();setSplit(Math.max(30,Math.min(78,value)));}}
    region={region} textureRegion={textureRegion} targetMode={targetMode} activeGeoset={activeGeoset} selectionKind={selectionKind} onSelectionKind={setSelectionKind} isolate={isolate} onIsolate={setIsolate} onClearSelection={()=>{cancelPlacement();setRegion(null);setTextureRegion(null);setTargetMode('free');setIsolate(false);}} onFill={fillGeoset} onSeparate={separateSelection} onTextureMask={()=>setDialog('region')}
    onCrop={()=>{cancelPlacement();setCutoutSource(material);setDialog('cutout');}} onSaveSource={()=>saveTexture({...material,shelfOnly:true})} onSurface={()=>{cancelPlacement();setDialog('surface');}}
    coat={activeCoat} coats={PAINT_COATS} onCoat={id=>{cancelPlacement();endStroke();project.activeCoatId=id;notify();}} onCoatVisible={visible=>mutateCoat(c=>{c.visible=visible;})} onTarget={id=>{cancelPlacement();selectMaterial(id);}}
    textureName={textureName} width={activeTarget?.base.width} height={activeTarget?.base.height} onHistory={studioHistory} onNew={()=>{endStroke();cancelPlacement();setDialog('new');}} onSave={()=>{endStroke();commitPlacement();onSaveProject?.(project);}} onExport={()=>{endStroke();commitPlacement();onExport?.(project);}} onDone={()=>{endStroke();commitPlacement();onExit?.();}}
    shelf={<PaintTextureShelf key={project?.id} epoch={shelfEpoch} {...shelfCallbacks} onFolderChange={setFolders}/>}
    texture={project&&activeCanvas&&<PaintTextureCanvas title={textureName+' · '+activeTarget.base.width+' × '+activeTarget.base.height} onHover={previewHover} regionMask={textureRegion?.targetId===activeTarget.id?textureRegion.data:null} version={textureOverrides.get(activeTarget.textureId)?.revision} canvas={activeCanvas} geoset={baseModel.Geosets[activeGeoset]} coordId={coordId} brush={brush} brushPreview={footprint} decal={decal} textureSmoothing={scene.textureSmoothing} disabled={!geosetReady||studioTool==='select'} onStart={startStroke} onMove={moveStroke} onEnd={endStroke} onCancel={cancelStroke} onUVChange={editUV} onGrab={()=>{cancelPlacement();setCutoutSource({name:textureName,raster:compositePaintTarget(project)});setDialog('cutout');}} />}
  >
    <input hidden ref={imageInput} type="file" accept=".blp,.dds,.tga,.png,.jpg,.jpeg,.webp" onChange={async e=>{const file=e.target.files[0];if(file)await importFile(file);e.target.value='';}}/>
    {dialog==='surface'&&<div className="paint-modal-shade"><section className="paint-save-dialog" role="dialog" aria-modal="true" aria-label="Resize texture"><header><strong>Resize texture</strong><button disabled={busy} onClick={()=>setDialog(null)}>Close</button></header><p>{textureName} · {activeTarget.base.width} × {activeTarget.base.height}</p><label>Longest side<select value={surfaceSize} onChange={e=>setSurfaceSize(+e.target.value)}>{[256,512,1024,2048].map(size=><option key={size} value={size}>{size} px</option>)}</select></label><p>Keeps the current layout. More pixels allow finer new brushwork; your existing artwork stays intact.</p><p>This changes the working copy and can be undone.</p><button disabled={busy} onClick={prepareSurface}>{busy?'Resizing…':'Resize'}</button></section></div>}
    {dialog==='native'&&<Suspense fallback={<div className="paint-modal-shade">{msg('paint.loading')}</div>}><NativeTextureLibrary model={model} modelPath={modelPath} onClose={()=>setDialog(null)} selectLabel={msg('paint.crop')} onSelectTexture={async asset=>{try{const source={name:asset.name,sourcePath:asset.name,nativeSource:true,raster:await decodePaintImage(asset.bytes,asset.name)};setCutoutSource(source);setDialog('cutout');}catch(e){onStatus?.(e.message,true);}}}/></Suspense>}
    {dialog==='region'&&activeTarget&&<PaintCutoutEditor source={{name:textureName,raster:compositePaintTarget(project)}} initialMask={textureRegion?.data} onClose={()=>setDialog(null)} onMask={data=>{setTextureRegion({targetId:activeTarget.id,width:activeTarget.base.width,height:activeTarget.base.height,data});setRegionTool(false);setPickPart(false);setDialog(null);}}/>}
    {dialog==='cutout'&&cutoutSource&&<PaintCutoutEditor source={cutoutSource} onClose={()=>setDialog(null)} onUse={useCutout} onSave={source=>saveTexture({...source,shelfOnly:true})}/>}
    {dialog==='saveTexture'&&saveSource&&<PaintSaveTexture source={saveSource} folders={folders} onClose={()=>setDialog(null)} onSaved={async saved=>{setShelfEpoch(v=>v+1);onStatus?.(msg('paint.textureSaved'));}}/>}
    {dialog==='scene'&&<PaintSceneOptions selectedLampId={selectedLamp} onSelectedLamp={id=>{setSelectedLamp(id);setPickPart(true);setTextureView(false);}} value={scene} onChange={updateScene} backgrounds={backgrounds} onClose={()=>setDialog(null)} onCamera={()=>cameraAPI.current?.()} onMove={id=>{setSelectedLamp(id);setPickPart(true);setTextureView(false);setLampTransform('move');setLampAction(null);}} onPlace={id=>{setTextureView(false);setLampAction({id,action:'place'});}} dncStatus={dncStatus} onDncFile={async file=>{try{const dncModel=readWarcraftDnc(new Uint8Array(await file.arrayBuffer()),file.name);updateScene({...scene,dncModel,environment:'custom',lighting:'dnc'});}catch(e){setDncStatus(e.message);}}}/>}
    {dialog==='new'&&<div className="paint-modal-shade"><section className="paint-save-dialog" role="dialog" aria-modal="true" aria-label={msg('paint.newPreset')}><h3>{msg('paint.newPreset')}</h3><p>{msg('paint.newPresetHelp')}</p><footer><button onClick={async()=>{endStroke();if(!project.dirty||await onSaveProject?.(project)){setDialog(null);onProjectChange?.(null);}}}>{msg('paint.saveAndNew')}</button><button onClick={()=>{setDialog(null);onProjectChange?.(null);}}>{msg('paint.discardAndNew')}</button><button onClick={()=>setDialog(null)}>{msg('paint.cancel')}</button></footer></section></div>}
  </PaintStudioLayout>;
}
