import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createDemoDocument, openDocument, createNode, deleteNode, deleteGeoset, importGeosets } from '../src/editor-document.js';
import { commitPart, partTextureIndices } from '../src/bits-and-parts.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { bindVertices } from '../src/editor-commands.js';
import { parseAnimationTrackText } from '../src/animation-tracks.js';
import { skinGeoset } from '../src/animation.js';
import { Matrix4 } from 'three';
import { uncoupleUVVertices } from '../src/uv-tools.js';
import { analyzeOptimization, applyOptimization } from '../src/model-optimizer.js';
import { parseMdx } from '../src/mdx-container.js';
import { parseCompatibleMdx, generateCompatibleMdx } from '../src/mdx-compatibility.js';

const f = (...v) => Float32Array.from(v);
const i32 = n => { const b=Buffer.alloc(4);b.writeInt32LE(n);return b; };
const float = n => { const b=Buffer.alloc(4);b.writeFloatLE(n);return b; };
const sized = b => Buffer.concat([i32(b.length+4),b]);
const chunk = (tag,b) => Buffer.concat([Buffer.from(tag),i32(b.length),b]);
const chunks = b => parseMdx(b).chunks.map(c=>({tag:c.tag,data:Buffer.from(b).subarray(c.payloadOffset,c.payloadOffset+c.declaredSize)}));
const payload = (b,tag) => chunks(b).find(c=>c.tag===tag)?.data;
const alter = (b,tag,fn) => Buffer.concat([Buffer.from('MDLX'),...chunks(b).map(c=>chunk(c.tag,c.tag===tag?fn(Buffer.from(c.data)):c.data))]);
const fixture = () => Buffer.from(createDemoDocument().serialize('mdx'));
const load = b => { const d=openDocument(b);assert.equal(d.readOnly,false,JSON.stringify(d.diagnostics));return d; };
const reopenEdit = (b,key,fn) => {const d=load(b);d.apply('test edit',[key],fn);return {bytes:Buffer.from(d.serialize()),doc:d};};
const track = (width=1,integer=false) => ({LineType:3,GlobalSeqId:null,Keys:[{Frame:-10,Vector:(integer?Int32Array:Float32Array).from(Array.from({length:width},(_,i)=>integer?i:i+0.125)),InTan:(integer?Int32Array:Float32Array).from(Array.from({length:width},(_,i)=>integer?i:i+0.25)),OutTan:(integer?Int32Array:Float32Array).from(Array.from({length:width},(_,i)=>integer?i:i+0.75))}]});

