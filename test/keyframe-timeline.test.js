import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { rgbToWarcraftColor } from '../src/warcraft-color.js';
import {
  timelineTracks, timelineScope, timelineDomain, timelineReadTrack, timelineKeys, timelineSample,
  selectTimelineRange, copyTimelineKeys, copyTimelinePose, pasteTimelineKeys, pasteTimelinePose,
  setTimelineKeys, clearTimelineKeys, moveTimelineKeys, duplicateTimelineKeys,
  timelineMissingEndpoints, setTimelineBoundary, timelineSections,
} from '../src/keyframe-timeline.js';

const key = (Frame, Vector, curved = false) => ({ Frame, Vector: new Float32Array(Vector), ...(curved ? { InTan: new Float32Array(Vector.map(value => value + .25)), OutTan: new Float32Array(Vector.map(value => value - .25)) } : {}) });
const track = (Keys, LineType = 1, GlobalSeqId = null) => ({ Keys, LineType, GlobalSeqId });
const refs = (target, ...frames) => frames.map(frame => ({ trackId: target.trackId, frame }));
const close = (actual, expected) => Array.from(actual).forEach((number, i) => assert.ok(Math.abs(number - expected[i]) < 1e-5, `${number} != ${expected[i]}`));
function fixture() {
  const head = { ObjectId: 0, Name: 'Head', Rotation: track([key(1000, [0, 0, 0, 1]), key(1500, [0, 0, 1, 0]), key(3000, [0, 0, 0, 1])]), Translation: track([key(1000, [1, 2, 3], true), key(1200, [4, 5, 6], true), key(1400, [7, 8, 9], true), key(1500, [2, 3, 4], true), key(3000, [10, 20, 30], true)], 2) };
  return { Info: {}, Nodes: [head], Bones: [head, { ObjectId: 1, Name: 'Hand', Rotation: track([key(1200, [0, 0, 0, 1])]) }],
    Lights: [{ ObjectId: 2, Name: 'Light', Color: rgbToWarcraftColor([.2, .3, .4]), Visibility: track([key(0, [1]), key(500, [0])], 0, 0), Intensity: track([key(1000, [1])]) }],
    Geosets: [{}, {}], GeosetAnims: [{ GeosetId: 0, Flags: 3, Alpha: .4, Color: rgbToWarcraftColor([.1, .2, .3]) }],
    Sequences: [{ Name: 'Stand', Interval: new Uint32Array([1000, 2000]) }, { Name: 'Attack', Interval: new Uint32Array([3000, 4000]) }], GlobalSequences: [500, 800],
    Materials: [{ Layers: [{ Alpha: track([key(1000, [1])]) }] }],
  };
}
const find = (model, id, property, kind = 'node') => timelineTracks(model).find(target => target.kind === kind && target.id === id && target.property === property);

test('explicit controller and object scopes never broaden an empty selection; unsupported tracks are context only', () => {
  const model = fixture(), domain = timelineDomain(model, 0);
  assert.deepEqual(timelineScope(model, { scope: 'controller', domain }), []);
  assert.deepEqual(timelineScope(model, { scope: 'selected', domain }), []);
  const selected = timelineScope(model, { nodeIds: [0], activeController: 'rotate', domain });
  assert.equal(selected.length, 1); assert.equal(selected[0].property, 'Rotation');
  const all = timelineScope(model, { scope: 'all', domain });
  assert.ok(all.some(target => target.property === 'Intensity' && target.readOnly));
  assert.ok(all.some(target => target.kind === 'context' && target.readOnly));
  assert.ok(all.some(target => target.kind === 'geoset' && target.property === 'Color'));
  assert.throws(() => clearTimelineKeys(model, [], [], domain), /Select an object/);
  assert.throws(() => setTimelineKeys(model, all.filter(target => target.readOnly), 1200, domain), /read-only/);
});

