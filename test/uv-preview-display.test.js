import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUVPreviewDisplay,occupiedUVTextureFrames,previewMeshDomain,uvPreviewOverlay} from '../src/uv-preview-display.js';
import {normalizePreferences} from '../src/preferences.js';
import {exportConfiguration,importConfiguration} from '../src/portable-settings.js';
import {createRequire} from 'node:module';
const {buildMenuTemplate}=createRequire(import.meta.url)('../electron/menu.cjs');

test('preview options default clean and persist independently of editor mesh size/visibility',()=>{
  const next=normalizePreferences({uvPreviewDisplay:{mesh:'selected',size:2.5,textureFrame:true},visuals:{vertexSize:4,lineWidth:.5},grid:{planes:{xy:false}}});
  assert.deepEqual(next.uvPreviewDisplay,{mesh:'selected',size:2.5,textureFrame:true});
  assert.equal(next.visuals.vertexSize,4);assert.equal(next.visuals.lineWidth,.5);
  assert.deepEqual(importConfiguration(exportConfiguration(next)).uvPreviewDisplay,next.uvPreviewDisplay);
  assert.deepEqual(normalizeUVPreviewDisplay({mesh:'bad',size:Infinity,textureFrame:'yes'}),{mesh:'none',size:1,textureFrame:false});
  assert.deepEqual(normalizeUVPreviewDisplay({size:-2,textureFrame:true}),{mesh:'none',size:.25,textureFrame:true});
  assert.deepEqual(normalizeUVPreviewDisplay(),{mesh:'none',size:1,textureFrame:false});
});

test('Show mesh covers model geometry but Highlight Select contains only active selected UV points',()=>{
  const model={Geosets:[{Vertices:new Float32Array([0,0,0,1,0,0,0,1,0])},{Vertices:new Float32Array([3,3,3,4,4,4])}]};
  const before=structuredClone(model),domain=previewMeshDomain(model);
  assert.deepEqual(domain,{0:[0,1,2],1:[0,1]});
  const all=uvPreviewOverlay(domain,0,[1,1,200,-1],{mesh:'all',size:.5});
  assert.equal(all.allMesh,true);assert.equal(all.highlightSelection,false);assert.deepEqual(all.selectionByGeoset,{0:[1]});
  const selected=uvPreviewOverlay(domain,1,[0],{mesh:'selected',size:3});
  assert.equal(selected.allMesh,false);assert.equal(selected.highlightSelection,true);assert.deepEqual(selected.selectionByGeoset,{1:[0]});
  assert.deepEqual(uvPreviewOverlay(domain,-1,[],{mesh:'selected'}).selectionByGeoset,{});
  assert.deepEqual(model,before,'preview decoration never mutates geometry');
});

test('texture-frame highlighting follows every repeated tile containing UV faces',()=>{
  const uv=new Float32Array([0,0,1,0,1,1,0,1,1.2,.2,2.2,.2,1.2,.8]);
  assert.deepEqual(occupiedUVTextureFrames(uv,[[0,1,2],[0,2,3],[4,5,6]],[0,1,2,3,4,5,6]),[[0,0],[1,0],[2,0]]);
  assert.deepEqual(occupiedUVTextureFrames(new Float32Array([-1,-1,0,-1,0,0]),[[0,1,2]],[0,1,2]),[[-1,-1]]);
  assert.deepEqual(occupiedUVTextureFrames(new Float32Array([3.2,-2.4]),[],[0]),[[3,-3]]);
});

test('clean preview View controls cannot change the retained editing display',()=>{
  const actions=[],menus=buildMenuTemplate({},id=>actions.push(id),'win32',[],x=>x,{preview:true,checks:{frame:true}});
  const rows=menus.find(menu=>menu.label==='View').submenu.filter(row=>row.type!=='separator');
  assert(rows.filter(row=>!['Textured View','Surface','Clean View'].includes(row.label)).every(row=>row.enabled===false));
  assert.equal(rows.find(row=>row.label==='Textured View').checked,true);
  for(const row of rows)row.click();
  assert.deepEqual(actions,['cleanView','frameSelection','frame']);
  const editor=buildMenuTemplate({},id=>actions.push(id),'win32',[],x=>x,{preview:false});
  editor.find(menu=>menu.label==='View').submenu.find(row=>row.label==='Surface').click();
  assert.deepEqual(actions,['cleanView','frameSelection','frame','frameSelection']);
});