test('actual editor no-op saves are exact; editing model name leaves every other chunk exact',()=>{
  const b=fixture(),d=load(b);assert.deepEqual(Buffer.from(d.serialize()),b);
  d.apply('name',['Info'],m=>{m.Info.Name='Renamed';});const out=Buffer.from(d.serialize());
  for(const c of chunks(b))if(c.tag!=='MODL')assert.deepEqual(payload(out,c.tag),c.data,c.tag);
});
test('MODL animation filename and full 260-byte TEXS paths survive sibling edits',()=>{
  const path='x'.repeat(260);
  let b=alter(fixture(),'MODL',p=>{p.fill(0,80,340);p.write('Animations\\external.mdx',80);return p;});
  b=alter(b,'TEXS',p=>{p.write(path,4);return p;});
  let d=load(b);assert.equal(d.model.Info.Name,'Aether Runeblade');assert.equal(d.model.Info.AnimationFile,'Animations\\external.mdx');assert.equal(d.model.Textures[0].Image,path);
  d.apply('name and flag',['Info','Textures'],m=>{m.Info.Name='Changed';m.Textures[0].Flags=3;});
  const out=Buffer.from(d.serialize());assert.deepEqual(payload(out,'MODL').subarray(80,340),payload(b,'MODL').subarray(80,340));assert.equal(payload(out,'TEXS').subarray(4,264).toString(),path);
});
test('SEQS sync point and unknown flag bits survive a sequence rename',()=>{
  const b=alter(fixture(),'SEQS',p=>{p.writeUInt32LE(987,100);p.writeUInt32LE(0x80000080,92);return p;});
  const {bytes}=reopenEdit(b,'Sequences',m=>{m.Sequences[0].Name='Different';});
  assert.equal(payload(bytes,'SEQS').readUInt32LE(100),987);assert.equal(payload(bytes,'SEQS').readUInt32LE(92),0x80000080);
});
test('v1100 reads sparse reordered slots and writes animated slots by their explicit id',()=>{
  // Independently authored MTLS: normal (slot 1), then diffuse (slot 0).
  const spline=Buffer.concat([Buffer.from('KMTF'),i32(1),i32(3),i32(-1),i32(-5),i32(0),i32(0),i32(0)]);
  const layer=sized(Buffer.concat([i32(0),i32(0),i32(7),i32(-1),i32(0),float(0.75),float(1),float(0.2),float(0.3),float(0.4),float(0),float(0),i32(1),i32(2),i32(0),i32(1),spline,i32(0),i32(0)]));
  const material=sized(Buffer.concat([i32(0),i32(0),Buffer.from('LAYS'),i32(1),layer]));
  // Use no geosets: v800 GEOS must not masquerade as a v1100 layout.
  const source=Buffer.concat([Buffer.from('MDLX'),chunk('VERS',i32(1100)),chunk('MODL',payload(fixture(),'MODL')),chunk('TEXS',payload(fixture(),'TEXS')),chunk('MTLS',material)]);
  const d=load(source),l=d.model.Materials[0].Layers[0];assert.equal(l.TextureID,0);assert.equal(l.NormalTextureID.Keys[0].Frame,-5);
  d.apply('alpha',['Materials'],m=>{m.Materials[0].Layers[0].Alpha=0.5;});const out=Buffer.from(d.serialize());
  const p=payload(out,'MTLS');assert.equal(p.readUInt32LE(20+64),1);assert.equal(p.readUInt32LE(20+60),0);assert.equal(p.readUInt32LE(20+12),7);
  assert.deepEqual(load(out).model.Materials[0].Layers[0].NormalTextureID,l.NormalTextureID);
});
test('static GEOA colors remain RGB on load and save',()=>{
  const b=alter(fixture(),'GEOA',p=>{p.writeFloatLE(0.125,12);p.writeFloatLE(0.25,16);p.writeFloatLE(0.875,20);return p;});
  const d=load(b);assert.deepEqual(d.model.GeosetAnims[0].Color,f(0.125,0.25,0.875));
  d.apply('alpha',['GeosetAnims'],m=>{m.GeosetAnims[1].Alpha=0.5;});const out=Buffer.from(d.serialize());
  assert.deepEqual(payload(out,'GEOA').subarray(12,24),payload(b,'GEOA').subarray(12,24));
  const mdl=load(out).serialize('mdl');assert.deepEqual(load(mdl).model.GeosetAnims[0].Color,f(0.125,0.25,0.875));
});
test('negative event times and global sequence survive both format conversions',()=>{
  const d=createDemoDocument();d.apply('event',['EventObjects','GlobalSequences'],m=>{m.GlobalSequences.push(1000);const e=createNode(m,'EventObject');e.EventTrack=Int32Array.of(-20,0,42);e.GlobalSeqId=0;});
  const a=load(d.serialize('mdx')),b=load(a.serialize('mdl')),c=load(b.serialize('mdx'));
  assert.deepEqual(c.model.EventObjects[0].EventTrack,Int32Array.of(-20,0,42));assert.equal(c.model.EventObjects[0].GlobalSeqId,0);
});
test('float light attenuation splines and ribbon color splines survive edited MDX and MDL',()=>{
  const d=createDemoDocument();d.apply('nodes',['Lights','RibbonEmitters'],m=>{const l=createNode(m,'Light');l.AttenuationStart=track();l.AttenuationEnd=track();const r=createNode(m,'RibbonEmitter');r.Color=track(3);});
  const b=d.serialize('mdx'),r=load(b);assert.deepEqual(r.model.Lights[0].AttenuationStart,track());assert.deepEqual(r.model.RibbonEmitters[0].Color,track(3));
  r.apply('names',['Lights','RibbonEmitters'],m=>{m.Lights[0].Name='lamp';m.RibbonEmitters[0].Name='ribbon';});
  const x=load(r.serialize()),y=load(x.serialize('mdl'));
  assert.deepEqual(y.model.Lights[0].AttenuationStart,track());assert.deepEqual(y.model.RibbonEmitters[0].Color,track(3));
});
test('plane and cylinder collision shapes preserve vertices and radius',()=>{
  const d=createDemoDocument();d.apply('collision',['CollisionShapes'],m=>{for(const Shape of [1,3]){const n=createNode(m,'CollisionShape');Object.assign(n,{Shape,Vertices:f(1,2,3,4,5,6),BoundsRadius:7});}});
  const a=load(d.serialize('mdx')),b=load(a.serialize('mdl')),c=load(b.serialize('mdx'));
  assert.deepEqual(c.model.CollisionShapes.map(n=>n.Shape),[1,3]);assert.deepEqual(c.model.CollisionShapes[1].Vertices,f(1,2,3,4,5,6));assert.equal(c.model.CollisionShapes[1].BoundsRadius,7);
});
test('multiple DontInherit flags accept and regenerate the community form',()=>{
  const d=createDemoDocument();d.apply('inherit',['Bones'],m=>{m.Bones[0].Flags|=7;});
  const r=load(d.serialize('mdl'));assert.equal(r.model.Bones[0].Flags&7,7);
});
test('MDL edits retain float32 precision in positions, tracks, colors and UVs',()=>{
  const d=load(fixture());d.apply('sentinels',['Geosets','Bones','GeosetAnims'],m=>{m.Geosets[0].Vertices[0]=0.000000123456789;m.Geosets[0].TVertices[0][0]=0.123456789;m.Bones[0].Translation.Keys[0].Vector[0]=0.123456789;m.GeosetAnims[0].Color[0]=0.123456789;});
  const r=load(d.serialize('mdl'));
  assert.deepEqual(r.model.Geosets[0].Vertices,d.model.Geosets[0].Vertices);assert.deepEqual(r.model.Geosets[0].TVertices,d.model.Geosets[0].TVertices);assert.deepEqual(r.model.Bones[0].Translation,d.model.Bones[0].Translation);assert.deepEqual(r.model.GeosetAnims[0].Color,d.model.GeosetAnims[0].Color);
});
test('direct serialization rejects conversion with opaque data',()=>{
  const b=Buffer.concat([fixture(),chunk('ZZZZ',Buffer.from([1,2,3]))]);const d=load(b);
  assert.throws(()=>d.serialize('mdl'),/unrecognized source data/);assert.deepEqual(Buffer.from(d.serialize()),b);
});
test('16 UV limit is enforced and zero UV sets do not break unrelated MDL edits',()=>{
  const d=load(fixture());assert.throws(()=>d.apply('too many',['Geosets'],m=>{m.Geosets[0].TVertices=Array.from({length:17},()=>m.Geosets[0].TVertices[0]);}),/16 UV/);
  d.apply('no UV',['Geosets'],m=>{m.Geosets[0].TVertices=[];});assert.equal(load(d.serialize('mdx')).model.Geosets[0].TVertices.length,0);
  assert.equal(load(d.serialize('mdl')).model.Geosets[0].TVertices.length,0);
});