test('inclusive range clear affects only selected controller and keeps all other tracks, metadata and sequences', () => {
  const model = fixture(), domain = timelineDomain(model, 0), target = find(model, 0, 'Translation'), before = structuredClone(model);
  const range = selectTimelineRange(model, [target], domain, 1200, 1400);
  assert.deepEqual(range.map(item => item.frame), [1200, 1400]);
  assert.equal(clearTimelineKeys(model, [target], range, domain), 2);
  assert.deepEqual(model.Bones[0].Translation.Keys.map(key => key.Frame), [1000, 1500, 3000]);
  assert.deepEqual(model.Bones[0].Rotation, before.Bones[0].Rotation);
  assert.deepEqual(model.Bones[1], before.Bones[1]);
  assert.deepEqual(model.Bones[0].Translation.Keys.at(-1), before.Bones[0].Translation.Keys.at(-1));
  assert.equal(model.Bones[0].Translation.LineType, 2);
});

test('Copy Keys at an unkeyed time is empty while Copy Pose samples quaternion interpolation and Set Key stays sparse', () => {
  const model = fixture(), domain = timelineDomain(model, 0), target = find(model, 0, 'Rotation');
  assert.equal(copyTimelineKeys(model, [target], refs(target, 1250), domain).count, 0);
  const pose = copyTimelinePose(model, [target], 1250, domain);
  close(pose.entries[0].value, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
  pasteTimelinePose(model, [target], pose, 1250, domain);
  close(timelineReadTrack(model, target).Keys.find(key => key.Frame === 1250).Vector, pose.entries[0].value);
  const scale = find(model, 0, 'Scaling'); setTimelineKeys(model, [scale], 1250, domain);
  assert.deepEqual(timelineReadTrack(model, scale).Keys.map(key => key.Frame), [1250]);
});

test('copy and duplicate preserve relative times, cubic tangents and arbitrary track metadata', () => {
  const model = fixture(), domain = timelineDomain(model, 0), target = find(model, 0, 'Translation');
  model.Bones[0].Translation.SourceHint = 'retained';
  const clipboard = copyTimelineKeys(model, [target], refs(target, 1200, 1400), domain, 1100);
  assert.equal(pasteTimelineKeys(model, [target], clipboard, 1600, domain), 2);
  const out = timelineReadTrack(model, target);
  assert.equal(out.SourceHint, 'retained'); assert.equal(out.LineType, 2); assert.equal(out.GlobalSeqId, null);
  for (const [source, destination] of [[1200, 1700], [1400, 1900]]) {
    const old = clipboard.entries[0].track.Keys.find(key => key.Frame === source), next = out.Keys.find(key => key.Frame === destination);
    assert.deepEqual(next, { ...old, Frame: destination });
  }
  duplicateTimelineKeys(model, [target], refs(target, 1000), 50, domain);
  assert.deepEqual(timelineReadTrack(model, target).Keys.find(key => key.Frame === 1050), { ...model.Bones[0].Translation.Keys[0], Frame: 1050 });
});

test('collisions and out of bounds abort the whole multi-track operation, explicit replace and merge behave predictably', () => {
  const model = fixture(), domain = timelineDomain(model, 0), translation = find(model, 0, 'Translation'), rotation = find(model, 0, 'Rotation');
  const targets = [translation, rotation], selected = [...refs(translation, 1200), ...refs(rotation, 1000)];
  const before = structuredClone(model);
  assert.throws(() => moveTimelineKeys(model, targets, selected, 200, domain), /already exists/);
  assert.deepEqual(model, before);
  assert.throws(() => moveTimelineKeys(model, targets, selected, 1500, domain), /inside/);
  assert.deepEqual(model, before);
  const clipboard = copyTimelineKeys(model, [translation], refs(translation, 1200), domain);
  assert.equal(pasteTimelineKeys(model, [translation], clipboard, 1400, domain, 'merge'), 0);
  assert.deepEqual(model, before);
  assert.equal(pasteTimelineKeys(model, [translation], clipboard, 1400, domain, 'replace'), 1);
  assert.deepEqual(model.Bones[0].Translation.Keys.find(key => key.Frame === 1400).Vector, clipboard.entries[0].track.Keys[0].Vector);
  assert.throws(() => moveTimelineKeys(model, targets, selected, 20, domain, 'merge'), /supports Reject or Replace/);
});

test('moving keys preserves their order and exact values while removing only selected source entries', () => {
  const model = fixture(), domain = timelineDomain(model, 0), target = find(model, 0, 'Translation');
  const selected = selectTimelineRange(model, [target], domain, 1000, 1400), originals = structuredClone(model.Bones[0].Translation.Keys.slice(0, 3));
  moveTimelineKeys(model, [target], selected, 30, domain);
  assert.deepEqual(model.Bones[0].Translation.Keys.slice(0, 3), originals.map(key => ({ ...key, Frame: key.Frame + 30 })));
});

test('global domains expose only authored times, preserve endpoint values and reject local/global clipboard mixing', () => {
  const model = fixture(), local = timelineDomain(model, 0), global = timelineDomain(model, 0, 0), target = find(model, 2, 'Visibility');
  assert.equal(timelineScope(model, { scope: 'all', domain: local }).some(row => row.trackId === target.trackId), false);
  assert.deepEqual(timelineKeys(model, [target], global).map(key => key.frame), [0, 500]);
  assert.deepEqual(timelineSample(model, target, 500, global), [0]);
  assert.throws(() => setTimelineKeys(model, [target], 1200, local), /own local or global/);
  const clipboard = copyTimelineKeys(model, [target], refs(target, 0), global);
  const localTarget = find(model, 0, 'Rotation');
  assert.throws(() => pasteTimelineKeys(model, [localTarget], clipboard, 1200, local), /timing differs/);
  moveTimelineKeys(model, [target], refs(target, 0), 20, global);
  assert.equal(timelineReadTrack(model, target).GlobalSeqId, 0);
});

test('endpoint helpers act only on the chosen tracks and matching a loop samples start without forcing sparse endpoints', () => {
  const model = fixture(), domain = timelineDomain(model, 0), target = find(model, 0, 'Rotation'), before = structuredClone(model.Bones[1]);
  assert.deepEqual(timelineMissingEndpoints(model, [target], domain).map(item => [item.start, item.end]), [[false, true]]);
  setTimelineBoundary(model, [target], domain, 'match');
  close(timelineReadTrack(model, target).Keys.find(key => key.Frame === 2000).Vector, [0, 0, 0, 1]);
  assert.deepEqual(timelineMissingEndpoints(model, [target], domain), []);
  assert.deepEqual(model.Bones[1], before);
});

test('RGB authoring enables tint, retains shadow flag, preserves other static sequence values and does not swap RGB', () => {
  const model = fixture(), domain = timelineDomain(model, 0), target = find(model, 0, 'Color', 'geoset');
  setTimelineKeys(model, [target], 1250, domain, { [target.trackId]: [1, .4, .2] });
  close(timelineReadTrack(model, target).Keys.find(key => key.Frame === 1250).Vector, [1, .4, .2]);
  close(timelineSample(model, target, 3500, timelineDomain(model, 1)), [.1, .2, .3]);
  assert.equal(model.GeosetAnims[0].Flags, 3);
  assert.equal(model.GeosetAnims[0].Alpha, .4);
  assert.throws(() => setTimelineKeys(model, [target], 1250, domain, { [target.trackId]: [255, 0, 0] }), /between 0 and 1/);
});

test('enabling disabled tint starts from visible white rather than stale animated RGB', () => {
  const model = fixture(), domain = timelineDomain(model, 0), target = find(model, 0, 'Color', 'geoset');
  model.GeosetAnims[0].Flags = 1; model.GeosetAnims[0].Color = track([key(1000, [1, 0, 0]), key(3000, [0, 1, 0])]);
  setTimelineKeys(model, [target], 1250, domain);
  close(timelineSample(model, target, 1250, domain), [1, 1, 1]);
  close(timelineSample(model, target, 3500, timelineDomain(model, 1)), [1, 1, 1]);
});

test('empty cleared tracks retain interpolation/global metadata for clipboard reuse', () => {
  const model = fixture(), domain = timelineDomain(model, 0, 0), target = find(model, 2, 'Visibility');
  const copied = copyTimelineKeys(model, [target], refs(target, 0, 500), domain);
  clearTimelineKeys(model, [target], refs(target, 0, 500), domain);
  assert.deepEqual(timelineReadTrack(model, target), { Keys: [], LineType: 0, GlobalSeqId: 0 });
  pasteTimelineKeys(model, [target], copied, 0, domain);
  assert.deepEqual(timelineReadTrack(model, target), copied.entries[0].track);
});

test('all supported track edits survive MDL and MDX reopening, with one-operation undo/redo preserving unrelated bytes', () => {
  const doc = createDemoDocument(), model = doc.model, domain = timelineDomain(model, 0), bone = find(model, model.Bones[0].ObjectId, 'Translation'), color = find(model, 0, 'Color', 'geoset');
  const before = structuredClone(model), original = Buffer.from(doc.serialize());
  const baseline = Object.fromEntries(['mdl', 'mdx'].map(format => [format, openDocument(doc.serialize(format), `baseline.${format}`).model]));
  const current = Math.round((domain.start + domain.end) / 2);
  doc.apply('Timeline set keyframes', timelineSections, model => setTimelineKeys(model, [bone, color], current, domain, { [bone.trackId]: [12, 23, 34], [color.trackId]: [.9, .4, .1] }));
  const after = structuredClone(doc.model);
  assert.equal(doc.historyStats.undoSteps, 1);
  doc.undo(); assert.deepEqual(doc.model, before); assert.deepEqual(Buffer.from(doc.serialize()), original);
  doc.redo(); assert.deepEqual(doc.model, after);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `keyframes.${format}`);
    assert.equal(reopened.readOnly, false);
    close(timelineReadTrack(reopened.model, bone).Keys.find(key => key.Frame === current).Vector, [12, 23, 34]);
    close(timelineReadTrack(reopened.model, color).Keys.find(key => key.Frame === current).Vector, [.9, .4, .1]);
    assert.deepEqual(reopened.model.Geosets, baseline[format].Geosets);
    assert.deepEqual(reopened.model.Sequences, baseline[format].Sequences);
  }
});

