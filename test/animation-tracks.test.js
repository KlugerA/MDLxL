import test from 'node:test';
import assert from 'node:assert/strict';
import {
  animationTargets, readAnimationTrack, setAnimationKey, setAnimationSequences, deleteAnimationKey,
  parseAnimationTrackText, formatAnimationTrackText, bakeAnimationTracks, collectAnimationKeyframes,
  sampleAnimationProperty, updateAnimationKey,
} from '../src/animation-tracks.js';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { rgbToWarcraftColor } from '../src/warcraft-color.js';

const geo = (id = 0, property = 'Alpha') => ({ kind: 'geoset', id, property });
const key = (Frame, ...Vector) => ({ Frame, Vector: new Float32Array(Vector) });
function fixture() {
  return {
    Info: {}, Geosets: [{}, {}, {}], GeosetAnims: [
      { GeosetId: 0, Flags: 1, Alpha: 0.4, Color: rgbToWarcraftColor([0.2, 0.3, 0.4]) },
      { GeosetId: 1, Flags: 0, Alpha: { LineType: 0, GlobalSeqId: null, Keys: [key(100, 1), key(160, 0), key(1000, 0.7)] }, Color: null },
    ],
    Sequences: [{ Name: 'Stand', Interval: new Uint32Array([100, 200]) }, { Name: 'Attack', Interval: new Uint32Array([1000, 1300]) }],
    GlobalSequences: [500], Bones: [{ ObjectId: 0, Name: 'Bone' }],
    Lights: [{ ObjectId: 1, Name: 'Light', Color: rgbToWarcraftColor([1, 0, 0]) }],
    ParticleEmitters2: [{ ObjectId: 2, Name: 'Sparks', SegmentColor: [new Float32Array([1, 0, 0])] }],
    Attachments: [{ ObjectId: 3, Name: 'Weapon' }], RibbonEmitters: [{ ObjectId: 4, Name: 'Trail', Color: new Float32Array([0, 0, 1]) }],
  };
}
const frames = track => track.Keys.map(k => k.Frame);
const close = (actual, expected) => { const a = typeof actual === 'number' ? [actual] : Array.from(actual), b = typeof expected === 'number' ? [expected] : expected; assert.equal(a.length, b.length); a.forEach((n, i) => assert.ok(Math.abs(n - b[i]) < 1e-6, `${n} differs from ${b[i]}`)); };

test('visibility key edits only selected geosets and preserve static values in other sequences', () => {
  const model = fixture(), untouched = structuredClone(model.GeosetAnims[1]);
  setAnimationKey(model, [geo()], 150, 0, 0);
  assert.equal(readAnimationTrack(model, geo()).LineType, 0);
  close(sampleAnimationProperty(model, geo(), 100, 0), 0.4);
  close(sampleAnimationProperty(model, geo(), 175, 0), 0);
  close(sampleAnimationProperty(model, geo(), 1200, 1), 0.4);
  assert.deepEqual(model.GeosetAnims[1], untouched);
  assert.equal(model.GeosetAnims[0].Flags, 1);
});

test('RGB keys expose human RGB while preserving Warcraft storage, shadow flag, and color enablement', () => {
  const model = fixture();
  model.GeosetAnims[0].Flags = 3;
  setAnimationKey(model, [geo(0, 'Color')], 150, [1, 0.1, 0.8], 0);
  assert.equal(model.GeosetAnims[0].Flags, 3);
  close(readAnimationTrack(model, geo(0, 'Color')).Keys.find(k => k.Frame === 150).Vector, [1, 0.1, 0.8]);
  close(model.GeosetAnims[0].Color.Keys.find(k => k.Frame === 150).Vector, rgbToWarcraftColor([1, 0.1, 0.8]));
  close(sampleAnimationProperty(model, geo(0, 'Color'), 1200, 1), [0.2, 0.3, 0.4]);
});

test('enabling a disabled tint does not activate stale cached RGB in other sequences', () => {
  const model = fixture();
  close(sampleAnimationProperty(model, geo(0, 'Color'), 100, 0), [1, 1, 1]);
  setAnimationKey(model, [geo(0, 'Color')], 150, [1, 0, 0], 0);
  close(sampleAnimationProperty(model, geo(0, 'Color'), 150, 0), [1, 0, 0]);
  close(sampleAnimationProperty(model, geo(0, 'Color'), 1000, 1), [1, 1, 1]);
});

