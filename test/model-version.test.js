import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, EditorDocument } from '../src/editor-document.js';

test('version conversion is atomic, undoable, recoverable and saves both formats',()=>{
  const doc=createStarterDocument(), original=structuredClone(doc.model);
  doc.convertVersion(1000); assert.equal(doc.version,1000);
  const restored=EditorDocument.restoreRecoveryState(doc.captureRecoveryState());assert.equal(restored.version,1000);
  for(const format of ['mdl','mdx']) {const reopen=openDocument(doc.serialize(format),'cube.'+format);assert.equal(reopen.version,1000);assert.deepEqual(reopen.model.Geosets[0].Vertices,original.Geosets[0].Vertices);}
  assert.equal(doc.undo(),true);assert.equal(doc.version,800);assert.deepEqual(doc.model,original);
  assert.equal(doc.redo(),true);doc.convertVersion(800);assert.equal(doc.version,800);assert.deepEqual(openDocument(doc.serialize('mdx'),'cube.mdx').model.Geosets[0].Faces,original.Geosets[0].Faces);
});
test('HD-only data blocks downgrade with unchanged data/history',()=>{
  const doc=createStarterDocument(1000);doc.apply('shader',['Materials'],m=>m.Materials[0].Shader='Shader_HD_DefaultUnit');
  const snapshot=structuredClone(doc.model), history=doc.historyStats.undoSteps;
  assert.throws(()=>doc.convertVersion(800),/shader/);assert.deepEqual(doc.model,snapshot);assert.equal(doc.historyStats.undoSteps,history);
});

test('upgraded geosets stay visible at LOD zero and late saves preserve current version',()=>{
  const doc=createStarterDocument(), pendingBytes=doc.serialize('mdx');
  doc.convertVersion(1000);
  let reopened=openDocument(doc.serialize('mdx'),'upgraded.mdx');
  assert.equal(reopened.model.Geosets[0].LevelOfDetail,0);
  doc.markSaved(pendingBytes,'saved.mdx');
  assert.equal(doc.version,1000);assert.equal(doc.model.Version,1000);assert.equal(doc.dirty,true);
  reopened=openDocument(doc.serialize('mdx'),'upgraded.mdx');assert.equal(reopened.version,1000);
  assert.equal(doc.undo(),true);assert.equal(doc.version,800);assert.equal(doc.dirty,false);
});
test('version conversion rejects unknown source data and arbitrary direct Version edits',()=>{
  const bytes=createStarterDocument().serialize('mdl'), doc=openDocument(new TextDecoder().decode(bytes)+'\nMystery { Value 1, }','unknown.mdl');
  assert.throws(()=>doc.convertVersion(1000),/Unrecognized/);assert.equal(doc.version,800);
  assert.throws(()=>doc.apply('unsafe',['Version'],m=>m.Version=1000),/Changing the model version/);assert.equal(doc.model.Version,800);
});
