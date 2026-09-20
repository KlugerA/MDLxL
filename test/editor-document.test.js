import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'buffer';
import { parseMdx } from '../src/mdx-container.js';
import {
  openDocument, createDemoDocument, createNode, deleteNode, duplicateGeoset,
  deleteGeoset, importGeosets, validateModel, recalculateNormals,
  recalculateExtents, transformGeoset, scanMdlSections,
} from '../src/editor-document.js';

function chunk(tag, payload) {
  const header = Buffer.alloc(8); header.write(tag); header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}
function chunks(bytes) {
  const buffer = Buffer.from(bytes);
  return parseMdx(buffer).chunks.map((c) => ({ tag: c.tag, bytes: buffer.subarray(c.offset, c.payloadOffset + c.declaredSize) }));
}
function mdlSections(bytes) {
  const buffer = Buffer.from(bytes);
  return scanMdlSections(buffer).map((s) => ({ ...s, bytes: buffer.subarray(s.start, s.end) }));
}
const errors = (doc) => doc.diagnostics.filter((d) => d.severity === 'error');

test('original runeblade fixture opens editable and exports both formats with clean references', () => {
  const doc = createDemoDocument();
  assert.equal(doc.readOnly, false);
  assert.equal(doc.model.Geosets.length, 5);
  assert.equal(doc.model.Materials.length, 4);
  assert.equal(doc.model.Bones.length, 2);
  assert.equal(doc.model.Sequences[0].Name, 'Stand');
  assert.deepEqual(errors(doc), []);
  for (const format of ['mdl', 'mdx']) {
    const bytes = doc.serialize(format), opened = openDocument(bytes, `fixture.${format}`);
    assert.equal(opened.readOnly, false);
    assert.deepEqual(errors(opened), []);
    assert.deepEqual(opened.serialize(), bytes);
    assert.equal(opened.model.Bones[0].Translation.Keys[0].Frame, 0);
    assert.equal(opened.model.Geosets[4].Groups[0][0], 1);
  }
});

test('unchanged bytes include arbitrary comments, BOM, Unicode and Windows line endings', () => {
  const original = Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from('// 中文 × эльф\r\n'), Buffer.from(Buffer.from(createDemoDocument().serialize()).toString().replaceAll('\n', '\r\n'))]);
  const doc = openDocument(original, 'unicode.mdl');
  assert.equal(doc.readOnly, false);
  assert.deepEqual(Buffer.from(doc.serialize()), original);
  const returned = doc.originalBytes; returned[0] = 0;
  assert.deepEqual(Buffer.from(doc.serialize()), original);
});

test('MDX geoset edits preserve unknown chunks and every untouched known chunk exactly', () => {
  const canonical = Buffer.from(createDemoDocument().serialize('mdx'));
  const opaque = chunk('XTRA', Buffer.from([0, 255, 17, 50, 99, 0, 10]));
  const input = Buffer.concat([canonical.subarray(0, 16), opaque, canonical.subarray(16), chunk('JUNK', Buffer.from('future extension'))]);
  const doc = openDocument(input, 'future-data.mdx');
  assert.equal(doc.readOnly, false);
  doc.apply('Move blade', ['Geosets'], (model) => { model.Geosets[0].Vertices[0] += 13; });
  const output = doc.serialize(), before = chunks(input), after = chunks(output);
  assert.deepEqual(after.map((c) => c.tag), before.map((c) => c.tag));
  for (let i = 0; i < before.length; i++) if (before[i].tag !== 'GEOS') assert.deepEqual(after[i].bytes, before[i].bytes, before[i].tag);
  assert.notDeepEqual(after.find((c) => c.tag === 'GEOS').bytes, before.find((c) => c.tag === 'GEOS').bytes);
  assert.equal(openDocument(output).model.Geosets[0].Vertices[0], doc.model.Geosets[0].Vertices[0]);
  assert.deepEqual(doc.saveImpact().preservedUnknown, ['XTRA', 'JUNK']);
});

