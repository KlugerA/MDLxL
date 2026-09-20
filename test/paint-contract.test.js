import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PAINT_MESSAGES } from '../src/paint-messages.js';
import { BRUSH_PRESETS, PAINT_COATS, PAINT_CONTRACTS } from '../src/paint-types.js';
import { COMMANDS } from '../src/commands.js';

test('all painter interface copy uses stable English paint message IDs',()=>{
  assert.ok(Object.keys(PAINT_MESSAGES).length>40);assert.ok(Object.keys(PAINT_MESSAGES).every(id=>id.startsWith('paint.')));
  for(const item of [...BRUSH_PRESETS,...PAINT_COATS])assert.equal(typeof PAINT_MESSAGES[item.messageId],'string',item.messageId);
  assert.ok(COMMANDS.some(command=>command.id==='paint'&&command.label==='Citadel Paint'));
});

test('versioned contracts include projects, targets, coats, strokes, presets, manifests, and viewport hits',()=>{
  assert.deepEqual(PAINT_CONTRACTS,{PaintProjectV1:1,PaintTextureTarget:1,PaintCoat:1,PaintStroke:1,BrushPresetV1:1,PaintAssetManifestV1:1,PaintHit:1});
});

test('Citadel Paint adds only its artifacts to the Movement host desktop boundary',async()=>{
  const [main,preload,packager,viewport,index]=await Promise.all(['electron/main.cjs','electron/preload.cjs','scripts/package.mjs','app/PaintViewport.jsx','index.html'].map(file=>fs.readFile(file,'utf8')));
  assert.match(main,/app\.setName\('MDLxL'\)/);assert.doesNotMatch(main,/Citadel Paint Preview/);assert.match(main,/new Set\(\['\.mdlxlpaint','\.zip'\]\)/);assert.match(main,/\.tmp/);assert.match(main,/fs\.rename\(temporary,destination\)/);
  assert.match(preload,/saveArtifact/);assert.match(packager,/electron\/paint-textures\.cjs/);assert.match(packager,/dist\/paint-assets\/manifest\.json/);
  assert.match(index,/script-src 'self' 'wasm-unsafe-eval'/);
  for(const field of ['geosetIndex','materialId','layerIndex','triangle','barycentric','uv','worldPosition','normal','depth','textureId','textureTarget'])assert.match(viewport,new RegExp(`${field}:`),field);
});
