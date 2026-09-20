import test from 'node:test';
import assert from 'node:assert/strict';
import { classicTimelineDomain, classicTimelineTargets, classicPaste, unrestrictedTimelineTargets } from '../src/classic-keyframes.js';
import { timelineDomain, timelineTracks, timelineReadTrack, copyTimelineKeys, copyTimelinePose, setTimelineKeys, clearTimelineKeys, timelineKeys } from '../src/keyframe-timeline.js';

const key = (Frame, values, curved = false) => ({ Frame, Vector: new Float32Array(values), ...(curved ? { InTan: new Float32Array(values.map(v => v + .2)), OutTan: new Float32Array(values.map(v => v - .1)) } : {}) });
const track = (Keys, LineType = 1, GlobalSeqId = null) => ({ Keys, LineType, GlobalSeqId });
function fixture() {
  const bone = { ObjectId: 0, Name: 'Bone', Translation: track([key(100, [1, 2, 3], true), key(400, [4, 5, 6], true), key(2100, [7, 8, 9], true)], 2), Rotation: track([key(100, [0, 0, 0, 1]), key(500, [0, 0, 1, 0])]) };
  const light = { ObjectId: 1, Name: 'Light', Color: new Float32Array([.3, .4, .5]), AmbColor: track([key(200, [.2, .4, .6])]), Visibility: track([key(0, [1]), key(500, [0])], 0, 0), Intensity: track([key(9000, [1])]) };
  return { Info: {}, Nodes: [bone, light], Bones: [bone], Lights: [light], Geosets: [{}, {}], GeosetAnims: [{ GeosetId: 0, Flags: 2, Alpha: track([key(100, [.4]), key(500, [.8])]), Color: new Float32Array([1, .5, .1]) }],
    Sequences: [{ Name: 'Stand', Interval: new Uint32Array([100, 1000]) }, { Name: 'Attack', Interval: new Uint32Array([2000, 3000]) }], GlobalSequences: [500, 25000],
    Materials: [{ Layers: [{ Alpha: track([key(20000, [1])], 0, 1) }] }], TextureAnims: [{ Translation: track([key(8000, [0, 0, 0])]) }] };
}
const ids = targets => targets.map(t => t.trackId).sort();
const find = (model, property, id = 0, kind = 'node') => timelineTracks(model).find(t => t.kind === kind && t.id === id && t.property === property);

test('timeline set, key/pose paste, delete and release respect node transform locks while retaining appearance edits', () => {
  for (const locked of ['translation', 'rotation', 'scaling']) for (const action of ['set', 'pasteKeys', 'pastePose', 'clear']) {
    const model = fixture(); model.Bones[0].Scaling = track([key(100, [1, 1, 1])]);
    const domain = classicTimelineDomain(model, 0), targets = classicTimelineTargets(model, { highlightKeyframes: false, domain });
    const original = structuredClone(model), restrictions = { [locked]: true };
    const allowed = unrestrictedTimelineTargets(targets, restrictions), lockedProperty = locked[0].toUpperCase() + locked.slice(1);
    const stored = timelineKeys(model, targets, domain), clipboard = action === 'pastePose' ? copyTimelinePose(model, targets, 100, domain) : copyTimelineKeys(model, targets, stored.filter(k => k.frame === 100), domain, 100);
    if (action === 'set') setTimelineKeys(model, allowed, 700, domain);
    else if (action.startsWith('paste')) classicPaste(model, allowed, clipboard, 700, domain);
    else clearTimelineKeys(model, allowed, stored, domain);
    assert.deepEqual(model.Bones[0][lockedProperty], original.Bones[0][lockedProperty]);
    assert.notDeepEqual(model.GeosetAnims[0].Alpha, original.GeosetAnims[0].Alpha, 'geoset appearance remains editable');
    assert.ok(allowed.some(target => target.kind === 'node' && target.property === 'AmbColor'), 'node appearance remains editable');
    const after = structuredClone(model), released = unrestrictedTimelineTargets(targets, {});
    assert.equal(released.length, targets.length); assert.deepEqual(model, after, 'release only changes interaction state');
    setTimelineKeys(model, released.filter(target => target.kind === 'node' && target.id === 0 && target.property === lockedProperty), 800, domain);
    assert.notDeepEqual(model.Bones[0][lockedProperty], original.Bones[0][lockedProperty]);
  }
});

test('All spans local authored times and sequence endpoints without global clocks or mutation', () => {
  assert.deepEqual(classicTimelineDomain({}), { kind: 'local', globalSeqId: null, sequenceIndex: -1, start: 0, end: 1000, label: 'All' });
  const model = fixture(), before = structuredClone(model);
  assert.equal(classicTimelineDomain(model).end, 9000, 'context tracks still determine the All extent');
  model.Sequences.push({ Name: 'Long', Interval: [10000, 12000] });
  assert.equal(classicTimelineDomain(model).end, 12000);
  model.Sequences.pop(); assert.deepEqual(model, before);
  assert.equal(classicTimelineDomain({ Bones: [{ Translation: track([key(450, [1, 0, 0])]) }] }).end, 450);
  assert.equal(classicTimelineDomain({ Bones: [{ Translation: track([key(0, [1, 0, 0])]) }] }).end, 0);
});

test('named sequences and global timelines preserve core bounds and validation', () => {
  const model = fixture();
  assert.deepEqual(classicTimelineDomain(model, 1), timelineDomain(model, 1));
  assert.deepEqual(classicTimelineDomain(model, -1, 0), timelineDomain(model, -1, 0));
  assert.throws(() => classicTimelineDomain(model, 8), /Select an animation/);
  assert.throws(() => classicTimelineDomain(model, -1, 8), /global sequence/);
});

