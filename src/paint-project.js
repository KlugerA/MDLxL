import { PAINT_COATS, PAINT_PROJECT_SCHEMA, PAINT_PROJECT_VERSION, isPaintResolution, isPaintRaster } from './paint-types.js';
import { applyRasterDelta, clonePaintRaster, compositePaintRasters, createPaintRaster, rasterRegionDelta } from './paint-raster.js';
import { storedZipArchive } from './forge-assets.js';

const encoder = new TextEncoder(), decoder = new TextDecoder();

export function createPaintProject({ modelName, resolution = 256, sourceMode = 'current', historyBudgetBytes = 128 * 1024 * 1024, historyMaxSteps = 250 } = {}) {
  if (!isPaintResolution(resolution)) throw Error('New paint textures must be 256, 512, 1024 or 2048 pixels.');
  return {
    schema: PAINT_PROJECT_SCHEMA, version: PAINT_PROJECT_VERSION, id: crypto.randomUUID(), modelName: String(modelName || 'Untitled.mdl'), resolution: Number(resolution), sourceMode: sourceMode === 'primer' ? 'primer' : 'current',
    targets: [], activeTargetId: null, activeCoatId: 'base', brushReferences: [], uvEdits: {}, uvRevision: 0, generatedUVSets: {}, paintAtlasVersion: 0, dirty: false, revision: 0,
    history: { undo: [], redo: [], usedBytes: 0, budgetBytes: Math.max(8 * 1024 * 1024, Number(historyBudgetBytes) || 0), maxSteps: Math.max(10, Number(historyMaxSteps) || 0) },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export function addPaintProjectTarget(project, target, baseRaster) {
  if (project.targets.some(item => item.id === targetRez(target.id))) return project.targets.find(item => item.id === target.id);
  const base = baseRaster ? clonePaintRaster(baseRaster) : createPaintRaster(project.resolution, project.resolution, [124, 126, 119, 255]);
  if (!isPaintRaster(base)) throw Error('Paint images must have valid pixels and dimensions between 1 and 4096.');
  const entry = { ...structuredClone(target), id: targetRez(target.id), base, coats: PAINT_COATS.map(coat => ({ ...coat, visible: true, raster: createPaintRaster(base.width,base.height) })), alphaMask: createPaintRaster(base.width, base.height, [255,255,255,255]), smartMasks: null };
  if(project.sourceMode==='primer'&&!entry.paintName)entry.paintName='Texture '+(project.targets.length+1);
  project.targets.push(entry); project.activeTargetId ||= entry.id; return entry;
}

const targetRez = value => String(value || '');
export function paintProjectTarget(project, id = project.activeTargetId) { return project.targets.find(target => target.id === id) || null; }
export function paintProjectCoat(project, targetId = project.activeTargetId, coatId = project.activeCoatId) { const target=paintProjectTarget(project,targetId); return coatId==='__alpha'&&target ? { id:'__alpha', name:'Alpha', raster:target.alphaMask } : target?.coats.find(coat => coat.id === coatId) || null; }
export function compositePaintTarget(project, targetId = project.activeTargetId) { const target = paintProjectTarget(project, targetId); return target ? compositePaintRasters(target.base, target.coats, {alphaMask:target.alphaMask,preserveSourceAlpha:target.preserveSourceAlpha??true}) : null; }

export function recordPaintStroke(project, targetId, coatId, before, label = 'Paint stroke', brush = null) {
  const coat = paintProjectCoat(project, targetId, coatId); if (!coat) throw Error('The active paint coat is unavailable.');
  const delta = rasterRegionDelta(before, coat.raster); if (!delta) return false;
  const brushRef = brush ? { presetId: String(brush.id || 'round'), tipId: brush.tipId || null, materialId: brush.materialId || null } : null;
  if (brushRef && !project.brushReferences.some(item => item.presetId === brushRef.presetId && item.tipId === brushRef.tipId && item.materialId === brushRef.materialId)) project.brushReferences.push(brushRef);
  const entry = { targetId, coatId, label, brush: brushRef, delta, date: Date.now() }, history = project.history;
  history.undo.push(entry); history.usedBytes += delta.byteLength; for(const discarded of history.redo)history.usedBytes-=discarded.delta.byteLength; history.redo = [];
  while (history.undo.length > history.maxSteps || history.usedBytes > history.budgetBytes) { const removed = history.undo.shift(); history.usedBytes -= removed.delta.byteLength; }
  const target = paintProjectTarget(project, targetId); target.revision = (target.revision || 0) + 1;
  project.dirty = true; project.revision++; project.updatedAt = new Date().toISOString(); return true;
}

/** One free-paint gesture may cross several Warcraft materials. Keep it as one
 * undo step even though each material owns a different texture raster. */
export function recordPaintStrokeGroup(project, strokes, label = 'Paint stroke', brush = null) {
  const changes=(strokes||[]).map(({targetId,coatId,before})=>{const coat=paintProjectCoat(project,targetId,coatId);if(!coat)throw Error('A painted material is unavailable.');const delta=rasterRegionDelta(before,coat.raster);return delta?{targetId,coatId,delta}:null;}).filter(Boolean);
  if(!changes.length)return false;
  const brushRef=brush?{presetId:String(brush.id||'normal'),tipId:brush.tipId||null,materialId:brush.materialId||null}:null;
  if(brushRef&&!project.brushReferences.some(item=>item.presetId===brushRef.presetId&&item.tipId===brushRef.tipId&&item.materialId===brushRef.materialId))project.brushReferences.push(brushRef);
  const entry={kind:'paintGroup',label,brush:brushRef,changes,delta:{byteLength:changes.reduce((sum,change)=>sum+change.delta.byteLength,0)},date:Date.now()},history=project.history;
  for(const discarded of history.redo)history.usedBytes-=discarded.delta.byteLength;history.redo=[];history.undo.push(entry);history.usedBytes+=entry.delta.byteLength;
  while(history.undo.length>history.maxSteps||history.usedBytes>history.budgetBytes)history.usedBytes-=history.undo.shift().delta.byteLength;
  for(const targetId of new Set(changes.map(change=>change.targetId))){const target=paintProjectTarget(project,targetId);target.revision=(target.revision||0)+1;}
  project.dirty=true;project.revision++;project.updatedAt=new Date().toISOString();return true;
}

export function travelPaintHistory(project, redo = false) {
  const from = redo ? project.history.redo : project.history.undo, to = redo ? project.history.undo : project.history.redo, entry = from.pop(); if (!entry) return null;
  if(entry.kind==='surface'){
    applySurfaceState(project,redo?entry.after:entry.before);to.push(entry);return entry;
  }
  if(entry.kind==='uv'){
    project.uvEdits[entry.key]=Array.from(redo?entry.after:entry.before);project.uvRevision=(project.uvRevision||0)+1;project.revision++;project.dirty=true;to.push(entry);return entry;
  }
  const changes=entry.changes||[{coatId:entry.coatId,delta:entry.delta}];
  if(changes.some(change=>!paintProjectCoat(project,change.targetId||entry.targetId,change.coatId))){from.push(entry);throw Error('Paint history refers to a missing coat.');}
  for(const change of changes)applyRasterDelta(paintProjectCoat(project,change.targetId||entry.targetId,change.coatId).raster,change.delta,redo?'after':'before');to.push(entry);
  for(const targetId of new Set(changes.map(change=>change.targetId||entry.targetId))){const target=paintProjectTarget(project,targetId);target.revision=(target.revision||0)+1;}
  project.revision++; project.dirty = true; project.updatedAt = new Date().toISOString(); return entry;
}

/** Replace an entire coat including alpha as one undoable texture operation. */
export function replacePaintTexture(project,targetId,coatId,raster) {
  const target=paintProjectTarget(project,targetId),coat=paintProjectCoat(project,targetId,coatId);
  if(!target||!coat||!coat.visible)throw Error('Choose a visible paint coat.');
  if(raster.width!==target.base.width||raster.height!==target.base.height)throw Error('Texture size does not match the destination.');
  const before=clonePaintRaster(coat.raster),beforeAlpha=clonePaintRaster(target.alphaMask);
  for(let i=0;i<raster.data.length;i+=4){coat.raster.data.set(raster.data.subarray(i,i+3),i);coat.raster.data[i+3]=255;target.alphaMask.data[i+3]=raster.data[i+3];}
  const changes=[{coatId,delta:rasterRegionDelta(before,coat.raster)},{coatId:'__alpha',delta:rasterRegionDelta(beforeAlpha,target.alphaMask)}].filter(change=>change.delta);
  if(!changes.length)return false;
  const history=project.history,entry={targetId,coatId,label:'Use as texture',changes,delta:{byteLength:changes.reduce((sum,c)=>sum+c.delta.byteLength,0)}};
  for(const discarded of history.redo)history.usedBytes-=discarded.delta.byteLength;history.redo=[];history.undo.push(entry);history.usedBytes+=entry.delta.byteLength;
  while(history.undo.length>history.maxSteps||history.usedBytes>history.budgetBytes)history.usedBytes-=history.undo.shift().delta.byteLength;
  target.revision=(target.revision||0)+1;project.revision++;project.dirty=true;project.updatedAt=new Date().toISOString();return true;
}

export function recordPaintUV(project,key,before,after) {
  if(!Array.from(after).every(Number.isFinite))throw Error('UV coordinates must be finite numbers.');
  if(before.length!==after.length||Array.from(before).every((v,i)=>v===after[i]))return false;
  const entry={kind:'uv',key,before:new Float32Array(before),after:new Float32Array(after),delta:{byteLength:before.length*8}};
  const history=project.history;for(const discarded of history.redo)history.usedBytes-=discarded.delta.byteLength;history.redo=[];
  history.undo.push(entry);history.usedBytes+=entry.delta.byteLength;
  while(history.undo.length>history.maxSteps||history.usedBytes>history.budgetBytes)history.usedBytes-=history.undo.shift().delta.byteLength;
  project.uvEdits[key]=Array.from(after);project.uvRevision=(project.uvRevision||0)+1;project.revision++;project.dirty=true;return true;
}

export function markPaintProjectSaved(project) { project.dirty = false; project.updatedAt = new Date().toISOString(); }

function surfaceBytes(value){if(ArrayBuffer.isView(value))return value.byteLength;if(!value||typeof value!=='object')return typeof value==='number'?8:0;return Object.values(value).reduce((sum,v)=>sum+surfaceBytes(v),0);}
function applySurfaceState(project,state){
  const targets=state.targets||[state.target];project.targets=project.targets.map(t=>{const next=targets.find(v=>v.id===t.id);return next?structuredClone(next):t;});
  project.geometryEdits||={};for(const [index,geo] of Object.entries(state.geometry)){if(geo)project.geometryEdits[index]=structuredClone(geo);else delete project.geometryEdits[index];}
  project.uvEdits=structuredClone(state.uvEdits);project.generatedUVSets={...state.generatedUVSets};
  project.materialRevision=(project.materialRevision||0)+1;project.uvRevision=(project.uvRevision||0)+1;project.revision++;project.dirty=true;project.updatedAt=new Date().toISOString();
}
/** A texture gesture may also allocate its working UV space. Both belong to
 * one undo step; a hover or cancelled gesture never changes the real project. */
export function recordPreparedPaintStroke(project,prepared,label,brush=null){
  const ids=new Set(prepared.targets.filter(t=>t!==project.targets.find(p=>p.id===t.id)).map(t=>t.id));
  const geometry=prepared.geometryEdits||{},beforeGeometry={};
  for(const index of Object.keys(geometry))beforeGeometry[index]=project.geometryEdits?.[index]||prepared.paintPreparationOriginalGeometry?.[index]||null;
  const before={targets:project.targets.filter(t=>ids.has(t.id)),geometry:beforeGeometry,uvEdits:project.uvEdits||{},generatedUVSets:project.generatedUVSets||{}},after={targets:prepared.targets.filter(t=>ids.has(t.id)),geometry,uvEdits:prepared.uvEdits,generatedUVSets:prepared.generatedUVSets};
  const byteLength=surfaceBytes(before)+surfaceBytes(after),history=project.history;
  if(byteLength>history.budgetBytes)throw Error('This texture placement exceeds the undo budget. Prepare a smaller destination before painting.');
  const entry={kind:'surface',label,before:structuredClone(before),after:structuredClone(after),delta:{byteLength},date:Date.now()};
  for(const discarded of history.redo)history.usedBytes-=discarded.delta.byteLength;history.redo=[];history.undo.push(entry);history.usedBytes+=byteLength;
  while(history.undo.length>history.maxSteps||history.usedBytes>history.budgetBytes)history.usedBytes-=history.undo.shift().delta.byteLength;
  const brushRef=brush?{presetId:String(brush.id||'normal'),tipId:brush.tipId||null,materialId:brush.materialId||null}:null;
  if(brushRef&&!project.brushReferences.some(item=>item.presetId===brushRef.presetId&&item.tipId===brushRef.tipId&&item.materialId===brushRef.materialId))project.brushReferences.push(brushRef);
  entry.brush=brushRef;applySurfaceState(project,after);return entry;
}
export function recordPaintSurfaceChange(project,targetId,staged,label){
  const target=paintProjectTarget(project,targetId);if(!target)throw Error('The destination is unavailable.');
  const {previousGeometry,...after}=staged;
  const before={target,geometry:Object.fromEntries(Object.keys(staged.geometry).map(index=>[index,project.geometryEdits?.[index]||previousGeometry?.[index]||null])),uvEdits:project.uvEdits||{},generatedUVSets:project.generatedUVSets||{}};
  const byteLength=surfaceBytes(before)+surfaceBytes(after),history=project.history;
  if(byteLength>history.budgetBytes)throw Error('This surface change exceeds the undo budget. Choose a smaller destination size.');
  const entry={kind:'surface',targetId,label,before:structuredClone(before),after:structuredClone(after),delta:{byteLength},date:Date.now()};
  for(const discarded of history.redo)history.usedBytes-=discarded.delta.byteLength;history.redo=[];history.undo.push(entry);history.usedBytes+=byteLength;
  while(history.undo.length>history.maxSteps||history.usedBytes>history.budgetBytes)history.usedBytes-=history.undo.shift().delta.byteLength;
  applySurfaceState(project,after);return entry;
}

function crcTableValue(number) { for (let bit = 0; bit < 8; bit++) number = number & 1 ? 0xedb88320 ^ (number >>> 1) : number >>> 1; return number >>> 0; }
const crcTable = Uint32Array.from({ length: 256 }, (_, number) => crcTableValue(number));
function crc32(bytes) { let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8; return (value ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) {
  const name = encoder.encode(type), output = new Uint8Array(12 + data.length), view = new DataView(output.buffer); view.setUint32(0, data.length); output.set(name, 4); output.set(data, 8); view.setUint32(8 + data.length, crc32(output.subarray(4, 8 + data.length))); return output;
}
function concat(parts) { const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; }

export async function encodePaintPng(raster) {
  if (!isPaintRaster(raster)) throw Error('Cannot encode an invalid paint image.');
  if (typeof CompressionStream !== 'function') throw Error('PNG compression is unavailable in this runtime.');
  const raw = new Uint8Array((raster.width * 4 + 1) * raster.height);
  for (let y = 0; y < raster.height; y++) raw.set(raster.data.subarray(y * raster.width * 4, (y + 1) * raster.width * 4), y * (raster.width * 4 + 1) + 1);
  const compressed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const header = new Uint8Array(13), view = new DataView(header.buffer); view.setUint32(0, raster.width); view.setUint32(4, raster.height); header.set([8, 6, 0, 0, 0], 8);
  return concat([new Uint8Array([137,80,78,71,13,10,26,10]), pngChunk('IHDR', header), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array())]);
}

/** Project layers need straight RGBA bytes, including RGB under transparent
 * pixels. A browser canvas premultiplies alpha and cannot restore those bytes. */
export async function decodePaintPng(input) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input),signature=[137,80,78,71,13,10,26,10];
  if(!signature.every((value,index)=>bytes[index]===value))throw Error('Invalid paint PNG signature.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),parts=[];let width=0,height=0,ended=false;
  for(let offset=8;offset<bytes.length;){
    if(offset+12>bytes.length)throw Error('Paint PNG is truncated.');
    const length=view.getUint32(offset),end=offset+12+length;
    if(end>bytes.length)throw Error('Paint PNG is truncated.');
    const type=decoder.decode(bytes.subarray(offset+4,offset+8)),data=bytes.subarray(offset+8,end-4);
    if(crc32(bytes.subarray(offset+4,end-4))!==view.getUint32(end-4))throw Error('Paint PNG checksum failed.');
    if(type==='IHDR'){
      if(offset!==8||length!==13)throw Error('Invalid paint PNG header.');
      width=view.getUint32(offset+8);height=view.getUint32(offset+12);
      if(!width||!height||width>4096||height>4096||data[8]!==8||data[9]!==6||data[10]||data[11]||data[12])throw Error('Paint PNG must be noninterlaced RGBA8, up to 4096 pixels per side.');
    }else if(!width)throw Error('Paint PNG header is missing.');
    else if(type==='IDAT')parts.push(data);
    else if(type==='IEND'){if(length||end!==bytes.length)throw Error('Invalid paint PNG ending.');ended=true;break;}
    else if(!(bytes[offset+4]&32))throw Error('Unsupported paint PNG chunk: '+type+'.');
    offset=end;
  }
  if(!ended||!parts.length)throw Error('Paint PNG is incomplete.');
  const stride=width*4,raw=new Uint8Array((stride+1)*height),reader=new Blob(parts).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;if(size+value.length>raw.length)throw Error('Paint PNG has excess pixel data.');raw.set(value,size);size+=value.length;}}
  finally{await reader.cancel();reader.releaseLock();}
  if(size!==raw.length)throw Error('Paint PNG has incomplete pixel data.');
  const raster=createPaintRaster(width,height),data=raster.data;
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];if(filter>4)throw Error('Unsupported paint PNG filter.');
    for(let x=0;x<stride;x++){
      const p=y*stride+x,left=x>=4?data[p-4]:0,up=y?data[p-stride]:0,corner=y&&x>=4?data[p-stride-4]:0;
      let predictor=0;
      if(filter===1)predictor=left;else if(filter===2)predictor=up;else if(filter===3)predictor=(left+up)>>1;
      else if(filter===4){const estimate=left+up-corner,a=Math.abs(estimate-left),b=Math.abs(estimate-up),c=Math.abs(estimate-corner);predictor=a<=b&&a<=c?left:b<=c?up:corner;}
      data[p]=(raw[y*(stride+1)+x+1]+predictor)&255;
    }
  }
  return raster;
}

