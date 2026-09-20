import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import GamePreview from '../app/GamePreview.jsx';
import {createDemoDocument} from '../src/editor-document.js';
import {normalizePreferences} from '../src/preferences.js';
import '../app/styles.css';
const initial=createDemoDocument().model,preferences=normalizePreferences({graphics:{particles:false,antialias:false},platform:{enabled:false}});
function Check(){
  const [model,setModel]=useState(initial),[revision,setRevision]=useState(0),[projection,setProjection]=useState({revision:0}),[matrix,setMatrix]=useState(null);
  const edit=()=>{setModel(old=>{const next=structuredClone(old);for(const geoset of next.Geosets)for(const uv of geoset.TVertices)for(let i=0;i<uv.length;i++)uv[i]=uv[i]*25+100;return next;});setRevision(value=>value+1);};
  return <><button onClick={()=>setProjection(value=>({name:'front',revision:value.revision+1}))}>Front projection</button><button onClick={edit}>Large UV edit and rebuild</button><button onClick={()=>{setModel(structuredClone(initial));setRevision(value=>value+1);}}>Undo UV edit and rebuild</button>
    <output aria-label="Camera matrices">{JSON.stringify(matrix)}</output>
    <div style={{width:640,height:420}}><GamePreview model={model} revision={revision} preferences={preferences} presentation="preview" preserveCameraView restPose view="orthographic" cameraMode="rotate" cameraPresetRequest={projection} sequenceIndex={-1} time={0} playing={false} showParticles={false} onProjectionViewChange={setMatrix}/></div>
    <div className="classic-geosets" style={{width:160}}><div className="classic-geoset-list" role="listbox" aria-label="Geoset ordering test" style={{'--geoset-rows':3}}>{Array.from({length:12},(_,i)=><div className="geoset-row" role="option" key={i}>{i+1}</div>)}</div></div>
  </>;
}
createRoot(document.getElementById('root')).render(<Check/>);
