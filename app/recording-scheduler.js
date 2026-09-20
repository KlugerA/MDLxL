/** One frame in the encoder and at most one captured frame waiting for it.
 * Capture and worker encoding can overlap without an unbounded RGBA queue. */
export function createRecordingScheduler({ fps, capture, send, now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  const interval = 1000 / fps;
  let deadline = now(), timer = null, pending = null, busy = false, stopped = false;
  function arm() {
    if (stopped || pending || timer !== null) return;
    timer = setTimer(tick, Math.max(0, deadline - now()));
  }
  function dispatch() {
    if (busy || !pending) return;
    const frame = pending; pending = null; busy = true; send(frame);
  }
  function tick() {
    timer = null;
    if (stopped || pending) return;
    const started = now();
    // Skip missed deadlines; never duplicate a frame to fabricate the target FPS.
    deadline += Math.max(1, Math.floor((started - deadline) / interval) + 1) * interval;
    const frame = capture();
    if (stopped) return;
    pending = frame || null; dispatch(); arm();
  }
  arm();
  return {
    ready() { if (stopped) return; busy = false; dispatch(); arm(); },
    stop({ flush = true } = {}) {
      if (stopped) return;
      stopped = true; if (timer !== null) clearTimer(timer); timer = null;
      // At most one final frame is queued before the worker's finish message.
      if (flush && pending) send(pending);
      pending = null;
    },
  };
}
