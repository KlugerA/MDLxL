import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument, EditorDocument, deleteGeoset } from '../src/editor-document.js';
import { beginUVPreview, applyUVPreviews, revertUVPreviews, uvPreviewModel, restoreUVPreviews, validateUVPreview, captureUVPreviewGuard, validateUVPreviewGuard, getUVPreviewSelection, imageTextureLayers, chooseUVImageLayer } from '../src/uv-preview.js';

const asset = name => ({ name, bytes: new Uint8Array([1,2,3,4]) });
test('temporary material only paints chosen geoset, retaining shared animated materials and source model', () => {
  const {model} = createDemoDocument();
  model.Geosets[1].MaterialID = model.Geosets[0].MaterialID;
  const original = structuredClone(model);
  const drafts = beginUVPreview(model, {}, 0, asset('Textures\\Rust.blp'));
  const preview = uvPreviewModel(model, drafts);
  assert.deepEqual(model, original);
  assert.equal(preview.Geosets[1].MaterialID, original.Geosets[1].MaterialID);
  assert.notEqual(preview.Geosets[0].MaterialID, original.Geosets[0].MaterialID);
  assert.equal(preview.Textures.at(-1).Image, 'Textures\\Rust.blp');
  assert.deepEqual(preview.Materials[original.Geosets[0].MaterialID], original.Materials[original.Geosets[0].MaterialID]);
});
test('switching temporary textures retains the first snapshot, and Revert restores every UV set only', () => {
  const {model} = createDemoDocument(), originalUV = structuredClone(model.Geosets[0].TVertices);
  let drafts = beginUVPreview(model, {}, 0, asset('A.blp'));
  model.Geosets[0].TVertices[0][0] = 9;
  drafts = beginUVPreview(model, drafts, 0, asset('B.blp'));
  model.Info.Name = 'Unrelated edit';
  const originalMaterial = model.Geosets[0].MaterialID;
  revertUVPreviews(model, drafts);
  assert.deepEqual(model.Geosets[0].TVertices, originalUV);
  assert.equal(model.Geosets[0].MaterialID, originalMaterial);
  assert.equal(model.Info.Name, 'Unrelated edit');
});
test('multiple previews serialize and undo in one transaction, deduplicating case-insensitive paths', () => {
  const doc = createDemoDocument(), originalMaterials = doc.model.Materials.length, originalTextures = doc.model.Textures.length;
  let drafts = beginUVPreview(doc.model, {}, 0, asset('Textures\\Rust.blp'));
  drafts = beginUVPreview(doc.model, drafts, 1, asset('textures/rust.BLP'));
  doc.apply('Save UV previews', ['Geosets','Materials','Textures'], m => applyUVPreviews(m, drafts));
  assert.equal(doc.model.Materials.length, originalMaterials + 2);
  assert.equal(doc.model.Textures.length, originalTextures + 1);
  for (const format of ['mdl','mdx']) {
    const reopened = openDocument(doc.serialize(format), `memory.${format}`);
    assert.equal(reopened.model.Textures.at(-1).Image, 'Textures\\Rust.blp');
    assert.equal(reopened.model.Geosets[1].MaterialID, originalMaterials + 1);
    assert.equal(reopened.diagnostics.filter(d => d.severity === 'error').length, 0);
  }
  doc.undo(); assert.equal(doc.model.Materials.length, originalMaterials);
  assert.equal(doc.model.Textures.length, originalTextures);
});
test('staged model save leaves pending texture and UV recovery untouched when save is cancelled', () => {
  const doc = createDemoDocument(), original = structuredClone(doc.model);
  const pending = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  doc.apply('Move UV', ['Geosets'], m => { m.Geosets[0].TVertices[0][0] = .37; });
  const envelope = structuredClone({ state: doc.captureRecoveryState(), uvPreviews: pending });
  const staged = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({includeHistory:false}));
  staged.apply('Preview', ['Geosets','Materials','Textures'], m => applyUVPreviews(m,pending));
  const bytes = staged.serialize(); // Deliberately only in memory, like a cancelled save dialog.
  assert.ok(bytes.length);
  assert.deepEqual(doc.model.Materials, original.Materials);
  const restored = EditorDocument.restoreRecoveryState(envelope.state);
  const drafts = restoreUVPreviews(restored.model, envelope.uvPreviews);
  assert.equal(restored.model.Geosets[0].TVertices[0][0], Math.fround(.37));
  assert.deepEqual(drafts[0].asset.bytes, pending[0].asset.bytes);
  revertUVPreviews(restored.model, drafts);
  assert.deepEqual(restored.model.Geosets[0].TVertices, original.Geosets[0].TVertices);
});
test('live dragging changes only preview UV arrays and a topology mismatch cannot overwrite another mesh', () => {
  const {model} = createDemoDocument();
  const uv = new Float32Array(model.Geosets[0].TVertices[0]); uv[0] = 2;
  const preview = uvPreviewModel(model, {}, {geosetIndex:0,uvSet:0,values:uv});
  assert.equal(preview.Geosets[0].TVertices[0][0], 2);
  assert.notEqual(model.Geosets[0].TVertices[0][0], 2);
  assert.equal(preview.Geosets[1], model.Geosets[1]);
  const drafts = beginUVPreview(model, {}, 0, asset('Preview.blp'));
  model.Geosets[0].Faces = new Uint16Array();
  const materials = model.Materials.length;
  assert.throws(() => applyUVPreviews(model, drafts), /changed structure/);
  assert.throws(() => revertUVPreviews(model, drafts), /changed structure/);
  assert.equal(model.Materials.length, materials);
});
test('a staged preview save has identical bytes and a clean target baseline after commit', () => {
  const doc = createDemoDocument(), pending = beginUVPreview(doc.model, {}, 0, asset('SavedPreview.blp'));
  const staged = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({includeHistory:false}));
  staged.apply('Save preview', ['Geosets','Textures','Materials'], m => applyUVPreviews(m,pending));
  const savedBytes = staged.serialize('mdx');
  doc.apply('Save preview', ['Geosets','Textures','Materials'], m => applyUVPreviews(m,pending));
  const committedBytes = doc.serialize('mdx');
  assert.deepEqual(committedBytes, savedBytes);
  doc.markSaved(committedBytes, 'memory.mdx');
  assert.equal(doc.dirty, false);
  doc.undo(); assert.equal(doc.dirty, true);
  doc.redo(); assert.equal(doc.dirty, false);
});

