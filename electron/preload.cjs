const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  initial: () => ipcRenderer.invoke('app:initial'),
  configure: payload => ipcRenderer.invoke('settings:configure',payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  close: () => ipcRenderer.send('app:close'),
  setMenuState: value => ipcRenderer.send('menu:state', value),
  onBeforeClose: callback => {
    const listener = async (_, requestId) => {
      try { await callback(); ipcRenderer.send('app:closeReady', { requestId }); }
      catch (error) { ipcRenderer.send('app:closeReady', { requestId, error: error?.message || String(error) }); }
    };
    ipcRenderer.on('app:beforeClose', listener);
    return () => ipcRenderer.removeListener('app:beforeClose', listener);
  },
  resolveTextures: payload => ipcRenderer.invoke('texture:resolve',payload),
  resolveEventResources: payload => ipcRenderer.invoke('preview:eventResources',payload),
  loadHumanPortraitFrame: () => ipcRenderer.invoke('preview:humanPortraitFrame'),
  textureLibraryCatalog: payload => ipcRenderer.invoke('texture:library',payload),
  copyTexturePath: value => ipcRenderer.invoke('texture:copyPath',value),
  textureLibraryPreloadStatus: () => ipcRenderer.invoke('texture:preloadStatus'),
  textureLibraryPreloadStart: payload => ipcRenderer.invoke('texture:preloadStart',payload),
  textureLibraryPreloadCancel: payload => ipcRenderer.invoke('texture:preloadCancel',payload),
  textureLibraryThumbnails: payload => ipcRenderer.invoke('texture:thumbnails',payload),
  textureLibrarySaveThumbnail: payload => ipcRenderer.invoke('texture:saveThumbnail',payload),
  onTextureLibraryPreloadProgress: callback => {
    const listener=(_,status)=>callback(status);ipcRenderer.on('texture:preloadProgress',listener);
    return ()=>ipcRenderer.removeListener('texture:preloadProgress',listener);
  },
  onTextureLibraryDecode: callback => {
    const listener=async(_,payload)=>{
      try{const url=await callback({name:payload.name,bytes:payload.bytes});ipcRenderer.send('texture:decoded',{requestId:payload.requestId,url});}
      catch(error){ipcRenderer.send('texture:decoded',{requestId:payload.requestId,error:String(error?.message||error)});}
    };
    ipcRenderer.on('texture:preloadDecode',listener);ipcRenderer.send('texture:decoderReady',true);
    return ()=>{ipcRenderer.removeListener('texture:preloadDecode',listener);ipcRenderer.send('texture:decoderReady',false);};
  },
  chooseGameData: () => ipcRenderer.invoke('settings:gameData'),
  clearGameData: () => ipcRenderer.invoke('settings:clearGameData'),
  rescanGameData: () => ipcRenderer.invoke('settings:rescanGameData'),
  writeRecovery: payload => ipcRenderer.invoke('recovery:write',payload),
  listRecovery: () => ipcRenderer.invoke('recovery:list'),
  readRecovery: id => ipcRenderer.invoke('recovery:read',id),
  open: () => ipcRenderer.invoke('model:open'),
  listParts: () => ipcRenderer.invoke('parts:list'),
  readPart: id => ipcRenderer.invoke('parts:read', id),
  openPartsFolder: () => ipcRenderer.invoke('parts:folder'),
  save: (payload) => ipcRenderer.invoke('model:save', payload),
  repairGeosetAnimations: payload => ipcRenderer.invoke('model:repairGeosetAnimations', payload),
  undoGeosetRepair: id => ipcRenderer.invoke('model:undoGeosetRepair', id),
  saveArtifact: payload => ipcRenderer.invoke('artifact:save',payload),
  saveCapture: payload => ipcRenderer.invoke('preview:capture', payload),
  beginPreviewRecording: payload => ipcRenderer.invoke('preview:recordBegin', payload),
  writePreviewRecordingFrame: payload => ipcRenderer.invoke('preview:recordFrame', payload),
  finishPreviewRecording: payload => ipcRenderer.invoke('preview:recordFinish', payload),
  savePreviewRecording: id => ipcRenderer.invoke('preview:recordSave', id),
  discardPreviewRecording: id => ipcRenderer.invoke('preview:recordDiscard', id),
  listPreviewBackgrounds: () => ipcRenderer.invoke('preview:backgrounds'),
  listPaintTextures: () => ipcRenderer.invoke('paint:textures'),
  readPaintTexture: id => ipcRenderer.invoke('paint:texture',id),
  savePaintTexture: payload => ipcRenderer.invoke('paint:saveTexture',payload),
  exportPaintTexture: payload => ipcRenderer.invoke('paint:exportTexture',payload),
  openPaintTextureFolder: () => ipcRenderer.invoke('paint:textureFolder'),
  readPreviewBackground: id => ipcRenderer.invoke('preview:background', id),
  openPreviewBackgroundFolder: () => ipcRenderer.invoke('preview:backgroundFolder'),
  setCaptureBusy: value => ipcRenderer.send('preview:busy', !!value),
  textures: () => ipcRenderer.invoke('texture:open'),
  textureFolder: (paths) => ipcRenderer.invoke('texture:folder', paths),
  recent: () => ipcRenderer.invoke('model:recent'),
  clearRecent: () => ipcRenderer.invoke('model:clearRecent'),
  openRecent: (path) => ipcRenderer.invoke('model:openRecent', path),
  setDirty: (dirty) => ipcRenderer.send('model:dirty', !!dirty),
  onMenu: (callback) => { const listener=(_,action)=>callback(action); ipcRenderer.on('menu',listener); return ()=>ipcRenderer.removeListener('menu',listener); },
});