test('independent MDL dialect fixture accepts engine slots, shader names and extra flags',()=>{
  const text=`Version { FormatVersion 1100, }
  Model "dialects" { BlendTime 150, }
  Textures 1 { Bitmap { Image "Textures\\unit.blp", } }
  Materials 1 { Material { SortPrimitives, SortPrimsNearZ, TwoSided,
    Layer { FilterMode None, Shader "Shader_HD_Crystal", WrapWidth, WrapHeight, Unlit, BackFacesForShadows, AmbientOcclusion,
      static TextureID 0 <= 1, static TextureID 0 <= 0, static FresnelColor { 0.125, 0.25, 0.875 }, }
  } }`;
  const d=load(text),l=d.model.Materials[0].Layers[0];
  assert.equal(l.NormalTextureID,0);assert.equal(l.TextureID,0);assert.equal(l.ShaderTypeId,24);assert.equal(l.Shading,0x70c);assert.deepEqual(l.FresnelColor,f(0.125,0.25,0.875));
  d.apply('priority',['Materials'],m=>{m.Materials[0].PriorityPlane=3;});const r=load(d.serialize());assert.deepEqual(r.model.Materials,d.model.Materials);
  const x=load(d.serialize('mdx'));assert.deepEqual(x.model.Materials[0].Layers[0].FresnelColor,f(0.125,0.25,0.875));
});
test('MDL engine bare skin rows, selection flags and Hive LOD names preserve data',()=>{
  const text=`Version { FormatVersion 1400, } Model "skin" { }
  Geoset { Vertices 1 { {1,2,3}, } Normals 1 { {0,0,1}, }
    VertexGroup {0,} Groups 1 1 { Matrices {300}, } Faces 0 0 {Triangles {}}
    MaterialID 0, SelectionGroup 0, SelectionFlags 128, LevelOfDetail 0, LevelOfDetailName "detail",
    SkinWeights 1 { 300,0,0,0,255,0,0,0, }
  }`;
  const d=load(text);assert.deepEqual(d.model.Geosets[0].SkinWeights,Uint16Array.of(300,0,0,0,255,0,0,0));assert.equal(d.model.Geosets[0].Name,'detail');
  d.apply('move',['Geosets'],m=>{m.Geosets[0].Vertices[0]=3;});const r=load(d.serialize());assert.deepEqual(r.model.Geosets[0].SkinWeights,d.model.Geosets[0].SkinWeights);assert.equal(r.model.Geosets[0].SelectionFlags,128);
});
test('MDL modern camera depth-of-field keywords use scalar and keyed forms correctly',()=>{
  const text=`Version { FormatVersion 1800, } Model "camera" { }
  Camera "lens" { Position {1,2,3}, FieldOfView 1, NearClip 0.1, FarClip 1000,
    DOFDistance 42, FocalLengthKeys 1 { Linear, -10: 35, } FStopKeys 1 { DontInterp, 0: 2.8, }
    Target { Position {0,0,0}, } Visibility 1 {DontInterp,0:1,}
  }`;
  const d=load(text);assert.equal(d.model.Cameras[0].FocusDistance.Keys[0].Vector[0],42);assert.equal(d.model.Cameras[0].FocalLength.Keys[0].Vector[0],35);
  d.apply('camera',['Cameras'],m=>{m.Cameras[0].Name='lens 2';});const x=load(d.serialize('mdx')),r=load(x.serialize('mdl'));assertModelEquivalent(d.model,r.model);
});
test('v1800 full editor saves preserve camera variants, lights, 16-bit bindings, and pivots',()=>{
  const m=structuredClone(createDemoDocument().model);m.Version=1800;
  const high=createNode(m,'Bone');m.Nodes[high.ObjectId]=undefined;high.ObjectId=300;m.Nodes[300]=high;m.PivotPoints[300]=f(7,8,9);
  for(let j=0;j<m.PivotPoints.length;j++)m.PivotPoints[j]||=f(0,0,0);
  const light=createNode(m,'Light');Object.assign(light,{ShadowIntensity:0.75,ShadowCasting:1,ShadowCastingStart:track(),ShadowCastingEnd:track(),QuadraticFalloff:track(),LinearFalloff:track(),Damping:track()});
  for(const g of m.Geosets){g.LevelOfDetail=0;g.Name='LOD';g.SkinWeights=Uint16Array.from({length:g.Vertices.length/3*8},(_,i)=>i%8===0?300:i%8===4?255:0);}
  m.Cameras=[{Name:'cam',Variant:3,Position:f(1,2,3),TargetPosition:f(4,5,6),FieldOfView:1,NearClip:10,FarClip:1000,Visibility:track()}];
  const d=load(generateCompatibleMdx(m));d.apply('bind',['Geosets'],m=>{bindVertices(m,m.Geosets[0],[0],300);m.Geosets[0].Vertices[0]+=1;});
  const r=load(d.serialize());assert.equal(r.model.Geosets[0].SkinWeights[0],300);assert.equal(r.model.Cameras[0].Variant,3);assert.deepEqual(r.model.PivotPoints[300],f(7,8,9));assert.deepEqual(r.model.Lights[0].QuadraticFalloff,track());
});
test('DILG survives conversion and references follow a geoset deletion',()=>{
  const b=Buffer.concat([fixture(),chunk('DILG',Buffer.concat([i32(1),i32(4)]))]);const d=load(b);
  assert.deepEqual(d.model.Gliders,[{GeosetId:1},{GeosetId:4}]);const text=d.serialize('mdl');assert.deepEqual(load(text).model.Gliders,d.model.Gliders);
  d.apply('remove geoset',['Geosets'],m=>{deleteGeoset(m,1);});const r=load(d.serialize());assert.deepEqual(r.model.Gliders,[{GeosetId:3}]);
});
test('deep verification detects changed tangents, paths, pivots, bindings and omitted tracks',()=>{
  const a=load(fixture()).model;
  for(const mutate of [m=>{m.Textures[0].Image='wrong';},m=>{m.PivotPoints[0][0]=1;},m=>{m.Geosets[0].Groups[0][0]=123;},m=>{delete m.Bones[0].Rotation;},m=>{m.Bones[0].Translation.Keys[0].Vector[0]=1;}]){const b=structuredClone(a);mutate(b);assert.throws(()=>assertModelEquivalent(a,b),/Save verification failed/);}
});
test('node flags and spline transforms round trip for every Classic node type',()=>{
  const d=createDemoDocument();
  d.apply('all nodes',[],m=>{for(const type of ['Bone','Helper','Light','Attachment','EventObject','CollisionShape','ParticleEmitter','ParticleEmitter2','RibbonEmitter']){const n=createNode(m,type);n.Flags|=0xff;n.Translation=track(3);n.Rotation=track(4);n.Scaling=track(3);}});
  const a=load(d.serialize('mdx')),b=load(a.serialize('mdl'));assertModelEquivalent(a.model,b.model);
});
test('untouched MDX sibling records retain nonzero padding when another record changes',()=>{
  let b=fixture();const tex=Buffer.from(payload(b,'TEXS'));tex[20]=0xde;tex[21]=0xad;b=alter(b,'TEXS',()=>Buffer.concat([tex,payload(b,'TEXS')]));
  const {bytes}=reopenEdit(b,'Textures',m=>{m.Textures[1].Flags=3;});assert.deepEqual(payload(bytes,'TEXS').subarray(0,268),tex);
});
test('untouched MDL sibling material comments and formatting survive another material edit',()=>{
  const d=createDemoDocument(),source=Buffer.from(d.originalBytes).toString().replace('Material {','Material { // retained exact comment\r\n');const a=load(source);
  a.apply('alpha',['Materials'],m=>{m.Materials[1].Layers[0].Alpha=0.5;});assert.match(Buffer.from(a.serialize()).toString(),/Material \{ \/\/ retained exact comment\r\n/);
});
test('sparse pivot IDs and unused authored pivots survive rename, creation, deletion and undo',()=>{
  const text=`Version {FormatVersion 800,} Model "pivots" {} Helper "h" {ObjectId 2,} PivotPoints 4 {{1,2,3},{4,5,6},{7,8,9},{10,11,12},}`;
  const d=load(text);d.apply('rename',['Helpers'],m=>{m.Helpers[0].Name='renamed';});let r=load(d.serialize());assert.equal(r.model.PivotPoints.length,4);assert.deepEqual(r.model.PivotPoints[3],f(10,11,12));
  d.apply('new',['Helpers'],m=>{assert.equal(createNode(m,'Helper').ObjectId,4);});d.undo();assert.deepEqual(load(d.serialize()).model.PivotPoints,r.model.PivotPoints);
  d.apply('delete',['Helpers'],m=>{deleteNode(m,2);});r=load(d.serialize());assert.equal(r.model.PivotPoints.length,4);assert.deepEqual(r.model.PivotPoints[3],f(10,11,12));
});
test('unknown nested MDL properties cannot disappear from a successful save',()=>{
  const d=load('Version {FormatVersion 800,} Model "unknown" {CustomField 42,}');
  d.apply('name',['Info'],m=>{m.Info.Name='new';});assert.throws(()=>d.serialize(),/CustomField/);
});

test('non-finite authored numbers survive an unrelated edit and MDL regeneration',()=>{
  const d=load('Version {FormatVersion 800,} Model "numbers" {BoundsRadius nan, MinimumExtent {-inf,0,0}, MaximumExtent {inf,1,1},} PivotPoints 1 {{nan,inf,-inf},}');
  assert.ok(Number.isNaN(d.model.Info.BoundsRadius));assert.equal(d.model.Info.MinimumExtent[0],-Infinity);
  d.apply('name',['Info'],m=>{m.Info.Name='renamed';});const r=load(d.serialize());assert.ok(Number.isNaN(r.model.Info.BoundsRadius));assert.equal(r.model.PivotPoints[0][2],-Infinity);
});
test('signed frame boundaries and large sequence integers retain exact bits',()=>{
  const d=createDemoDocument();d.apply('times',['Sequences','Bones'],m=>{m.Sequences[0].Interval=Uint32Array.of(2000000001,2000000101);m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:-2147483648,Vector:f(0,0,0)},{Frame:2147483647,Vector:f(1,2,3)}]};});
  const a=load(d.serialize('mdx')),r=load(a.serialize('mdl'));assert.deepEqual(r.model.Sequences[0].Interval,Uint32Array.of(2000000001,2000000101));assert.equal(r.model.Bones[0].Translation.Keys[1].Frame,2147483647);
  const bad=structuredClone(r.model);bad.Bones[0].Translation.Keys[1].Frame--;assert.throws(()=>assertModelEquivalent(r.model,bad),/Frame/);
});
test('animated property static bases survive a name edit and cross-format conversion',()=>{
  const d=createDemoDocument();d.apply('curves',[],m=>{m.Materials[0].Layers[0].Alpha=track();m.Materials[0].Layers[0]._MdxDefaults={Alpha:0.375};m.GeosetAnims[0].Color=track(3);m.GeosetAnims[0]._MdxDefaults={Color:f(0.125,0.25,0.875)};const n=createNode(m,'ParticleEmitter');n.EmissionRate=track();n._MdxDefaults={EmissionRate:123.25};});
  const a=load(d.serialize('mdx'));a.apply('names',[],m=>{m.ParticleEmitters[0].Name='keep bases';m.Materials[0].PriorityPlane=2;m.GeosetAnims[0].Alpha=0.75;});
  const b=load(a.serialize()),c=load(b.serialize('mdl')),r=load(c.serialize('mdx'));assertModelEquivalent(b.model,r.model);
  assert.equal(r.model.ParticleEmitters[0]._MdxDefaults.EmissionRate,123.25);assert.deepEqual(r.model.GeosetAnims[0]._MdxDefaults.Color,f(0.125,0.25,0.875));
});
test('Popcorn flag order, quaternion W, RGB, and multiline visibility guide survive',()=>{
  const d=load(`Version {FormatVersion 1000,} Model "popcorn" {} ParticleEmitterPopcorn "fx" {
    ObjectId 0, PopcornScaling, Unfogged, static LifeSpan 1, static EmissionRate 1, static Speed 1,
    static Color {0.125,0.25,0.875}, static Alpha 1, Path "effect.pkfx", AnimVisibilityGuide "Stand=on\nDeath=off",
    Rotation 1 {Bezier, -10:{0.1,0.2,0.3,0.4}, InTan {0.5,0.6,0.7,0.8}, OutTan {0.9,1,1.1,1.2},}
  } PivotPoints 1 {{0,0,0},}`);
  assert.equal(d.model.ParticleEmitterPopcorns[0].Flags&0x60000,0x60000);assert.deepEqual(d.model.ParticleEmitterPopcorns[0].Color,f(0.125,0.25,0.875));
  const a=load(d.serialize('mdx'));a.apply('rename',['ParticleEmitterPopcorns'],m=>{m.ParticleEmitterPopcorns[0].Name='fx2';});const r=load(a.serialize('mdl'));assertModelEquivalent(a.model,r.model);
});
test('engine flat ParticleEmitter fields parse and retain 260-byte paths',()=>{
  const path='x'.repeat(260),d=load(`Version {FormatVersion 800,} Model "prem" {} ParticleEmitter "fx" {ObjectId 0, EmitterUsesMdl, static EmissionRate 1, static Gravity 0, static Longitude 0, static Latitude 0, Path "${path}", static LifeSpan 1, static InitVelocity 2,} PivotPoints 1 {{0,0,0},}`);
  assert.equal(d.model.ParticleEmitters[0].Path,path);const a=load(d.serialize('mdx'));a.apply('name',[],m=>{m.ParticleEmitters[0].Name='changed';});assert.equal(load(a.serialize()).model.ParticleEmitters[0].Path,path);
});
test('bind-pose matrices and emitter segment colors retain float32 precision in MDL',()=>{
  const d=createDemoDocument();d.convertVersion(1000);d.apply('precision',[],m=>{const n=createNode(m,'ParticleEmitter2');n.SegmentColor[0][0]=0.123456789;m.BindPoses=[{Matrices:[Float32Array.from({length:12},(_,i)=>i+0.123456789)]}];});
  const r=load(d.serialize('mdl'));assert.deepEqual(r.model.BindPoses,d.model.BindPoses);assert.deepEqual(r.model.ParticleEmitters2[0].SegmentColor,d.model.ParticleEmitters2[0].SegmentColor);
});
test('unknown sound nodes and non-triangle geometry stay exact-copy read-only',()=>{
  const b=Buffer.concat([fixture(),chunk('SNEM',Buffer.alloc(0))]),d=openDocument(b);assert.equal(d.readOnly,true);assert.deepEqual(Buffer.from(d.serialize()),b);
  const g=alter(fixture(),'GEOS',p=>{const at=p.indexOf(Buffer.from('PTYP'));p.writeUInt32LE(5,at+8);return p;}),r=openDocument(g);assert.equal(r.readOnly,true);assert.deepEqual(Buffer.from(r.serialize()),g);
});
test('conversion rejects binary-only authored data rather than deleting it',()=>{
  const b=alter(fixture(),'MODL',p=>{p.write('external.mdx',80);return p;});assert.throws(()=>load(b).serialize('mdl'),/AnimationFile/);
});