test('deleting a geoset cannot redirect a pending preview to its identical-topology neighbor', () => {
  const {model} = createDemoDocument();
  model.Geosets[1] = structuredClone(model.Geosets[0]);
  model.Geosets[1].TVertices[0][0] = .731;
  const pending = beginUVPreview(model, {}, 0, asset('Preview.blp'));
  assert.equal(pending[0].geosetCount, model.Geosets.length);
  deleteGeoset(model, 0);
  const remaining = structuredClone(model.Geosets[0]);
  assert.throws(() => validateUVPreview(model, pending[0]), /changed structure/);
  assert.throws(() => revertUVPreviews(model, pending), /changed structure/);
  assert.throws(() => applyUVPreviews(model, pending), /changed structure/);
  assert.deepEqual(model.Geosets[0], remaining);
  assert.equal(uvPreviewModel(model, pending).Geosets[0], model.Geosets[0]);
});

test('temporary-preview guard permits normal edits and rejects equal-topology replacement atomically', () => {
  const doc = createDemoDocument(), pending = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  const guardedEdit = operation => {
    const before = captureUVPreviewGuard(doc.model, pending);
    return doc.apply('Guarded edit', ['Geosets'], model => {
      operation(model); validateUVPreviewGuard(model, pending, before);
    });
  };
  guardedEdit(model => { model.Geosets[0].TVertices[0][0] = .123; model.Geosets[0].Vertices[0] += 1; });
  const expected = structuredClone(doc.model), history = doc.historyStats.undoSteps;
  assert.throws(() => guardedEdit(model => { model.Geosets[0] = structuredClone(model.Geosets[0]); }), /Save or Revert/);
  assert.deepEqual(doc.model, expected);
  assert.equal(doc.historyStats.undoSteps, history);
  assert.throws(() => guardedEdit(model => { [model.Geosets[0], model.Geosets[1]] = [model.Geosets[1], model.Geosets[0]]; }), /Save or Revert/);
  assert.deepEqual(doc.model, expected);
  assert.throws(() => guardedEdit(model => { model.Geosets[0].Faces = model.Geosets[0].Faces.slice(3); }), /changed structure/);
  assert.deepEqual(doc.model, expected);
  assert.equal(doc.historyStats.undoSteps, history);
  assert.equal(captureUVPreviewGuard(doc.model, {}), null);
  assert.doesNotThrow(() => validateUVPreviewGuard({ Geosets: [] }, {}));
});

