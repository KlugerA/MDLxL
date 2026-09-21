import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDemoDocument } from '../src/editor-document.js';

// Execute the real JSX component, not a regex over source. This catches
// undefined render-time variables even when the production bundler succeeds.
async function component(file) {
  const result=await build({entryPoints:[new URL('../app/'+file,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
  const module={exports:{}};
  new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  return module.exports.default;
}
const Movement=await component('MovementControllerRecomp.jsx');
const Animation=await component('AnimationController.jsx');
const Setup=await component('PortraitSetup.jsx');
const Toolbar=await component('PortraitToolbar.jsx');
const QuickDisplay=await component('QuickDisplay.jsx');
const Timeline=await component('KeyframeTimeline.jsx');
function fixture() {
  const model=createDemoDocument().model;
  model.Sequences=[{Name:'Stand',Interval:[0,1000]},{Name:'Portrait Talk',Interval:[2000,3000]},{Name:'Portrait',Interval:[4000,5000]}];
  model.GlobalSequences=[700];
  model.Cameras=[{Name:'Camera 01'}];
  return model;
}
test('actual Movement component renders normal and Portrait mode without exceptions',()=>{
  const model=fixture(),selectedNodeIds=[model.Bones[0].ObjectId];
  for(const portraitMode of [undefined,false,true]) {
    const html=renderToStaticMarkup(React.createElement(Movement,{model,portraitMode,sequenceIndex:portraitMode?1:0,selectedNodeIds,time:portraitMode?2000:0}));
    assert.match(html,/Movement controller/);
    const options=html.match(/aria-label="Movement current sequence"[\s\S]*?<\/select>/)[0];
    if(portraitMode){assert.doesNotMatch(options,/Stand|All line|Global 1/);assert.match(options,/Portrait Talk/);assert.match(options,/>Portrait</);}
    else {assert.match(options,/Stand/);assert.match(options,/All line/);assert.match(options,/Global 1/);}
    assert.match(html,/aria-label="Move"/);assert.match(html,/aria-label="Rotate"/);assert.match(html,/aria-label="Scale"/);
    assert.doesNotMatch(html,/Portrait Camera|Set Current View|>Create<\/button>/);
  }
});
test('Animations remains editable with no selected vertices or checked geosets',()=>{
  const html=renderToStaticMarkup(React.createElement(Animation,{model:fixture(),sequenceIndex:0,time:0,selectedGeosets:[]}));
  assert.match(html,/Bake Sequence RGB/);assert.match(html,/Bake All RGB/);
  assert.doesNotMatch(html,/<input[^>]*aria-label="Animation R"[^>]*disabled/);
  assert.doesNotMatch(html,/<button[^>]*disabled[^>]*>Bake All RGB<\/button>/);
});
test('Animations exposes inline RGB fields on All line',()=>{
  const html=renderToStaticMarkup(React.createElement(Animation,{model:fixture(),sequenceIndex:-1,time:0,selectedGeosets:[0]}));
  assert.doesNotMatch(html,/<input[^>]*aria-label="Animation R"[^>]*disabled/);
  assert.match(html,/aria-label="Animation R"[^>]*value="179"/);
});
test('actual setup dialog renders every missing-requirement combination',()=>{
  for(const [missingSequence,missingCamera]of [[true,false],[false,true],[true,true]]) {
    const html=renderToStaticMarkup(React.createElement(Setup,{model:fixture(),missingSequence,missingCamera,sourceIndex:0}));
    assert.equal(html.includes('Create Sequence and Enter Portrait'),missingSequence);assert.match(html,/>Cancel</);
    assert.equal(html.includes('Portrait length (ms)'),missingSequence);
    assert.equal(html.includes('Portrait visibility/RGB source'),missingSequence);
    assert.equal(html.includes('Set Current View creates Camera 01'),missingCamera);
    assert.equal(html.includes('>Set Current View</button>'),missingCamera);
    if (missingCamera && missingSequence) assert.match(html,/<button disabled="">Create Sequence and Enter Portrait/);
  }
});

test('camera toolbar renders inside Movement with one create-or-update action and Portrait-only snap',()=>{
  for (const active of [false,true]) for (const hasCamera of [false,true]) {
    const model=fixture(); if(!hasCamera) model.Cameras=[];
    const html=renderToStaticMarkup(React.createElement(Toolbar,{model,active,cameraIndex:0}));
    assert.match(html,active?/Full Model View/:/Portrait Frame View/);
    assert.equal(html.includes('Snap to Camera'),active);
    assert.doesNotMatch(html,/>Create<\/button>/);
    assert.match(html,/<button[^>]*>Set Current View<\/button>/);
    assert.doesNotMatch(html,/<button disabled[^>]*>Set Current View/);
    assert.match(html,hasCamera?/Camera 01/:/No camera/);
  }
  const html=renderToStaticMarkup(React.createElement(Toolbar,{model:fixture(),active:true,cameraIndex:0,disabled:true}));
  assert.match(html,/<button disabled[^>]*>Set Current View/);
});

test('quick display separates emitter markers from emitted particles',()=>{
  const html=renderToStaticMarkup(React.createElement(QuickDisplay,{overlays:{particles:true},shadows:false,particles:false}));
  assert.equal((html.match(/type="checkbox"/g)||[]).length,7);
  for(const label of ['Shadows','Vertices','Wireframe','Nodes','Emitters','Particles','Bones','Clear all']) assert.ok(html.includes(label));
  assert.match(html,/<input[^>]*data-warmkey="display:particles"[^>]*checked=""/);
  assert.doesNotMatch(html,/<input[^>]*data-warmkey="showParticles"[^>]*checked=""/);
});

test('timeline displays the live frame without an effect-driven duplicate frame state',()=>{
  const html=renderToStaticMarkup(React.createElement(Timeline,{model:fixture(),sequenceIndex:0,time:375,playing:true}));
  assert.match(html,/<input[^>]*aria-label="Current animation frame"[^>]*value="375"/);
});
