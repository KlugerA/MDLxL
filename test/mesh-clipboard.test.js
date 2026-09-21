import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMeshSelection } from '../src/mesh-clipboard.js';
import { createDemoDocument, importGeosets, openDocument } from '../src/editor-document.js';
import { addTriangle, transformVertices } from '../src/editor-commands.js';
import { SelectionHistory } from '../src/selection-history.js';

const sections = ['Geosets', 'Materials', 'Textures', 'Nodes', 'PivotPoints', 'GeosetAnims', 'GlobalSequences', 'TextureAnims'];
const ui = (selection, activeGeoset = Number(Object.keys(selection)[0])) => ({ selection, selectable: new Set(Object.keys(selection).map(Number)), hidden: {}, activeGeoset, uvSet: 0 });

test('copy retains a loose vertex and every SD/HD attribute without changing the source', () => {
  const { model } = createDemoDocument(), source = model.Geosets[0], count = source.Vertices.length / 3;
  source.TVertices.push(new Float32Array(Array.from({ length: count * 2 }, (_, index) => index / 19)));
  source.Tangents = new Float32Array(Array.from({ length: count }, (_, index) => [index, 1, 0, -1]).flat());
  source.SkinWeights = new Uint8Array(Array.from({ length: count }, () => [0, 1, 0, 0, 192, 63, 0, 0]).flat());
  const original = structuredClone(model), copied = captureMeshSelection(model, { 0: [3] }, new Set([0, 1]));
  assert.deepEqual(copied.indices, [0]); assert.equal(copied.vertexCount, 1); assert.equal(copied.triangleCount, 0);
  const geoset = copied.model.Geosets[0];
  for (const [name, stride] of [['Vertices', 3], ['Normals', 3], ['VertexGroup', 1], ['Tangents', 4], ['SkinWeights', 8]]) assert.deepEqual(geoset[name], source[name].slice(3 * stride, 4 * stride));
  source.TVertices.forEach((values, index) => assert.deepEqual(geoset.TVertices[index], values.slice(6, 8)));
  assert.equal(geoset.MaterialID, source.MaterialID); assert.deepEqual(geoset.Groups, source.Groups);
  assert.deepEqual(model, original);
  geoset.Vertices[0] += 70; geoset.TVertices[0][0] += 3;
  assert.deepEqual(model, original, 'clipboard arrays are independent');
});

test('triangle and patch copy keeps only complete selected topology and remaps its indices', () => {
  const { model } = createDemoDocument(), source = model.Geosets[0];
  for (const ids of [Array.from(source.Faces.slice(0, 3)), [...new Set(source.Faces.slice(0, 6))]]) {
    const copied = captureMeshSelection(model, { 0: ids }, new Set([0]));
    const kept = [...new Set(ids)].sort((a, b) => a - b), map = new Map(kept.map((id, index) => [id, index]));
    const expected = [];
    for (let offset = 0; offset < source.Faces.length; offset += 3) {
      const face = Array.from(source.Faces.slice(offset, offset + 3));
      if (face.every(id => map.has(id))) expected.push(...face.map(id => map.get(id)));
    }
    assert.deepEqual(Array.from(copied.model.Geosets[0].Faces), expected);
    assert.equal(copied.vertexCount, kept.length);
  }
});

test('an ineligible or stale vertex selection never expands to whole checked geosets', () => {
  const { model } = createDemoDocument();
  assert.deepEqual(captureMeshSelection(model, { 1: [0] }, new Set([0])).indices, []);
  assert.deepEqual(captureMeshSelection(model, { 0: [-1, 0.5, NaN, 99999] }, new Set([0])).indices, []);
  const whole = captureMeshSelection(model, {}, new Set([0, 2]));
  assert.deepEqual(whole.indices, [0, 2]);
  assert.deepEqual(whole.model.Geosets[0], model.Geosets[0]);
  assert.deepEqual(captureMeshSelection(model, {}, new Set()).indices, []);
});

test('paste selects loose new geometry, moves only the paste, and supports undo/redo plus MDL/MDX reload', () => {
  const doc = createDemoDocument(), original = structuredClone(doc.model), history = new SelectionHistory(doc);
  const before = ui({ 0: [0] }), copied = captureMeshSelection(doc.model, before.selection, before.selectable);
  const ticket = history.captureEdit(before);
  const result = doc.apply('Paste vertex', sections, model => importGeosets(model, copied.model, copied.indices));
  history.recordEdit(ticket, before);
  const index = result.geosetIndices[0], after = ui({ [index]: [0] }); history.settle(after);
  assert.equal(doc.model.Geosets[index].Vertices.length, 3); assert.equal(doc.model.Geosets[index].Faces.length, 0);
  const pasted = structuredClone(doc.model);
  assert.deepEqual(history.travel('undo', after), before); assert.deepEqual(doc.model, original);
  assert.deepEqual(history.travel('redo', before), after); assert.deepEqual(doc.model, pasted);
  doc.apply('Move paste', ['Geosets'], model => transformVertices(model.Geosets[index], [0], [4, 5, 6]));
  assert.deepEqual(doc.model.Geosets.slice(0, original.Geosets.length), pasted.Geosets.slice(0, original.Geosets.length));
  for (let gi = 0; gi < original.Geosets.length; gi++) for (const property of ['Vertices', 'Normals', 'Faces', 'TVertices', 'Groups', 'VertexGroup', 'MaterialID']) assert.deepEqual(doc.model.Geosets[gi][property], original.Geosets[gi][property]);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `loose.${format}`);
    assert.equal(reopened.diagnostics.filter(item => item.severity === 'error').length, 0);
    assert.deepEqual(reopened.model.Geosets[index].Vertices, doc.model.Geosets[index].Vertices);
    assert.equal(reopened.model.Geosets[index].Faces.length, 0);
    assert.deepEqual(reopened.model.Geosets[index].TVertices, doc.model.Geosets[index].TVertices);
  }
  doc.undo(); assert.deepEqual(doc.model, pasted); doc.redo();
});

