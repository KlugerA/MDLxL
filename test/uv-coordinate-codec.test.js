import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';

test('several UV sets in multiple geosets survive MDL to MDX to MDL without losing streams', () => {
  const doc = createDemoDocument();
  doc.apply('Additional UV maps', ['Geosets'], model => {
    for (const index of [0, 2]) {
      const geoset = model.Geosets[index];
      for (const scale of [.125, -.75]) geoset.TVertices.push(new Float32Array(Array.from(geoset.TVertices[0], value => value * scale)));
    }
  });
  const original = structuredClone(doc.model.Geosets.map(geoset => geoset.TVertices));
  const mdl = openDocument(doc.serialize('mdl'), 'uv.mdl');
  const mdx = openDocument(mdl.serialize('mdx'), 'uv.mdx');
  const again = openDocument(mdx.serialize('mdl'), 'again.mdl');
  for (const reopened of [mdl, mdx, again]) {
    assert.equal(reopened.readOnly, false);
    assert.deepEqual(reopened.model.Geosets.map(geoset => geoset.TVertices), original);
    assert.equal(reopened.diagnostics.filter(item => item.severity === 'error').length, 0);
  }
  mdl.apply('UV edit after reopen', ['Geosets'], model => { model.Geosets[2].TVertices[2][0] = .33333334; });
  const edited = openDocument(mdl.serialize('mdl'), 'edited.mdl');
  assert.deepEqual(edited.model.Geosets[2].TVertices, mdl.model.Geosets[2].TVertices);
});

test('default and explicit-zero ParticleEmitter2 fields survive MDL reopening then MDX export', () => {
  const doc = createDemoDocument();
  const emitter = doc.apply('Add emitter', ['Nodes', 'PivotPoints'], model => createNode(model, 'ParticleEmitter2'));
  for (const zeroTimeAndLife of [false, true]) {
    if (zeroTimeAndLife) doc.apply('Zero timing', ['Nodes'], model => { model.Nodes[emitter.ObjectId].Time = 0; model.Nodes[emitter.ObjectId].LifeSpan = 0; });
    const mdl = openDocument(doc.serialize('mdl'), 'emitter.mdl');
    assert.equal(mdl.model.ParticleEmitters2[0].TailLength, 0);
    const mdx = openDocument(mdl.serialize('mdx'), 'emitter.mdx');
    assert.equal(mdx.readOnly, false);
    for (const field of ['TailLength', 'Time', 'LifeSpan', 'PriorityPlane', 'ReplaceableId', 'Rows', 'Columns']) {
      assert.equal(mdx.model.ParticleEmitters2[0][field], doc.model.ParticleEmitters2[0][field], field);
      assert.equal(Number.isFinite(mdx.model.ParticleEmitters2[0][field]), true, field);
    }
    assert.equal(mdx.diagnostics.filter(item => item.severity === 'error').length, 0);
  }
});
