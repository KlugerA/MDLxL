const pending = new WeakMap();

/** Run the existing verified serializer in a worker, just like GIF export.
 * The detached snapshot also associates the saved bytes with the right revision
 * if the live document changes while the worker or disk operation is pending.
 */
export function prepareModelSaveAsync(doc, format = doc.format, name = doc.name,
  createWorker = () => new Worker(new URL('./model-save.worker.js', import.meta.url), { type: 'module' })) {
  if (pending.has(doc)) return pending.get(doc);
  const operation = new Promise((resolve, reject) => {
    let worker;
    try {
      const snapshot = doc.captureRecoveryState({ includeHistory: false });
      worker = createWorker();
      const fail = error => { worker.terminate(); reject(error); };
      worker.onerror = event => fail(new Error(event.message || 'Model save worker failed.'));
      worker.onmessageerror = () => fail(new Error('Model save worker returned unreadable data.'));
      worker.onmessage = ({ data }) => {
        worker.terminate();
        doc.lastSaveTimings = data.timings;
        if (data.error) { reject(new Error(data.error)); return; }
        doc.rememberSerializedSnapshot(data.bytes, snapshot.model, snapshot.revision);
        resolve(data);
      };
      worker.postMessage({ snapshot, format, name });
    } catch (error) { worker?.terminate(); reject(error); }
  });
  pending.set(doc, operation);
  const clear = () => pending.delete(doc);
  operation.then(clear, clear);
  return operation;
}
