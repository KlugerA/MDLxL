import { PAINT_COATS, PAINT_PROJECT_SCHEMA, PAINT_PROJECT_VERSION, isPaintResolution } from './paint-types.js';
import { applyRasterDelta, clonePaintRaster, compositePaintRasters, createPaintRaster, rasterRegionDelta } from './paint-raster.js';
import { storedZipArchive } from './forge-assets.js';

const encoder = new TextEncoder(), decoder = new TextDecoder();

export function createPaintProject({ modelName, resolution = 256, sourceMode = 'current', historyBudgetBytes = 128 * 1024 * 1024, historyMaxSteps = 250 } = {}) {
  if (!isPaintResolution(resolution)) throw Error('Paint textures must be 256×256 or 512×512.');
  return {
    schema: PAINT_PROJECT_SCHEMA, version: PAINT_PROJECT_VERSION, id: crypto.randomUUID(), modelName: String(modelName || 'Untitled.mdl'), resolution: Number(resolution), sourceMode: sourceMode === 'primer' ? 'primer' : 'current',
    targets: [], activeTargetId: null, activeCoatId: 'base', brushReferences: [], uvEdits: {}, uvRevision: 0, dirty: false, revision: 0,
    history: { undo: [], redo: [], usedBytes: 0, budgetBytes: Math.max(8 * 1024 * 1024, Number(historyBudgetBytes) || 0), maxSteps: Math.max(10, Number(historyMaxSteps) || 0) },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export function addPaintProjectTarget(project, target, baseRaster) {
  if (project.targets.some(item => item.id === targetRez(target.id))) return project.targets.find(item => item.id === target.id);
  const base = baseRaster ? clonePaintRaster(baseRaster) : createPaintRaster(project.resolution, project.resolution, [124, 126, 119, 255]);
  if (base.width !== project.resolution || base.height !== project.resolution) throw Error('Paint target resolution does not match the project.');
  const entry = { ...structuredClone(target), id: targetRez(target.id), base, coats: PAINT_COATS.map(coat => ({ ...coat, visible: true, raster: createPaintRaster(project.resolution) })), alphaMask: createPaintRaster(project.resolution, project.resolution, [255,255,255,255]), smartMasks: null };
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

export function travelPaintHistory(project, redo = false) {
  const from = redo ? project.history.redo : project.history.undo, to = redo ? project.history.undo : project.history.redo, entry = from.pop(); if (!entry) return null;
  if(entry.kind==='uv'){
    project.uvEdits[entry.key]=Array.from(redo?entry.after:entry.before);project.uvRevision=(project.uvRevision||0)+1;project.revision++;project.dirty=true;to.push(entry);return entry;
  }
  const changes=entry.changes||[{coatId:entry.coatId,delta:entry.delta}];
  if(changes.some(change=>!paintProjectCoat(project,entry.targetId,change.coatId))){from.push(entry);throw Error('Paint history refers to a missing coat.');}
  for(const change of changes)applyRasterDelta(paintProjectCoat(project,entry.targetId,change.coatId).raster,change.delta,redo?'after':'before');to.push(entry);
  const target = paintProjectTarget(project, entry.targetId); target.revision = (target.revision || 0) + 1;
  project.revision++; project.dirty = true; project.updatedAt = new Date().toISOString(); return entry;
}

/** Replace an entire coat including alpha as one undoable texture operation. */
export function replacePaintTexture(project,targetId,coatId,raster) {
  const target=paintProjectTarget(project,targetId),coat=paintProjectCoat(project,targetId,coatId);
  if(!target||!coat||!coat.visible)throw Error('Choose a visible paint coat.');
  if(raster.width!==project.resolution||raster.height!==project.resolution)throw Error('Texture size does not match the preset.');
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

function crcTableValue(number) { for (let bit = 0; bit < 8; bit++) number = number & 1 ? 0xedb88320 ^ (number >>> 1) : number >>> 1; return number >>> 0; }
const crcTable = Uint32Array.from({ length: 256 }, (_, number) => crcTableValue(number));
function crc32(bytes) { let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8; return (value ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) {
  const name = encoder.encode(type), output = new Uint8Array(12 + data.length), view = new DataView(output.buffer); view.setUint32(0, data.length); output.set(name, 4); output.set(data, 8); view.setUint32(8 + data.length, crc32(output.subarray(4, 8 + data.length))); return output;
}
function concat(parts) { const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; }

export async function encodePaintPng(raster) {
  if (typeof CompressionStream !== 'function') throw Error('PNG compression is unavailable in this runtime.');
  const raw = new Uint8Array((raster.width * 4 + 1) * raster.height);
  for (let y = 0; y < raster.height; y++) raw.set(raster.data.subarray(y * raster.width * 4, (y + 1) * raster.width * 4), y * (raster.width * 4 + 1) + 1);
  const compressed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const header = new Uint8Array(13), view = new DataView(header.buffer); view.setUint32(0, raster.width); view.setUint32(4, raster.height); header.set([8, 6, 0, 0, 0], 8);
  return concat([new Uint8Array([137,80,78,71,13,10,26,10]), pngChunk('IHDR', header), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array())]);
}

function safePart(value) { return String(value || 'item').replace(/[^a-z0-9_.-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'item'; }

export async function paintProjectFiles(project, { modelBytes, workingModelBytes = null, modelName = project.modelName, sourceTextures = [], assetManifest = null } = {}) {
  if (!(modelBytes instanceof Uint8Array)) throw Error('The original model bytes are required for a portable paint project.');
  const originalFile = `model/original/${safePart(modelName)}`, workingFile = `model/working/${safePart(modelName)}`;
  const manifest = { schema: project.schema, version: project.version, id: project.id, modelName, modelFiles: { original: originalFile, working: workingModelBytes instanceof Uint8Array ? workingFile : originalFile }, resolution: project.resolution, sourceMode: project.sourceMode, activeTargetId: project.activeTargetId, activeCoatId: project.activeCoatId, brushReferences: project.brushReferences || [], sourceTextures: [], createdAt: project.createdAt, updatedAt: new Date().toISOString(), targets: [] };
  const files = [{ name: originalFile, bytes: modelBytes }];
  manifest.materialMode=!!project.materialMode;manifest.materialRevision=project.materialRevision||0;manifest.paintMaterialsVersion=project.paintMaterialsVersion;manifest.excludedGeosets=project.excludedGeosets;manifest.uvEdits=project.uvEdits||{};manifest.viewSettings=project.viewSettings||null;
  if (workingModelBytes instanceof Uint8Array) files.push({ name: workingFile, bytes: workingModelBytes });
  for (const target of project.targets) {
    const folder = `layers/${safePart(target.id)}`, targetInfo = { id: target.id, textureId: target.textureId, texturePath: target.texturePath, paintName: target.paintName, materialId:target.materialId,material:target.material,materialVariants:target.materialVariants,basecoat:target.basecoat,preserveSourceAlpha:target.preserveSourceAlpha,nativeSource:target.nativeSource,sourcePath:target.sourcePath,citadelCopy:target.citadelCopy,label: target.label, flags: target.flags, bindings: target.bindings, geosetIndices: target.geosetIndices, materialIds: target.materialIds, sharedUV: target.sharedUV, base: `${folder}/source.png`, alphaMask: `${folder}/alpha-mask.png`, coats: [] };
    files.push({ name: targetInfo.base, bytes: await encodePaintPng(target.base) });
    files.push({ name: targetInfo.alphaMask, bytes: await encodePaintPng(target.alphaMask || createPaintRaster(project.resolution,project.resolution,[255,255,255,255])) });
    for (const coat of target.coats) { const name = `${folder}/${safePart(coat.id)}.png`; files.push({ name, bytes: await encodePaintPng(coat.raster) }); targetInfo.coats.push({ id: coat.id, name: coat.name, messageId: coat.messageId, opacity: coat.opacity, visible: coat.visible, file: name }); }
    manifest.targets.push(targetInfo);
  }
  for (const source of sourceTextures || []) if (source?.bytes?.byteLength) { const file = `source-textures/${manifest.sourceTextures.length}-${safePart(source.name)}`; files.push({ name: file, bytes: source.bytes }); manifest.sourceTextures.push({ name: source.name, file }); }
  if (assetManifest) files.push({ name: 'assets/manifest.json', bytes: encoder.encode(JSON.stringify(assetManifest, null, 2)) });
  files.unshift({ name: 'project.json', bytes: encoder.encode(JSON.stringify(manifest, null, 2)) });
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

export async function restorePaintProject(bytes, decodePng) {
  const files = readStoredZip(bytes), manifestBytes = files.get('project.json'); if (!manifestBytes) throw Error('Paint project manifest is missing.');
  const manifest = JSON.parse(decoder.decode(manifestBytes));
  if (manifest.schema !== PAINT_PROJECT_SCHEMA || manifest.version !== PAINT_PROJECT_VERSION || !isPaintResolution(manifest.resolution) || !Array.isArray(manifest.targets)) throw Error('Unsupported paint project.');
  const project = createPaintProject(manifest); project.id = manifest.id; project.createdAt = manifest.createdAt; project.updatedAt = manifest.updatedAt;
  project.brushReferences = Array.isArray(manifest.brushReferences) ? manifest.brushReferences : [];
  project.materialMode=!!manifest.materialMode;project.materialRevision=manifest.materialRevision||0;project.paintMaterialsVersion=manifest.paintMaterialsVersion;project.excludedGeosets=manifest.excludedGeosets;project.uvEdits=manifest.uvEdits||{};project.viewSettings=manifest.viewSettings||null;
  const checkedRaster=async(value,label)=>{const raster=await decodePng(value);if(raster?.width!==project.resolution||raster?.height!==project.resolution||raster.data?.length!==project.resolution*project.resolution*4)throw Error(`Paint image has the wrong size: ${label}.`);return raster;};
  for (const targetInfo of manifest.targets) {
    const baseBytes = files.get(targetInfo.base); if (!baseBytes) throw Error(`Paint source is missing for ${targetInfo.label}.`);
    const base = await checkedRaster(baseBytes,targetInfo.base), target = addPaintProjectTarget(project, targetInfo, base); target.coats = [];
    if(targetInfo.alphaMask){const alphaBytes=files.get(targetInfo.alphaMask);if(!alphaBytes)throw Error(`Paint alpha mask is missing for ${targetInfo.label}.`);target.alphaMask=await checkedRaster(alphaBytes,targetInfo.alphaMask);}
    for (const coatInfo of targetInfo.coats || []) { const coatBytes = files.get(coatInfo.file); if (!coatBytes) throw Error(`Paint coat is missing: ${coatInfo.name}.`); target.coats.push({ ...coatInfo, raster: await checkedRaster(coatBytes,coatInfo.file) }); }
  }
  project.activeTargetId = manifest.activeTargetId; project.activeCoatId = manifest.activeCoatId; project.dirty = false; project.history = { ...project.history, undo: [], redo: [], usedBytes: 0 };
  const legacyModel = [...files.entries()].find(([name]) => name.startsWith('model/'))?.[1] || null;
  const sourceTextures = (manifest.sourceTextures || []).map(source=>({name:source.name,bytes:files.get(source.file)})).filter(source=>source.bytes);
  return { project, files, modelName:manifest.modelName, originalModelBytes:files.get(manifest.modelFiles?.original)||legacyModel, workingModelBytes:files.get(manifest.modelFiles?.working)||legacyModel, modelBytes:files.get(manifest.modelFiles?.working)||legacyModel, sourceTextures };
}
