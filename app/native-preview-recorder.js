/** Worker-shaped adapter; desktop frames go directly to native lossless storage.
 * The existing scheduler bounds this chain to one in flight and one pending. */
export function createNativePreviewRecorder(desktop, settings) {
  let jobId, failed = false, finished = false;
  let queue = Promise.resolve();
  const recorder = {
    onmessage: null,
    postMessage(message) {
      queue = queue.then(async () => {
        if (failed) return;
        if (message.type === 'start') {
          ({ jobId } = await desktop.beginPreviewRecording({ ...settings, loop: !!message.loop }));
        } else if (message.type === 'frame') {
          const result = await desktop.writePreviewRecordingFrame({ jobId, width: message.width, height: message.height, time: message.time, buffer: message.buffer });
          recorder.onmessage?.({ data: { type: 'ready', ...result } });
        } else if (message.type === 'finish') {
          const result = await desktop.finishPreviewRecording({ jobId, time: message.time });
          finished = true;
          recorder.onmessage?.({ data: { type: 'finished', nativeJobId: result.jobId } });
        }
      }).catch(error => {
        failed = true;
        recorder.onmessage?.({ data: { type: 'error', message: error.message } });
      });
    },
    terminate() {
      if (!finished && jobId) {
        failed = true;
        // A failure releases the native job; a completed output remains for save.
        queue.finally(() => desktop.discardPreviewRecording(jobId).catch(() => {}));
      }
    },
  };
  return recorder;
}
