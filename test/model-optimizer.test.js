import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, stat, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { analyzeOptimization, applyOptimization, verifyOptimization, verifyTransformReduction } from '../src/model-optimizer.js';

const track = (frames, vector = [1, 2, 3], extra = {}) => ({ LineType: 1, GlobalSeqId: null, Keys: frames.map(Frame => ({ Frame, Vector: new Float32Array(vector) })), ...extra });
function fixture(mutator) {
  const doc = createStarterDocument(); doc.apply('Fixture', [], model => {
    const g = model.Geosets[0];
    g.Vertices = new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,0, 9,9,9]);
    g.Normals = new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1]);
    g.TVertices = [new Float32Array([0,0, 1,0, 0,1, 0,0, 9,9]), new Float32Array([0,0, 2,0, 0,2, 0,0, 9,9])];
    g.VertexGroup = new Uint8Array(5); g.Faces = new Uint16Array([0,1,2, 3,2,1]);
    mutator?.(model);
  });
  return openDocument(doc.serialize('mdx'), 'fixture.mdx');
}

test('unused/exact duplicate records compact all streams; Apply is one undo step and disk size is exact', async () => {
  const doc = fixture(), original = doc.serialize('mdx'), model = structuredClone(doc.model), revision = doc.revision;
  const result = analyzeOptimization(doc);
  assert.equal(doc.revision, revision); assert.deepEqual(doc.serialize('mdx'), original);
  assert.equal(result.counts.unusedVertices, 1); assert.equal(result.counts.duplicateVertices, 1);
  assert.equal(result.saved, 82); assert.equal(result.canApply, true);
  applyOptimization(doc, result); assert.equal(doc.historyStats.undoSteps, 1);
  assert.equal(doc.model.Geosets[0].Vertices.length, 9); assert.equal(doc.model.Geosets[0].TVertices[1].length, 6);
  verifyOptimization(model, doc.model);
  const saved = doc.serialize('mdx'), reopened = openDocument(saved, 'optimized.mdx');
  assert.equal(saved.byteLength, result.after); assert.equal(analyzeOptimization(reopened).saved, 0);
  assert.deepEqual(reopened.serialize('mdx'), saved);
  const folder = await mkdtemp(path.join(tmpdir(), 'mdlxl-optimize-'));
  try { const file = path.join(folder, 'optimized.mdx'); await writeFile(file, saved); assert.equal((await stat(file)).size, result.after); assert.deepEqual(new Uint8Array(await readFile(file)), saved); }
  finally { await rm(folder, { recursive: true, force: true }); }
  doc.undo(); assert.deepEqual(doc.serialize('mdx'), original);
});

test('UV seams, normals and matrix group identity stay distinct; original repeated faces stay', () => {
  for (const kind of ['uv', 'normal', 'group', 'same-face']) {
    const doc = fixture(model => { const g = model.Geosets[0];
      if (kind === 'uv') g.TVertices[1][6] = .125;
      if (kind === 'normal') g.Normals[9] = 1;
      if (kind === 'group') { g.Groups.push([0]); g.TotalGroupsCount++; g.VertexGroup[3] = 1; }
      if (kind === 'same-face') g.Faces = new Uint16Array([0,3,1, 0,0,2]);
    });
    const original = structuredClone(doc.model), result = analyzeOptimization(doc);
    assert.equal(result.counts.duplicateVertices, 0, kind); applyOptimization(doc, result);
    verifyOptimization(original, doc.model);
    if (kind === 'same-face') { assert.notEqual(doc.model.Geosets[0].Faces[0], doc.model.Geosets[0].Faces[1]); assert.equal(doc.model.Geosets[0].Faces[3], doc.model.Geosets[0].Faces[4]); }
  }
});

test('only constant disjoint local bone/helper transform interior keys are removed', () => {
  const doc = fixture(model => {
    model.Sequences = [{ Name:'Stand', Interval:new Uint32Array([0,100]), MinimumExtent:new Float32Array(3), MaximumExtent:new Float32Array(3), BoundsRadius:0, MoveSpeed:0, NonLooping:false, Rarity:0 }];
    model.Bones[0].Translation = track([0,20,40,60,100,200]);
    model.Bones[0].Rotation = track([0,20,40,100], [0,0,0,1]);
    const helper = createNode(model, 'Helper'); helper.Scaling = track([0,20,40,100], [1,1,1], { LineType:0 });
  });
  const original = structuredClone(doc.model), result = analyzeOptimization(doc);
  assert.equal(result.counts.transformKeys, 7); applyOptimization(doc, result);
  assert.deepEqual(doc.model.Bones[0].Translation.Keys.map(k=>k.Frame), [0,100,200]);
  verifyTransformReduction(original, doc.model, original.Sequences);
  const broken = structuredClone(doc.model); broken.Bones[0].Translation.Keys.shift();
  assert.throws(()=>verifyTransformReduction(original, broken, original.Sequences), /proven redundant/);
});

