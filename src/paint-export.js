import { decodeBLP, getBLPImageData } from 'war3-model';
import { EditorDocument, openDocument } from './editor-document.js';
import { storedZipArchive } from './forge-assets.js';
import { PAINT_ASSET_MANIFEST } from './paint-assets.js';
import { PAINT_BRUSH_TIP_MANIFEST } from './paint-brushes.js';
import { encodePaintBlp1, PAINT_BLP_ENCODER } from './paint-blp.js';
import { compositePaintTarget, paintProjectArchive } from './paint-project.js';
import { findTextureAsset } from './paint-targets.js';
import { paintProjectModel } from './paint-view.js';

const encoder = new TextEncoder();
const slash = value => String(value || '').replaceAll('\\','/');
const safeBase = value => String(value || 'model').replace(/\.(?:mdl|mdx)$/i,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'model';

function exportPaintModel(model,project,originalModelBytes,modelName){
  // Recovered working models may already contain the rejected build's helper
  // assignments. Match the viewport repair even when Apply has not run yet.
  const original=project?.excludedGeosets?.length?openDocument(originalModelBytes,modelName).model:null;
  return paintProjectModel(model,project,original);
}

function uniqueTexturePath(model, base, number, reserved) {
  const used = new Set((model.Textures || []).map(texture=>slash(texture.Image).toLowerCase()));
  let suffix = number + 1, path;
  do { path = `MDLxL_Forge/${base}_paint_${suffix}.blp`; suffix++; } while (used.has(path.toLowerCase()) || reserved.has(path.toLowerCase()));
  reserved.add(path.toLowerCase()); return path;
}

function validateBlp(bytes, expected) {
  const buffer = bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength), decoded = getBLPImageData(decodeBLP(buffer),0);
  if (decoded.width !== expected.width || decoded.height !== expected.height || decoded.data.length !== expected.data.length) throw Error('BLP validation changed the painted texture dimensions.');
  return true;
}

export async function buildPaintProjectArtifact(doc, project, assets, originalModelBytes = doc.originalBytes) {
  const sourceTextures = [], seen = new Set();
  for (const texture of doc.model.Textures || []) {
    const key = slash(texture.Image).toLowerCase(); if (!key || texture.ReplaceableId || seen.has(key)) continue;
    seen.add(key); const asset = findTextureAsset(assets, texture.Image);
    if (asset?.bytes) sourceTextures.push({ ...asset, name: texture.Image });
  }
  const working=EditorDocument.restoreRecoveryState(doc.captureRecoveryState({includeHistory:false}));
  working.model=exportPaintModel(working.model,project,originalModelBytes,doc.name);
  return paintProjectArchive(project,{modelBytes:originalModelBytes,workingModelBytes:working.serialize(doc.format),modelName:doc.name,sourceTextures,assetManifest:{...PAINT_ASSET_MANIFEST,brushTips:PAINT_BRUSH_TIP_MANIFEST}});
}

/** Build a new model copy, BLP textures and editable project without mutating the open document. */
export async function buildPaintExportArtifact(doc, project, assets, originalModelBytes = doc.originalBytes) {
  if (!project?.targets?.length) throw Error('Paint at least one texture target before exporting.');
  if (doc.model.Version !== 800) throw Error('Texture Painter v1 exports Classic Warcraft III SD / v800 models only.');
  const staged = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({includeHistory:false})), base = safeBase(doc.name), reserved = new Set(), textures = [];
  staged.model=exportPaintModel(staged.model,project,originalModelBytes,doc.name);
  for (let index=0;index<project.targets.length;index++) {
    const target=project.targets[index];if(project.materialMode&&!target.bindings.length)continue;const raster=compositePaintTarget(project,target.id), bytes=await encodePaintBlp1(raster,{jpegQuality:90}); validateBlp(bytes,raster);
    const texture=staged.model.Textures?.[target.textureId]; if(!texture)throw Error(`Paint target ${target.label} no longer exists in the model.`);
    const name=project.materialMode?'Textures/'+String(target.paintName||target.label).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.blp':uniqueTexturePath(staged.model,target.paintName?safeBase(target.paintName):base,index,reserved);if(reserved.has(name.toLowerCase())&&project.materialMode)throw Error('Two paint textures have the same filename. Rename one before exporting.');reserved.add(name.toLowerCase()); texture.Image=name.replaceAll('/','\\'); texture.ReplaceableId=0; texture.Flags=target.flags||0; textures.push({name,bytes});
  }
  const format=doc.format,modelName=`${base}-painted.${format}`,modelBytes=staged.serialize(format),paintBlob=await buildPaintProjectArtifact(doc,project,assets,originalModelBytes),paintBytes=new Uint8Array(await paintBlob.arrayBuffer()),projectName=`${base}.mdlxlpaint`;
  const exportInfo={schema:'mdlxl-paint-export',version:1,model:modelName,project:projectName,textureEncoder:PAINT_BLP_ENCODER,textures:textures.map(item=>item.name),createdAt:new Date().toISOString()};
  const originals = [], used = new Set(textures.map(texture => texture.name.toLowerCase()));
  for (const texture of staged.model.Textures || []) {
    const name = slash(texture.Image); if (!name || texture.ReplaceableId || used.has(name.toLowerCase())) continue;
    const asset = findTextureAsset(assets, texture.Image); if (!asset?.bytes) continue;
    if (name.startsWith('/') || name.includes(':') || name.split('/').includes('..')) throw Error(`Texture path cannot be exported: ${name}`);
    originals.push({ name, bytes: asset.bytes }); used.add(name.toLowerCase());
  }
  const archive=storedZipArchive([{name:modelName,bytes:modelBytes},...textures,...originals,{name:projectName,bytes:paintBytes},{name:'MDLxL_Forge/paint-export.json',bytes:encoder.encode(JSON.stringify(exportInfo,null,2))}]);
  return {archive,modelName,projectName,textures,exportInfo};
}
