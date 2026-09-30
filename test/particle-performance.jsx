import React,{useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createNode} from '../src/editor-document.js';
import {createStarterRecipe,starterTextureAsset,STARTER_TEXTURE} from '../src/particle-starters.js';
import {particleRecipeDocument} from '../src/particle-recipes.js';
import {createParticleGesture,particleValue} from '../src/particle-bindings.js';
import {ParticleSlider} from '../app/ParticleCluelessControls.jsx';
import {DEFAULT_PREFERENCES} from '../src/preferences.js';
const query=new URLSearchParams(location.search),baseline=query.has('baseline'),heavy=query.has('heavy');
const {default:Preview}=await import(/* @vite-ignore */baseline?'/out/particle-prototype/baseline/app/GamePreview.jsx':'/app/GamePreview.jsx');
const recipe=createStarterRecipe(),model=recipe.native,count=heavy?32:4,rate=heavy?400:100;
const first=model.ParticleEmitters2[0];Object.assign(first,{EmissionRate:rate,LifeSpan:2,Speed:45,Gravity:0,Variation:0,ParticleScaling:new Float32Array([2,4,0])});
for(let i=1;i<count;i++){const n=createNode(model,'ParticleEmitter2'),id=n.ObjectId,pivot=n.PivotPoint;Object.assign(n,structuredClone(first),{ObjectId:id,PivotPoint:pivot});n.PivotPoint[0]=(i-count/2)*12;}
recipe.ingredients=model.ParticleEmitters2.map(n=>({id:'ingredient-'+n.ObjectId,family:'ParticleEmitters2',objectId:n.ObjectId}));
const doc=particleRecipeDocument(recipe),assets=new Map([[STARTER_TEXTURE.toLowerCase(),starterTextureAsset()]]),preferences={...DEFAULT_PREFERENCES,graphics:{...DEFAULT_PREFERENCES.graphics,pixelRatio:1.5,maxFps:60,pauseWhenHidden:false}};
function Harness(){
 const working=useMemo(()=>structuredClone(model),[]),[revision,setRevision]=useState(0),[time,setTime]=useState(1000),[playing,setPlaying]=useState(true),[status,setStatus]=useState({}),gesture=useRef(null),field=useRef(null);
 const begin=name=>{field.current=name;gesture.current=createParticleGesture({doc,id:0,field:name,options:{frame:time,interval:[0,5000]}});};
 const change=value=>{working.ParticleEmitters2[0][field.current]=gesture.current.update(value);setRevision(v=>v+1);};
 const finish=()=>{gesture.current?.finish();gesture.current=null;};
 const cancel=()=>{if(gesture.current){working.ParticleEmitters2[0][field.current]=gesture.current.cancel();gesture.current=null;setRevision(v=>v+1);}};
 window.fixture={document:doc,working,status,baseline,heavy,playing,pause:()=>{setPlaying(false);setTime(1000);}};
 return <><div id="stage"><Preview presentation="preview" model={model} revision={0} particleAuthoring={!baseline} particleLiveModel={working} particleLiveRevision={revision} particleLiveField={field.current} particleSelectedId={0} onParticleStatus={setStatus} sequenceIndex={0} time={time} onTimeChange={setTime} playing={playing} onPlayingChange={setPlaying} playbackSpeed={100} loop textureAssets={assets} preferences={preferences} showParticles showGrid={false} mode="textured" view="perspective" onCaptureReady={api=>{window.capture=api;}}/></div>{['ParticleScaling','Speed'].map(name=><ParticleSlider key={name} field={name} value={particleValue(working.ParticleEmitters2[0],name,{frame:time,interval:[0,5000]})} {...{begin,change,finish,cancel}}/>)}<p>{status.error||''}</p></>;
}
createRoot(window.document.getElementById('root')).render(<Harness/>);
