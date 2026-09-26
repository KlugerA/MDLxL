import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {normalizePreferences,effectiveBindings} from '../src/preferences.js';
import {exportConfiguration,importConfiguration} from '../src/portable-settings.js';
import {COMMANDS} from '../src/commands.js';
const require=createRequire(import.meta.url);
const {buildMenuTemplate}=require('../electron/menu.cjs');

test('View menu follows each editor and keeps Skeleton independent',()=>{
  const checks={'display:bones':true,'display:skeleton':false,showVertices:true,shaded:true,grid:false},actions=[];
  const bindings=effectiveBindings(COMMANDS,{normals:['H']});
  const expected={
    vertices:['Shadows','Vertices','Normals','Wireframe Overlay','Grid','Clear'],
    bones:['Shadows','Vertices','Bones','Skeleton','Nodes','Attachment','Grid','Clear'],
    movement:['Shadows','Vertices','Bones','Skeleton','Nodes','Attachment','Grid','Clear'],
    animations:['Bones','Skeleton','Nodes','Particles','Wireframe','Grid','Clear'],
  };
  for(const [viewMode,labels] of Object.entries(expected)){
    const menus=buildMenuTemplate(bindings,id=>actions.push(id),'win32',[],x=>x,{checks,viewMode,uvEnabled:false});
    const rows=menus.find(menu=>menu.label==='View').submenu;
    assert.deepEqual(rows.map(row=>row.label),labels);
    assert.equal(rows.at(-1).type,undefined);
    if(viewMode==='bones'){
      assert.equal(rows[2].checked,true);assert.equal(rows[3].checked,false);
      rows[3].click();rows.at(-1).click();
    }
    if(viewMode==='vertices'){
      assert.equal(rows[2].accelerator,'H');
      assert.equal(rows[2].registerAccelerator,false);
    }
  }
  assert.deepEqual(actions,['display:skeleton','clearDisplay']);
});
test('Frames is removed and all frame operations remain in Edit; UV entry follows actual eligibility',()=>{
  const actions=[];
  const menus=buildMenuTemplate({},id=>actions.push(id),'win32',[],x=>x,{uvEnabled:false});
  assert.ok(!menus.some(menu=>menu.label==='Frames'));
  menus.find(menu=>menu.label==='&Edit').submenu.find(row=>row.label==='Keyframes').submenu.forEach(row=>row.click());
  assert.deepEqual(actions,['keyframe:copy','keyframe:copyPose','keyframe:paste','keyframe:delete','keyframe:clear']);
  const modules=menus.find(menu=>menu.label==='Modules').submenu;
  assert.ok(modules.some(row=>row.label==='Bones'));
  const uv=modules.find(row=>row.label==='UV-maps');assert.equal(uv.enabled,false);uv.click();assert.equal(actions.length,5);
  buildMenuTemplate({},id=>actions.push(id),'win32',[],x=>x,{uvEnabled:true}).find(menu=>menu.label==='Modules').submenu.find(row=>row.label==='UV-maps').click();
  assert.equal(actions.at(-1),'uv');
});
test('old profiles adopt sharp grid/raster defaults once, preserving lighting and custom visuals',()=>{
  const lighting={preset:'custom',ambient:[80,90,100],diffuse:[170,180,190],specular:[0,0,0],power:3};
  const next=normalizePreferences({lighting,panelWidth:178,visuals:{gridMajor:'#404958',background:'#112233'},grid:{opacity:.65,majorOpacity:.9,followWorkplane:true,planes:{xy:false,xz:true}},graphics:{antialias:true}});
  assert.deepEqual(next.lighting,lighting);assert.equal(next.visuals.background,'#112233');
  assert.equal(next.panelWidth,164);assert.equal(next.visuals.gridMajor,'#000000');assert.equal(next.grid.opacity,1);assert.equal(next.grid.majorOpacity,1);assert.equal(next.grid.small,true);assert.equal(next.grid.followWorkplane,false);assert.equal(next.grid.planes.xz,true);assert.equal(next.grid.planes.xy,false);assert.equal(next.graphics.antialias,false);
  const explicit=normalizePreferences({...next,graphics:{...next.graphics,antialias:true}});assert.equal(explicit.graphics.antialias,true);
  assert.deepEqual(importConfiguration(exportConfiguration(next)),next);
});
