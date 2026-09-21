import test from 'node:test';
import assert from 'node:assert/strict';
import {createFreshPaintAtlas} from '../src/paint-uv-atlas.js';
import {createPaintProject} from '../src/paint-project.js';
import {createPaintRaster} from '../src/paint-raster.js';
import {createPaintMaterial,repairPaintMaterials,validatePaintAssignments} from '../src/paint-materials.js';
import {paintProjectModel} from '../src/paint-view.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {paintFixtureModel,triangleGeoset} from './fixtures/paint-fixtures.js';

function bounds(uv){const u=[],v=[];for(let i=0;i<uv.length;i+=2){u.push(uv[i]);v.push(uv[i+1]);}return [Math.min(...u),Math.min(...v),Math.max(...u),Math.max(...v)];}
function overlaps(a,b){return a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];}
const raster=()=>createPaintRaster(256,256,[124,126,119,255]);

test('fresh basecoat atlas replaces shared source coordinates with stable non-overlapping UVs',()=>{
  const source=paintFixtureModel([triangleGeoset(),triangleGeoset()]),before=structuredClone(source),result=createFreshPaintAtlas(source,[0,1],256);
  assert.deepEqual(source,before,'the source model remains untouched');
  assert.equal(result.coordIds[0],1);assert.equal(result.coordIds[1],1);assert.equal(result.chartCount,2);
  const first=result.model.Geosets[0].TVertices[1],second=result.model.Geosets[1].TVertices[1];
  assert.equal(overlaps(bounds(first),bounds(second)),false);
  for(const value of [...first,...second])assert.ok(value>0&&value<1);
});

test('fresh atlas duplicates complete vertex streams only where cube-projection charts need a seam',()=>{
  const geoset={
    Vertices:new Float32Array([0,0,0,1,0,0,0,1,0,0,0,1]),
    Normals:new Float32Array([0,0,1,0,0,1,0,0,1,0,1,0]),
    Faces:new Uint16Array([0,1,2,0,3,1]),
    TVertices:[new Float32Array([0,0,1,0,0,1,1,1])],
    VertexGroup:new Uint8Array([0,0,0,0]),Groups:[[0]],TotalGroupsCount:1,MaterialID:0,
  },model=paintFixtureModel([geoset]),result=createFreshPaintAtlas(model,[0],256),fresh=result.model.Geosets[0],count=fresh.Vertices.length/3;
  assert.equal(result.addedVertices,2);assert.equal(count,6);assert.equal(fresh.Normals.length,count*3);assert.equal(fresh.VertexGroup.length,count);assert.equal(fresh.TVertices[0].length,count*2);assert.equal(fresh.TVertices[1].length,count*2);
  assert.ok(Math.max(...fresh.Faces)<count);
});

test('standard extra materials use separate textures on separate geosets and share the safe atlas layout',()=>{
  const original=paintFixtureModel([triangleGeoset(),triangleGeoset()]),atlas=createFreshPaintAtlas(original,[0,1],256),project=createPaintProject({sourceMode:'primer'});
  project.generatedUVSets=atlas.coordIds;project.paintAtlasVersion=1;
  const armour=createPaintMaterial(project,atlas.model,{name:'Armour',raster:raster(),geosets:[0],basecoat:true,generatedUV:true,sourceModel:original});
  const gloves=createPaintMaterial(project,atlas.model,{name:'Gloves',raster:raster(),geosets:[1],basecoat:true,generatedUV:true,sourceModel:original});
  validatePaintAssignments(project,atlas.model);const painted=paintProjectModel(atlas.model,project,original);
  assert.notEqual(armour.textureId,gloves.textureId);assert.notEqual(painted.Geosets[0].MaterialID,painted.Geosets[1].MaterialID);assert.equal(armour.flags,0);assert.equal(gloves.flags,0);
  assert.deepEqual(painted.Geosets[0].TVertices[0],atlas.model.Geosets[0].TVertices[atlas.coordIds[0]]);
  assert.deepEqual(painted.Geosets[1].TVertices[0],atlas.model.Geosets[1].TVertices[atlas.coordIds[1]]);
  assert.deepEqual(painted.Geosets[0].TVertices[1],original.Geosets[0].TVertices[0]);
  assert.deepEqual(painted.Geosets[1].TVertices[1],original.Geosets[1].TVertices[0]);
  assert.equal(overlaps(bounds(painted.Geosets[0].TVertices[0]),bounds(painted.Geosets[1].TVertices[0])),false);
});