test('global, spline, overlapping, duplicate timestamps, color, visibility and events are retained', () => {
  const doc = fixture(model => {
    model.Sequences = [{ Name:'One', Interval:new Uint32Array([0,100]), MinimumExtent:new Float32Array(3), MaximumExtent:new Float32Array(3), BoundsRadius:0, MoveSpeed:0, NonLooping:false, Rarity:0 }, { Name:'Overlap', Interval:new Uint32Array([50,150]), MinimumExtent:new Float32Array(3), MaximumExtent:new Float32Array(3), BoundsRadius:0, MoveSpeed:0, NonLooping:false, Rarity:0 }];
    model.GlobalSequences = [100];
    model.Bones[0].Translation = track([0,20,40,100], [1,2,3], { GlobalSeqId:0 });
    model.Bones[0].Scaling = track([0,20,40,100], [1,1,1]);
    model.Bones[0].Rotation = track([0,20,40,100], [0,0,0,1], { LineType:2 });
    model.Bones[0].Rotation.Keys.forEach(key => { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); });
    createNode(model,'Helper').Translation = track([0,20,20,100]);
    const emitter = createNode(model,'ParticleEmitter2'); emitter.Visibility = track([0,20,40,100], [1], {LineType:0});
    const event = createNode(model,'EventObject'); event.EventTrack = new Uint32Array([0,20,40,100]);
    model.GeosetAnims.push({GeosetId:0, Flags:2, Alpha:1, Color:track([0,20,40,100], [.9,.2,.1])});
  });
  const original = structuredClone(doc.model), result = analyzeOptimization(doc);
  assert.equal(result.counts.transformKeys, 0); assert.ok(result.skipped.length); applyOptimization(doc,result);
  verifyOptimization(original, doc.model);
});

test('resource cleanup retains animated ID zero, particles and ribbons, remapping exact textures only', () => {
  const doc = fixture(model => {
    model.Textures = [{Image:'unused.blp',ReplaceableId:0,Flags:0}, {Image:'live.blp',ReplaceableId:0,Flags:0}, {Image:'live.blp',ReplaceableId:0,Flags:0}, {Image:'effect.blp',ReplaceableId:0,Flags:0}, {Image:'live.blp',ReplaceableId:0,Flags:1}];
    model.Materials.push(structuredClone(model.Materials[0]), structuredClone(model.Materials[0]));
    model.Geosets[0].MaterialID = 1; model.Materials[1].Layers[0].TextureID = track([0,10,20], [1], {LineType:0});
    model.Materials[1].Layers[0].TextureID.Keys[1].Vector = new Int32Array([2]); model.Materials[1].Layers[0].TextureID.Keys[2].Vector = new Int32Array([0]);
    const particle = createNode(model,'ParticleEmitter2'); particle.TextureID = 3;
    const ribbon = createNode(model,'RibbonEmitter'); ribbon.MaterialID = 2; model.Materials[2].Layers[0].TextureID = 4;
  });
  const original = structuredClone(doc.model), result = analyzeOptimization(doc);
  assert.equal(result.counts.materials,1); assert.equal(result.counts.textures,1); applyOptimization(doc,result);
  assert.equal(doc.model.Geosets[0].MaterialID,0); assert.equal(doc.model.RibbonEmitters[0].MaterialID,1);
  assert.deepEqual(doc.model.Materials[0].Layers[0].TextureID.Keys.map(key=>key.Vector[0]), [1,1,0]);
  assert.equal(doc.model.ParticleEmitters2[0].TextureID,2); assert.equal(doc.model.Textures[3].Flags,1);
  verifyOptimization(original,doc.model);
});

test('MDL compares serialized MDX and refuses stale analysis, unknown chunks and unsupported input', () => {
  const fixtureDoc = fixture(), mdl = openDocument(fixtureDoc.serialize('mdl'),'fixture.mdl'), result = analyzeOptimization(mdl);
  assert.equal(result.before, mdl.serialize('mdx').byteLength); assert.equal(result.originalFormat,'mdl');
  mdl.apply('Rename', ['Info'], model=>{model.Info.Name='Changed';});
  assert.throws(()=>applyOptimization(mdl,result), /changed after analysis/);
  const bytes=fixtureDoc.serialize('mdx'), withUnknown=new Uint8Array(bytes.length+8);withUnknown.set(bytes);withUnknown.set(new TextEncoder().encode('TEST'),bytes.length);
  assert.throws(()=>analyzeOptimization(openDocument(withUnknown,'unknown.mdx')), /unknown source sections/);
  assert.throws(()=>analyzeOptimization(createStarterDocument(1000)), /version 800/);
  const ready=analyzeOptimization(createStarterDocument());assert.equal(ready.canApply,false);assert.equal(ready.message,'No safe size reduction found.');
});
