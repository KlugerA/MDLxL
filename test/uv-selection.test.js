import test from 'node:test';
import assert from 'node:assert/strict';
import { captureUVSelection, captureUVGeometryScope, matchesUVGeometryScope, eligibleUVVertices, eligibleUVFaces, restrictUVChange } from '../src/uv-selection.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

test('UV entry snapshots only selected eligible nonhidden vertices, independently of Show All visibility', () => {
  const { model } = createDemoDocument(), selection = { 0: [0, 1, 2, 2, -1, 0.5], 1: [0, 1] };
  const captured = captureUVSelection(model, selection, new Set([0]), { 0: [1] });
  assert.deepEqual(captured, { 0: [0, 2] });
  selection[0].length = 0;
  assert.deepEqual(captured, { 0: [0, 2] }, 'clearing current UV selection does not erase its eligible domain');
  assert.deepEqual(captureUVSelection(model, {}, new Set([0, 1])), {});
  assert.deepEqual(eligibleUVVertices(model.Geosets[0], [0], [], 99), []);
});

test('UV topology uses actual indices and includes only complete allowed triangles', () => {
  const geoset = { Vertices: new Float32Array(15), TVertices: [new Float32Array(10)], Faces: new Uint16Array([0, 1, 2, 0, 2, 3, 1, 3, 4]) };
  assert.deepEqual(eligibleUVFaces(geoset, [0, 1, 2]), [[0, 1, 2]]);
  assert.deepEqual(eligibleUVFaces(geoset, [0]), []);
  assert.deepEqual(eligibleUVFaces(geoset, [0, 1, 2, 3]), [[0, 1, 2], [0, 2, 3]]);
  geoset.TVertices[0][4] = NaN;
  assert.deepEqual(eligibleUVFaces(geoset, [0, 1, 2, 3]), []);
});

test('UV commits ignore unrelated coordinates and reject malformed inputs without mutating the geoset', () => {
  const { model } = createDemoDocument(), geoset = model.Geosets[0], original = structuredClone(geoset);
  const proposed = new Float32Array(geoset.TVertices[0]).fill(9);
  const next = restrictUVChange(geoset, 0, proposed, [1]);
  assert.deepEqual(next.slice(0, 2), geoset.TVertices[0].slice(0, 2));
  assert.deepEqual(next.slice(2, 4), new Float32Array([9, 9]));
  assert.deepEqual(next.slice(4), geoset.TVertices[0].slice(4));
  assert.deepEqual(restrictUVChange(geoset, 0, proposed, []), geoset.TVertices[0]);
  assert.throws(() => restrictUVChange(geoset, 0, [1, 2], [1]), /changed structure/);
  proposed[2] = Infinity; assert.throws(() => restrictUVChange(geoset, 0, proposed, [1]), /finite/);
  assert.deepEqual(geoset, original);
});

test('UV entry cannot redirect to an identical-topology replacement or remapped vertex stream', () => {
  const { model } = createDemoDocument(), geoset = model.Geosets[0], scope = captureUVGeometryScope(geoset);
  assert.equal(matchesUVGeometryScope(geoset, scope), true);
  geoset.TVertices[0][0] = .375;
  geoset.Vertices[0] += 4;
  assert.equal(matchesUVGeometryScope(geoset, scope), true, 'coordinate edits retain the UV domain');
  assert.equal(matchesUVGeometryScope(structuredClone(geoset), scope), false, 'equal topology is not identity');
  geoset.Faces[0] = geoset.Faces[1];
  assert.equal(matchesUVGeometryScope(geoset, scope), false);
  geoset.Faces[0] = scope.faces[0];
  assert.equal(matchesUVGeometryScope(geoset, scope), true);
  geoset.TVertices.push(new Float32Array(geoset.TVertices[0]));
  assert.equal(matchesUVGeometryScope(geoset, scope), false);
});

test('selection-only UV transforms preserve unrelated geosets and UV sets through undo/redo and save/reopen', () => {
  const doc = createDemoDocument();
  doc.apply('Add second UV set', ['Geosets'], model => model.Geosets[0].TVertices.push(new Float32Array(model.Geosets[0].TVertices[0])));
  const before = structuredClone(doc.model), proposed = new Float32Array(doc.model.Geosets[0].TVertices[1]);
  proposed[2] = .375; proposed[3] = .625; proposed[4] = 100;
  doc.apply('UV move', ['Geosets'], model => { model.Geosets[0].TVertices[1] = restrictUVChange(model.Geosets[0], 1, proposed, [1]); });
  const final = structuredClone(doc.model);
  assert.equal(final.Geosets[0].TVertices[1][4], before.Geosets[0].TVertices[1][4]);
  assert.deepEqual(final.Geosets[0].TVertices[0], before.Geosets[0].TVertices[0]);
  assert.deepEqual(final.Geosets.slice(1), before.Geosets.slice(1));
  doc.undo(); assert.deepEqual(doc.model, before); doc.redo(); assert.deepEqual(doc.model, final);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `uv.${format}`);
    assert.equal(reopened.diagnostics.filter(item => item.severity === 'error').length, 0);
    assert.deepEqual(reopened.model.Geosets[0].TVertices, final.Geosets[0].TVertices);
  }
});