test('MDL material edits preserve unknown sections, comments and all other top-level bytes', () => {
  const unknown = 'ToolMetadata "λ" {\r\n Value "braces { } // in a string",\r\n /* hidden } */ Nested { Keep 42, }\r\n}\r\n';
  const source = Buffer.from('// leading comment\r\n' + unknown + Buffer.from(createDemoDocument().serialize()).toString() + '\r\n// trailing comment');
  const doc = openDocument(source, 'metadata.mdl');
  assert.equal(doc.readOnly, false);
  doc.apply('Layer alpha', ['Materials'], (m) => { m.Materials[0].Layers[0].Alpha = 0.4; });
  const result = Buffer.from(doc.serialize());
  assert.ok(result.includes(Buffer.from(unknown)));
  assert.ok(result.toString().startsWith('// leading comment\r\n'));
  assert.ok(result.toString().endsWith('// trailing comment'));
  const before = mdlSections(source).filter((s) => s.key !== 'Materials'), after = mdlSections(result).filter((s) => s.key !== 'Materials');
  assert.deepEqual(after.map((s) => s.bytes), before.map((s) => s.bytes));
  assert.equal(openDocument(result).model.Materials[0].Layers[0].Alpha, 0.4);
});

test('literal trailing path backslashes survive MDX-to-MDL conversion and surgical MDL edits', () => {
  for (const slashCount of [1, 2]) {
    const doc = createDemoDocument(), path = 'Textures' + '\\'.repeat(slashCount);
    doc.apply('Literal paths', ['Textures', 'Nodes'], (m) => { m.Textures[0].Image = path; m.Attachments[0].Path = path; });
    const binary = openDocument(doc.serialize('mdx'), 'path.mdx');
    const text = openDocument(binary.serialize('mdl'), 'path.mdl');
    assert.equal(text.readOnly, false);
    assert.equal(text.model.Textures[0].Image, path);
    assert.equal(text.model.Attachments[0].Path, path);
    const before = mdlSections(text.originalBytes).filter((s) => ['Textures', 'Attachments'].includes(s.key));
    text.apply('Edit unrelated material', ['Materials'], (m) => { m.Materials[0].PriorityPlane = 2; });
    const result = text.serialize();
    assert.deepEqual(mdlSections(result).filter((s) => ['Textures', 'Attachments'].includes(s.key)).map((s) => s.bytes), before.map((s) => s.bytes));
    assert.equal(openDocument(result).model.Textures[0].Image, path);
  }
});

test('unsupported escaped embedded quotes remain read-only and byte-preserved', () => {
  for (const text of ['Model "quoted \\" name" {}', 'Model "quoted \\"name\\"" {}']) {
    const source = Buffer.from(`Version { FormatVersion 800, }\n${text}`);
    const doc = openDocument(source);
    assert.equal(doc.readOnly, true);
    assert.deepEqual(Buffer.from(doc.serialize()), source);
  }
});

test('undo/redo retain typed arrays, shared node aliases, zero-frame keys and exact clean state', () => {
  const doc = createDemoDocument(), original = doc.serialize(), vertices = doc.model.Geosets[0].Vertices.slice();
  doc.apply('Adjust pivot and mesh', ['Geosets', 'PivotPoints'], (m) => { m.Geosets[0].Vertices[0] += 6; m.Nodes[0].PivotPoint[0] = 8; });
  assert.equal(doc.dirty, true);
  assert.equal(doc.model.PivotPoints[0][0], 8);
  assert.equal(doc.model.Bones[0], doc.model.Nodes[0]);
  assert.equal(doc.undo(), true);
  assert.equal(doc.dirty, false);
  assert.deepEqual(doc.serialize(), original);
  assert.ok(doc.model.Geosets[0].Vertices instanceof Float32Array);
  assert.ok(doc.model.Geosets[0].Faces instanceof Uint16Array);
  assert.deepEqual(doc.model.Geosets[0].Vertices, vertices);
  assert.equal(doc.model.Bones[0], doc.model.Nodes[0]);
  assert.equal(doc.model.Bones[0].Translation.Keys[0].Frame, 0);
  assert.equal(doc.redo(), true);
  assert.equal(doc.model.Geosets[0].Vertices[0], vertices[0] + 6);
  doc.undo(); doc.apply('Different edit', ['Materials'], (m) => { m.Materials[1].PriorityPlane = 3; });
  assert.equal(doc.canRedo, false);
});