test('Set All replaces keys inside all sequences only for selected targets and retains gap keys', () => {
  const model = fixture();
  model.GeosetAnims[1].Alpha.Keys.push(key(800, 0.2)); model.GeosetAnims[1].Alpha.Keys.sort((a, b) => a.Frame - b.Frame);
  const untouched = structuredClone(model.GeosetAnims[0]);
  setAnimationSequences(model, [geo(1)], 0.3);
  assert.deepEqual(frames(model.GeosetAnims[1].Alpha), [100, 200, 800, 1000, 1300]);
  close(model.GeosetAnims[1].Alpha.Keys[2].Vector, [0.2]);
  close(sampleAnimationProperty(model, geo(1), 160, 0), 0.3);
  close(sampleAnimationProperty(model, geo(1), 1200, 1), 0.3);
  assert.deepEqual(model.GeosetAnims[0], untouched);
});

test('RGB Set All affects all sequences of checked geosets without changing their visibility', () => {
  const model = fixture(), alphas = structuredClone(model.GeosetAnims.map(anim => anim.Alpha));
  const unrelated = structuredClone(model.GeosetAnims[1]);
  setAnimationSequences(model, [geo(0, 'Color'), geo(2, 'Color')], [0.8, 0.4, 0.1]);
  for (const id of [0, 2]) {
    const anim = model.GeosetAnims.find(item => item.GeosetId === id);
    assert.equal(anim.Flags & 2, 2);
    assert.deepEqual(frames(anim.Color), [100, 200, 1000, 1300]);
    for (const key of anim.Color.Keys) close(key.Vector, rgbToWarcraftColor([0.8, 0.4, 0.1]));
  }
  assert.deepEqual(model.GeosetAnims[0].Alpha, alphas[0]);
  assert.deepEqual(model.GeosetAnims[1], unrelated);
  assert.equal(model.GeosetAnims[2].Alpha, 1);
});

test('Set Sequence preserves all other sequence keys including their cubic tangents', () => {
  const model = fixture();
  const track = parseAnimationTrackText('100: 1\n200: 0\n1000: 0.8\n InTan: 0.2\n OutTan: -0.1\n1300: 0.6', { lineType: 2 });
  model.GeosetAnims[1].Alpha = track;
  const preserved = structuredClone(track.Keys.slice(2));
  setAnimationSequences(model, [geo(1)], 0.45, [0]);
  assert.deepEqual(model.GeosetAnims[1].Alpha.Keys.slice(2), preserved);
  close(sampleAnimationProperty(model, geo(1), 150, 0), 0.45);
});

test('multi-target validation prevents partial writes for dimension mismatch or missing targets', () => {
  const model = fixture(), before = structuredClone(model);
  assert.throws(() => setAnimationKey(model, [geo(2), geo(2, 'Color')], 100, 1, 0), /RGB/);
  assert.deepEqual(model, before);
  assert.throws(() => setAnimationKey(model, [geo(0), geo(99)], 100, 1, 0), /no longer/);
  assert.deepEqual(model, before);
  setAnimationKey(model, [geo(2)], 100, 0.5, 0);
  setAnimationKey(model, [geo(2, 'Color')], 100, [1, 0, 0], 0);
  assert.equal(model.GeosetAnims.filter(a => a.GeosetId === 2).length, 1);
  model.GeosetAnims.push(structuredClone(model.GeosetAnims[2]));
  assert.throws(() => setAnimationKey(model, [geo(2)], 100, 1, 0), /multiple geoset animations/);
});

test('Bake parses all pending text atomically and does not depend on currently selected target', () => {
  const model = fixture(), before = structuredClone(model);
  const drafts = [{ target: geo(2), text: '100: 0\n200: 1', lineType: 0 }, { target: geo(0, 'Color'), text: '100: 1, 0, nope', lineType: 1 }];
  assert.throws(() => bakeAnimationTracks(model, drafts), /Line 1/);
  assert.deepEqual(model, before);
  drafts[1].text = '100: 1, 0, 0\n200: 0, 0.2, 1';
  assert.equal(bakeAnimationTracks(model, drafts), 2);
  assert.deepEqual(frames(model.GeosetAnims.find(a => a.GeosetId === 2).Alpha), [100, 200]);
  close(model.GeosetAnims[0].Color.Keys[1].Vector, rgbToWarcraftColor([0, 0.2, 1]));
});