test('same-model paste stays in a matching geoset and reuses its original bone attachments', () => {
  const doc = createDemoDocument(), sourceIndex = 4, before = structuredClone(doc.model);
  const copied = captureMeshSelection(doc.model, {}, new Set([sourceIndex]));
  const originalVertexCount = before.Geosets[sourceIndex].Vertices.length / 3;
  const result = doc.apply('Paste same geoset', sections, model => importGeosets(model, copied.model, copied.indices, null, { sameModel: true, targetGeoset: sourceIndex }));
  const pasted = doc.model.Geosets[sourceIndex], pastedVertices = result.selection[sourceIndex];

  assert.deepEqual(result.geosetIndices, [sourceIndex]);
  assert.deepEqual(pastedVertices, Array.from({ length: originalVertexCount }, (_, index) => originalVertexCount + index));
  assert.equal(doc.model.Geosets.length, before.Geosets.length);
  assert.equal(doc.model.GeosetAnims.length, before.GeosetAnims.length);
  assert.equal(doc.model.Materials.length, before.Materials.length);
  assert.equal(doc.model.Nodes.filter(Boolean).length, before.Nodes.filter(Boolean).length);
  assert.deepEqual(result.nodeMap, { 0: 0, 1: 1 });
  assert.deepEqual(pasted.Groups, before.Geosets[sourceIndex].Groups);
  assert.deepEqual(Array.from(pasted.Faces.slice(before.Geosets[sourceIndex].Faces.length)), Array.from(before.Geosets[sourceIndex].Faces, index => index + originalVertexCount));

  const originalVertices = pasted.Vertices.slice(0, originalVertexCount * 3);
  doc.apply('Move same-model paste', ['Geosets'], model => transformVertices(model.Geosets[sourceIndex], pastedVertices, [4, 5, 6]));
  assert.deepEqual(doc.model.Geosets[sourceIndex].Vertices.slice(0, originalVertexCount * 3), originalVertices);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `same-model.${format}`);
    assert.equal(reopened.diagnostics.filter(item => item.severity === 'error').length, 0);
    assert.equal(reopened.model.Geosets.length, before.Geosets.length);
    assert.equal(reopened.model.Nodes.filter(Boolean).length, before.Nodes.filter(Boolean).length);
    assert.deepEqual(reopened.model.Geosets[sourceIndex].Groups, before.Geosets[sourceIndex].Groups);
  }
});

test('same-model paste targets another selected geoset when the material matches', () => {
  const doc = createDemoDocument(), sourceIndex = 1, targetIndex = 3, before = structuredClone(doc.model);
  const copied = captureMeshSelection(doc.model, {}, new Set([sourceIndex]));
  const targetCount = before.Geosets[targetIndex].Vertices.length / 3;
  const result = doc.apply('Paste matching material', sections, model => importGeosets(model, copied.model, copied.indices, null, { sameModel: true, targetGeoset: targetIndex }));
  assert.deepEqual(result.geosetIndices, [targetIndex]);
  assert.deepEqual(result.selection[targetIndex], Array.from({ length: before.Geosets[sourceIndex].Vertices.length / 3 }, (_, index) => targetCount + index));
  assert.equal(doc.model.Geosets.length, before.Geosets.length);
  assert.equal(doc.model.Materials.length, before.Materials.length);
  assert.equal(doc.model.Nodes.filter(Boolean).length, before.Nodes.filter(Boolean).length);
  assert.deepEqual(doc.model.Geosets[targetIndex].Groups, before.Geosets[targetIndex].Groups);
});

test('three copied loose vertices make a valid T triangle and keep imported material/skin data', () => {
  const doc = createDemoDocument();
  // These positions are not one of the demo's original complete triangles.
  const copied = captureMeshSelection(doc.model, { 0: [0, 1, 4] }, new Set([0]));
  copied.model.Geosets[0].Faces = new Uint16Array();
  const result = doc.apply('Paste vertices', sections, model => importGeosets(model, copied.model, copied.indices));
  const index = result.geosetIndices[0], initial = structuredClone(doc.model);
  doc.apply('Create triangle', ['Geosets'], model => addTriangle(model.Geosets[index], [0, 1, 2]));
  assert.deepEqual(Array.from(doc.model.Geosets[index].Faces), [0, 1, 2]);
  const final = structuredClone(doc.model);
  doc.undo(); assert.deepEqual(doc.model, initial); doc.redo(); assert.deepEqual(doc.model, final);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `triangle.${format}`);
    assert.equal(reopened.diagnostics.filter(item => item.severity === 'error').length, 0);
    assert.deepEqual(reopened.model.Geosets[index].Faces, new Uint16Array([0, 1, 2]));
    assert.deepEqual(reopened.model.Geosets[index].VertexGroup, final.Geosets[index].VertexGroup);
    assert.deepEqual(reopened.model.Geosets[index].Groups, final.Geosets[index].Groups);
  }
});