test('zero-keyframe tracks survive unrelated edits and touched-node regeneration', () => {
  const doc = createDemoDocument();
  doc.apply('Add empty scaling track', ['Nodes'], (m) => { m.Bones[0].Scaling = { LineType: 1, GlobalSeqId: null, Keys: [] }; });
  const bytes = doc.serialize('mdx'); const loaded = openDocument(bytes);
  assert.equal(loaded.model.Bones[0].Scaling.Keys.length, 0);
  const boneChunk = chunks(bytes).find((c) => c.tag === 'BONE').bytes;
  loaded.apply('Texture wrap', ['Textures'], (m) => { m.Textures[0].Flags = 1; });
  assert.deepEqual(chunks(loaded.serialize()).find((c) => c.tag === 'BONE').bytes, boneChunk);
  loaded.apply('Rename node', ['Nodes'], (m) => { m.Bones[0].Name = 'Renamed'; });
  const reopened = openDocument(loaded.serialize());
  assert.equal(reopened.model.Bones[0].Scaling.Keys.length, 0);
  assert.equal(reopened.model.Bones[0].Translation.Keys[0].Frame, 0);
});

test('invalid parent cycles, dangling references and nonfinite geometry are rejected atomically', () => {
  const doc = createDemoDocument(), before = doc.serialize(), revision = doc.revision;
  assert.throws(() => doc.apply('Cycle', ['Nodes'], (m) => { m.Nodes[0].Parent = 1; }), /cycle/);
  assert.throws(() => doc.apply('Dangling', ['Nodes'], (m) => { m.Nodes[1].Parent = 9999; }), /missing parent/);
  assert.throws(() => doc.apply('Bad material', ['Geosets'], (m) => { m.Geosets[0].MaterialID = 500; }), /missing material/);
  assert.throws(() => doc.apply('NaN', ['Geosets'], (m) => { m.Geosets[0].Vertices[0] = NaN; }), /non-finite/);
  assert.deepEqual(doc.serialize(), before);
  assert.equal(doc.revision, revision);
  assert.equal(doc.canUndo, false);
});

test('inspector closures are undoable and mutator exceptions roll back partial edits', () => {
  const doc = createDemoDocument(), geoset = doc.model.Geosets[0];
  const original = geoset.Vertices[0];
  doc.apply('Closed-over vertex edit', ['Geosets'], () => { geoset.Vertices[0] += 12; });
  assert.equal(doc.dirty, true);
  assert.equal(doc.canUndo, true);
  doc.undo();
  assert.equal(doc.model.Geosets[0].Vertices[0], original);
  assert.throws(() => doc.apply('Partial failure', ['Geosets'], (m) => { m.Geosets[0].Vertices[0] += 90; throw new Error('failure'); }), /failure/);
  assert.equal(doc.model.Geosets[0].Vertices[0], original);
  assert.equal(doc.dirty, false);
});

test('deleteNode blocks weighted/matrix references and reparents children without renumbering', () => {
  const doc = createDemoDocument();
  assert.throws(() => doc.apply('Delete rig', ['Nodes'], (m) => deleteNode(m, 0)), /used by geoset/);
  doc.apply('Add helper chain', ['Nodes'], (m) => {
    const parent = createNode(m, 'Helper'); parent.Parent = 0;
    const child = createNode(m, 'Helper'); child.Parent = parent.ObjectId;
  });
  doc.apply('Remove helper', ['Nodes'], (m) => deleteNode(m, 3));
  assert.equal(doc.model.Nodes[4].Parent, 0);
  assert.equal(doc.model.Nodes[3], undefined);
  assert.equal(doc.model.Nodes[4].ObjectId, 4);
  for (const format of ['mdl', 'mdx']) {
    const loaded = openDocument(doc.serialize(format));
    assert.equal(loaded.readOnly, false);
    assert.equal(loaded.model.Nodes[3], undefined);
    assert.equal(loaded.model.Nodes[4].Parent, 0);
    assert.deepEqual(errors(loaded), []);
  }
});