test('text parser validates duplicates, shape, ranges, times and timing, and preserves spline tangents', () => {
  for (const input of ['100: 0\n100: 1', '-1: 0', '1.2: 0', '100: NaN', '100: 2', '100: 0, 1', '', 'text']) assert.throws(() => parseAnimationTrackText(input));
  const text = '// RGB values\n200: { 0.1, 0.2, 0.3 },\n InTan: -1, 0, 2\n OutTan: 3, 2, 1\n100: 0.8, 0.7, 0.6 # earlier';
  const track = parseAnimationTrackText(text, { property: 'Color', lineType: 2 });
  assert.deepEqual(frames(track), [100, 200]);
  assert.deepEqual(Array.from(track.Keys[1].InTan), [-1, 0, 2]);
  const roundtrip = parseAnimationTrackText(formatAnimationTrackText(track), { property: 'Color', lineType: 2 });
  assert.deepEqual(roundtrip, track);
  assert.throws(() => parseAnimationTrackText('600: 1', { globalSeqId: 0, globalSequences: [500] }), /duration/);
  assert.throws(() => parseAnimationTrackText('100: 1', { globalSeqId: 2, globalSequences: [500] }), /existing global/);
});

test('global tracks keep their timing for frame edits and reject ambiguous sequence-wide changes', () => {
  const model = fixture();
  model.GeosetAnims[0].Alpha = { GlobalSeqId: 0, LineType: 0, Keys: [key(0, 1)] };
  setAnimationKey(model, [geo()], 1100, 0, 1);
  assert.deepEqual(frames(model.GeosetAnims[0].Alpha), [0, 100]);
  assert.equal(model.GeosetAnims[0].Alpha.GlobalSeqId, 0);
  const before = structuredClone(model);
  assert.throws(() => setAnimationSequences(model, [geo()], 1), /global sequence/);
  assert.deepEqual(model, before);
});

test('supported node channels exclude bone visibility and Particle2 lifecycle color', () => {
  const model = fixture(), targets = animationTargets(model, { nodeIds: [0, 1, 2, 3, 4], geosetIds: [0] });
  assert.equal(targets.some(t => t.kind === 'node' && t.id === 0), false);
  assert.deepEqual(targets.filter(t => t.kind === 'node' && t.id === 2).map(t => t.property), ['Visibility']);
  assert.ok(targets.some(t => t.id === 1 && t.property === 'AmbColor'));
  const light = targets.find(t => t.id === 1 && t.property === 'Color');
  setAnimationKey(model, [light], 150, [0.1, 0.4, 0.9], 0);
  close(model.Lights[0].Color.Keys.find(k => k.Frame === 150).Vector, rgbToWarcraftColor([0.1, 0.4, 0.9]));
  assert.equal(model.ParticleEmitters2[0].SegmentColor[0][0], 1);
});

test('keyframe list filters selected scope and active sequence; delete removes only the exact channel/key', () => {
  const model = fixture();
  setAnimationKey(model, [geo(1, 'Color')], 180, [1, 0, 0], 0);
  assert.deepEqual(collectAnimationKeyframes(model, { geosetIds: [1], sequenceIndex: 0 }), [100, 160, 180]);
  const alpha = structuredClone(model.GeosetAnims[1].Alpha);
  deleteAnimationKey(model, [geo(1, 'Color')], 180, 0);
  assert.deepEqual(model.GeosetAnims[1].Alpha, alpha);
  assert.deepEqual(collectAnimationKeyframes(model, { geosetIds: [1], sequenceIndex: 0 }), [100, 160]);
  assert.throws(() => setAnimationKey(model, [geo(0)], 500, 1, 0), /inside/);
});