test('cubic tracks, global association and tangent arrays survive retiming and both codecs', () => {
  const doc = createDemoDocument(), model = doc.model, boneId = model.Bones[0].ObjectId;
  doc.apply('Fixture curved global', ['Nodes', 'GlobalSequences'], model => {
    model.GlobalSequences = [600];
    model.Bones[0].Translation = track([key(0, [1, 2, 3], true), key(300, [4, 5, 6], true), key(600, [1, 2, 3], true)], 3, 0);
  });
  const target = find(model, boneId, 'Translation'), domain = timelineDomain(model, 0, 0);
  doc.apply('Retime cubic global', timelineSections, model => moveTimelineKeys(model, [target], refs(target, 300), -25, domain));
  const expected = structuredClone(timelineReadTrack(model, target));
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `global.${format}`), actual = timelineReadTrack(reopened.model, target);
    assert.equal(actual.LineType, 3); assert.equal(actual.GlobalSeqId, 0);
    assert.deepEqual(actual.Keys, expected.Keys);
  }
});

test('supported visibility and RGB node families roundtrip through both codecs, including Reforged popcorn', () => {
  const source = Buffer.from(createDemoDocument().serialize('mdl')).toString().replace(/FormatVersion\s+800/, 'FormatVersion 1000');
  const doc = openDocument(source, 'supported-families.mdl'), ids = [];
  doc.apply('Fixture node families', ['Nodes'], model => {
    for (const kind of ['Helper', 'Attachment', 'Light', 'ParticleEmitter', 'ParticleEmitter2', 'RibbonEmitter', 'ParticleEmitterPopcorn']) ids.push(createNode(model, kind).ObjectId);
  });
  const domain = timelineDomain(doc.model, 0), targets = timelineScope(doc.model, { scope: 'selected', nodeIds: ids, domain }).filter(target => !target.readOnly);
  const values = Object.fromEntries(targets.map(target => [target.trackId, target.property === 'Rotation' ? [0, 0, .6, .8] : target.property === 'Translation' ? [1, 2, 3] : target.property === 'Scaling' ? [1.1, 1.2, 1.3] : target.property.includes('Color') ? [.2, .4, .7] : [.3]]));
  const frame = Math.round((domain.start + domain.end) / 2);
  doc.apply('Key supported node families', timelineSections, model => setTimelineKeys(model, targets, frame, domain, values));
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), `families.${format}`);
    assert.equal(reopened.readOnly, false);
    for (const target of targets) {
      const key = timelineReadTrack(reopened.model, target)?.Keys?.find(item => item.Frame === frame);
      assert.ok(key, `${format}: missing ${target.label} ${target.property}`); close(key.Vector, values[target.trackId]);
    }
  }
});

