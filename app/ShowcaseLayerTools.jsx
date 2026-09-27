import React, { useEffect, useRef, useState } from 'react';
import { listSignaturePresets, saveSignaturePreset, deleteSignaturePreset } from './showcase-signature.js';
import { SHOWCASE_FONTS, TEXT_EFFECTS } from './showcase-text.js';
import './showcase-fonts.css';

const TEXT_COLORS=['#ffffff','#9f63ff','#20d676','#1ea5e9','#e739a6','#ff4a24','#e3ba36'];
export default function ShowcaseLayerTools({layers,onLayers,activeId,onActive,onEditing,onStatus}) {
  const [signaturesOpen,setSignaturesOpen]=useState(false),[textOpen,setTextOpen]=useState(false),[presets,setPresets]=useState([]),[presetName,setPresetName]=useState('');
  const input=useRef(null),urls=useRef(new Set());
  const active=layers.find(layer=>layer.id===activeId),images=layers.filter(layer=>layer.kind==='image'),texts=layers.filter(layer=>layer.kind==='text');
  useEffect(()=>{let live=true;listSignaturePresets().then(rows=>{if(live)setPresets(rows);}).catch(error=>onStatus?.('Could not load signature presets: '+error.message,true));return()=>{live=false;};},[]);
  useEffect(()=>{onEditing(signaturesOpen||textOpen);},[signaturesOpen,textOpen,onEditing]);
  useEffect(()=>{setPresetName(active?.kind==='image'?active.name.replace(/\.[^.]+$/,''):'');},[activeId]);
  useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);},[]);
  const update=patch=>onLayers(layers.map(layer=>layer.id===activeId?{...layer,...patch}:layer));
  function addImage(blob,name,type,presetId=null,rect){
    const id=crypto.randomUUID(),url=URL.createObjectURL(blob);urls.current.add(url);
    return {id,kind:'image',blob,name,type,url,presetId,opacity:1,rect:rect||{x:.12+(images.length%4)*.06,y:.68-(images.length%4)*.06,width:.28,height:.2}};
  }
  function choose(event){
    const files=Array.from(event.target.files||[]);event.target.value='';
    const added=files.filter(file=>file.type.startsWith('image/')||/\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)).map((file,index)=>addImage(file,file.name,/\.gif$/i.test(file.name)?'image/gif':file.type||'image/png',null,{x:.12+index*.05,y:.68-index*.05,width:.28,height:.2}));
    if(added.length){onLayers([...layers,...added]);onActive(added.at(-1).id);}
    if(added.length<files.length)onStatus?.('Choose images or GIFs for signatures.',true);
  }
  function addText(){
    const layer={id:crypto.randomUUID(),kind:'text',text:'Your text',font:'cinzeldecorative',size:48,color:'#ffffff',effect:'solid',bold:false,italic:false,underline:false,outline:false,opacity:1,rect:{x:.1,y:.12,width:.8,height:.18}};
    onLayers([...layers,layer]);onActive(layer.id);setTextOpen(true);setSignaturesOpen(false);
  }
  function remove(){
    if(!active)return;if(active.url){URL.revokeObjectURL(active.url);urls.current.delete(active.url);}
    const next=layers.filter(layer=>layer.id!==activeId);onLayers(next);onActive(next.filter(layer=>layer.kind===active.kind).at(-1)?.id||null);
  }
  function reorder(direction){
    const index=layers.findIndex(layer=>layer.id===activeId),target=index+direction;if(index<0||target<0||target>=layers.length)return;
    const next=[...layers];[next[index],next[target]]=[next[target],next[index]];onLayers(next);
  }
  function select(id,kind){onActive(id);setSignaturesOpen(kind==='image');setTextOpen(kind==='text');}
  async function savePreset(){
    if(active?.kind!=='image')return;
    try{const preset={id:active.presetId||crypto.randomUUID(),name:presetName.trim()||active.name,type:active.type,blob:active.blob,rect:active.rect,opacity:active.opacity};
      await saveSignaturePreset(preset);update({presetId:preset.id});setPresets(await listSignaturePresets());onStatus?.('Signature preset saved.');
    }catch(error){onStatus?.('Could not save signature preset: '+error.message,true);}
  }
  async function deletePreset(){
    try{await deleteSignaturePreset(active.presetId);update({presetId:null});setPresets(await listSignaturePresets());}catch(error){onStatus?.('Could not remove signature preset: '+error.message,true);}
  }
  function layerList(rows,kind){return rows.length>0&&<ol className="showcase-layer-list" aria-label={kind==='image'?'Signatures':'Text layers'}>{rows.map((layer,index)=><li key={layer.id}><button aria-pressed={activeId===layer.id} onClick={()=>select(layer.id,kind)}>{kind==='image'&&<img src={layer.url} alt=""/>}<span>{kind==='text'?layer.text||'Empty text':layer.name}</span><small>{index+1}</small></button></li>)}</ol>;}
  function actions(){return <div className="showcase-layer-actions"><button title="Send backward" aria-label="Send layer backward" disabled={layers[0]?.id===activeId} onClick={()=>reorder(-1)}>↓</button><button title="Bring forward" aria-label="Bring layer forward" disabled={layers.at(-1)?.id===activeId} onClick={()=>reorder(1)}>↑</button><button onClick={remove}>Remove</button></div>;}
  return <>
    <section className="showcase-section showcase-layer-tools" aria-label="Signature">
      <header><button className="showcase-section-toggle" aria-expanded={signaturesOpen} onClick={()=>{setSignaturesOpen(!signaturesOpen);setTextOpen(false);if(active?.kind!=='image')onActive(images.at(-1)?.id||null);}}>Signature{images.length?' · '+images.length:''}</button><button onClick={()=>{setSignaturesOpen(true);setTextOpen(false);input.current.click();}}>Add</button></header>
      <input ref={input} hidden multiple type="file" accept="image/*,.gif" onChange={choose}/>
      {signaturesOpen&&<>
        {layerList(images,'image')}
        <select className="showcase-wide" aria-label="Signature presets" value="" onChange={event=>{const preset=presets.find(row=>row.id===event.target.value);if(preset){const layer=addImage(preset.blob,preset.name,preset.type,preset.id,preset.rect);layer.opacity=preset.opacity??1;onLayers([...layers,layer]);onActive(layer.id);}}}><option value="">Add preset…</option>{presets.map(preset=><option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>
        {active?.kind==='image'&&<><small>Drag to place · corner to resize</small><label>Opacity<input aria-label="Signature opacity" type="range" min="0" max="100" value={Math.round(active.opacity*100)} onChange={event=>update({opacity:Number(event.target.value)/100})}/></label>
          <input className="showcase-wide" aria-label="Signature preset name" value={presetName} onChange={event=>setPresetName(event.target.value)} placeholder="Preset name"/>
          <div className="showcase-layer-actions"><button onClick={savePreset}>Save preset</button>{active.presetId&&<button onClick={deletePreset}>Delete preset</button>}</div>{actions()}</>}
      </>}
    </section>
    <section className="showcase-section showcase-layer-tools" aria-label="Text">
      <header><button className="showcase-section-toggle" aria-expanded={textOpen} onClick={()=>{setTextOpen(!textOpen);setSignaturesOpen(false);if(active?.kind!=='text')onActive(texts.at(-1)?.id||null);}}>Text{texts.length?' · '+texts.length:''}</button><button onClick={addText}>Add</button></header>
      {textOpen&&<>{layerList(texts,'text')}{active?.kind==='text'&&<>
        <textarea className="showcase-wide" aria-label="Text content" rows="2" value={active.text} onChange={event=>update({text:event.target.value})}/>
        <div className="showcase-font-grid" role="group" aria-label="Choose font">{SHOWCASE_FONTS.map(font=><button title={font.name} key={font.id} aria-pressed={active.font===font.id} onClick={()=>update({font:font.id})}><strong style={{fontFamily:'"'+font.family+'"'}}>Aa</strong><small>{font.name}</small></button>)}</div>
        <label>Size<input aria-label="Text size" type="number" min="6" max="300" value={active.size} onChange={event=>update({size:Math.max(6,Number(event.target.value)||6)})}/><div className="showcase-text-style">{[['bold','B'],['italic','I'],['underline','U'],['outline','Outline']].map(([key,label])=><button key={key} aria-label={label==='B'?'Bold':label==='I'?'Italic':label==='U'?'Underline':label} aria-pressed={!!active[key]} onClick={()=>update({[key]:!active[key]})}>{label}</button>)}</div></label>
        <div className="showcase-text-colors" role="group" aria-label="Text color">{TEXT_COLORS.map(value=><button key={value} aria-label={'Text color '+value} aria-pressed={active.color===value} style={{backgroundColor:value}} onClick={()=>update({color:value})}/>)}<input type="color" aria-label="Custom text color" value={active.color} onChange={event=>update({color:event.target.value})}/></div>
        <div className="showcase-effect-grid" role="group" aria-label="Choose animated text effect">{TEXT_EFFECTS.map(([id,name])=><button key={id} className={'showcase-effect-tile '+id} aria-pressed={active.effect===id} onClick={()=>update({effect:id})}><span>{name}</span></button>)}</div>
        <small>Drag to place · corner to resize</small>{actions()}
      </>}</>}
    </section>
  </>;
}
