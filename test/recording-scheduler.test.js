import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingScheduler } from '../app/recording-scheduler.js';

function harness() {
  let clock = 0, id = 0, captures = 0;
  const tasks = new Map(), sent = [];
  const scheduler = createRecordingScheduler({ fps: 30, now: () => clock,
    capture: () => ({ time: clock, index: ++captures }), send: frame => sent.push(frame),
    setTimer: (fn, delay) => { tasks.set(++id, { fn, time: clock + delay }); return id; }, clearTimer: id => tasks.delete(id),
  });
  return { scheduler, sent, captures: () => captures, pendingTimers: () => tasks.size,
    advance(time) { while (tasks.size) { const [id, task] = [...tasks].sort((a,b)=>a[1].time-b[1].time)[0]; if(task.time>time)break;clock=task.time;tasks.delete(id);task.fn(); } clock=time; },
  };
}
test('capture overlaps worker processing and ready dispatches without waiting another frame interval', () => {
  const h = harness(); h.advance(0); assert.equal(h.sent.length,1);
  h.advance(34); assert.equal(h.captures(),2); assert.equal(h.sent.length,1);
  h.advance(40); h.scheduler.ready(); assert.equal(h.sent.length,2); assert.ok(h.sent[1].time < 34);
  h.advance(67); assert.equal(h.captures(),3); h.scheduler.ready(); assert.equal(h.sent.length,3);
  h.scheduler.stop(); assert.equal(h.pendingTimers(),0);
});
test('slow worker has only one pending captured frame; elapsed capture times survive backpressure', () => {
  const h = harness();h.advance(500);assert.equal(h.captures(),2);assert.equal(h.sent.length,1);assert.equal(h.pendingTimers(),0);
  h.scheduler.ready();h.advance(500);assert.equal(h.captures(),3);assert.equal(h.sent.length,2);assert.equal(h.sent[1].time,1000/30);
  h.scheduler.stop();assert.equal(h.sent.length,3);assert.equal(h.sent[2].time,500);h.scheduler.ready();h.advance(1000);assert.equal(h.captures(),3);
});
test('cancel discards the single pending frame and sends no more work', () => {
  const h=harness();h.advance(34);h.scheduler.stop({flush:false});h.advance(1000);h.scheduler.ready();assert.equal(h.sent.length,1);
});
