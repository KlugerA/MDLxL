import test from 'node:test';
import assert from 'node:assert/strict';
import { createNode, openDocument, validateModel } from '../src/editor-document.js';
import { generateMDL } from 'war3-model';
import { emptyParticleModel, extractParticleRecipe, particleRecipeDocument, placeParticleRecipe } from '../src/particle-recipes.js';
import { stringifyParticleData, parseParticleData, safeParticlePath } from '../src/particle-data.js';
import { createParticleGesture, beginParticleParameter } from '../src/particle-bindings.js';
const v = (...n) => new Float32Array(n);
function fixture() {
  const model=emptyParticleModel();
  model.Sequences=[{Name:'Stand',Interval:new Uint32Array([100,2100]),NonLooping:false,MoveSpeed:0,Rarity:0,MinimumExtent:v(-20,-20,-20),MaximumExtent:v(20,20,20),BoundsRadius:40}];
  model.GlobalSequences=[1000,3000];
  model.Textures=[{Image:'unused.blp',ReplaceableId:0,Flags:0},{Image:'Textures\\Spark.blp',ReplaceableId:0,Flags:3}];
  const bone=createNode(model,'Bone');bone.Scaling={LineType:1,GlobalSeqId:null,Keys:[{Frame:100,Vector:v(2,3,1)}]};
  const p=createNode(model,'ParticleEmitter2');p.Parent=bone.ObjectId;p.TextureID=1;
  p.EmissionRate={LineType:3,GlobalSeqId:1,Keys:[{Frame:100,Vector:v(11),InTan:v(10),OutTan:v(12)},{Frame:500,Vector:v(40),InTan:v(39),OutTan:v(41)}]};
  p._MdxDefaults={EmissionRate:17};
  p.ParticleScaling=v(0,9,2);p.Time=1;p.Latitude=175;
  p.LifeSpanUVAnim=new Uint32Array([3,6,2]);p.DecayUVAnim=new Uint32Array([7,9,4]);p.TailUVAnim=new Uint32Array([2,4,3]);p.TailDecayUVAnim=new Uint32Array([5,8,5]);p.Rows=4;p.Columns=4;
  const unused=createNode(model,'Bone');unused.Name='Unrelated';
  return {model,p};
}
test('recipe copies only effect ancestry and referenced textures, preserving tracks, arrays and source',()=>{
  const {model,p}=fixture(), before=stringifyParticleData(model),recipe=extractParticleRecipe(model,[p.ObjectId]);
  assert.equal(recipe.native.Bones.length,0);assert.equal(recipe.native.Helpers.length,1);assert.equal(recipe.native.Textures.length,1);
  const copy=recipe.native.ParticleEmitters2[0];
  assert.deepEqual(copy._MdxDefaults,p._MdxDefaults);assert.deepEqual(copy.ParticleScaling,p.ParticleScaling);
  assert.deepEqual(copy.TailDecayUVAnim,p.TailDecayUVAnim);assert.equal(copy.EmissionRate.GlobalSeqId,0);
  assert.deepEqual(recipe.native.GlobalSequences,[3000]);assert.equal(stringifyParticleData(model),before);
});
test('portable recipe roundtrip and Lab preserve float typed data and MDX defaults',()=>{
  const {model,p}=fixture(), recipe=extractParticleRecipe(model,[p.ObjectId]);
  const restored=parseParticleData(stringifyParticleData(recipe));
  assert.deepEqual(restored,recipe);const doc=particleRecipeDocument(restored);
  assert.deepEqual(doc.model.ParticleEmitters2[0]._MdxDefaults,p._MdxDefaults);
  const encoded=doc.serialize('mdx'),reopened=openDocument(encoded,'effect.mdx');
  assert.equal(reopened.readOnly,false);
  for(const field of ['ParticleScaling','LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim','EmissionRate'])assert.deepEqual(reopened.model.ParticleEmitters2[0][field],doc.model.ParticleEmitters2[0][field]);
});
test('placement remaps sparse target resources and undo restores exact target model',()=>{
  const {model,p}=fixture(), recipe=extractParticleRecipe(model,[p.ObjectId]);
  const target=openDocument(generateMDL(model),'target.mdl'),before=stringifyParticleData(target.model);
  let result;target.apply('Place effect',['Nodes','Textures'],m=>{result=placeParticleRecipe(m,recipe,{parent:0,position:[3,4,5]});});
  const emitter=target.model.Nodes[result.ids[0]];
  assert.notEqual(emitter.ObjectId,p.ObjectId);assert.notEqual(emitter.TextureID,p.TextureID);
  assert.equal(emitter.EmissionRate.GlobalSeqId,2);
  assert.equal(target.model.Nodes[result.anchorId].Parent,0);
  assert.equal(validateModel(target.model).filter(d=>d.severity==='error').length,0);
  target.undo();assert.equal(stringifyParticleData(target.model),before);
});
test('gesture is continuous in private preview, commits once and cancels without document mutations',()=>{
  const {model,p}=fixture(),doc=openDocument(generateMDL(model),'gesture.mdl'),before=stringifyParticleData(doc.model);
  const gesture=createParticleGesture({doc,id:p.ObjectId,field:'ParticleScaling'});
  for(const value of [10,12,18])gesture.update(value);
  assert.equal(stringifyParticleData(doc.model),before);assert.equal(doc.canUndo,false);
  gesture.finish();assert.deepEqual(doc.model.Nodes[p.ObjectId].ParticleScaling,v(0,18,4));
  assert.equal(doc.historyStats.undoSteps,1);doc.undo();assert.equal(stringifyParticleData(doc.model),before);
  const cancelled=createParticleGesture({doc,id:p.ObjectId,field:'Latitude'});cancelled.update(80);cancelled.cancel();
  assert.equal(stringifyParticleData(doc.model),before);
});
test('animated key time is latched; whole-track offset preserves Bezier controls and globals',()=>{
  const {model,p}=fixture();
  const gesture=beginParticleParameter(p,'EmissionRate',{frame:450,globalSequences:model.GlobalSequences});
  assert.equal(gesture.keyTime,500);
  const next=gesture.change(99);assert.equal(next.Keys.length,2);assert.equal(next.Keys[1].Vector[0],99);assert.deepEqual(next.Keys[0],p.EmissionRate.Keys[0]);assert.deepEqual(next.Keys[1].InTan,p.EmissionRate.Keys[1].InTan);
  const whole=beginParticleParameter(p,'EmissionRate',{frame:100,scope:'track',globalSequences:model.GlobalSequences}),offset=whole.change(21);
  assert.equal(offset.Keys[0].Vector[0],21);assert.equal(offset.Keys[0].InTan[0],20);assert.equal(offset.GlobalSeqId,1);
  assert.equal(p.EmissionRate.Keys[0].Vector[0],11);
});
test('Hermite offset keeps derivative tangents, and zero-size samples stay selectable without NaN',()=>{
  const {p}=fixture();p.EmissionRate.LineType=2;
  const gesture=beginParticleParameter(p,'EmissionRate',{scope:'track',frame:100});
  const next=gesture.change(gesture.sampled+3);assert.deepEqual(next.Keys[0].InTan,p.EmissionRate.Keys[0].InTan);
  p.ParticleScaling=v(0,0,0);const size=beginParticleParameter(p,'ParticleScaling',{stage:2});
  assert.deepEqual(p.ParticleScaling,v(0,0,0));assert.deepEqual(size.change(5),v(0,0,5));
});
test('malformed portable data rejects traversal, constructors, invalid arrays and nonfinite values',()=>{
  assert.throws(()=>parseParticleData('{"__proto__":{"polluted":true}}'));
  assert.throws(()=>parseParticleData('{"$array":"Function","values":[]}'));
  assert.throws(()=>parseParticleData('{"$array":"Uint8Array","values":[300]}'));
  assert.throws(()=>parseParticleData('{"x":1e400}'));
  assert.equal(safeParticlePath('../bad.blp'),false);assert.equal(safeParticlePath('C:\\bad.blp'),false);
  assert.equal(safeParticlePath('war3.w3mod:Textures\\Spark.blp'),true);
});
test('mode state and metadata do not modify canonical data',()=>{
  const {model,p}=fixture(),recipe=extractParticleRecipe(model,[p.ObjectId]),before=stringifyParticleData(recipe.native);
  recipe.ui={mode:'Classic'};recipe.ui.mode='Clueless';recipe.name='Blue sparks';recipe.tags=['blue'];
  assert.equal(stringifyParticleData(recipe.native),before);
});