test('all node editor types generate parseable MDL and MDX', () => {
  const doc = createDemoDocument();
  doc.apply('Add types', ['Nodes'], (m) => {
    for (const type of ['Bone', 'Helper', 'Attachment', 'ParticleEmitter2', 'RibbonEmitter', 'Light', 'EventObject', 'CollisionShape']) createNode(m, type);
  });
  for (const format of ['mdl', 'mdx']) {
    const loaded = openDocument(doc.serialize(format));
    assert.equal(loaded.readOnly, false, JSON.stringify(loaded.diagnostics));
    assert.equal(loaded.model.Nodes.filter(Boolean).length, 11);
    assert.deepEqual(errors(loaded), []);
  }
});

test('UI unset sentinels and static node visibility save without rebinding IDs or losing values', () => {
  const doc = createDemoDocument();
  doc.apply('Unset parent and UV animation', ['Nodes', 'Materials'], (m) => {
    delete m.Nodes[1].Parent;
    delete m.Materials[0].Layers[0].TVertexAnimId;
    m.Materials.push({ Layers: [{ TextureID: 0, Alpha: 1 }] });
    const ribbon = createNode(m, 'RibbonEmitter'); ribbon.Visibility = 0;
    const light = createNode(m, 'Light'); light.Visibility = 0.3;
  });
  const result = openDocument(doc.serialize('mdx'));
  assert.equal(result.readOnly, false);
  assert.equal(result.model.Nodes[1].Parent, null);
  assert.equal(result.model.Materials[0].Layers[0].TVertexAnimId, null);
  assert.equal(result.model.Materials[4].Layers[0].TVertexAnimId, null);
  assert.equal(result.model.RibbonEmitters[0].Visibility.Keys[0].Vector[0], 0);
  assert.ok(Math.abs(result.model.Lights[0].Visibility.Keys[0].Vector[0] - 0.3) < 1e-6);
  assert.deepEqual(errors(result), []);
});

test('exports block lossy strings and malformed keyframe widths instead of corrupting output', () => {
  const doc = createDemoDocument();
  assert.throws(() => doc.apply('Invalid quaternion', ['Nodes'], (m) => { m.Bones[0].Rotation.Keys[0].Vector = new Float32Array([0, 1, 0]); }), /4 values/);
  doc.apply('Unicode texture', ['Textures'], (m) => { m.Textures[0].Image = 'Textures\\ルーン.blp'; });
  assert.equal(doc.saveImpact('mdl').canSave, true);
  assert.equal(doc.saveImpact('mdx').canSave, false);
  assert.throws(() => doc.serialize('mdx'), /Unicode/);
  doc.undo();
  doc.apply('Long name', ['Nodes'], (m) => { m.Bones[0].Name = 'A'.repeat(81); });
  assert.equal(doc.saveImpact('mdx').canSave, false);
  assert.throws(() => doc.serialize('mdx'), /truncate/);
  doc.undo();
  doc.apply('Unsafe quote', ['Nodes'], (m) => { m.Bones[0].Name = 'My "bone"'; });
  assert.equal(doc.saveImpact('mdl').canSave, false);
  assert.throws(() => doc.serialize('mdl'), /quote/);
});

test('geoset duplicate/delete repair geoset-animation and bone references', () => {
  const doc = createDemoDocument();
  doc.apply('Assign bone', ['Nodes'], (m) => { m.Bones[0].GeosetId = 0; m.Bones[0].GeosetAnimId = 0; });
  doc.apply('Duplicate', ['Geosets'], (m) => duplicateGeoset(m, 0));
  assert.equal(doc.model.Geosets.length, 6);
  assert.equal(doc.model.GeosetAnims[5].GeosetId, 5);
  assert.equal(doc.model.Bones[0].GeosetId, null);
  doc.apply('Delete', ['Geosets'], (m) => deleteGeoset(m, 0));
  assert.equal(doc.model.GeosetAnims.length, 5);
  assert.equal(doc.model.GeosetAnims[4].GeosetId, 4);
  assert.equal(doc.model.Bones[0].GeosetAnimId, null);
  assert.deepEqual(errors(openDocument(doc.serialize('mdx'))), []);
});

