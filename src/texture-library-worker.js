import {prepareTextureLibrary,searchTextureLibrary} from './texture-library-search.js';
let prepared=[],signature=null;
self.onmessage=({data})=>{
  try {
    if(data.type==='init'){if(!data.signature||data.signature!==signature){prepared=prepareTextureLibrary(data.items);signature=data.signature;}self.postMessage({type:'ready',signature});return;}
    if(data.signature && data.signature!==signature)throw Error('Texture library source changed during search.');
    const result=searchTextureLibrary(prepared,data.options);
    result.items=result.items.map(item=>Object.fromEntries(Object.entries(item).filter(([key])=>!key.startsWith('_')||key==='_match')));
    self.postMessage({type:'result',id:data.id,signature,result});
  } catch(error){self.postMessage({type:'error',id:data.id,signature:data.signature,message:error.message});}
};
