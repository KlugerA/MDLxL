import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimatedPreviewBackground } from '../app/animated-preview-background.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture({ delayedDecode = false } = {}) {
  const timers = new Map(), drawn = [], durations = [80000, 140000], pending = [];
  let clock = 0, id = 0, opened = 0, closed = 0, peak = 0, decoderClosed = 0;
  class Decoder {
    static async isTypeSupported() { return true; }
    constructor() { this.tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: 2, repetitionCount: 1 } }; }
    decode({ frameIndex }) {
      const build = () => { opened++; peak = Math.max(peak, opened - closed); return { image: { index: frameIndex, duration: durations[frameIndex], displayWidth: 16, displayHeight: 8, close() { closed++; } } }; };
      if (delayedDecode) return new Promise(resolve => pending.push(() => resolve(build())));
      return Promise.resolve(build());
    }
    close() { decoderClosed++; }
  }
  const canvas = { width: 0, height: 0, getContext: () => ({ clearRect() {}, drawImage(frame) { canvas.index = frame.index; } }) };
  const options = {
    Decoder, fetchImage: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }), createCanvas: () => canvas,
    schedule: (fn, delay) => { timers.set(++id, { fn, delay }); return id; }, cancel: id => timers.delete(id), now: () => clock,
    onFrame: canvas => drawn.push(canvas.index),
  };
  return { options, drawn, pending, timers, canvas, counts: () => ({ opened, closed, peak, decoderClosed }), async advance() { const [id, timer] = timers.entries().next().value; timers.delete(id); clock += timer.delay; timer.fn(); await flush(); } };
}

test('GIF background respects durations, loops finite GIFs and holds only one decoded frame', async () => {
  const f = fixture(), player = createAnimatedPreviewBackground('blob:synthetic', f.options);
  await player.ready; await flush();
  assert.deepEqual(f.drawn, [0]); assert.equal([...f.timers.values()][0].delay, 80);
  await f.advance(); assert.deepEqual(f.drawn, [0, 1]); assert.equal([...f.timers.values()][0].delay, 140);
  await f.advance(); await f.advance(); await f.advance(); assert.deepEqual(f.drawn, [0, 1, 0, 1, 0]);
  assert.equal(f.counts().peak, 1);
  player.dispose(); assert.equal(f.timers.size, 0); assert.equal(f.counts().opened, f.counts().closed); assert.equal(f.counts().decoderClosed, 1);
  assert.equal(f.canvas.width, 0); assert.equal(f.canvas.height, 0);
});

test('replacing GIF while first decode is pending closes late frame and rejects readiness', async () => {
  const f = fixture({ delayedDecode: true }), player = createAnimatedPreviewBackground('blob:synthetic', f.options);
  await flush(); assert.equal(f.pending.length, 1);
  player.dispose(); await assert.rejects(player.ready, /no longer open/);
  f.pending.shift()(); await flush();
  assert.deepEqual(f.drawn, []); assert.deepEqual(f.counts(), { opened: 1, closed: 1, peak: 1, decoderClosed: 1 });
});

test('GIF decoder failure rejects readiness and releases decoder', async () => {
  const f = fixture(), errors = [];
  class BrokenDecoder extends f.options.Decoder { decode() { return Promise.reject(new Error('Invalid GIF')); } }
  const player = createAnimatedPreviewBackground('blob:invalid', { ...f.options, Decoder: BrokenDecoder, onError: error => errors.push(error.message) });
  await assert.rejects(player.ready, /Invalid GIF/); assert.deepEqual(errors, ['Invalid GIF']); assert.equal(f.counts().decoderClosed, 1);
});
