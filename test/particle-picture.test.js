import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarterRecipe,STARTER_TEXTURE} from '../src/particle-starters.js';
import {particleRecipeDocument} from '../src/particle-recipes.js';
import {removeParticlePicture,particlePictureShared} from '../src/particle-picture.js';

test('removing added team pictures restores the ordinary picture and is one undo',()=>{
 const recipe=createStarterRecipe();recipe.native.Textures.push({Image:'',ReplaceableId:1,Flags:0},{Image:'',ReplaceableId:2,Flags:0});recipe.native.ParticleEmitters2[0].TextureID=2;recipe.native.ParticleEmitters2[0].ReplaceableId=2;
 const doc=particleRecipeDocument(recipe),m=doc.model,e=m.ParticleEmitters2[0];
 const before=structuredClone(m);
 doc.apply('Remove picture',['Nodes','Materials','Textures'],model=>removeParticlePicture(model,e.ObjectId,2));
 assert.equal(m.Textures.length,2);assert.equal(m.ParticleEmitters2[0].TextureID,0);assert.equal(m.ParticleEmitters2[0].ReplaceableId,0);
 doc.undo();assert.deepEqual(doc.model,before);doc.redo();
 removeParticlePicture(doc.model,e.ObjectId,1);assert.equal(doc.model.Textures.length,1);assert.equal(doc.model.Textures[0].Image,STARTER_TEXTURE);
});

test('shared pictures cannot be removed; later static and animated references retain their images',()=>{
 const m=createStarterRecipe().native,e=m.ParticleEmitters2[0];
 m.Textures.push({Image:'',ReplaceableId:2,Flags:0},{Image:'later.blp',ReplaceableId:0,Flags:0});
 const animated={LineType:2,Keys:[{Frame:0,Vector:new Uint32Array([2]),InTan:new Uint32Array([2]),OutTan:new Uint32Array([2])}]};
 m.Materials.push({Layers:[{TextureID:animated,NormalTextureID:2,_MdxDefaults:{TextureID:2}}]});
 assert.equal(particlePictureShared(m,e,2),true);const before=structuredClone(m);
 assert.throws(()=>removeParticlePicture(m,e.ObjectId,2),/another emitter or material/);assert.deepEqual(m,before);
 removeParticlePicture(m,e.ObjectId,1);
 for(const property of ['Vector','InTan','OutTan'])assert.equal(animated.Keys[0][property][0],1);
 assert.equal(m.Materials.at(-1).Layers[0].NormalTextureID,1);assert.equal(m.Materials.at(-1).Layers[0]._MdxDefaults.TextureID,1);assert.equal(m.Textures[1].Image,'later.blp');
});

test('removing the only team picture gives the particle an ordinary soft picture',()=>{
 const m=createStarterRecipe().native,e=m.ParticleEmitters2[0];m.Textures=[{Image:'',ReplaceableId:1,Flags:0}];e.TextureID=0;e.ReplaceableId=1;
 removeParticlePicture(m,e.ObjectId,0);assert.equal(m.Textures.length,1);assert.equal(m.Textures[0].Image,STARTER_TEXTURE);assert.equal(e.TextureID,0);assert.equal(e.ReplaceableId,0);
});
