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
const finding = { signature: 'one', kind: 'holding-keys', nodeName: 'Arm', nodeId: id, property: 'Rotation', space: 'local', start: 0, end: 1100, time: 1000, explanation: 'Holding keys compress the transition.', evidence: '90° in 100 ms.' };
const motion = { result: { findings: [finding], notes: [] }, visible: [finding], desired: {}, active: finding };
function render(props = {}) { return renderToStaticMarkup(React.createElement(Inspector, { model, revision: 0, sequenceIndex: 0, globalSeqId: null, time: 1000, mode: 'rotate', selectedNodeIds: [id], motion, ...props })); }
test('warning click exposes the selected key deletion directly without an expanded inspector', () => {
  assert.equal(render({ motion: { ...motion, active: null } }), '');
  const html = render();
  assert.match(html, /Motion warning details/); assert.match(html, /Close motion warning/);
  assert.match(html, /Mark Desired/); assert.match(html, /Delete selected key/); assert.match(html, /Replay section/);
  assert.match(html, /keeps the old pose until 1000 ms, leaving only 100 ms/);
  assert.doesNotMatch(html, /Previous warning|Next warning|Show Keys|<input|<select|Motion findings|Find Motion Irregularities|Motion key inspector|Motion Z|quaternion/);
});
test('changed or resolved evidence cannot be marked Desired', () => {
  const html = render({ motion: { ...motion, stale: true, visible: [] } });
  assert.match(html, /Motion changed/); assert.match(html, /disabled="">Mark Desired/);
  assert.match(html, /disabled="">Delete selected key/);
  assert.match(render({ motion: { ...motion, active: { ...finding, resolved: true } } }), /no longer has a warning/);
});
test('clearing the selected bone while warning details are open does not crash', () => {
  const html = render({ selectedNodeIds: [], livePose: null });
  assert.match(html, /Motion warning details/);
  assert.match(html, /disabled="">Delete selected key/);
});
test('inherited and curved motion cannot be mistaken for a single deletable bad key', () => {
  for (const item of [{ ...finding, space: 'model' }, { ...finding, kind: 'curve-overshoot' }]) {
    const html = render({ motion: { ...motion, active: item } });
    assert.match(html, /No single bad key is identified/);
    assert.doesNotMatch(html, /Delete selected key/);
  }
});
test('spike wording describes the selected stray key and navigation appears only for multiple warnings', () => {
  const html = render({ motion: { ...motion, active: { ...finding, kind: 'pose-spike' }, visible: [finding, { ...finding, signature: 'two' }] } });
  assert.match(html, /This key briefly turns the bone, then the next key turns it back/);
  assert.match(html, /Previous warning/); assert.match(html, /Next warning/);
});
test('deletion respects restricted channels and read-only documents', () => {
  assert.match(render({ disabled: true }), /disabled="">Delete selected key/);
  assert.match(render({ restrictions: { rotation: true } }), /disabled="">Delete selected key/);
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
  const between = renderToStaticMarkup(React.createElement(Timeline, { model, sequenceIndex: 0, motionFindings: [{ ...finding, time: 950, keyTimes: [500, 1000] }], selectedNodeIds: [id] }));
  assert.match(between, /data-frame="1000" class="motion-reel-warning"/);
  assert.doesNotMatch(between, /data-frame="950"/);
});
test('clicking a warning can highlight its interval separately from ordinary keys', () => {
  const html = renderToStaticMarkup(React.createElement(Timeline, { model, sequenceIndex: 0, motionFindings: [finding], motionActive: finding, selectedNodeIds: [id] }));
  assert.match(html, /Motion warning: Arm, Rotation, 1000 ms, holding-keys/);
  assert.match(html, /motion-reel-interval/); assert.match(html, /classic-reel-key motion-key-highlight/);
  assert.match(html, /aria-pressed="true"/);
});
