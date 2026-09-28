import React, { useEffect, useRef, useState } from 'react';
import { listSignaturePresets, saveSignaturePreset, deleteSignaturePreset } from './showcase-signature.js';
import { SHOWCASE_FONTS, TEXT_EFFECTS } from './showcase-text.js';
import './showcase-fonts.css';
import ShowcaseNumber from './ShowcaseNumber.jsx';

export default function ShowcaseLayerTools({layers,onLayers,activeId,onActive,onEditing,onStatus,length=10,grid,onGrid,gridDensity,onGridDensity,onAlign}) {
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
    const layer={id:crypto.randomUUID(),kind:'text',text:'Your text',font:'cinzeldecorative',size:48,color:'#ffffff',color2:'#c6a46c',color3:'#7895b2',outlineColor:'#111111',rotation:0,fadeInStart:0,fadeInLength:0,fadeOutStart:Math.max(0,length-1),fadeOutLength:0,effect:'solid',bold:false,italic:false,underline:false,outline:false,opacity:1,rect:{x:.1,y:.12,width:.8,height:.18}};
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

        <div className="showcase-font-palette">
          <div className="showcase-font-grid" role="group" aria-label="Choose font">{SHOWCASE_FONTS.map(font=><button title={font.name} aria-label={font.name} key={font.id} aria-pressed={active.font===font.id} onClick={()=>update({font:font.id})}><span style={{fontFamily:'"'+font.family+'"'}}>Aa</span></button>)}</div>
          <div className="showcase-text-colors" role="group" aria-label="Text colors">{[['color','1','Main color','#ffffff'],['color2','2','Gradient color 2','#c6a46c'],['color3','3','Gradient color 3','#7895b2']].map(([key,label,title,fallback])=><label key={key} title={title}><span>{label}</span><input type="color" aria-label={title} value={active[key]||fallback} onChange={event=>update({[key]:event.target.value})}/></label>)}</div>
        </div>
        <div className="showcase-text-format">
          <label title="Text size">Size<ShowcaseNumber key={active.id} aria-label="Text size" min={6} max={300} value={active.size} onChange={size=>update({size})}/></label>
          <div className="showcase-text-style">{[['bold','B','Bold'],['italic','I','Italic'],['underline','U','Underline'],['outline','O','Outline']].map(([key,label,title])=><button className={key} style={key==='outline'?{color:'#ffffff'}:undefined} key={key} title={title} aria-label={title} aria-pressed={!!active[key]} onClick={()=>update({[key]:!active[key]})}>{label}</button>)}</div>
          <input className="showcase-outline-color" type="color" aria-label="Outline color" title="Outline color" value={active.outlineColor||'#111111'} onChange={event=>update({outlineColor:event.target.value})}/>
          <button className="showcase-grid-toggle" title="Alignment grid" aria-label="Alignment grid" aria-pressed={!!grid} onClick={()=>onGrid(!grid)}><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 2H16V16H2ZM7 2V16M12 2V16M2 7H16M2 12H16" fill="none" stroke="#08651d" strokeWidth="3"/><path d="M2 2H16V16H2ZM7 2V16M12 2V16M2 7H16M2 12H16" fill="none" stroke="#39ff58" strokeWidth="1.3"/></svg></button>
          <ShowcaseNumber className="showcase-grid-density" aria-label="Grid density" title="Grid density · 1–99" min={1} max={99} value={gridDensity} onChange={value=>onGridDensity(Math.round(value))}/>
        </div>
        <details className="showcase-align"><summary title="Align text">Align</summary><div className="showcase-align-menu"><div className="showcase-paragraph-align">{['left','center','right'].map(value=><button key={value} title={'Align lines '+value} aria-label={'Align lines '+value} aria-pressed={(active.textAlign||'center')===value} onClick={()=>update({textAlign:value})}><svg width="18" height="15" viewBox="0 0 18 15" aria-hidden="true"><path d={value==='left'?'M2 3H16M2 7H11M2 11H14':value==='right'?'M2 3H16M7 7H16M4 11H16':'M2 3H16M5 7H13M3 11H15'} fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></button>)}</div><div className="showcase-align-grid">{[0,1,2].flatMap(y=>[0,1,2].map(x=><button key={x+':'+y} title={['Top','Middle','Bottom'][y]+' '+['left','center','right'][x]} aria-label={'Place text '+['top','middle','bottom'][y]+' '+['left','center','right'][x]} onClick={()=>onAlign(active.id,x,y)}>{[['↖','↑','↗'],['←','·','→'],['↙','↓','↘']][y][x]}</button>))}</div></div></details>
        <div className="showcase-effect-grid" role="group" aria-label="Choose animated text effect">{TEXT_EFFECTS.map(([id,name])=><button key={id} className={'showcase-effect-tile '+id} style={{backgroundColor:'#252833',color:'#e6dfe9'}} aria-pressed={active.effect===id} onClick={()=>update({effect:id})}><span>{name}</span></button>)}</div>
        <details className="showcase-text-fades"><summary>Fades</summary><div className="showcase-fade-grid"><span/><small>Start (s)</small><small>Length (s)</small>{[['In','fadeIn'],['Out','fadeOut']].map(([label,key])=><React.Fragment key={key}><span>{label}</span><input type="number" aria-label={'Fade '+label.toLowerCase()+' start'} min="0" step=".1" value={active[key+'Start']||0} onChange={event=>update({[key+'Start']:Math.max(0,Number(event.target.value)||0)})}/><input type="number" aria-label={'Fade '+label.toLowerCase()+' length'} title="Length in seconds; 0 turns the fade off" min="0" step=".1" value={active[key+'Length']||0} onChange={event=>update({[key+'Length']:Math.max(0,Number(event.target.value)||0)})}/></React.Fragment>)}</div></details><small>Drag to place · corner to resize · ↻ to rotate</small>{actions()}
      </>}</>}
    </section>
  </>;
}
