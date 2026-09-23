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
test('inspector renders real key values in degrees, neighboring keys, warnings and explicit sparse edit state', () => {
  const html = render();
  assert.match(html, /Stored key at 1000 ms/); assert.match(html, /Motion Z \(degrees\)/);
  assert.match(html, /Mark Desired/); assert.match(html, /Show Keys/); assert.match(html, /Replay section/);
  assert.match(html, /Previous warning/); assert.match(html, /Next warning/); assert.match(html, /Interpolation/);
  assert.doesNotMatch(html, /quaternion/);
  assert.match(render({ time: 750 }), /editing creates a key at 750 ms/);
});
test('stale results and global tracks cannot be edited or marked from stale evidence', () => {
  const html = render({ motion: { ...motion, stale: true, visible: [] } });
  assert.match(html, /Animation changed/); assert.match(html, /disabled="">Mark Desired/);
  const global = structuredClone(model); global.GlobalSequences = [2000]; global.Bones[0].Rotation.GlobalSeqId = 0;
  assert.match(render({ model: global }), /Shared global track/);
  assert.match(render({ model: global }), /aria-label="Motion Z \(degrees\)" disabled/);
});
test('timeline warnings remain separate, labelled buttons alongside ordinary key markers and highlighted interval', () => {
  const html = renderToStaticMarkup(React.createElement(Timeline, { model, sequenceIndex: 0, motionFindings: [finding], motionActive: finding, selectedNodeIds: [id] }));
  assert.match(html, /Motion warning: Arm, Rotation, 1000 ms, holding-keys/);
  assert.match(html, /motion-reel-interval/); assert.match(html, /classic-reel-key motion-key-highlight/);
});
