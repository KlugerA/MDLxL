import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDemoDocument } from '../src/editor-document.js';

// Vite already owns esbuild; do not require an extra hoisted package in pnpm.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite'))('esbuild');

async function component(file) {
  const result = await build({ entryPoints: [new URL('../app/' + file, import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports.default;
}
const Inspector = await component('MotionInspector.jsx'), Timeline = await component('KeyframeTimeline.jsx');
const model = createDemoDocument().model, id = model.Bones[0].ObjectId;
const finding = { signature: 'one', kind: 'holding-keys', nodeName: 'Arm', nodeId: id, property: 'Rotation', space: 'local', start: 0, end: 1100, time: 1000, targets: [{ role: 'hold', time: 1000, keyTimes: [500, 1000] }], explanation: 'Holding keys compress the transition.', evidence: '90° in 100 ms.' };
const motion = { result: { findings: [finding], notes: [] }, visible: [finding], desired: {}, active: finding };
function render(props = {}) { return renderToStaticMarkup(React.createElement(Inspector, { model, revision: 0, sequenceIndex: 0, globalSeqId: null, time: 1000, mode: 'rotate', selectedNodeIds: [id], motion, ...props })); }
test('warning offers selection of the holding keys in the existing editor, not a second delete action', () => {
  assert.equal(render({ motion: { ...motion, active: null } }), '');
  const html = render();
  assert.match(html, /Motion warning details/); assert.match(html, /Close motion warning/);
  assert.match(html, /Mark Desired/); assert.match(html, /Select 2 holding keys/); assert.match(html, /Replay section/);
  assert.match(html, /hold the movement until 1000 ms, leaving only 100 ms/);
  assert.doesNotMatch(html, /Delete selected key|Previous warning|Next warning|Show Keys|<input|<select|Motion findings|Find Motion Irregularities|Motion key inspector|Motion Z|quaternion/);
});
test('changed or resolved evidence cannot be marked Desired', () => {
  const html = render({ motion: { ...motion, stale: true, visible: [] } });
  assert.match(html, /Motion changed/); assert.match(html, /disabled="">Mark Desired/);
  assert.match(html, /disabled="" aria-pressed="true">Select 2 holding keys/);
  assert.match(render({ motion: { ...motion, active: { ...finding, resolved: true } } }), /no longer appears/);
});
test('clearing the selected bone while warning details are open does not crash', () => {
  const html = render({ selectedNodeIds: [], livePose: null });
  assert.match(html, /Motion warning details/);
  assert.match(html, /aria-pressed="false">Select 2 holding keys/);
});
test('inherited and curved motion do not invent responsible holding keys', () => {
  for (const item of [{ ...finding, space: 'model', targets: [] }, { ...finding, kind: 'curve-overshoot', targets: [] }]) {
    const html = render({ motion: { ...motion, active: item } });
    assert.match(html, /No single responsible key is identified/);
    assert.doesNotMatch(html, /Delete selected key|Select holding key/);
  }
});
test('held-pose warning identifies the old-pose neighbors without treating the new pose as disposable', () => {
  const html = render({ motion: { ...motion, active: { ...finding, kind: 'pose-spike', time: 900, targets: [{ role: 'surrounding-holds', time: 800, keyTimes: [800, 1000], returnTime: 1000, preserveTime: 900 }] }, visible: [finding, { ...finding, signature: 'two' }] } });
  assert.match(html, /Old-pose keys hold until 800 ms and pull back at 1000 ms/);
  assert.match(html, /Select 2 holding keys/); assert.match(html, /Your pose at 900 ms and the end poses stay unselected/);
  assert.doesNotMatch(html, /Delete selected key/);
  assert.match(html, /Previous warning/); assert.match(html, /Next warning/);
});
test('selection remains available for read-only or restricted tracks because it cannot edit data', () => {
  assert.doesNotMatch(render({ disabled: true, restrictions: { rotation: true } }), /disabled=""/);
});
test('only small warning markers show by default, underneath relevant existing keys', () => {
  const before = structuredClone(model);
  const html = renderToStaticMarkup(React.createElement(Timeline, { model, sequenceIndex: 0, motionFindings: [finding, { ...finding, signature: 'same-time' }], selectedNodeIds: [id] }));
  assert.equal((html.match(/class="motion-reel-warning"/g) || []).length, 1);
  assert.match(html, /data-frame="1000" class="motion-reel-warning"/);
  assert.match(html, /motion-warning-underline/);
  assert.doesNotMatch(html, /motion-reel-interval|Motion warning details|Find Motion Irregularities|Motion findings/);
  assert.deepEqual(model, before);
  const unrelated = renderToStaticMarkup(React.createElement(Timeline, { model, sequenceIndex: 0, motionFindings: [{ ...finding, nodeId: 999 }], selectedNodeIds: [id] }));
  assert.doesNotMatch(unrelated, /motion-reel-warning/);
  const between = renderToStaticMarkup(React.createElement(Timeline, { model, sequenceIndex: 0, motionFindings: [{ ...finding, targets: [], time: 950, keyTimes: [500, 1000] }], selectedNodeIds: [id] }));
  assert.match(between, /data-frame="1000" class="motion-reel-warning"/);
  assert.doesNotMatch(between, /data-frame="950"/);
});
test('Animations exposes the holding-key marker without requiring a bone or appearance-controller selection', () => {
  const html = renderToStaticMarkup(React.createElement(Timeline, { model, sequenceIndex: 0, activeController: 'animations', highlightKeyframes: true, selectedNodeIds: [], motionFindings: [{ ...finding, time: 900 }] }));
  assert.match(html, /data-frame="1000" class="motion-reel-warning"/);
});
test('clicking a warning can highlight its interval separately from ordinary keys', () => {
  const html = renderToStaticMarkup(React.createElement(Timeline, { model, sequenceIndex: 0, motionFindings: [finding], motionActive: finding, selectedNodeIds: [id] }));
  assert.match(html, /Motion warning: Arm, Rotation, 1000 ms, holding-keys/);
  assert.match(html, /motion-reel-interval/); assert.match(html, /classic-reel-key motion-key-highlight/);
  assert.match(html, /aria-pressed="true"/);
});
