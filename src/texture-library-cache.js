const MAX_BYTES=48*1024*1024,MAX_ITEMS=768;
let database, writes=0;
const memory=new Map();
async function db() {
  if(typeof indexedDB==='undefined')return null;
  if(!database)database=new Promise(resolve=>{
    const request=indexedDB.open('mdlvis-texture-library',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('thumbnails',{keyPath:'key'}).createIndex('time','time');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);
  });
  return database;
}
function remember(key,url){memory.delete(key);memory.set(key,url);while(memory.size>192)memory.delete(memory.keys().next().value);}
export function peekThumbnail(key) { return memory.get(key) || null; }
export async function cachedThumbnail(key) {
  if(memory.has(key)){const url=memory.get(key);remember(key,url);return url;}
  const database=await db();if(!database)return null;
  return new Promise(resolve=>{
    const request=database.transaction('thumbnails').objectStore('thumbnails').get(key);
    request.onsuccess=()=>{const url=request.result?.url;if(url)remember(key,url);resolve(url||null);};request.onerror=()=>resolve(null);
  });
}
export async function saveThumbnail(key,url) {
  remember(key,url);const database=await db();if(!database)return;
  await new Promise(resolve=>{
    const tx=database.transaction('thumbnails','readwrite');
    tx.objectStore('thumbnails').put({key,url,time:Date.now(),size:url.length*2});tx.oncomplete=resolve;tx.onerror=resolve;
  });
  if(++writes%12)return;
  await new Promise(resolve=>{
    const tx=database.transaction('thumbnails','readwrite'),store=tx.objectStore('thumbnails'),request=store.index('time').getAll();
    request.onsuccess=()=>{
      const entries=request.result;let bytes=entries.reduce((sum,item)=>sum+item.size,0),count=entries.length;
      for(const item of entries){if(bytes<=MAX_BYTES&&count<=MAX_ITEMS)break;store.delete(item.key);bytes-=item.size;count--;}
    };tx.oncomplete=resolve;tx.onerror=resolve;
  });
}