for(const version of [800,900,1000,1100,1200,1300,1400,1600,1800])test(`v${version} edited material tracks survive full-document MDX saves`,()=>{
  const m=structuredClone(createDemoDocument().model);m.Version=version;
  if(version>=900){for(const g of m.Geosets){g.LevelOfDetail=0;g.Name='detail';}for(const material of m.Materials){if(version<1100)material.Shader='Shader_HD_DefaultUnit';for(const l of material.Layers){l.EmissiveGain=track();if(version>=1000){l.FresnelColor=track(3);l.FresnelOpacity=track();l.FresnelTeamColor=track();}if(version>=1100){l.NormalTextureID=track(1,true);l.ShaderTypeId=1;}}}}
  const d=load(generateCompatibleMdx(m));d.apply('material',['Materials'],m=>{m.Materials[0].PriorityPlane=5;});const r=load(d.serialize());assertModelEquivalent(d.model,r.model);
});

test('negative times are editable through the animation text API',()=>{
  const t=parseAnimationTrackText('-20: 0.25\n0: 1');assert.equal(t.Keys[0].Frame,-20);assert.throws(()=>parseAnimationTrackText('-2147483649: 1'),/signed 32-bit/);
});
test('u16 skins deform with the high bone and survive existing UV uncouple operations',()=>{
  const g=structuredClone(load(fixture()).model.Geosets[0]);g.SkinWeights=Uint16Array.from({length:g.Vertices.length/3*8},(_,i)=>i%8===0?300:i%8===4?255:0);
  const matrices=new Map([[300,new Matrix4().makeTranslation(10,20,30)]]),before=skinGeoset(g,matrices);assert.equal(before[0],g.Vertices[0]+10);
  const result=uncoupleUVVertices(g,[0]);assert.ok(result.added>0);assert.ok(g.SkinWeights instanceof Uint16Array);assert.equal(g.SkinWeights.at(-8),300);assert.equal(skinGeoset(g,matrices).at(-3),g.Vertices.at(-3)+10);
});
test('Classic light export never injects modern-only light fields',()=>{
  const d=createDemoDocument();d.apply('light',[],m=>{createNode(m,'Light');});const text=Buffer.from(d.serialize('mdl')).toString();
  assert.doesNotMatch(text,/QuadraticFalloff|LinearFalloff|Damping|ShadowIntensity|ShadowCasting/);
});
test('optimizer can still verify both MDL and MDX source documents',()=>{
  for(const d of [createDemoDocument(),load(fixture())]){const report=analyzeOptimization(d);assert.ok(report.before>0);assert.equal(d.dirty,false);}
});
test('geoset topology changes update primitive counts and remain saveable',()=>{
  const d=load(fixture());d.apply('face',[],m=>{m.Geosets[0].Faces=m.Geosets[0].Faces.slice(3);});const r=load(d.serialize());assert.equal(r.model.Geosets[0].PrimitiveCounts[0],r.model.Geosets[0].Faces.length);
});

