import React, { useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import OptimizeXLGeosets from './OptimizeXLGeosets.jsx';
import OptimizeXLReview from './OptimizeXLReview.jsx';
import OptimizeXLHelp from './OptimizeXLHelp.jsx';
import OptimizeXLFixSelection from './OptimizeXLFixSelection.jsx';
import { previewPlaybackStep } from './game-preview-capture.js';
import { GEOSET_REDUCTION_STAGES } from '../src/optimizexl-exclusions.js';
import { viewportAppearanceOptions } from '../src/preferences.js';
import { bindDropdownWheel } from '../src/dropdown-wheel.js';
import { openDocument } from '../src/editor-document.js';
import { OptimizeXLSession } from '../src/optimizexl-session.js';
import { STAGES, SPHERE_PRESETS, prepareOptimizeXL, simpleSettings, triangleCount, findIrregularities, sanityProposals } from '../src/optimizexl.js';
import { hiveSanity } from './optimizexl-hive.js';
import './optimizexl.css';

const kb = n => `${(n / 1024).toFixed(2)} KB`;
const repairStages = new Set(['sanity','irregularities']);
const freshSettings = (stage, model) => simpleSettings(stage, 0, model);
const findingsFor = (stage, model) => stage==='irregularities'?findIrregularities(model):stage==='sanity'?sanityProposals(model):[];
const fixDefaults = f => f?.kind==='gravity'?{gravity:f.value}:{};
function NumberSetting({label,value,onChange,min=0,max=100000,step=.001}) {return <label className="ox-setting"><OptimizeXLHelp label={label}/><input aria-label={label} type="number" min={min} max={max} step={step} value={value} onChange={e=>onChange(Math.max(min,Math.min(max,Number(e.target.value)||0)))}/></label>;}

export default function OptimizeXL({doc,textureAssets,preferences,teamColor,onClose}) {
  const [initial] = useState(()=>{try{return {session:new OptimizeXLSession(prepareOptimizeXL(doc),doc.name)}}catch(e){return {error:e.message}}});
  const session=initial.session, [revision,refresh]=useState(0), [stage,setStage]=useState('duplicates'),[advanced,setAdvanced]=useState(false),[strength,setStrength]=useState(0),[custom,setCustom]=useState(false);
  const [settings,setSettings]=useState(()=>session?freshSettings('duplicates',openDocument(session.accepted,'before.mdx').model):{});
  const [candidate,setCandidate]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(initial.error||''),[saved,setSaved]=useState(null),[saving,setSaving]=useState(false);
  const [sequence,setSequence]=useState(0),[clock,setClock]=useState({time:0,globalTime:0}),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(100),[seekId,setSeekId]=useState(0),[loop,setLoop]=useState(true);
  const {time,globalTime}=clock;
  const [selectedFix,setSelectedFix]=useState(null),[skippedFixes,setSkippedFixes]=useState(new Set()),[hive,setHive]=useState(null),[hiveBusy,setHiveBusy]=useState(false),[finished,setFinished]=useState(false);
  const [excluded,setExcluded]=useState(new Set()),[listHovered,setListHovered]=useState(null),[viewHovered,setViewHovered]=useState(null),[highlight,setHighlight]=useState(true),[,refreshReviews]=useState(0);
  const [checkingStages,setCheckingStages]=useState(true);
  const [checkedFixes,setCheckedFixes]=useState(new Set()),[fixSettings,setFixSettings]=useState({}),[previewMode,setPreviewMode]=useState('single');
  const exclusionsKey=[...excluded].sort((a,b)=>a-b).join(','),showGeosets=GEOSET_REDUCTION_STAGES.has(stage)&&!finished;
  const highlightAppearance=viewportAppearanceOptions(preferences).geosetHighlight;
  const hoveredGeoset=showGeosets&&highlight?((highlightAppearance.viaSelection?listHovered:null)??(highlightAppearance.viaView?viewHovered:null)):null;
  const root=useRef(null),camera=useRef({saved:null,listeners:new Set()}),request=useRef(0),worker=useRef(null),inspection=useRef(null);
  // Review viewports always use the wheel to zoom. Keep the main editor's
  // persistent sensitivity-adjustment mode outside this detached editor.
  const previewPreferences=useMemo(()=>({...preferences,wheelMode:'rotate'}),[preferences]);
  const before=useMemo(()=>session?openDocument(session.accepted,'before.mdx').model:null,[session,revision]);
  const original=useMemo(()=>session?openDocument(session.before,'original.mdx').model:null,[session]);
  const after=useMemo(()=>candidate?openDocument(candidate.bytes,'after.mdx').model:before,[candidate,before]);
  const findings=useMemo(()=>before?findingsFor(stage,before):[],[before,stage]);
  const available=findings.filter(f=>!skippedFixes.has(f.id)),fix=available.find(f=>f.id===selectedFix)||null;
  const selectedEntries=useMemo(()=>findings.filter(f=>!f.inspectionOnly&&!skippedFixes.has(f.id)&&checkedFixes.has(f.id)).map(f=>({fix:f,settings:fixSettings[f.id]||fixDefaults(f)})),[findings,skippedFixes,checkedFixes,fixSettings]);
  const previewFix=useMemo(()=>previewMode==='selection'?(selectedEntries.length?{kind:'batch',stage,entries:selectedEntries}:null):previewMode==='single'&&!fix?.inspectionOnly?fix:null,[previewMode,stage,selectedEntries,fix]);
  const sanityClean=stage==='sanity'&&!hiveBusy&&hive&&hive.errors+hive.severe+hive.warnings+hive.unused===0&&findings.length===0;
  const sequenceInfo=before?.Sequences[sequence],interval=sequenceInfo?.Interval||[0,1000];
  const seek=(frame)=>{setClock(current=>({...current,time:frame}));setSeekId(v=>v+1);};
  // A finding borrows the timeline. Keep the user's return point through
  // multiple findings, without overriding authored geoset visibility.
  function inspectFix(f,returnView){inspection.current??=returnView||{sequence,time};setSequence(f.sequence);seek(f.frame);setPlaying(false);}
  function restoreInspection(){const view=inspection.current;inspection.current=null;if(view){setSequence(view.sequence);seek(view.time);setPlaying(false);}return view;}
  function enter(next,restore){
    const returnView=restoreInspection(),batch=restore?.fix?.kind==='batch'?restore.fix.entries:[],first=batch[0]?.fix||restore?.fix;
    worker.current?.terminate();session.candidate=null;request.current++;setCandidate(null);setBusy(false);setError('');setSaved(null);setFinished(false);setStage(next);
    setSettings(batch[0]?.settings||restore||freshSettings(next,before));if(restore?.excludedGeosets)setExcluded(new Set(restore.excludedGeosets));setListHovered(null);setViewHovered(null);setStrength(0);setCustom(!!restore);
    setCheckedFixes(new Set(batch.map(e=>e.fix.id)));setFixSettings(batch.length?Object.fromEntries(batch.map(e=>[e.fix.id,e.settings])):first?{[first.id]:restore}:{});
    setPreviewMode(batch.length?'selection':'single');setSelectedFix(first?.id||null);setPlaying(false);if(first)inspectFix(first,returnView);
  }
  useEffect(()=>{if(before?.Sequences.length){setSequence(i=>Math.min(i,before.Sequences.length-1));}},[before]);
  useEffect(()=>{setListHovered(null);},[candidate,busy]);
  useEffect(()=>{const owner=root.current?.ownerDocument;if(owner&&owner!==document)return bindDropdownWheel(owner);},[session]);
  useEffect(()=>{if(time<interval[0]||time>interval[1])seek(interval[0]);},[before,sequence]);
  useEffect(()=>{if(!playing||!before||speed===0)return;const owner=root.current?.ownerDocument.defaultView||window;let id,last;const tick=now=>{if(last!==undefined){const elapsed=Math.min(100,now-last)*speed/100;setClock(current=>{const step=previewPlaybackStep(interval,current.time,elapsed,loop);return {time:step.finished?interval[1]:step.frame,globalTime:current.globalTime+step.elapsed};});}last=now;id=owner.requestAnimationFrame(tick);};id=owner.requestAnimationFrame(tick);return()=>owner.cancelAnimationFrame(id);},[playing,speed,sequence,loop,before]);
  useEffect(()=>{if(playing&&!loop&&time>=interval[1])setPlaying(false);},[playing,loop,time,interval[1]]);
  useEffect(()=>{
    if(!session)return;
    const baseline=session.accepted,w=new Worker(new URL('./optimizexl-worker.js',import.meta.url),{type:'module'});
    let active=true;setCheckingStages(true);
    w.onmessage=({data})=>{if(!active||baseline!==session.accepted)return;
      if(data.availability){const a=data.availability;session.recordAvailability(a.stage,a.hasChanges,GEOSET_REDUCTION_STAGES.has(a.stage)?exclusionsKey:'',a.error);refreshReviews(v=>v+1);}
      if(data.error)setError(data.error);
      if(data.complete||data.error){setCheckingStages(false);w.terminate();}
    };
    w.onerror=event=>{if(active){setCheckingStages(false);setError(event.message||'The stage availability check failed.');}w.terminate();};
    w.postMessage({operation:'availability',bytes:baseline,excludedGeosets:[...excluded]});
    return()=>{active=false;w.terminate();};
  },[session,before,exclusionsKey]);
  useEffect(()=>{
    if(!session||finished||repairStages.has(stage)&&!previewFix){request.current++;setCandidate(null);setBusy(false);session&&(session.candidate=null);return;}
    const id=++request.current,sessionRevision=session.revision;setBusy(true);setError('');session.candidate=null;session.reviews.delete(stage);
    const timer=setTimeout(()=>{
      const w=new Worker(new URL('./optimizexl-worker.js',import.meta.url),{type:'module'});worker.current=w;
      w.onmessage=({data})=>{if(id!==request.current)return;setBusy(false);if(data.error){setError(data.error);setCandidate(null);}else if(session.propose(data.result,sessionRevision)){
        // Zero Nuclear strength and disabled cleanup options are untried,
        // not evidence that a stage has nothing left to offer.
        const attempted=stage==='nuclear'?settings.target<triangleCount(before)||before.Geosets.every((g,i)=>excluded.has(i)||g.Faces.length<=3):stage==='unused'?settings.vertices||settings.resources||settings.nodes:true;
        if(attempted&&stage!=='spheres')session.recordReview(stage,!data.result.changed,GEOSET_REDUCTION_STAGES.has(stage)?exclusionsKey:'');setCandidate(data.result);
      }w.terminate();};
      w.onerror=event=>{if(id===request.current){setBusy(false);setError(event.message||'The optimizer worker failed.');setCandidate(null);}w.terminate();};
      w.postMessage({bytes:session.accepted,stage,settings:{...settings,excludedGeosets:[...excluded]},fix:previewFix});
    },120);
    return()=>{clearTimeout(timer);worker.current?.terminate();};
  },[session,revision,stage,settings,previewFix,finished,excluded]);
  useEffect(()=>{if(session&&repairStages.has(stage)){session.recordReview(stage,!findings.some(f=>!f.inspectionOnly));refreshReviews(v=>v+1);}},[session,stage,findings]);
  useEffect(()=>{if(stage!=='sanity'||!session)return;let active=true;setHive(null);setHiveBusy(true);hiveSanity(session.accepted).then(result=>{if(active)setHive(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setHiveBusy(false);});return()=>{active=false;};},[stage,revision]);
  function chooseFix(id){const f=findings.find(f=>f.id===id);setSelectedFix(id);setSettings(fixSettings[id]||fixDefaults(f));if(!f||previewMode!=='selection')setPreviewMode('single');if(f)inspectFix(f);else restoreInspection();}
  function selectFixes(next){setCheckedFixes(next);setPreviewMode(null);setSaved(null);}
  function previewSelected(){if(!selectedEntries.length)return;setPreviewMode('selection');const selected=selectedEntries.find(e=>e.fix.id===selectedFix)||selectedEntries[0];setSelectedFix(selected.fix.id);setSettings(selected.settings);inspectFix(selected.fix);}
  function adjust(key,value){setCustom(true);const next={...settings,[key]:value};setSettings(next);if(repairStages.has(stage)&&fix)setFixSettings(s=>({...s,[fix.id]:next}));setSaved(null);}
  function adjustStrength(value){setStrength(value);setCustom(false);setSettings(simpleSettings(stage,value,before));setSaved(null);}
  function advance(){const index=STAGES.findIndex(s=>s.id===stage);if(index===STAGES.length-1){setFinished(true);setCandidate(null);setPlaying(false);}else enter(STAGES[index+1].id);}
  function nextFinding(model,consumed,skipped=skippedFixes){const list=findingsFor(stage,model).filter(f=>!skipped.has(f.id)&&!consumed.has(f.id)),last=Math.max(-1,...available.map((f,i)=>consumed.has(f.id)?i:-1)),next=available.slice(last+1).map(f=>list.find(n=>n.id===f.id)).find(Boolean)||list[0];setCheckedFixes(s=>new Set([...s].filter(id=>!consumed.has(id))));setPreviewMode('single');setSelectedFix(next?.id||null);setSettings(next?(fixSettings[next.id]||fixDefaults(next)):{});if(next)inspectFix(next);else restoreInspection();setPlaying(false);}
  function approve(){if(busy||!candidate||repairStages.has(stage)&&!previewFix)return;session.approve(stage,{...settings,excludedGeosets:[...excluded],fix:previewFix});refresh(v=>v+1);setSaved(null);setCandidate(null);if(repairStages.has(stage)){const ids=new Set(previewFix.kind==='batch'?previewFix.entries.map(e=>e.fix.id):[previewFix.id]);nextFinding(openDocument(session.accepted,'approved.mdx').model,ids);}else advance();}
  function skip(){if(repairStages.has(stage)&&fix){const ids=new Set(previewFix?.kind==='batch'?previewFix.entries.map(e=>e.fix.id):[fix.id]),skipped=new Set([...skippedFixes,...ids]);setSkippedFixes(skipped);setCandidate(null);session.candidate=null;setBusy(false);nextFinding(before,ids,skipped);return;}session.skip(stage);advance();}
  function back(){const step=session.back();if(step){refresh(v=>v+1);enter(step.stage,step.settings);}else enter('duplicates');}
  async function save(){setSaving(true);setError('');try{if(!window.desktop?.saveOptimizeXL)throw Error('Saving two protected copies requires the desktop app.');const result=await window.desktop.saveOptimizeXL(session.savePayload());if(result)setSaved(result);}catch(e){setError(e.message);}finally{setSaving(false);}}
  if(!session)return <div className="ox-root"><header><h1>OptimizeXL</h1><button onClick={onClose}>Close</button></header><p role="alert">{error}</p></div>;
  const previewProps={pixelAligned:true,textureAssets,preferences:previewPreferences,teamColor,presentation:'preview',interactivePreview:showGeosets,hoveredGeoset,highlightSelection:showGeosets&&highlight&&highlightAppearance.viaView,onHoverGeoset:showGeosets?setViewHovered:undefined,overlays:{grid:false,axes:false,boneLines:false},showGrid:false,showAxes:false,playing:false,syncPlayback:true,playbackRunning:playing,playbackGlobalTime:globalTime,seekId,sequenceIndex:sequence,time,compareCamera:camera.current,preserveCameraView:true,cameraMode:'rotate',showCollisionSpheres:stage==='spheres'&&!finished,loop};
  const updateSphere=(i,j,value)=>adjust('spheres',(settings.spheres||[]).map((s,k)=>k===i?s.map((v,l)=>l===j?value:v):s));
  return <div className="ox-root" ref={root} onKeyDown={event=>{event.stopPropagation();if(event.code==='Space'&&!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName)){event.preventDefault();setPlaying(v=>!v);}}}>
    <header><h1>OptimizeXL</h1><div className="ox-mode" role="group" aria-label="Controls"><button aria-pressed={!advanced} onClick={()=>setAdvanced(false)}>Simple</button><button aria-pressed={advanced} onClick={()=>setAdvanced(true)}>Advanced</button></div><span className="ox-file">{doc.name}</span><button disabled={saving} onClick={save}>{saving?'Saving…':'Optimize New Copy'}</button><button disabled={saving} onClick={onClose}>Close</button></header>
    <nav aria-label="Optimization stages" aria-busy={checkingStages}>{STAGES.map(s=>{const pending=session.needsReview(s.id,GEOSET_REDUCTION_STAGES.has(s.id)?exclusionsKey:''),check=session.availability.get(s.id),checkError=check?.before===session.accepted&&check.error;return <button key={s.id} disabled={saving} aria-current={stage===s.id&&!finished?'step':undefined} onClick={()=>enter(s.id)} title={checkError?`Check unavailable: ${checkError}`:pending?'Changes available to review':'Approved or no changes found'}>{pending&&<span className="ox-stage-star" aria-hidden="true">★</span>}{s.name}</button>;})}</nav>
    <main>
      <section className="ox-preview" aria-label="Before preview"><h2>Before <small>Original · {kb(session.before.length)}</small></h2><GamePreview {...previewProps} model={original} revision={0}/></section>
      <section className="ox-controls" aria-label="Optimization controls">
        <h2>{finished?'Ready to save':STAGES.find(s=>s.id===stage).name}</h2>
        <label>Animation<select aria-label="Animation" value={sequence} onChange={e=>{const i=Number(e.target.value);setSequence(i);seek(before.Sequences[i].Interval[0]);}}>{before.Sequences.map((s,i)=><option value={i} key={i}>{s.Name}</option>)}</select></label>
        <div className="ox-play"><button aria-label={playing?'Pause':'Play'} disabled={!before.Sequences.length} onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><button onClick={()=>{setPlaying(false);seek(interval[0]);}}>Start</button><button onClick={()=>{setPlaying(false);seek(interval[1]);}}>End</button></div>
        <input type="range" aria-label="Animation frame" min={interval[0]} max={interval[1]} step="1" value={time} onChange={e=>{setPlaying(false);seek(Number(e.target.value));}}/><output className="ox-frame">{Math.round(time)} / {interval[1]}</output>
        <div className="ox-play"><label className="ox-speed">Speed (%)<input aria-label="Playback speed (%)" type="number" min="0" max="200" step="1" value={speed} onChange={e=>setSpeed(Math.max(0,Math.min(200,Number(e.target.value)||0)))}/></label><label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>Loop</label></div>
        <hr/>
        {showGeosets&&<OptimizeXLGeosets count={before.Geosets.length} excluded={excluded} onChange={next=>{setExcluded(next);setSaved(null);}} hovered={hoveredGeoset} onHover={setListHovered} highlight={highlight} onHighlight={setHighlight} color={highlightAppearance.color}/>}
        {!finished&&['duplicates','animation','nuclear'].includes(stage)&&!advanced&&<label>Strength {custom?'(Custom)':`${strength.toFixed(2)}%`}<input aria-label="Strength" type="range" min="0" max="100" step="0.01" value={strength} onChange={e=>adjustStrength(Number(e.target.value))}/><span className="ox-range"><small>Conservative</small><small>Aggressive</small></span></label>}
        {!finished&&advanced&&stage==='duplicates'&&<><NumberSetting label="Position tolerance" value={settings.position} onChange={v=>adjust('position',v)}/><NumberSetting label="UV tolerance" value={settings.uv} max="1" step="0.0001" onChange={v=>adjust('uv',v)}/><NumberSetting label="Normal angle (degrees)" value={settings.normal} max="180" step=".1" onChange={v=>adjust('normal',v)}/><label><input type="checkbox" aria-label="Merge equivalent leaf bones" checked={settings.bones} onChange={e=>adjust('bones',e.target.checked)}/><OptimizeXLHelp label="Merge equivalent leaf bones"/></label></>}
        {!finished&&advanced&&stage==='animation'&&<><NumberSetting label="Translation tolerance" value={settings.position} onChange={v=>adjust('position',v)}/><NumberSetting label="Rotation tolerance (degrees)" value={settings.rotation} max="180" step=".1" onChange={v=>adjust('rotation',v)}/><NumberSetting label="Scale tolerance" value={settings.scale} step=".0001" onChange={v=>adjust('scale',v)}/></>}
        {!finished&&stage==='unused'&&(advanced?<>{[['vertices','Unreferenced vertices'],['resources','Unused materials, textures and globals'],['nodes','Unused bones and helpers']].map(([key,label])=><label key={key}><input type="checkbox" aria-label={label} checked={settings[key]} onChange={e=>adjust(key,e.target.checked)}/><OptimizeXLHelp label={label}/></label>)}</>:<p>Remove unreferenced vertices, resources and unused rig nodes.</p>)}
        {!finished&&stage==='nuclear'&&<><p className="ox-poly">{triangleCount(before).toLocaleString()} → {(candidate?.triangles??triangleCount(before)).toLocaleString()} polygons<br/>{(triangleCount(before)-(candidate?.triangles??triangleCount(before))).toLocaleString()} removed</p>{advanced&&<><NumberSetting label="Target polygons" value={settings.target} max={triangleCount(before)} step="1" onChange={v=>adjust('target',v)}/><NumberSetting label="Shape/texture error (%)" value={settings.error*100} max={100} step={.001} onChange={v=>adjust('error',v/100)}/><NumberSetting label="Sharp-edge angle" value={settings.normalLimit} max="180" step="1" onChange={v=>adjust('normalLimit',v)}/>{[['protectSeams','Protect UV seams and boundaries'],['protectNormals','Protect sharp edges'],['protectSkin','Protect skinning boundaries']].map(([key,label])=><label key={key}><input type="checkbox" aria-label={label} checked={settings[key]} onChange={e=>adjust(key,e.target.checked)}/><OptimizeXLHelp label={label}/></label>)}</>}</>}
        {!finished&&stage==='spheres'&&<><label>{advanced?<OptimizeXLHelp label="Preset"/>:"Preset"}<select aria-label="Sphere preset" value={settings.preset} onChange={e=>{const p=Number(e.target.value);setSettings(s=>({...s,preset:p,spheres:structuredClone(SPHERE_PRESETS[p].spheres)}));}}>{SPHERE_PRESETS.map((p,i)=><option key={p.name} value={i}>{p.name}</option>)}</select></label><label>{advanced?<OptimizeXLHelp label="Size">Size: {settings.size?.toFixed(2)}×</OptimizeXLHelp>:<>Size: {settings.size?.toFixed(2)}×</>}<input aria-label="Sphere size" type="range" min=".1" max="3" step=".01" value={settings.size} onChange={e=>adjust('size',Number(e.target.value))}/></label>{advanced&&<div className="ox-spheres">{settings.spheres?.map((s,i)=><fieldset key={i}><legend>Sphere {i+1} <button title="Remove this collision sphere from the proposal. It is kept only after approval." aria-label={`Remove sphere ${i+1}`} onClick={()=>adjust('spheres',settings.spheres.filter((_,k)=>k!==i))}>×</button></legend>{['X','Y','Z','Radius'].map((label,j)=><NumberSetting key={label} label={`${label} ${i+1}`} value={s[j]} min={j===3?.01:-100000} step=".1" onChange={v=>updateSphere(i,j,v)}/>)}</fieldset>)}<button title="Add a collision sphere to this proposal, then adjust its position and radius before approval." onClick={()=>adjust('spheres',[...settings.spheres,[0,0,40,40]])}>Add sphere</button></div>}<small>{SPHERE_PRESETS[settings.preset]?.source}</small></>}
        {!finished&&repairStages.has(stage)&&<>{stage==='sanity'&&<><p role="status">{hiveBusy?'Running Hive sanity check…':hive?`Hive: ${hive.errors} errors · ${hive.severe} severe · ${hive.warnings} warnings · ${hive.unused} notices`:'Hive check unavailable'}</p>{hive?.findings.length>0&&<details><summary>Checker findings ({hive.findings.length})</summary><ul>{hive.findings.map((f,i)=><li key={i}>{f.path}: {f.message||f.name}{findings.find(p=>p.targets?.some(t=>f.path.startsWith(t.hivePath)))&&<button onClick={()=>chooseFix('invalidBounds')}>Preview fix</button>}</li>)}</ul></details>}{hive?.unused>0&&<p>Redundant keys and unused objects can be reviewed in <button onClick={()=>enter('animation')}>Review redundant keys</button> and <button onClick={()=>enter('unused')}>Review unused objects</button>.</p>}</>}{sanityClean&&<p>No Hive issues found. Choose Next stage to review movement irregularities.</p>}{!sanityClean&&<label>{stage==='irregularities'?'Findings':'Proposed fixes'}<select aria-label="Proposed fix" value={selectedFix||''} onChange={e=>chooseFix(e.target.value)}><option value="">Select a finding to preview</option>{available.map(f=><option key={f.id} value={f.id} style={{color:f.motionContext?.level==='red'?'#d53b35':f.motionContext?.level==='orange'?'#c66b08':undefined}}>{f.label}</option>)}</select></label>}{!available.length&&!sanityClean&&<p>No further automatic proposals. {stage==='sanity'?'Checker findings without a supported correction remain for manual editing.':'Intentional animation differences can be left unchanged.'}</p>}{fix&&<><p>{fix.detail}</p>{fix.kind==='gravity'&&<NumberSetting label="Static gravity" min={-100000} value={settings.gravity??fix.value} onChange={v=>adjust('gravity',v)}/>} {advanced&&fix.kind==='pose'&&<label><input type="checkbox" aria-label="Use the destination pose as the reference instead" checked={!!settings.reverse} onChange={e=>adjust('reverse',e.target.checked)}/><OptimizeXLHelp label="Use the destination pose as the reference instead"/></label>}</>}</>}
        {!finished&&fix?.motionContext&&<div className="ox-motion-context" data-motion-level={fix.motionContext.level} role="status"><strong>{fix.motionContext.level==='red'?'Red · Inspect erratic movement':'Orange · Inspect the pattern'}</strong><p>{fix.motionContext.summary}</p></div>}
        {!finished&&repairStages.has(stage)&&available.length>0&&<OptimizeXLFixSelection findings={available} checked={checkedFixes} onChange={selectFixes} onInspect={chooseFix} onPreview={previewSelected} previewing={previewMode==='selection'}/>}
        {!finished&&!sanityClean&&<div className="ox-savings" aria-live="polite">{busy?'Updating preview…':candidate?<><strong>{kb(session.before.length-candidate.afterBytes)} saved</strong><span>{kb(session.before.length)} → {kb(candidate.afterBytes)}</span>{candidate.stats.constrained&&<small>Protection settings limit further reduction.</small>}</>:fix?.inspectionOnly?'Inspection only — play or scrub this animation.':repairStages.has(stage)&&previewMode===null?'Choose Preview all selected fixes.':'Choose a proposed fix to compare.'}</div>}
        {!finished&&!busy&&candidate?.review&&<OptimizeXLReview key={stage} review={candidate.review} model={before} onInspect={inspectFix} onHover={setListHovered} onClose={restoreInspection}/>}
        {candidate&&advanced&&<small>{Object.entries(candidate.stats).filter(([k])=>!['originalMaterials','constrained'].includes(k)).map(([k,v])=>`${k}: ${v}`).join(' · ')}</small>}
        {error&&<p className="ox-error" role="alert">{error}</p>}
        {finished&&<p>Use Optimize New Copy above to save exactly two new files: the model that entered OptimizeXL and your approved result{session.steps.some(s=>s.stage==='nuclear'&&!s.skipped)?' including nuclear reduction':''}. Existing files are never overwritten.</p>}
        <div className="ox-actions"><button disabled={saving||!session.steps.length} onClick={back}>Back</button>{!finished&&<><button disabled={saving||busy||!candidate||!!error||repairStages.has(stage)&&!previewFix} onClick={approve}>{previewFix?.kind==='batch'?'Approve selected':'Approve'}</button><button disabled={saving} onClick={skip}>{previewFix?.kind==='batch'?'Skip selected':repairStages.has(stage)&&fix?'Skip fix':'Skip stage'}</button></>}</div>
        {!finished&&repairStages.has(stage)&&<button onClick={advance}>Next stage</button>}
        {saved&&<p role="status">Saved both copies:<br/>{saved.before}<br/>{saved.after}</p>}
      </section>
      <section className="ox-preview" aria-label="After preview"><h2>After <small>{busy?'Updating…':candidate?kb(candidate.afterBytes):kb(session.accepted.length)}</small></h2><GamePreview {...previewProps} model={after} revision={revision+request.current}/></section>
    </main>
    <footer>Original: {kb(session.before.length)} · Approved: {kb(session.accepted.length)} · Total saved: {kb(session.before.length-session.accepted.length)}<span>{finished?'Ready to save two new copies':'Only approved stages are kept'}</span></footer>
  </div>;
}
