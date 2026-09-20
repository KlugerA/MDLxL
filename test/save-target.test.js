import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareModelSave } from '../src/save-target.js';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument } from '../src/editor-document.js';

test('Save As selects actual bytes and extension for both model versions', () => {
  for (const version of [800, 1000]) {
    const doc = createStarterDocument(version);
    assert.equal(doc.format, 'mdx');
    for (const format of ['mdl', 'mdx']) {
      const saved = prepareModelSave(doc, format);
      assert.equal(saved.name, 'Untitled.' + format);
      const reopened = openDocument(saved.bytes, saved.name);
      assert.equal(reopened.version, version); assert.equal(reopened.format, format);
      if (version === 1000) assert.equal(reopened.model.Geosets[0].LevelOfDetail, 0);
    }
  }
});

test('Save As blocks opaque loss in both directions and keeps exact original saves', () => {
  const starter = createStarterDocument();
  const text = Buffer.concat([starter.serialize('mdl'), Buffer.from('\nFuture { Value 1, }')]);
  const chunk = Buffer.alloc(12); chunk.write('XTRA'); chunk.writeUInt32LE(4, 4); chunk.writeUInt32LE(42, 8);
  const binary = Buffer.concat([starter.serialize('mdx'), chunk]);
  for (const [bytes, format] of [[text, 'mdl'], [binary, 'mdx']]) {
    const doc = openDocument(bytes, 'future.' + format), before = structuredClone(doc.model);
    assert.throws(() => prepareModelSave(doc, format === 'mdx' ? 'mdl' : 'mdx'), /unrecognized source data/);
    assert.deepEqual(doc.model, before); assert.equal(doc.dirty, false);
    assert.deepEqual(Buffer.from(prepareModelSave(doc, format).bytes), bytes);
  }
});
