/** Decode GIF frames on demand: one canvas and at most one prefetched frame. */
export function createAnimatedPreviewBackground(url, {
  onFrame, onError = () => {}, type = 'image/gif',
  Decoder = globalThis.ImageDecoder, fetchImage = globalThis.fetch,
  createCanvas = () => document.createElement('canvas'),
  schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout,
  now = () => performance.now(),
} = {}) {
  const abort = new AbortController();
  let disposed = false, decoder, timer, pendingFrame, canvas, resolveReady, rejectReady, readySettled = false;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; }); ready.catch(() => {});
  const settleReady = error => { if (readySettled) return; readySettled = true; error ? rejectReady(error) : resolveReady(); };
  const stop = () => {
    if (timer !== undefined) { cancel(timer); timer = undefined; }
    pendingFrame?.close(); pendingFrame = null;
    decoder?.close(); decoder = null; abort.abort();
  };
  const fail = error => { if (disposed) return; disposed = true; stop(); settleReady(error); onError(error); };
  async function prepare(index, due) {
    try {
      const { image } = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
      if (disposed) { image.close(); return; }
      pendingFrame = image;
      timer = schedule(() => {
        timer = undefined; const frame = pendingFrame; pendingFrame = null;
        if (disposed) { frame?.close(); return; }
        present(frame, index);
      }, Math.max(0, due - now()));
    } catch (error) { fail(error); }
  }
  function present(frame, index) {
    const duration = Math.max(20, (frame.duration || 100000) / 1000);
    try {
      const width = frame.displayWidth, height = frame.displayHeight;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, width, height); context.drawImage(frame, 0, 0, width, height);
      onFrame(canvas); settleReady();
    } catch (error) { fail(error); }
    finally { frame.close(); }
    if (!disposed && decoder.tracks.selectedTrack.frameCount > 1) {
      const next = (index + 1) % decoder.tracks.selectedTrack.frameCount;
      // Preview backgrounds always loop, independently of model playback and
      // of any finite repeat count stored in the GIF itself.
      void prepare(next, now() + duration);
    }
  }
  void (async () => {
    try {
      if (!Decoder || !await Decoder.isTypeSupported(type)) throw new Error('This graphics runtime cannot decode animated GIF backgrounds.');
      if (disposed) return;
      const response = await fetchImage(url, { signal: abort.signal });
      if (!response.ok) throw new Error('The selected animated preview background could not be loaded.');
      const bytes = await response.arrayBuffer(); if (disposed) return;
      decoder = new Decoder({ data: bytes, type, preferAnimation: true });
      await decoder.tracks.ready; if (disposed) return;
      if (!decoder.tracks.selectedTrack?.frameCount) throw new Error('The selected GIF contains no displayable frames.');
      canvas = createCanvas();
      const { image } = await decoder.decode({ frameIndex: 0, completeFramesOnly: true });
      if (disposed) { image.close(); return; }
      present(image, 0);
    } catch (error) { fail(error); }
  })();
  return {
    ready,
    dispose() {
      if (disposed) return; disposed = true; stop();
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      settleReady(new Error('This animated preview background is no longer open.'));
    },
  };
}
