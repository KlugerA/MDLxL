import React,{Suspense,lazy,useEffect,useRef,useState} from 'react';
import {parseParticleData} from '../src/particle-data.js';
import {particleRecipeDocument} from '../src/particle-recipes.js';
import {sampleTrack} from '../src/animation.js';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const normalize=value=>String(value||'').replaceAll('/','\\').toLowerCase();
export function activeParticleSample(model) {
  let chosen={sequence:0,time:model.Sequences?.[0]?.Interval?.[0]||0,score:-1};
  for(const [sequence,clip]of (model.Sequences||[]).entries()){
    const [start,end]=clip.Interval;if(!(end>start))continue;
    for(let i=1;i<=8;i++){
      const time=start+(end-start)*i/9;
      let score=0;
      for(const emitter of model.ParticleEmitters2){
        const at=field=>sampleTrack(emitter[field],time,{interval:clip.Interval,globalSequences:model.GlobalSequences,globalTime:time,fallback:[field==='Visibility'?1:0]})[0];
        score+=Math.max(0,at('EmissionRate'))*(at('Visibility')>0?1:0);
      }
      score+=model.RibbonEmitters.length;
      if(score>chosen.score)chosen={sequence,time,score};
    }
  }
  return chosen;
}
export default function ParticleThumbnailQueue({items,preferences,onThumbnail}) {
  const [current,setCurrent]=useState(null),pending=useRef(new Set()),mounted=useRef(true);
  useEffect(()=>()=>{mounted.current=false;},[]);
  useEffect(()=>{
    if(current)return;
    const item=items.find(item=>!item.thumbnail&&!pending.current.has(item.id)&&!item.unsupported?.length);
    if(!item)return;
    pending.current.add(item.id);
    (async()=>{
      const recipe=parseParticleData(await window.desktop.particleRead(item.id)),doc=particleRecipeDocument(recipe),assets=new Map();
      const records=await window.desktop.resolveTextures({names:doc.model.Textures.filter(t=>t.Image).map(t=>t.Image)});
      for(const record of records||[])if(record.bytes)assets.set(normalize(record.name),record);
      if(mounted.current)setCurrent({id:item.id,model:doc.model,assets,...activeParticleSample(doc.model)});
    })().catch(()=>{if(mounted.current)setCurrent({failed:true,id:item.id});});
  },[items,current]);
  useEffect(()=>{if(current?.failed)setCurrent(null);},[current]);
  const capture=useRef(false);
  async function ready(api){
    if(!api||capture.current||!current)return;capture.current=true;
    try{
      await api.whenReady();api.fit();
      const url=api.captureFrame({maxDimension:256}).toDataURL('image/png');
      await window.desktop.particleThumbnail({id:current.id,url});
      if(mounted.current)onThumbnail(current.id,url);
    }catch(error){/* The catalogue retains its explicit missing-preview state. */}
    finally{capture.current=false;if(mounted.current)setCurrent(null);}
  }
  if(!current||current.failed)return null;
  const previewPreferences={...preferences,graphics:{...preferences.graphics,pauseWhenHidden:false},viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color:'#24282c'}}};
  return <div className="pe-thumbnail-renderer" aria-hidden="true"><Suspense fallback={null}><GamePreview key={current.id} presentation="preview" model={current.model} revision={0} textureAssets={current.assets} preferences={previewPreferences} particleAuthoring sequenceIndex={current.sequence} time={current.time} playing={false} showParticles showGrid={false} mode="textured" view="perspective" overlays={{bones:false,nodes:false,particles:false,attachments:false}} onCaptureReady={ready}/></Suspense></div>;
}
