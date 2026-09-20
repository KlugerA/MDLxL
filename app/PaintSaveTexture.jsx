import React,{useState} from 'react';
import {encodePaintPng} from '../src/paint-project.js';
import {encodePaintBlp1,encodePaintDds} from '../src/paint-blp.js';
import {paintMessage as msg} from '../src/paint-messages.js';

export default function PaintSaveTexture({source,folders,onClose,onSaved}) {
  const [name,setName]=useState(source.name.split(/[\\/]/).at(-1).replace(/\.[^.]+$/,'')),[folder,setFolder]=useState(''),[format,setFormat]=useState('blp'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const native=!!window.desktop?.savePaintTexture;
  async function save(external=false){
    if(busy)return;setBusy(true);setError('');
    try{
      if(!name.trim()||/[\\/:<>?"*|]/.test(name))throw Error(msg('paint.filenameHelp'));
      const bytes=format==='blp'?await encodePaintBlp1(source.raster,{jpegQuality:90}):format==='dds'?await encodePaintDds(source.raster):await encodePaintPng(source.raster),filename=name.trim()+'.'+format;
      let result;
      if(native)result=await window.desktop[external?'exportPaintTexture':'savePaintTexture']({name:filename,folder,bytes});
      else {const url=URL.createObjectURL(new Blob([bytes])),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);result={name:filename};}
      if(result){await onSaved?.({...result,bytes,raster:source.raster,format,textureName:result.name||filename});onClose();}
    }catch(e){setError(e?.message||'Could not save this texture. Your paint is still open.');}finally{setBusy(false);}
  }
  return <div className="paint-modal-shade" onKeyDown={e=>e.stopPropagation()}><section role="dialog" aria-modal="true" aria-label={msg('paint.saveTexture')} className="paint-save-dialog">
    <h3>{msg('paint.saveTexture')}</h3><label>{msg('paint.textureName')}<input value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>{msg('paint.format')}<select value={format} onChange={e=>setFormat(e.target.value)}><option value="png">PNG</option><option value="blp">BLP1 · Warcraft III</option><option value="dds">DDS · DXT5 with alpha</option></select></label>
    {native&&<label>{msg('paint.destination')}<input list="paint-save-folders" value={folder} placeholder={msg('paint.newFolderExample')} onChange={e=>setFolder(e.target.value)}/><datalist id="paint-save-folders">{folders.map(value=><option key={value} value={value}/>)}</datalist><small>{msg('paint.folderHelp')}</small></label>}
    <p>{source.raster.width} × {source.raster.height} · {msg('paint.saveCopyHelp')}</p>{error&&<p role="alert">{error}</p>}
    <footer><button disabled={busy} onClick={()=>save()}>{msg(native?'paint.saveToShelf':'paint.saveTexture')}</button>{native&&<button disabled={busy} onClick={()=>save(true)}>{msg('paint.saveElsewhere')}</button>}<button disabled={busy} onClick={onClose}>{msg('paint.cancel')}</button></footer>
  </section></div>;
}