test('count snapshots detect undo and redo through geoset insertion or deletion', () => {
  const doc = createDemoDocument();
  doc.apply('Add geoset', ['Geosets'], model => { model.Geosets.push(structuredClone(model.Geosets[0])); });
  const afterInsert = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  doc.undo();
  assert.throws(() => validateUVPreviewGuard(doc.model, afterInsert), /changed structure/);
  doc.redo(); assert.doesNotThrow(() => validateUVPreviewGuard(doc.model, afterInsert));
  doc.apply('Delete geoset', ['Geosets', 'GeosetAnims'], model => deleteGeoset(model, model.Geosets.length - 1));
  const afterDelete = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  doc.undo();
  assert.throws(() => validateUVPreviewGuard(doc.model, afterDelete), /changed structure/);
  doc.redo(); assert.doesNotThrow(() => validateUVPreviewGuard(doc.model, afterDelete));
});

test('recovery retains mismatched previews so recovered undo can restore their geometry', () => {
  const doc = createDemoDocument(), pending = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  doc.apply('Delete triangle', ['Geosets'], model => { model.Geosets[0].Faces = model.Geosets[0].Faces.slice(3); });
  const restored = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
  const drafts = restoreUVPreviews(restored.model, pending);
  assert.deepEqual(drafts, pending);
  assert.notEqual(drafts[0].originalUV[0], pending[0].originalUV[0]);
  assert.throws(() => applyUVPreviews(restored.model, drafts), /changed structure/);
  assert.equal(uvPreviewModel(restored.model, drafts).Geosets[0], restored.model.Geosets[0]);
  restored.undo();
  assert.doesNotThrow(() => validateUVPreviewGuard(restored.model, drafts));
  revertUVPreviews(restored.model, drafts);
  assert.deepEqual(restored.model.Geosets[0].TVertices, pending[0].originalUV);
});

test('recovery retains a preview whose geoset was removed, including older drafts without count', () => {
  const doc = createDemoDocument(), last = doc.model.Geosets.length - 1;
  const pending = beginUVPreview(doc.model, {}, last, asset('Preview.blp'));
  doc.apply('Delete geoset', ['Geosets', 'GeosetAnims'], model => deleteGeoset(model, last));
  const restored = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
  const drafts = restoreUVPreviews(restored.model, pending);
  assert.throws(() => validateUVPreviewGuard(restored.model, drafts), /changed structure/);
  restored.undo(); assert.doesNotThrow(() => validateUVPreviewGuard(restored.model, drafts));
  delete drafts[last].geosetCount;
  const legacy = restoreUVPreviews(restored.model, drafts);
  assert.doesNotThrow(() => validateUVPreviewGuard(restored.model, legacy));
});

