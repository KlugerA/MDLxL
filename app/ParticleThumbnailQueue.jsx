import {embeddedParticleAssets} from '../src/particle-assets.js';
import {STARTER_TEXTURE,starterTextureAsset} from '../src/particle-starters.js';
import React,{Suspense,lazy,useEffect,useRef,useState} from 'react';
import {parseParticleData} from '../src/particle-data.js';
import {particleRecipeDocument} from '../src/particle-recipes.js';
import {activeParticleSample} from '../src/particle-sampling.js';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const normalize=value=>String(value||'').replaceAll('/','\\').toLowerCase();
export default function ParticleThumbnailQueue({items,preferences,onThumbnail,onFailure}) {
  const [current,setCurrent]=useState(null),pending=useRef(new Set()),mounted=useRef(true);
  useEffect(()=>()=>{mounted.current=false;},[]);
  useEffect(()=>{
    if(current)return;
    const item=items.find(item=>!item.thumbnail&&!pending.current.has(item.id)&&!item.blocked&&!item.unsupported?.length);
    if(!item)return;
    pending.current.add(item.id);
    (async()=>{
      const cached=await window.desktop.particleThumbnails([item.id]);if(cached[item.id]){if(mounted.current)onThumbnail(item.id,cached[item.id]);return;}
      const recipe=parseParticleData(await window.desktop.particleRead(item.id)),doc=particleRecipeDocument(recipe),assets=embeddedParticleAssets(recipe);
      if(doc.model.Textures.some(t=>t.Image===STARTER_TEXTURE))assets.set(normalize(STARTER_TEXTURE),starterTextureAsset());
      const names=doc.model.Textures.filter(t=>t.Image&&!assets.has(normalize(t.Image))).map(t=>t.Image),sourceKey=recipe.sources?.find(source=>source.buildKey)?.buildKey;
      const records=sourceKey?await window.desktop.particleAssets({sourceKey,dependencies:recipe.dependencies.filter(dep=>names.includes(dep.path))}):await window.desktop.resolveTextures({names});
      for(const record of records||[])if(record.bytes)assets.set(normalize(record.name),record);
      if(mounted.current)setCurrent({id:item.id,model:doc.model,assets,...activeParticleSample(doc.model)});
    })().catch(error=>{if(mounted.current){onFailure?.(item.id,error.message);setCurrent({failed:true,id:item.id});}});
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
    }catch(error){if(mounted.current)onFailure?.(current.id,error.message);}
    finally{capture.current=false;if(mounted.current)setCurrent(null);}
  }
  if(!current||current.failed)return null;
  const previewPreferences={...preferences,graphics:{...preferences.graphics,pauseWhenHidden:false},viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color:'#24282c'}}};
  return <div className="pe-thumbnail-renderer" aria-hidden="true"><Suspense fallback={null}><GamePreview key={current.id} presentation="preview" model={current.model} revision={0} textureAssets={current.assets} preferences={previewPreferences} particleAuthoring sequenceIndex={current.sequence} time={current.time} playing={false} showParticles showGrid={false} mode="textured" view="perspective" overlays={{bones:false,nodes:false,particles:false,attachments:false}} onCaptureReady={ready}/></Suspense></div>;
}
