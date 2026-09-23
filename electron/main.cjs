const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell, nativeTheme } = require('electron');
const APPLICATION_THEMES = require('../src/application-themes.json');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {RecoveryStore}=require('./recovery.cjs');
const {SettingsStore}=require('./settings.cjs');
const {buildMenuTemplate,normalizeMenuChecks}=require('./menu.cjs');
const {GameDataDiscovery,selectedGameDataSources}=require('./game-data.cjs');
const {TextureResolver,IMAGE_EXTENSIONS}=require('./texture-resolver.cjs');
const {CascTextures}=require('./casc.cjs');
const {HUMAN_PORTRAIT_RESOURCES,validateHumanPortraitResources}=require('./human-portrait-frame.cjs');
const {TextureLibrary}=require('./texture-library.cjs');
const {TexturePreviewCache}=require('./texture-preview-cache.cjs');
const {SessionJournal}=require('./session.cjs');
const {savePreviewCapture}=require('./preview-capture.cjs');
const {PreviewRecordingStore}=require('./preview-ffmpeg.cjs');
const {saveForgeAssets}=require('./forge-assets.cjs');
const {BackgroundLibrary}=require('./preview-backgrounds.cjs');
const {PaintTextureLibrary}=require('./paint-textures.cjs');
const {BitsAndPartsLibrary}=require('./bits-and-parts.cjs');
let bitsAndPartsLibrary;
function getBitsAndPartsLibrary() { return bitsAndPartsLibrary ||= new BitsAndPartsLibrary(path.join(app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(), 'BitsAndParts')); }
let previewBackgroundLibrary;
let paintTextureLibrary;
function getPaintTextureLibrary() {
  return paintTextureLibrary ||= new PaintTextureLibrary(path.join(app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(),'Textures'),path.resolve(__dirname,'../dist/paint-assets'));
}
function getPreviewBackgroundLibrary() {
  return previewBackgroundLibrary ||= new BackgroundLibrary({directory:path.join(app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(),'Backgrounds'),bundledDirectory:path.resolve(__dirname,'../dist/backgrounds')});
}
app.setName('MDLxL');
if (process.platform === 'win32') app.setAppUserModelId('com.mdlxl.editor');
const profile = process.env.MDLXL_PROFILE || path.resolve(__dirname,'../profile');
app.setPath('userData',profile);
let win, dirty=false, recents=[],settings={},initialModel=null;
let settingsStore,preferenceApi,commandCatalog;
let nativeEditorState={readOnly:true,saving:false};
let translateText=value=>value;
let gameDataDiscovery,recoveryPrompt=false,crashedWithEdits=false;
let saveQueue=Promise.resolve();
let artifactSaveQueue=Promise.resolve();
let captureBusy=false;
const captureOperations=new Set();
const previewRecordings=new PreviewRecordingStore({destination:path.join(app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(), 'Screenshots')});
function captureOperation(operation){captureOperations.add(operation);operation.finally(()=>captureOperations.delete(operation)).catch(()=>{});return operation;}
function captureOwner(event){if(event.sender!==win?.webContents)throw Error('Preview capture is unavailable in this window.');return event.sender.id;}
const recoveryStore=new RecoveryStore(path.join(profile,'recovery'));
const sessionJournal=new SessionJournal(path.join(profile,'sessions'));
const createTextureResolver=()=>new TextureResolver({ casc: new CascTextures({cacheDirectory:path.join(profile,'native-textures')}) });
let textureResolver=createTextureResolver();
let textureLibrary=new TextureLibrary({casc:textureResolver.casc});
const texturePreviews=new TexturePreviewCache({directory:path.join(profile,'texture-previews'),onProgress:status=>{if(win&&!win.isDestroyed())win.webContents.send('texture:preloadProgress',status);}});
let textureDecoder=null;
const thumbnailRequests=new Map();
function rejectThumbnailRequests(message){for(const request of thumbnailRequests.values()){clearTimeout(request.timer);request.reject(Error(message));}thumbnailRequests.clear();}
function decodeThumbnail(asset){
  if(!textureDecoder||textureDecoder.isDestroyed())return Promise.reject(Error('Texture preview decoder is unavailable.'));
  return new Promise((resolve,reject)=>{
    const requestId=crypto.randomBytes(12).toString('hex');
    const timer=setTimeout(()=>{thumbnailRequests.delete(requestId);reject(Error('Texture preview decoding timed out.'));},30000);
    thumbnailRequests.set(requestId,{resolve,reject,timer,sender:textureDecoder});
    textureDecoder.send('texture:preloadDecode',{requestId,name:asset.name,bytes:asset.bytes});
  });
}
ipcMain.on('texture:decoderReady',(event,ready)=>{if(event.sender!==win?.webContents)return;textureDecoder=ready?event.sender:null;if(!ready){texturePreviews.cancel();rejectThumbnailRequests('Texture preview decoder closed.');}});
ipcMain.on('texture:decoded',(event,payload)=>{const request=thumbnailRequests.get(payload?.requestId);if(!request||request.sender!==event.sender)return;clearTimeout(request.timer);thumbnailRequests.delete(payload.requestId);if(payload.error)request.reject(Error(String(payload.error).slice(0,500)));else request.resolve(payload.url);});
const textureOperations=new Set();
const readyToClose=new WeakSet(),closingWindows=new WeakSet();
const openedPaths=new Set();
const geosetRepairs=require('./geoset-repair.cjs').createGeosetRepairStore(openedPaths);
const filters=[{name:'Models and Paint Projects',extensions:['mdl','mdx','mdlxlpaint']},{name:'Warcraft III models',extensions:['mdl','mdx']},{name:'MDLxL Paint Project',extensions:['mdlxlpaint']}];
let recentQueue = Promise.resolve();
async function persistRecents(file){
  if(file)recents=[file,...recents.filter(p=>p.toLowerCase()!==file.toLowerCase())].slice(0,12);
  const encoded=JSON.stringify(recents);
  const operation=recentQueue.catch(()=>{}).then(async()=>{await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'recent.json'),encoded);});
  recentQueue=operation; await operation; if(commandCatalog)refreshMenu();
}
async function readModel(file){
  const extension=path.extname(file).toLowerCase();if(!['.mdl','.mdx','.mdlxlpaint'].includes(extension))throw new Error('Choose an MDL, MDX, or MDLxL Paint Project.');
  const stat=await fs.stat(file),limit=extension==='.mdlxlpaint'?512:128;if(stat.size>limit*1024*1024)throw new Error(`This file exceeds the current ${limit} MB opening limit.`);
  const bytes=await fs.readFile(file);openedPaths.add(path.resolve(file));await persistRecents(file);
  initialModel={name:path.basename(file),path:file,bytes};
  return initialModel;
}
async function selectOpen(){const result=await dialog.showOpenDialog(win,{filters,properties:['openFile']});if(result.canceled)return [];return Promise.all(result.filePaths.map(readModel));}
ipcMain.handle('model:open',selectOpen);
ipcMain.handle('parts:list',()=>getBitsAndPartsLibrary().list());
ipcMain.handle('parts:read',(_,id)=>getBitsAndPartsLibrary().read(id));
ipcMain.handle('parts:folder',async()=>{const {directory}=await getBitsAndPartsLibrary().list();const error=await shell.openPath(directory);if(error)throw Error(error);return directory;});
ipcMain.handle('preview:backgrounds',()=>getPreviewBackgroundLibrary().list());
ipcMain.handle('preview:background',(_,id)=>getPreviewBackgroundLibrary().read(id));
ipcMain.handle('preview:backgroundFolder',async()=>{const {directory}=await getPreviewBackgroundLibrary().list();const error=await shell.openPath(directory);if(error)throw Error(error);return directory;});
ipcMain.handle('paint:textures',()=>getPaintTextureLibrary().list());
ipcMain.handle('paint:texture',(_,id)=>getPaintTextureLibrary().read(id));
ipcMain.handle('paint:saveTexture',(_,payload)=>getPaintTextureLibrary().save(payload));
ipcMain.handle('paint:textureFolder',async()=>{await getPaintTextureLibrary().ensure();const error=await shell.openPath(getPaintTextureLibrary().directory);if(error)throw Error(error);});
ipcMain.handle('paint:exportTexture',async(_,payload)=>{
  const name=path.basename(String(payload?.name||'')),extension=path.extname(name).slice(1).toLowerCase();
  if(!['png','blp','dds'].includes(extension))throw Error('Save a PNG, BLP or DDS texture.');
  const bytes=Buffer.from(payload.bytes||[]);if(!bytes.length||bytes.length>64*1024*1024)throw Error('Choose a texture smaller than 64 MiB.');
  const result=await dialog.showSaveDialog(win,{title:'Save texture copy',defaultPath:name,filters:[{name:extension.toUpperCase(),extensions:[extension]}]});
  if(result.canceled)return null;let destination=result.filePath;if(!destination.toLowerCase().endsWith('.'+extension))destination+='.'+extension;
  await fs.writeFile(destination,bytes);return {name:path.basename(destination),path:destination};
});
ipcMain.on('preview:busy',(event,value)=>{if(event.sender===win?.webContents)captureBusy=!!value;});
ipcMain.handle('preview:capture',(event,payload)=>{
  captureOwner(event);
  const operation=savePreviewCapture(path.join(app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(), 'Screenshots'),payload);
  captureOperations.add(operation);operation.finally(()=>captureOperations.delete(operation)).catch(()=>{});return operation;
});
ipcMain.handle('preview:recordBegin',(event,payload)=>captureOperation(previewRecordings.begin(captureOwner(event),payload)));
ipcMain.handle('preview:recordFrame',(event,payload)=>captureOperation(previewRecordings.frame(captureOwner(event),payload)));
ipcMain.handle('preview:recordFinish',(event,payload)=>captureOperation(previewRecordings.finish(captureOwner(event),payload)));
ipcMain.handle('preview:recordSave',(event,id)=>captureOperation(previewRecordings.save(captureOwner(event),id)));
ipcMain.handle('preview:recordDiscard',(event,id)=>captureOperation(previewRecordings.discard(captureOwner(event),id)));
ipcMain.handle('model:recent',()=>recents);
ipcMain.handle('model:clearRecent',async()=>{recents=[];await persistRecents();return [];});
ipcMain.handle('model:openRecent',async(_,p)=>{
  if(!recents.includes(p))throw new Error('Not in recent files.');
  try{return await readModel(p);}catch(error){
    if(['ENOENT','ENOTDIR'].includes(error.code)){recents=recents.filter(file=>file!==p);await persistRecents();throw new Error('This recent file was moved or deleted: '+p);}
    throw error;
  }
});
ipcMain.on('model:dirty',(_,value)=>{dirty=!!value;win?.setDocumentEdited(dirty);sessionJournal.setDirty(dirty).catch(error=>console.warn('Session journal: '+error.message));});
ipcMain.on('menu:state',(event,value)=>{
  if(event.sender!==win?.webContents||typeof value?.readOnly!=='boolean'||typeof value?.saving!=='boolean')return;
  const checks=normalizeMenuChecks(value.checks);
  const next={readOnly:value.readOnly,saving:value.saving,uvEnabled:value.uvEnabled===true,preview:value.preview===true,checks};
  if(JSON.stringify(nativeEditorState)===JSON.stringify(next))return;
  nativeEditorState=next;
  if(commandCatalog)refreshMenu();
});
async function saveModel(payload){
  if(!payload || !['mdl','mdx'].includes(payload.format))throw new Error('Unsupported format.');
  const bytes=Buffer.from(payload.bytes);if(bytes.length>128*1024*1024)throw new Error('Output exceeds 128 MB.');
  let destination=payload.path;
  if(!destination||payload.saveAs||!openedPaths.has(path.resolve(destination))){
    const result=await dialog.showSaveDialog(win,{title:payload.export?'Export model':'Save model',defaultPath:destination||payload.name||`Untitled.${payload.format}`,filters:[{name:payload.format.toUpperCase()+' model',extensions:[payload.format]}]});
    if(result.canceled)return null;destination=result.filePath;
  }
  if(path.extname(destination).toLowerCase()!=='.'+payload.format)destination+='.'+payload.format;
  const temporary=destination+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{
    await saveForgeAssets(destination,payload.forgeAssets||[]);
    await fs.writeFile(temporary,bytes,{flag:'wx'});
    const check=await fs.readFile(temporary);if(!check.equals(bytes))throw new Error('Write verification failed.');
    await fs.rename(temporary,destination);
    openedPaths.add(path.resolve(destination));await persistRecents(destination);
    initialModel={name:path.basename(destination),path:destination,bytes};
    return {name:path.basename(destination),path:destination};
  }catch(error){await fs.unlink(temporary).catch(()=>{});throw error;}
}
ipcMain.handle('model:save',(_,payload)=>{const operation=saveQueue.catch(()=>{}).then(()=>saveModel(payload));saveQueue=operation;return operation;});
for(const [channel,operationName] of [['model:repairGeosetAnimations','repair'],['model:undoGeosetRepair','undo']]){
  ipcMain.handle(channel,(event,payload)=>{
    if(event.sender!==win?.webContents)throw Error('Repair is only available in the editor window.');
    const operation=saveQueue.catch(()=>{}).then(async()=>{
      const result=await geosetRepairs[operationName](payload);
      initialModel={name:result.name,path:result.path,bytes:result.bytes};
      return result;
    });saveQueue=operation;return operation;
  });
}
async function saveArtifact(payload){
  const requested=path.basename(String(payload?.name||'')),extension=path.extname(requested).toLowerCase(),allowed=new Set(['.mdlxlpaint','.zip']);
  if(!allowed.has(extension))throw Error('Only .mdlxlpaint and .zip painter artifacts can be saved.');
  const bytes=Buffer.from(payload?.bytes||[]);if(!bytes.length)throw Error('The painter artifact is empty.');if(bytes.length>512*1024*1024)throw Error('The painter artifact exceeds 512 MB.');
  const result=await dialog.showSaveDialog(win,{title:extension==='.zip'?'Export Warcraft paint package':'Save editable paint project',defaultPath:requested,filters:[{name:extension==='.zip'?'ZIP package':'MDLxL Paint Project',extensions:[extension.slice(1)]}]});
  if(result.canceled)return null;let destination=result.filePath;if(path.extname(destination).toLowerCase()!==extension)destination+=extension;
  if(!allowed.has(path.extname(destination).toLowerCase()))throw Error('The selected painter artifact extension is not allowed.');
  const temporary=destination+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{await fs.writeFile(temporary,bytes,{flag:'wx'});const check=await fs.readFile(temporary);if(!check.equals(bytes))throw Error('Artifact write verification failed.');await fs.rename(temporary,destination);return {name:path.basename(destination),path:destination,bytes:bytes.length};}
  catch(error){await fs.unlink(temporary).catch(()=>{});throw error;}
}
ipcMain.handle('artifact:save',(_,payload)=>{const operation=artifactSaveQueue.catch(()=>{}).then(()=>saveArtifact(payload));artifactSaveQueue=operation;return operation;});
const imageExtensions=IMAGE_EXTENSIONS;
async function resolveTextures(payload, extensions){
  if(!Array.isArray(payload?.names))throw Error('Missing texture paths.');
  if(!payload.names.length)return [];
  const root=payload.path&&(openedPaths.has(path.resolve(payload.path))||bitsAndPartsLibrary?.openedPaths.has(path.resolve(payload.path)))?path.dirname(path.resolve(payload.path)):null;
  // Capture the configured folder once.  A picker change while this async
  // lookup is running must not combine one discovery result with another
  // folder's setting.
  const selectedFolder=settings.gameData;
  const discovered=await gameDataDiscovery.discover({explicitFolder:selectedFolder,modelFolders:[root,...[...openedPaths].map(file=>path.dirname(file))].filter(Boolean)});
  const selected=selectedGameDataSources(discovered,selectedFolder);
  return textureResolver.resolve(payload.names,{folders:[root,...selected.folders].filter(Boolean),archives:selected.archives,cascFolders:(discovered.cascFolders||[]).filter(folder=>selected.folders.includes(folder)),fallbackCascFolders:(discovered.cascFolders||[]).filter(folder=>!selected.folders.includes(folder)),fallbackFolders:discovered.folders.filter(folder=>!selected.folders.includes(folder)),fallbackArchives:discovered.archives.filter(file=>!selected.archives.includes(file))},extensions);
}
ipcMain.handle('texture:resolve',(_,payload)=>{const operation=resolveTextures(payload);textureOperations.add(operation);operation.finally(()=>textureOperations.delete(operation)).catch(()=>{});return operation;});
// Event previews use the same installed-game lookup and cache as textures.
// Limit this separate read-only endpoint to resources consumed by that preview.
ipcMain.handle('preview:eventResources',(_,payload)=>{const operation=resolveTextures(payload,[...IMAGE_EXTENSIONS,'slk','mdl','mdx']);textureOperations.add(operation);operation.finally(()=>textureOperations.delete(operation)).catch(()=>{});return operation;});
ipcMain.handle('preview:humanPortraitFrame',()=>{
  const operation=resolveTextures({names:HUMAN_PORTRAIT_RESOURCES},[...IMAGE_EXTENSIONS,'fdf','txt']).then(validateHumanPortraitResources);
  textureOperations.add(operation);operation.finally(()=>textureOperations.delete(operation)).catch(()=>{});return operation;
});
async function textureLibraryContext(payload){
    const modelPath=typeof payload?.modelPath==='string'&&openedPaths.has(path.resolve(payload.modelPath))?path.resolve(payload.modelPath):null;
    const chosen=settings.gameData;
    const discovered=await gameDataDiscovery.discover({explicitFolder:chosen,modelFolders:modelPath?[path.dirname(modelPath)]:[]});
    const selected=selectedGameDataSources(discovered,chosen);
    const folders=discovered.cascFolders||[];
    const resolver=textureResolver;
    const catalog=await textureLibrary.catalog({modelPath,cascFolders:[...folders.filter(folder=>selected.folders.includes(folder)),...folders.filter(folder=>!selected.folders.includes(folder))]});
    texturePreviews.register(catalog.items);
    return {catalog,readAsset:async item=>({name:item.lookupName,bytes:item.source==='native'?await resolver.casc.readSnapshot(item.lookupName,item.sourceFolder,item.sourceKey):await resolver.loose(item.lookupName,modelPath?[path.dirname(modelPath)]:[])}),decode:decodeThumbnail};
}
ipcMain.handle('texture:library',(_,payload)=>{
  const operation=textureLibraryContext(payload).then(context=>context.catalog);
  textureOperations.add(operation);operation.finally(()=>textureOperations.delete(operation)).catch(()=>{});return operation;
});
ipcMain.handle('texture:copyPath',(_,value)=>{
  if(typeof value!=='string'||!value||value.length>1024)throw Error('Invalid texture path.');
  clipboard.writeText(value);
});
ipcMain.handle('texture:preloadStatus',()=>texturePreviews.getStatus());
ipcMain.handle('texture:preloadStart',(event,payload)=>{
  if(event.sender!==win?.webContents||textureDecoder!==event.sender)throw Error('Texture preview decoder is not ready.');
  return texturePreviews.start(()=>textureLibraryContext(payload));
});
ipcMain.handle('texture:preloadCancel',(_,payload)=>texturePreviews.cancel(payload?.jobId));
ipcMain.handle('texture:thumbnails',(_,payload)=>texturePreviews.readMany(payload?.keys));
ipcMain.handle('texture:saveThumbnail',(_,payload)=>texturePreviews.save(payload?.key,payload?.url));
ipcMain.handle('settings:gameData',async()=>{
  const answer=await dialog.showOpenDialog(win,{title:'Choose your Warcraft III installation folder',buttonLabel:'Use this folder',defaultPath:settings.gameData||undefined,properties:['openDirectory']});
  if(answer.canceled)return null;
  return updateSettings({gameData:answer.filePaths[0]});
});
ipcMain.handle('settings:clearGameData',()=>updateSettings({gameData:null}));
ipcMain.handle('settings:rescanGameData',async()=>{
  texturePreviews.cancel();await texturePreviews.settle();
  const result=await gameDataDiscovery.discover({explicitFolder:settings.gameData,modelFolders:[...openedPaths].map(file=>path.dirname(file)),force:true});
  const previous=textureResolver;textureResolver=createTextureResolver();textureLibrary=new TextureLibrary({casc:textureResolver.casc});
  await Promise.allSettled([...textureOperations]);await previous.close();
  return result;
});
ipcMain.handle('recovery:write',(_,payload)=>recoveryStore.write(payload));
ipcMain.handle('recovery:list',()=>recoveryStore.list());
ipcMain.handle('recovery:read',async(_,id)=>{const payload=await recoveryStore.read(id);if(typeof payload.path==='string'&&/\.(mdl|mdx)$/i.test(payload.path)){try{if((await fs.stat(payload.path)).isFile())openedPaths.add(path.resolve(payload.path));}catch{}}return payload;});
const publicSettings=()=>({...settings,gameData:settings.gameData||null,gameDataDiscovery:gameDataDiscovery?.result});
ipcMain.handle('app:initial',async()=>({settings:publicSettings(),model:initialModel,recoveryPrompt,recovery:(await recoveryStore.list()).filter(r=>r.dirty!==false)}));
ipcMain.handle('settings:get',publicSettings);
ipcMain.handle('settings:configure',(_,value)=>{
  if(value&&Object.prototype.hasOwnProperty.call(value,'gameData'))throw Error('Use the game data folder picker to change the asset folder.');
  return updateSettings(value);
});
ipcMain.on('app:close',event=>{if(win&&!win.isDestroyed()&&event.sender===win.webContents)win.close();});
async function updateSettings(value){
  const previousHotkeys=JSON.stringify(settings.preferences?.hotkeys);
  const previousLanguage=settings.preferences?.language;
  settings=await settingsStore.configure(value);
  if(value&&Object.prototype.hasOwnProperty.call(value,'gameData'))texturePreviews.cancel();
  nativeTheme.themeSource=(APPLICATION_THEMES[settings.preferences.theme] || APPLICATION_THEMES.light).scheme;
  if(JSON.stringify(settings.preferences.hotkeys)!==previousHotkeys || previousLanguage!==settings.preferences.language)refreshMenu();
  return publicSettings();
}
function refreshMenu(){
  if(!win||win.isDestroyed())return;
  const bindings=preferenceApi.effectiveBindings(commandCatalog,settings.preferences.hotkeys);
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(bindings,id=>{if(win&&!win.isDestroyed())win.webContents.send('menu',id);},process.platform,recents,text=>translateText(text,settings.preferences.language),nativeEditorState)));
}
function flushBeforeClose(current,discardedDirty=false){
  if(closingWindows.has(current))return;
  closingWindows.add(current);
  const requestId=crypto.randomBytes(12).toString('hex');
  let finished=false,timer;
  const cleanup=()=>{clearTimeout(timer);ipcMain.removeListener('app:closeReady',acknowledge);};
  const finish=async()=>{
    if(finished)return;finished=true;cleanup();
    await saveQueue.catch(()=>{});
    await settingsStore?.flush();
    if(!current.isDestroyed()){
      // Recheck a model edit made while an asynchronous settings write completed.
      if(dirty)closingWindows.delete(current);else readyToClose.add(current);
      current.close();
    }
  };
  const acknowledge=async(event,payload)=>{
    if(event.sender!==current.webContents||payload?.requestId!==requestId)return;
    if(payload.error){
      if(finished)return;finished=true;cleanup();closingWindows.delete(current);
      const answer=await dialog.showMessageBox(current,{type:'error',title:'Pending work could not be saved',message:'The editor could not finish saving before closing.',detail:String(payload.error).slice(0,500),buttons:['Keep editing','Close anyway'],defaultId:0,cancelId:0});
      if(answer.response===1&&!current.isDestroyed()){await settingsStore?.flush();if(!dirty)readyToClose.add(current);current.close();}
      else if(!current.isDestroyed()){dirty=dirty||discardedDirty;current.setDocumentEdited(dirty);}
      return;
    }
    await finish();
  };
  ipcMain.on('app:closeReady',acknowledge);
  // An unresponsive renderer must not prevent the user from closing the app.
  // Writes that already reached the main process still finish before exit.
  const timeout=()=>{if(captureBusy||captureOperations.size){timer=setTimeout(timeout,60000);return;}finish();};
  timer=setTimeout(timeout,captureBusy?60000:1500);
  current.webContents.send('app:beforeClose',requestId);
}
async function readTexture(file,logicalName){const stat=await fs.stat(file);if(stat.size>64*1024*1024)throw new Error('Texture exceeds 64 MB.');return {name:logicalName||path.basename(file),bytes:await fs.readFile(file)};}
ipcMain.handle('texture:open',async()=>{const result=await dialog.showOpenDialog(win,{filters:[{name:'Textures',extensions:imageExtensions}],properties:['openFile','multiSelections']});if(result.canceled)return [];return Promise.all(result.filePaths.map(p=>readTexture(p)));});
ipcMain.handle('texture:folder',async(_,requested)=>{
  const result=await dialog.showOpenDialog(win,{title:'Choose a texture root folder',properties:['openDirectory']});if(result.canceled)return [];
  const root=path.resolve(result.filePaths[0]);const loaded=[];
  for(const name of [...new Set(requested)].slice(0,4096)){
    if(typeof name!=='string'||!name)continue;
    const relative=name.replace(/[\\/]+/g,path.sep);
    for(const candidate of [path.resolve(root,relative),path.resolve(root,path.basename(relative))]){
      if(!candidate.toLowerCase().startsWith(root.toLowerCase()+path.sep))continue;
      if(!imageExtensions.includes(path.extname(candidate).slice(1).toLowerCase()))continue;
      try{loaded.push(await readTexture(candidate,name));break;}catch(error){if(!['ENOENT','EISDIR'].includes(error.code))throw error;}
    }
  }
  return loaded;
});
app.whenReady().then(async()=>{
  const [preferences,commands,localization]=await Promise.all([import('../src/preferences.js'),import('../src/commands.js'),import('../src/localization.js')]);
  translateText=localization.translate;
  // Localize native dialog presentation while retaining paths, extensions and IDs.
  for(const method of ['showOpenDialog','showSaveDialog','showMessageBox','showMessageBoxSync']){
    const original=dialog[method].bind(dialog);
    dialog[method]=(...args)=>{const i=args.length-1,opts=args[i];if(opts&&typeof opts==='object'){
      const localized={...opts};for(const key of ['title','message','detail','buttonLabel'])if(typeof localized[key]==='string')localized[key]=translateText(localized[key],settings.preferences?.language);
      if(Array.isArray(opts.buttons))localized.buttons=opts.buttons.map(text=>translateText(text,settings.preferences?.language));
      if(Array.isArray(opts.filters))localized.filters=opts.filters.map(filter=>({...filter,name:translateText(filter.name,settings.preferences?.language)}));
      args[i]=localized;
    }return original(...args);};
  }
  preferenceApi=preferences;commandCatalog=commands.COMMANDS;
  settingsStore=new SettingsStore(path.join(profile,'settings.json'),preferences.normalizePreferences);
  try{recents=JSON.parse(await fs.readFile(path.join(profile,'recent.json'),'utf8')).filter(x=>typeof x==='string').slice(0,12);}catch{}
  settings=await settingsStore.load(path.join(__dirname,'../game-data.json'));
  nativeTheme.themeSource=(APPLICATION_THEMES[settings.preferences.theme] || APPLICATION_THEMES.light).scheme;
  if(process.env.MDLVIS_GAME_DATA)settings.gameData=process.env.MDLVIS_GAME_DATA;
  try{recoveryPrompt=await sessionJournal.begin();}catch(error){console.warn('Session journal: '+error.message);}
  gameDataDiscovery=new GameDataDiscovery({cacheFile:path.join(profile,'game-data-discovery.json'),appFolders:[path.dirname(process.execPath),app.getAppPath()]});
  const argument=process.argv.slice(1).find(p=>/\.(mdl|mdx|mdlxlpaint)$/i.test(p));if(argument)try{initialModel=await readModel(argument);}catch(e){console.error(e.message);}
  // Discover game data only when textures are requested or the user rescans.
  // A blank editor starts without registry queries or a drive-search process.
  await createWindow();
});
async function createWindow(bounds={}){
  const current=new BrowserWindow({width:1100,height:760,...bounds,minWidth:720,minHeight:480,show:process.env.MDLVIS_HEADLESS!=='1',backgroundColor:(APPLICATION_THEMES[settings.preferences?.theme] || APPLICATION_THEMES.light).colors.panel,title:'MDLxL',icon:path.join(__dirname,'../dist/branding/MDLxL.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  if(process.env.MDLVIS_HEADLESS!=='1')current.maximize();
  win=current;nativeEditorState={readOnly:true,saving:false};
  win.webContents.setWindowOpenHandler(({url,frameName})=> url==='about:blank' && frameName==='MDLxL-UV' ? {action:'allow',overrideBrowserWindowOptions:{parent:current,modal:false,width:900,height:700,minWidth:500,minHeight:400,title:'MDLxL — UV Editor',icon:path.join(__dirname,'../dist/branding/MDLxL.ico'),autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}}} : {action:'deny'});
  current.webContents.on('did-create-window',child=>{child.setMenu(null);child.maximize();child.webContents.setWindowOpenHandler(()=>({action:'deny'}));child.webContents.on('will-navigate',event=>event.preventDefault());});
  win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL())event.preventDefault();});
  refreshMenu();
  win.on('close',event=>{if(current!==win||readyToClose.has(current))return;let discardedDirty=false;if(dirty){const answer=dialog.showMessageBoxSync(win,{type:'question',buttons:['Keep editing','Discard changes and close'],defaultId:0,cancelId:0,title:'Unsaved models',message:'You have unsaved model changes.',detail:'Return to the editor to save your work. Local recovery drafts are available when successfully stored.'});if(answer===0){event.preventDefault();return;}discardedDirty=true;dirty=false;}event.preventDefault();flushBeforeClose(current,discardedDirty);});
  win.webContents.on('will-prevent-unload',event=>{if(!dirty)event.preventDefault();});
  current.webContents.on('render-process-gone',async(_,details)=>{
    if(current!==win||current.isDestroyed())return;
    textureDecoder=null;texturePreviews.cancel();rejectThumbnailRequests('Editor renderer closed.');
    await Promise.allSettled([...captureOperations]);
    await previewRecordings.closeOwner(current.webContents.id);
    captureBusy=false;
    recoveryPrompt=recoveryPrompt||dirty;crashedWithEdits=crashedWithEdits||dirty;
    // Yield past Chromium's process teardown before creating another renderer.
    // Immediate reload inside this callback can crash Electron's host process.
    await new Promise(resolve=>setImmediate(resolve));
    await recoveryStore.flush();
    if(current.isDestroyed())return;
    const answer=await dialog.showMessageBox(current,{type:'error',title:'MDLxL',message:'The editor process stopped.',detail:'Your last disk recovery copy and undo history can be restored in a fresh editor window. Reason: '+details.reason,buttons:['Reopen editor','Close']});
    dirty=false;
    if(answer.response===0){const bounds=current.getBounds();await createWindow(bounds);crashedWithEdits=false;if(!current.isDestroyed())current.destroy();}
    else current.destroy();
  });
  await current.loadFile(path.join(__dirname,'../dist/index.html'));
}
app.on('window-all-closed',async()=>{
  textureDecoder=null;rejectThumbnailRequests('Editor closed.');await texturePreviews.close();
  await Promise.allSettled([settingsStore?.flush(),recoveryStore.flush(),...textureOperations,...captureOperations]);
  for(const owner of new Set([...previewRecordings.jobs.values()].map(job=>job.owner)))await previewRecordings.closeOwner(owner);
  await textureResolver.close();
  // If the renderer crashed and the user closed its error dialog, keep the
  // journal for the next launch. A regular close/discard is deliberately quiet.
  if(!crashedWithEdits)await sessionJournal.close();
  app.quit();
});