test('clear and retime do not enable a disabled geoset tint', () => {
  const model = fixture(), domain = timelineDomain(model, 0), target = find(model, 0, 'Color', 'geoset');
  model.GeosetAnims[0].Flags = 1; model.GeosetAnims[0].Color = track([key(1000, [1, 0, 0]), key(1500, [0, 1, 0])]);
  moveTimelineKeys(model, [target], refs(target, 1000), 100, domain);
  clearTimelineKeys(model, [target], refs(target, 1500), domain);
  assert.equal(model.GeosetAnims[0].Flags, 1); close(timelineSample(model, target, 1200, domain), [1, 1, 1]);
});

test('copy to another animation retains unrelated keys and uses the selected range start as its origin', () => {
  const model = fixture(), domain = timelineDomain(model, 0), destination = timelineDomain(model, 1), target = find(model, 0, 'Translation');
  const original = structuredClone(model.Bones[0].Translation.Keys), clip = copyTimelineKeys(model, [target], selectTimelineRange(model, [target], domain, 1100, 1400), domain, 1100);
  pasteTimelineKeys(model, [target], clip, 3200, destination);
  assert.deepEqual(model.Bones[0].Translation.Keys.filter(key => key.Frame < 3200), original);
  assert.deepEqual(model.Bones[0].Translation.Keys.filter(key => key.Frame >= 3200).map(key => key.Frame), [3300, 3500]);
});

