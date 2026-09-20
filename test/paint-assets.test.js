import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PAINT_ASSETS, PAINT_ASSET_MANIFEST, selectedPaintMaterialRaster } from '../src/paint-assets.js';
import { PAINT_BRUSH_TIPS } from '../src/paint-brushes.js';

const root=path.resolve('.'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('starter collection has the fixed 50-item Warcraft SD taxonomy and complete physical variants',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'public/paint-assets/manifest.json'),'utf8'));
  assert.equal(PAINT_ASSETS.length,50);assert.equal(manifest.logicalAssetCount,50);assert.equal(manifest.materialCount,40);assert.equal(manifest.stampCount,10);
  const counts=Object.fromEntries(Object.entries(Object.groupBy(manifest.assets,item=>item.category)).map(([key,items])=>[key,items.length]));
  assert.deepEqual(counts,{skin:14,'hair-fur':8,metal:10,'leather-cloth':6,'bone-wood':2,stamp:10});
  for(const asset of manifest.assets){
    assert.ok(asset.thumbnail);assert.ok(asset.tags.length);assert.ok(asset.provenance?.license);assert.equal(asset.order>0,true);
    const expected=[...Object.values(asset.files),...Object.values(asset.valueFiles||{})];assert.equal(expected.length,asset.kind==='material'?4:2);
    for(const relative of expected){const file=path.join(root,'public',relative.replace(/^\.\//,'')),bytes=await fs.readFile(file);assert.ok(bytes.length>100,relative);assert.equal(sha(bytes),asset.sha256[relative]);}
  }
  const cc0=manifest.assets.filter(asset=>asset.provenance.kind==='cc0-derived'),original=manifest.assets.filter(asset=>asset.provenance.kind==='generated-original');
  assert.equal(cc0.length,8);assert.equal(original.length,42);assert.ok(cc0.every(asset=>asset.provenance.license==='CC0 1.0'&&/^https:\/\//.test(asset.provenance.sourceUrl)));
  assert.ok(original.every(asset=>asset.provenance.generation?.provider==='OpenAI ImageGen'));
  assert.ok(!JSON.stringify(manifest.assets.map(asset=>[asset.id,asset.name,asset.files])).match(/makehuman|neferess/i));
});

test('collection names cover complete Grunt, Footman, Ghoul, High Elf, and Night Elf paint jobs',()=>{
  const names=PAINT_ASSETS.map(asset=>`${asset.id} ${asset.name} ${asset.tags.join(' ')}`).join(' ').toLowerCase();
  for(const need of ['orc','human','undead','high elf','night elf','eye','teeth','hair','fur','cloth','leather','steel','iron','wood','bone','markings','grime','blood'])assert.ok(names.includes(need),need);
  assert.equal(PAINT_ASSET_MANIFEST.style,'Classic Warcraft III SD hand-painted miniature materials');
  assert.ok(PAINT_ASSETS.filter(asset=>asset.category==='metal').every(asset=>!asset.tags.includes('metalness')));
});

test('manual colors stop using a previously selected shelf material raster',()=>{
  const raster={width:1,height:1,data:new Uint8ClampedArray([1,2,3,255])};
  assert.equal(selectedPaintMaterialRaster({materialId:'human_blue_steel'},'human_blue_steel',raster),raster);
  assert.equal(selectedPaintMaterialRaster({materialId:null},'human_blue_steel',raster),null);
  assert.equal(selectedPaintMaterialRaster({materialId:'orc_green'},'human_blue_steel',raster),null);
});

test('beginner brush shelf is eight traceable CC0 GIH/GBR conversions rather than the raw collection',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'public/paint-brushes/manifest.json'),'utf8'));
  assert.equal(PAINT_BRUSH_TIPS.length,8);assert.equal(manifest.tips.length,8);assert.ok(/GIH\/GBR/.test(manifest.conversion));
  for(const tip of manifest.tips){const bytes=await fs.readFile(path.join(root,'public/paint-brushes',tip.file));assert.equal(sha(bytes),tip.outputSha256);assert.ok(tip.sourceFile.endsWith('.gih'));assert.equal(tip.provenance.license,'CC0 1.0');assert.match(tip.provenance.sourceUrl,/^https:\/\//);}
});