function safePart(value) { return String(value || 'item').replace(/[^a-z0-9_.-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'item'; }

export async function paintProjectFiles(project, { modelBytes, workingModelBytes = null, modelName = project.modelName, sourceTextures = [], assetManifest = null } = {}) {
  if (!(modelBytes instanceof Uint8Array)) throw Error('The original model bytes are required for a portable paint project.');
  const originalFile = `model/original/${safePart(modelName)}`, workingFile = `model/working/${safePart(modelName)}`;
  const manifest = { schema: project.schema, version: project.version, id: project.id, modelName, modelFiles: { original: originalFile, working: workingModelBytes instanceof Uint8Array ? workingFile : originalFile }, resolution: project.resolution, sourceMode: project.sourceMode, activeTargetId: project.activeTargetId, activeCoatId: project.activeCoatId, brushReferences: project.brushReferences || [], sourceTextures: [], createdAt: project.createdAt, updatedAt: new Date().toISOString(), targets: [] };
  const files = [{ name: originalFile, bytes: modelBytes }];
  manifest.materialMode=!!project.materialMode;manifest.preserveMaterials=!!project.preserveMaterials;manifest.materialRevision=project.materialRevision||0;manifest.paintMaterialsVersion=project.paintMaterialsVersion;manifest.excludedGeosets=project.excludedGeosets;manifest.uvEdits=project.uvEdits||{};manifest.generatedUVSets=project.generatedUVSets||{};manifest.paintAtlasVersion=project.paintAtlasVersion||0;manifest.viewSettings=project.viewSettings||null;
  if (workingModelBytes instanceof Uint8Array) files.push({ name: workingFile, bytes: workingModelBytes });
  manifest.preservedMaterials=project.preservedMaterials;
  for (const target of project.targets) {
    const folder = `layers/${safePart(target.id)}`, targetInfo = { id: target.id, textureId: target.textureId, texturePath: target.texturePath, paintName: target.paintName, materialId:target.materialId,material:target.material,materialVariants:target.materialVariants,basecoat:target.basecoat,generatedUV:target.generatedUV,preserveSourceAlpha:target.preserveSourceAlpha,nativeSource:target.nativeSource,sourcePath:target.sourcePath,citadelCopy:target.citadelCopy,label: target.label, flags: target.flags, bindings: target.bindings, geosetIndices: target.geosetIndices, materialIds: target.materialIds, sharedUV: target.sharedUV, base: `${folder}/source.png`, alphaMask: `${folder}/alpha-mask.png`, coats: [] };
    targetInfo.width=target.base.width;targetInfo.height=target.base.height;targetInfo.sourceTextureId=target.sourceTextureId;
    files.push({ name: targetInfo.base, bytes: await encodePaintPng(target.base) });
    files.push({ name: targetInfo.alphaMask, bytes: await encodePaintPng(target.alphaMask || createPaintRaster(target.base.width,target.base.height,[255,255,255,255])) });
    for (const coat of target.coats) { const name = `${folder}/${safePart(coat.id)}.png`; files.push({ name, bytes: await encodePaintPng(coat.raster) }); targetInfo.coats.push({ id: coat.id, name: coat.name, messageId: coat.messageId, opacity: coat.opacity, visible: coat.visible, file: name }); }
    manifest.targets.push(targetInfo);
  }
  for (const source of sourceTextures || []) if (source?.bytes?.byteLength) { const file = `source-textures/${manifest.sourceTextures.length}-${safePart(source.name)}`; files.push({ name: file, bytes: source.bytes }); manifest.sourceTextures.push({ name: source.name, file }); }
  if (assetManifest) files.push({ name: 'assets/manifest.json', bytes: encoder.encode(JSON.stringify(assetManifest, null, 2)) });
  files.unshift({ name: 'project.json', bytes: encoder.encode(JSON.stringify(manifest,(_key,value)=>ArrayBuffer.isView(value)?{paintArray:value.constructor.name,values:Array.from(value)}:value,2)) });
  return files;
}

export async function paintProjectArchive(project, options) { return storedZipArchive(await paintProjectFiles(project, options)); }

export function readStoredZip(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), view = new DataView(data.buffer, data.byteOffset, data.byteLength), files = new Map(); let offset = 0;
  while (offset + 30 <= data.length && view.getUint32(offset, true) === 0x04034b50) {
    const flags = view.getUint16(offset + 6, true), method = view.getUint16(offset + 8, true), checksum=view.getUint32(offset+14,true),size = view.getUint32(offset + 18, true), uncompressed=view.getUint32(offset+22,true),nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    if (flags & 8 || method !== 0 || size!==uncompressed) throw Error('Paint projects must use stored ZIP entries.');
    const start = offset + 30 + nameLength + extraLength, end = start + size; if (end > data.length) throw Error('Paint project is truncated.');
    const name = decoder.decode(data.subarray(offset + 30, offset + 30 + nameLength)); if (!name || name.includes('..') || name.startsWith('/') || name.startsWith('\\')) throw Error('Paint project contains an unsafe path.');
    if(files.has(name))throw Error('Paint project contains a duplicate path.');const payload=data.slice(start,end);if(crc32(payload)!==checksum)throw Error(`Paint project checksum failed: ${name}.`);
    files.set(name, payload); offset = end;
  }
  return files;
}

export async function restorePaintProject(bytes, decodePng = decodePaintPng) {
  const files = readStoredZip(bytes), manifestBytes = files.get('project.json'); if (!manifestBytes) throw Error('Paint project manifest is missing.');
  const arrayTypes={Float32Array,Float64Array,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array};
  const manifest = JSON.parse(decoder.decode(manifestBytes),(_key,value)=>value?.paintArray&&arrayTypes[value.paintArray]&&Array.isArray(value.values)?new arrayTypes[value.paintArray](value.values):value);
  if (manifest.schema !== PAINT_PROJECT_SCHEMA || manifest.version !== PAINT_PROJECT_VERSION || !isPaintResolution(manifest.resolution) || !Array.isArray(manifest.targets)) throw Error('Unsupported paint project.');
  const project = createPaintProject(manifest); project.id = manifest.id; project.createdAt = manifest.createdAt; project.updatedAt = manifest.updatedAt;
  project.brushReferences = Array.isArray(manifest.brushReferences) ? manifest.brushReferences : [];
  project.preservedMaterials=manifest.preservedMaterials;
  project.materialMode=!!manifest.materialMode;project.preserveMaterials=!!manifest.preserveMaterials;project.materialRevision=manifest.materialRevision||0;project.paintMaterialsVersion=manifest.paintMaterialsVersion;project.excludedGeosets=manifest.excludedGeosets;project.uvEdits=manifest.uvEdits||{};project.generatedUVSets=manifest.generatedUVSets||{};project.paintAtlasVersion=manifest.paintAtlasVersion||0;project.viewSettings=manifest.viewSettings||null;
  const checkedRaster=async(value,label,width,height)=>{const raster=await decodePng(value);if(!isPaintRaster(raster)||raster.width!==width||raster.height!==height)throw Error(`Paint image has the wrong size: ${label}.`);return raster;};
  for (const targetInfo of manifest.targets) {
    const baseBytes = files.get(targetInfo.base); if (!baseBytes) throw Error(`Paint source is missing for ${targetInfo.label}.`);
    const width=targetInfo.width??project.resolution,height=targetInfo.height??project.resolution;
    const base = await checkedRaster(baseBytes,targetInfo.base,width,height), target = addPaintProjectTarget(project, targetInfo, base); target.coats = [];
    if(targetInfo.alphaMask){const alphaBytes=files.get(targetInfo.alphaMask);if(!alphaBytes)throw Error(`Paint alpha mask is missing for ${targetInfo.label}.`);target.alphaMask=await checkedRaster(alphaBytes,targetInfo.alphaMask,width,height);}
    for (const coatInfo of targetInfo.coats || []) { const coatBytes = files.get(coatInfo.file); if (!coatBytes) throw Error(`Paint coat is missing: ${coatInfo.name}.`); target.coats.push({ ...coatInfo, raster: await checkedRaster(coatBytes,coatInfo.file,width,height) }); }
  }
  project.activeTargetId = manifest.activeTargetId; project.activeCoatId = manifest.activeCoatId; project.dirty = false; project.history = { ...project.history, undo: [], redo: [], usedBytes: 0 };
  const legacyModel = [...files.entries()].find(([name]) => name.startsWith('model/'))?.[1] || null;
  const sourceTextures = (manifest.sourceTextures || []).map(source=>({name:source.name,bytes:files.get(source.file)})).filter(source=>source.bytes);
  return { project, files, modelName:manifest.modelName, originalModelBytes:files.get(manifest.modelFiles?.original)||legacyModel, workingModelBytes:files.get(manifest.modelFiles?.working)||legacyModel, modelBytes:files.get(manifest.modelFiles?.working)||legacyModel, sourceTextures };
}
