import ParticleTestView from './ParticleTestView.jsx';
import ParticleExampleComparison from './ParticleExampleComparison.jsx';
import {activeParticleSample} from '../src/particle-sampling.js';
import {encodeForgeTga} from '../src/forge.js';
import {particlePictureCanvas} from './particle-picture-canvas.js';
import {includeParticleAssets,embeddedParticleAssets,MAX_PARTICLE_PICTURE_BYTES} from '../src/particle-assets.js';
import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {EditorDocument,createNode,deleteNode} from '../src/editor-document.js';
import {particleRecipeDocument,extractParticleRecipe,placeParticleRecipe,effectNodes} from '../src/particle-recipes.js';
import {createStarterRecipe,starterTextureAsset,STARTER_TEXTURE,PARTICLE_STARTERS} from '../src/particle-starters.js';
import {parseParticleData,stringifyParticleData} from '../src/particle-data.js';
import {createParticleGesture} from '../src/particle-bindings.js';
import ParticleClassicControls from './ParticleClassicControls.jsx';
import ParticleCluelessControls from './ParticleCluelessControls.jsx';
import ParticleRibbonControls from './ParticleRibbonControls.jsx';
import {ParticleSweepControls,ParticleSweepOverlay} from './ParticleSweepTools.jsx';
import ParticlePlacementStage from './ParticlePlacementStage.jsx';
import {addParticleDemonstration,setParticleEmissionWindow} from '../src/particle-sweep.js';
import ParticleStageTools from './ParticleStageTools.jsx';
import ParticleLibrary from './ParticleLibrary.jsx';
import './resource-editors.css';
import './particle-editor.css';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const pathKey=value=>String(value||'').replaceAll('/','\\').toLowerCase();
const emptyAssets=new Map();
function starterLab(){const recipe=createStarterRecipe();return {doc:particleRecipeDocument(recipe),recipe,assets:new Map([[pathKey(STARTER_TEXTURE),starterTextureAsset()]])};}
async function assetsFor(recipe){
  const assets=embeddedParticleAssets(recipe),names=recipe.native.Textures.filter(t=>t.Image&&t.Image!==STARTER_TEXTURE&&!assets.has(pathKey(t.Image))).map(t=>t.Image);
  if(recipe.native.Textures.some(t=>t.Image===STARTER_TEXTURE))assets.set(pathKey(STARTER_TEXTURE),starterTextureAsset());
  if(names.length&&window.desktop?.resolveTextures){const sourceKey=recipe.sources?.find(source=>source.buildKey)?.buildKey;const records=sourceKey?await window.desktop.particleAssets({sourceKey,dependencies:recipe.dependencies.filter(dep=>names.includes(dep.path))}):await window.desktop.resolveTextures({names});for(const record of records||[])if(record.bytes)assets.set(pathKey(record.name),record);}
  return assets;
}
export default function ParticleEditor({doc,revision=doc?.revision||0,edit,refresh,modelPath,textureAssets=emptyAssets,preferences,teamColor=0,selectedNodeId,sequenceIndex=0,previewFrame=0,onClose,onNodeChange,onPlacedAssets}) {
  const [recoveryReady,setRecoveryReady]=useState(false),[newOpen,setNewOpen]=useState(false),[examples,setExamples]=useState(false),[testView,setTestView]=useState(null);
  const [lab,setLab]=useState(starterLab),[context,setContext]=useState(Number.isInteger(selectedNodeId)?'On model':'Lab');
  const [mode,setMode]=useState(()=>localStorage.getItem('mdlxl-particle-mode')||'Clueless');
  const [library,setLibrary]=useState(!Number.isInteger(selectedNodeId)),[tool,setTool]=useState('Basics'),[lifeStage,setLifeStage]=useState(1),[cancelVersion,setCancelVersion]=useState(0),[scope,setScope]=useState('key');
  const [emitterId,setEmitterId]=useState(selectedNodeId??0),[sequence,setSequence]=useState(Number.isInteger(selectedNodeId)?sequenceIndex:0);
  const [time,setTime]=useState(Number.isInteger(selectedNodeId)?previewFrame:800),[playing,setPlaying]=useState(true),[speed,setSpeed]=useState(.5),[loop,setLoop]=useState(true),[linked,setLinked]=useState(true),[fxSpeed,setFxSpeed]=useState(.5),[previewStatus,setPreviewStatus]=useState({busy:false}),[solo,setSolo]=useState(false);
  const [sweepRange,setSweepRange]=useState(null),[demo,setDemo]=useState(false),[placementError,setPlacementError]=useState('');
  const [tick,setTick]=useState(0),[structure,setStructure]=useState(0),[message,setMessage]=useState(''),[snapshot,setSnapshot]=useState(null),[saveOpen,setSaveOpen]=useState(false),[name,setName]=useState('My effect'),[placement,setPlacement]=useState(null),[pending,setPending]=useState(null);
  const activeDoc=context==='Lab'?lab.doc:doc;
  const model=activeDoc.model,assets=context==='Lab'?lab.assets:textureAssets;
  const working=useMemo(()=>structuredClone(model),[activeDoc,context,structure]);
  const preview=useMemo(()=>{
    const next=structuredClone(working);
    if(demo&&context==='Lab')addParticleDemonstration(next,Array.from(next.Sequences[sequence]?.Interval||[0,5000]));
    if(solo){for(const family of ['ParticleEmitters2','RibbonEmitters','ParticleEmitters','ParticleEmitterPopcorns'])next[family]=next[family].filter(node=>node.ObjectId===emitterId);}
    return next;
  },[working,solo,emitterId,demo,context,sequence]);
  const selectedEffect=effectNodes(working).find(item=>item.node.ObjectId===emitterId),family=selectedEffect?.family,emitter=['ParticleEmitters2','RibbonEmitters'].includes(family)?selectedEffect.node:null;
  const interval=model.Sequences[sequence]?.Interval||[0,5000],start=interval[0],end=interval[1],frame=Math.max(start,Math.min(end,time));
  const [dark,setDark]=useState(true);
  const previewPreferences=useMemo(()=>({...preferences,viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color:dark?'#24282c':'#d0d0d0'}}}),[preferences,dark]);
  const lastField=useRef(null),dialog=useRef(null),gesture=useRef(null),capture=useRef(null),loaded=useRef(false),latest=useRef(null);
  const previewReady=useCallback(api=>{capture.current=api;if(api)api.whenReady().then(()=>{if(capture.current===api)api.fit();}).catch(error=>setMessage(error.message));},[]);
  latest.current={lab,mode,context,activeDoc,working,emitterId,frame,sequence};
  const sync=()=>{
    for(const family of ['ParticleEmitters2','RibbonEmitters','ParticleEmitters','Helpers']){
      for(const node of working[family]){const source=model[family].find(n=>n.ObjectId===node.ObjectId);if(source){for(const key of Object.keys(node))delete node[key];Object.assign(node,structuredClone(source));}}
    }
    setTick(value=>value+1);refresh?.();
  };
  const apply=(label,mutate,sections=['Nodes'])=>{
    if(activeDoc.readOnly)return false;
    try{const result=context==='On model'&&edit?edit(label,sections,mutate):activeDoc.apply(label,sections,mutate);sync();setMessage('');return result;}
    catch(error){setMessage(error.message);sync();return false;}
  };
  const cancel=()=>{if(gesture.current){const {field,transaction}=gesture.current;const value=transaction.cancel();lastField.current=field;if(emitter){if(value===undefined)delete emitter[field];else emitter[field]=value;}gesture.current=null;setCancelVersion(v=>v+1);setTick(v=>v+1);}};
  const begin=(field,stage)=>{
    cancel();if(!emitter||activeDoc.readOnly)return;
    try{const transaction=createParticleGesture({doc:activeDoc,id:emitterId,field,options:{frame,globalTime:previewStatus.global??frame,interval:Array.from(interval),globalSequences:model.GlobalSequences,scope,family,...(stage&&typeof stage==='object'?stage:{stage})},commit:(label,sections,mutate)=>context==='On model'&&edit?edit(label,sections,mutate):activeDoc.apply(label,sections,mutate)});gesture.current={field,transaction};}
    catch(error){setMessage(error.message);}
  };
  const change=value=>{if(gesture.current){try{lastField.current=gesture.current.field;emitter[gesture.current.field]=gesture.current.transaction.update(value);setTick(v=>v+1);}catch(error){setMessage(error.message);cancel();}}};
  const finish=()=>{if(gesture.current){const current=gesture.current;gesture.current=null;try{current.transaction.finish();sync();}catch(error){setMessage(error.message);sync();}}};
  const update=(field,value)=>{cancel();lastField.current=field;try{const transaction=createParticleGesture({doc:activeDoc,id:emitterId,field,options:{family,raw:true},commit:(label,sections,mutate)=>context==='On model'&&edit?edit(label,sections,mutate):activeDoc.apply(label,sections,mutate)});transaction.update(value);transaction.finish();sync();setMessage(field==='Gravity'&&family==='RibbonEmitters'?'Ribbon gravity is saved, but this preview does not simulate it.':field==='PriorityPlane'||field==='Flags'&&value&65536?'Draw-order settings are saved; cross-effect ordering is not yet validated in this preview.':'');}catch(error){setMessage(error.message);sync();}};

  const patch=(values,error)=>{if(error){setMessage(error);return false;}cancel();lastField.current=Object.keys(values).length===1?Object.keys(values)[0]:null;return apply('Change particle appearance',m=>Object.assign(m[family].find(n=>n.ObjectId===emitterId),structuredClone(values)));};
  const teamPicture=id=>{
    const index=apply('Choose team picture',m=>{let index=m.Textures.findIndex(t=>t.ReplaceableId===id&&!t.Image);if(index<0)index=m.Textures.push({Image:'',ReplaceableId:id,Flags:0})-1;const emitter=m.ParticleEmitters2.find(n=>n.ObjectId===emitterId);emitter.TextureID=index;emitter.ReplaceableId=id;return index;},['Nodes','Textures']);
    if(index!==false)setStructure(v=>v+1);
  };
  const importPicture=async()=>{
    try{const list=await window.desktop.textures();if(!list?.length)return;const asset=list[0];let bytes=new Uint8Array(asset.bytes);
      if(bytes.byteLength>MAX_PARTICLE_PICTURE_BYTES)throw Error('Choose a picture smaller than 4 MiB for a portable preset.');
      let extension=String(asset.name||asset.path||'').split('.').at(-1).toLowerCase();if(!['png','blp','dds','tga','jpg','jpeg','webp'].includes(extension))throw Error('Unsupported picture type.');
      if(!['blp','dds','tga'].includes(extension)){const canvas=await particlePictureCanvas(asset);bytes=encodeForgeTga(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height));extension='tga';if(bytes.byteLength>MAX_PARTICLE_PICTURE_BYTES)throw Error('The decoded picture is too large. Use a picture up to 1024 × 1024.');}
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join(''),name='MDLxL_Forge\\Particle_'+hash.slice(0,32)+'.'+extension;
      const nextAsset={name,bytes,origin:'particle-custom'};
      if(latest.current.activeDoc!==activeDoc||latest.current.emitterId!==emitterId)return;
      const result=apply('Choose custom particle picture',m=>{let index=m.Textures.findIndex(t=>t.Image===name);if(index<0)index=m.Textures.push({Image:name,ReplaceableId:0,Flags:0})-1;const emitter=m.ParticleEmitters2.find(n=>n.ObjectId===emitterId);emitter.TextureID=index;emitter.ReplaceableId=0;},['Nodes','Textures']);
      if(result===false)return;const next=new Map(assets);next.set(pathKey(name),nextAsset);if(context==='Lab')setLab(old=>({...old,assets:next}));else onPlacedAssets?.(next);setStructure(v=>v+1);
    }catch(error){setMessage(error.message);}
  };
  const close=async()=>{cancel();try{await window.desktop?.particleDraft?.(stringifyParticleData({schema:'mdlxl-particle-draft',version:1,state:lab.doc.captureRecoveryState(),recipe:includeParticleAssets({...lab.recipe,native:lab.doc.model},lab.assets),mode}));onClose?.();}catch(error){setMessage('Draft could not be saved: '+error.message);}};
  useEffect(()=>{const previous=document.activeElement;dialog.current?.focus();return()=>previous?.focus?.();},[]);
  useEffect(()=>{
    let live=true;
    window.desktop?.particleDraft?.().then(async text=>{
      if(!text||!live||loaded.current)return;const draft=parseParticleData(text);
      if(draft.schema!=='mdlxl-particle-draft'||draft.version!==1)throw Error('Unsupported particle draft.');
      const restored=EditorDocument.restoreRecoveryState(draft.state),recipe=draft.recipe,resolved=await assetsFor({...recipe,native:restored.model});
      if(live&&!loaded.current){setLab({doc:restored,recipe,assets:resolved});if(!Number.isInteger(selectedNodeId))setEmitterId(effectNodes(restored.model)[0]?.node.ObjectId??null);}
    }).catch(error=>setMessage(error.message)).finally(()=>{if(live)setRecoveryReady(true);});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{localStorage.setItem('mdlxl-particle-mode',mode);},[mode]);
  useEffect(()=>{
    if(!recoveryReady)return;
    const timer=setTimeout(()=>{window.desktop?.particleDraft?.(stringifyParticleData({schema:'mdlxl-particle-draft',version:1,state:lab.doc.captureRecoveryState(),recipe:includeParticleAssets({...lab.recipe,native:lab.doc.model},lab.assets),mode})).catch(error=>setMessage(error.message));},800);
    return()=>clearTimeout(timer);
  },[lab,lab.doc.revision,mode,tick,recoveryReady]);
  useEffect(()=>{if(context==='On model')sync();},[revision]);
  useEffect(()=>{const flush=event=>{const current=latest.current;if(!current)return;event.detail.push(window.desktop.particleDraft(stringifyParticleData({schema:'mdlxl-particle-draft',version:1,state:current.lab.doc.captureRecoveryState(),recipe:includeParticleAssets({...current.lab.recipe,native:current.lab.doc.model},current.lab.assets),mode:current.mode})));};window.addEventListener('mdlxl-flush-particle-draft',flush);return()=>window.removeEventListener('mdlxl-flush-particle-draft',flush);},[]);
  const checkPlacementPictures=()=>{for(const [key,value]of assets){const existing=textureAssets.get(key);if(existing?.bytes&&value.bytes&&(existing.bytes.length!==value.bytes.length||Array.from(value.bytes).some((b,i)=>b!==existing.bytes[i])))throw Error('A different picture with the same path is already in the target. Relink that picture in Lab before placing.');}};
  const beginPlacement=()=>{cancel();try{checkPlacementPictures();setLibrary(false);setPlacement({parent:'',position:[0,0,0],sequence:doc.model.Sequences[sequenceIndex]?sequenceIndex:0,fit:true,motion:'source'});}catch(error){setMessage(error.message);}};
  const loadRecipe=async recipe=>{
    cancel();loaded.current=true;
    try{const next={doc:particleRecipeDocument(recipe),recipe,assets:await assetsFor(recipe)};setLab(next);setContext('Lab');setEmitterId(effectNodes(next.doc.model)[0]?.node.ObjectId??null);const sample=recipe.previewSample||activeParticleSample(next.doc.model);setSequence(sample.sequence);setTime(sample.time);setPlaying(true);setLibrary(false);setPlacement(null);setMessage('');setStructure(v=>v+1);}
    catch(error){setMessage(error.message);}
  };
  const chooseRecipe=recipe=>{if(lab.doc.dirty){setPending(recipe);return;}loadRecipe(recipe);};
  const recipeNow=()=>includeParticleAssets(extractParticleRecipe(activeDoc.model,effectNodes(activeDoc.model).filter(item=>context==='Lab'||item.node.ObjectId===emitterId).map(item=>item.node.ObjectId),{...(context==='Lab'?lab.recipe:{}),name,defaultSequence:sequence}),assets);
  const save=async()=>{
    try{const recipe=recipeNow();recipe.name=name;const saved=await window.desktop.particleSave({data:stringifyParticleData(recipe),name});setMessage('Saved '+saved.name);setSaveOpen(false);if(context==='Lab'){const nativeRecipe={...recipe,id:saved.id};lab.doc.markSaved(lab.doc.serialize('mdx'));setLab({...lab,recipe:nativeRecipe});}if(pending){const next=pending;setPending(null);await loadRecipe(next);}}
    catch(error){setMessage(error.message);}
  };
  const chooseContext=value=>{cancel();setTestView(null);setExamples(false);setContext(value);setEmitterId(effectNodes(value==='Lab'?lab.doc.model:doc.model)[0]?.node.ObjectId??null);setSequence(0);setTime(800);setPlacement(null);setStructure(v=>v+1);};
  const undo=redo=>{cancel();if(activeDoc.readOnly||library||examples||testView)return;try{activeDoc[redo?'redo':'undo']();setStructure(v=>v+1);setTick(v=>v+1);refresh?.();}catch(error){setMessage(error.message);}};
  const add=()=>{cancel();setTestView(null);setExamples(false);if(context==='Lab'){setNewOpen(v=>!v);return;}const id=apply('Create Particle Emitter 2',m=>createNode(m,'ParticleEmitter2').ObjectId,['Nodes','PivotPoints']);setEmitterId(id);setStructure(v=>v+1);};
  const place=()=>{
    try{
      checkPlacementPictures();
      const recipe=recipeNow(),position=placement.position,parent=placement.parent===''?null:Number(placement.parent),sourceInterval=Array.from(model.Sequences[sequence]?.Interval||[0,5000]),targetInterval=Array.from(doc.model.Sequences[placement.sequence]?.Interval||sourceInterval);
      let result;const mutate=target=>{result=placeParticleRecipe(target,recipe,{parent,position,sourceInterval,targetInterval,fit:placement.fit,motion:placement.motion});};
      const accepted=edit?edit('Add particle effect',['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'],mutate):doc.apply('Add particle effect',['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'],mutate);
      if(accepted===false)return;
      onPlacedAssets?.(assets);setContext('On model');setEmitterId(result.ids[0]);onNodeChange?.(result.ids[0]);setSequence(placement.sequence);setTime(targetInterval[0]);setPlacement(null);setStructure(v=>v+1);refresh?.();setMessage('Effect added. Undo restores the model.');
    }catch(error){setMessage(error.message);}
  };
  const placementRecipe=useMemo(()=>placement?extractParticleRecipe(model,effectNodes(model).map(item=>item.node.ObjectId),{...lab.recipe,name:lab.recipe.name,defaultSequence:sequence}):null,[!!placement,model,activeDoc.revision,sequence]);
  const placementAssets=useMemo(()=>new Map([...textureAssets,...assets]),[textureAssets,assets]);
  const focusedRange=sweepRange&&sweepRange[0]>=start&&sweepRange[1]<=end?sweepRange:[start,Math.min(end,start+Math.max(1,(end-start)*.35))];
  const asset=assets.get(pathKey(working.Textures[emitter?.TextureID]?.Image));
  return <div className="resource-editor particle-editor" onKeyDown={event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();if(gesture.current)cancel();else if(placement)setPlacement(null);else if(library)setLibrary(false);else close();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey);}
    if(event.key===' '&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(event.target.tagName)){event.preventDefault();setPlaying(v=>!v);}
    if(event.key==='Tab'){const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(e=>e.getClientRects().length);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}}
  }}>
    <section ref={dialog} tabIndex={-1} className="re-window pe-window" role="dialog" aria-modal="true" aria-label="Particle Editor" data-warmkey-scope="dialog" data-warmkey-prefix="particles">
      <header className="re-caption"><span>Particle Editor <small>· {context}</small></span><button className="re-caption-close" aria-label="Close Particle Editor" onClick={close}>×</button></header>
      <div className="pe-toolbar"><button aria-pressed={library} onClick={()=>{setTestView(null);setExamples(false);setLibrary(v=>!v);}}>Library</button><button disabled={activeDoc.readOnly} onClick={add}>New</button><select aria-label="Particle editor mode" value={mode} onChange={e=>{cancel();setMode(e.target.value);}}><option>Clueless</option><option>Classic</option></select><select aria-label="Particle context" value={context} onChange={e=>chooseContext(e.target.value)}><option>Lab</option><option disabled={!doc}>On model</option></select><span className="pe-spacer"/><button onClick={()=>undo(false)} disabled={activeDoc.readOnly||library||examples||!!testView||!activeDoc.canUndo}>Undo</button><button onClick={()=>undo(true)} disabled={activeDoc.readOnly||library||examples||!!testView||!activeDoc.canRedo}>Redo</button><button onClick={()=>{setName(context==='Lab'?lab.recipe.name:'My effect');setSaveOpen(v=>!v);}}>Save preset</button>{context==='Lab'&&<button disabled={!doc||doc.readOnly} onClick={beginPlacement}>Add to model</button>}</div>
      {newOpen&&<div className="pe-action-strip"><span>MDLxL originals</span><button onClick={()=>{setExamples(true);setNewOpen(false);}}>Compare examples</button>{PARTICLE_STARTERS.map(([id,label])=><button key={id} onClick={()=>{setNewOpen(false);chooseRecipe(createStarterRecipe(id));}}>{label}</button>)}<button onClick={()=>setNewOpen(false)}>Cancel</button></div>}
      {saveOpen&&<div className="pe-action-strip"><label>Preset name<input aria-label="Preset name" value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label><button onClick={save}>Save to My presets</button><button onClick={()=>setSaveOpen(false)}>Cancel</button></div>}
      {pending&&<div className="pe-action-strip"><span>Keep the edited Lab effect?</span><button onClick={()=>{setName(lab.recipe.name);setSaveOpen(true);}}>Save preset</button><button onClick={()=>{const next=pending;setPending(null);loadRecipe(next);}}>Discard and open</button><button onClick={()=>setPending(null)}>Cancel</button></div>}
      <div className={'pe-body '+(mode==='Classic'?'pe-classic':'pe-clueless')}>
        <div className="pe-preview-pane">
          <div className="pe-preview">{placement?<ParticlePlacementStage {...{doc,placement,teamColor}} recipe={placementRecipe} textureAssets={placementAssets} preferences={previewPreferences} onPosition={position=>setPlacement(p=>({...p,position}))} onError={setPlacementError}/>:<><Suspense fallback={<span>Loading preview…</span>}><GamePreview suspended={library||examples||!!testView} presentation="preview" model={preview} revision={0} particleAuthoring particleLiveModel={working} particleLiveRevision={tick} particleLiveField={lastField.current} particleSweepRange={tool==='Sweep'?focusedRange:undefined} playbackRange={tool==='Sweep'?focusedRange:undefined} particleLinked={linked} particleFxSpeed={(linked?speed:fxSpeed)*100} onParticleStatus={setPreviewStatus} particleSelectedId={emitterId} onParticleStage={setSnapshot} onParticlePick={id=>{cancel();setEmitterId(id);onNodeChange?.(context==='On model'?id:undefined);}} onCameraGestureChange={active=>{if(active)cancel();}} textureAssets={assets} modelPath={context==='On model'?modelPath:undefined} preferences={previewPreferences} teamColor={teamColor} sequenceIndex={sequence} time={frame} playing={playing} playbackSpeed={speed*100} loop={loop} onTimeChange={setTime} onPlayingChange={setPlaying} mode="textured" view="perspective" showParticles={true} showGrid={true} preserveCameraView onCaptureReady={previewReady} overlays={{bones:false,nodes:false,attachments:false,particles:false}}/></Suspense>{mode==='Clueless'&&!activeDoc.readOnly&&<ParticleStageTools {...{snapshot,tool,emitter,begin,change,finish,cancel,cancelVersion,lifeStage}} options={{frame,globalTime:previewStatus.global??frame,interval,globalSequences:model.GlobalSequences,family}}/>}{tool==='Sweep'&&<ParticleSweepOverlay snapshot={snapshot} frame={frame} onTime={value=>{setPlaying(false);setTime(value);}}/>}</>}
          {testView&&<ParticleTestView {...testView} assets={assets} preferences={preferences} onClose={()=>setTestView(null)}/>}
          {examples&&<ParticleExampleComparison preferences={preferences} onClose={()=>setExamples(false)} onChoose={recipe=>{setExamples(false);chooseRecipe(recipe);}}/>}
          {library&&<ParticleLibrary preferences={preferences} onClose={()=>setLibrary(false)} onChoose={chooseRecipe} onError={setMessage}/>}
          </div>
          {!placement&&<><div className="pe-stage-options"><select aria-label="Effect ingredient" value={emitterId??''} onChange={e=>{cancel();setEmitterId(Number(e.target.value));onNodeChange?.(context==='On model'?Number(e.target.value):undefined);}}>{!selectedEffect&&<option value="">Choose an effect</option>}{effectNodes(model).map(({node,family},i)=><option key={node.ObjectId} value={node.ObjectId}>{mode==='Classic'?node.Name:(family==='RibbonEmitters'?'Ribbon ':'Particle ')+(i+1)}</option>)}</select><button aria-pressed={solo} onClick={()=>{cancel();setSolo(v=>!v);}}>Solo</button><button onClick={()=>capture.current?.fit()}>Fit view</button><button onClick={()=>setDark(v=>!v)}>{dark?"Light":"Dark"}</button><button disabled={!selectedEffect} onClick={()=>{cancel();setTestView({source:structuredClone(model),ids:context==='Lab'?effectNodes(model).map(item=>item.node.ObjectId):[emitterId],sequence,time:frame,frame});}}>Test view</button></div>
          <div className="pe-transport"><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><button aria-label="Step particle preview" onClick={()=>{setPlaying(false);setTime(v=>Math.min(end,v+10));}}>Step</button><input aria-label="Particle preview playhead" type="range" min={start} max={end} step="1" value={frame} onChange={e=>{cancel();setPlaying(false);setTime(Number(e.target.value));}}/><select aria-label="Preview speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{(linked?[.1,.25,.5,1]:[0,.1,.25,.5,1]).map(value=><option key={value} value={value}>{value}×</option>)}</select><button aria-pressed={loop} onClick={()=>setLoop(v=>!v)}>Loop</button></div>
          <details className="pe-clock-options"><summary>{linked?'Clock options':'Unlinked · inspection'}</summary><label><input aria-label="Link animation and FX clocks" type="checkbox" checked={linked} onChange={e=>{setLinked(e.target.checked);if(e.target.checked&&speed===0)setSpeed(.5);}}/>Link animation and FX</label>{!linked&&<label>FX speed<select aria-label="FX speed" value={fxSpeed} onChange={e=>setFxSpeed(Number(e.target.value))}>{[0,.1,.25,.5,1].map(value=><option key={value} value={value}>{value===0?'Paused':value+'×'}</option>)}</select></label>}</details>
          <select aria-label="Particle preview animation" value={sequence} onChange={e=>{cancel();const next=Number(e.target.value);setSequence(next);setTime(model.Sequences[next].Interval[0]);}}>{model.Sequences.map((clip,index)=><option key={index} value={index}>{clip.Name}</option>)}</select></>}
        </div>
        <fieldset className="pe-controls inspector-fields" disabled={activeDoc.readOnly||library||examples||!!testView}>
          {placement?<div className="pe-placement"><strong>Place effect</strong><label>Motion<select aria-label="Effect placement motion" value={placement.motion} onChange={e=>setPlacement(p=>({...p,motion:e.target.value}))}><option value="source">Keep source motion</option><option value="target">Use target attachment motion</option></select></label><label>Attach to<select aria-label="Attach effect to" value={placement.parent} onChange={e=>setPlacement(p=>({...p,parent:e.target.value}))}><option value="">Model origin</option>{[...doc.model.Bones,...doc.model.Helpers].map(node=><option key={node.ObjectId} value={node.ObjectId}>{node.Name}</option>)}</select></label><button disabled={placement.parent===''} onClick={()=>setPlacement(p=>({...p,position:Array.from(doc.model.Nodes[Number(p.parent)].PivotPoint||[0,0,0])}))}>Snap to attachment pivot</button><label>Animation<select aria-label="Placement animation" value={placement.sequence} onChange={e=>setPlacement(p=>({...p,sequence:Number(e.target.value)}))}>{doc.model.Sequences.map((clip,index)=><option key={index} value={index}>{clip.Name}</option>)}</select></label><label><input type="checkbox" checked={placement.fit} onChange={e=>setPlacement(p=>({...p,fit:e.target.checked}))}/>Fit timing to this animation</label>{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<input aria-label={'Effect anchor '+axis} type="range" min="-250" max="250" value={placement.position[i]} onChange={e=>setPlacement(p=>({...p,position:p.position.map((n,k)=>k===i?Number(e.target.value):n)}))}/></label>)}<button disabled={!!placementError} onClick={place}>Confirm placement</button>{placementError&&<small role="status">{placementError}</small>}<button onClick={()=>setPlacement(null)}>Cancel placement</button></div>:
          emitter?<>{family==='RibbonEmitters'?<><div className="pe-tool-tabs">{['Basics','Sweep'].map(item=><button key={item} aria-pressed={tool===item} onClick={()=>setTool(item)}>{item}</button>)}</div>{tool!=='Sweep'&&<ParticleRibbonControls {...{model:working,emitter,frame,sequence,mode,scope,setScope,begin,change,finish,cancel,update}} globalTime={previewStatus.global??frame}/>}</>:mode==='Classic'?<ParticleClassicControls {...{emitter,frame,sequence,update}} model={working} onImportTexture={importPicture} apply={(label,mutate,sections)=>apply(label,mutate,sections)}/>:<><div className="pe-tool-tabs">{['Basics','Shape','Life','Picture','Timing','Sweep'].map(item=><button key={item} aria-pressed={tool===item} onClick={()=>{cancel();setTool(item);}}>{item}</button>)}</div><ParticleCluelessControls onDemo={context==='Lab'?setDemo:undefined} demo={demo} teamColor={teamColor||'#ed3333'} {...{emitter,frame,sequence,tool,scope,setScope,asset,assets,preferences,update,patch,begin,change,finish,cancel,lifeStage,setLifeStage}} onImport={importPicture} onTeamPicture={teamPicture} model={working} globalTime={previewStatus.global??frame} onSeek={value=>{setPlaying(false);setTime(value);}}/></>}{tool==='Sweep'&&<ParticleSweepControls {...{emitter,begin,change,finish,cancel}} options={{frame,globalTime:previewStatus.global??frame,interval,globalSequences:model.GlobalSequences,family}} interval={interval} range={focusedRange} onRange={value=>{setSweepRange(value);setTime(value[0]);setSpeed(.25);setLoop(true);}} context={context} demo={demo} onDemo={setDemo} onWindow={()=>apply('Set effect emission window',m=>setParticleEmissionWindow(m[family].find(n=>n.ObjectId===emitterId),Array.from(interval),focusedRange))}/>}</>:<p>{selectedEffect?'This ingredient is preserved; its editing controls are not implemented yet.':'Choose an effect in the library.'}</p>}
        </fieldset>
      </div>
      <footer className="re-footer"><span className="re-status" role="status">{previewStatus.error|| (demo&&context==='Lab'?'Demonstration sweep · preview only':previewStatus.busy?'Updating effect…':message||(activeDoc.readOnly?'Read-only model.':''))}</span><button onClick={close}>Close</button></footer>
    </section>
  </div>;
}