test('permissive recovery still rejects malformed snapshots, coordinates and texture bytes', () => {
  const {model} = createDemoDocument(), pending = beginUVPreview(model, {}, 0, asset('Preview.blp'));
  for (const corrupt of [
    draft => { draft.geosetIndex = -1; },
    draft => { draft.geosetCount = 0; },
    draft => { draft.vertexCount = 1.5; },
    draft => { draft.faces[0] = draft.vertexCount; },
    draft => { draft.originalUV[0][0] = NaN; },
    draft => { draft.originalUV[0] = null; },
    draft => { draft.asset.bytes = [1,2,3]; },
    draft => { draft.layerIndex = -1; },
    draft => { draft.layerIndex = 1.5; },
  ]) {
    const broken = structuredClone(pending); corrupt(broken[0]);
    assert.throws(() => restoreUVPreviews(model, broken), /Invalid cached/);
  }
});

function imageLayerDocument() {
  const doc=createDemoDocument(),model=doc.model;
  model.TextureAnims.push({});
  model.Textures.push({Image:'Textures\\Armor.blp',ReplaceableId:0,Flags:0},{Image:'Textures\\Trim.blp',ReplaceableId:0,Flags:3});
  model.Materials[0].Layers=[
    {TextureID:0,Alpha:1,FilterMode:0,Shading:16,CoordId:0,TVertexAnimId:null},
    {TextureID:1,Alpha:{LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([1])},{Frame:500,Vector:new Float32Array([.5])}]},FilterMode:1,Shading:16,CoordId:0,TVertexAnimId:0},
    {TextureID:2,Alpha:.8,FilterMode:2,Shading:17,CoordId:1,TVertexAnimId:null},
  ];
  model.Geosets[0].MaterialID=0;model.Geosets[1].MaterialID=0;model.Geosets[2].MaterialID=0;
  model.Geosets[0].TVertices.push(new Float32Array(model.Geosets[0].TVertices[0]));
  return doc;
}

test('preview eligibility follows checked geosets, rejects empty/mixed selection, and accepts one shared material',()=>{
  const {model}=imageLayerDocument();
  assert.equal(getUVPreviewSelection(model,[]).enabled,false);
  assert.match(getUVPreviewSelection(model,[]).reason,/Check one geoset/);
  assert.equal(getUVPreviewSelection(model,new Set([0,2])).enabled,true);
  assert.deepEqual(getUVPreviewSelection(model,[0,0,2]).geosetIndices,[0,2]);
  model.Geosets[2].MaterialID=1;
  assert.equal(getUVPreviewSelection(model,[0,2]).enabled,false);
  assert.match(getUVPreviewSelection(model,[0,2]).reason,/different materials/);
  const original=structuredClone(model),drafts={};
  assert.throws(()=>beginUVPreview(model,drafts,[0,2],asset('New.blp'),1),/different materials/);
  assert.throws(()=>beginUVPreview(model,drafts,[],asset('New.blp'),1),/Check one geoset/);
  assert.deepEqual(drafts,{});assert.deepEqual(model,original);
});

test('temporary image-layer replacement affects only checked geosets and retains team colour plus every other layer',()=>{
  const {model}=imageLayerDocument(),original=structuredClone(model);
  const drafts=beginUVPreview(model,{},[0,2],asset('Textures\\Rust.blp'),2);
  assert.deepEqual(Object.keys(drafts),['0','2']);assert.equal(drafts[0].layerIndex,2);
  const preview=uvPreviewModel(model,drafts);
  assert.equal(preview.Geosets[0].MaterialID,preview.Geosets[2].MaterialID);
  for(const index of [0,2]){
    const layers=preview.Materials[preview.Geosets[index].MaterialID].Layers;
    assert.equal(layers.length,3);
    assert.deepEqual(layers[0],original.Materials[0].Layers[0]);
    assert.deepEqual(layers[1],original.Materials[0].Layers[1]);
    assert.equal(preview.Textures[layers[2].TextureID].Image,'Textures\\Rust.blp');
    assert.deepEqual({...layers[2],TextureID:2},original.Materials[0].Layers[2]);
  }
  assert.equal(preview.Geosets[1],model.Geosets[1]);assert.equal(preview.Geosets[1].MaterialID,0);
  assert.deepEqual(preview.Materials[0],original.Materials[0]);assert.deepEqual(model,original);
});

