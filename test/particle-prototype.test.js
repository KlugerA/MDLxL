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
  assert.throws(()=>parseParticleData('{"$array":"Float32Array","values":[1e39]}'));
  assert.throws(()=>parseParticleData('['.repeat(10000)+'0'+']'.repeat(10000)),/nested too deeply/);
  assert.deepEqual(parseParticleData(JSON.stringify({text:'[\\\"{'.repeat(100)})),{text:'[\\\"{'.repeat(100)});
  assert.equal(safeParticlePath('../bad.blp'),false);assert.equal(safeParticlePath('C:\\bad.blp'),false);
  assert.equal(safeParticlePath('war3.w3mod:Textures\\Spark.blp'),true);
});
test('mode state and metadata do not modify canonical data',()=>{
  const {model,p}=fixture(),recipe=extractParticleRecipe(model,[p.ObjectId]),before=stringifyParticleData(recipe.native);
  recipe.ui={mode:'Classic'};recipe.ui.mode='Clueless';recipe.name='Blue sparks';recipe.tags=['blue'];
  assert.equal(stringifyParticleData(recipe.native),before);
});

test('source-version-independent PE2 placement keeps the target version and survives save/reopen',()=>{
  const {model,p}=fixture();model.Version=1800;
  const recipe=extractParticleRecipe(model,[p.ObjectId]);
  const target=particleRecipeDocument(extractParticleRecipe(fixture().model,[1]));
  target.model.Version=800;
  let result;target.apply('Place cross-version effect',['Nodes','Textures'],m=>{result=placeParticleRecipe(m,recipe);});
  assert.equal(target.model.Version,800);
  const reopened=openDocument(target.serialize('mdx'),'placed.mdx');
  assert.equal(reopened.model.Version,800);assert.equal(reopened.readOnly,false);
  const placed=reopened.model.Nodes[result.ids[0]];
  assert.deepEqual(placed.ParticleScaling,p.ParticleScaling);
  assert.deepEqual(placed.TailDecayUVAnim,p.TailDecayUVAnim);
  assert.deepEqual(placed.EmissionRate.Keys,p.EmissionRate.Keys);
});
test('saving a Lab draft marks its baseline without losing its independent undo history',()=>{
  const {model,p}=fixture(),doc=particleRecipeDocument(extractParticleRecipe(model,[p.ObjectId]));
  assert.equal(doc.dirty,false);
  const initial=stringifyParticleData(doc.model);
  const gesture=createParticleGesture({doc,id:doc.model.ParticleEmitters2[0].ObjectId,field:'ParticleScaling'});
  gesture.update(20);gesture.finish();
  const edited=stringifyParticleData(doc.model);
  doc.markSaved(doc.serialize('mdx'));
  assert.equal(doc.dirty,false);assert.equal(doc.canUndo,true);
  doc.undo();assert.equal(stringifyParticleData(doc.model),initial);
  doc.redo();assert.equal(stringifyParticleData(doc.model),edited);
});

