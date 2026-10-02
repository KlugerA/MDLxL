import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PAINT_ASSETS, PAINT_ASSET_MANIFEST, selectedPaintMaterialRaster,cropNativePaintAsset } from '../src/paint-assets.js';
import {createPaintRaster} from '../src/paint-raster.js';
import { PAINT_BRUSH_TIPS } from '../src/paint-brushes.js';

const root=path.resolve('.'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('native collection contains traced local recipes and ships no retired stock pixels',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'public/paint-assets/manifest.json'),'utf8'));
  assert.deepEqual(manifest,PAINT_ASSET_MANIFEST);assert.equal(new Set(PAINT_ASSETS.map(a=>a.id)).size,PAINT_ASSETS.length);
  for(const asset of manifest.assets){
    assert.equal(asset.provenance.kind,'warcraft-native');assert.match(asset.sourcePath,/^war3\.w3mod:/);assert.match(asset.provenance.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(asset.files,undefined);
    const raster=createPaintRaster(asset.sourceWidth,asset.sourceHeight,[12,34,56,17]),cropped=cropNativePaintAsset(asset,raster);
    assert.deepEqual([cropped.width,cropped.height],asset.crop.slice(2));assert.deepEqual([...cropped.data.subarray(0,4)],[12,34,56,255]);assert.equal(raster.data[3],17);
    assert.throws(()=>cropNativePaintAsset(asset,createPaintRaster(1)),/different layout/);
  }
  const contents=await fs.readdir(path.join(root,'public/paint-assets'),{recursive:true});assert.equal(contents.filter(name=>/\.png$/i.test(name)).length,0);
});

test('cinematic Footman chainmail is the inspected native section',()=>{
  const asset=PAINT_ASSETS.find(a=>a.id==='wc3-chainmail');assert.match(asset.sourcePath,/humancampaign3d\\humancampaignfootman.dds$/);assert.deepEqual(asset.crop,[32,149,72,72]);
  assert.equal(PAINT_ASSET_MANIFEST.style,'Native Warcraft III sections');
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