test('rig-aware import maps ancestors, animated texture IDs, pivots and global sequences', () => {
  const source = createDemoDocument(), target = createDemoDocument();
  source.apply('Animated dependencies', ['Materials', 'GlobalSequences', 'Nodes'], (m) => {
    m.Textures.push({ Image: 'Textures\\Rune.blp', ReplaceableId: 0, Flags: 3 });
    m.GlobalSequences.push(500);
    m.Materials[3].Layers[0].TextureID = { LineType: 0, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Int32Array([1]) }, { Frame: 250, Vector: new Int32Array([0]) }] };
    m.Nodes[1].Translation = { LineType: 1, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Float32Array([0, 0, 0]) }] };
  });
  let imported;
  target.apply('Import rune', ['Geosets'], (m) => { imported = importGeosets(m, source.model, [4], 0); });
  const m = target.model, index = imported.geosetIndices[0], g = m.Geosets[index], rootID = imported.nodeMap[0], runeID = imported.nodeMap[1];
  assert.equal(m.Geosets.length, 6);
  assert.equal(m.Nodes[rootID].Parent, 0);
  assert.equal(m.Nodes[runeID].Parent, rootID);
  assert.equal(g.Groups[0][0], runeID);
  assert.deepEqual(m.PivotPoints[runeID], source.model.PivotPoints[1]);
  const layer = m.Materials[g.MaterialID].Layers[0];
  assert.equal(m.Textures[layer.TextureID.Keys[0].Vector[0]].Image, 'Textures\\Rune.blp');
  assert.equal(layer.TextureID.GlobalSeqId, m.Nodes[runeID].Translation.GlobalSeqId);
  assert.equal(m.GlobalSequences[layer.TextureID.GlobalSeqId], 500);
  assert.ok(target.saveImpact().changedSections.includes('GlobalSequences'));
  assert.deepEqual(errors(openDocument(target.serialize('mdx'))), []);
  assert.equal(source.model.Geosets.length, 5);
});

test('unsupported version 1200 and truncated input remain exact-copy read-only documents', () => {
  const canonical = Buffer.from(createDemoDocument().serialize('mdx'));
  canonical.writeUInt32LE(1200, 12);
  for (const bytes of [canonical, canonical.subarray(0, canonical.length - 7), Buffer.from('Version { FormatVersion 1200, }\nFuture { Keep 1, }')]) {
    const doc = openDocument(bytes);
    assert.equal(doc.readOnly, true);
    assert.deepEqual(Buffer.from(doc.serialize()), bytes);
    assert.throws(() => doc.apply('No downgrade', ['Version'], (m) => { m.Version = 800; }), /read-only/);
    assert.throws(() => doc.serialize(doc.format === 'mdx' ? 'mdl' : 'mdx'), /cannot be saved/);
  }
});

test('format conversion reports opaque-data loss and never silently changes version', () => {
  const doc = openDocument(Buffer.concat([Buffer.from(createDemoDocument().serialize('mdx')), chunk('XTRA', Buffer.from('editor metadata'))]));
  const impact = doc.saveImpact('mdl');
  assert.equal(impact.conversion, true);
  assert.equal(impact.exact, false);
  assert.equal(impact.canSave, true);
  assert.ok(impact.warnings.some((w) => /Unknown chunks/.test(w)));
  assert.deepEqual(impact.preservedUnknown, []);
  const converted = openDocument(doc.serialize('mdl'));
  assert.equal(converted.version, doc.version);
  assert.equal(converted.readOnly, false);
  assert.throws(() => doc.apply('Downgrade', ['Version'], (m) => { m.Version = 900; }), /version/);
});