test('life-stage gestures change only the chosen native array entry and retain zero stages',()=>{
  const {p}=fixture();p.Alpha=new Uint8Array([0,128,255]);p.SegmentColor=[v(.1,.2,.3),v(.4,.5,.6),v(.7,.8,.9)];
  const alpha=beginParticleParameter(p,'Alpha',{stage:0});assert.deepEqual(alpha.change(73.4),new Uint8Array([73,128,255]));assert.equal(p.Alpha[0],0);
  const color=beginParticleParameter(p,'SegmentColor',{stage:2});const changed=color.change([.9,.1,.5]);
  assert.deepEqual(changed[0],p.SegmentColor[0]);assert.deepEqual(changed[1],p.SegmentColor[1]);assert.deepEqual(changed[2],v(.9,.1,.5));
  const size=beginParticleParameter(p,'ParticleScaling',{stage:2});assert.equal(size.sampled,2);assert.deepEqual(size.change(4),v(0,9,4));
});
test('aim latches one native key and never rotates the parent or adds per-frame keys',()=>{
  const {model,p}=fixture();p.Rotation={LineType:1,Keys:[{Frame:100,Vector:v(0,0,0,1)},{Frame:1000,Vector:v(0,0,0,1)},{Frame:3000,Vector:v(0,0,0,1)}]};
  const doc=particleRecipeDocument(extractParticleRecipe(model,[p.ObjectId])),node=doc.model.ParticleEmitters2[0],parentBefore=stringifyParticleData(doc.model.Helpers),rotationBefore=structuredClone(node.Rotation);
  const aim=createParticleGesture({doc,id:node.ObjectId,field:'Rotation',options:{frame:400,interval:[100,2100],axis:1}});
  aim.update(10);aim.update(20);aim.update([15,45,0]);aim.finish();
  assert.equal(doc.historyStats.undoSteps,1);assert.equal(node.Rotation.Keys.length,3);
  assert.deepEqual(doc.model.ParticleEmitters2[0].Rotation.Keys.map(k=>k.Frame),[100,1000,3000]);
  assert.equal(stringifyParticleData(doc.model.Helpers),parentBefore);
  doc.undo();assert.deepEqual(doc.model.ParticleEmitters2[0].Rotation,rotationBefore);
  const whole=beginParticleParameter(p,'Rotation',{frame:100,interval:[100,2100],scope:'track',axis:1}).change(90);
  assert.deepEqual(whole.Keys[2],p.Rotation.Keys[2]);assert.notDeepEqual(whole.Keys[0].Vector,p.Rotation.Keys[0].Vector);
});
test('particle hit-testing rejects transparent corners and cycles independent owners by depth',async()=>{
  const {particleSampleHit,pickParticleSamples}=await import('../src/particle-handles.js');
  const sample={owner:3,textureId:0,filterMode:0,opacity:1,color:[1,1,1],points:[[0,0,.1],[0,20,.1],[20,0,.1],[20,20,.1]],uv:[0,0,0,1,1,0,1,1]};
  const data=new Uint8Array(4*4*4);for(const i of [5,6,9,10])data.set([255,255,255,255],i*4);
  const picture={width:4,height:4,data};
  assert.equal(particleSampleHit(sample,1,1,picture),false);
  assert.equal(particleSampleHit(sample,10,10,picture),true);
  assert.equal(particleSampleHit(sample,25,10,picture),false);
  const back={...sample,owner:7,points:sample.points.map(p=>[p[0],p[1],.5])};
  assert.deepEqual(pickParticleSamples([back,sample,sample],10,10,new Map([[0,picture]])).map(s=>s.owner),[3,7]);
  assert.equal(particleSampleHit({...sample,opacity:0},10,10,picture),false);
});
test('projected native axes and broad spread remain finite and stationary input produces no drift',async()=>{
  const {particleAxisMapping,particleSpreadAtPointer}=await import('../src/particle-handles.js');
  const {movementDragAmount}=await import('../app/movement-overlay.js');
  const basis=particleAxisMapping([30,40],[27,44]);
  assert.equal(movementDragAmount(basis,-6,8,'move'),2);
  assert.equal(movementDragAmount(basis,0,0,'move'),0);
  assert.equal(particleAxisMapping([0,0],[0,0]),null);
  const arc=Array.from({length:181},(_,angle)=>({angle,point:[100*Math.sin(angle*Math.PI/180),100*Math.cos(angle*Math.PI/180)]}));
  assert.equal(particleSpreadAtPointer(arc,[100,0],0,0,90),90);
  assert.equal(particleSpreadAtPointer(arc,[100,0],-100,-100,90),180);
  assert.equal(particleSpreadAtPointer(arc,[0,100],100,-100,0),90);
});

test('particle picking respects perspective UV interpolation and opaque-surface depth',async()=>{
 const {particleSampleHit}=await import('../src/particle-handles.js');
 const sample={owner:0,textureId:0,filterMode:0,opacity:1,color:[1,1,1],points:[[0,0,.5,1],[0,100,.5,1],[100,0,.5,.1],[100,100,.5,.1]],uv:[0,0,0,1,1,0,1,1]};
 const picture={width:2,height:1,flags:0,data:new Uint8Array([255,255,255,255,255,255,255,0])};
 assert.equal(particleSampleHit(sample,75,25,picture),true,'Perspective interpolation reaches the opaque near-side texel');
 assert.equal(particleSampleHit(sample,75,25,picture,.4),false,'Opaque foreground hides the effect');
 assert.equal(particleSampleHit({...sample,points:sample.points.map(p=>p.slice(0,3))},75,25,picture),false,'Screen-linear UVs alone would miss this coverage');
});
