import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {EFFECT_FAMILIES,effectNodes} from '../src/particle-recipes.js';
import {activeParticleSample} from '../src/particle-sampling.js';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));

export default function ParticleIngredients({source,assets,preferences,teamColor,mode,muted,onMute,onSelect,onClose}) {
  const rows=useMemo(()=>effectNodes(source).map(({node,family},index)=>({id:node.ObjectId,label:mode==='Classic'?node.Name:(family==='RibbonEmitters'?'Ribbon ':'Particle ')+(index+1),supported:['ParticleEmitters2','RibbonEmitters'].includes(family)})),[source,mode]);
  const jobs=useMemo(()=>rows.filter(row=>row.supported),[rows]);
  const [index,setIndex]=useState(0),[images,setImages]=useState({}),busy=useRef(false),mounted=useRef(true);
  useEffect(()=>()=>{mounted.current=false;},[]);
  const current=jobs[index];
  const preview=useMemo(()=>{
    if(!current)return null;
    const model=structuredClone(source);
    for(const family of EFFECT_FAMILIES)model[family]=model[family].filter(node=>node.ObjectId===current.id);
    model.Geosets=[];model.GeosetAnims=[];
    return {model,...activeParticleSample(model)};
  },[source,current]);
  const prefs=useMemo(()=>({...preferences,graphics:{...preferences.graphics,pauseWhenHidden:false}}),[preferences]);
  const ready=useCallback(async api=>{
    if(!api||!current||busy.current)return;
    busy.current=true;
    try {
      await api.whenReady();if(!mounted.current)return;
      api.fit();const url=api.captureFrame({maxDimension:256}).toDataURL('image/png');
      setImages(old=>({...old,[current.id]:{url}}));
    } catch(error) {
      if(mounted.current)setImages(old=>({...old,[current.id]:{error:error.message}}));
    } finally {
      busy.current=false;if(mounted.current)setIndex(value=>value+1);
    }
  },[current]);
  return <div className="pe-ingredient-view" role="dialog" aria-label="Effect ingredients" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}}}>
    <header><strong>Ingredients <small>· preview mute</small></strong><button onClick={onClose}>Close ingredients</button></header>
    <div className="pe-ingredient-grid">{rows.map(row=><article key={row.id}>
      <button className="pe-ingredient-select" aria-label={'Edit '+row.label} onClick={()=>onSelect(row.id)}>
        <span className="pe-ingredient-picture">{images[row.id]?.url?<img src={images[row.id].url} alt={row.label}/>:<span>{!row.supported||images[row.id]?.error?'Preview unavailable':'Rendering…'}</span>}</span>
        <span>{row.label}</span>
      </button>
      <button aria-label={'Mute '+row.label} aria-pressed={muted.includes(row.id)} onClick={()=>onMute(row.id)}>{muted.includes(row.id)?'Unmute':'Mute'}</button>
      {images[row.id]?.error&&<small role="status">{images[row.id].error}</small>}
    </article>)}</div>
    {preview&&<div className="pe-thumbnail-renderer" aria-hidden="true"><Suspense fallback={null}><GamePreview key={current.id} presentation="preview" model={preview.model} textureAssets={assets} preferences={prefs} teamColor={teamColor} particleAuthoring sequenceIndex={preview.sequence} time={preview.time} playing={false} showParticles showGrid={false} mode="textured" view="perspective" onCaptureReady={ready}/></Suspense></div>}
  </div>;
}
