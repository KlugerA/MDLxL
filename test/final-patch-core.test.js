import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { TEAM_COLORS } from '../src/team-colors.js';
import { animationMarkerTimes } from '../src/animation-markers.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { normalizePreferences, chordFromEvent } from '../src/preferences.js';
import { wheelOptionIndex } from '../src/dropdown-wheel.js';

test('New starter is exact in both versions and survives MDL/MDX save/reopen', () => {
  for(const version of [800,1000]) {
    const doc=createStarterDocument(version);
    assert.equal(doc.dirty,true);
    for(const format of ['mdl','mdx']) {
      const reopened=openDocument(doc.serialize(format),`cube.${format}`), m=reopened.model;
      assert.equal(reopened.readOnly,false); assert.equal(m.Version,version);
      assert.equal(m.Bones.length,1); assert.equal(m.Bones[0].Name,'Bone_Root');
      assert.equal(m.Geosets.length,1); assert.equal(m.Geosets[0].Vertices.length,24); assert.equal(m.Geosets[0].Faces.length,36);
      assert.equal(m.Textures[0].Image,'Textures/White.blp');
      assert.deepEqual(m.Geosets[0].Groups,[[m.Bones[0].ObjectId]]);
      const layer=m.Materials[0].Layers[0]; assert.equal(layer.Shading,0); assert.equal(layer.FilterMode,0); assert.equal(layer.TVertexAnimId,null); assert.equal(layer.Alpha ?? 1,1);
      assert.equal(reopened.diagnostics.filter(d=>d.severity==='error').length,0);
    }
  }
});
test('source palette has 25 unique names and exact index/code/RGB correspondence', () => {
  assert.equal(TEAM_COLORS.length,25); assert.equal(new Set(TEAM_COLORS.map(c=>c.name)).size,25);
  TEAM_COLORS.forEach((c,i)=> { if(i<24)assert.equal(c.index,i); assert.equal(c.rgbHex,'#'+c.sourceCode.slice(4)); assert.deepEqual(c.rgb,[1,3,5].map(at=>parseInt(c.rgbHex.slice(at,at+2),16))); });
  assert.equal(TEAM_COLORS.at(-1).sourceKey,'Neutral Hostile'); assert.equal(TEAM_COLORS[14].name,'Aqua');
});
test('animation markers include unselected translation/rotation/geoset/particle data and isolate global clock', () => {
  const m=createStarterDocument().model, track=(frame,globalSeqId)=>({LineType:1,GlobalSeqId:globalSeqId,Keys:[{Frame:frame,Vector:new Float32Array([1])}]});
  m.Bones[0].Translation=track(10); m.Bones[0].Rotation=track(20);
  m.GeosetAnims=[{GeosetId:0,Flags:2,Alpha:track(30)}];
  const emitter=createNode(m,'ParticleEmitter2'); emitter.EmissionRate=track(40); emitter.Visibility=track(50,0); m.GlobalSequences=[100];
  assert.deepEqual(animationMarkerTimes(m,{start:0,end:45,globalSeqId:null}),[10,20,30,40]);
  assert.deepEqual(animationMarkerTimes(m,{start:0,end:100,globalSeqId:0}),[50]);
});
test('portable settings validate atomically and preserve warm accents and hotkeys',()=>{
  const prefs=normalizePreferences({theme:'warm-dark',accent:'#ee9933',panelScale:1.5,hotkeys:{foo:['Ctrl+J']}});
  assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(prefs))),prefs);
  assert.throws(()=>importConfiguration({...exportConfiguration(prefs),version:2}));
  assert.throws(()=>importConfiguration({schema:'mdlxl-configuration',version:1,preferences:{panelScale:999}}));
  assert.throws(()=>importConfiguration({schema:'mdlxl-configuration',version:1,preferences:{hotkeys:{a:['F'],b:['F']}}}));
});
test('EN/RU physical-key shortcuts use the same label without handling IME/AltGraph',()=>{
  assert.equal(chordFromEvent({key:'А',code:'KeyF'}),'F'); assert.equal(chordFromEvent({key:'f',code:'KeyF'}),'F');
  assert.equal(chordFromEvent({key:'А',code:'KeyF',isComposing:true}),'');
  assert.equal(chordFromEvent({key:'А',code:'KeyF',getModifierState:()=>true}),'');
});
test('dropdown wheel stops at boundaries and skips disabled choices',()=>{
  const options=[{},{disabled:true},{}]; assert.equal(wheelOptionIndex(options,0,1),2); assert.equal(wheelOptionIndex(options,2,1),2); assert.equal(wheelOptionIndex(options,2,-1),0);
});