test('Bake is one undoable edit and preserves RGB/visibility through in-memory MDL and MDX roundtrip', () => {
  const doc = createDemoDocument();
  const interval = doc.model.Sequences[0].Interval, start = interval[0], end = interval[1];
  let lightId, ribbonId, particleId;
  doc.apply('Synthetic nodes', ['Nodes'], model => {
    lightId = createNode(model, 'Light').ObjectId;
    ribbonId = createNode(model, 'RibbonEmitter').ObjectId;
    particleId = createNode(model, 'ParticleEmitter2').ObjectId;
  });
  const before = structuredClone(doc.model), count = doc.historyStats.undoSteps;
  const drafts = [
    { target: geo(0), text: `${start}: 1\n${end}: 0`, lineType: 0 },
    { target: geo(0, 'Color'), text: `${start}: 1, 0.2, 0.4\n${end}: 0.2, 0.5, 1`, lineType: 1 },
    { target: { kind: 'node', id: lightId, property: 'Color' }, text: `${start}: 0.1, 0.2, 0.8`, lineType: 1 },
    { target: { kind: 'node', id: ribbonId, property: 'Alpha' }, text: `${start}: 0.2\n${end}: 0.8`, lineType: 1 },
    { target: { kind: 'node', id: particleId, property: 'Visibility' }, text: `${start}: 0\n${end}: 1`, lineType: 0 },
  ];
  doc.apply('Bake', ['GeosetAnims', 'Nodes'], model => bakeAnimationTracks(model, drafts));
  assert.equal(doc.historyStats.undoSteps, count + 1);
  const baked = structuredClone(doc.model);
  doc.undo(); assert.deepEqual(doc.model, before);
  doc.redo(); assert.deepEqual(doc.model, baked);
  for (const format of ['mdl', 'mdx']) {
    const opened = openDocument(doc.serialize(format), `synthetic.${format}`);
    assert.equal(opened.readOnly, false);
    assert.deepEqual(opened.diagnostics.filter(d => d.severity === 'error'), []);
    close(readAnimationTrack(opened.model, geo(0, 'Color')).Keys[0].Vector, [1, 0.2, 0.4]);
    assert.equal(opened.model.GeosetAnims[0].Flags & 2, 2, `${format} must retain the enabled color`);
    close(readAnimationTrack(opened.model, { kind: 'node', id: lightId, property: 'Color' }).Keys[0].Vector, [0.1, 0.2, 0.8]);
    close(opened.model.RibbonEmitters.find(n => n.ObjectId === ribbonId).Alpha.Keys[0].Vector, [0.2]);
    assert.equal(opened.model.ParticleEmitters2.find(n => n.ObjectId === particleId).Visibility.Keys[0].Vector[0], 0);
  }
});

test('MDL conversion rejects disabled cached colors while MDX preserves them', () => {
  const doc = createDemoDocument();
  doc.apply('Static geoset tint', ['GeosetAnims'], model => {
    const anim = model.GeosetAnims[0]; anim.Color = rgbToWarcraftColor([0.2, 0.5, 0.8]); anim.Flags = 1;
  });
  assert.throws(() => doc.serialize('mdl'), /GeosetAnims\[0\]\.Color/);
  const mdx = openDocument(doc.serialize('mdx'), 'synthetic.mdx');
  assert.equal(mdx.model.GeosetAnims[0].Flags, 1);
  close(mdx.model.GeosetAnims[0].Color, rgbToWarcraftColor([0.2, 0.5, 0.8]));
  close(doc.model.GeosetAnims[0].Color, rgbToWarcraftColor([0.2, 0.5, 0.8]));
});

test('direct key edits retime one selected track, preserve cubic tangents, and reject collisions atomically', () => {
  const model = fixture();
  const original = parseAnimationTrackText('100: 0.2\n InTan: 0.1\n OutTan: 0.3\n160: 0.5\n1000: 0.7', { property: 'Alpha', lineType: 2 });
  model.GeosetAnims[1].Alpha = original;
  updateAnimationKey(model, geo(1), 100, 120, [0.8], 0);
  const changed = model.GeosetAnims[1].Alpha;
  assert.deepEqual(frames(changed), [120, 160, 1000]);
  close(changed.Keys[0].Vector, [0.8]);
  close(changed.Keys[0].InTan, [0.1]); close(changed.Keys[0].OutTan, [0.3]);
  assert.deepEqual(changed.Keys[2], original.Keys[2]);
  const before = structuredClone(model);
  assert.throws(() => updateAnimationKey(model, geo(1), 120, 160, [0.3], 0), /Another key/);
  assert.throws(() => updateAnimationKey(model, geo(1), 120, 800, [0.3], 0), /inside/);
  assert.throws(() => updateAnimationKey(model, geo(1), 120, 130, [2], 0), /between/);
  assert.deepEqual(model, before);
});

test('direct RGB key editing survives undo, redo, and MDL/MDX reopen', () => {
  const doc = createDemoDocument(), [start, end] = doc.model.Sequences[0].Interval;
  doc.apply('Create color keys', ['GeosetAnims'], m => setAnimationSequences(m, [geo(0, 'Color')], [0.2, 0.5, 0.8], [0]));
  const before = structuredClone(doc.model);
  const destination = Math.min(start + 1, end - 1);
  doc.apply('Edit color key', ['GeosetAnims'], m => updateAnimationKey(m, geo(0, 'Color'), start, destination, [0.8, 0.1, 0.3], 0));
  doc.undo(); assert.deepEqual(doc.model, before); doc.redo();
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `direct-key.${format}`);
    const track = readAnimationTrack(reopened.model, geo(0, 'Color'));
    assert.ok(!track.Keys.some(key => key.Frame === start));
    close(track.Keys.find(key => key.Frame === destination).Vector, [0.8, 0.1, 0.3]);
  }
});