test('static MDL visibility stays static after a rename or sequence edit',()=>{
  const d=load(`Version {FormatVersion 800,} Model "visibility" {} Sequences 1 {Anim "Stand" {Interval {100,200},}} Attachment "a" {ObjectId 0, AttachmentID 0, static Visibility 0.25,} PivotPoints 1 {{0,0,0},}`);
  assert.equal(d.model.Attachments[0].Visibility,0.25);d.apply('rename',[],m=>{m.Attachments[0].Name='renamed';m.Sequences[0].Interval[1]=300;});
  const text=Buffer.from(d.serialize()).toString();assert.match(text,/static Visibility 0.25/);assert.equal(load(text).model.Attachments[0].Visibility,0.25);
  const binary=load(d.serialize('mdx'));assert.deepEqual(binary.model.Attachments[0].Visibility.Keys.map(k=>k.Frame),[0,100,300]);
});
test('MDL unselectable edits synchronize only bit four in the raw selection flags',()=>{
  const d=createDemoDocument();d.apply('selection',[],m=>{m.Geosets[0].SelectionFlags=128;m.Geosets[0].Unselectable=true;});const r=load(d.serialize('mdl'));assert.equal(r.model.Geosets[0].Unselectable,true);assert.equal(r.model.Geosets[0].SelectionFlags,132);
});
test('version conversion verifies event globals and preserves them before committing',()=>{
  const d=createDemoDocument();d.apply('event',[],m=>{m.GlobalSequences.push(1000);const n=createNode(m,'EventObject');n.GlobalSeqId=0;n.EventTrack=Int32Array.of(-5,50);});d.convertVersion(1000);
  const r=load(d.serialize('mdx'));assert.equal(r.version,1000);assert.equal(r.model.EventObjects[0].GlobalSeqId,0);assert.deepEqual(r.model.EventObjects[0].EventTrack,Int32Array.of(-5,50));
});
test('geoset raw selection bits and primitive group boundaries survive sibling edits',()=>{
  const d=load(fixture());d.apply('metadata',['Geosets'],m=>{const g=m.Geosets[0];g.SelectionFlags=0x80;g.PrimitiveTypes=Uint32Array.of(4,4);g.PrimitiveCounts=Uint32Array.of(3,g.Faces.length-3);});
  const a=load(d.serialize());a.apply('other',['Geosets'],m=>{m.Geosets[1].Vertices[0]+=1;});const b=load(a.serialize());
  assert.equal(b.model.Geosets[0].SelectionFlags,0x80);assert.deepEqual(b.model.Geosets[0].PrimitiveCounts,d.model.Geosets[0].PrimitiveCounts);
});
test('modern binary boundary supports camera variants and versioned lights and u16 skin',()=>{
  for(const version of [1200,1300,1400,1600,1800]){
    const m=structuredClone(createDemoDocument().model);m.Version=version;
    const l=createNode(m,'Light');Object.assign(l,{ShadowIntensity:0.75,ShadowCasting:1,ShadowCastingStart:track(),ShadowCastingEnd:2,QuadraticFalloff:0.0005,LinearFalloff:0.1,Damping:0.00001});
    if(version<1300)delete l.ShadowCastingStart;
    m.Cameras=[{Name:'Camera',Variant:2,VariantData:Uint8Array.from({length:12},(_,i)=>i+1),Position:f(1,2,3),TargetPosition:f(4,5,6),FieldOfView:1,FarClip:1000,NearClip:10,FocusDistance:track(),Visibility:track()}];
    for(const g of m.Geosets){g.LevelOfDetail=0;g.Name='LOD';g.SkinWeights=(version>=1400?Uint16Array:Uint8Array).from({length:g.Vertices.length/3*8},(_,i)=>i%8===0?(version>=1400?300:0):i%8===4?255:0);}
    const bytes=generateCompatibleMdx(m),r=parseCompatibleMdx(bytes);
    assert.equal(r.Version,version);assert.deepEqual(r.Cameras[0],m.Cameras[0]);assert.equal(r.Lights[0].ShadowIntensity,0.75);if(version>=1300)assert.deepEqual(r.Lights[0].ShadowCastingStart,track());assert.equal(r.Geosets[0].SkinWeights[0],version>=1400?300:0);
    assert.deepEqual(generateCompatibleMdx(r),bytes);
  }
});

