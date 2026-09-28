import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {applyMaterialPreset,materialPreset,tintTexturePath,setMaterialLayerTexture} from '../src/material-presets.js';
import {TEAM_COLORS} from '../src/team-colors.js';
import {beginUVPreview,uvPreviewModel,applyUVPreviews} from '../src/uv-preview.js';
import {compositeMaterialPixels} from '../src/uv-material-compositor.js';
const fixture=()=>{const doc=createDemoDocument();doc.apply('base',['Materials','Textures'],m=>{m.Textures.push({Image:'Armor.blp',ReplaceableId:0,Flags:3});m.Materials[0].Layers=[{TextureID:m.Textures.length-1,FilterMode:1,Shading:0,CoordId:0,Alpha:1,TVertexAnimId:null}];});return doc;};

test('overlay and fixed tint reproduce the archer armor settings and preserve unrelated data',()=>{
 const doc=fixture(),before=structuredClone(doc.model),base=doc.model.Materials[0].Layers[0].TextureID;
 for(const preset of ['Team Color Overlay','Color Tint']){
  doc.apply(preset,['Materials','Textures'],m=>applyMaterialPreset(m,0,preset,12));
  const layers=doc.model.Materials[0].Layers;
  assert.deepEqual(layers.map(l=>[l.FilterMode,l.Shading,l.Alpha]),[[0,16,1],[3,0,.05],[5,16,1]]);
  assert.equal(layers[0].TextureID,base);assert.equal(layers[2].TextureID,base);
  const middle=doc.model.Textures[layers[1].TextureID];
  assert.equal(middle.ReplaceableId,preset==='Color Tint'?0:1);
  if(preset==='Color Tint')assert.equal(middle.Image,tintTexturePath(12));
  assert.equal(materialPreset(doc.model,0).preset,preset);
  for(const key of Object.keys(before))if(!['Materials','Textures'].includes(key))assert.deepEqual(doc.model[key],before[key],key);
 }
});
test('standard Team Color draws opaque replaceable color before the alpha-blended base',()=>{
 const doc=fixture(),base=doc.model.Materials[0].Layers[0].TextureID;
 for(const preset of ['Team Color','Color Tint','Team Color Overlay','Team Color'])doc.apply(preset,['Materials','Textures'],m=>applyMaterialPreset(m,0,preset));
 const layers=doc.model.Materials[0].Layers;
 assert.equal(layers.length,2);assert.equal(layers[0].FilterMode,0);assert.ok(layers[0].Shading&1);
 assert.equal(doc.model.Textures[layers[0].TextureID].ReplaceableId,1);assert.equal(layers[1].TextureID,base);assert.equal(layers[1].FilterMode,2);
 assert.equal(materialPreset(doc.model,0).preset,'Team Color');
});
test('each fixed color survives save/reopen, repeated application reuses textures, and edits undo exactly',()=>{
 const doc=fixture(),before=doc.serialize('mdx');
 for(let tint=0;tint<TEAM_COLORS.length;tint++){
  doc.apply('Tint',['Materials','Textures'],m=>applyMaterialPreset(m,0,'Color Tint',tint));
  const count=doc.model.Textures.length;
  applyMaterialPreset(doc.model,0,'Color Tint',tint);assert.equal(doc.model.Textures.length,count);
  const reopened=openDocument(doc.serialize('mdx'),'tint.mdx');assert.equal(materialPreset(reopened.model,0).tint,tint);
  doc.undo();assert.deepEqual(doc.serialize('mdx'),before);
  doc.redo();assert.equal(materialPreset(doc.model,0).tint,tint);doc.undo();
 }
});
test('Current is a no-op and invalid choices do not append textures',()=>{
 const doc=fixture(),before=structuredClone(doc.model);assert.equal(applyMaterialPreset(doc.model,0,''),false);
 assert.throws(()=>applyMaterialPreset(doc.model,0,'Color Tint',100),/tint/);assert.deepEqual(doc.model,before);
});
test('supplied archer armor matches the overlay stack without rewriting the input',{skip:!process.env.MDLXL_ARCHER},()=>{
 const bytes=fs.readFileSync(process.env.MDLXL_ARCHER),doc=openDocument(bytes,'archer.mdx');
 const before=structuredClone(doc.model.Materials[4]);assert.deepEqual(before.Layers.map(l=>[l.FilterMode,l.Shading]),[[0,16],[3,0],[5,16]]);before.Layers[1].TextureID=doc.model.Textures.findIndex(t=>t.ReplaceableId===1);
 doc.apply('Overlay',['Materials','Textures'],m=>applyMaterialPreset(m,4,'Team Color Overlay'));
 assert.deepEqual(openDocument(doc.serialize('mdx'),'archer.mdx').model.Materials[4],before);
 assert.ok(bytes.equals(fs.readFileSync(process.env.MDLXL_ARCHER)));
});

