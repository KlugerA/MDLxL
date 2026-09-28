const DATABASE='mdlxl-showcase-setups';
async function transaction(mode,operation){
  const database=await new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>request.result.createObjectStore('presets',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{return await new Promise((resolve,reject)=>{const tx=database.transaction('presets',mode),request=operation(tx.objectStore('presets'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Preset storage was interrupted.'));});}finally{database.close();}
}
export const listShowcasePresets=()=>transaction('readonly',store=>store.getAll());
export const saveShowcasePreset=preset=>transaction('readwrite',store=>store.put(preset));

const text=(text,rect,size=28,extra={})=>({kind:'text',text,rect,size,font:'cinzeldecorative',color:'#eee4ce',color2:'#c6a46c',color3:'#7895b2',outlineColor:'#141920',rotation:0,fadeInStart:0,fadeInLength:0,fadeOutStart:9,fadeOutLength:0,effect:'solid',bold:false,italic:false,underline:false,outline:true,opacity:1,...extra});
export const SHOWCASE_PRESETS=[
  {id:'builtin-classic',name:'Classic · title above',cropPreset:'classic',color:'#546477',modelRect:{x:.06,y:.22,width:.88,height:.73},layers:[text('DINO MEGAZORD',{x:.04,y:.03,width:.92,height:.12},30),text('Five Dinozords. One mighty warrior.',{x:.05,y:.14,width:.9,height:.06},14,{font:'lato',outline:false})]},
  {id:'builtin-square',name:'Square · release card',cropPreset:'square',color:'#292f38',modelRect:{x:.06,y:.19,width:.88,height:.65},layers:[text('THUNDER MEGAZORD',{x:.04,y:.03,width:.92,height:.11},27),text('The Thunderzords unite',{x:.06,y:.87,width:.88,height:.07},17,{font:'lora',effect:'shimmer'})]},
  {id:'builtin-left',name:'Wide · model left',cropPreset:'wide',color:'#202936',modelRect:{x:.03,y:.06,width:.53,height:.88},layers:[text('DRAGONZORD',{x:.6,y:.18,width:.36,height:.15},24,{font:'orbitron',effect:'shimmer',color:'#a7edc4'}),text('The Green Ranger calls.\nThe Dragonzord rises.\nMegazord power awaits.',{x:.6,y:.39,width:.36,height:.29},15,{font:'lato',outline:false,textAlign:'left'})]},
  {id:'builtin-right',name:'Wide · model right',cropPreset:'wide',color:'#25303d',modelRect:{x:.44,y:.06,width:.53,height:.88},layers:[text('ASTRO MEGAZORD',{x:.03,y:.18,width:.38,height:.15},22,{font:'orbitron',color:'#c7e9ff'}),text('Megaship and Megashuttle\nunite as the Astro Megazord.\nPower among the stars.',{x:.03,y:.39,width:.38,height:.29},15,{font:'lato',outline:false,textAlign:'left'})]},
  {id:'builtin-tall',name:'Tall · hero showcase',cropPreset:'portrait',color:'#303342',modelRect:{x:.06,y:.04,width:.88,height:.76},layers:[text('NINJA FALCON\nMEGAZORD',{x:.04,y:.81,width:.92,height:.13},28,{font:'cormorantsc',effect:'shimmer'}),text('Ninja power takes flight',{x:.04,y:.95,width:.92,height:.04},14,{font:'lato',outline:false})]},
];
export const withinCrop=(rect,crop)=>({x:crop.x+rect.x*crop.width,y:crop.y+rect.y*crop.height,width:rect.width*crop.width,height:rect.height*crop.height});
export function builtinSetup(preset,crop){
  return {version:1,mode:'sequences',sequenceLength:10,portraitLength:10,orbitSpeed:150,orbitRadius:0,orbitAngle:0,light:'ingame',quality:'high',fps:30,backgroundMode:'color',color:preset.color,crop:null,cropPreset:preset.cropPreset,media:null,backgroundAsset:null,background:'',trim:{start:0,end:0},portraitZoom:100,portraitFrameEnabled:true,grid:false,gridDensity:5,layout:withinCrop(preset.modelRect,crop),layers:preset.layers.map(layer=>({...layer,id:crypto.randomUUID(),size:Math.max(6,layer.size*crop.width),rect:withinCrop(layer.rect,crop)}))};
}
// Blob URLs are session-local. Persist the Blob, then create a fresh URL on load.
export async function snapshotShowcase(setup){
  const asset=async value=>{if(!value)return null;const {url,...rest}=value;if(rest.blob)return rest;if(!url)return rest;const response=await fetch(url);if(!response.ok)throw Error('Could not preserve background media.');return {...rest,blob:await response.blob()};};
  return structuredClone({...setup,media:await asset(setup.media),backgroundAsset:await asset(setup.backgroundAsset),layers:await Promise.all(setup.layers.map(asset))});
}
export function hydrateShowcase(snapshot,urls){
  const setup=structuredClone(snapshot),asset=value=>{if(!value)return null;if(value.blob){value.url=URL.createObjectURL(value.blob);urls.add(value.url);}return value;};
  setup.media=asset(setup.media);setup.backgroundAsset=asset(setup.backgroundAsset);setup.layers=setup.layers.map(asset);return setup;
}