test('Popcorn MDL rotation repair retains quaternion W, cubic tangent W, global metadata and untouched input bytes', () => {
  const base = Buffer.from(createDemoDocument().serialize('mdl')).toString().replace(/FormatVersion\s+800/, 'FormatVersion 1000');
  const doc = openDocument(base, 'popcorn-cubic.mdl'); let id;
  doc.apply('Fixture global popcorn rotation', ['Nodes', 'GlobalSequences'], model => {
    const node = createNode(model, 'ParticleEmitterPopcorn'); id = node.ObjectId;
    model.GlobalSequences = [600]; node.Rotation = track([key(0, [0, 0, .6, .8], true), key(600, [0, 0, .8, .6], true)], 3, 0);
  });
  const target = find(doc.model, id, 'Rotation'), expected = structuredClone(timelineReadTrack(doc.model, target));
  for (const format of ['mdl', 'mdx']) {
    const bytes = doc.serialize(format), reopened = openDocument(bytes, `popcorn.${format}`);
    assert.equal(reopened.readOnly, false); assert.deepEqual(timelineReadTrack(reopened.model, target), expected);
    assert.deepEqual(Buffer.from(reopened.serialize()), Buffer.from(bytes));
  }
});

test('Popcorn RGB uses the literal RGB order in authored MDL and retains cubic color tangents on export', () => {
  const original = 'Version { FormatVersion 1000, } Model "RGB fixture" { BlendTime 150, } ParticleEmitterPopcorn "Color" { ObjectId 0, static LifeSpan 1, static Color { 0.2, 0.4, 0.7 }, static Alpha 1, Path "", AnimVisibilityGuide "", }';
  const doc = openDocument(original, 'rgb-popcorn.mdl'); assert.equal(doc.readOnly, false);
  close(doc.model.ParticleEmitterPopcorns[0].Color, [.2, .4, .7]);
  doc.apply('Cubic popcorn RGB', ['Nodes'], model => { model.ParticleEmitterPopcorns[0].Color = track([key(0, [.2, .4, .7], true), key(100, [.7, .4, .2], true)], 3); });
  const expected = structuredClone(doc.model.ParticleEmitterPopcorns[0].Color);
  const text = Buffer.from(doc.serialize('mdl')).toString(); assert.match(text, /0:\s*\{\s*0\.2,\s*0\.4,\s*0\.7\s*\}/);
  for (const format of ['mdl', 'mdx']) assert.deepEqual(openDocument(doc.serialize(format), `rgb.${format}`).model.ParticleEmitterPopcorns[0].Color, expected);
});
