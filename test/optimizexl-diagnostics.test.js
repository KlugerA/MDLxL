import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createStarterDocument} from '../src/starter-model.js';
import {openDocument,createNode} from '../src/editor-document.js';
import {sanityProposals,runOptimizeStage} from '../src/optimizexl.js';
import {classifyHiveFindings} from '../src/optimizexl-diagnostics.js';
import {flattenHiveFindings} from '../app/optimizexl-hive.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const seq=(Name,a,b)=>({Name,Interval:new Uint32Array([a,b]),MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,MoveSpeed:0,NonLooping:false,Rarity:0});
const key=(Frame,Vector)=>({Frame,Vector:new Float32Array(Vector)});
const hive=bytes=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(bytes.buffer);const r=ModelViewer.utils.mdlx.sanityTest(m);return {...r,findings:flattenHiveFindings(r.nodes)};};
function fixture(property='Rotation',global=false){const d=createStarterDocument();d.apply('Roundoff fixture',['Sequences','GlobalSequences','Bones'],m=>{
  m.Sequences=[seq('A',100,300),seq('B',500,700)];m.GlobalSequences=global?[300]:[];
  const a=property==='Rotation'?[0,0,0,1]:property==='Scaling'?[1,1,1]:[2,3,4],b=[...a];b[0]+=1e-7;
  m.Bones[0][property]={LineType:1,GlobalSeqId:global?0:null,Keys:[key(100,a),key(170,b),key(230,b),key(300,a),...(!global?[key(500,property==='Rotation'?[1,1,1,1]:[9,8,7]),key(700,property==='Rotation'?[1,1,1,1]:[9,8,7])]:[])]};
});return d;}
for(const property of ['Translation','Rotation','Scaling'])for(const global of [false,true])test(`${property} ${global?'global':'local'}: actual Hive notices map to one correction and clear after approval`,()=>{
  const d=fixture(property,global),source=d.serialize('mdx'),model=openDocument(source,'x.mdx').model;
  const proposals=sanityProposals(model),f=proposals.find(f=>f.kind==='redundantTracks');assert.ok(f);assert.equal(f.frames.length,2);assert.ok(!f.inspectionOnly);
  const actual=hive(source).findings.filter(f=>f.type==='unused');assert.equal(actual.length,2);
  const classified=classifyHiveFindings(actual,proposals);assert.ok(classified.every(f=>f.status==='preview'&&f.fixId));
  const after=runOptimizeStage(source,'sanity',{},f).bytes;assert.equal(hive(after).unused,0);
  assert.ok(!sanityProposals(openDocument(after,'x.mdx').model).some(f=>f.kind==='redundantTracks'));
  const retained=openDocument(after,'x.mdx').model.Bones[0][property].Keys;
  assert.deepEqual(retained,model.Bones[0][property].Keys.filter(k=>![170,230].includes(k.Frame)));
});
test('equal key values with a meaningful cubic curve are detected but not removed',()=>{
  const d=fixture('Translation');d.model.Bones[0].Translation.LineType=3;
  for(const k of d.model.Bones[0].Translation.Keys){k.InTan=new Float32Array(k.Vector);k.OutTan=new Float32Array(k.Vector);}
  d.model.Bones[0].Translation.Keys[1].OutTan[0]=100;
  const source=d.serialize('mdx'),proposals=sanityProposals(openDocument(source,'x.mdx').model),f=proposals.find(f=>f.kind==='redundantTracks');
  assert.ok(f.inspectionOnly);assert.throws(()=>runOptimizeStage(source,'sanity',{},f),/manual review/);
  assert.ok(classifyHiveFindings(hive(source).findings.filter(f=>f.type==='unused'),proposals).every(f=>f.status==='manual'));
});
test('overlap and non-unit affected spans remain inspection-only; stale plans fail',()=>{
  const d=fixture(),f=sanityProposals(d.model).find(f=>f.kind==='redundantTracks');
  d.model.Bones[0].Rotation.Keys[1].Vector[0]=.5;
  assert.throws(()=>runOptimizeStage(d.serialize('mdx'),'sanity',{},f),/finding changed/);
  const m=fixture().model;m.Sequences.push(seq('Overlap',150,250));
  assert.ok(sanityProposals(m).filter(f=>f.kind==='redundantTracks').every(f=>f.inspectionOnly));
});
test('every Hive unused family and unknown findings have an explicit disposition',()=>{
  const rows=[
    {path:'/Bone 2 - "A/B"/Rotation',message:'Track 1 at frame 200 has roughly the same value as tracks 0 and 2'},
    {path:'/Material 1/Layer 0/Alpha',message:'Track 3 at frame 999 is not in any sequence'},
    {path:'/Helper 0 - "H"/Scaling',message:'Track 3 at frame 999 is not in global sequence 0'},
    {path:'/Texture 2',message:'Unused object'},
    {path:'/Future thing',message:'New unused diagnostic'}
  ].map(f=>({type:'unused',...f}));
  const result=classifyHiveFindings(rows,[{id:'x',kind:'redundantTracks',path:['Bones','2','Rotation'],noticed:[200],frames:[200]}]);
  assert.deepEqual(result.map(f=>f.kind),['redundantTracks','unusedLocalKeys','globalKeys','unusedObject','unsupported']);
  assert.deepEqual(result.map(f=>f.status),['preview','manual','manual','stage','manual']);
  assert.equal(result.length,rows.length);assert.ok(result.every(f=>f.reason));
  assert.equal(classifyHiveFindings([{type:'warning',path:'/ParticleEmitter2 3 - "Fire"/Gravity',message:'Using a gravity animation.'}],
    [{id:'gravity:3',kind:'gravity',emitter:3}])[0].status,'preview');
});
test('scalar material channels use the same Hive classifier and repair engine',()=>{
  const d=fixture();delete d.model.Bones[0].Rotation;
  d.model.Materials[0].Layers[0].Alpha={LineType:1,GlobalSeqId:null,Keys:[key(100,[.8]),key(200,[.8000001]),key(300,[.8])]};
  const source=d.serialize('mdx'),m=openDocument(source,'x.mdx').model,proposals=sanityProposals(m),actual=hive(source).findings.filter(f=>f.type==='unused');
  assert.equal(actual.length,1);const classified=classifyHiveFindings(actual,proposals);assert.equal(classified[0].status,'preview');
  const fix=proposals.find(f=>f.id===classified[0].fixId);assert.equal(hive(runOptimizeStage(source,'sanity',{},fix).bytes).unused,0);
});
test('particle type names containing digits route actual checker findings correctly',()=>{
  const d=fixture();delete d.model.Bones[0].Rotation;
  d.apply('Particle fixture',['ParticleEmitters2','PivotPoints'],m=>{
    const e=createNode(m,'ParticleEmitter2');e.Gravity={LineType:1,GlobalSeqId:null,Keys:[key(100,[1]),key(200,[1.0000001]),key(300,[1])]};
  });
  const source=d.serialize('mdx'),proposals=sanityProposals(openDocument(source,'x.mdx').model),actual=hive(source).findings;
  const matching=actual.filter(f=>f.path.endsWith('/Gravity')&&(f.type==='unused'||f.message==='Using a gravity animation.'));
  assert.equal(matching.length,2);assert.ok(classifyHiveFindings(matching,proposals).every(f=>f.status==='preview'&&f.fixId==='gravity:0'));
  assert.equal(proposals.filter(f=>f.path?.at(-1)==='Gravity').length,0,'The whole-track repair exclusively owns gravity');
  const result=runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:proposals.filter(f=>!f.inspectionOnly).map(fix=>({fix,settings:{}}))});
  assert.ok(!hive(result.bytes).findings.some(f=>f.path.endsWith('/Gravity')));
});
