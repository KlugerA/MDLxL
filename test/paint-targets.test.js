import test from 'node:test';
import assert from 'node:assert/strict';
import { enumeratePaintTargets, installFreshPaintLayer, paintTargetsForGeoset, preferredPaintTarget } from '../src/paint-targets.js';
import { paintFixtureModel, squareSeamGeoset, triangleGeoset } from './fixtures/paint-fixtures.js';

test('paint targets select image layers, skip replaceables, and retain ambiguous layer bindings',()=>{
  const model=paintFixtureModel([triangleGeoset(),triangleGeoset({materialId:1})]);
  model.Textures.push({Image:'ReplaceableTextures\\TeamColor\\TeamColor00.blp',ReplaceableId:1,Flags:0},{Image:'Textures\\Detail.blp',ReplaceableId:0,Flags:3},{Image:'Textures\\Hidden.blp',ReplaceableId:0,Flags:0});
  model.Materials.push({Layers:[{FilterMode:0,Shading:16,TextureID:1,CoordId:0},{FilterMode:0,Shading:16,TextureID:3,CoordId:0,Alpha:0},{FilterMode:2,Shading:16,TextureID:2,CoordId:0}]});
  const targets=enumeratePaintTargets(model);
  assert.deepEqual(targets.map(target=>target.textureId),[0,2]);
  assert.equal(targets[1].flags,3);
  assert.deepEqual(targets[1].bindings,[{geosetIndex:1,materialId:1,layerIndex:2,coordId:0}]);
  assert.equal(preferredPaintTarget(targets,1)?.textureId,2);
  assert.deepEqual(paintTargetsForGeoset(targets,0).map(target=>target.textureId),[0]);
});

test('shared and mirrored UV use one target and fresh primer never replaces team colour',()=>{
  const model=paintFixtureModel([squareSeamGeoset(),triangleGeoset()]);
  model.Geosets[1].MaterialID=0;
  let targets=enumeratePaintTargets(model);
  assert.equal(targets.length,1);
  assert.equal(targets[0].sharedUV,true);
  model.Textures=[{Image:'',ReplaceableId:1,Flags:0}];
  model.Materials=[{Layers:[{TextureID:0,FilterMode:0,Shading:16,CoordId:0}]}];
  const installed=installFreshPaintLayer(model,0,'MDLxL_Forge\\fixture_paint_1.blp');
  assert.equal(model.Materials[0].Layers[0].TextureID,0);
  assert.equal(model.Textures[0].ReplaceableId,1);
  assert.equal(model.Materials[0].Layers[installed.layerIndex].TextureID,installed.textureId);
  targets=enumeratePaintTargets(model);
  assert.equal(targets[0].texturePath,'MDLxL_Forge\\fixture_paint_1.blp');
});