test('5% additive tint contributes 5% RGB while ignoring texture alpha',()=>{
 const result=compositeMaterialPixels([{pixels:new Uint8ClampedArray([100,100,100,255]),filterMode:0,alpha:1},{pixels:new Uint8ClampedArray([200,0,0,0]),filterMode:3,alpha:.05}],1,1);
 assert.deepEqual([...result],[110,100,100,255]);
});

test('replacing a tint base in UV updates both passes through preview, save, reopen and undo',()=>{
 for(const preset of ['Team Color Overlay','Color Tint']){
  const doc=fixture();doc.apply(preset,['Materials','Textures'],m=>applyMaterialPreset(m,0,preset,12));
  const before=doc.serialize('mdx'),middle=structuredClone(doc.model.Materials[0].Layers[1]);
  const drafts=beginUVPreview(doc.model,{},[0],{name:'Textures\\Replacement.blp',bytes:new Uint8Array([1])});
  const check=m=>{const layers=m.Materials[m.Geosets[0].MaterialID].Layers;assert.equal(layers[0].TextureID,layers[2].TextureID);assert.equal(m.Textures[layers[0].TextureID].Image,'Textures\\Replacement.blp');assert.deepEqual(layers[1],middle);};
  check(uvPreviewModel(doc.model,drafts));assert.deepEqual(doc.serialize('mdx'),before);
  doc.apply('Replace base',['Materials','Textures','Geosets'],m=>applyUVPreviews(m,drafts));check(doc.model);
  const reopened=openDocument(doc.serialize('mdx'),'replacement.mdx').model,layers=reopened.Materials[reopened.Geosets[0].MaterialID].Layers;
  assert.equal(layers[0].TextureID,layers[2].TextureID);assert.equal(reopened.Textures[layers[0].TextureID].Image,'Textures\\Replacement.blp');
  doc.undo();assert.deepEqual(doc.serialize('mdx'),before);doc.redo();check(doc.model);
 }
});
test('manager changes to either base pass keep static and animated textures paired, without changing the tint',()=>{
 const doc=fixture();applyMaterialPreset(doc.model,0,'Color Tint',12);const mat=doc.model.Materials[0],middle=structuredClone(mat.Layers[1]);
 doc.model.Textures.push({Image:'Other.blp',ReplaceableId:0,Flags:0});const id=doc.model.Textures.length-1;
 setMaterialLayerTexture(mat,2,id);assert.equal(mat.Layers[0].TextureID,id);assert.deepEqual(mat.Layers[1],middle);
 mat.Layers[1].TextureID=0;mat.Layers[1].Alpha=.25;
 const track={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Uint32Array([id])}]};
 setMaterialLayerTexture(mat,0,track);assert.deepEqual(mat.Layers[2].TextureID,track);assert.notEqual(mat.Layers[0].TextureID,mat.Layers[2].TextureID);
 setMaterialLayerTexture(mat,1,id);assert.deepEqual(mat.Layers[0].TextureID,track);assert.deepEqual(mat.Layers[2].TextureID,track);
});
