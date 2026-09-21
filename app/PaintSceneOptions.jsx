import {initialPaintLamp,paintLampDistance,setPaintLampDistance} from './paint-lamps.js';
import React,{useRef,useState} from 'react';
import {WC3_DNC_ENVIRONMENTS} from '../src/warcraft-dnc.js';
import {paintMessage as msg} from '../src/paint-messages.js';

export const DEFAULT_PAINT_SCENE={background:'',backgroundColor:'#cccccc',customBackground:'',backgroundDisplay:'fill',lighting:'flat',environment:'Lordaeron',hour:12,lamps:[],showLamps:true,textureSmoothing:false};
export default function PaintSceneOptions({selectedLampId,onSelectedLamp,value,onChange,backgrounds,onClose,onMove,onPlace,onCamera,dncStatus,onDncFile}) {
  const [selected,setSelected]=useState(()=>Math.max(0,value.lamps.findIndex(l=>l.id===selectedLampId))),backgroundFile=useRef(),dncFile=useRef(),lamp=value.lamps[selected];
  const set=(key,next)=>onChange({...value,[key]:next}),editLamp=change=>set('lamps',value.lamps.map((item,index)=>index===selected?{...item,...change}:item));
  const radius=onCamera?.()?.radius||100;
  function add(){const pose=initialPaintLamp(onCamera?.()),id=crypto.randomUUID();setSelected(value.lamps.length);onChange({...value,lighting:value.lighting==='flat'?'lamps':value.lighting,showLamps:true,lamps:[...value.lamps,{id,type:0,color:'#ffffff',...pose,enabled:true}]});onSelectedLamp?.(id);}

  return <div className="paint-modal-shade" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();}}><section className="paint-scene-dialog" role="dialog" aria-modal="true" aria-label={msg('paint.scene')}>
    <header><strong>{msg('paint.scene')}</strong><button autoFocus onClick={onClose}>{msg('paint.close')}</button></header>
    <div className="paint-scene-columns"><section><h3>{msg('paint.background')}</h3>
      <select aria-label={msg('paint.background')} value={value.background} onChange={e=>onChange({...value,background:e.target.value,customBackground:''})}><option value="">{msg('paint.solidBackground')}</option>{backgrounds.items.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <label className="paint-color">{msg('paint.backgroundColor')}<input type="color" value={value.backgroundColor} onChange={e=>set('backgroundColor',e.target.value)}/></label>
      <div className="paint-button-row"><button onClick={()=>backgroundFile.current.click()}>{msg('paint.chooseImage')}</button>{backgrounds.openFolder&&<button onClick={backgrounds.openFolder}>{msg('paint.openFolder')}</button>}<button onClick={backgrounds.refresh}>{msg('paint.refresh')}</button></div>
      <input ref={backgroundFile} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const file=e.target.files[0];if(file){const reader=new FileReader();reader.onload=()=>onChange({...value,background:'',customBackground:reader.result});reader.readAsDataURL(file);}e.target.value='';}}/>
      <label>{msg('paint.imageFit')}<select value={value.backgroundDisplay} onChange={e=>set('backgroundDisplay',e.target.value)}>{['fit','fill','stretch','center'].map(id=><option key={id} value={id}>{msg('paint.image.'+id)}</option>)}</select></label>
      <h3>{msg('paint.wc3Light')}</h3><select aria-label={msg('paint.wc3Light')} value={value.lighting} onChange={e=>set('lighting',e.target.value)}><option value="flat">{msg('paint.light.flat')}</option><option value="dnc">{msg('paint.light.dnc')}</option><option value="lamps">{msg('paint.light.lamps')}</option></select>
      {value.lighting==='dnc'&&<><select aria-label={msg('paint.environment')} value={value.environment} onChange={e=>onChange({...value,environment:e.target.value,dncModel:null})}>{WC3_DNC_ENVIRONMENTS.map(name=><option key={name}>{name}</option>)}{value.environment==='custom'&&<option value="custom">{msg('paint.custom')}</option>}</select>
        <label>{msg('paint.timeOfDay')}<input type="range" min="0" max="23.99" step=".05" value={value.hour} onChange={e=>set('hour',+e.target.value)}/><output>{String(Math.floor(value.hour)).padStart(2,'0')}:{String(Math.round((value.hour%1)*60)).padStart(2,'0')}</output></label>
        <div className="paint-button-row">{[['dawn',6],['noon',12],['dusk',18],['midnight',0]].map(([id,hour])=><button key={id} onClick={()=>set('hour',hour)}>{msg('paint.time.'+id)}</button>)}</div>
        <p role="status">{dncStatus}</p><button onClick={()=>dncFile.current.click()}>{msg('paint.openDnc')}</button>
        <input hidden ref={dncFile} type="file" accept=".mdl,.mdx" onChange={async e=>{const file=e.target.files[0];if(file)await onDncFile(file);e.target.value='';}}/>
      </>}
    </section><section><h3>{msg('paint.lamps')}</h3><button disabled={value.lamps.length>=4} onClick={add}>{msg('paint.addLamp')}</button>
      {value.lamps.length>0&&<><select aria-label={msg('paint.lamps')} value={Math.min(selected,value.lamps.length-1)} onChange={e=>{setSelected(+e.target.value);onSelectedLamp?.(value.lamps[+e.target.value].id);}}>{value.lamps.map((item,i)=><option key={item.id} value={i}>{msg('paint.lampNumber',{number:i+1})}</option>)}</select>
        {lamp&&<><label className="paint-check"><input type="checkbox" checked={lamp.enabled} onChange={e=>editLamp({enabled:e.target.checked})}/>{msg('paint.lampOn')}</label>
          <p>{msg('paint.omni')}</p>
          <label className="paint-color">{msg('paint.lightColor')}<input type="color" value={lamp.color} onChange={e=>editLamp({color:e.target.value})}/></label>
          <label>{msg('paint.lampDistance')}<input aria-label={msg('paint.lampDistance')} type="range" min=".1" max={Math.max(radius*6,paintLampDistance(lamp))} step=".1" value={paintLampDistance(lamp)} onChange={e=>editLamp(setPaintLampDistance(lamp,+e.target.value))}/><output>{Math.round(paintLampDistance(lamp))}</output></label>
          <p className="paint-help">{msg('paint.lampDistanceHelp')}</p>
          <div className="paint-button-row"><button onClick={()=>{if(!value.showLamps)set('showLamps',true);onSelectedLamp?.(lamp.id);onMove?.(lamp.id);onClose();}}>{msg('paint.moveLamp')}</button><button onClick={()=>{onPlace(lamp.id);onClose();}}>{msg('paint.placeLamp')}</button><button onClick={()=>{const pose=initialPaintLamp(onCamera?.());editLamp(pose);}}>{msg('paint.lampCamera')}</button></div>
          <button onClick={()=>{set('lamps',value.lamps.filter((_,i)=>i!==selected));setSelected(0);onSelectedLamp?.(null);}}>{msg('paint.removeLamp')}</button>
        </>}
        <label className="paint-check"><input type="checkbox" checked={value.showLamps} onChange={e=>set('showLamps',e.target.checked)}/>{msg('paint.showLamps')}</label>
      </>}
      <p className="paint-help">{msg('paint.lampHelp')}</p>
    </section></div><footer>{msg('paint.lightingHelp')}</footer>
  </section></div>;
}