for (const mode of ['rig import','part import','optimization']) test(`${mode} retains and remaps the static texture behind animated keys`,()=>{
  const source=createDemoDocument();
  source.apply('texture fixture',[],m=>{
    m.Textures=[{Image:'unused.blp',ReplaceableId:0,Flags:0},{Image:'base.blp',ReplaceableId:0,Flags:0},{Image:'animated.blp',ReplaceableId:0,Flags:0}];
    for(const material of m.Materials)for(const layer of material.Layers){layer.TextureID={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:Int32Array.of(2)}]};layer._MdxDefaults={TextureID:1};}
  });
  const d=load(source.serialize('mdx'));
  if(mode==='optimization'){
    const report=analyzeOptimization(d);assert.equal(report.canApply,true);applyOptimization(d,report);
    const r=load(d.serialize());assert.equal(r.model.Textures.length,2);
    const layer=r.model.Materials[0].Layers[0];assert.equal(r.model.Textures[layer._MdxDefaults.TextureID].Image,'base.blp');assert.equal(r.model.Textures[layer.TextureID.Keys[0].Vector[0]].Image,'animated.blp');
  }else{
    assert.deepEqual(new Set(partTextureIndices(d.model)),new Set([1,2]));
    const target=load(fixture());let result;
    target.apply('import',[],m=>{result=mode==='rig import'?importGeosets(m,d.model,[0]):commitPart(m,d.model);});
    const r=load(target.serialize()),layer=r.model.Materials[r.model.Geosets[result.geosetIndices[0]].MaterialID].Layers[0];
    assert.equal(r.model.Textures[layer._MdxDefaults.TextureID].Image,'base.blp');assert.equal(r.model.Textures[layer.TextureID.Keys[0].Vector[0]].Image,'animated.blp');
  }
});