test('an existing texture continues to use its original UV channel after a fresh atlas is available',()=>{
  const original=paintFixtureModel([triangleGeoset({uv:[.1,.2,.7,.2,.1,.8]})]),atlas=createFreshPaintAtlas(original,[0],256),project=createPaintProject({sourceMode:'current'});
  project.generatedUVSets=atlas.coordIds;project.paintAtlasVersion=1;
  const target=createPaintMaterial(project,atlas.model,{name:'Existing',raster:raster(),geosets:[0],basecoat:false,generatedUV:false,sourceModel:original});
  assert.equal(target.bindings[0].sourceCoordId,0);
  assert.deepEqual(paintProjectModel(atlas.model,project,original).Geosets[0].TVertices[0],original.Geosets[0].TVertices[0]);
});

test('fresh basecoat removes authored RGB without changing visibility or existing-texture tint',()=>{
  const original=paintFixtureModel([triangleGeoset(),triangleGeoset()]);
  original.GeosetAnims=[
    {GeosetId:0,Flags:3,Alpha:{LineType:0,Keys:[{Frame:0,Vector:new Float32Array([.35])}]},Color:new Float32Array([1,.1,.1])},
    {GeosetId:1,Flags:2,Alpha:.8,Color:new Float32Array([.2,.4,.9])},
  ];
  const before=structuredClone(original),atlas=createFreshPaintAtlas(original,[0,1],256),project=createPaintProject({sourceMode:'primer'});
  project.generatedUVSets=atlas.coordIds;project.paintAtlasVersion=1;
  createPaintMaterial(project,atlas.model,{name:'Fresh',raster:raster(),geosets:[0],basecoat:true,generatedUV:true,sourceModel:original});
  createPaintMaterial(project,atlas.model,{name:'Existing',raster:raster(),geosets:[1],basecoat:false,generatedUV:false,sourceModel:original});
  const painted=paintProjectModel(atlas.model,project,original);
  assert.equal(painted.GeosetAnims[0].Flags,1);assert.equal(painted.GeosetAnims[0].Color,null);
  assert.deepEqual(painted.GeosetAnims[0].Alpha,original.GeosetAnims[0].Alpha);
  assert.deepEqual(painted.GeosetAnims[1],original.GeosetAnims[1]);
  assert.deepEqual(original,before,'the source model remains untouched');
});

test('fresh UV sets survive both Warcraft model save formats',()=>{
  for(const format of ['mdl','mdx']){
    const doc=createDemoDocument(),originalSets=doc.model.Geosets[0].TVertices.length,atlas=createFreshPaintAtlas(doc.model,[0],256);doc.model=atlas.model;doc.revision++;
    const reopened=openDocument(doc.serialize(format),`fresh-atlas.${format}`),geoset=reopened.model.Geosets[0],uv=geoset.TVertices[originalSets];
    assert.equal(geoset.TVertices.length,originalSets+1);assert.equal(uv.length,geoset.Vertices.length/3*2);for(const value of uv)assert.ok(value>=0&&value<=1);
  }
});

test('fresh basecoat repair keeps geosets that had no source UV channel',()=>{
  const original=paintFixtureModel([triangleGeoset()]);original.Geosets[0].TVertices=[];original.Textures[0].Flags=3;
  const atlas=createFreshPaintAtlas(original,[0],256),project=createPaintProject({sourceMode:'primer'});project.generatedUVSets=atlas.coordIds;project.paintAtlasVersion=1;
  createPaintMaterial(project,atlas.model,{name:'Material 1',raster:raster(),geosets:[0],basecoat:true,generatedUV:true,sourceModel:original});project.paintMaterialsVersion=undefined;
  assert.equal(repairPaintMaterials(project,original,atlas.model),true);assert.deepEqual(project.targets[0].geosetIndices,[0]);assert.equal(project.targets[0].flags,0);validatePaintAssignments(project,atlas.model);
});