test('Highlight confines movement to the selected objects and one controller, including static defaults', () => {
  const model = fixture(), domain = classicTimelineDomain(model, 0);
  for (const [activeController, property] of Object.entries({ move: 'Translation', rotate: 'Rotation', scale: 'Scaling' })) {
    assert.deepEqual(ids(classicTimelineTargets(model, { nodeIds: [0], geosetIds: [0], activeController, domain })), [`node:0:${property}`]);
    assert.deepEqual(classicTimelineTargets(model, { activeController, domain }), []);
  }
  assert.deepEqual(classicTimelineTargets(model, { nodeIds: [0], activeController: 'unknown', domain }), []);
});

test('Animations Highlight includes selected editable appearance channels only in their own domain', () => {
  const model = fixture(), domain = classicTimelineDomain(model, 0);
  assert.deepEqual(ids(classicTimelineTargets(model, { nodeIds: [0, 1], geosetIds: [0], activeController: 'animations', domain })), ['geoset:0:Alpha', 'geoset:0:Color', 'node:1:AmbColor', 'node:1:Color']);
  assert.deepEqual(ids(classicTimelineTargets(model, { nodeIds: [1], geosetIds: [0], activeController: 'animations', domain: classicTimelineDomain(model, -1, 0) })), ['node:1:Visibility']);
  assert.deepEqual(classicTimelineTargets(model, { activeController: 'animations', domain }), []);
  const stale = timelineTracks(model); model.Lights[0].AmbColor.GlobalSeqId = 0;
  assert.equal(classicTimelineTargets(model, { tracks: stale, nodeIds: [1], activeController: 'animations', domain }).some(t => t.property === 'AmbColor'), false, 'stale UI metadata cannot move a track into the wrong clock');
});

test('Highlight off exposes authored editable tracks without static, empty, read-only or duplicate rows', () => {
  const model = fixture(); model.Bones[0].Scaling = track([]);
  const tracks = timelineTracks(model), scope = { tracks: [...tracks, ...tracks], highlightKeyframes: false, domain: classicTimelineDomain(model) };
  assert.deepEqual(ids(classicTimelineTargets(model, scope)), ['geoset:0:Alpha', 'node:0:Rotation', 'node:0:Translation', 'node:1:AmbColor']);
  assert.deepEqual(ids(classicTimelineTargets(model, { ...scope, domain: classicTimelineDomain(model, -1, 0) })), ['node:1:Visibility']);
  assert.deepEqual(classicTimelineTargets(model, { ...scope, tracks: [find(model, 'Translation'), { kind: 'node', id: 0, property: 'Unsupported' }].map(t => ({ ...t, readOnly: true })) }), []);
});

test('Ctrl+V of copied stored keys replaces collisions across sequences and preserves exact tangents and unrelated channels', () => {
  const model = fixture(), source = classicTimelineDomain(model, 0), destination = classicTimelineDomain(model, 1), target = find(model, 'Translation');
  const before = structuredClone(model), selected = [100, 400].map(frame => ({ trackId: target.trackId, frame }));
  const clipboard = copyTimelineKeys(model, [target], selected, source, 100), copied = structuredClone(clipboard);
  const targets = classicTimelineTargets(model, { nodeIds: [0], activeController: 'move', domain: destination });
  assert.equal(classicPaste(model, targets, clipboard, 2100, destination), 2);
  const out = timelineReadTrack(model, target);
  assert.deepEqual(out.Keys.filter(k => k.Frame < 2000), before.Bones[0].Translation.Keys.filter(k => k.Frame < 2000));
  assert.deepEqual(out.Keys.filter(k => k.Frame >= 2000), clipboard.entries[0].track.Keys.map(k => ({ ...k, Frame: k.Frame + 2000 })));
  assert.equal(out.LineType, 2); assert.deepEqual(model.Bones[0].Rotation, before.Bones[0].Rotation); assert.deepEqual(model.Lights, before.Lights); assert.deepEqual(model.GeosetAnims, before.GeosetAnims); assert.deepEqual(clipboard, copied);
});

test('Ctrl+V dispatches sampled poses separately, retains destination tangents and rejects mismatched clocks atomically', () => {
  const model = fixture(), domain = classicTimelineDomain(model, 0), target = find(model, 'Translation'), before = structuredClone(model);
  const pose = copyTimelinePose(model, [target], 250, domain), old = structuredClone(model.Bones[0].Translation.Keys.find(k => k.Frame === 400));
  assert.equal(classicPaste(model, [target], pose, 400, domain), 1);
  assert.deepEqual(model.Bones[0].Translation.Keys.find(k => k.Frame === 400), { ...old, Vector: new Float32Array(pose.entries[0].value) });
  assert.deepEqual(model.Bones[0].Rotation, before.Bones[0].Rotation);
  const unchanged = structuredClone(model), global = classicTimelineDomain(model, -1, 0), visibility = find(model, 'Visibility', 1), globalPose = copyTimelinePose(model, [visibility], 100, global);
  assert.throws(() => classicPaste(model, [target], globalPose, 500, domain), /timing differs/); assert.deepEqual(model, unchanged);
  assert.throws(() => classicPaste(model, [target], { kind: 'unknown' }, 500, domain), /Copy keys or a pose/);
  assert.throws(() => classicPaste(model, [], pose, 500, domain), /Select an object/);
});
