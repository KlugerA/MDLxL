import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForgeMesh, commitForge } from '../src/forge.js';
import { SHAPE_TOOLS, previewShape, resolveShapeSelection, shapeGeosets } from '../src/shaping.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

const setup = () => { const doc = createDemoDocument(), mesh = buildForgeMesh({ width: 16, height: 16, mask: new Uint8Array(256).fill(1), detail: 35, thickness: 1, trim: true }); const result = doc.apply('Forge', [], m => commitForge(m, mesh, { texturePath: 'test.tga' })); return { doc, indices: result.geosetIndices }; };
test('selection uses arbitrary checked geosets and only selected vertices when present', () => {
  const { doc } = setup();
  const selected = resolveShapeSelection(doc.model, new Set([0, 1]), { 0: [0, 1] }); assert.deepEqual(selected, { 0: [0, 1] });
  const all = resolveShapeSelection(doc.model, new Set([0, 1])); assert.equal(all[0].length, doc.model.Geosets[0].Vertices.length / 3); assert.equal(all[1].length, doc.model.Geosets[1].Vertices.length / 3);
});
test('all tools preview immutably, preserve UVs and rigging, and apply with undo', () => {
  for (const tool of SHAPE_TOOLS) {
    const { doc, indices } = setup(), before = structuredClone(doc.model), selection = resolveShapeSelection(doc.model, new Set(indices)), options = { tool, axis: tool === 'Dome' ? 2 : 1, amount: 45 };
    const preview = previewShape(doc.model, selection, options); assert.deepEqual(doc.model, before);
    assert.notDeepEqual(preview.Geosets[indices[0]].Vertices, before.Geosets[indices[0]].Vertices);
    doc.apply(tool, [], m => shapeGeosets(m, selection, options));
    for (const gi of indices) { assert.deepEqual(doc.model.Geosets[gi].Vertices, preview.Geosets[gi].Vertices); for (const field of ['TVertices', 'VertexGroup', 'Groups', 'Faces']) assert.deepEqual(doc.model.Geosets[gi][field], before.Geosets[gi][field]); }
    const reopen = openDocument(doc.serialize('mdx')); assert.deepEqual(reopen.diagnostics.filter(d => d.severity === 'error'), []);
    doc.undo(); assert.deepEqual(doc.model, before);
  }
});
test('zero amount is identity and invalid deformation cannot partially mutate a model', () => {
  const { doc, indices } = setup(), selection = resolveShapeSelection(doc.model, new Set(indices));
  for (const tool of SHAPE_TOOLS) { const result = previewShape(doc.model, selection, { tool, axis: 1, amount: 0 }); for (const gi of indices) assert.deepEqual(result.Geosets[gi].Vertices, doc.model.Geosets[gi].Vertices); }
  const before = structuredClone(doc.model); assert.throws(() => shapeGeosets(doc.model, selection, { tool: 'Taper', axis: 1, amount: -100 }), /collapsing/); assert.deepEqual(doc.model, before);
  assert.throws(() => shapeGeosets(doc.model, { [indices[0]]: [999999] }, { tool: 'Bend' }), /out of range/); assert.deepEqual(doc.model, before);
});
test('a partial vertex deformation keeps every unselected position exactly intact', () => {
  const { doc } = setup(), original = doc.model.Geosets[0].Vertices.slice();
  shapeGeosets(doc.model, { 0: [0, 1, 2] }, { tool: 'Dome', axis: 2, amount: 20 });
  assert.deepEqual(doc.model.Geosets[0].Vertices.slice(9), original.slice(9));
});
test('partial shaping keeps coincident UV and hard-normal seam copies together within the selected geoset',()=>{
  const {doc,indices}=setup(),gi=indices[1],g=doc.model.Geosets[gi],position=id=>Array.from(g.Vertices.slice(id*3,id*3+3)).join(','),groups=new Map();
  for(let id=0;id<g.Vertices.length/3;id++){const key=position(id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);}const copies=[...groups.values()].find(ids=>ids.length>1);
  assert.ok(copies?.length>1);const untouched=doc.model.Geosets[indices[0]].Vertices.slice();
  shapeGeosets(doc.model,{[gi]:[copies[0],0,1,2]},{tool:'Dome',axis:2,amount:20});
  assert.ok(copies.every(id=>position(id)===position(copies[0])));assert.deepEqual(doc.model.Geosets[indices[0]].Vertices,untouched);
});
