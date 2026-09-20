import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEventName, parseSlk, resolveEventDefinition, activeEventInstances, sampleEventDecal } from '../app/event-preview-data.js';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';

const slk = row => ['ID;PWXL;N;E', ...Object.keys(row).map((name, i) => `C;X${i + 1};Y1;K"${name}"`),
  ...Object.values(row).map((value, i) => `C;X${i + 1};Y2;K${typeof value === 'number' ? value : `"${value.replace(/"/g, '""')}"`}`), 'E'].join('\n');
// Minimal fields checked against the user's Warcraft SplatData.slk HBL0 row.
const blood = { Name: 'HBL0', file: 'Splat01Mature', Scale: 50, Rows: 16, Columns: 16, BlendMode: 0, Lifespan: 2, Decay: 120,
  UVLifespanStart: 0, UVLifespanEnd: 15, LifespanRepeat: 1, UVDecayStart: 15, UVDecayEnd: 15, DecayRepeat: 1,
  StartR: 200, StartG: 10, StartB: 10, StartA: 255, MiddleR: 190, MiddleG: 10, MiddleB: 10, MiddleA: 200, EndR: 120, EndG: 10, EndB: 10, EndA: 0 };

test('SLK cells retain omitted coordinates and correctly parse quoted semicolons and quotes', () => {
  const parsed = parseSlk('ID;PWXL;N;E\r\nC;X1;Y1;K"Name"\r\nC;X2;K"Model"\r\nC;X1;Y2;K"TEST"\r\nC;X2;K"name;with""quote.mdl"\r\nE');
  assert.equal(parsed.get('TEST').Model, 'name;with"quote.mdl');
});

test('actual Warcraft name conventions and data fields resolve real effects', () => {
  assert.deepEqual(parseEventName('FPTxHBL0'), { type: 'SPL', id: 'HBL0', tablePath: 'Splats\\SplatData.slk' });
  assert.equal(parseEventName('Point01'), null);
  const spawn = resolveEventDefinition('SPNxUEGG', { SPN: parseSlk(slk({ Name: 'UEGG', Model: 'Objects\\Spawnmodels\\Undead\\CryptFiendEggsack\\CryptFiendEggsack.mdl' })) });
  assert.equal(spawn.resourcePath, 'Objects\\Spawnmodels\\Undead\\CryptFiendEggsack\\CryptFiendEggsack.mdx');
  const definition = resolveEventDefinition('SPLxHBL0', { 'splats/splatdata.slk': slk(blood) });
  assert.equal(definition.lifeSpanMs, 122000); assert.equal(definition.scale, 50); assert.equal(definition.columns, 16);
  assert.equal(definition.resourcePath, 'ReplaceableTextures\\Splats\\Splat01Mature.blp');
  assert.deepEqual(definition.colors[0], [200 / 255, 10 / 255, 10 / 255, 1]);
  assert.equal(resolveEventDefinition('SPLxNOPE', { SPL: slk(blood) }), null, 'unknown event IDs must not become fake effects');
});

test('splat color/atlas and ubersplat birth/pause/decay sample directly at scrubbed time', () => {
  const definition = resolveEventDefinition('SPLxHBL0', { SPL: slk(blood) });
  const sample = sampleEventDecal(definition, 1000);
  assert.equal(sample.color[0], 195 / 255); assert.ok(Math.abs(sample.color[3] - (255 + 200) / 510) < 1e-10);
  assert.deepEqual(sample.uv, [7 / 16, 0, 8 / 16, 1 / 16]);
  assert.equal(sampleEventDecal(definition, 122000).color[3], 0);
  const uber = { type: 'UBR', intervalTimesMs: [1000, 2000, 1000], colors: [[1, 1, 1, 0], [1, 1, 1, 1], [1, 1, 1, 0]] };
  assert.equal(sampleEventDecal(uber, 500).color[3], 0.5);
  assert.equal(sampleEventDecal(uber, 2000).color[3], 1);
  assert.equal(sampleEventDecal(uber, 3500).color[3], 0.5);
});

test('local event preview is deterministic across scrubs, loops, pauses and animation changes', () => {
  const event = { ObjectId: 1, Name: 'SPNxTEST', EventTrack: new Uint32Array([100, 100, 150, 500]) };
  const model = { EventObjects: [event], Sequences: [{ Interval: [100, 300] }, { Interval: [500, 700] }] }, before = structuredClone(model);
  const definitions = new Map([[event.Name, { type: 'SPN', lifeSpanMs: 80 }]]);
  const sample = frame => activeEventInstances(model, definitions, { sequenceIndex: 0, frame });
  assert.equal(sample(99).length, 0);
  assert.equal(sample(100).length, 1, 'duplicate authored timestamps do not duplicate spawned objects');
  assert.deepEqual(sample(170).map(item => item.ageMs), [20, 70]);
  const paused = sample(170); assert.deepEqual(sample(170), paused);
  assert.equal(sample(230).length, 0);
  assert.equal(sample(100).length, 1, 'loop starts rebuild only its current effects');
  assert.equal(activeEventInstances(model, definitions, { sequenceIndex: 1, frame: 520 }).length, 1);
  assert.deepEqual(model, before);
});

test('global event zero uses independent clock and returns bounded living instances', () => {
  const event = { ObjectId: 1, Name: 'SPNxTEST', GlobalSeqId: 0, EventTrack: new Uint32Array([25]) };
  const model = { EventObjects: [event], GlobalSequences: [100] }, definitions = new Map([[event.Name, { type: 'SPN', lifeSpanMs: 250 }]]);
  const sample = activeEventInstances(model, definitions, { globalTime: 240, frame: 0 });
  assert.deepEqual(sample.map(item => item.ageMs), [15, 115, 215]);
  assert.equal(new Set(sample.map(item => item.key)).size, sample.length);
  assert.deepEqual(activeEventInstances(model, definitions, { globalTime: 240, frame: 500 }), sample);
  assert.equal(activeEventInstances(model, definitions, { globalTime: 100000, maxInstances: 2 }).length, 2);
});

test('global EventTrack fields load and persist through MDL/MDX conversion and node edits', () => {
  const doc = createDemoDocument(); let id;
  doc.apply('Add global event', ['Nodes', 'GlobalSequences', 'PivotPoints'], m => {
    m.GlobalSequences = [500]; const event = createNode(m, 'EventObject'); id = event.ObjectId;
    Object.assign(event, { Name: 'SPNxUEGG', GlobalSeqId: 0, EventTrack: new Uint32Array([25, 100]) });
  });
  for (const format of ['mdl', 'mdx']) {
    const serialized = doc.serialize(format), reopened = openDocument(serialized, `event-global.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.equal(reopened.model.EventObjects[0].GlobalSeqId, 0);
    assert.deepEqual([...reopened.model.EventObjects[0].EventTrack], [25, 100]);
    assert.deepEqual(reopened.serialize(format), serialized, 'untouched source bytes remain exact');
    reopened.apply('Rename event', ['Nodes'], m => { m.Nodes[id].Name = 'SPNxGCBL'; });
    for (const output of ['mdl', 'mdx']) {
      const converted = openDocument(reopened.serialize(output), `event-converted.${output}`);
      assert.equal(converted.model.EventObjects[0].GlobalSeqId, 0);
      assert.equal(converted.model.EventObjects[0].Name, 'SPNxGCBL');
    }
    reopened.undo(); assert.equal(reopened.model.EventObjects[0].Name, 'SPNxUEGG');
    reopened.redo(); assert.equal(reopened.model.EventObjects[0].GlobalSeqId, 0);
  }
});
