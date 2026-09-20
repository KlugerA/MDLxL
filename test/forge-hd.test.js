import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMDL } from 'war3-model';
import { buildForgeMesh, commitForge, forgeTangents } from '../src/forge.js';
import { createDemoDocument, createNode, openDocument, validateModel } from '../src/editor-document.js';

const mesh = () => buildForgeMesh({ width: 4, height: 4, mask: new Uint8Array([1,1,1,1,1,0,0,1,1,0,0,1,1,1,1,1]), detail: 15, thickness: 2, trim: true });
const identity = () => new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]);
function fixture(version, weighted, bindPose) {
  const model = structuredClone(createDemoDocument().model); model.Version = version;
  if (bindPose) { const bone = createNode(model, 'Bone'); bone.Name = 'DummyBone'; model.BindPoses = [{ Matrices: Array.from({ length: model.Nodes.length }, identity) }]; }
  for (const g of model.Geosets) {
    g.LevelOfDetail = 0;
    if (weighted) { g.Tangents = forgeTangents(g); g.SkinWeights = new Uint8Array(g.Vertices.length / 3 * 8); for (let i = 0; i < g.Vertices.length / 3; i++) g.SkinWeights.set([g.Groups[g.VertexGroup[i]][0],0,0,0,255,0,0,0],i*8); }
  }
  return openDocument(generateMDL(model));
}
test('Forge retains LOD0 and valid matrix binding through 900/1000/1100 MDL and MDX round trips', () => {
  for (const version of [900,1000,1100]) for (const bindPose of [false,true]) {
    const doc = fixture(version,false,bindPose), poses = structuredClone(doc.model.BindPoses), result = doc.apply('Forge format',[],m=>commitForge(m,mesh(),{texturePath:'MDLxL_Forge\\piece.tga'}));
    for (const format of ['mdl','mdx']) {
      const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.readOnly,false); assert.deepEqual(validateModel(reopened.model).filter(d=>d.severity==='error'),[]);
      assert.deepEqual(reopened.model.BindPoses,poses); assert.equal(reopened.model.Bones.filter(n=>n.Name==='DummyBone').length,1);
      for (const gi of result.geosetIndices) { assert.equal(reopened.model.Geosets[gi].LevelOfDetail,0); assert.deepEqual(reopened.model.Geosets[gi].Groups,[[result.boneId]]); }
    }
  }
});
test('weighted destinations receive complete rigid skin streams and version-correct HD material slots', () => {
  for (const version of [900,1000,1100]) {
    const doc = fixture(version,true,true), before = doc.serialize(), poses = structuredClone(doc.model.BindPoses), result = doc.apply('Forge HD',[],m=>commitForge(m,mesh(),{texturePath:'MDLxL_Forge\\piece.tga'}));
    assert.equal(result.extraAssets.length,3); assert.ok(result.extraAssets.every(a=>a.source==='forge'&&a.bytes.length===22));
    assert.deepEqual([...result.extraAssets.find(a=>a.name.includes('flat-normal')).bytes.slice(18)],[0,127,127,255],'TGA BGRA encodes the inverted Reforged flat normal');
    assert.deepEqual([...result.extraAssets.find(a=>a.name.includes('neutral-orm')).bytes.slice(18)],[0,255,255,0],'neutral ORM retains roughness and occlusion while disabling metallic and team color');
    for (const format of ['mdl','mdx']) {
      const reopened = openDocument(doc.serialize(format)); assert.equal(reopened.readOnly,false); assert.deepEqual(validateModel(reopened.model).filter(d=>d.severity==='error'),[]); assert.deepEqual(reopened.model.BindPoses,poses);
      for (const gi of result.geosetIndices) {
        const g = reopened.model.Geosets[gi], material = reopened.model.Materials[g.MaterialID];
        assert.equal(g.LevelOfDetail,0); assert.equal(g.SkinWeights.length,g.Vertices.length/3*8); assert.equal(g.Tangents.length,g.Vertices.length/3*4);
        for (let i=0;i<g.Vertices.length/3;i++) { assert.deepEqual([...g.SkinWeights.slice(i*8,i*8+8)],[result.boneId,0,0,0,255,0,0,0]); const n=g.Normals.slice(i*3,i*3+3), t=g.Tangents.slice(i*4,i*4+3); assert.ok(Math.abs(Math.hypot(...t)-1)<1e-5); assert.ok(Math.abs(n.reduce((s,v,k)=>s+v*t[k],0))<1e-5); assert.ok(Math.abs(g.Tangents[i*4+3])===1); }
        const normalId = version===1100?material.Layers[0].NormalTextureID:material.Layers[1].TextureID, ormId = version===1100?material.Layers[0].ORMTextureID:material.Layers[2].TextureID;
        assert.match(reopened.model.Textures[normalId].Image,/flat-normal/); assert.match(reopened.model.Textures[ormId].Image,/neutral-orm/);
        if(version===1100)assert.equal(material.Layers[0].ShaderTypeId,1);else assert.equal(material.Shader,'Shader_HD_DefaultUnit');
      }
    }
    doc.undo();assert.deepEqual(doc.serialize(),before);
  }
});
test('tangent handedness follows the full original-image UV orientation on both planar caps', () => {
  const g = mesh().geosets[0], tangents = forgeTangents(g);
  for(let i=0;i<g.Vertices.length/3;i++){
    const n=g.Normals.slice(i*3,i*3+3);if(Math.abs(n[2])<.99)continue;
    const t=tangents.slice(i*4,i*4+3), w=tangents[i*4+3], bitangent=[n[1]*t[2]-n[2]*t[1],n[2]*t[0]-n[0]*t[2],n[0]*t[1]-n[1]*t[0]].map(v=>v*w);
    assert.ok(t[0]>.99,'U increases along +X');assert.ok(bitangent[1]<-.99,'V increases down the original image, along -Y');
  }
});
test('HD anchor IDs beyond byte capacity and new bind-pose nodes fail without partial document edits', () => {
  const doc=fixture(1100,true,true);doc.apply('Give anchor a high object ID',[],m=>{const bone=m.Bones.find(b=>b.Name==='DummyBone');bone.ObjectId=256;m.PivotPoints[256]=bone.PivotPoint;});const before=doc.serialize();
  assert.throws(()=>doc.apply('Forge HD',[],m=>commitForge(m,mesh(),{texturePath:'piece.tga'})),/0 to 255/);assert.deepEqual(doc.serialize(),before);
  const missing=fixture(1100,true,true);missing.apply('Rename anchor',[],m=>{m.Bones.find(b=>b.Name==='DummyBone').Name='Existing';});const original=missing.serialize();
  assert.throws(()=>missing.apply('Forge HD',[],m=>commitForge(m,mesh(),{texturePath:'piece.tga'})),/bind-pose/);assert.deepEqual(missing.serialize(),original);
});