test('UV image chooser skips replaceable layers and samples individual texture animation keys',()=>{
  const {model}=imageLayerDocument();
  assert.deepEqual(imageTextureLayers(model,0).map(layer=>layer.layerIndex),[1,2]);
  assert.equal(chooseUVImageLayer(model,0,0).layerIndex,1);
  assert.equal(chooseUVImageLayer(model,0,2).coordId,1);
  assert.equal(chooseUVImageLayer(model,0,2).path,'Textures\\Trim.blp');
  model.Materials[0].Layers[1].TextureID={LineType:0,Keys:[{Frame:0,Vector:new Uint32Array([1])},{Frame:400,Vector:new Uint32Array([0])},{Frame:600,Vector:new Uint32Array([2])}]};
  assert.equal(chooseUVImageLayer(model,0,1,200).path,'Textures\\Armor.blp');
  assert.equal(chooseUVImageLayer(model,0,1,450).layerIndex,2);
  assert.equal(chooseUVImageLayer(model,0,1,700).path,'Textures\\Trim.blp');
  assert.throws(()=>beginUVPreview(model,{},[0],asset('New.blp'),0),/Replaceable and team-colour layers are preserved/);
});

test('a replaceable-only material receives a new image layer instead of losing team colour',()=>{
  const {model}=createDemoDocument(),original=structuredClone(model.Materials[0].Layers);
  const pending=beginUVPreview(model,{},[0],asset('New.blp'));
  assert.equal(pending[0].layerIndex,original.length);
  const preview=uvPreviewModel(model,pending),layers=preview.Materials[preview.Geosets[0].MaterialID].Layers;
  assert.deepEqual(layers.slice(0,original.length),original);
  assert.equal(layers.length,original.length+1);assert.equal(layers.at(-1).FilterMode,1);
  assert.equal(chooseUVImageLayer(preview,0).path,'New.blp');
});

test('checked preview switches retain first UV snapshots through recovery and commit the chosen layer only',()=>{
  const doc=imageLayerDocument(),model=doc.model,original=structuredClone(model);
  let drafts=beginUVPreview(model,{},[0,2],asset('First.blp'),1);
  model.Geosets[0].TVertices[0][0]=.73;model.Geosets[2].TVertices[0][0]=.42;
  drafts=beginUVPreview(model,drafts,[0,2],asset('Second.blp'),2);
  const restored=restoreUVPreviews(model,structuredClone(drafts));
  assert.equal(restored[0].layerIndex,2);assert.deepEqual(restored[0].originalUV,original.Geosets[0].TVertices);
  const reverted=structuredClone(model);revertUVPreviews(reverted,restored);
  for(const index of [0,2])assert.deepEqual(reverted.Geosets[index].TVertices,original.Geosets[index].TVertices);
  assert.deepEqual(reverted.Materials,original.Materials);assert.deepEqual(reverted.Textures,original.Textures);
  doc.apply('Save checked previews',['Geosets','Materials','Textures'],m=>applyUVPreviews(m,restored));
  assert.equal(model.Geosets[1].MaterialID,0);
  assert.equal(model.Geosets[0].MaterialID,model.Geosets[2].MaterialID);
  assert.equal(getUVPreviewSelection(model,[0,2]).enabled,true);
  for(const index of [0,2]){
    const layers=model.Materials[model.Geosets[index].MaterialID].Layers;
    assert.deepEqual(layers[0],original.Materials[0].Layers[0]);assert.deepEqual(layers[1],original.Materials[0].Layers[1]);
    assert.equal(model.Textures[layers[2].TextureID].Image,'Second.blp');
  }
});