test('markSaved establishes new exact baseline while undo remains available', () => {
  const doc = createDemoDocument();
  doc.apply('Alpha', ['Materials'], (m) => { m.Materials[0].Layers[0].Alpha = 0.25; });
  const saved = doc.serialize('mdx');
  doc.markSaved(saved, 'Saved.mdx');
  assert.equal(doc.name, 'Saved.mdx'); assert.equal(doc.format, 'mdx'); assert.equal(doc.dirty, false);
  assert.deepEqual(doc.serialize(), saved);
  doc.undo(); assert.equal(doc.dirty, true);
  assert.equal(openDocument(doc.serialize()).model.Materials[0].Layers[0].Alpha, 1);
  doc.redo(); assert.equal(doc.dirty, false);
  assert.deepEqual(doc.serialize(), saved);
});

test('an edit during asynchronous save remains dirty against the bytes that reached disk', () => {
  const doc = createDemoDocument();
  doc.apply('First edit', ['Materials'], (m) => { m.Materials[0].Layers[0].Alpha = 0.25; });
  const inFlight = doc.serialize('mdx');
  doc.apply('Edit while writing', ['Materials'], (m) => { m.Materials[0].Layers[0].Alpha = 0.75; });
  doc.markSaved(inFlight, 'Async.mdx');
  assert.equal(doc.dirty, true);
  assert.equal(doc.model.Materials[0].Layers[0].Alpha, 0.75);
  assert.equal(openDocument(doc.originalBytes).model.Materials[0].Layers[0].Alpha, 0.25);
  assert.equal(openDocument(doc.serialize()).model.Materials[0].Layers[0].Alpha, 0.75);
  doc.undo();
  assert.equal(doc.dirty, false);
  assert.deepEqual(doc.serialize(), inFlight);
});

test('normal recomputation and mirrored transforms keep winding consistent and values finite', () => {
  const g = { Vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), Faces: new Uint16Array([0, 1, 2]) };
  recalculateNormals(g);
  assert.deepEqual([...g.Normals], [0, 0, 1, 0, 0, 1, 0, 0, 1]);
  transformGeoset(g, { translation: [3, 4, 5], rotation: [0, 0, 90], scale: [-2, 1, 1] });
  assert.deepEqual([...g.Faces], [0, 2, 1]);
  assert.deepEqual([...g.Vertices.slice(0, 3)], [3, 4, 5]);
  assert.ok(g.Normals.every(Number.isFinite));
  assert.ok(g.MinimumExtent.every(Number.isFinite));
  assert.throws(() => transformGeoset(g, { scale: [0, 1, 1] }), /zero/);
});

test('bind-pose extent recalculation preserves authored animated extents', () => {
  const doc = createDemoDocument();
  const animationBounds = structuredClone(doc.model.Geosets[0].Anims), sequence = structuredClone(doc.model.Sequences[0]);
  doc.apply('Extents', ['Geosets', 'Model'], (m) => {
    transformGeoset(m.Geosets[0], { translation: [100, 0, 0] }); recalculateExtents(m);
  });
  assert.equal(doc.model.Geosets[0].MaximumExtent[0], 115);
  assert.equal(doc.model.Info.MaximumExtent[0], 115);
  assert.deepEqual(doc.model.Geosets[0].Anims, animationBounds);
  assert.deepEqual(doc.model.Sequences[0], sequence);
});

test('validator catches matrix, UV, animated texture and global sequence references', () => {
  const model = structuredClone(createDemoDocument().model);
  model.Geosets[0].Groups = [[987]];
  model.Geosets[0].TVertices[0] = new Float32Array([0, 0]);
  model.Materials[0].Layers[0].TextureID = { LineType: 0, GlobalSeqId: 88, Keys: [{ Frame: 0, Vector: new Int32Array([999]) }] };
  const codes = new Set(validateModel(model).map((d) => d.code));
  for (const code of ['BONE_REFERENCE', 'UV_COUNT', 'TEXTURE_REFERENCE', 'GLOBAL_SEQUENCE_REFERENCE']) assert.ok(codes.has(code));
});
